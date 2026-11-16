(() => {
  'use strict';

  const maxBytes = 10_000_000;
  const maxText = 200_000;
  const maxXml = 5_000_000;
  const zipEnd = 0x06054b50;
  const zipEntry = 0x02014b50;
  const zipLocalEntry = 0x04034b50;

  // OOXML and ODF packages both contain the main document body in one ZIP member.
  async function readZipMember(buffer, member) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const nameDecoder = new TextDecoder();
    let end = view.byteLength - 22;
    const floor = Math.max(0, end - 65535);
    while (end >= floor) {
      if (view.getUint32(end, true) === zipEnd &&
          end + 22 + view.getUint16(end + 20, true) === view.byteLength) break;
      end--;
    }
    if (end < floor || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) {
      throw new Error('error');
    }
    let entry = view.getUint32(end + 16, true);
    const directoryEnd = entry + view.getUint32(end + 12, true);
    if (directoryEnd > end) throw new Error('error');

    for (let index = 0, count = view.getUint16(end + 10, true); index < count; index++) {
      if (entry + 46 > directoryEnd || view.getUint32(entry, true) !== zipEntry) throw new Error('error');
      const nameLength = view.getUint16(entry + 28, true);
      const nameEnd = entry + 46 + nameLength;
      const next = nameEnd + view.getUint16(entry + 30, true) + view.getUint16(entry + 32, true);
      if (next > directoryEnd) throw new Error('error');
      const name = nameDecoder.decode(bytes.subarray(entry + 46, nameEnd));
      if (name === member) {
        const flags = view.getUint16(entry + 8, true);
        const method = view.getUint16(entry + 10, true);
        const compressed = view.getUint32(entry + 20, true);
        const size = view.getUint32(entry + 24, true);
        const offset = view.getUint32(entry + 42, true);
        if (size > maxXml) throw new Error('large');
        if ((flags & 1) || offset + 30 > directoryEnd ||
            view.getUint32(offset, true) !== zipLocalEntry) throw new Error('error');
        const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
        if (start + compressed > view.getUint32(end + 16, true)) throw new Error('error');
        const data = bytes.subarray(start, start + compressed);
        if (method === 0 && compressed === size) return decoder.decode(data);
        if (method !== 8) throw new Error('error');

        const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
        let total = 0;
        let xml = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > size || total > maxXml) {
            await reader.cancel();
            throw new Error('large');
          }
          xml += decoder.decode(value, { stream: true });
        }
        if (total !== size) throw new Error('error');
        return xml + decoder.decode();
      }
      entry = next;
    }
    throw new Error('error');
  }

  function extractDocument(xml, extension) {
    if (/<!DOCTYPE/i.test(xml)) throw new Error('error');
    const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
    if (documentXml.querySelector('parsererror')) throw new Error('error');

    if (extension === 'docx') {
      const namespace = documentXml.documentElement.namespaceURI;
      const body = documentXml.getElementsByTagNameNS(namespace, 'body')[0];
      if (!body) throw new Error('error');
      return Array.from(body.getElementsByTagNameNS(namespace, 'p'), paragraph => {
        const fragments = paragraph.getElementsByTagNameNS(namespace, '*');
        return Array.from(fragments, fragment => {
          if (fragment.localName === 't') return fragment.textContent;
          if (fragment.localName === 'br' || fragment.localName === 'cr') return '\n';
          return fragment.localName === 'tab' ? '\t' : '';
        }).join('');
      }).join('\n');
    }

    const office = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
    const textNamespace = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
    const body = documentXml.getElementsByTagNameNS(office, 'body')[0];
    const textBody = body?.getElementsByTagNameNS(office, 'text')[0];
    if (!textBody) throw new Error('error');
    let textLength = textBody.textContent.length;
    if (textLength > maxText) throw new Error('large');
    for (const element of Array.from(textBody.getElementsByTagNameNS(textNamespace, '*'))) {
      if (element.localName === 's') {
        const count = Number(element.getAttributeNS(textNamespace, 'c')) || 1;
        textLength += count;
        if (!Number.isInteger(count) || count < 1 || textLength > maxText) throw new Error('large');
        element.replaceWith(' '.repeat(count));
      }
      if (element.localName === 'line-break') element.replaceWith('\n');
      if (element.localName === 'tab') element.replaceWith('\t');
    }
    return Array.from(textBody.getElementsByTagNameNS(textNamespace, '*'))
      .filter(element => element.localName === 'p' || element.localName === 'h')
      .map(element => element.textContent).join('\n');
  }

  window.forbecorpReadDocument = async file => {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!/^(docx|odt|txt|md|csv)$/.test(extension)) throw new Error('type');
    if (file.size > maxBytes) throw new Error('large');
    const buffer = await file.arrayBuffer();
    let text;
    if (extension === 'docx' || extension === 'odt') {
      const member = extension === 'docx' ? 'word/document.xml' : 'content.xml';
      text = extractDocument(await readZipMember(buffer, member), extension);
    } else {
      const [first, second] = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 2));
      const encoding = first === 255 && second === 254 ? 'utf-16le'
        : first === 254 && second === 255 ? 'utf-16be'
          : 'utf-8';
      text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
    }
    if (text.length > maxText) throw new Error('large');
    if (!text.trim()) throw new Error('empty');
    return text;
  };

  const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
    let value = byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    return value;
  });

  function storedZip(entries, type) {
    const encoder = new TextEncoder();
    const files = [];
    const catalogue = [];
    let offset = 0;
    let catalogueSize = 0;
    for (const [name, content] of entries) {
      const filename = encoder.encode(name);
      const data = encoder.encode(content);
      let checksum = 0xffffffff;
      for (const byte of data) checksum = (checksum >>> 8) ^ crcTable[(checksum ^ byte) & 255];
      checksum = (checksum ^ 0xffffffff) >>> 0;

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, zipLocalEntry, true);
      local.setUint16(4, 20, true);
      local.setUint16(12, 33, true); // January 1, 1980 (DOS date)
      local.setUint32(14, checksum, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, filename.length, true);
      files.push(local.buffer, filename, data);

      const record = new DataView(new ArrayBuffer(46));
      record.setUint32(0, zipEntry, true);
      record.setUint16(4, 20, true);
      record.setUint16(6, 20, true);
      record.setUint16(14, 33, true);
      record.setUint32(16, checksum, true);
      record.setUint32(20, data.length, true);
      record.setUint32(24, data.length, true);
      record.setUint16(28, filename.length, true);
      record.setUint32(42, offset, true);
      catalogue.push(record.buffer, filename);
      catalogueSize += record.byteLength + filename.length;
      offset += local.byteLength + filename.length + data.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, zipEnd, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, catalogueSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...files, ...catalogue, end.buffer], { type });
  }

  function escapeXml(text) {
    return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/gu, '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  window.forbecorpMakeDocx = text => {
    const declaration = '<?xml version="1.0" encoding="UTF-8"?>';
    const paragraphs = text.split(/\r\n|[\n\r\u2028\u2029]/u).map(line => {
      const runs = line.split('\t').map(part => '<w:t xml:space="preserve">' + escapeXml(part) + '</w:t>');
      const rtl = /^[^\p{L}]*[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(line);
      const direction = rtl ? '<w:pPr><w:bidi/></w:pPr>' : '';
      return '<w:p>' + direction + '<w:r>' + runs.join('<w:tab/>') + '</w:r></w:p>';
    }).join('');
    const type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return storedZip([
      ['[Content_Types].xml', declaration + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
      ['_rels/.rels', declaration + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
      ['word/document.xml', declaration + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs + '</w:body></w:document>']
    ], type);
  };
})();
