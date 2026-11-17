
(() => {
  'use strict';

  const maxText = 200_000;
  const maxDocumentBytes = 40_000_000;
  const maxBatchBytes = 80_000_000;
  const defaultCleanup = { wrap: true, spaces: true, blank: true };

  function segment(language, granularity) {
    return Intl.Segmenter ? new Intl.Segmenter(language, { granularity }) : null;
  }

  function wordParts(text, words) {
    return words
      ? Array.from(words.segment(text)).filter(part => part.isWordLike)
      : Array.from(text.matchAll(/[\p{L}\p{M}\p{N}]+/gu), match => ({ segment: match[0], index: match.index }));
  }

  function abbreviate(text, max) {
    const end = Math.min(text.length, max);
    const highSurrogate = /[\uD800-\uDBFF]/.test(text.charAt(end - 1));
    return text.slice(0, highSurrogate ? end - 1 : end);
  }

  function reflow(text, spaces, blank, onChange) {
    const list = /^(?:[•●▪◦‣‧∙]\s*|[*–—-]\s+|[\p{Nd}]{1,4}(?:[.)]\s+|[、）]\s*)|[A-Za-z][.)]\s+)/u;
    const compact = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
    const output = [];
    let previous = '';
    let blankLines = 0;
    const lines = text.replace(/\u00ad[ \t]*\n[ \t]*/gu, () => { onChange(); return ''; }).split('\n');
    for (const raw of lines) {
      const line = spaces ? raw.trim() : raw;
      if (!line.trim()) {
        blankLines++;
        continue;
      }
      if (previous) {
        if (blankLines) {
          output.push('\n'.repeat(blank ? 2 : blankLines + 1));
          if (blank && blankLines > 1) onChange(blankLines - 1);
        } else if (list.test(line.trimStart())) {
          output.push('\n');
        } else {
          const first = line.trimStart().match(/^./u)[0];
          const last = previous.trimEnd().match(/.$/u)[0];
          const join = (/[-‐]/u.test(last) && /^\p{Ll}$/u.test(first))
            || (compact.test(last) && compact.test(first)) || /^[。！？、，；：]/u.test(first);
          if (!join && !/\s$/u.test(previous) && !/^\s/u.test(line)) output.push(' ');
          onChange();
        }
      } else if (blankLines && !blank) {
        output.push('\n'.repeat(blankLines));
      }
      output.push(line);
      previous = line;
      blankLines = 0;
    }
    if (blankLines && !blank) output.push('\n'.repeat(Math.max(0, blankLines - (previous ? 0 : 1))));
    return output.join('');
  }

  function cleanText(source, options = defaultCleanup) {
    let text = source;
    let changes = 0;
    const changed = (count = 1) => { changes += count; };
    const replace = (pattern, replacement) => {
      text = text.replace(pattern, match => {
        if (replacement !== match) changed();
        return replacement;
      });
    };
    if (options.wrap || options.blank || options.duplicates || options.sort || options.spaces) {
      replace(/\r\n|[\r\u2028]/gu, '\n');
      replace(/[\f\u2029]/gu, '\n\n');
    }
    if (options.tabs) replace(/\t/gu, ' '.repeat(options.tabWidth === 2 ? 2 : 4));
    if (options.invisible) replace(/[\u200b\u2060\uFEFF]/gu, '');
    if (options.spaces) {
      replace(/[\p{Zs}]{2,}|[^\S\n\t\r ]/gu, ' ');
      replace(/^ +| +$/gmu, '');
    }
    if (options.duplicates || options.sort) {
      const lines = text.split('\n');
      const seen = new Set();
      const nonempty = options.duplicates ? lines.filter(line => {
        if (!line.trim()) return true;
        if (seen.has(line)) { changed(); return false; }
        seen.add(line);
        return true;
      }) : lines;
      if (options.sort) {
        const collation = new Intl.Collator(options.language, { numeric: true });
        const sorted = nonempty.filter(line => line.trim()).sort((a, b) => {
          const result = collation.compare(a, b);
          return options.sort === 'desc' ? -result : result;
        });
        let active = 0;
        text = nonempty.map(line => line.trim() ? sorted[active++] : line).join('\n');
        if (text !== nonempty.join('\n')) changed();
      } else {
        text = nonempty.join('\n');
      }
    }
    if (options.wrap) {
      text = reflow(text, options.spaces, options.blank, changed);
    } else if (options.blank) {
      replace(/^\n+|\n+$/gu, '');
      text = text.replace(/\n{3,}/gu, runs => { changed(runs.length - 2); return '\n\n'; });
    }
    if (options.invisible || options.wrap) replace(/\u00ad/gu, '');
    if (options.caseMode) {
      const language = options.language;
      let output = text;
      if (options.caseMode === 'upper') output = text.toLocaleUpperCase(language);
      if (options.caseMode === 'lower') output = text.toLocaleLowerCase(language);
      if (options.caseMode === 'title') {
        const words = wordParts(text, segment(language, 'word'));
        const pieces = [];
        let cursor = 0;
        for (const word of words) {
          const [first] = word.segment;
          pieces.push(text.slice(cursor, word.index), first.toLocaleUpperCase(language),
            word.segment.slice(first.length).toLocaleLowerCase(language));
          cursor = word.index + word.segment.length;
        }
        pieces.push(text.slice(cursor));
        output = pieces.join('');
      }
      if (output !== text) changed();
      text = output;
    }
    return { text, changes: text === source ? 0 : Math.max(1, changes) };
  }

  function pageNumbers(selection, total) {
    if (!selection.trim()) return Array.from({ length: total }, (_, index) => index + 1);
    const included = new Set();
    const normalized = selection.normalize('NFKC')
      .replace(/[٠-٩۰-۹०-९০-৯]/gu, digit => String('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹०१२३४५६७८९০১২৩৪৫৬৭৮৯'.indexOf(digit) % 10))
      .replace(/[，、،;]/gu, ',');
    for (const fragment of normalized.split(',')) {
      const match = /^\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*$/u.exec(fragment);
      if (!match) throw new Error('range');
      const first = Number(match[1]);
      const last = match[2] === undefined ? first : Number(match[2]);
      if (first < 1 || last < first || last > total) throw new Error('range');
      for (let page = first; page <= last; page++) included.add(page);
    }
    return [...included];
  }

  function detectSeparator(text) {
    let quoted = false;
    const counts = new Map([[';', 0], [',', 0], ['\t', 0]]);
    for (const char of text.slice(0, 64_000)) {
      if (char === '"') quoted = !quoted;
      if (!quoted && /[\r\n]/u.test(char)) break;
      if (!quoted && counts.has(char)) counts.set(char, counts.get(char) + 1);
    }
    return [...counts].reduce((best, current) => current[1] > best[1] ? current : best, [',', 0])[0];
  }

  function parseCsv(input, delimiter = detectSeparator(input)) {
    const text = input.replace(/^\uFEFF/u, '');
    let rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    let closedQuote = false;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
        else if (char === '"') { quoted = false; closedQuote = true; }
        else cell += char;
        continue;
      }
      if (char === '"' && !cell && !closedQuote) { quoted = true; continue; }
      if (char === delimiter || char === '\n' || char === '\r') {
        row.push(cell);
        cell = '';
        closedQuote = false;
        if (char !== delimiter) {
          rows.push(row);
          row = [];
          if (char === '\r' && text[index + 1] === '\n') index++;
        }
      } else {
        if (closedQuote || char === '"') throw new Error('csv');
        cell += char;
      }
    }
    if (quoted) throw new Error('csv');
    if (cell || closedQuote || row.length) rows.push([...row, cell]);
    return rows;
  }

  function csvString(rows, delimiter) {
    return rows.map(row => row.map(cell => cell.includes(delimiter) || (row.length === 1 && cell === '') || /["\r\n]/u.test(cell)
      ? '"' + cell.replaceAll('"', '""') + '"' : cell).join(delimiter)).join('\r\n');
  }

  function markdownTable(rows, hasHeader) {
    const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
    if (!columns) return '';
    const escape = value => value.replaceAll('\\', '\\\\').replaceAll('|', '\\|')
      .replace(/[\r\n]+/gu, ' ').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const line = cells => '| ' + Array.from({ length: columns }, (_, index) => cells[index] || '').join(' | ') + ' |';
    const header = hasHeader ? rows[0].map(escape) : Array.from({ length: columns }, () => '');
    return [line(header), line(Array(columns).fill('---')), ...(hasHeader ? rows.slice(1) : rows).map(cells => line(cells.map(escape)))].join('\n');
  }

  function safeBaseName(filename) {
    return filename.replace(/\.[^.]*$/u, '').replace(/[<>:"/\\|?*\p{Cc}]/gu, '_').replace(/^[. ]+|[. ]+$/gu, '').slice(0, 90) || 'document';
  }

  function graphemeCount(text, graphemes) {
    if (!graphemes) return [...text].length;
    let total = 0;
    for (const ignored of graphemes.segment(text)) total++;
    return total;
  }

  globalThis.ForbeCore = { maxText, maxDocumentBytes, maxBatchBytes, defaultCleanup, segment, wordParts,
    abbreviate, cleanText, pageNumbers, detectSeparator, parseCsv, csvString, markdownTable, safeBaseName, graphemeCount };
})();
