(function () {
  'use strict';

  var STORAGE_KEY_LAST = 'vortex_docs_last';
  var STORAGE_KEY_OPEN = 'vortex_docs_open';

  var treeRoot     = document.getElementById('tree-root');
  var content      = document.getElementById('docs-content');
  var searchInput  = document.getElementById('tree-search');
  var mobileToggle = document.getElementById('mobile-toggle');
  var treePanel    = document.getElementById('docs-tree');

  var dict = {};
  var currentPath = null;
  var openFolders = loadOpen();

  var ALLOWED_TAGS = { STRONG: 1, EM: 1, CODE: 1, BR: 1 };

  var SECTION_LABELS = {
    vortex: 'Vortex', gravitix: 'Gravitix', architex: 'Architex',
    deep: 'Deep reference', gxd: 'Deep reference', arxd: 'Deep reference',
    meta: 'Overview', intro: 'Introduction', quickstart: 'Quick start',
    syntax: 'Syntax', variables: 'Variables', state: 'State', types: 'Types',
    operators: 'Operators', layout: 'Layout', components: 'Components',
    modifiers: 'Modifiers', handlers: 'Handlers', loops: 'Loops',
    theme: 'Theme', imports: 'Imports', reactivity: 'Reactivity',
    strings: 'Strings', errors: 'Errors', examples: 'Examples',
    bestpractices: 'Best practices', navigation: 'Navigation', forms: 'Forms',
    animations: 'Animations', media: 'Media', network: 'Network',
    a11y: 'Accessibility', performance: 'Performance', runtime: 'Runtime',
    compiler: 'Compiler', testing: 'Testing', debugging: 'Debugging',
    migration: 'Migration', faq: 'FAQ', gotchas: 'Gotchas',
    control_flow: 'Control flow', define_comp: 'Define component',
    host_builtins: 'Host built-ins', architecture: 'Architecture',
    crypto: 'Cryptography', cryptoWire: 'Crypto wire format',
    auth: 'Authentication', rooms: 'Rooms', files: 'Files',
    presence: 'Presence', calls: 'Calls', federation: 'Federation',
    gossip: 'Gossip', stealth: 'Stealth', bmp: 'Blind Mailbox',
    push: 'Push', controller: 'Controller', storage: 'Storage',
    bots: 'Bots', ops: 'Operations', mobile: 'Mobile clients',
    webclient: 'Web client', security: 'Security', privacy: 'Privacy',
    ai: 'AI features', monitoring: 'Monitoring', cli: 'CLI tools',
    extras: 'Extras', networking: 'Networking', codebase: 'Codebase layout',
    accessibility: 'Accessibility', roadmap: 'Roadmap', glossary: 'Glossary',
    apiSurface: 'API surface', stealthDetail: 'Stealth (detail)',
    designGoals: 'Design goals', whoIsThisFor: 'Who is this for',
    howToRead: 'How to read', yourFirstBot: 'Your first bot',
    yourFirstScreen: 'Your first screen', whatHappened: 'What just happened',
    runningTheBot: 'Running the bot', runningIt: 'Running it',
    syntaxAtGlance: 'Syntax at a glance', variablesAndTypes: 'Variables & types',
    reactiveVars: 'Reactive variables', computedVars: 'Computed variables',
    typeAnnotations: 'Type annotations', supportedTypes: 'Supported types',
    stringInterpolation: 'String interpolation', containers: 'Containers',
    leafComponents: 'Leaf components', advanced: 'Advanced', forLoops: 'For loops',
    ternary: 'Ternary', slots: 'Slots', compatibility: 'Compatibility',
    compatWeb: 'Web', compatIOS: 'iOS', compatAndroid: 'Android',
    compatVersions: 'Versions', nextSteps: 'Next steps',
  };

  function humanise(key) {
    if (SECTION_LABELS[key]) return SECTION_LABELS[key];
    var s = key.replace(/([A-Z])/g, ' $1').replace(/[_\-]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function loadOpen() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_OPEN);
      return raw ? JSON.parse(raw) : { vortex: true, gravitix: true, architex: true };
    } catch (_) {
      return { vortex: true, gravitix: true, architex: true };
    }
  }
  function saveOpen() {
    try { localStorage.setItem(STORAGE_KEY_OPEN, JSON.stringify(openFolders)); } catch (_) {}
  }

  function resolvePath(path) {
    var parts = path.split('.');
    var cur = dict;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function isChapter(node) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
    var keys = Object.keys(node);
    if (keys.length === 0) return false;
    var leaves = 0, containers = 0;
    for (var i = 0; i < keys.length; i++) {
      var v = node[keys[i]];
      if (v && typeof v === 'object' && !Array.isArray(v)) containers++;
      else leaves++;
    }
    return leaves >= containers;
  }

  function buildTree() {
    treeRoot.innerHTML = '';
    var roots = [
      { key: 'vortex',   label: 'Vortex',   path: 'vortexDocs',    deepInside: 'deep' },
      { key: 'gravitix', label: 'Gravitix', path: 'gravitixDocs',  siblingDeep: 'gxd' },
      { key: 'architex', label: 'Architex', path: 'architexDocs',  siblingDeep: 'arxd' },
    ];

    roots.forEach(function (r) {
      var rootEl = document.createElement('div');
      rootEl.className = 'tree-group';

      var head = document.createElement('div');
      head.className = 'tree-root';
      head.setAttribute('data-root', r.key);
      var dot = document.createElement('span');
      dot.className = 'tree-root-dot';
      head.appendChild(dot);
      head.appendChild(document.createTextNode(r.label));

      var childrenBox = document.createElement('div');
      childrenBox.className = 'tree-children';
      if (openFolders[r.key]) childrenBox.classList.add('open');

      head.addEventListener('click', function () {
        childrenBox.classList.toggle('open');
        openFolders[r.key] = childrenBox.classList.contains('open');
        saveOpen();
      });

      rootEl.appendChild(head);
      rootEl.appendChild(childrenBox);
      treeRoot.appendChild(rootEl);

      var base = resolvePath(r.path) || {};
      addNode(childrenBox, 'Overview', r.path);

      var baseKeys = Object.keys(base).filter(function (k) {
        return k !== 'deep' && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]);
      });
      baseKeys.forEach(function (k) {
        var label = (base[k] && base[k].title) ? base[k].title : humanise(k);
        addNode(childrenBox, label, r.path + '.' + k);
      });

      if (r.deepInside && base[r.deepInside]) {
        addDeepFolder(childrenBox, 'Deep reference', r.path + '.' + r.deepInside, base[r.deepInside]);
      }
      if (r.siblingDeep && dict[r.siblingDeep]) {
        addDeepFolder(childrenBox, 'Deep reference', r.siblingDeep, dict[r.siblingDeep]);
      }
    });
  }

  function addDeepFolder(parent, label, path, dictNode) {
    var folder = document.createElement('div');
    folder.className = 'tree-node folder';
    var isOpen = !!openFolders[path];
    if (isOpen) folder.classList.add('open');
    folder.textContent = label;
    folder.title = label;
    folder.setAttribute('data-path', path);

    var box = document.createElement('div');
    box.className = 'tree-children';
    if (isOpen) box.classList.add('open');

    folder.addEventListener('click', function (e) {
      e.stopPropagation();
      folder.classList.toggle('open');
      box.classList.toggle('open');
      openFolders[path] = folder.classList.contains('open');
      saveOpen();
    });

    parent.appendChild(folder);
    parent.appendChild(box);

    var keys = Object.keys(dictNode).sort(function (a, b) {
      return humanise(a).localeCompare(humanise(b));
    });
    keys.forEach(function (k) {
      var child = dictNode[k];
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        var lbl = child.title || humanise(k);
        addNode(box, lbl, path + '.' + k);
      }
    });
  }

  function addNode(parent, label, path) {
    var node = document.createElement('div');
    node.className = 'tree-node leaf';
    node.textContent = label;
    node.title = label;
    node.setAttribute('data-path', path);
    node.addEventListener('click', function (e) {
      e.stopPropagation();
      render(path);
      document.querySelectorAll('.tree-node.active').forEach(function (n) {
        n.classList.remove('active');
      });
      node.classList.add('active');
      if (window.innerWidth <= 960) treePanel.classList.remove('open');
    });
    parent.appendChild(node);
  }

  function render(path) {
    currentPath = path;
    try { localStorage.setItem(STORAGE_KEY_LAST, path); } catch (_) {}

    var node = resolvePath(path);
    if (node == null) {
      content.innerHTML = '<div class="empty"><div class="hero-mark">&#8416;</div>Nothing here yet.</div>';
      return;
    }

    content.innerHTML = '';

    var crumbs = path.split('.');
    var crumbEl = document.createElement('div');
    crumbEl.className = 'breadcrumb';
    crumbs.forEach(function (c, i) {
      var span = document.createElement('span');
      span.className = 'seg' + (i === crumbs.length - 1 ? ' current' : '');
      span.textContent = humanise(c);
      crumbEl.appendChild(span);
      if (i < crumbs.length - 1) {
        var sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '/';
        crumbEl.appendChild(sep);
      }
    });
    content.appendChild(crumbEl);

    if (typeof node === 'string') {
      var h = document.createElement('h1');
      h.className = 'docs-title';
      h.textContent = humanise(crumbs[crumbs.length - 1]);
      content.appendChild(h);
      var p = document.createElement('div');
      p.className = 'docs-intro';
      safeSetHtml(p, node);
      content.appendChild(p);
      return;
    }

    var titleText = node.title || humanise(crumbs[crumbs.length - 1]);
    var h1 = document.createElement('h1');
    h1.className = 'docs-title';
    h1.textContent = titleText;
    content.appendChild(h1);

    if (node.subtitle) {
      var sub = document.createElement('p');
      sub.className = 'docs-subtitle';
      sub.textContent = node.subtitle;
      content.appendChild(sub);
    }

    if (node.intro) {
      var intro = document.createElement('div');
      intro.className = 'docs-intro';
      safeSetHtml(intro, node.intro);
      content.appendChild(intro);
    }

    renderDict(node, content);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderDict(node, root) {
    var keys = Object.keys(node).filter(function (k) {
      return k !== 'title' && k !== 'subtitle' && k !== 'intro';
    });

    var anyLeaf = keys.some(function (k) {
      var t = typeof node[k];
      return t === 'string' || t === 'number';
    });

    if (!anyLeaf) {
      var chapterKeys = keys.filter(function (k) {
        return node[k] && typeof node[k] === 'object' && !Array.isArray(node[k]);
      });
      if (chapterKeys.length > 0) {
        var list = document.createElement('ul');
        chapterKeys.forEach(function (k) {
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = '#';
          a.textContent = node[k].title || humanise(k);
          a.style.color = 'var(--cyan)';
          a.style.textDecoration = 'none';
          a.addEventListener('click', function (e) {
            e.preventDefault();
            var tryPath = currentPath + '.' + k;
            var sel = document.querySelector('.tree-node[data-path="' + tryPath + '"]');
            if (sel) sel.click();
            else render(tryPath);
          });
          li.appendChild(a);
          if (node[k].subtitle) {
            li.appendChild(document.createTextNode(' — ' + node[k].subtitle));
          }
          list.appendChild(li);
        });
        root.appendChild(list);
        return;
      }
    }

    var groups = groupKeys(node, keys);

    renderHeadingGroups(node, groups.heading_and_paragraph, root);

    if (groups.list.length > 0) {
      var ul = document.createElement('ul');
      groups.list.forEach(function (k) {
        var li = document.createElement('li');
        safeSetHtml(li, node[k]);
        ul.appendChild(li);
      });
      root.appendChild(ul);
    }

    if (groups.code.length > 0) {
      var pre = document.createElement('pre');
      var code = document.createElement('code');
      code.textContent = groups.code.map(function (k) { return node[k]; }).join('\n');
      pre.appendChild(code);
      highlightCode(pre);
      root.appendChild(pre);
    }

    if (groups.table.length > 0) {
      renderTable(node, groups.table, root);
    }

    if (groups.callout.length > 0) {
      groups.callout.forEach(function (k) {
        var div = document.createElement('div');
        div.className = 'callout';
        safeSetHtml(div, node[k]);
        root.appendChild(div);
      });
    }

    if (groups.glossary_terms.length > 0) {
      groups.glossary_terms.forEach(function (pair) {
        var row = document.createElement('div');
        row.className = 'glossary-item';
        var t = document.createElement('div');
        t.className = 'term';
        t.textContent = node[pair.t];
        var d = document.createElement('div');
        d.className = 'def';
        safeSetHtml(d, node[pair.d]);
        row.appendChild(t);
        row.appendChild(d);
        root.appendChild(row);
      });
    }

    if (groups.deep.length > 0) {
      renderDeep(node, groups.deep, root);
    }

    groups.other.forEach(function (k) {
      var p = document.createElement('p');
      var strong = document.createElement('strong');
      strong.textContent = humanise(k) + ': ';
      p.appendChild(strong);
      var span = document.createElement('span');
      safeSetHtml(span, String(node[k]));
      p.appendChild(span);
      root.appendChild(p);
    });
  }

  function groupKeys(node, keys) {
    var heading = {}, para = {}, list = [], code = [], td = [], ct = [],
        glossT = [], glossD = [], deep = [], other = [];

    keys.forEach(function (k) {
      var m;
      if ((m = /^h(\d+)$/.exec(k))) { heading[parseInt(m[1], 10)] = k; return; }
      if (/^h\d+_[abcf]$/.test(k)) return;
      if (/^p\d+$/.test(k))   { para[parseInt(k.slice(1), 10)] = k; return; }
      if (/^li\d+$/.test(k))  { list.push({ k: k, n: parseInt(k.slice(2), 10) }); return; }
      if (/^cc\d+$/.test(k))  { code.push({ k: k, n: parseInt(k.slice(2), 10) }); return; }
      if (/^td\d+$/.test(k))  { td.push({ k: k, n: parseInt(k.slice(2), 10) }); return; }
      if (/^ct\d+$/.test(k))  { ct.push({ k: k, n: parseInt(k.slice(2), 10) }); return; }
      if (/^g\d+t$/.test(k))  { glossT.push({ k: k, n: parseInt(k.slice(1, -1), 10) }); return; }
      if (/^g\d+d$/.test(k))  { glossD.push({ k: k, n: parseInt(k.slice(1, -1), 10) }); return; }
      if (/^(what|why|where|how|when)$/.test(k))      { deep.push(k); return; }
      if (/^(cfg|fail|mon|tune|edge|mig|ts|faq)\d+$/.test(k)) { deep.push(k); return; }
      if (/^h\d+p\d+$/.test(k) || /^h\d+l\d+$/.test(k)) { heading[k] = k; return; }
      other.push(k);
    });

    var pairs = [];
    glossT.sort(function (a, b) { return a.n - b.n; }).forEach(function (t) {
      var d = glossD.filter(function (x) { return x.n === t.n; })[0];
      if (d) pairs.push({ t: t.k, d: d.k });
    });

    list.sort(function (a, b) { return a.n - b.n; });
    code.sort(function (a, b) { return a.n - b.n; });
    td.sort(function (a, b) { return a.n - b.n; });
    ct.sort(function (a, b) { return a.n - b.n; });

    return {
      heading_and_paragraph: buildHeadingGroups(node, heading, para),
      list: list.map(function (x) { return x.k; }),
      code: code.map(function (x) { return x.k; }),
      table: td.map(function (x) { return x.k; }),
      callout: ct.map(function (x) { return x.k; }),
      glossary_terms: pairs,
      deep: deep,
      other: other,
    };
  }

  function buildHeadingGroups(node, headings, paragraphs) {
    var items = [];
    var hKeys = Object.keys(headings).filter(function (x) { return /^\d+$/.test(x); })
                        .map(Number).sort(function (a, b) { return a - b; });
    var pKeys = Object.keys(paragraphs).map(Number).sort(function (a, b) { return a - b; });

    if (hKeys.length === 0) {
      if (pKeys.length > 0) {
        items.push({
          heading: null, summary: null,
          paragraphs: pKeys.map(function (n) { return paragraphs[n]; }),
          details: { desc: null, mech: null, hist: null, form: null },
        });
      }
      return items;
    }

    var firstH = headings[hKeys[0]];
    items.push({
      heading: firstH,
      summary: node[firstH + '_a'] || (pKeys.length > 0 ? node[paragraphs[pKeys[0]]] : null),
      paragraphs: pKeys.map(function (n) { return paragraphs[n]; }),
      details: detailBundle(node, firstH),
    });
    for (var i = 1; i < hKeys.length; i++) {
      var hk = headings[hKeys[i]];
      items.push({
        heading: hk,
        summary: node[hk + '_a'] || null,
        paragraphs: [],
        details: detailBundle(node, hk),
      });
    }
    return items;
  }

  function detailBundle(node, hk) {
    return {
      desc: node[hk + '_a'] || null,
      mech: node[hk + '_b'] || null,
      hist: node[hk + '_c'] || null,
      form: node[hk + '_f'] || null,
    };
  }

  function hasDetails(d) {
    return d && (d.desc || d.mech || d.hist || d.form);
  }

  function renderHeadingGroups(node, groups, root) {
    groups.forEach(function (g) {
      if (!g.heading) {
        g.paragraphs.forEach(function (pk) {
          var p = document.createElement('p');
          safeSetHtml(p, node[pk]);
          root.appendChild(p);
        });
        return;
      }

      var details = g.details || {};
      var expandable = hasDetails(details);
      var hasInlinePara = g.paragraphs.length > 0 && !details.desc;

      if (!expandable && !hasInlinePara) {
        var plain = document.createElement('h3');
        plain.textContent = node[g.heading];
        root.appendChild(plain);
        return;
      }

      var wrap = document.createElement('div');
      wrap.className = 'accordion';
      if (!expandable) wrap.classList.add('no-toggle');

      var btn = document.createElement('button');
      btn.className = 'accordion-btn';
      btn.type = 'button';

      var caret = document.createElement('span');
      caret.className = 'accordion-caret';
      caret.textContent = '▸';
      btn.appendChild(caret);

      var label = document.createElement('span');
      label.className = 'accordion-label';
      label.textContent = node[g.heading];
      btn.appendChild(label);

      if (g.summary) {
        var sum = document.createElement('span');
        sum.className = 'accordion-summary';
        sum.textContent = ' — ' + shortSummary(g.summary);
        btn.appendChild(sum);
      }

      wrap.appendChild(btn);

      var body = document.createElement('div');
      body.className = 'accordion-body';

      if (details.desc) {
        addPanel(body, 'Description', details.desc);
      } else if (hasInlinePara) {
        g.paragraphs.forEach(function (pk) {
          var p = document.createElement('p');
          safeSetHtml(p, node[pk]);
          body.appendChild(p);
        });
      }
      if (details.mech) addPanel(body, 'How it works', details.mech);
      if (details.hist) addPanel(body, 'History', details.hist);
      if (details.form) addFormulaPanel(body, details.form);

      if (!hasInlinePara && !details.desc && !details.mech && !details.hist && !details.form) {
        g.paragraphs.forEach(function (pk) {
          var p = document.createElement('p');
          safeSetHtml(p, node[pk]);
          body.appendChild(p);
        });
      }

      wrap.appendChild(body);

      if (expandable) {
        btn.addEventListener('click', function () {
          wrap.classList.toggle('open');
        });
      }

      root.appendChild(wrap);
    });
  }

  function addPanel(parent, title, text) {
    var label = document.createElement('div');
    label.className = 'panel-label';
    label.textContent = title;
    parent.appendChild(label);
    var p = document.createElement('p');
    safeSetHtml(p, text);
    parent.appendChild(p);
  }

  function addFormulaPanel(parent, text) {
    var label = document.createElement('div');
    label.className = 'panel-label';
    label.textContent = 'Formula / wire shape';
    parent.appendChild(label);
    var pre = document.createElement('pre');
    pre.className = 'formula';
    var code = document.createElement('code');
    code.textContent = text;
    pre.appendChild(code);
    parent.appendChild(pre);
  }

  function shortSummary(text) {
    if (!text) return '';
    var plain = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (plain.length > 90) plain = plain.slice(0, 87) + '…';
    return plain;
  }

  function renderTable(node, keys, root) {
    var half = Math.ceil(keys.length / 2);
    var table = document.createElement('table');
    for (var i = 0; i < half; i++) {
      var tr = document.createElement('tr');
      var l = document.createElement('td');
      safeSetHtml(l, node[keys[i]] || '');
      var r = document.createElement('td');
      safeSetHtml(r, (i + half < keys.length) ? node[keys[i + half]] : '');
      tr.appendChild(l);
      tr.appendChild(r);
      table.appendChild(tr);
    }
    root.appendChild(table);
  }

  function renderDeep(node, keys, root) {
    var core = ['what', 'why', 'where', 'how', 'when'];
    core.forEach(function (k) {
      if (!node[k]) return;
      var h = document.createElement('h3');
      h.textContent = humanise(k);
      root.appendChild(h);
      var p = document.createElement('p');
      safeSetHtml(p, node[k]);
      root.appendChild(p);
    });

    var grpLabels = {
      cfg: 'Configuration', fail: 'Failure modes', mon: 'Monitoring',
      tune: 'Tuning', edge: 'Edge cases', mig: 'Migrations',
      ts: 'Troubleshooting', faq: 'FAQ',
    };
    Object.keys(grpLabels).forEach(function (grp) {
      var re = new RegExp('^' + grp + '\\d+$');
      var items = keys.filter(function (k) { return re.test(k); }).sort(function (a, b) {
        return parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10);
      });
      if (items.length === 0) return;
      var h = document.createElement('h3');
      h.textContent = grpLabels[grp];
      root.appendChild(h);
      var ul = document.createElement('ul');
      items.forEach(function (k) {
        var li = document.createElement('li');
        safeSetHtml(li, node[k]);
        ul.appendChild(li);
      });
      root.appendChild(ul);
    });
  }

  function safeSetHtml(el, raw) {
    while (el.firstChild) el.removeChild(el.firstChild);
    if (typeof raw !== 'string') {
      el.textContent = String(raw);
      return;
    }
    var parsed;
    try {
      parsed = new DOMParser().parseFromString('<div>' + raw + '</div>', 'text/html');
    } catch (_) {
      el.textContent = raw;
      return;
    }
    var root = parsed && parsed.body && parsed.body.firstChild;
    if (!root) { el.textContent = raw; return; }
    walkSafe(root, el);
  }

  function walkSafe(src, dst) {
    for (var child = src.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3) {
        dst.appendChild(document.createTextNode(child.nodeValue));
      } else if (child.nodeType === 1) {
        if (ALLOWED_TAGS[child.tagName]) {
          var out = document.createElement(child.tagName);
          walkSafe(child, out);
          dst.appendChild(out);
        } else {
          walkSafe(child, dst);
        }
      }
    }
  }

  function highlightCode(pre) {
    var textNode = pre.firstChild;
    if (!textNode) return;
    var raw = textNode.textContent;
    var esc = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var out = esc
      .replace(/(\/\/[^\n]*)/g, '<span class="cmt">$1</span>')
      .replace(/("[^"\n]*"|'[^'\n]*')/g, '<span class="str">$1</span>')
      .replace(/\b(on|emit|if|else|let|fn|in|true|false|null|return|for|while|match|send|goto|back|close|screen|theme|import|component|slot)\b/g, '<span class="kw">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>');
    textNode.nodeValue = '';
    var tmp = document.createElement('div');
    tmp.innerHTML = out;
    while (tmp.firstChild) pre.firstChild.parentNode.insertBefore(tmp.firstChild, pre.firstChild);
    pre.removeChild(pre.firstChild);
  }

  function applySearch() {
    var q = searchInput.value.trim().toLowerCase();
    document.querySelectorAll('.tree-node').forEach(function (n) {
      if (!q) { n.style.display = ''; return; }
      n.style.display = n.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
    });
    if (q) {
      document.querySelectorAll('.tree-children').forEach(function (c) { c.classList.add('open'); });
    }
  }

  searchInput.addEventListener('input', applySearch);
  mobileToggle.addEventListener('click', function () {
    treePanel.classList.toggle('open');
  });

  function init() {
    var lang = 'en';
    try {
      var saved = localStorage.getItem('vortex_lang');
      if (saved) lang = saved;
    } catch (_) {}

    var primary = fetch('locales/' + lang + '.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return fetch('locales/en.json').then(function (r) { return r.json(); }); });

    primary.then(function (data) {
      dict = data;
      buildTree();
      var last = null;
      try { last = localStorage.getItem(STORAGE_KEY_LAST); } catch (_) {}
      if (last && resolvePath(last)) {
        var sel = document.querySelector('.tree-node[data-path="' + last + '"]');
        if (sel) { sel.click(); return; }
      }
      var first = document.querySelector('.tree-node.leaf');
      if (first) first.click();
    }).catch(function () {
      content.innerHTML = '<div class="empty"><div class="hero-mark">&#9888;</div>Failed to load documentation.</div>';
    });
  }

  init();
})();
