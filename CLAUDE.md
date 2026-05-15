# CLAUDE.md — karinex.de Shopify Theme

> Reference for AI assistants working on this codebase.
> Read this **first** before exploring or editing.

## What this repo is

A **custom Shopify Online Store 2.0 theme** for the karinex.de
shop (Microsoft Office / Windows / Visual Studio license keys —
digital products, instant e-mail delivery).

The theme is heavily customised on top of a Shopify base theme.
Primary brand: deep-green concierge style (`#1D4739`) with
champagne-gold accents (`#c9a84c`).

## Tech stack

| Layer | What |
|---|---|
| Templating | Shopify **Liquid** (server-rendered) |
| Section/Block model | Shopify Online Store 2.0 — JSON templates compose `.liquid` sections + blocks |
| Styling | Plain CSS (no SCSS, no Tailwind) — files in `assets/*.css`, also inline `<style>` blocks inside many sections |
| Scripting | Vanilla **ES5-flavoured JS**, occasional Web Components. **No** jQuery, no bundler |
| i18n | Native Shopify `{% form 'localization' %}` + `locales/*.json`. Active locales: **DE (primary)**, EN, PL, SV |
| Live chat | [Crisp](https://crisp.chat) (Website ID `3dc17a60-f1b3-4b84-9cb5-2998ab31396a`), wrapped by custom gold widget in `snippets/karinex-live-chat.liquid` |
| Consent | Custom Cookie banner (`snippets/karinex-cookie-banner.liquid`) + Usercentrics CMP loaded via `snippets/smart-script-manager.liquid` |
| External services | TrustedShops, Trustami (legal mentions), Google Tag Manager, an invoicing backend at `invoice-production-8cd6.up.railway.app` |
| Deploy | Shopify ↔ GitHub auto-sync. Merging to `main` propagates to the live theme within minutes (no CI build) |

## Folder structure

```
layout/      ( 2 files)  ← entry points
  theme.liquid           ← wraps every page; geo-redirect logic + global head
  password.liquid

templates/   (46 files)  ← per-page composition (JSON or rare .liquid)
  product.json           ← default product template (uses product-information)
  product.aboutyou.json  ← AboutYou-style product template (uses product-aboutyou)
  product.karinex.json   ← alternative Karinex template
  product.karinex-v2.json
  index.json, collection.json, page.*.json, blog.json, article.json, ...

sections/   (112 files)  ← reusable section components, each with {% schema %}
  custom-footer.liquid              ← site footer
  product-information.liquid        ← default product page main (green concierge)
  product-aboutyou.liquid           ← AboutYou-style product page main
  custom-mobile-menu.liquid
  main-*.liquid                     ← page-template-bound sections
  karinex-*.liquid                  ← Karinex-branded sections

snippets/   (171 files)  ← Liquid partials rendered via {% render '<name>' %}
  karinex-cookie-banner.liquid
  karinex-lang-suggestion-banner.liquid   ← first-visit language nudge
  karinex-live-chat.liquid                ← gold concierge chat widget + Crisp glue
  localization-form.liquid                ← country + language dropdown (with flags)
  meta-tags.liquid                        ← hreflang + canonical
  product-rich-schema.liquid              ← JSON-LD
  mega-menu-software-unified.liquid       ← desktop mega menu
  smart-script-manager.liquid             ← Usercentrics + GTM + Tidio loader
  …and ~160 more

blocks/      (94 files)  ← Shopify Online Store 2.0 theme blocks
                           (reusable, drag-droppable from the editor)

assets/     (198 files)  ← static (.css / .js / .svg)
                           Liquid {{ 'file.css' | asset_url }} → Shopify CDN URL

config/      ( 2 files)  ← Shopify Theme Editor state (AUTO-GENERATED)
  settings_data.json     ← live merchant settings (colors, handles, …)
  settings_schema.json   ← theme-wide setting definitions

locales/    (51 files)
  en.default.json        ← primary locale (theme strings)
  en.default.schema.json ← editor-facing translations
  de.json, pl.json, sv.json, …
  *.schema.json          ← Theme Editor labels

docs/        ( 3 files)
  shopify-redirects.csv             ← bulk URL redirects for Admin import
  shopify-redirects.README.md       ← import guide
  order-status-upsell.html          ← snippet for the Order Status page

scripts/     ( 2 files)
  README.md
  update-merchant-data.mjs          ← bulk product metadata updater (Node)
```

## Code conventions

### Naming prefixes (CSS classes / JS IDs)

Custom-namespaced everywhere to avoid collisions with the Shopify
base theme + third-party scripts.

| Prefix | Owner | Used for |
|---|---|---|
| `klc-` | **K**arinex **L**ive **C**hat | floating chat widget |
| `klsw-` | Karinex Locale SWitcher | locale modal (reserved) |
| `klb-` | Karinex Language Banner | first-visit lang suggestion |
| `kx-` | Karinex (legacy) | older Karinex snippets, cookie banner, loyalty |
| `kr-` | Karinex Rewards | rewards CSS tokens |
| `kx-ly-` | Karinex LoYalty | loyalty page CSS |
| `ay-` | About-You-style | AboutYou-pattern components (utility bar, product) |
| `gc-` | Gift Cards | gift-card page styling |
| `ps-` | Product Software | software-product specific styling |

When adding a new component, **always** use a Karinex prefix.

### CSS

- Plain CSS, mobile-first where possible
- CSS custom properties (`--klc-green`, `--rating-star-color`, …) scoped to the component
- Inline `<style>` blocks inside section/snippet files are normal — keeps each snippet self-contained
- Respect `@media (prefers-reduced-motion: reduce)` whenever you add animation
- Brand tokens:
  - Deep green `#1D4739` (primary)
  - `#0a2118` (deepest), `#2d6b54` (highlight)
  - Champagne gold `#c9a84c` (accent only — never primary)
  - Cream `#faf7f0`, ink `#0d2e22`

### JavaScript

- **No build step** — ship readable, ES5-friendly code
- **No jQuery**, no React, no bundler
- Wrap in IIFE: `(function () { … })();`
- DOM lookups: `getElementById` first, fall back to `querySelector`
- Lazy-load third-party scripts on `requestIdleCallback` (see `karinex-live-chat.liquid` and `smart-script-manager.liquid` for the pattern)

### Liquid

- Use `_root` for locale-aware root URL inside any custom section that links to internal pages:

  ```liquid
  {%- liquid
    assign _root = routes.root_url | default: '/'
    unless _root == '/'
      assign _root = _root | append: '/'
    endunless
  -%}
  <a href="{{ _root }}pages/kontakt">…</a>
  ```

  Never use raw `{{ routes.root_url }}pages/…` — it produces
  `/enpages/…` on EN/PL/SV locales (root cause of past 404 floods).

- Multi-language strings inside our custom sections: pick from a
  top-of-file `{% case request.locale.iso_code %}` block
  (see `snippets/karinex-live-chat.liquid`) — do **not** spread
  `{% if request.locale.iso_code == … %}` per phrase across the file.

### Branch / PR strategy

- Each change: a **fresh branch off `origin/main`** with a
  kebab-case name describing the intent (`fix-…`, `feat-…`,
  `chore-…`, `restyle-…`)
- One topic per PR — keeps merges atomic and revertable
- Squash-merge to `main`; Shopify auto-syncs from `main`
- Reverting a regression: `git revert --no-edit <merge-sha>` → new PR → merge

## Files to NEVER edit by hand

These are auto-generated by the Shopify Admin Theme Editor.
Manual edits get overwritten the next time the merchant uses the
editor.

```
config/settings_data.json    ← header banner shows "auto-generated"
config/settings_schema.json
templates/*.json             ← managed by Shopify Theme Editor
                              (we DO edit them when adding a section
                              type the editor can't — treat with
                              care, preserve the auto-gen comment
                              header)
```

Also do not touch:

```
.git/**
.DS_Store
```

Anything else (`sections/`, `snippets/`, `layout/`, `locales/`,
`assets/`, `blocks/`, `docs/`, `scripts/`) is fair game.

## How to run / deploy

There is **no build step** and no local server. Workflow:

1. Branch off `origin/main`
2. Edit `.liquid`, `.json`, `.css`, `.js` files directly
3. Commit with conventional message: `feat(<scope>): …`, `fix(<scope>): …`, `chore(<scope>): …`, `restyle(<scope>): …`
4. Push, open PR against `main` with title matching the commit
5. Squash-merge (no CI configured)
6. Shopify GitHub integration auto-syncs `main` → live theme within ~1–2 minutes
7. Verify in **incognito** browser (Shopify CDN caches aggressively)

### Verifying changes

- **Desktop**: open `https://www.karinex.de/` in incognito
- **Mobile**: real device or Chrome / Safari DevTools device emulator
- **DevTools console** is the only debugger
- For SEO changes, re-run an Ahrefs site audit ~24 h later

### Quick commands

```bash
# Fresh branch off main
git fetch origin main && git checkout origin/main -b <branch-name>

# Inspect a recent merge
git log --oneline -10

# Revert an already-merged PR safely
git revert --no-edit <merge-sha>

# Sync local main with remote
git fetch origin main && git checkout main && git pull
```

## Key integrations / gotchas

- **Geo-redirect** lives at the very top of `layout/theme.liquid`
  (DE/AT/CH/LI/LU → `/`, PL → `/pl`, SE → `/sv`, else → `/en`).
  Anything before `meta-tags` runs before this.

- **Crisp chat** is initialised lazily by
  `snippets/karinex-live-chat.liquid`. Its DOM is hidden off-screen
  (not `display: none`) so its WebSocket keeps receiving messages.
  Do not change to `display: none` — see commit history of PR
  #100 – #102 for the rationale.

- **Cookie banner** uses our own UI, not Shopify's. Shopify's
  banner is hidden via CSS inside
  `snippets/karinex-cookie-banner.liquid`.

- **AboutYou template** (`templates/product.aboutyou.json` +
  `sections/product-aboutyou.liquid`) is a fully responsive
  product template separate from the default. To use it for a
  specific product: Shopify Admin → Product → **Theme template** →
  choose *AboutYou*.

- **Auto-generated comment header**: any JSON file that starts
  with `/* This file is auto-generated… */` is owned by the Theme
  Editor. When you must edit, preserve the header.

- **Locale-aware URLs**: never concatenate `routes.root_url` with a
  path that already starts with `/`. Use the `_root` pattern shown
  above. Repeated regressions of this bug have been the single
  largest source of 404s in the Ahrefs report.

## Recent active workstreams (context for follow-ups)

| Topic | PRs |
|---|---|
| SEO 404 cleanup (Ahrefs reports) | #95 – #99 |
| Live chat (Crisp behind gold UI) | #71 – #105 |
| Locale switcher, banner, flags, geo-SE | #105 – #107 |
| Utility bar / header cleanup | #108 – #114 |
| Mobile chat hide + AboutYou mobile | #116 – #120 (all reverted by #120) |

## Things to ask the user before touching

- Anything that changes pricing / payment flow
- Anything that touches `config/settings_data.json` (live merchant config)
- Removing a section that exists in `templates/*.json` (the editor
  may still reference it)
- Force-push or destructive git operations
