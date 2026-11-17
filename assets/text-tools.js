(() => {
  'use strict';

  const rules = {
    en: [
      ['in order to', 'to'], ['due to the fact that', 'because'],
      ['at this point in time', 'now'], ['on a daily basis', 'daily'],
      ['in the event that', 'if'], ['take into consideration', 'consider'],
      ['for the purpose of', 'for'], ['with the exception of', 'except for']
    ],
    es: [
      ['con el fin de', 'para'], ['en el caso de que', 'si'],
      ['en el momento actual', 'ahora'], ['de manera gradual', 'poco a poco'],
      ['con la excepción de', 'excepto'], ['llevar a cabo una revisión', 'revisar']
    ],
    fr: [
      ['dans le but de', 'pour'], ['en ce qui concerne', 'concernant'],
      ['à l’heure actuelle', 'actuellement'], ['en cas de besoin', 'si nécessaire'],
      ['sur une base quotidienne', 'chaque jour'], ['prendre en considération', 'prendre en compte']
    ],
    de: [
      ['zu diesem Zeitpunkt', 'jetzt'], ['auf täglicher Basis', 'täglich'],
      ['für den Fall, dass', 'falls'], ['in Bezug auf', 'bezüglich'],
      ['aus dem Grund, dass', 'weil'], ['mit Ausnahme von', 'außer']
    ],
    pt: [
      ['com o objetivo de', 'para'], ['a fim de', 'para'],
      ['na hipótese de que', 'caso'], ['no momento atual', 'agora'],
      ['em caráter diário', 'diariamente'], ['levar em consideração', 'considerar']
    ],
    ru: [
      ['на данный момент', 'сейчас'], ['в связи с тем, что', 'потому что'],
      ['по причине того, что', 'потому что'], ['с целью того, чтобы', 'чтобы'],
      ['на ежедневной основе', 'каждый день'], ['по завершении', 'после'],
      ['принимать во внимание', 'учитывать'], ['на постоянной основе', 'регулярно']
    ],
    uk: [
      ['на даний момент', 'зараз'], ['у зв’язку з тим, що', 'оскільки'],
      ['з тієї причини, що', 'бо'], ['з метою того, щоб', 'щоб'],
      ['на щоденній основі', 'щодня'], ['брати до уваги', 'враховувати'],
      ['на постійній основі', 'регулярно']
    ],
    'zh-CN': [
      ['在当前这个阶段', '目前'], ['在这种情况下', '这时'],
      ['有鉴于此', '因此'], ['换句话来说', '换句话说'],
      ['进行详细说明', '详细说明'], ['有必要对', '需要对']
    ],
    ar: [
      ['في الوقت الراهن', 'الآن'], ['من أجل أن', 'لكي'],
      ['في حال أن', 'إذا'], ['على نحو يومي', 'يوميًا'],
      ['على نحو تدريجي', 'تدريجيًا'], ['في الوقت الحالي', 'الآن']
    ],
    hi: [
      ['वर्तमान समय में', 'अभी'], ['प्रत्येक दिन', 'हर दिन'],
      ['इस तथ्य के कारण कि', 'क्योंकि'], ['इसके अतिरिक्त', 'इसके अलावा'],
      ['उस परिस्थिति में', 'उस स्थिति में'], ['क्रमिक रूप से', 'धीरे-धीरे']
    ],
    ja: [
      ['現時点において', '今の時点で'], ['そのような場合には', 'その場合は'],
      ['以下のとおりです', '次のとおりです'], ['考慮に入れる', '考慮する'],
      ['言い換えることができます', '言い換えられます'], ['実施することが可能です', '実施できます']
    ],
    ko: [
      ['현 시점에서', '지금'], ['이와 같은 경우에는', '이런 경우에는'],
      ['그와 같은 이유로', '그런 이유로'], ['하루도 빠짐없이', '하루도 빼놓지 않고'],
      ['단계적으로', '한 단계씩'], ['검토를 실시하다', '검토하다']
    ],
    it: [
      ['al fine di', 'per'], ['nel caso in cui', 'se'],
      ['con cadenza giornaliera', 'ogni giorno'], ['nel momento in cui', 'quando'],
      ['a causa del fatto che', 'perché'], ['ad eccezione di', 'tranne'],
      ['in un secondo momento', 'più tardi'], ['tenere in considerazione', 'considerare']
    ],
    id: [
      ['pada saat ini', 'saat ini'], ['dengan tujuan untuk', 'untuk'],
      ['oleh karena fakta bahwa', 'karena'], ['secara rutin setiap hari', 'setiap hari'],
      ['secara bertahap', 'sedikit demi sedikit'], ['melakukan peninjauan terhadap', 'meninjau']
    ],
    tr: [
      ['şu an itibarıyla', 'şu anda'], ['bu sebepten dolayı', 'bu nedenle'],
      ['günlük bazda', 'her gün'], ['kademeli bir şekilde', 'aşamalı olarak'],
      ['bahsi geçen', 'adı geçen'], ['göz önünde bulundurmak', 'dikkate almak']
    ],
    bn: [
      ['বর্তমান সময়ে', 'এখন'], ['প্রতিটি দিন', 'প্রতিদিন'],
      ['এই কারণে যে', 'কারণ'], ['ক্রমশই', 'ধীরে ধীরে'],
      ['অন্য কথায় বলতে গেলে', 'অন্য কথায়'], ['তা সত্ত্বেও', 'তবু']
    ]
  };


  const phrases = {
    en: ['it is worth noting', 'in today’s fast-paced world', 'it is important to note', 'in conclusion'],
    es: ['cabe destacar', 'es importante señalar', 'en el mundo actual', 'en conclusión'],
    fr: ['il convient de noter', 'il est important de souligner', 'dans le monde actuel', 'en conclusion'],
    de: ['es ist wichtig zu betonen', 'es sei darauf hingewiesen', 'in der heutigen Welt', 'abschließend lässt sich sagen'],
    pt: ['vale a pena destacar', 'é importante notar', 'no mundo de hoje', 'em conclusão'],
    ru: ['следует отметить', 'важно подчеркнуть', 'стоит отметить', 'в современном мире', 'подводя итог'],
    uk: ['слід зазначити', 'важливо підкреслити', 'варто зазначити', 'у сучасному світі', 'підбиваючи підсумки'],
    'zh-CN': ['值得注意的是', '需要强调的是', '在当今社会', '综上所述'],
    ar: ['تجدر الإشارة إلى أن', 'من المهم أن نلاحظ', 'في عالم اليوم', 'في الختام'],
    hi: ['यह ध्यान देने योग्य है', 'यह उल्लेख करना महत्वपूर्ण है', 'आज की दुनिया में', 'निष्कर्ष के तौर पर'],
    ja: ['注目すべき点は', '重要なのは', '今日の社会では', '以上を踏まえると'],
    ko: ['주목할 점은', '중요한 것은', '오늘날의 사회에서', '결론적으로'],
    it: ['è importante notare', 'vale la pena notare', 'in conclusione', 'nel mondo di oggi'],
    id: ['perlu dicatat bahwa', 'penting untuk dicatat', 'di dunia saat ini', 'sebagai kesimpulan'],
    tr: ['belirtmek gerekir ki', 'vurgulamak önemlidir', 'günümüz dünyasında', 'sonuç olarak'],
    bn: ['উল্লেখ করা প্রয়োজন যে', 'এটা লক্ষণীয় যে', 'আজকের বিশ্বে', 'সবশেষে বলা যায়']
  };

  function phrasePattern(phrase, language) {
    const pattern = phrase.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')
      .replace(/['’]/g, "['’]").replaceAll(' ', '[ \\t]+');
    if (language === 'zh-CN' || language === 'ja') return new RegExp(pattern, 'gu');
    return new RegExp('(?<![\\p{L}\\p{M}\\p{N}])' + pattern + '(?![\\p{L}\\p{M}\\p{N}])', 'giu');
  }

  const byId = id => document.getElementById(id);
  const locale = document.documentElement.lang;
  const number = new Intl.NumberFormat(locale);

  const W = window.ForbeWork;
  const C = window.ForbeCore;
  const { segment: segmenter, wordParts } = C;

  function highlight(target, text, ranges) {
    const events = ranges.flatMap(({ start, end, kind }) => [
      { offset: start, kind, step: 1 }, { offset: end, kind, step: -1 }
    ]).sort((a, b) => a.offset - b.offset);
    const content = document.createDocumentFragment();
    const active = new Map();
    let cursor = 0;
    for (const { offset, kind, step } of events) {
      if (offset > cursor) {
        const piece = text.slice(cursor, offset);
        if (active.size) {
          const mark = document.createElement('mark');
          mark.classList.add(...active.keys());
          mark.textContent = piece;
          content.append(mark);
        } else {
          content.append(piece);
        }
        cursor = offset;
      }
      const count = (active.get(kind) || 0) + step;
      if (count) active.set(kind, count);
      else active.delete(kind);
    }
    content.append(text.slice(cursor));
    target.replaceChildren(content);
  }

  function attachDetector() {
    const source = byId('detector-input');
    const languageInput = byId('analysis-language');
    const fileInput = byId('detector-file');
    const analyze = byId('analyze-text');
    const send = [...document.querySelectorAll('[data-result="detector-input"]')];
    const clear = byId('clear-detector');
    const summary = byId('analysis-summary');
    const signals = byId('analysis-signals');
    const preview = byId('analysis-preview');
    const fileFeedback = byId('detector-feedback');
    const messages = byId('detector-messages').dataset;
    let busy = false;
    let loadId = 0;

    function refresh() {
      const hasText = Boolean(source.value.trim());
      analyze.disabled = busy || !hasText;
      send.forEach(button => { button.disabled = analyze.disabled; });
      clear.disabled = !busy && !source.value && !fileFeedback.textContent;
    }

    function reset() {
      signals.hidden = preview.hidden = true;
      byId('analysis-highlight').replaceChildren();
      summary.textContent = source.value.trim() ? '' : messages.missing;
      refresh();
    }

    function sourceChanged() {
      loadId++;
      busy = false;
      fileInput.value = fileFeedback.textContent = '';
      reset();
    }

    source.addEventListener('input', sourceChanged);
    languageInput.addEventListener('change', reset);
    clear.addEventListener('click', () => {
      source.value = '';
      sourceChanged();
      source.focus();
    });
    W.bindPicker(fileInput.id, async ([file]) => {
      if (!file) return;
      const current = ++loadId;
      busy = true;
      fileFeedback.textContent = messages.loading;
      refresh();
      try {
        const text = await window.forbecorpReadDocument(file);
        if (current !== loadId) return;
        source.value = text;
        reset();
        fileFeedback.textContent = messages.loaded.replace('{file}', () => file.name);
      } catch (error) {
        if (current === loadId) {
          const known = ['empty', 'large', 'type'].includes(error.message);
          fileFeedback.textContent = known ? messages[error.message] : messages.error;
        }
      } finally {
        if (current === loadId) {
          busy = false;
          fileInput.value = '';
          refresh();
        }
      }
    });

    analyze.addEventListener('click', () => {
      if (!source.value.trim() || busy) return;
      const text = source.value;
      const language = languageInput.value || locale;
      const words = segmenter(language, 'word');
      const sentences = segmenter(language, 'sentence');
      const parts = sentences ? sentences.segment(text)
        : Array.from(text.matchAll(/[^.!?。！？।]+[.!?。！？।]*/gu), match => ({ segment: match[0], index: match.index }));
      let wordCount = 0;
      let sentenceCount = 0;
      let shortest = Infinity;
      let longest = 0;
      const openings = new Map();
      const long = [];
      const doubled = [];
      for (const part of parts) {
        const tokens = wordParts(part.segment, words);
        if (!tokens.length) continue;
        wordCount += tokens.length;
        sentenceCount++;
        shortest = Math.min(shortest, tokens.length);
        longest = Math.max(longest, tokens.length);
        if (tokens.length > 30) long.push({ start: part.index + tokens[0].index, end: part.index + part.segment.trimEnd().length, kind: 'signal-long' });
        doubled.push(...adjacentRepeats(part.segment, language, tokens).map(match => ({
          start: part.index + match.start, end: part.index + match.end, kind: 'signal-extra'
        })));
        if (tokens.length < 2) continue;
        const [first, second] = tokens;
        const key = [first.segment, second.segment].join(' ').normalize().toLocaleLowerCase(language);
        if (!openings.has(key)) openings.set(key, []);
        openings.get(key).push({ start: part.index + first.index, end: part.index + second.index + second.segment.length, kind: 'signal-repeat' });
      }
      const repeated = Array.from(openings.values()).filter(group => group.length > 1).flat();
      const stock = phrases[language].flatMap(phrase => Array.from(text.matchAll(phrasePattern(phrase, language)), match => ({
        start: match.index, end: match.index + match[0].length, kind: 'signal-phrase'
      })));
      byId('analysis-words').textContent = number.format(wordCount);
      byId('analysis-sentences').textContent = number.format(sentenceCount);
      byId('analysis-spread').textContent = sentenceCount ? number.format(shortest) + '–' + number.format(longest) : '—';
      byId('analysis-repeats').textContent = number.format(repeated.length);
      byId('analysis-phrases').textContent = number.format(stock.length);
      const mixed = wordParts(text, words).filter(token => /\p{Script=Latin}/u.test(token.segment) && /\p{Script=Cyrillic}/u.test(token.segment))
        .map(token => ({ start: token.index, end: token.index + token.segment.length, kind: 'signal-extra' }));
      const formats = formatSignals(text);
      byId('analysis-long').textContent = number.format(long.length);
      byId('analysis-duplicate-words').textContent = number.format(doubled.length);
      byId('analysis-mixed').textContent = number.format(mixed.length);
      byId('analysis-format').textContent = number.format(formats.length);
      highlight(byId('analysis-highlight'), text, repeated.concat(stock, long, doubled, mixed, formats));
      signals.hidden = preview.hidden = false;
      summary.textContent = wordCount < 100 || sentenceCount < 5 ? messages.short : messages.ready;
    });
    reset();
  }

  function preserveCase(original, replacement, language) {
    if (original === original.toLocaleUpperCase(language)) return replacement.toLocaleUpperCase(language);
    const initial = original[0];
    return initial === initial.toLocaleUpperCase(language)
      ? replacement[0].toLocaleUpperCase(language) + replacement.slice(1)
      : replacement;
  }

  function adjacentRepeats(text, language, tokens = wordParts(text, segmenter(language, 'word'))) {
    const matches = [];
    for (let index = 1; index < tokens.length; index++) {
      const first = tokens[index - 1];
      const next = tokens[index];
      const end = first.index + first.segment.length;
      const gap = text.slice(end, next.index);
      if (!gap || !/^[\t \u00a0]+$/u.test(gap) || !/\p{L}/u.test(next.segment)) continue;
      if (first.segment.normalize().toLocaleLowerCase(language) === next.segment.normalize().toLocaleLowerCase(language)) {
        matches.push({ start: end, end: next.index + next.segment.length });
      }
    }
    return matches;
  }

  function formatSignals(text) {
    const dates = Array.from(text.matchAll(/\b(?:[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}|[0-9]{1,2}([./-])[0-9]{1,2}\1[0-9]{2,4})\b/gu));
    const formats = new Set(dates.map(date => date[1] || 'iso'));
    const deviations = formats.size > 1 ? dates : [];
    const numbers = Array.from(text.matchAll(/(?<![\d.,])\d{1,12}([.,])\d{1,2}(?![\d.,/])/gu));
    if (new Set(numbers.map(number => number[1])).size > 1) deviations.push(...numbers);
    return deviations.map(match => ({ start: match.index, end: match.index + match[0].length, kind: 'signal-extra' }));
  }

  function protectedRanges(text, automatic, custom) {
    const patterns = automatic ? [
      /(?:https?:\/\/|www\.)[^\s<>()]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu,
      /(?:[$€£¥₹] ?[\p{Nd}][\p{Nd}.,:/\- ]*|[\p{Nd}]+(?:[./,:–-][\p{Nd}]+)+|[\p{Nd}][\p{Nd},. ]* ?(?:CHF|EUR|USD|RUB|%))(?![\p{L}\p{Nd}])/gu,
      /(?<!\p{L})\p{Lu}[\p{Ll}\p{M}]+(?:[ \t]+\p{Lu}[\p{Ll}\p{M}]+){1,3}(?!\p{L})/gu
    ] : [];
    const terms = [...new Set(custom.split(/\r?\n/u).map(value => value.trim()).filter(Boolean))].slice(0, 60);
    if (terms.length) patterns.push(new RegExp(terms.sort((a, b) => b.length - a.length)
      .map(term => term.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')).join('|'), 'giu'));
    const ranges = patterns.flatMap(pattern => Array.from(text.matchAll(pattern), match => ({ start: match.index, end: match.index + match[0].length })));
    const merged = [];
    for (const range of ranges.sort((a, b) => a.start - b.start)) {
      if (merged.at(-1)?.end >= range.start) merged.at(-1).end = Math.max(merged.at(-1).end, range.end);
      else merged.push(range);
    }
    return merged;
  }

  function proposals(text, language, mode, automatic, custom) {
    let edits;
    if (mode === 'repeat') {
      edits = adjacentRepeats(text, language).map(match => ({ ...match, replacement: '' }));
    } else if (mode === 'typography') {
      const replacements = [
        [/(?<=[^\r\n \t])[ \u00a0]{2,}(?=[^\r\n \t,.!?;:。！？、])/gu, () => ' '],
        [/[ \t]+(?=\r?$)/gmu, () => ''],
        [/(?<!\.)\.\.\.(?!\.)/gu, () => '…'],
        [/(?<=\s)--(?=\s)/gu, () => '—'],
        [/[ \t]+(?=[,.!?;:。！？、])(?<!^ +)/gmu, () => ''],
      ];
      if (language === 'fr') {
        replacements.pop();
        replacements.push([/[ \t]+(?=[,.])/gu, () => ''], [/(?<=[\p{L}\p{N}])[ \t\u00a0\u202f]*(?=[!?;:])/gu, () => '\u202f']);
      }
      edits = replacements.flatMap(([pattern, replacement]) => Array.from(text.matchAll(pattern), match => ({
        start: match.index, end: match.index + match[0].length, replacement: replacement(match)
      })));
    } else {
      edits = rules[language].flatMap(([phrase, replacement]) => Array.from(
        text.matchAll(phrasePattern(phrase, language)), match => ({
          start: match.index, end: match.index + match[0].length,
          replacement: preserveCase(match[0], replacement, language)
        })
      ));
    }
    const preserved = protectedRanges(text, automatic, custom);
    let preservedIndex = 0;
    let previousEnd = 0;
    const accepted = [];
    for (const edit of edits.sort((a, b) => a.start - b.start || b.end - a.end)) {
      const original = text.slice(edit.start, edit.end);
      if (edit.start < previousEnd || original === edit.replacement) continue;
      while (preserved[preservedIndex]?.end <= edit.start) preservedIndex++;
      if (preserved[preservedIndex] && preserved[preservedIndex].start < edit.end &&
          (edit.start !== edit.end || preserved[preservedIndex].start < edit.start)) continue;
      previousEnd = edit.end;
      accepted.push({ ...edit, original, active: true });
    }
    return accepted;
  }

  function attachRewrite() {
    const source = byId('rewrite-input');
    const output = byId('rewrite-output');
    const languageInput = byId('rewrite-language');
    const mode = byId('rewrite-mode');
    const preserve = byId('rewrite-protect-auto');
    const custom = byId('rewrite-protected');
    const run = byId('rewrite-text');
    const panel = byId('rewrite-comparison');
    const list = byId('rewrite-changes');
    const feedback = byId('rewrite-feedback');
    const messages = byId('rewrite-messages').dataset;
    let original = '';
    let changes = [];

    function reset() {
      changes = [];
      panel.hidden = true;
      list.replaceChildren();
      byId('comparison-before').replaceChildren();
      byId('comparison-after').replaceChildren();
      feedback.textContent = '';
      run.disabled = !source.value.trim();
    }

    function renderChanges() {
      const before = [];
      const after = [];
      const pieces = [];
      const rows = document.createDocumentFragment();
      let cursor = 0;
      let resultLength = 0;
      changes.forEach((change, index) => {
        if (!change.active) return;
        const { start, end, original: oldText, replacement } = change;
        const unchanged = original.slice(cursor, start);
        pieces.push(unchanged, replacement);
        resultLength += unchanged.length;
        before.push({ start, end, kind: 'change-before' });
        if (replacement.length) after.push({ start: resultLength, end: resultLength + replacement.length, kind: 'change-after' });
        resultLength += replacement.length;
        cursor = end;

        const row = document.createElement('li');
        const old = document.createElement('del');
        const next = document.createElement('ins');
        const undo = document.createElement('button');
        old.textContent = oldText;
        next.textContent = replacement || W.msg('msgRemoved');
        old.dir = next.dir = 'auto';
        undo.type = 'button';
        undo.className = 'btn btn-secondary';
        undo.dataset.undoIndex = index;
        undo.textContent = messages.undo;
        undo.setAttribute('aria-label', messages.undo + ' — ' + oldText + ' / ' + replacement);
        row.append(old, next, undo);
        rows.append(row);
      });
      pieces.push(original.slice(cursor));
      output.value = pieces.join('');
      output.dispatchEvent(new Event('change', { bubbles: true }));
      panel.hidden = !before.length;
      list.replaceChildren(rows);
      highlight(byId('comparison-before'), panel.hidden ? '' : original, before);
      highlight(byId('comparison-after'), panel.hidden ? '' : output.value, after);
    }

    source.addEventListener('input', reset);
    output.addEventListener('input', reset);
    languageInput.addEventListener('change', reset);
    mode.addEventListener('change', reset);
    preserve.addEventListener('change', reset);
    custom.addEventListener('input', reset);
    byId('rewrite-accept-all').addEventListener('click', () => {
      reset();
      W.statement(feedback, 'msgApplied');
      output.focus();
    });
    byId('rewrite-undo-all').addEventListener('click', () => {
      W.setText(output, original);
      W.statement(feedback, 'msgUndoAll');
      run.focus();
    });
    run.addEventListener('click', () => {
      if (!source.value.trim()) return;
      original = source.value;
      changes = proposals(original, languageInput.value || locale, mode.value, preserve.checked, custom.value);
      renderChanges();
      feedback.textContent = changes.length ? messages.ready : messages.same;
    });
    list.addEventListener('click', event => {
      const undo = event.target.closest('button[data-undo-index]');
      if (!undo) return;
      const index = Number(undo.dataset.undoIndex);
      changes[index].active = false;
      renderChanges();
      feedback.textContent = messages.undone;
      const remaining = [...list.querySelectorAll('button')];
      const focus = remaining.find(button => Number(button.dataset.undoIndex) > index) || remaining.at(-1) || run;
      focus.focus();
    });
    reset();
    if (document.body.dataset.transferred) feedback.textContent = messages.input;
  }

  function attachCleaner() {
    const input = byId('clean-input');
    const output = byId('clean-output');
    const run = byId('clean-text');
    const status = byId('clean-feedback');
    const sort = byId('clean-sort');
    const wrap = byId('clean-wrap');
    const get = id => byId('clean-' + id);
    const toggleIds = ['wrap', 'spaces', 'blank', 'duplicates', 'tabs', 'invisible'];
    const localePicker = get('language');
    const originalSettings = { ...C.defaultCleanup, language: W.code };
    const refreshSort = () => { wrap.disabled = Boolean(sort.value); };

    function settings() {
      return {
        ...Object.fromEntries(toggleIds.map(id => [id, !get(id).disabled && get(id).checked])),
        caseMode: get('case-mode').value, sort: sort.value, language: localePicker.value || W.code
      };
    }

    function setSettings(selected) {
      for (const id of toggleIds) get(id).checked = Boolean(selected[id]);
      sort.value = selected.sort || '';
      get('case-mode').value = selected.caseMode || '';
      localePicker.value = [...localePicker.options].some(option => option.value === selected.language) ? selected.language : W.code;
      refreshSort();
    }
    if (!document.body.dataset.restoredDraft) setSettings(W.savedCleanup() || originalSettings);
    get('save-settings').addEventListener('click', () => {
      try { W.storeCleanup(settings()); W.statement(status, 'msgSettingsSaved'); }
      catch (_) { W.statement(status, 'msgStorageUnavailable'); }
    });
    get('reset-settings').addEventListener('click', () => {
      setSettings(originalSettings);
      try { W.storeCleanup(null); W.statement(status, 'msgSettingsReset'); }
      catch (_) { W.statement(status, 'msgStorageUnavailable'); }
    });
    const refresh = () => { run.disabled = job.busy || !input.value.trim(); };
    const job = W.makeJob(byId('text-cleaner'), refresh);
    W.watchValue(input, refresh);
    sort.addEventListener('change', refreshSort);
    refreshSort();
    W.bindPicker('clean-source', ([file]) => job.run(async ({ signal, report }) => {
      const opened = await W.abortable(window.forbecorpReadDocument(file), signal);
      W.setText(input, opened);
      report('msgFileLoaded', { file: file.name });
    }));
    run.addEventListener('click', () => {
      let count = 0;
      let text = input.value;
      const query = get('find').value;
      if (query) {
        const flags = get('case-sensitive').checked ? 'gu' : 'giu';
        const pattern = new RegExp(query.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&'), flags);
        const replacement = get('replace').value;
        const max = C.maxText;
        const size = text.length + Array.from(text.matchAll(pattern)).reduce((sum, match) => sum + replacement.length - match[0].length, 0);
        if (size > max) { W.showError(status, new Error('large')); return; }
        text = text.replace(pattern, match => {
          if (match !== replacement) count++;
          return replacement;
        });
      }
      const cleaned = C.cleanText(text, settings());
      if (cleaned.text.length > C.maxText) { W.showError(status, new Error('large')); return; }
      W.setText(output, cleaned.text);
      W.statement(status, cleaned.text === input.value ? 'msgNoChanges' : 'msgCleanReady',
        { total: number.format(cleaned.changes + count) });
    });
    refresh();
  }

  function attachCounter() {
    const input = byId('text-input');
    const clear = byId('clear-text');
    const limit = byId('counter-limit');
    const reading = byId('counter-reading');
    const speaking = byId('counter-speaking');
    const textLanguage = byId('counter-language');
    const meter = byId('counter-progress');
    const budget = byId('counter-budget');
    const common = byId('counter-common-list');
    const empty = byId('counter-empty');
    const duration = new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute',
      unitDisplay: 'short', maximumFractionDigits: 1 });
    let pending = 0;
    function refresh() {
      const text = input.value;
      const actual = textLanguage.value || locale;
      const words = segmenter(actual, 'word');
      const sentences = segmenter(actual, 'sentence');
      const graphemes = segmenter(actual, 'grapheme');
      const parts = wordParts(text, words);
      const count = C.graphemeCount(text, graphemes);
      const wordsInSentence = word => /\p{L}|\p{N}/u.test(word);
      const sentenceCount = (sentences ? Array.from(sentences.segment(text), part => part.segment)
        : (text.match(/[^.!?。！？।]+/gu) || [])).filter(wordsInSentence).length;
      const paragraphs = text.trim() ? text.trim().split(/(?:\r?\n)[^\S\r\n]*(?:\r?\n)+|[\f\u2029]/gu).filter(value => value.trim()).length : 0;
      byId('characters').textContent = number.format(count);
      byId('words').textContent = number.format(parts.length);
      byId('nonspace').textContent = number.format(C.graphemeCount(text.replace(/\s/gu, ''), graphemes));
      byId('sentences').textContent = number.format(sentenceCount);
      byId('paragraphs').textContent = number.format(paragraphs);
      byId('reading-time').textContent = duration.format(parts.length / (Number(reading.value) >= 1 ? Number(reading.value) : 220));
      byId('speaking-time').textContent = duration.format(parts.length / (Number(speaking.value) >= 1 ? Number(speaking.value) : 130));
      const maximum = Number(limit.value);
      meter.hidden = budget.hidden = maximum <= 0;
      if (maximum > 0) {
        meter.max = maximum;
        meter.value = Math.min(maximum, count);
        const used = number.format(Math.abs(maximum - count));
        W.statement(budget, count > maximum ? 'msgOverLimit' : 'msgRemaining', { total: used });
      }
      const frequency = new Map();
      for (const { segment } of parts) {
        const key = segment.normalize().toLocaleLowerCase(actual);
        frequency.set(key, (frequency.get(key) || 0) + 1);
      }
      const order = new Intl.Collator(actual);
      const rows = [...frequency.entries()].sort((a, b) => b[1] - a[1] || order.compare(a[0], b[0])).slice(0, 8);
      common.replaceChildren(...rows.map(([term, times]) => {
        const line = document.createElement('li');
        const name = document.createElement('bdi');
        const amount = document.createElement('span');
        name.textContent = term;
        amount.textContent = number.format(times);
        line.append(name, amount);
        return line;
      }));
      empty.hidden = Boolean(rows.length);
      clear.disabled = !text.length;
    }
    const schedule = () => {
      clearTimeout(pending);
      pending = setTimeout(refresh, 100);
    };
    [input, limit, reading, speaking, textLanguage].forEach(field => field.addEventListener('input', schedule));
    clear.addEventListener('click', () => { W.setText(input, ''); input.focus(); });
    refresh();
  }

  const tools = { 'ai-detector': attachDetector, humanizer: attachRewrite, 'text-cleaner': attachCleaner, 'text-counter': attachCounter };
  tools[document.body.dataset.tool]?.();
})();
