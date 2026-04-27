'use strict';

(function () {

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. PERFORMANCE DETECTOR
    //    Same architecture as cta_shapes.js: quick heuristics + FPS benchmark.
    //    Three levels: low / medium / high.
    //    Battery API lowers quality on depleted devices.
    // ═══════════════════════════════════════════════════════════════════════════

    const PERF = {
        level:         'medium',
        targetFPS:     60,
        adaptiveScale: 1.0,
        lastAdapt:     0,

        quickChecks() {
            const ua    = navigator.userAgent;
            const cores = navigator.hardwareConcurrency || 2;
            const mem   = navigator.deviceMemory       || 4;

            if ('getBattery' in navigator) {
                navigator.getBattery().then(b => {
                    if (!b.charging && b.level < 0.2) {
                        this.level = 'low'; this.adaptiveScale = 0.5; this.targetFPS = 30;
                    }
                }).catch(() => {});
            }

            const lowUA  = /SM-A1|SM-J|Redmi [0-6]|Moto [EG][0-4]|RMX[0-9]{3}[0-4]|Android [4-8]/i.test(ua);
            const oldIOS = (() => { const m = ua.match(/OS (\d+)_/); return m && +m[1] < 15; })();
            const tiny   = Math.min(innerWidth, innerHeight) < 360;

            if (lowUA || oldIOS || (cores <= 2 && mem <= 2) || tiny) return 'low';
            if (cores >= 8 && mem >= 8) return 'high';
            return 'medium';
        },

        measureFPS(ms = 250) {
            return new Promise(resolve => {
                const deltas = [];
                let last = performance.now(), t0 = last;
                (function tick(now) {
                    deltas.push(now - last); last = now;
                    if (now - t0 < ms) { requestAnimationFrame(tick); return; }
                    const clean  = deltas.slice(3);
                    const avg    = clean.reduce((a, b) => a + b, 0) / clean.length;
                    const fps    = Math.round(1000 / avg);
                    const stable = clean.every(d => d < 55);
                    resolve({ fps, stable });
                })(last);
            });
        },

        async init() {
            const quick          = this.quickChecks();
            const { fps, stable } = await this.measureFPS(250);

            if (quick === 'low' || fps < 35 || !stable) {
                this.level = 'low'; this.adaptiveScale = 0.60; this.targetFPS = 30;
            } else if (quick === 'high' && fps > 55 && stable) {
                this.level = 'high'; this.adaptiveScale = 1.0; this.targetFPS = 60;
            } else {
                this.level         = 'medium';
                this.adaptiveScale = fps < 46 ? 0.75 : 1.0;
                this.targetFPS     = fps < 46 ? 30   : 60;
            }

            const hud = document.getElementById('perf-hud');
            if (hud) {
                hud.textContent = `gpu:${this.level}  fps:${fps}  dpr:${this.adaptiveScale.toFixed(2)}`;
                hud.classList.add('show');
                setTimeout(() => hud.classList.remove('show'), 4000);
            }

            console.log(`[CHAIN] ${this.level} | fps:${fps} | dpr:${this.adaptiveScale}`);
        },

        // Dynamically lower DPR if frame rate falls below target
        adapt(frameMs) {
            const now = performance.now();
            if (now - this.lastAdapt < 2000) return false;
            const fps = 1000 / frameMs;
            if (fps < this.targetFPS * 0.74 && this.adaptiveScale > 0.40) {
                this.adaptiveScale = Math.max(0.40, this.adaptiveScale - 0.10);
                this.lastAdapt = now;
                console.log(`[CHAIN] DPR → ${this.adaptiveScale.toFixed(2)}`);
                return true;
            }
            if (fps > this.targetFPS * 1.12 && this.adaptiveScale < 1.0 && this.level !== 'low') {
                this.adaptiveScale = Math.min(1.0, this.adaptiveScale + 0.05);
                this.lastAdapt = now;
                return true;
            }
            return false;
        },

        getDPR() {
            const cap = { low: 1.0, medium: 1.5, high: 2.0 }[this.level];
            return Math.min(window.devicePixelRatio || 1, cap) * this.adaptiveScale;
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. QUALITY PARAMS
    // ═══════════════════════════════════════════════════════════════════════════

    // Chain link geometry:
    //   RX   = oval minor radius (link width, ⊥ to chain axis)
    //   RY   = oval major radius (link height, along chain axis)
    //   TUBE = tube radius
    //   SPACING = center-to-center distance between adjacent links
    //
    // For physical interlocking:
    //   - SPACING must be < RY  (so rings overlap in Y and visually pass through each other)
    //   - TUBE*2 must be < RX*2 - TUBE*2, i.e., TUBE < RX - TUBE, i.e., 2*TUBE < RX
    //     (tube diameter must fit through hole)
    //
    //   With RX=0.34, RY=0.60, TUBE=0.10:
    //     Hole width  = 2*(RX-TUBE) = 0.48 > 2*TUBE = 0.20 ✓
    //     SPACING 0.54 < RY 0.60 → interlocking ✓
    //
    // Two link types alternate for interlocking:
    //   Type A (even i): ring in XY plane, hole faces Z  (you see full oval face-on)
    //   Type B (odd  i): ring in YZ plane, hole faces X  (you see edge-on when looking along Z)
    //     — achieved by rotation.y = π/2 on the mesh
    //
    // The TubeGeometry is built from OvalPath (custom THREE.Curve subclass)
    // which places the path in the XY plane. Three.js rotations are then applied
    // per-link to get the correct plane.

    const CHAIN = {
        low:    { n: 14, RX: 0.34, RY: 0.60, TUBE: 0.10, SPACING: 0.7, ts: 24, rs:  8 },
        medium: { n: 20, RX: 0.34, RY: 0.60, TUBE: 0.10, SPACING: 0.7, ts: 44, rs: 12 },
        high:   { n: 26, RX: 0.34, RY: 0.60, TUBE: 0.10, SPACING: 0.7, ts: 68, rs: 16 },
    };

    // Camera base positions: the chain is at x=0 in scene space.
    // Camera is offset LEFT (negative x) so the chain appears on the RIGHT of
    // the full-screen canvas, leaving the left side for the page text content.

    // Per-section view presets.
    // crx/cry/crz = chain GROUP rotation targets (euler angles).
    // cx/cy/cz    = camera POSITION targets (cursor orbit is added on top).
    // Smooth lerp between adjacent presets as scrollY crosses section boundaries.
    const VIEWS = [
        // Hero: chain dead centered on screen — camera at eye level, no tilt.
        { crx:  0.00, cry:  0.00, crz:  0.00, cx: -2.0, cy:  0.0, cz: 12.0 },

        // Network: Falling into the chain - dizzying angle
        { crx:  1.40, cry:  0.60, crz:  0.30, cx: 2.0, cy:  3.5, cz: 10.0 },

        // Security: Spiraling around - wrap effect
        { crx: 1.20, cry:  1.20, crz: 0.80, cx: -3.0, cy:  1.5, cz: 7.5 },

        // Access: Inside the chain - intimate close-up
        { crx:  0.80, cry: 1.80, crz:  1.20, cx: 0.5, cy: -0.5, cz: 5.0 },

        // Start: Bottom looking up - heroic angle
        { crx:  1.20, cry: 0.80, crz:  1.50, cx: 2.5, cy: -4.0, cz: 2.6 },
    ];

    // Section IDs in DOM order (must match VIEWS array)
    const SECTION_IDS = ['hero', 's-network', 's-security', 's-access', 's-start'];

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. OVAL CURVE CLASS
    //    THREE.Curve subclass — oval path in XY plane.
    //    getPoint(t) for t ∈ [0,1] traces the oval once.
    // ═══════════════════════════════════════════════════════════════════════════

    class OvalPath extends THREE.Curve {
        constructor(rx, ry) {
            super();
            this.rx = rx;
            this.ry = ry;
        }
        getPoint(t, target) {
            const v = target || new THREE.Vector3();
            const angle = t * Math.PI * 2;
            return v.set(
                this.rx * Math.cos(angle),
                this.ry * Math.sin(angle),
                0
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. BUILD CHAIN GROUP
    //    Creates the chain as a THREE.Group of n alternating link meshes.
    //
    //    S-curve: each link is offset in X by a gentle sine function so the
    //    chain meanders rather than hanging perfectly straight. The amplitude
    //    is intentionally small (0.12) so interlocking still reads clearly.
    // ═══════════════════════════════════════════════════════════════════════════

    function buildChain() {
        const q = CHAIN[PERF.level];
        const { n, RX, RY, TUBE, SPACING, ts, rs } = q;

        const group = new THREE.Group();

        // Shared material — metallic steel with purple tint
        const mat = new THREE.MeshStandardMaterial({
            color:           0x8888cc,
            metalness:       PERF.level === 'low' ? 0.72 : 0.92,
            roughness:       { low: 0.44, medium: 0.20, high: 0.09 }[PERF.level],
            envMapIntensity: 1.2,
        });

        // Two geometries — both oval tubes, same shape.
        // Type A goes into XY plane (no further rotation on mesh).
        // Type B will have mesh.rotation.y = π/2 → ring moves to YZ plane.
        const pathA   = new OvalPath(RX, RY);
        const pathB   = new OvalPath(RX, RY);
        const geomA   = new THREE.TubeGeometry(pathA, ts, TUBE, rs, true);
        const geomB   = new THREE.TubeGeometry(pathB, ts, TUBE, rs, true);

        const halfH   = (n - 1) * SPACING * 0.5;

        // S-curve parameters
        const SWAY_AMP  = 0.40;   // max X deviation from center
        const SWAY_FREQ = 1.3;    // full sine periods across chain length

        const links = [];

        for (let i = 0; i < n; i++) {
            const isA  = i % 2 === 0;
            const link = new THREE.Mesh(isA ? geomA : geomB, mat);

            const t = n > 2 ? i / (n - 2) : 0;   // 0 → 1 along chain

            // Vertical position — centered at y=0
            link.position.y = halfH - i * SPACING;

            // Horizontal S-curve offset
            link.position.x = SWAY_AMP * Math.sin(t * Math.PI * 2 * SWAY_FREQ);
            link.position.z = SWAY_AMP * 0.35 * Math.cos(t * Math.PI * 2 * SWAY_FREQ * 0.7);

            // Type A: ring naturally in XY, hole faces Z  → no plane rotation needed
            // Type B: rotate Y by π/2  → ring moves to YZ plane, hole faces X
            if (!isA) {
                link.rotation.y = Math.PI / 2;
            }

            // Tiny natural imperfection so links don't look computer-perfect
            link.rotation.z += (Math.random() - 1) * 0.9;

            link.userData.baseX = link.position.x;
            link.userData.baseZ = link.position.z;
            link.userData.idx   = i;

            group.add(link);
            links.push(link);
        }

        group.userData.links = links;
        return group;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. BUILD SCENE + LIGHTING
    //    Studio-style rig: warm key, cool fill, purple rim, two glow points.
    //    Low-end: fewest lights possible.
    // ═══════════════════════════════════════════════════════════════════════════

    function buildScene() {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x07070e);

        // Soft ambient fill
        scene.add(new THREE.AmbientLight(0x090916, 1.6));

        // Key — warm white, high right front
        const key = new THREE.DirectionalLight(0xfff0e8, PERF.level === 'low' ? 1.6 : 2.4);
        key.position.set(6, 10, 8);
        scene.add(key);

        // Fill — cool blue, left side
        const fill = new THREE.DirectionalLight(0x3344ff, 0.55);
        fill.position.set(-8, 0, 3);
        scene.add(fill);

        // Rim — purple, behind-top
        const rim = new THREE.DirectionalLight(0x7722ee, PERF.level === 'low' ? 0.3 : 0.85);
        rim.position.set(-2, 7, -10);
        scene.add(rim);

        // Floor bounce — only medium+
        if (PERF.level !== 'low') {
            const bounce = new THREE.DirectionalLight(0xff8844, 0.14);
            bounce.position.set(0, -8, 2);
            scene.add(bounce);
        }

        // Purple glow point — follows chain vertically, pulses
        const glow = new THREE.PointLight(0x7c3aed, PERF.level === 'low' ? 3.0 : 5.0, 22);
        glow.position.set(1.0, 0, 5);
        scene.add(glow);

        // Cyan accent — high quality only
        let cyanGlow = null;
        if (PERF.level === 'high') {
            cyanGlow = new THREE.PointLight(0x06d6f0, 2.2, 14);
            cyanGlow.position.set(-2, -1, 4);
            scene.add(cyanGlow);
        }

        return { scene, glow, cyanGlow };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. MAIN INIT — async because PERF.init() benchmarks FPS before building
    // ═══════════════════════════════════════════════════════════════════════════

    async function init() {
        await PERF.init();

        const canvas = document.getElementById('chain-canvas');
        if (!canvas || typeof THREE === 'undefined') {
            console.warn('[CHAIN] Canvas or Three.js missing');
            return;
        }

        // ── Renderer ──────────────────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias:       PERF.level !== 'low',
            powerPreference: PERF.level === 'low' ? 'low-power' : 'high-performance',
            alpha:           false,
        });
        renderer.setPixelRatio(PERF.getDPR());
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

        // ── Camera ────────────────────────────────────────────────────────────
        // Starts at hero view preset
        const cam = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
        cam.position.set(VIEWS[0].cx, VIEWS[0].cy, VIEWS[0].cz);

        // ── Scene ─────────────────────────────────────────────────────────────
        const { scene, glow, cyanGlow } = buildScene();
        const chain = buildChain();
        scene.add(chain);

        // Touch detection — cursor orbit disabled on touch
        const isTouch = window.matchMedia('(pointer: coarse)').matches;

        // ═══════════════════════════════════════════════════════════════════════
        // CSS3D PANELS — sections rotate WITH the chain
        //   Each <section> becomes a CSS3DObject placed on a ring around the
        //   chain's Y axis, parented to `chain` so chain.rotation.y carries
        //   them around. In the animate loop we set per-panel opacity from
        //   cos(world-angle): the panel facing the camera is opaque, the
        //   others fade out as they spin away. This way only one section is
        //   readable at a time, but they physically depart with the chain.
        // ═══════════════════════════════════════════════════════════════════════

        const css3dRoot = document.getElementById('css3d-root');
        let css3dRenderer = null;
        const panelGroup = new THREE.Group();
        chain.add(panelGroup);

        const panelObjs = [];   // { obj, baseAngle, el }

        if (css3dRoot && THREE.CSS3DRenderer) {
            css3dRenderer = new THREE.CSS3DRenderer();
            css3dRenderer.setSize(window.innerWidth, window.innerHeight);
            css3dRoot.appendChild(css3dRenderer.domElement);

            const PANEL_RADIUS       = 5.2;     // distance from chain axis (world units)
            const PANEL_SCALE_NORMAL = 0.0068;  // standard panel — bigger
            const PANEL_SCALE_DENSE  = 0.0048;  // security — denser content, smaller
            const DENSE_PANEL_IDS    = new Set(['s-security']);

            SECTION_IDS.forEach((id, i) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.classList.add('panel-3d');

                const obj   = new THREE.CSS3DObject(el);
                const angle = (i / SECTION_IDS.length) * Math.PI * 2;
                const scale = DENSE_PANEL_IDS.has(id)
                    ? PANEL_SCALE_DENSE
                    : PANEL_SCALE_NORMAL;

                obj.position.set(
                    Math.sin(angle) * PANEL_RADIUS,
                    0,
                    Math.cos(angle) * PANEL_RADIUS
                );
                obj.rotation.y = angle;
                obj.scale.setScalar(scale);

                panelGroup.add(obj);
                panelObjs.push({ obj, baseAngle: angle, el });
            });
        }

        // Per-frame: each panel's opacity comes from how directly it faces the
        // camera (cos of world angle), and its local Y drifts so it visibly
        // rises into view from below as it spins in, and continues lifting
        // upward as it leaves — gives a "scrolling vertically" sensation on
        // top of the chain rotation.
        const PANEL_OP_POWER = 1.5;  // softer fade — lower = wider visible window
        const PANEL_LIFT     = 1.6;  // world units the panel travels up/down
        function updatePanelOpacities() {
            const chainY = chain.rotation.y;
            for (const p of panelObjs) {
                // World angle of the panel's outward normal vs. +Z (toward camera)
                let a = (p.baseAngle + chainY) % (Math.PI * 2);
                if (a >  Math.PI) a -= Math.PI * 2;
                if (a < -Math.PI) a += Math.PI * 2;

                const facing = Math.cos(a);                        // 1 front, -1 back
                const op     = Math.max(0, facing) ** PANEL_OP_POWER;
                p.el.style.opacity       = op.toFixed(3);
                p.el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';

                // Vertical drift: rises into the front, then keeps lifting away.
                // sin(a): +1 just before front, 0 at front, -1 just after — so
                // -sin pushes panels up from below as they enter and up as exit.
                p.obj.position.y = -PANEL_LIFT * Math.sin(a);
            }
        }

        // ── Section positions ──────────────────────────────────────────────────
        // Pre-computed at init; recomputed on resize.
        let sectionTops = [];

        function cacheSectionTops() {
            sectionTops = SECTION_IDS.map(id => {
                const el = document.getElementById(id);
                return el ? el.offsetTop : 0;
            });
        }
        cacheSectionTops();

        // ═══════════════════════════════════════════════════════════════════════
        // 7. SCROLL → SECTION BLEND + CHAIN Y TRAVEL
        //
        //   As scrollY moves from 0 to (pageHeight - vh), we:
        //     A) Detect which two sections we're between and compute a smooth [0,1]
        //        blend factor → drives chain GROUP rotation (per-section views).
        //     B) Map scrollY → chain.position.y  (chain travels up as you scroll
        //        down, revealing bottom links).
        // ═══════════════════════════════════════════════════════════════════════

        const q     = CHAIN[PERF.level];
        const halfH = (q.n - 1) * q.SPACING * 0.5;

        // Travel range: show top→bottom of chain over the full page scroll.
        // We only travel 60% of the chain height so some links always overlap
        // the camera frame on both ends.
        const TRAVEL_HALF = halfH * 0.6;

        // Camera base position targets (cursor orbit added on top)
        let targetCX = VIEWS[0].cx;
        let targetCY = VIEWS[0].cy;
        let targetCZ = VIEWS[0].cz;

        // Chain Y position target — chain stays centered on screen.
        let chainTargetY  = 0;
        let chainCurrentY = 0;

        // Is user currently scrolling?
        let isScrolling = false;
        let scrollTimer = null;

        // Scroll-driven spin: a full page scroll = exactly one 360° revolution.
        // With 5 panels evenly spaced around the Y axis, each panel takes the
        // front-facing position for 1/5 of the page scroll. Panel i is in front
        // when scrollFrac == i/5. Negative angle so down-scroll = clockwise.
        let spinTargetY = 0;

        // Continuous, unbounded input-driven rotation. Each wheel pixel adds a
        // tiny fraction of a radian to the rotation target — no caps, no
        // section snapping, just a slow steady spin proportional to how much
        // the user inputs. Chain lerps to spinTargetY in animate() for
        // smoothness. Native scroll is off; body overflow:hidden.
        chainTargetY = 0;
        targetCX = VIEWS[0].cx;
        targetCY = VIEWS[0].cy;
        targetCZ = VIEWS[0].cz;

        const SPIN_PER_PX = 0.0008;   // radians per px of wheel/touch input
        const KEY_STEP    = 0.25;     // radians per arrow / page key press

        function bumpInput() {
            isScrolling = true;
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => { isScrolling = false; }, 700);
        }

        // Wheel + trackpad — accumulates into spinTargetY
        window.addEventListener('wheel', (e) => {
            spinTargetY -= e.deltaY * SPIN_PER_PX;
            bumpInput();
        }, { passive: true });

        // Touch drag — accumulates while finger moves
        let lastTouchY = null;
        window.addEventListener('touchstart', (e) => {
            lastTouchY = e.touches[0].clientY;
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (lastTouchY === null) return;
            const dy = lastTouchY - e.touches[0].clientY;
            lastTouchY = e.touches[0].clientY;
            spinTargetY -= dy * SPIN_PER_PX;
            bumpInput();
        }, { passive: true });
        window.addEventListener('touchend', () => { lastTouchY = null; }, { passive: true });

        // Keyboard arrows / pgup-pgdn / space — discrete nudges
        window.addEventListener('keydown', (e) => {
            if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
                spinTargetY -= KEY_STEP; bumpInput(); e.preventDefault();
            } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
                spinTargetY += KEY_STEP; bumpInput(); e.preventDefault();
            }
        });

        // ═══════════════════════════════════════════════════════════════════════
        // 8. CURSOR ORBIT
        //    Adds a small position offset on top of the section-based camera pos.
        //    Active at all times on desktop; disabled on touch.
        //    The offset lerps to 0 while scrolling for a clean feel.
        // ═══════════════════════════════════════════════════════════════════════

        const ORBIT_X = 0;   // disabled — chain no longer follows the cursor
        const ORBIT_Y = 0;

        let cursorNX = 0, cursorNY = 0;   // normalized −1→1
        let smCurX   = 0, smCurY   = 0;   // smoothed cursor

        if (!isTouch) {
            let lastMouseT = 0;
            window.addEventListener('mousemove', e => {
                const now = performance.now();
                if (now - lastMouseT < 16) return;
                lastMouseT  = now;
                cursorNX    = (e.clientX / innerWidth  - 0.5) * 2;
                cursorNY    = (e.clientY / innerHeight - 0.5) * 2;
            }, { passive: true });
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 9. ANIMATION LOOP
        // ═══════════════════════════════════════════════════════════════════════

        let active    = false;
        let rafId     = null;
        let lastT     = 0;
        let totalSecs = 0;
        const frameMs = 1000 / PERF.targetFPS;

        function animate(now) {
            if (!active) return;
            rafId = requestAnimationFrame(animate);

            // FPS cap
            const elapsed = now - lastT;
            if (elapsed < frameMs * 0.82) return;
            const dt = Math.min(elapsed, 50) / 1000;
            lastT     = now;
            totalSecs += dt;

            // Adaptive DPR
            if (PERF.adapt(elapsed)) {
                renderer.setPixelRatio(PERF.getDPR());
                const w = canvas.clientWidth, h = canvas.clientHeight;
                renderer.setSize(w, h, false);
            }

            // ── Chain group rotation ──────────────────────────────────────────
            // Chain rotates discretely between sections — spinTargetY jumps to
            // the new section angle on each wheel/swipe step, the lerp gives a
            // ~1 s smooth tween between steps. One input event = one section.
            chain.rotation.y += (spinTargetY - chain.rotation.y) * 0.05;
            chain.rotation.x += (0 - chain.rotation.x) * 0.05;
            chain.rotation.z += (0 - chain.rotation.z) * 0.05;

            // ── Chain Y travel ────────────────────────────────────────────────
            const ySpeed = isScrolling ? 0.09 : 0.04;
            chainCurrentY += (chainTargetY - chainCurrentY) * ySpeed;
            chain.position.y = chainCurrentY;

            // ── Living chain micro-animation ──────────────────────────────────
            // Individual links breathe very slightly — gives organic life.
            // Only on medium/high (low-end skips this).
            if (PERF.level !== 'low') {
                const links = chain.userData.links;
                const AMP   = 0.009;
                links.forEach((link, i) => {
                    link.position.x = link.userData.baseX + AMP * Math.sin(totalSecs * 0.55 + i * 0.48);
                    link.position.z = link.userData.baseZ + AMP * 0.6 * Math.cos(totalSecs * 0.40 + i * 0.52);
                });
            }

            // ── Cursor orbit ──────────────────────────────────────────────────
            const orbitFade = isScrolling ? 0.0 : 1.0;
            if (!isTouch) {
                smCurX += (cursorNX * orbitFade - smCurX) * 0.04;
                smCurY += (cursorNY * orbitFade - smCurY) * 0.04;
            }

            const orbitX = smCurX * ORBIT_X;
            const orbitY = smCurY * ORBIT_Y;

            // ── Camera position (section target + cursor orbit) ────────────────
            cam.position.x += (targetCX + orbitX - cam.position.x) * 0.04;
            cam.position.y += (targetCY + orbitY - cam.position.y) * 0.04;
            cam.position.z += (targetCZ          - cam.position.z) * 0.04;

            // Always look at the chain's travelling center
            cam.lookAt(0, chainCurrentY, 0);

            // ── Lights ────────────────────────────────────────────────────────
            glow.position.y  = chainCurrentY + Math.sin(totalSecs * 0.85) * 2.0;
            glow.position.x  = Math.sin(totalSecs * 0.45) * 0.7;
            glow.intensity   = 4.5 + Math.sin(totalSecs * 1.3) * 0.9;

            if (cyanGlow) {
                cyanGlow.position.y = chainCurrentY - Math.cos(totalSecs * 0.65) * 1.5;
                cyanGlow.intensity  = 1.8 + Math.cos(totalSecs * 1.05) * 0.6;
            }

            renderer.render(scene, cam);

            // Fade panels by their facing angle and render the CSS3D layer
            updatePanelOpacities();
            if (css3dRenderer) css3dRenderer.render(scene, cam);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 10. RESIZE — debounced 150ms
        // ═══════════════════════════════════════════════════════════════════════

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const w = canvas.clientWidth;
                const h = canvas.clientHeight;
                renderer.setPixelRatio(PERF.getDPR());
                renderer.setSize(w, h, false);
                if (css3dRenderer) css3dRenderer.setSize(window.innerWidth, window.innerHeight);
                cam.aspect = w / h;
                cam.updateProjectionMatrix();
                cacheSectionTops();
                updateScroll();
            }, 150);
        });

        // ═══════════════════════════════════════════════════════════════════════
        // 11. VISIBILITY API — pause on tab hide
        // ═══════════════════════════════════════════════════════════════════════

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                active = false;
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            } else {
                if (!active) {
                    active = true;
                    lastT  = performance.now();
                    rafId  = requestAnimationFrame(animate);
                }
            }
        });

        // ── Start ──────────────────────────────────────────────────────────────
        active = true;
        lastT  = performance.now();
        rafId  = requestAnimationFrame(animate);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 12. SCROLL-IN FADE OBSERVER
    //     Adds .is-visible to .fade-in elements as they enter viewport.
    // ═══════════════════════════════════════════════════════════════════════════

    function initFadeObserver() {
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('is-visible');
                    io.unobserve(e.target);
                }
            });
        }, { threshold: 0.08 });
        document.querySelectorAll('.fade-in').forEach(el => io.observe(el));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 13. DATA FETCHES — live stats, pubkey, treasury, version
    // ═══════════════════════════════════════════════════════════════════════════

    async function fetchData() {
        const safe = async (url, fn) => {
            try { const r = await fetch(url); if (r.ok) fn(await r.json()); }
            catch (_) {}
        };
        safe('/v1/stats',     d => {
            setEl('sn-nodes',  d.nodes_registered ?? d.total);
            setEl('sn-online', d.nodes_online     ?? d.online);
            setEl('sn-dual',   d.nodes_dual       ?? d.dual_verified);
        });
        safe('/v1/integrity', d => { if (d.public_key) setEl('pubkey-text', d.public_key); });
        safe('/v1/treasury',  d => { if (d.pubkey)     setEl('treasury-text', d.pubkey); });
        safe('/v1/version',   d => {
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

    // ═══════════════════════════════════════════════════════════════════════════
    // BOOT
    // ═══════════════════════════════════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', () => {
        initFadeObserver();
        fetchData();
        init();      // async: benchmarks, then builds scene
    });

})();
