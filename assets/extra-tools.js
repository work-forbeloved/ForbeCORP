
(() => {
  'use strict';

  const W = window.ForbeWork;
  const C = window.ForbeCore;
  const get = W.get;
  const page = document.body.dataset.tool;

  async function readDocument(file, signal) {
    if (window.ForbePdf?.isPdf(file)) {
      const result = await window.ForbePdf.extract(file, '', signal);
      if (!result.text) throw new Error('empty');
      return result.text;
    }
    return W.abortable(window.forbecorpReadDocument(file), signal);
  }

  function fileResult(name, type, bytes) {
    return { name, blob: new Blob([bytes], { type }) };
  }

  async function sampleFile(filename, signal) {
    const response = await W.fetchLocal('samples/' + filename, { signal });
    if (!response.ok) throw new Error('sample');
    return new File([await response.blob()], filename);
  }

  function runComparison(before, after, options, signal) {
    if (location.protocol === 'file:') throw new Error('serve');
    const worker = new Worker(new URL('diff-worker.js', W.root));
    const result = new Promise((resolve, reject) => {
      worker.onmessage = event => event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.blocks);
      worker.onerror = () => reject(new Error('compare'));
      worker.postMessage({ before, after, options });
    });
    return W.abortable(result, signal).finally(() => worker.terminate());
  }

  function compareTool() {
    const panel = get('compare-work');
    const left = get('compare-left');
    const right = get('compare-right');
    const sample = get('compare-sample');
    const start = get('compare-run');
    const status = get('compare-status');
    const body = get('compare-results');
    const rows = get('compare-rows');
    const unchanged = get('compare-changes-only');
    const next = get('compare-next');
    const previous = get('compare-prev');
    const options = [get('compare-mode'), get('compare-ignore')];
    let active = -1;
    let changes = [];
    const refresh = () => { start.disabled = !left.value && !right.value; };
    const job = W.makeJob(panel, refresh);

    function reset() {
      if (job.busy) return;
      refresh();
      body.hidden = true;
      rows.replaceChildren();
      active = -1;
      changes = [];
      status.textContent = '';
    }

    W.bindPicker('compare-left-file', ([file]) => job.run(async ({ signal, report }) => {
      W.setText(left, await readDocument(file, signal));
      body.hidden = true;
      report('msgFileLoaded', { file: file.name });
    }));
    W.bindPicker('compare-right-file', ([file]) => job.run(async ({ signal, report }) => {
      W.setText(right, await readDocument(file, signal));
      body.hidden = true;
      report('msgFileLoaded', { file: file.name });
    }));
    [left, right, ...options].forEach(field => W.watchValue(field, reset));

    sample.addEventListener('click', () => {
      if (left.value.trim() || right.value.trim()) { W.statement(status, 'msgClearForExample'); return; }
      W.setText(left, sample.dataset.before.replaceAll('\\n', '\n'));
      W.setText(right, sample.dataset.after.replaceAll('\\n', '\n'));
      left.focus();
    });

    function draw(blocks) {
      const content = document.createDocumentFragment();
      changes = [];
      active = -1;
      for (const value of blocks) {
        const row = document.createElement('div');
        row.className = 'diff-row';
        row.dataset.changed = String(value.changed);
        if (value.changed) { changes.push(row); row.tabIndex = -1; }
        row.hidden = unchanged.checked && !value.changed;
        for (const pane of ['before', 'after']) {
          const cell = document.createElement('pre');
          cell.className = 'diff-cell diff-' + pane;
          cell.dir = 'auto';
          for (const part of value[pane]) {
            if (!part.edited) cell.append(part.text);
            else {
              const marker = document.createElement(pane === 'before' ? 'del' : 'ins');
              marker.textContent = part.text;
              cell.append(marker);
            }
          }
          row.append(cell);
        }
        content.append(row);
      }
      rows.replaceChildren(content);
      previous.disabled = next.disabled = !changes.length;
      updateVisibility();
      get('compare-count').textContent = '';
    }

    function go(step) {
      if (!changes.length) return;
      changes[active]?.classList.remove('is-current');
      active = active < 0 ? step > 0 ? 0 : changes.length - 1 : (active + step + changes.length) % changes.length;
      const row = changes[active];
      row.classList.add('is-current');
      row.scrollIntoView({ block: 'nearest' });
      row.focus({ preventScroll: true });
      get('compare-count').textContent = W.msg('msgDiffPosition', { current: W.numeric.format(active + 1), total: W.numeric.format(changes.length) });
    }

    next.addEventListener('click', () => go(1));
    previous.addEventListener('click', () => go(-1));
    function updateVisibility() {
      for (const child of rows.children) child.hidden = unchanged.checked && child.dataset.changed === 'false';
      body.hidden = !rows.children.length || (unchanged.checked && !changes.length);
    }
    unchanged.addEventListener('change', updateVisibility);
    for (const control of body.querySelectorAll('[data-side]')) {
      control.addEventListener('click', () => {
        body.dataset.side = control.dataset.side;
        body.querySelectorAll('[data-side]').forEach(button => {
          if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button === control));
        });
      });
    }
    start.addEventListener('click', () => job.run(async ({ signal, report }) => {
      const blocks = await runComparison(left.value, right.value, { mode: options[0].value, ignore: options[1].checked, language: W.code }, signal);
      signal.throwIfAborted();
      draw(blocks);
      report(changes.length ? 'msgDiffCount' : 'msgNoChanges', { total: W.numeric.format(changes.length) }, 1);
    }));
  }

  function documentTool() {
    const panel = get('doc-work');
    const status = get('doc-status');
    const result = get('doc-output');
    const job = W.makeJob(panel);
    const open = file => job.run(async ({ signal, report }) => {
      const text = await readDocument(file, signal);
      signal.throwIfAborted();
      W.setText(result, text);
      report('msgFileLoaded', { file: file.name }, 1);
    });
    W.bindPicker('doc-source', ([file]) => open(file));
    get('doc-sample').addEventListener('click', () => job.run(async ({ signal, report }) => {
      const file = await sampleFile('example.docx', signal);
      W.setText(result, await readDocument(file, signal));
      report('msgFileLoaded', { file: file.name }, 1);
    }));
    status.textContent = '';
  }

  function tableTool() {
    const panel = get('table-work');
    const field = get('table-input');
    const separator = get('table-separator');
    const encoding = get('table-encoding');
    const header = get('table-header');
    const dedupe = get('table-dedupe');
    const list = get('table-list-mode');
    const run = get('table-run');
    const status = get('table-status');
    const preview = get('table-preview');
    const caption = preview.querySelector('caption');
    const output = get('table-output');
    const mode = get('table-output-format');
    const save = get('table-download');
    let rawFile;
    const values = { comma: ',', semi: ';', tab: '\t' };
    const refresh = () => {
      run.disabled = !field.value.trim();
      separator.disabled = list.checked;
      header.disabled = list.checked;
    };
    const job = W.makeJob(panel, refresh);

    async function readFile(file) {
      await job.run(async ({ signal, report }) => {
        const text = await W.abortable(W.textFromFile(file, encoding.value), signal);
        W.setText(field, text);
        report('msgFileLoaded', { file: file.name }, 1);
      });
    }
    W.bindPicker('table-source', ([file]) => { rawFile = file; void readFile(file); });
    encoding.addEventListener('change', () => { if (rawFile) void readFile(rawFile); });
    function invalidate() {
      save.disabled = true;
      W.setText(output, '');
      if (!preview.hidden) status.textContent = '';
      preview.hidden = true;
    }
    W.watchValue(field, () => { refresh(); invalidate(); });
    list.addEventListener('change', () => { refresh(); invalidate(); });
    for (const control of [separator, header, dedupe, mode]) control.addEventListener('change', invalidate);

    function draw(rows, hasHeader) {
      const body = document.createElement('tbody');
      const head = document.createElement('thead');
      rows.slice(0, 31).forEach((row, index) => {
        const isHeader = hasHeader && index === 0;
        const tr = document.createElement('tr');
        for (const value of row.slice(0, 12)) {
          const cell = document.createElement(isHeader ? 'th' : 'td');
          if (isHeader) cell.scope = 'col';
          cell.dir = 'auto';
          cell.textContent = value;
          tr.append(cell);
        }
        (isHeader ? head : body).append(tr);
      });
      preview.replaceChildren(caption, head, body);
      preview.hidden = !rows.length;
      save.disabled = !output.value;
    }

    run.addEventListener('click', () => {
      try {
        const delim = values[separator.value] || C.detectSeparator(field.value);
        const lines = list.checked ? field.value.split(/\r\n?|\n/u).filter(line => line.trim()).map(line => [line]) : C.parseCsv(field.value, delim);
        if (!lines.length) throw new Error('empty');
        const columns = lines.reduce((maximum, row) => Math.max(maximum, row.length), 0);
        if (columns > 100 || lines.length > 20_000 || columns * lines.length > 150_000) throw new Error('large');
        const hasHeader = header.checked && !list.checked;
        const seen = new Set();
        const rows = dedupe.checked ? lines.filter((row, index) => {
          if (hasHeader && index === 0) return true;
          const key = JSON.stringify(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }) : lines;
        const markdown = mode.value === 'md';
        W.setText(output, markdown ? C.markdownTable(rows, hasHeader) : C.csvString(rows, delim));
        draw(rows, hasHeader);
        W.statement(status, 'msgTableReady', { rows: W.numeric.format(rows.length), columns: W.numeric.format(columns),
          duplicates: W.numeric.format(lines.length - rows.length) });
      } catch (error) {
        W.showError(status, error);
      }
    });
    save.addEventListener('click', () => {
      const ext = mode.value === 'md' ? 'md' : 'csv';
      const payload = ext === 'csv' ? '\ufeff' + output.value : output.value;
      const result = fileResult('forbecorp-table.' + ext, ext === 'csv' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8', payload);
      if (output.value) W.download(result.blob, result.name);
    });
  }

  function markdownTool() {
    const field = get('markdown-input');
    const run = get('markdown-run');
    const output = get('markdown-output');
    const save = get('markdown-download');
    const status = get('markdown-status');
    const panel = get('markdown-work');
    const refresh = () => { run.disabled = !field.value.trim(); };
    const job = W.makeJob(panel, refresh);
    let result;
    W.watchValue(field, () => {
      refresh();
      if (!result) return;
      result = undefined;
      output.replaceChildren();
      output.hidden = true;
      save.disabled = true;
      status.textContent = '';
    });
    W.bindPicker('markdown-source', ([file]) => job.run(async ({ signal, report }) => {
      W.setText(field, await W.abortable(W.textFromFile(file), signal));
      report('msgFileLoaded', { file: file.name });
    }));
    run.addEventListener('click', () => job.run(async ({ signal, report }) => {
      const markdown = await W.abortable(W.library('vendor/markdown-it/markdown-it.min.js', 'markdownit'), signal);
      const renderer = markdown({ html: false, linkify: false });
      // Document content stays local. Display an image's alternate text in place of loading its URL.
      renderer.renderer.rules.image = (tokens, index) => renderer.utils.escapeHtml(tokens[index].content);
      renderer.renderer.rules.link_open = (tokens, index, options, env, self) => {
        tokens[index].attrSet('rel', 'noopener noreferrer');
        tokens[index].attrSet('target', '_blank');
        return self.renderToken(tokens, index, options);
      };
      const html = renderer.render(field.value);
      signal.throwIfAborted();
      output.innerHTML = html;
      output.hidden = false;
      save.disabled = false;
      const direction = W.code === 'ar' ? 'rtl' : 'ltr';
      result = '<!doctype html>\n<html lang="' + W.code + '" dir="' + direction + '"><meta charset="utf-8"><title>Markdown · ForbeCORP</title><body>\n' + html + '\n</body></html>';
      report('msgPreviewReady', {}, 1);
    }));
    save.addEventListener('click', () => { if (result) W.download(new Blob([result], { type: 'text/html;charset=utf-8' }), 'forbecorp-markdown.html'); });
    status.textContent = '';
  }

  async function openImage(file, signal) {
    if (!/\.(jpe?g|png|webp|gif|bmp|ico|avif)$/iu.test(file.name)) throw new Error('type');
    if (file.size > C.maxDocumentBytes) throw new Error('large');
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
    try { await W.abortable(image.decode(), signal); }
    finally { URL.revokeObjectURL(objectUrl); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000) throw new Error('dimensions');
    return image;
  }

  // Encode padded BGR rows for BMP; embed a PNG in a single-image ICO.
  async function encodeImage(canvas, type, quality) {
    const w = canvas.width, h = canvas.height;
    if (type === 'image/bmp') {
      const stride = Math.ceil(w * 3 / 4) * 4;
      const bytes = new Uint8Array(54 + stride * h), view = new DataView(bytes.buffer);
      bytes.set([0x42, 0x4d]);
      view.setUint32(2, bytes.length, true); view.setUint32(10, 54, true);
      view.setUint32(14, 40, true); view.setInt32(18, w, true); view.setInt32(22, h, true);
      view.setUint16(26, 1, true); view.setUint16(28, 24, true); view.setUint32(34, stride * h, true);
      const pixels = canvas.getContext('2d').getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const src = (y * w + x) * 4, dst = 54 + (h - 1 - y) * stride + x * 3;
        bytes[dst] = pixels[src + 2]; bytes[dst + 1] = pixels[src + 1]; bytes[dst + 2] = pixels[src];
      }
      return new Blob([bytes], { type });
    }
    const icon = type === 'image/x-icon';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, icon ? 'image/png' : type, quality));
    if (!blob || (!icon && blob.type !== type)) throw new Error('format');
    if (!icon) return blob;
    const header = new Uint8Array(22), view = new DataView(header.buffer);
    view.setUint16(2, 1, true); view.setUint16(4, 1, true);
    header[6] = w === 256 ? 0 : w; header[7] = h === 256 ? 0 : h;
    view.setUint16(10, 1, true); view.setUint16(12, 32, true);
    view.setUint32(14, blob.size, true); view.setUint32(18, 22, true);
    return new Blob([header, blob], { type });
  }

  function imageTool() {
    const panel = get('image-work');
    const start = get('image-run');
    const from = get('image-original');
    const to = get('image-result');
    const format = get('image-format');
    const quality = get('image-quality');
    const width = get('image-width');
    const height = get('image-height');
    const proportional = get('image-ratio');
    const save = get('image-download');
    const status = get('image-status');
    let source;
    let image;
    let result;
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    for (const option of format.options) {
      if (['image/jpeg', 'image/webp'].includes(option.value)) {
        option.disabled = !probe.toDataURL(option.value).startsWith('data:' + option.value + ';');
      }
    }
    if (format.selectedOptions[0]?.disabled) format.value = [...format.options].find(option => !option.disabled).value;

    function invalidate() {
      if (!result) return;
      URL.revokeObjectURL(to.dataset.url);
      delete to.dataset.url;
      to.removeAttribute('src');
      to.hidden = true;
      get('image-after-meta').textContent = '';
      save.disabled = true;
      result = undefined;
      status.textContent = '';
    }

    const refresh = () => {
      start.disabled = !source || !image;
      quality.disabled = !['image/jpeg', 'image/webp'].includes(format.value);
      get('image-quality-value').textContent = quality.disabled ? '—' : quality.value + '%';
    };
    const job = W.makeJob(panel, refresh);

    async function choose(file, signal, report) {
      const decoded = await openImage(file, signal);
      signal.throwIfAborted();
      source = file;
      image = decoded;
      width.value = String(image.naturalWidth);
      height.value = String(image.naturalHeight);
      const url = URL.createObjectURL(source);
      if (from.dataset.url) URL.revokeObjectURL(from.dataset.url);
      from.src = from.dataset.url = url;
      from.hidden = false;
      if (to.dataset.url) URL.revokeObjectURL(to.dataset.url);
      delete to.dataset.url;
      to.removeAttribute('src');
      to.hidden = true;
      get('image-after-meta').textContent = '';
      save.disabled = true;
      result = undefined;
      const before = get('image-before-meta');
      before.textContent = file.name + ' · ' + W.numeric.format(image.naturalWidth) + ' × ' + W.numeric.format(image.naturalHeight) + ' · ' + size(file.size);
      report('msgFileLoaded', { file: file.name });
    }

    function size(bytes) {
      const scaled = bytes >= 1_000_000 ? bytes / 1_000_000 : bytes / 1000;
      const digits = new Intl.NumberFormat(W.code, { maximumFractionDigits: 1 });
      return digits.format(scaled) + (bytes >= 1_000_000 ? ' MB' : ' kB');
    }

    W.bindPicker('image-source', ([file]) => job.run(({ signal, report }) => choose(file, signal, report)));
    get('image-sample').addEventListener('click', () => job.run(async ({ signal, report }) =>
      choose(await sampleFile('example.png', signal), signal, report)));
    format.addEventListener('change', () => { invalidate(); refresh(); });
    for (const input of [width, height, quality]) input.addEventListener('input', invalidate);
    width.addEventListener('input', () => {
      if (image && proportional.checked) height.value = String(Math.max(1, Math.round(Number(width.value) * image.naturalHeight / image.naturalWidth)));
    });
    height.addEventListener('input', () => {
      if (image && proportional.checked) width.value = String(Math.max(1, Math.round(Number(height.value) * image.naturalWidth / image.naturalHeight)));
    });
    quality.addEventListener('input', () => { get('image-quality-value').textContent = quality.value + '%'; quality.style.setProperty('--range-fill', quality.value + '%'); });

    start.addEventListener('click', () => job.run(async ({ signal, report }) => {
      const iw = Number(width.value), ih = Number(height.value);
      if (!Number.isInteger(iw) || !Number.isInteger(ih) || iw < 1 || ih < 1 || Math.max(iw, ih) > 8192) throw new Error('dimensions');
      const scale = format.value === 'image/x-icon' ? Math.min(1, 256 / Math.max(iw, ih)) : 1;
      const w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
      if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || Math.max(w, h) > 8192 || w * h > 32_000_000) throw new Error('dimensions');
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      try {
        const context = canvas.getContext('2d', { alpha: !['image/jpeg', 'image/bmp'].includes(format.value) });
        if (!context) throw new Error('dimensions');
        if (['image/jpeg', 'image/bmp'].includes(format.value)) { context.fillStyle = '#fff'; context.fillRect(0, 0, w, h); }
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, w, h);
        const blob = await W.abortable(encodeImage(canvas, format.value, Number(quality.value) / 100), signal);
        if (!blob || blob.type !== format.value) throw new Error('format');
        const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/x-icon': 'ico' }[blob.type];
        result = { blob, name: C.safeBaseName(source.name) + '.' + extension };
        const url = URL.createObjectURL(blob);
        if (to.dataset.url) URL.revokeObjectURL(to.dataset.url);
        to.src = to.dataset.url = url;
        to.hidden = false;
        save.disabled = false;
        get('image-after-meta').textContent = result.name + ' · ' + W.numeric.format(w) + ' × ' + W.numeric.format(h) + ' · ' + size(blob.size);
        report('msgImageReady', {}, 1);
      } finally {
        canvas.width = 1;
      }
    }));
    save.addEventListener('click', () => { if (result) W.download(result.blob, result.name); });
    status.textContent = '';
    refresh();
  }

  function batchTool() {
    const panel = get('batch-work');
    const list = get('batch-list');
    const status = get('batch-status');
    const run = get('batch-run');
    const save = get('batch-download');
    const mode = get('batch-mode');
    const range = get('batch-range');
    const source = get('batch-source');
    let files = [];
    let result;
    const refresh = () => {
      run.disabled = !files.length;
      range.disabled = mode.value === 'clean';
      get('batch-page-options').hidden = range.disabled;
      get('batch-cleanup-note').hidden = !range.disabled;
    };
    const job = W.makeJob(panel, refresh);

    function draw(items) {
      const rows = items.map(({ name, state, reason }) => {
        const row = document.createElement('li');
        const filename = document.createElement('span');
        const details = document.createElement('span');
        filename.dir = 'auto';
        filename.textContent = name;
        details.textContent = W.msg(state, reason);
        row.append(filename, details);
        return row;
      });
      list.replaceChildren(...rows);
    }

    function choose(picked) {
      if (!picked.length || picked.length > 24 || picked.reduce((total, file) => total + file.size, 0) > C.maxBatchBytes) {
        W.showError(status, new Error('large'));
        return;
      }
      files = picked;
      result = undefined;
      save.disabled = true;
      draw(files.map(file => ({ name: file.name, state: 'msgQueued' })));
      status.textContent = '';
      refresh();
    }

    W.bindPicker('batch-source', choose);
    function invalidateBatch() {
      result = undefined;
      save.disabled = true;
      draw(files.map(file => ({ name: file.name, state: 'msgQueued' })));
      status.textContent = '';
    }
    range.addEventListener('input', invalidateBatch);
    mode.addEventListener('change', () => {
      invalidateBatch();
      source.accept = mode.value === 'clean' ? '.txt,.docx,.odt,.md,.csv' : '.pdf';
      refresh();
    });
    get('batch-sample').addEventListener('click', () => job.run(async ({ signal, report }) => {
      if (mode.value === 'clean') {
        choose([new File([get('batch-sample').dataset.sample.replaceAll('\\n', '\n')], 'example.txt')]);
      } else {
        choose([await window.ForbePdf.example(signal)]);
      }
      report('msgExampleReady');
    }));
    run.addEventListener('click', () => job.run(async ({ signal, report }) => {
      const entries = Object.create(null);
      const outcomes = [];
      const encoder = new TextEncoder();
      const saved = W.savedCleanup() || C.defaultCleanup;
      let outputBytes = 0;
      for (const [index, file] of files.entries()) {
        signal.throwIfAborted();
        report('msgFileProgress', { current: W.numeric.format(index + 1), total: W.numeric.format(files.length) }, index / files.length);
        try {
          const filename = String(index + 1).padStart(2, '0') + '-' + C.safeBaseName(file.name);
          let entry;
          let extension;
          if (mode.value === 'pages') {
            const edited = await window.ForbePdf.editPages([{ file, range: range.value, turn: 0 }], false, signal, () => {});
            entry = new Uint8Array(await edited.blob.arrayBuffer());
            extension = '.pdf';
          } else {
            let text;
            if (mode.value === 'extract') {
              text = (await window.ForbePdf.extract(file, range.value, signal)).text;
            } else {
              text = C.cleanText(await readDocument(file, signal), saved).text;
            }
            if (!text.trim()) throw new Error('empty');
            entry = encoder.encode(text);
            extension = '.txt';
          }
          if (outputBytes + entry.length > C.maxBatchBytes) throw new Error('large');
          outputBytes += entry.length;
          entries[filename + extension] = entry;
          outcomes.push({ name: file.name, state: 'msgDone' });
        } catch (error) {
          signal.throwIfAborted();
          const key = { range: 'msgRangeError', type: 'msgFileType', empty: 'msgNoText', large: 'msgLarge', password: 'msgProtectedPdf' }[error.message] || 'msgFailed';
          outcomes.push({ name: file.name, state: key });
        }
      }
      draw(outcomes);
      const passed = Object.keys(entries).length;
      if (!passed) {
        result = undefined;
        save.disabled = true;
        report('msgBatchReady', { done: W.numeric.format(0), failed: W.numeric.format(files.length) }, 1);
        return;
      }
      const blob = await W.zip(entries, signal);
      signal.throwIfAborted();
      result = blob;
      save.disabled = false;
      report('msgBatchReady', { done: W.numeric.format(passed), failed: W.numeric.format(files.length - passed) }, 1);
    }));
    save.addEventListener('click', () => { if (result) W.download(result, 'forbecorp-results.zip'); });
    refresh();
  }

  const tools = { 'text-compare': compareTool, 'document-to-text': documentTool, 'table-tools': tableTool, 'markdown-preview': markdownTool,
    'image-tools': imageTool, 'batch-tools': batchTool };
  tools[page]?.();
})();
