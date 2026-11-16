(() => {
  'use strict';
  const root = document.documentElement;
  const locale = root.lang;
  const selectorList = document.querySelectorAll('.language-select');
  const themeButton = document.getElementById('theme-toggle');
  const menuButton = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  const tool = document.body.dataset.tool;
  const localFile = location.protocol === 'file:';
  const pageFile = localFile ? 'index.html' : '';
  const fields = [...document.querySelectorAll('main textarea, main select, main input:not([type="file"])')].filter(field => field.id);
  const stateKey = 'forbecorp-tool-draft';
  if (!localFile) {
    document.querySelectorAll('a[data-route], header a, footer a').forEach(link => {
      const href = link.getAttribute('href');
      if (href) link.setAttribute('href', href.replace(/\/index\.html(?=#|$)/, '/'));
    });
  }
  if (tool) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(stateKey));
      if (saved?.tool === tool && saved.locale === locale) {
        sessionStorage.removeItem(stateKey);
        for (const field of fields) {
          const value = saved.fields[field.id];
          if (field.type === 'checkbox' && typeof value === 'boolean') field.checked = value;
          if (typeof value === 'string') field.value = value;
        }
        if (saved.transferred) document.body.dataset.transferred = 'true';
        else document.body.dataset.restoredDraft = 'true';
      }
    } catch (_) {}
  } else {
    const catalog = document.getElementById('catalog-controls');
    const field = document.getElementById('catalog-search');
    const buttons = [...catalog.querySelectorAll('[data-filter]')];
    const status = document.getElementById('catalog-status');
    const groups = [...document.querySelectorAll('[data-catalog-group]')];
    const labels = document.getElementById('tool-strings').dataset;
    const count = new Intl.NumberFormat(locale);
    const normalize = input => input.toLocaleLowerCase(locale).normalize('NFD').replace(/\p{M}/gu, '').trim();
    const cards = [...document.querySelectorAll('[data-catalog-tool]')].map(card => ({
      card, words: normalize(card.textContent + ' ' + card.dataset.search),
    }));
    let selected = 'all';

    function filter() {
      const tokens = normalize(field.value).split(/\s+/u).filter(Boolean);
      let visible = 0;
      for (const { card, words } of cards) {
        card.hidden = (selected !== 'all' && selected !== card.dataset.category)
          || !tokens.every(token => words.includes(token));
        if (!card.hidden) visible++;
      }
      for (const group of groups) group.hidden = !group.querySelector('[data-catalog-tool]:not([hidden])');
      status.textContent = !tokens.length && selected === 'all' ? ''
        : visible ? labels.msgCatalogResults.replace('{total}', count.format(visible)) : labels.msgCatalogEmpty;
    }
    field.addEventListener('input', filter);
    for (const button of buttons) {
      button.addEventListener('click', () => {
        selected = button.dataset.filter;
        buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        filter();
      });
    }
    catalog.hidden = false;
    filter();
    const requested = cards.find(({ card }) => location.hash === '#' + card.dataset.catalogTool);
    if (requested) location.replace(requested.card.querySelector('a[data-route]').href);
  }

  function syncTheme() {
    const dark = root.dataset.theme === 'dark';
    const label = themeButton.dataset[dark ? 'labelLight' : 'labelDark'];
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
    themeButton.setAttribute('aria-pressed', String(dark));
    document.querySelector('meta[name="theme-color"]').content = dark ? '#090a0d' : '#f6f6f7';
  }
  themeButton.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('forbecorp-theme', next); } catch (_) {}
    syncTheme();
  });
  syncTheme();

  function closeMenu() {
    menu.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', menuButton.dataset.labelOpen);
  }
  menuButton.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', menuButton.dataset[open ? 'labelClose' : 'labelOpen']);
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuButton.focus(); } });
  document.addEventListener('click', event => { if (!menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu(); });
  window.matchMedia('(min-width: 821px)').addEventListener?.('change', event => { if (event.matches) closeMenu(); });

  selectorList.forEach(select => {
    select.value = locale;
    select.addEventListener('change', () => {
      try { localStorage.setItem('forbecorp-language', select.value); } catch (_) {}
      if (tool && fields.some(field => field.tagName === 'TEXTAREA' && field.value)) {
        try {
          const draft = Object.fromEntries(fields.map(field => [field.id, field.type === 'checkbox' ? field.checked : field.value]));
          sessionStorage.setItem(stateKey, JSON.stringify({ tool, locale: select.value, fields: draft }));
        } catch (_) {}
      }
      const target = (tool ? `../../${select.value}/${tool}/` : `../${select.value}/`) + pageFile + location.hash;
      window.location.assign(new URL(target, location.href));
    });
  });
  document.getElementById('year').textContent = String(new Date().getFullYear());
})();
