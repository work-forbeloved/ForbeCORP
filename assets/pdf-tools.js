
(() => {
  'use strict';

  const W = window.ForbeWork;
  const C = window.ForbeCore;
  const languages = {
    en: 'eng', es: 'spa', fr: 'fra', de: 'deu', pt: 'por', ru: 'rus', 'zh-CN': 'chi_sim',
    ar: 'ara', hi: 'hin', ja: 'jpn', ko: 'kor', it: 'ita', id: 'ind', tr: 'tur', bn: 'ben'
  };
  const frame = () => new Promise(resolve => setTimeout(resolve, 0));
  let engine;

  async function pdfEngine() {
    if (location.protocol === 'file:') throw new Error('serve');
    if (!engine) {
      engine = import(new URL('vendor/pdfjs/pdf.min.mjs', W.root)).then(pdf => {
        pdf.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', W.root).href;
        return pdf;
      }).catch(error => { engine = undefined; throw error; });
    }
    return engine;
  }

  function validateSize(file) {
    if (!file || file.size > C.maxDocumentBytes) throw new Error('large');
  }

  function isPdf(file) {
    return /\.pdf$/iu.test(file.name);
  }

  async function sampleFile(assetName, signal, filename = assetName) {
    const response = await W.fetchLocal('samples/' + assetName, { signal });
    if (!response.ok) throw new Error('sample');
    const blob = await response.blob();
    signal.throwIfAborted();
    return new File([blob], filename, { type: blob.type });
  }

  function example(signal) {
    return W.code === 'zh-CN'
      ? sampleFile('example-zh-CN.pdf', signal, 'PDF 示例.pdf')
      : sampleFile('example.pdf', signal);
  }

  async function withPdf(file, signal, inspect) {
    validateSize(file);
    if (!isPdf(file)) throw new Error('type');
    const pdf = await W.abortable(pdfEngine(), signal);
    const data = new Uint8Array(await W.abortable(file.arrayBuffer(), signal));
    const path = directory => new URL('vendor/pdfjs/' + directory + '/', W.root).href;
    const task = pdf.getDocument({
      data, cMapUrl: path('cmaps'), cMapPacked: true, standardFontDataUrl: path('standard_fonts'),
      iccUrl: path('iccs'), wasmUrl: path('wasm'), useWorkerFetch: true,
      isEvalSupported: false, enableXfa: false
    });
    const close = () => task.destroy().catch(() => {});
    const abort = () => { void close(); };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const document = await W.abortable(task.promise, signal);
      return await inspect(document);
    } catch (error) {
      if (error?.name === 'PasswordException') throw new Error('password');
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      await close();
    }
  }

  function textLayer(items) {
    const lines = [];
    let line = '';
    let last;
    for (const item of items) {
      if (typeof item.str !== 'string') continue;
      const [, , , , x, y] = item.transform;
      const vertical = item.dir === 'ttb';
      const baseline = vertical ? x : y;
      const extent = Math.max(item.height, last?.height || 0, 1);
      if (last && (vertical !== last.vertical || Math.abs(baseline - last.baseline) > Math.max(2, extent * .65))) {
        lines.push(line.trimEnd());
        line = '';
        last = undefined;
      }
      if (line && item.str && last && !/\s$/u.test(line) && !/^\s/u.test(item.str)) {
        const offset = vertical ? y : x;
        const gap = Math.abs(offset - last.end);
        if (gap > Math.max(1.2, extent * .16)) line += ' ';
      }
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trimEnd());
        line = '';
        last = undefined;
      } else if (item.str) {
        const start = vertical ? y : x;
        last = { baseline, vertical, height: item.height,
          end: start + (item.dir === 'rtl' || vertical ? -1 : 1) * (vertical ? item.height : item.width) };
      }
    }
    if (line) lines.push(line.trimEnd());
    return lines.join('\n').trim();
  }

  async function extract(file, range, signal, progress = () => {}) {
    return withPdf(file, signal, async pdf => {
      const pages = C.pageNumbers(range, pdf.numPages);
      const empty = [];
      const parts = [];
      let length = 0;
      for (const [index, number] of pages.entries()) {
        signal?.throwIfAborted();
        progress(index + 1, pages.length, number);
        const page = await W.abortable(pdf.getPage(number), signal);
        try {
          const layer = await W.abortable(page.getTextContent(), signal);
          const content = textLayer(layer.items);
          if (!content) { empty.push(number); continue; }
          length += content.length + 2;
          if (length > C.maxText + 2) throw new Error('large');
          parts.push(content);
        } finally {
          page.cleanup();
        }
      }
      return { text: parts.join('\n\n'), empty, count: pages.length };
    });
  }

  async function renderPage(page, signal) {
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(3, 2400 / Math.max(base.width, base.height)) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const task = page.render({ canvas, viewport, background: '#fff' });
    const cancel = () => task.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      await W.abortable(task.promise, signal);
      return canvas;
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  }

  async function recognize(file, range, selection, includeEnglish, signal, report) {
    validateSize(file);
    const api = await W.abortable(W.library('vendor/ocr/tesseract.min.js', 'Tesseract'), signal);
    const lang = languages[selection] || languages[W.code] || 'eng';
    let stage;
    let workerFailed;
    const failed = new Promise((_, reject) => { workerFailed = reject; });
    const requested = includeEnglish && lang !== 'eng' ? ['eng', lang] : [lang];
    const startup = api.createWorker(requested, 1, {
      workerPath: new URL('vendor/ocr/worker.min.js', W.root).href,
      corePath: new URL('vendor/ocr/core/', W.root).href,
      langPath: new URL('vendor/ocr/lang/', W.root).href,
      workerBlobURL: false,
      errorHandler: workerFailed,
      logger: entry => {
        if (!signal.aborted && stage && entry.status === 'recognizing text') {
          const progress = ((stage.index - 1) + entry.progress) / stage.total;
          report('msgPageProgress', { page: W.numeric.format(stage.page), current: W.numeric.format(stage.index), total: W.numeric.format(stage.total) }, progress);
        }
      }
    });
    let worker;
    let terminated = false;
    function stop() {
      if (!worker || terminated) return Promise.resolve();
      terminated = true;
      return worker.terminate().catch(() => {});
    }
    startup.then(result => { worker = result; if (signal.aborted) void stop(); }, () => {});
    signal.addEventListener('abort', stop, { once: true });
    try {
      await W.abortable(Promise.race([startup, failed]), signal);
      async function scan(image, index, total, page) {
        stage = { index, total, page };
        report('msgPageProgress', { page: W.numeric.format(page), current: W.numeric.format(index), total: W.numeric.format(total) }, (index - 1) / total);
        const result = await W.abortable(Promise.race([worker.recognize(image), failed]), signal);
        const text = result.data.text.trim();
        return lang === 'chi_sim' ? text.replace(/(\p{Script=Han}) (?=\p{Script=Han})/gu, '$1') : text;
      }
      if (!isPdf(file)) {
        if (!/\.(png|jpe?g|webp|bmp|tiff?)$/iu.test(file.name)) throw new Error('type');
        const text = await scan(file, 1, 1, 1);
        if (text.length > C.maxText) throw new Error('large');
        return { text, empty: [], count: 1 };
      }
      return await withPdf(file, signal, async pdf => {
        const pages = C.pageNumbers(range, pdf.numPages);
        const parts = [];
        let length = 0;
        for (const [index, number] of pages.entries()) {
          signal.throwIfAborted();
          const page = await W.abortable(pdf.getPage(number), signal);
          let canvas;
          try {
            canvas = await renderPage(page, signal);
            const text = await scan(canvas, index + 1, pages.length, number);
            if (text) {
              length += text.length + 2;
              if (length > C.maxText + 2) throw new Error('large');
              parts.push(text);
            }
          } finally {
            if (canvas) canvas.width = 1;
            page.cleanup();
          }
        }
        return { text: parts.join('\n\n'), empty: [], count: pages.length };
      });
    } finally {
      signal.removeEventListener('abort', stop);
      await stop();
    }
  }

  async function loadEditingPdf(api, file) {
    validateSize(file);
    if (!isPdf(file)) throw new Error('type');
    try { return await api.PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false }); }
    catch (error) {
      if (/encrypted/i.test(error.message)) throw new Error('password');
      throw error;
    }
  }

  async function editPages(entries, split, signal, report) {
    const api = await W.abortable(W.library('vendor/pdflib/pdf-lib.min.js', 'PDFLib'), signal);
    const combined = split ? null : await api.PDFDocument.create();
    const archive = Object.create(null);
    let count = 0;
    let outputBytes = 0;
    for (const [index, entry] of entries.entries()) {
      signal.throwIfAborted();
      report('msgFileProgress', { current: W.numeric.format(index + 1), total: W.numeric.format(entries.length) }, index / entries.length);
      const source = await W.abortable(loadEditingPdf(api, entry.file), signal);
      const selection = C.pageNumbers(entry.range, source.getPageCount());
      if (count + selection.length > 1000 || (split && count + selection.length > 250)) throw new Error('large');
      const indexes = selection.map(number => number - 1);
      const rotate = page => page.setRotation(api.degrees(((page.getRotation().angle + entry.turn) % 360 + 360) % 360));
      if (combined) {
        const copied = await combined.copyPages(source, indexes);
        for (const page of copied) {
          if (entry.turn) rotate(page);
          combined.addPage(page);
        }
        count += copied.length;
        await frame();
      } else {
        for (const pageNumber of indexes) {
          signal.throwIfAborted();
          const pageDoc = await api.PDFDocument.create();
          const [page] = await pageDoc.copyPages(source, [pageNumber]);
          if (entry.turn) rotate(page);
          pageDoc.addPage(page);
          const name = String(++count).padStart(3, '0') + '-' + C.safeBaseName(entry.file.name) + '-p' + (pageNumber + 1) + '.pdf';
          const bytes = await pageDoc.save();
          outputBytes += bytes.length;
          if (outputBytes > C.maxBatchBytes) throw new Error('large');
          archive[name] = bytes;
          await frame();
        }
      }
    }
    if (split) return { count, blob: await W.zip(archive, signal), name: 'forbecorp-pages.zip' };
    signal.throwIfAborted();
    const bytes = await combined.save();
    if (bytes.length > C.maxBatchBytes) throw new Error('large');
    return { count, blob: new Blob([bytes], { type: 'application/pdf' }), name: 'forbecorp-document.pdf' };
  }

  function textFromPdf(mode) {
    const panel = W.get('pdf-work');
    const input = W.get('pdf-source');
    const range = W.get('pdf-range');
    const sample = W.get('pdf-sample');
    const fileNote = W.get('pdf-file-note');
    const analyze = W.get('pdf-run');
    const result = W.get('pdf-output');
    const empty = W.get('pdf-empty-pages');
    const ocrLanguage = W.get('ocr-language');
    const english = W.get('ocr-english');
    let file;
    let pageCount = 0;
    const refresh = () => {
      analyze.disabled = !file;
      range.disabled = !file || !isPdf(file);
      W.get('pdf-page-options').hidden = Boolean(file && !isPdf(file));
      if (english) {
        const onlyEnglish = ocrLanguage.value === 'en';
        english.disabled = onlyEnglish;
        english.closest('label').hidden = onlyEnglish;
      }
      const selected = W.get('pdf-select-info');
      selected.textContent = '';
      range.removeAttribute('aria-invalid');
      if (pageCount) {
        try {
          const pages = C.pageNumbers(range.value, pageCount);
          W.statement(selected, 'msgPageSelection', { current: W.numeric.format(pages.length), total: W.numeric.format(pageCount) });
        } catch (_) {
          W.statement(selected, 'msgRangeError');
          range.setAttribute('aria-invalid', 'true');
          analyze.disabled = true;
        }
      }
    };
    const job = W.makeJob(panel, refresh);

    async function choose(picked, signal, report, note) {
      validateSize(picked);
      const pdfFile = isPdf(picked);
      if (mode === 'text' && !pdfFile) throw new Error('type');
      if (mode === 'ocr' && !/\.(pdf|png|jpe?g|webp|bmp|tiff?)$/iu.test(picked.name)) throw new Error('type');
      const total = pdfFile ? await withPdf(picked, signal, pdf => pdf.numPages) : 0;
      signal.throwIfAborted();
      file = picked;
      pageCount = total;
      empty.hidden = true;
      W.get('pdf-skipped-list').textContent = '';
      fileNote.textContent = file.name;
      range.value = '';
      W.setText(result, '');
      report(note, { file: file.name }, 1);
    }

    W.bindPicker(input.id, ([picked]) => job.run(({ signal, report }) => choose(picked, signal, report, 'msgFileLoaded')));
    range.addEventListener('input', refresh);
    ocrLanguage?.addEventListener('change', refresh);
    sample.addEventListener('click', () => job.run(async ({ signal, report }) => {
      const language = ocrLanguage?.value || 'en';
      const demo = mode === 'text'
        ? await example(signal)
        : await sampleFile(language === 'en' ? 'example.png' : 'ocr-' + language + '.png', signal);
      await choose(demo, signal, report, 'msgExampleReady');
    }));

    analyze.addEventListener('click', () => job.run(async ({ signal, report }) => {
      empty.hidden = true;
      W.get('pdf-skipped-list').textContent = '';
      const selectedRange = range.value;
      const detected = mode === 'text'
        ? await extract(file, selectedRange, signal, (index, total, page) => report('msgPageProgress',
          { page: W.numeric.format(page), current: W.numeric.format(index), total: W.numeric.format(total) }, (index - 1) / total))
        : await recognize(file, selectedRange, ocrLanguage.value, english.checked, signal, report);
      signal.throwIfAborted();
      if (mode === 'text' && detected.empty.length) {
        W.get('pdf-skipped-list').textContent = detected.empty.map(number => W.numeric.format(number)).join(', ');
        empty.hidden = false;
      }
      if (!detected.text.trim()) {
        throw new Error('empty');
      }
      W.setText(result, detected.text);
      report('msgTextReady', { total: W.numeric.format(detected.count) }, 1);
    }));
    refresh();
  }

  function pageEditor() {
    const panel = W.get('page-work');
    const list = W.get('pdf-list');
    const template = W.get('pdf-item');
    const run = W.get('pages-run');
    const status = W.get('pages-status');
    const download = W.get('pages-download');
    const split = W.get('pages-mode');
    const entries = [];
    let result;
    const refresh = () => { run.disabled = !entries.length; };
    const job = W.makeJob(panel, refresh);

    function invalidate() {
      result = undefined;
      download.disabled = true;
    }

    function draw() {
      invalidate();
      const children = entries.map((entry, index) => {
        const row = template.content.firstElementChild.cloneNode(true);
        row.querySelector('[data-name]').textContent = entry.file.name;
        const range = row.querySelector('[data-range]');
        const angle = row.querySelector('[data-angle]');
        range.value = entry.range;
        angle.value = String(entry.turn);
        range.addEventListener('input', () => { entry.range = range.value; invalidate(); });
        angle.addEventListener('change', () => { entry.turn = Number(angle.value); invalidate(); });
        const up = row.querySelector('[data-up]');
        const down = row.querySelector('[data-down]');
        const remove = row.querySelector('[data-remove]');
        up.disabled = index === 0;
        down.disabled = index === entries.length - 1;
        function shift(target, direction) {
          [entries[index], entries[target]] = [entries[target], entries[index]];
          draw();
          const moved = list.children[target];
          const focus = moved.querySelector('[data-' + direction + ']:not(:disabled)') || moved.querySelector('[data-remove]');
          focus.focus();
        }
        up.addEventListener('click', () => shift(index - 1, 'up'));
        down.addEventListener('click', () => shift(index + 1, 'down'));
        remove.addEventListener('click', () => {
          entries.splice(index, 1);
          draw();
          const next = list.children[Math.min(index, entries.length - 1)]?.querySelector('[data-remove]');
          (next || W.get('pages-source')).focus();
        });
        return row;
      });
      list.replaceChildren(...children);
      refresh();
    }

    W.bindPicker('pages-source', files => {
      if (files.some(file => !isPdf(file))) { W.showError(status, new Error('type')); return; }
      if (entries.length + files.length > 24 || [...entries.map(entry => entry.file), ...files]
        .reduce((total, file) => total + file.size, 0) > C.maxBatchBytes || files.some(file => file.size > C.maxDocumentBytes)) {
        W.showError(status, new Error('large'));
        return;
      }
      entries.push(...files.map(file => ({ file, range: '', turn: 0 })));
      draw();
      status.textContent = '';
    });

    W.get('pages-sample').addEventListener('click', () => job.run(async ({ signal }) => {
      if (entries.length >= 24) throw new Error('large');
      const file = await example(signal);
      entries.push({ file, range: '2,1', turn: 0 });
      draw();
      W.statement(status, 'msgExampleReady');
    }));

    run.addEventListener('click', () => job.run(async ({ signal, report }) => {
      const output = await editPages(entries, split.value === 'split', signal, report);
      signal.throwIfAborted();
      result = output;
      download.disabled = false;
      report('msgFileReady', { total: W.numeric.format(result.count) }, 1);
    }));
    split.addEventListener('change', invalidate);
    download.addEventListener('click', () => { if (result) W.download(result.blob, result.name); });
    draw();
  }

  window.ForbePdf = { extract, isPdf, editPages, example };
  switch (document.body.dataset.tool) {
    case 'pdf-to-text': textFromPdf('text'); break;
    case 'ocr': textFromPdf('ocr'); break;
    case 'pdf-pages': pageEditor(); break;
  }
})();
