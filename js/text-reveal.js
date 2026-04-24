/**
 * VORTEX — text-reveal.js  v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Futuristic text appearance system, tuned to vortex/main.css token palette.
 *
 * Modes (auto-detected; override with data-reveal="mode"):
 *   glitch      → h1, h2, .hero-eyebrow   scrambled chars lock in one-by-one
 *   scan        → .sec-label              neon sweep left→right, spacing tightens
 *   blur        → paragraphs, .card-body  lifts out of blur + fadeUp
 *   count       → .stat-v numbers         eased count from 0
 *   badge       → .badge                  spring pop with glow burst
 *   typewriter  → .hint-text, code elems  typed with blinking cursor
 *
 * Integration with existing .fade-in / .is-visible system:
 *   • .fade-in containers keep their translateY slide-up (CSS handles it).
 *   • Opacity on .fade-in is overridden so children animate individually.
 *
 * DOM-safe: h1/h2 glitch walks childNodes so <em> gradient and <br> survive.
 */

(() => {
  /* ─── palette (mirrors :root tokens) ────────────────────────── */
  const C = {
    purpleL: '#a855f7',
    cyan:    '#06d6f0',
    text3:   '#444466',
  };

  /* ─── tuning ─────────────────────────────────────────────────── */
  const GLITCH_POOL  = 'ABCDEFGHJKMNPQRSTWXYZabcdefhjkmnpqrstwxyz0123456789@#$%&<>/|{}!?─━│┃±×∑∆';
  const GLITCH_STEPS = 7;
  const FRAME_MS     = 38;
  const STG_HERO     = 16;
  const STG_SEC      = 24;
  const BLUR_DUR     = 880;
  const COUNT_DUR    = 1350;
  const SCAN_DUR     = 680;

  /* ─── utils ──────────────────────────────────────────────────── */
  const rand    = s => s[Math.floor(Math.random() * s.length)];
  const clamp   = (v, a, b) => Math.min(Math.max(v, a), b);
  const easeOut = t => 1 - (1 - t) ** 3;
  const raf2    = fn => requestAnimationFrame(() => requestAnimationFrame(fn));

  /* ─── MODE: GLITCH ───────────────────────────────────────────── */
  function revealGlitch(rootEl, stagger) {
    // Save original markup — we restore it after animation so the DOM
    // is left perfectly clean (no leftover spans, no layout artifacts).
    const originalHTML = rootEl.innerHTML;

    const chars = [];

    function walk(node, gradient) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (!text) return;
        const frag = document.createDocumentFragment();

        for (const ch of text) {
          const sp = document.createElement('span');
          sp.className = 'rv-c';

          // display:inline preserves normal word-wrap behaviour.
          // background-clip:text still works on inline elements.
          if (gradient) {
            sp.style.cssText = [
              'display:inline',
              `background:linear-gradient(128deg,${C.purpleL} 20%,${C.cyan} 80%)`,
              '-webkit-background-clip:text',
              'background-clip:text',
              '-webkit-text-fill-color:transparent',
              'opacity:0',
            ].join(';');
          } else {
            sp.style.cssText = 'display:inline;opacity:0';
          }

          sp.textContent = ch === ' ' ? '\u00a0' : ch;
          frag.appendChild(sp);
          chars.push({ sp, ch, gradient });
        }
        node.parentNode.replaceChild(frag, node);

      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        if (tag === 'br') return;

        const isEm = tag === 'em';
        if (isEm) {
          // Temporarily strip <em> gradient — replicated per char span instead
          node.style.cssText = 'background:none;-webkit-text-fill-color:initial;-webkit-background-clip:initial;background-clip:initial';
        }
        [...node.childNodes].forEach(c => walk(c, gradient || isEm));
      }
    }

    [...rootEl.childNodes].forEach(n => walk(n, false));

    let locked = 0;

    chars.forEach(({ sp, ch, gradient }, i) => {
      setTimeout(() => {
        sp.style.opacity = '1';
        if (!gradient) sp.style.color = C.purpleL;

        let step = 0;
        const t = setInterval(() => {
          if (step >= GLITCH_STEPS) {
            clearInterval(t);
            sp.textContent = ch === ' ' ? '\u00a0' : ch;
            if (!gradient) sp.style.color = '';

            locked++;
            // Once every char is locked, restore the original clean HTML.
            // Short delay lets the last char's final state be visible briefly.
            if (locked === chars.length) {
              setTimeout(() => { rootEl.innerHTML = originalHTML; }, 80);
            }
            return;
          }
          sp.textContent = ch === ' ' ? '\u00a0' : rand(GLITCH_POOL);
          step++;
        }, FRAME_MS);

      }, i * stagger);
    });
  }

  /* ─── MODE: SCAN (.sec-label) ────────────────────────────────── */
  function revealScan(el) {
    const text = el.textContent.trim();
    el.innerHTML = '';

    const inner = document.createElement('span');
    inner.textContent = text;
    Object.assign(inner.style, {
      display:              'inline-block',
      background:           `linear-gradient(90deg,${C.purpleL} 0%,${C.text3} 100%)`,
      webkitBackgroundClip: 'text',
      backgroundClip:       'text',
      webkitTextFillColor:  'transparent',
      backgroundSize:       '200% 100%',
      backgroundPosition:   '100% 0',
      letterSpacing:        '0.35em',
      transition:           `background-position ${SCAN_DUR}ms cubic-bezier(.16,1,.3,1), letter-spacing ${SCAN_DUR}ms cubic-bezier(.16,1,.3,1)`,
    });
    el.appendChild(inner);

    raf2(() => {
      inner.style.backgroundPosition = '0% 0';
      inner.style.letterSpacing      = '0.22em';
    });
  }

  /* ─── MODE: BLUR ─────────────────────────────────────────────── */
  function revealBlur(el) {
    Object.assign(el.style, {
      opacity:    '0',
      filter:     'blur(7px)',
      transform:  'translateY(8px)',
      transition: `opacity ${BLUR_DUR}ms cubic-bezier(.16,1,.3,1),filter ${BLUR_DUR}ms cubic-bezier(.16,1,.3,1),transform ${BLUR_DUR}ms cubic-bezier(.16,1,.3,1)`,
    });
    raf2(() => {
      el.style.opacity   = '1';
      el.style.filter    = 'blur(0)';
      el.style.transform = 'translateY(0)';
    });
  }

  /* ─── MODE: COUNT (.stat-v) ──────────────────────────────────── */
  function revealCount(el) {
    const raw    = el.textContent.trim();
    const suffix = raw.replace(/[\d.,]+/, '');
    const num    = parseFloat(raw.replace(/[^\d.]/g, ''));
    if (isNaN(num)) { revealBlur(el); return; }

    el.style.opacity    = '0';
    el.style.transition = 'opacity 250ms ease';

    const start = performance.now();
    raf2(() => {
      el.style.opacity = '1';
      const tick = now => {
        const t = clamp((now - start) / COUNT_DUR, 0, 1);
        el.textContent = (num < 10 ? (easeOut(t) * num).toFixed(1) : Math.round(easeOut(t) * num).toLocaleString()) + suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = raw;
      };
      requestAnimationFrame(tick);
    });
  }

  /* ─── MODE: BADGE ────────────────────────────────────────────── */
  function revealBadge(el) {
    Object.assign(el.style, {
      opacity:    '0',
      transform:  'scale(0.55)',
      transition: 'opacity 380ms cubic-bezier(.34,1.56,.64,1),transform 380ms cubic-bezier(.34,1.56,.64,1),box-shadow 380ms ease',
    });
    raf2(() => {
      el.style.opacity   = '1';
      el.style.transform = 'scale(1)';
      el.style.boxShadow = '0 0 14px rgba(168,85,247,0.45),0 0 30px rgba(168,85,247,0.18)';
      setTimeout(() => { el.style.boxShadow = ''; }, 650);
    });
  }

  /* ─── MODE: TYPEWRITER ───────────────────────────────────────── */
  function revealTypewriter(el) {
    const text = el.textContent;
    el.textContent   = '';
    el.style.borderRight  = `1.5px solid ${C.cyan}`;
    el.style.paddingRight = '2px';
    el.style.display      = 'inline';
    el.style.animation    = 'rv-blink 0.7s steps(1) infinite';

    let i = 0;
    const type = () => {
      if (i >= text.length) {
        el.style.animation = 'rv-blink 0.7s steps(1) 3';
        setTimeout(() => {
          el.style.borderRight  = 'none';
          el.style.paddingRight = '0';
          el.style.animation    = 'none';
        }, 2100);
        return;
      }
      el.textContent += text[i++];
      setTimeout(type, 26 + Math.random() * 18);
    };
    type();
  }

  /* ─── auto-detect mode ───────────────────────────────────────── */
  function detectMode(el) {
    if (el.dataset.reveal) return el.dataset.reveal;
    const tag = el.tagName?.toLowerCase() ?? '';
    const cls = el.className ?? '';
    if (tag === 'h1' || tag === 'h2')         return 'glitch';
    if (cls.includes('hero-eyebrow'))         return 'glitch';
    if (cls.includes('sec-label'))            return 'scan';
    if (cls.includes('stat-v'))               return 'count';
    if (cls.includes('badge'))                return 'badge';
    if (cls.includes('hint-text') || tag === 'code') return 'typewriter';
    return 'blur';
  }

  /* ─── dispatch ───────────────────────────────────────────────── */
  function run(el, stagger) {
    if (el.dataset.rv) return;
    el.dataset.rv = '1';
    switch (detectMode(el)) {
      case 'glitch':     revealGlitch(el, stagger ?? STG_SEC); break;
      case 'scan':       revealScan(el);       break;
      case 'count':      revealCount(el);      break;
      case 'badge':      revealBadge(el);      break;
      case 'typewriter': revealTypewriter(el); break;
      default:           revealBlur(el);       break;
    }
  }

  /* ─── selectors inside .fade-in blocks ──────────────────────── */
  const CHILD_SEL = [
    'h1','h2',
    '.hero-eyebrow','.hero-sub',
    '.sec-label','.sec-body',
    '.stat-v','.stat-k','.stat-sub',
    '.verif-head strong','.verif-body',
    '.card-title','.card-body',
    '.flow-n','.flow-t','.flow-d',
    '.check-txt',
    '.entry-title','.entry-body',
    '.mirrors-desc',
    '.badge',
    '.hint-text',
    '[data-reveal]',
  ].join(',');

  /* ─── scroll observer for .fade-in blocks ────────────────────── */
  const sectionObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const block = e.target;
      block.classList.add('is-visible');
      sectionObs.unobserve(block);

      [...block.querySelectorAll(CHILD_SEL)].forEach((child, i) => {
        setTimeout(() => run(child), 60 + i * 55);
      });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  /* ─── hero: fires immediately on load ───────────────────────── */
  function initHero() {
    let delay = 0;
    [
      { sel: '.hero-eyebrow', gap: 200 },
      { sel: '.hero-title',   gap: 500 },
      { sel: '.hero-sub',     gap: 220 },
    ].forEach(({ sel, gap }) => {
      document.querySelectorAll(`#hero ${sel}`).forEach(el => {
        const stagger = sel.includes('title') ? STG_HERO : STG_SEC;
        setTimeout(() => run(el, stagger), delay);
        delay += gap;
      });
    });

    // badges: staggered after title
    document.querySelectorAll('#hero .hero-badges .badge').forEach((el, i) => {
      setTimeout(() => run(el), delay + i * 90);
    });
    delay += 400;

    // CTA buttons & scroll hint slide up separately (CSS handles them)
    document.querySelectorAll('.hero-cta .btn').forEach((btn, i) => {
      setTimeout(() => btn.classList.add('rv-btn-in'), delay + i * 140);
    });
    const hint = document.querySelector('.scroll-hint');
    if (hint) setTimeout(() => hint.classList.add('rv-in'), delay + 300);
  }

  /* ─── global CSS ─────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    .rv-c { display:inline-block; will-change:opacity,contents; }

    /* Override .fade-in opacity — child elements handle their own visibility.
       Container keeps only the translateY slide. */
    .fade-in { opacity:1 !important; }
    .fade-in:not(.is-visible) { transform:translateY(24px); }
    .fade-in.is-visible { transform:translateY(0); transition:transform 0.65s ease !important; }

    /* Hero CTA buttons */
    .hero-cta .btn {
      opacity:0; transform:translateY(10px);
      transition:opacity 500ms ease, transform 500ms ease, background 0.2s, color 0.2s, border-color 0.2s;
    }
    .hero-cta .btn.rv-btn-in { opacity:1; transform:translateY(0); }

    /* Scroll hint */
    .scroll-hint { opacity:0; transition:opacity 900ms ease; }
    .scroll-hint.rv-in { opacity:0.40; }

    @keyframes rv-blink {
      0%,100% { border-color:${C.cyan}; }
      50%      { border-color:transparent; }
    }
  `;
  document.head.appendChild(style);

  /* ─── boot ───────────────────────────────────────────────────── */
  function boot() {
    initHero();

    document.querySelectorAll('.fade-in').forEach(el => {
      if (!el.closest('#hero')) sectionObs.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();