/* Lightweight i18n loader for the introduce page.
 *
 * Usage in HTML:
 *   <div data-i18n="nav.nodes">Nodes</div>          -> textContent
 *   <p   data-i18n-html="start.step1">...</p>       -> whitelisted inline tags
 *   <input data-i18n-placeholder="search.ph">      -> placeholder attribute
 *   <a   data-i18n-title="nav.nodes_tip">...</a>   -> title attribute
 *
 * data-i18n-html parses only a whitelist of inline formatting tags
 * (<strong>, <em>, <code>, <br>). Any other tag is escaped as text —
 * i18n.js never uses innerHTML, so stray <script> / attribute injection
 * from a malformed locale file cannot execute.
 *
 * Language picked from (in order):
 *   1. ?lang=xx query string (persisted)
 *   2. localStorage.vortex_lang
 *   3. navigator.language (first 2 chars; "zh-TW" kept whole)
 *   4. "en" fallback
 *
 * Missing key or missing locale file silently falls back to English.
 */
(function () {
  'use strict';

  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'vortex_lang';
  var LOCALES_BASE = 'locales/';
  var ALLOWED_TAGS = { STRONG: 1, EM: 1, CODE: 1, BR: 1 };

  var _cache = {};         // lang -> dict (cached after first fetch)
  var _current = DEFAULT_LANG;

  function pickLang() {
    try {
      var url = new URL(window.location.href);
      var q = url.searchParams.get('lang');
      if (q) {
        try { localStorage.setItem(STORAGE_KEY, q); } catch (_) { /* private mode */ }
        return q;
      }
    } catch (_) { /* URL not available in very old browsers */ }

    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch (_) { /* ignore */ }

    var nav = (navigator.language || navigator.userLanguage || DEFAULT_LANG);
    if (/^zh-(TW|HK|Hant)/i.test(nav)) return 'zh-TW';
    return nav.slice(0, 2).toLowerCase();
  }

  function resolve(dict, path) {
    if (!dict) return undefined;
    var parts = path.split('.');
    var cur = dict;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function fetchLocale(lang) {
    if (_cache[lang]) return Promise.resolve(_cache[lang]);
    return fetch(LOCALES_BASE + lang + '.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) { _cache[lang] = data; return data; });
  }

  /**
   * Parse a locale string into a safe DocumentFragment.
   *
   * The source is parsed with DOMParser (which does NOT execute scripts
   * or fire load events for <img src>). We then walk the parsed tree and
   * copy over only tags from ALLOWED_TAGS, dropping attributes entirely.
   * Disallowed tags become escaped text, so no injection path survives
   * the transform even if a locale file is corrupted or malicious.
   */
  function buildFragment(raw) {
    var frag = document.createDocumentFragment();
    if (typeof raw !== 'string' || raw === '') return frag;

    var parsed;
    try {
      parsed = new DOMParser().parseFromString('<div>' + raw + '</div>', 'text/html');
    } catch (_) {
      frag.appendChild(document.createTextNode(raw));
      return frag;
    }
    var root = parsed && parsed.body && parsed.body.firstChild;
    if (!root) {
      frag.appendChild(document.createTextNode(raw));
      return frag;
    }

    function walk(src, dst) {
      for (var child = src.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3) { // Text
          dst.appendChild(document.createTextNode(child.nodeValue));
        } else if (child.nodeType === 1) { // Element
          if (ALLOWED_TAGS[child.tagName]) {
            var out = document.createElement(child.tagName);
            // no attributes copied — whitelist tags only
            walk(child, out);
            dst.appendChild(out);
          } else {
            // Render disallowed tags as plain text (flatten, preserve inner).
            walk(child, dst);
          }
        }
        // all other node types (comments, CDATA, PIs) are dropped
      }
    }
    walk(root, frag);
    return frag;
  }

  function setSafeHtml(el, raw) {
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(buildFragment(raw));
  }

  function applyDom(dict, fallback) {
    function pick(key) {
      var v = resolve(dict, key);
      if (v != null && v !== '') return v;
      return resolve(fallback, key);
    }

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = pick(el.getAttribute('data-i18n'));
      if (typeof v === 'string') el.textContent = v;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = pick(el.getAttribute('data-i18n-html'));
      if (typeof v === 'string') setSafeHtml(el, v);
    });

    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var v = pick(el.getAttribute('data-i18n-title'));
      if (typeof v === 'string') el.setAttribute('title', v);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var v = pick(el.getAttribute('data-i18n-placeholder'));
      if (typeof v === 'string') el.setAttribute('placeholder', v);
    });

    var title = pick('meta.title');
    if (typeof title === 'string') document.title = title;

    document.documentElement.setAttribute('lang', _current);
  }

  function load(lang) {
    _current = lang;
    var enPromise = fetchLocale(DEFAULT_LANG).catch(function () { return {}; });
    var langPromise = (lang === DEFAULT_LANG)
      ? enPromise
      : fetchLocale(lang).catch(function () { return null; });

    return Promise.all([langPromise, enPromise]).then(function (res) {
      applyDom(res[0] || res[1], res[1]);
    });
  }

  function setLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* ignore */ }
    return load(lang);
  }

  window.VortexI18n = { load: load, setLang: setLang, current: function () { return _current; } };

  function boot() { load(pickLang()); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
