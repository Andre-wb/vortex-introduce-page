'use strict';
(function () {
    'use strict';

    // ─── 1. PERFORMANCE DETECTOR ──────────────────────────────────────────────
    //
    // Adapted from cta_shapes.js — quick heuristics + short FPS measurement.
    // Battery API for power-save mode. Three levels: low / medium / high.

    const PERF = {
        level:         'medium',
        targetFPS:     60,
        adaptiveScale: 1.0,
        lastAdapt:     0,

        quickChecks() {
            const ua    = navigator.userAgent;
            const cores = navigator.hardwareConcurrency || 2;
            const mem   = navigator.deviceMemory       || 4;

            // Battery API — reduce quality on low charge
            if ('getBattery' in navigator) {
                navigator.getBattery().then(b => {
                    if (!b.charging && b.level < 0.2) {
                        this.level         = 'low';
                        this.adaptiveScale = 0.5;
                        this.targetFPS     = 30;
                    }
                }).catch(() => {});
            }

            const lowEndUA = /SM-A1|SM-J|Redmi [0-6]|Moto [EG][0-4]|RMX[0-9]{3}[0-4]|Android [4-8]/i.test(ua);
            const oldIOS   = (() => { const m = ua.match(/OS (\d+)_/); return m && +m[1] < 15; })();
            const tinyScreen = Math.min(innerWidth, innerHeight) < 380;

            if (lowEndUA || oldIOS || (cores <= 2 && mem <= 2) || tinyScreen) return 'low';
            if (cores >= 8 && mem >= 8) return 'high';
            return 'medium';
        },

        measureFPS(ms = 220) {
            return new Promise(resolve => {
                const times = [];
                let last = performance.now(), start = last;
                (function tick(now) {
                    times.push(now - last); last = now;
                    if (now - start < ms) { requestAnimationFrame(tick); return; }
                    const clean   = times.slice(2);
                    const avg     = clean.reduce((a, b) => a + b, 0) / clean.length;
                    const fps     = Math.round(1000 / avg);
                    const stable  = clean.every(t => t < 60);
                    resolve({ fps, stable });
                })(last);
            });
        },

        async init() {
            const quick  = this.quickChecks();
            const { fps, stable } = await this.measureFPS(220);

            if (quick === 'low' || fps < 35 || !stable) {
                this.level = 'low'; this.adaptiveScale = 0.55; this.targetFPS = 30;
            } else if (quick === 'high' && fps > 55 && stable) {
                this.level = 'high'; this.adaptiveScale = 1.0; this.targetFPS = 60;
            } else {
                this.level         = 'medium';
                this.adaptiveScale = fps < 45 ? 0.75 : 1.0;
                this.targetFPS     = fps < 45 ? 30   : 60;
            }

            // Show HUD briefly
            const hud = document.getElementById('perf-hud');
            if (hud) {
                hud.textContent = `gpu:${this.level}  fps:${fps}  dpr:${this.adaptiveScale.toFixed(2)}`;
                hud.classList.add('show');
                setTimeout(() => hud.classList.remove('show'), 4500);
            }

            console.log(`[VORTEX-CHAIN] ${this.level.toUpperCase()} | fps:${fps} | scale:${this.adaptiveScale}`);
        },

        // Called each frame — dynamically lower DPR if FPS drops
        adapt(frameMs) {
            const now = performance.now();
            if (now - this.lastAdapt < 2000) return false;
            const fps = 1000 / frameMs;
            let changed = false;
            if (fps < this.targetFPS * 0.75 && this.adaptiveScale > 0.4) {
                this.adaptiveScale = Math.max(0.4, this.adaptiveScale - 0.1);
                this.lastAdapt = now; changed = true;
                console.log(`[VORTEX-CHAIN] Downgraded DPR → ${this.adaptiveScale.toFixed(2)}`);
            } else if (fps > this.targetFPS * 1.12 && this.adaptiveScale < 1.0 && this.level !== 'low') {
                this.adaptiveScale = Math.min(1.0, this.adaptiveScale + 0.05);
                this.lastAdapt = now; changed = true;
            }
            return changed;
        },

        getDPR() {
            const cap = { low: 1.0, medium: 1.5, high: 2.0 }[this.level];
            return Math.min(window.devicePixelRatio || 1, cap) * this.adaptiveScale;
        }
    };

    // ─── 2. CHAIN GEOMETRY PARAMS BY LEVEL ───────────────────────────────────

    function chainParams() {
        // numLinks, major radius R, tube radius, radial segments, tubular segments
        return {
            low:    { n: 14, R: 0.50, t: 0.15, rs: 9,  ts: 22 },
            medium: { n: 20, R: 0.50, t: 0.14, rs: 13, ts: 36 },
            high:   { n: 26, R: 0.50, t: 0.13, rs: 18, ts: 60 },
        }[PERF.level];
    }

    // ─── 3. BUILD CHAIN GROUP ─────────────────────────────────────────────────
    //
    // Alternating torus orientations create the classic interlocking chain look.
    // Even links: ring in XY plane (hole faces Z).
    // Odd links:  ring in YZ plane (hole faces X, 90° rotated around Y).
    // Both stand upright because rotation.x = π/2 from TorusGeometry's XZ default.

    const LINK_SPACING = 0.74;  // center-to-center Y distance between links

    function buildChain() {
        const p     = chainParams();
        const group = new THREE.Group();

        // Shared geometry (instanced-like approach: same geom, per-mesh transform)
        const geomA = new THREE.TorusGeometry(p.R, p.t, p.rs, p.ts);
        const geomB = new THREE.TorusGeometry(p.R, p.t, p.rs, p.ts);

        const mat = new THREE.MeshStandardMaterial({
            color:      0x9090c8,
            metalness:  PERF.level === 'low' ? 0.70 : 0.92,
            roughness:  { low: 0.42, medium: 0.22, high: 0.10 }[PERF.level],
            envMapIntensity: 1.0,
        });

        const halfH = (p.n - 1) * LINK_SPACING * 0.5;

        for (let i = 0; i < p.n; i++) {
            const link = new THREE.Mesh(i % 2 === 0 ? geomA : geomB, mat);

            // Position centered on origin
            link.position.y = halfH - i * LINK_SPACING;

            // Stand the torus upright (from XZ plane to XY)
            link.rotation.x = Math.PI / 2;

            // Alternate 90° around Y for interlocking
            if (i % 2 === 1) link.rotation.y = Math.PI / 2;

            // Tiny natural imperfection
            link.rotation.z = (Math.random() - 0.5) * 0.06;

            group.add(link);
        }

        return group;
    }

    // ─── 4. SCENE + LIGHTING ─────────────────────────────────────────────────
    //
    // Studio-style lighting: warm key, cool fill, purple rim, glow point.
    // Extra lights enabled only for medium/high to stay fast on low-end.

    function buildScene(renderer) {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x07070e);

        // Ambient — very dark indigo
        scene.add(new THREE.AmbientLight(0x080814, 1.4));

        // Key light — warm white, top-right-front
        const key = new THREE.DirectionalLight(0xfff4e0,
            PERF.level === 'low' ? 1.4 : 2.2);
        key.position.set(5, 9, 7);
        scene.add(key);

        // Fill — cool blue, left side
        const fill = new THREE.DirectionalLight(0x4455ff, 0.5);
        fill.position.set(-7, 1, 3);
        scene.add(fill);

        // Rim — purple, from behind-top (brand color accent on edge)
        const rim = new THREE.DirectionalLight(0x8833ff,
            PERF.level === 'low' ? 0.25 : 0.75);
        rim.position.set(-2, 6, -9);
        scene.add(rim);

        if (PERF.level !== 'low') {
            // Floor bounce — subtle warm from below
            const bounce = new THREE.DirectionalLight(0xff9944, 0.12);
            bounce.position.set(0, -7, 2);
            scene.add(bounce);
        }

        // Purple glow point (follows chain, pulses gently)
        const glow = new THREE.PointLight(0x7c3aed,
            PERF.level === 'low' ? 2.5 : 4.5, 20);
        glow.position.set(1.5, 0, 4);
        scene.add(glow);

        // Cyan accent point for high quality
        let cyanGlow = null;
        if (PERF.level === 'high') {
            cyanGlow = new THREE.PointLight(0x06d6f0, 1.8, 12);
            cyanGlow.position.set(-2, -2, 3.5);
            scene.add(cyanGlow);
        }

        return { scene, glow, cyanGlow };
    }

    // ─── 5. MAIN INIT ─────────────────────────────────────────────────────────

    async function init() {
        await PERF.init();

        const canvas  = document.getElementById('chain-canvas');
        const heroEl  = document.getElementById('hero');

        if (!canvas || !heroEl || typeof THREE === 'undefined') {
            console.warn('[VORTEX-CHAIN] Three.js not available or canvas missing');
            return;
        }

        // ── Renderer ──────────────────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias:       PERF.level !== 'low',
            powerPreference: PERF.level === 'low' ? 'low-power' : 'high-performance',
        });
        renderer.setPixelRatio(PERF.getDPR());
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

        // ── Camera ────────────────────────────────────────────────────────────
        const cam = new THREE.PerspectiveCamera(
            54,
            canvas.clientWidth / canvas.clientHeight,
            0.1, 80
        );
        cam.position.set(0, 0, 7);

        // ── Scene + Chain ─────────────────────────────────────────────────────
        const { scene, glow, cyanGlow } = buildScene(renderer);
        const chain = buildChain();
        scene.add(chain);

        // ── Touch detection ───────────────────────────────────────────────────
        const isTouch = window.matchMedia('(pointer: coarse)').matches;

        // ─── 6. SCROLL MECHANICS ──────────────────────────────────────────────
        //
        // Hero is 300vh. The scroll zone = heroHeight - viewportHeight.
        // scrollProgress (0→1) maps chain.position.y from CHAIN_TOP to CHAIN_BOT.
        //
        // CHAIN_TOP: chain shifted so TOP links are visible (scroll = 0).
        // CHAIN_BOT: chain shifted so BOTTOM links are visible (scroll = 1).
        //
        // Chain is built centered at origin. Top link Y = halfHeight.
        // At scroll=0, we want top link near camera — so chain.y is negative.

        const p       = chainParams();
        const halfH   = (p.n - 1) * LINK_SPACING * 0.5;

        // At scroll=0: shift chain down so top ~3 links are in frame
        const CHAIN_TOP  = -(halfH - 3.2);
        // At scroll=1: shift chain up so bottom ~3 links are in frame
        const CHAIN_BOT  =  (halfH - 3.2);

        let scrollProg   = 0;
        let chainTargetY = CHAIN_TOP;
        let chainY       = CHAIN_TOP;

        function updateScroll() {
            const zone = Math.max(1, heroEl.offsetHeight - window.innerHeight);
            scrollProg   = Math.max(0, Math.min(1, window.scrollY / zone));
            chainTargetY = CHAIN_TOP + scrollProg * (CHAIN_BOT - CHAIN_TOP);
        }
        updateScroll();
        window.addEventListener('scroll', updateScroll, { passive: true });

        // ─── 7. CURSOR ORBIT (IDLE MODE) ──────────────────────────────────────
        //
        // When the user stops scrolling (800ms timeout), enable idle mode.
        // In idle mode, the camera gently orbits around the chain based on
        // cursor position. Disabled entirely on touch devices.
        //
        // Camera orbit:
        //   cam.position.x → cursorNorm.x * ORBIT_X  (left / right)
        //   cam.position.y → cursorNorm.y * ORBIT_Y  (up / down)
        //   cam.position.z → BASE_Z - abs(cursorNorm.x) * ORBIT_Z  (toward / away)

        const BASE_Z   = 7.0;
        const ORBIT_X  = 2.4;
        const ORBIT_Y  = 1.4;
        const ORBIT_Z  = 0.8;

        let cursorNX   = 0, cursorNY = 0;   // normalized cursor (-1 to 1)
        let smCursorX  = 0, smCursorY = 0;  // smoothed cursor
        let isScrolling = false;
        let scrollTimer = null;

        // Camera state (lerp targets)
        let camTX = 0, camTY = 0, camTZ = BASE_Z;

        if (!isTouch) {
            let lastMouseTime = 0;
            window.addEventListener('mousemove', e => {
                const now = performance.now();
                if (now - lastMouseTime < 16) return;
                lastMouseTime = now;
                cursorNX = (e.clientX / innerWidth  - 0.5) * 2;
                cursorNY = (e.clientY / innerHeight - 0.5) * 2;
            }, { passive: true });
        }

        window.addEventListener('scroll', () => {
            isScrolling = true;
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => { isScrolling = false; }, 800);
        }, { passive: true });

        // ─── 8. ANIMATION LOOP ────────────────────────────────────────────────

        let active    = false;
        let rafId     = null;
        let lastTime  = 0;
        let totalSecs = 0;
        const frameMs = 1000 / PERF.targetFPS;

        function animate(now) {
            if (!active) return;
            rafId = requestAnimationFrame(animate);

            // FPS limit
            const elapsed = now - lastTime;
            if (elapsed < frameMs * 0.82) return;
            const dt = Math.min(elapsed, 50) / 1000;
            lastTime  = now;
            totalSecs += dt;

            // Adaptive DPR
            if (PERF.adapt(elapsed)) {
                renderer.setPixelRatio(PERF.getDPR());
            }

            // ── Chain scroll position ──────────────────────────────────────────
            // Faster lerp while scrolling, slower in idle for momentum feel
            const lerpSpeed = isScrolling ? 0.10 : 0.055;
            chainY += (chainTargetY - chainY) * lerpSpeed;
            chain.position.y = chainY;

            // Subtle idle sway on Y rotation
            if (!isScrolling) {
                chain.rotation.y = Math.sin(totalSecs * 0.28) * 0.045;
            } else {
                chain.rotation.y *= 0.95;  // dampen sway when scrolling
            }

            // ── Camera orbit in idle mode ──────────────────────────────────────
            if (!isTouch) {
                // Smoothly kill orbit influence when scrolling starts
                const orbitMix = isScrolling ? 0 : 1;
                smCursorX += (cursorNX * orbitMix - smCursorX) * 0.038;
                smCursorY += (cursorNY * orbitMix - smCursorY) * 0.038;
            }

            // Camera targets
            camTX = isTouch ? 0 : smCursorX * ORBIT_X;
            camTY = isTouch ? 0 : smCursorY * ORBIT_Y;
            camTZ = BASE_Z - (isTouch ? 0 : Math.abs(smCursorX) * ORBIT_Z);

            // Lerp camera to targets
            cam.position.x += (camTX - cam.position.x) * 0.032;
            cam.position.y += (camTY - cam.position.y) * 0.032;
            cam.position.z += (camTZ - cam.position.z) * 0.032;

            // Always look at the chain's current center
            cam.lookAt(0, chain.position.y, 0);

            // ── Lights ────────────────────────────────────────────────────────
            // Glow follows chain Y + gentle oscillation
            glow.position.y = chain.position.y + Math.sin(totalSecs * 0.9) * 2.2;
            glow.intensity   = 4.0 + Math.sin(totalSecs * 1.4) * 0.8;
            glow.position.x  = Math.sin(totalSecs * 0.5) * 0.6;

            if (cyanGlow) {
                cyanGlow.position.y = chain.position.y - Math.sin(totalSecs * 0.7) * 1.8;
                cyanGlow.intensity   = 1.5 + Math.cos(totalSecs * 1.1) * 0.5;
            }

            renderer.render(scene, cam);
        }

        // ─── 9. RESIZE ────────────────────────────────────────────────────────

        let resizeTimer;
        function onResize() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const w = canvas.clientWidth;
                const h = canvas.clientHeight;
                renderer.setPixelRatio(PERF.getDPR());
                renderer.setSize(w, h, false);
                cam.aspect = w / h;
                cam.updateProjectionMatrix();
                updateScroll();  // recompute scroll zone on resize
            }, 160);
        }
        window.addEventListener('resize', onResize);

        // ─── 10. INTERSECTION OBSERVER — pause when hero leaves viewport ──────

        const io = new IntersectionObserver(entries => {
            const vis = entries[0].isIntersecting;
            if (vis && !active) {
                active   = true;
                lastTime = performance.now();
                rafId    = requestAnimationFrame(animate);
            } else if (!vis && active) {
                active = false;
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            }
        }, { threshold: 0.01 });
        io.observe(heroEl);

        // ─── 11. VISIBILITY API — pause on tab hide ───────────────────────────

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                active = false;
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            } else {
                // Resume only if hero is in viewport
                const r = heroEl.getBoundingClientRect();
                if (r.bottom > 0 && r.top < innerHeight) {
                    active   = true;
                    lastTime = performance.now();
                    rafId    = requestAnimationFrame(animate);
                }
            }
        });
    }

    // ─── 12. SCROLL-IN FADE OBSERVER ─────────────────────────────────────────

    function initFadeObserver() {
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('is-visible');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.10 });

        document.querySelectorAll('.fade-in').forEach(el => io.observe(el));
    }

    // ─── 13. DATA FETCHES — live stats, pubkey, treasury, version ────────────

    async function fetchData() {
        const safe = async (url, fn) => {
            try { const r = await fetch(url); if (r.ok) fn(await r.json()); }
            catch (_) {}
        };

        // Network stats (try /v1/stats, /v1/nodes/summary, /v1/status as fallback)
        safe('/v1/stats', d => {
            setEl('sn-nodes',  d.nodes_registered ?? d.total);
            setEl('sn-online', d.nodes_online     ?? d.online);
            setEl('sn-dual',   d.nodes_dual       ?? d.dual_verified);
        });

        // Controller pubkey
        safe('/v1/integrity', d => {
            if (d.public_key) setEl('pubkey-text', d.public_key);
        });

        // Treasury address
        safe('/v1/treasury', d => {
            if (d.pubkey) setEl('treasury-text', d.pubkey);
        });

        // Version (for footer + hero badge)
        safe('/v1/version', d => {
            if (d.version) {
                setEl('foot-version', d.version);
                setEl('hero-version', d.version);
            }
        });
    }

    function setEl(id, val) {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.textContent = val;
    }

    // ─── BOOT ─────────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        initFadeObserver();
        fetchData();
        init();   // async — runs PERF.init() then builds scene
    });

})();