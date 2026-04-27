```
  ██╗   ██╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗
  ██║   ██║██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝
  ██║   ██║██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝
  ╚██╗ ██╔╝██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗
   ╚████╔╝ ╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗
    ╚═══╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
                                                intro
```

<h1 align="center">vortex-introduce-page</h1>

<p align="center">
  <b>Marketing + documentation site for the <a href="https://github.com/Andre-wb/Vortex">Vortex</a> decentralised messenger.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vanilla_JS-PWA-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="Vanilla JS">
  <img src="https://img.shields.io/badge/Locales-146-7C3AED?style=for-the-badge" alt="146 locales">
  <img src="https://img.shields.io/badge/Docs-19K+_lines-06D6F0?style=for-the-badge" alt="19K+ docs">
  <img src="https://img.shields.io/badge/Build_step-None-22c55e?style=for-the-badge" alt="No build">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/No_framework-22c55e?style=flat-square" alt="No framework">
  <img src="https://img.shields.io/badge/No_bundler-22c55e?style=flat-square" alt="No bundler">
  <img src="https://img.shields.io/badge/No_tracking-22c55e?style=flat-square" alt="No tracking">
  <img src="https://img.shields.io/badge/HTTPS_only-22c55e?style=flat-square" alt="HTTPS only">
</p>

---

## What this repo is

Two things live here:

1. **A landing page** (`vortex-introduce.html`) that explains what Vortex is, how the network works, and how to join it.
2. **A full documentation site** (`docs.html`) that renders the Vortex / Gravitix / Architex reference from JSON locale files into a searchable, collapsible tree.

Everything is vanilla HTML + CSS + ES modules. No framework, no bundler, no tracking scripts. The whole site weighs ~400 KB gzipped including all fonts and JavaScript.

---

## Table of Contents

- [1. Quick look](#1-quick-look)
- [2. Repository layout](#2-repository-layout)
- [3. Running locally](#3-running-locally)
- [4. The docs site](#4-the-docs-site)
  - [4.1 Tree structure](#41-tree-structure)
  - [4.2 Accordion detail blocks](#42-accordion-detail-blocks)
  - [4.3 Search](#43-search)
  - [4.4 Rebuild](#44-rebuild)
- [5. The locale system](#5-the-locale-system)
  - [5.1 File layout](#51-file-layout)
  - [5.2 Adding a new locale](#52-adding-a-new-locale)
  - [5.3 Translating existing locales](#53-translating-existing-locales)
- [6. Styling conventions](#6-styling-conventions)
- [7. Deploying](#7-deploying)
- [8. Contributing](#8-contributing)
- [9. License](#9-license)

---

## 1. Quick look

```
┌─────────────────────────────────────────────┐
│ VORTEX  ·  nodes entries mirrors security  …│  ← fixed nav bar
│                                        Docs │
├─────────────────────────────────────────────┤
│                                              │
│        Decentralized P2P messenger           │
│        protocol                              │
│                                              │
│        [ View nodes ]   [ Run your own ]     │
│                                              │
└─────────────────────────────────────────────┘
```

Four pages the nav links to (`/nodes`, `/entries`, `/mirrors`, `/security`, `/admin`) are rendered by the Vortex controller itself, not by this repo. This repo owns **`/`** (the landing) and **`/docs.html`** (the documentation).

---

## 2. Repository layout

```
vortex-introduce-page/
├── vortex-introduce.html        landing page (10.5 KB HTML + inline CSS)
├── docs.html                    documentation site (interactive tree)
├── css/
│   └── main.css                 shared palette + utility classes
├── js/
│   ├── i18n.js                  language picker + data-i18n runtime
│   ├── chain.js                 hero canvas animation (chain of light nodes)
│   └── docs.js                  docs page tree + renderer
├── locales/
│   ├── en.json                  source of truth — 19K lines of content
│   ├── ru.json
│   ├── es.json
│   └── …                        146 total
├── translate_locales.py         seed → target translation helper
├── requirements.txt
├── LICENSE
└── README.md                    this file
```

No `node_modules`. No `dist/`. No build step. Open `vortex-introduce.html` in a browser and it runs.

---

## 3. Running locally

Simplest:

```bash
open vortex-introduce.html
```

This opens via `file://`. Some browsers block `fetch('locales/*.json')` on `file://` — if the page renders in English and never switches languages, that's why.

To work around:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/vortex-introduce.html
```

Anything that serves static files will do — `npx serve`, `caddy`, a plain nginx docker container. There's no server-side logic in this repo.

---

## 4. The docs site

`docs.html` is the reason this repo exists as code rather than a single landing HTML. Every piece of content you see is read from the locale JSON files. Change `en.json`, refresh the page, the docs update.

### 4.1 Tree structure

The left sidebar shows a three-root tree:

```
● VORTEX                          (vortexDocs)
    Overview
    Architecture
    Cryptography
    Crypto wire format
    Authentication
    Rooms and messaging
    Files and attachments
    Presence and delivery signals
    WebRTC calls
    Federation
    Gossip and peer discovery
    Stealth network
    Blind Mailbox Protocol
    Push notifications
    Controller service
    Storage layer
    Bot framework
    Operations
    Mobile clients
    Web client
    Security posture
    Privacy and compliance
    Debugging and diagnostics
    Testing strategy
    API surface  ▸                (9 groups × ~60 endpoints)
    Roadmap
    Glossary     ▸                (37 terms, A–Z)
    ▸ Deep reference              (422 subsystems, sorted A–Z)

● GRAVITIX                        (gravitixDocs)
    Overview
    ▸ Deep reference              (34 sections from gxd)

● ARCHITEX                        (architexDocs)
    Overview
    ▸ Deep reference              (36 sections from arxd)
```

Every leaf expands to a full chapter. Every heading inside a chapter is an expandable **accordion** (see below). The root dots are colour-coded: purple (Vortex), cyan (Gravitix), amber (Architex).

### 4.2 Accordion detail blocks

Inside every chapter, sub-headings (`h1`, `h2`, …) render as clickable accordions. Clicking reveals four panels per heading:

| Panel | Content |
|-------|---------|
| **Description** | What the thing is. The short answer. |
| **How it works** | Implementation detail, wire shape, algorithm. |
| **History** | Origin, why it was chosen, prior art if any. |
| **Formula** | Wire format / equation / example snippet in monospace. |

This is the `_a` / `_b` / `_c` / `_f` convention in the JSON. Generated by `Vortex/scripts/build_docs_expand.py` and `Vortex/scripts/build_api_glossary.py` in the main repo.

### 4.3 Search

The search box at the top of the sidebar filters the tree by substring. When any query is active, every folder auto-expands so matches remain visible.

Search is client-side only — the whole tree fits in memory.

### 4.4 Rebuild

The locale JSONs are generated, not hand-edited. To regenerate after a content change in the main Vortex repo:

```bash
cd ../Vortex
python3 scripts/build_vortex_docs_v3.py       # vortexDocs + 422 deep subsystems
python3 scripts/build_architex_docs.py        # architexDocs (flat intro)
python3 scripts/build_architex_arxd.py        # arxd (deep reference for Architex)
python3 scripts/build_docs_expand.py          # adds _a/_b/_c/_f per heading
python3 scripts/build_api_glossary.py         # apiSurface (60 endpoints) + glossary (37 terms)
```

Each script updates every locale file in `locales/`. Running all five takes under 10 seconds.

---

## 5. The locale system

### 5.1 File layout

```
locales/
├── en.json     authoritative source (19K lines)
├── ru.json     full translation
├── es.json     full translation
├── zh.json     full translation (simplified)
├── zh-TW.json  full translation (traditional)
├── ar.json
├── fa.json
├── hi.json
├── … 146 total
```

All files have the same key schema. Missing keys fall back to `en.json` at runtime (see `js/i18n.js`).

Top-level keys:

| Key | What it holds |
|-----|---------------|
| `meta` | `title` for `<title>` tag. |
| `nav` | Top nav bar strings (brand, nodes, entries, mirrors, security, treasury, docs). |
| `hero` | Landing hero block (titles, CTA buttons, badges). |
| `network`, `security`, `access`, `start`, `treasury`, `footer` | Other landing sections. |
| `gravitixDocs`, `gxd` | Gravitix language reference. |
| `architexDocs`, `arxd` | Architex language reference. |
| `vortexDocs` | Full Vortex protocol reference. |

### 5.2 Adding a new locale

Pick the ISO code. Copy `en.json`:

```bash
cp locales/en.json locales/<code>.json
```

Translate the values — keys must stay identical. The runtime does key-by-key lookup with English fallback, so partial translations work.

Add the locale to `js/i18n.js` if you want it listed in the language picker; the file already picks up every JSON in `locales/` automatically, so usually no code change is needed.

### 5.3 Translating existing locales

`translate_locales.py` is a Python helper. It walks `en.json`, runs each string through a configured translator (Google Translate by default), writes the target JSON. Requires `pip install -r requirements.txt`.

```bash
python3 translate_locales.py --src en --dst ru
```

Fields that look like technical identifiers (contain `{`, `<code>`, `|`, `→`) are left untranslated so formulas don't get paraphrased.

---

## 6. Styling conventions

Single palette, defined once at the top of `css/main.css` and inline in `vortex-introduce.html` / `docs.html`:

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#07070e` | Page background. |
| `--bg2` | `#0d0d1a` | Card / panel background. |
| `--bg3` | `#121222` | Hover / depressed state. |
| `--border` | `rgba(255,255,255,0.07)` | Subtle divider. |
| `--text` | `#f2f2f8` | Body text. |
| `--text2` | `#8888aa` | Secondary text. |
| `--purple` | `#7c3aed` | Primary accent (Vortex brand). |
| `--cyan` | `#06d6f0` | Secondary accent, code highlighting. |
| `--amber` | `#f59e0b` | Tertiary accent (Architex brand). |

Fonts: **Unbounded** (sans, headings and body) + **JetBrains Mono** (monospace, code). Both loaded from Google Fonts with `preconnect` hints.

All buttons / cards / accordions share 12 px `--radius`. Interactive elements have 150–200 ms transitions.

Everything is responsive down to iPhone 8 width (375 px). Mobile-specific: the docs tree becomes a drawer triggered by a floating ≡ button.

---

## 7. Deploying

Static hosting. Anywhere.

- **Cloudflare Pages / GitHub Pages / Netlify** — push the repo, point the build command at nothing (there's no build), publish directory `.`.
- **nginx / Caddy** — symlink the repo into the document root.
- **IPFS** — `ipfs add -r .` then pin; the Vortex controller has a fallback mode that reads the site from IPFS when HTTPS is blocked.

The landing page and the docs page both load `locales/<code>.json` via fetch, so the hosting needs to serve JSON with the correct MIME. Any default config handles this; if you see strings not translating, check your server's MIME map.

---

## 8. Contributing

PRs welcome. Small changes — fix a translation, tweak a style — go straight to the PR queue.

Bigger changes (new section in the docs, new top-level nav link) should land in the main Vortex repo first since the locale content is generated there. The generator scripts update every locale file at once; please do not hand-edit `locales/*.json` for content that exists in a generator.

Conventions:

- Keep vanilla JS. No frameworks, no bundlers.
- Keep the palette. New colours need a design discussion.
- Keep the file count flat. Feature folders only when a feature needs 3+ files.
- Fonts stay as Unbounded + JetBrains Mono. They define the brand.

---

## 9. License

Apache 2.0 — see `LICENSE`.

---

<p align="center">
  <b>This site is the public face of a decentralised, metadata-aware messenger.</b><br/>
  <sub>Built with 3 files, 146 languages, zero build step.</sub>
</p>

---

## License

Vortex is released under the **Apache License 2.0**.

```
Copyright 2026 Andrey Karavaev, Boris Maltsev

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## Authors

**Boris Maltsev**

[![GitHub](https://img.shields.io/badge/GitHub-BorisMalts-181717?style=flat-square&logo=github)](https://github.com/BorisMalts)

**Andrey Karavaev**

[![GitHub](https://img.shields.io/badge/GitHub-Andre--wb-181717?style=flat-square&logo=github)](https://github.com/Andre-wb)
