
(() => {
  'use strict';

  const root = new URL('./', document.currentScript.src);
  const get = id => document.getElementById(id);
  const code = document.documentElement.lang;
  const numeric = new Intl.NumberFormat(code);
  const words = get('tool-strings')?.dataset || {};
  const libraries = new Map();
  const cleanupKey = 'forbecorp-cleanup-settings';
  const destinations = {
    'text-cleaner': 'clean-input', 'text-counter': 'text-input', 'ai-detector': 'detector-input',
    humanizer: 'rewrite-input', 'text-compare': 'compare-left', 'table-tools': 'table-input',
    'markdown-preview': 'markdown-input'
  };

  function msg(key, values = {}) {
    return (words[key] || words.msgFailed || '').replace(/\{(\w+)\}/gu, (raw, name) =>
      Object.hasOwn(values, name) ? String(values[name]) : raw);
  }

  function setText(field, value) {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function statement(status, key, values) {
    if (status) status.textContent = msg(key, values);
  }

  function showError(status, error) {
    const translation = {
      large: 'msgLarge', empty: 'msgNoText', type: 'msgFileType', range: 'msgRangeError',
      password: 'msgProtectedPdf', csv: 'msgCsvError', dimensions: 'msgDimensions',
      format: 'msgImageFormat', serve: 'msgServe', complex: 'msgCompareLimit',
    };
    statement(status, translation[error?.message] || 'msgFailed');
  }

  function fetchLocal(path, options) {
    if (location.protocol === 'file:') throw new Error('serve');
    return fetch(new URL(path, root), options);
  }

  function library(path, name) {
    if (!libraries.has(path)) {
      const loading = new Promise((resolve, reject) => {
        if (location.protocol === 'file:') { reject(new Error('serve')); return; }
        const script = document.createElement('script');
        script.src = new URL(path, root).href;
        script.onload = () => window[name] ? resolve(window[name]) : reject(new Error('library'));
        script.onerror = () => { script.remove(); reject(new Error('library')); };
        document.head.append(script);
      }).catch(error => { libraries.delete(path); throw error; });
      libraries.set(path, loading);
    }
    return libraries.get(path);
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function transfer(tool, text, status, before) {
    if (!destinations[tool]) return;
    const fields = tool === 'text-compare' && before !== undefined
      ? { 'compare-left': before, 'compare-right': text }
      : { [destinations[tool]]: text };
    if (tool === 'humanizer') fields['rewrite-language'] = get('analysis-language')?.value || code;
    try {
      sessionStorage.setItem('forbecorp-tool-draft', JSON.stringify({ tool, locale: code, fields, transferred: true }));
      const pageFile = location.protocol === 'file:' ? 'index.html' : '';
      location.assign('../' + tool + '/' + pageFile);
    } catch (_) {
      statement(status, 'msgTransferError');
    }
  }

  function watchValue(field, update) {
    field.addEventListener('input', update);
    field.addEventListener('change', update);
    update();
  }

  function savedCleanup() {
    try {
      const saved = JSON.parse(localStorage.getItem(cleanupKey));
      if (!saved) return null;
      const { wrap, spaces, blank, duplicates, tabs, invisible, caseMode, sort } = saved;
      return { wrap: wrap === true && !sort, spaces: spaces === true, blank: blank === true,
        duplicates: duplicates === true, tabs: tabs === true, invisible: invisible === true,
        caseMode: ['upper', 'lower', 'title'].includes(caseMode) ? caseMode : '',
        sort: ['asc', 'desc'].includes(sort) ? sort : '', language: new Intl.Locale(saved.language || code).baseName };
    } catch (_) {
      return null;
    }
  }

  function storeCleanup(settings) {
    if (settings) localStorage.setItem(cleanupKey, JSON.stringify(settings));
    else localStorage.removeItem(cleanupKey);
  }

  function bindPicker(id, choose) {
    const input = get(id);
    if (!input) return;
    input.addEventListener('change', () => {
      const picked = [...input.files];
      input.value = '';
      if (picked.length) choose(input.multiple ? picked : picked.slice(0, 1));
    });
    const area = input.closest('[data-drop]');
    if (!area) return;
    area.addEventListener('dragover', event => {
      if (input.disabled || !Array.from(event.dataTransfer.types).includes('Files')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      area.classList.add('is-dragging');
    });
    area.addEventListener('dragleave', event => {
      if (!area.contains(event.relatedTarget)) area.classList.remove('is-dragging');
    });
    area.addEventListener('drop', event => {
      if (!event.dataTransfer.files.length) return;
      event.preventDefault();
      area.classList.remove('is-dragging');
      if (input.disabled) return;
      const files = Array.from(event.dataTransfer.files);
      choose(input.multiple ? files : files.slice(0, 1));
    });
  }

  function abortable(promise, signal) {
    if (!signal) return promise;
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  function makeJob(group, refresh = () => {}) {
    const status = group.querySelector('[data-tool-status]');
    const start = group.querySelector('[data-run], [data-drop] input');
    const cancel = group.querySelector('[data-cancel]');
    const meter = group.querySelector('[data-progress]');
    let controller = null;
    let locks = [];
    cancel?.addEventListener('click', () => controller?.abort());

    function report(key, values, progress) {
      statement(status, key, values);
      if (!meter) return;
      if (progress === undefined) meter.removeAttribute('value');
      else meter.value = Math.max(0, Math.min(1, progress));
    }

    async function run(operation) {
      if (controller) return;
      controller = new AbortController();
      const { signal } = controller;
      locks = [...group.querySelectorAll('[data-job-lock], [data-run]')].filter(control => !control.disabled);
      locks.forEach(control => { control.disabled = true; });
      if (cancel) { cancel.disabled = false; cancel.hidden = false; }
      if (meter) meter.hidden = false;
      report('msgWorking');
      try {
        await operation({ signal, report });
      } catch (error) {
        if (signal.aborted) report('msgCancelled');
        else showError(status, error);
      } finally {
        if (meter) meter.hidden = true;
        const wasFocused = document.activeElement === cancel;
        if (cancel) { cancel.hidden = true; cancel.disabled = true; }
        locks.forEach(control => { control.disabled = false; });
        locks = [];
        controller = null;
        refresh();
        if (wasFocused) (group.querySelector('[data-run]:not(:disabled)') || start)?.focus();
      }
    }

    return { run, get busy() { return controller !== null; } };
  }

  async function textFromFile(file, encoding = 'auto') {
    if (file.size > 10_000_000) throw new Error('large');
    if (!/\.(?:txt|csv|tsv|md|markdown)$/i.test(file.name)) throw new Error('type');
    const buffer = await file.arrayBuffer();
    const [first, second] = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 2));
    const auto = first === 255 && second === 254 ? 'utf-16le'
      : first === 254 && second === 255 ? 'utf-16be' : 'utf-8';
    const result = new TextDecoder(encoding === 'auto' ? auto : encoding, { fatal: true }).decode(buffer);
    if (result.length > ForbeCore.maxText) throw new Error('large');
    return result;
  }

  async function zip(entries, signal) {
    const writer = await library('vendor/fflate/index.js', 'fflate');
    signal?.throwIfAborted();
    let terminate;
    const writing = new Promise((resolve, reject) => {
      terminate = writer.zip(entries, { level: 3 }, (error, data) => error ? reject(error) : resolve(data));
    });
    const abort = () => terminate();
    signal?.addEventListener('abort', abort, { once: true });
    try { return new Blob([await abortable(writing, signal)], { type: 'application/zip' }); }
    finally { signal?.removeEventListener('abort', abort); }
  }

  function attachActions() {
    const originalStatus = document.querySelector('[data-tool-status], .workspace .feedback[role="status"]');
    for (const button of document.querySelectorAll('[data-result], [data-copy]')) {
      const value = get(button.dataset.result || button.dataset.copy);
      if (!value) continue;
      const status = get(button.dataset.status) || originalStatus;
      // Style analysis also locks sending during document import.
      if (value.id !== 'detector-input') {
        watchValue(value, () => { button.disabled = !value.value.trim(); });
      }
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const text = value.value;
        if (button.dataset.copy) {
          try {
            await navigator.clipboard.writeText(text);
            statement(status, 'msgCopied');
          } catch (_) {
            value.focus();
            value.select();
            statement(status, 'msgCopyError');
          }
        } else if (button.dataset.download) {
          const extension = button.dataset.download;
          const type = extension === 'csv' ? 'text/csv' : extension === 'md' ? 'text/markdown' : 'text/plain';
          const payload = extension === 'csv' ? '\ufeff' + text : text;
          const blob = extension === 'docx' ? window.forbecorpMakeDocx(text)
            : new Blob([payload], { type: type + ';charset=utf-8' });
          download(blob, (button.dataset.filename || 'forbecorp-text') + '.' + extension);
        } else if (button.dataset.send) {
          transfer(button.dataset.send, text, status, get(button.dataset.compareWith)?.value);
        }
      });
    }

    for (const button of document.querySelectorAll('[data-example]')) {
      button.addEventListener('click', () => {
        const source = get(button.dataset.example);
        if (!source || source.value.trim()) {
          statement(originalStatus, 'msgClearForExample');
          return;
        }
        setText(source, button.dataset.sample.replaceAll('\\n', '\n'));
        source.focus();
      });
    }
  }

  window.ForbeWork = { get, root, code, numeric, msg, statement, showError, setText, fetchLocal, library,
    download, transfer, watchValue, savedCleanup, storeCleanup, bindPicker, abortable, makeJob, textFromFile, zip };
  attachActions();
})();
