# CLAUDE.md

Guidance for AI assistants (Claude Code, etc.) working in this repository.

## What this repository is

This is the **live Shopify Online Store 2.0 theme** for **karinex.de** — a German-language e-commerce store selling software keys (Microsoft Office / Windows, antivirus), branded watches, and LEGO. Base theme is **Shopify "Dwell" v3.2.4** (`config/settings_schema.json` → `theme_info`), heavily customized.

Primary remote: `mgrd281/karinex.de` on GitHub. Shopify pulls and pushes to the `main` branch — commits authored as "Update from Shopify for theme karinex.de/main" come from the Shopify Admin theme editor and may overwrite local edits to JSON template/section files. See "Shopify sync" below.

## Repository layout

Standard Shopify theme layout. Files in each folder follow Shopify's strict naming conventions — do not invent new top-level directories.

| Folder | Purpose | Notes |
|---|---|---|
| `layout/` | Top-level HTML wrappers | `theme.liquid` (all pages), `password.liquid` |
| `templates/` | Per-route page templates | JSON-based for OS2.0 routes; `.liquid` for legacy routes. JSON files are editable in the Theme Editor and **will be overwritten** by Shopify syncs |
| `sections/` | ~112 page-level sections | `main-*.liquid` are route-bound entry sections (e.g. `main-product.liquid`, `main-collection.liquid`); also Karinex-specific sections like `hero-product-slider`, `aboutyou-usp-bar`, `karinex-collections` |
| `blocks/` | OS2.0 block definitions | Includes Shopify defaults plus custom blocks (e.g. `_layered-slide.liquid`, `comparison-slider.liquid`) |
| `snippets/` | ~171 reusable Liquid partials | Shared UI fragments and headless logic (e.g. `meta-tags.liquid`, `smart-script-manager.liquid`, `karinex-cookie-banner.liquid`) |
| `assets/` | ~198 static files | JS modules, CSS, SVG icons. Also contains 10 Google Apps Script (`.gs`) files for backend automations (see "Google Apps Script" below) |
| `config/` | Theme settings | `settings_schema.json` (editor fields) + `settings_data.json` (current values) |
| `locales/` | 30+ translation files | `en.default.json`, `de.json`, `pl.json`, `sv.json`, etc. Schema strings live in `*.schema.json` |
| `scripts/` | Node.js admin scripts | One-off Shopify Admin API utilities (not part of the theme bundle). See `scripts/README.md` |
| `docs/` | Operational docs and CSVs | Redirect CSVs, status emails |
| `AHREFS_404_ACTION_PLAN.md`, `README_404_ANALYSIS.md`, `SHOPIFY_URL_REDIRECTS.md`, `HTACCESS_REDIRECTS.txt` | SEO incident docs | Historical context for past 404 fixes — read before touching localized URL construction |

## Shopify sync — what overwrites what

The `main` branch is wired to a Shopify theme via Shopify's GitHub integration. This has important consequences:

- **JSON files in `templates/` and section groups (`sections/*-group.json`, `templates/*.json`) are routinely overwritten by Shopify** whenever a merchant edits the theme in the Online Store admin editor. They include an "auto-generated" header banner. Edits to these files made in-repo can be silently clobbered by the next Shopify-side edit.
- **Liquid, JS, CSS, and snippet files are safe to edit in-repo.** Shopify writes those back from the editor only if someone uses the code editor in the admin, which is rare.
- The branch `main` is the deployed theme. Feature branches should be merged via PR; do **not** push directly to `main`.

When in doubt about which side last edited a JSON file, `git log -- <file>` will show recent commits — commits authored "Update from Shopify for theme karinex.de/main" are Shopify-originated.

## Development workflow

1. Create a feature branch off `main` (or work on the branch the user specifies). Don't push to `main` directly.
2. Make Liquid/JS/CSS changes locally. Verify there are no `{% raw %}`/`{% endraw %}` mismatches or unclosed tags — Shopify won't lint until the file is uploaded.
3. Open a draft PR against `main`. Shopify's review preview environment will build a theme preview from the PR.
4. After merge, the change is live on the storefront within ~1 minute (Shopify GitHub auto-deploy).

There is **no local build step**, no `package.json`, no bundler, no test suite. JS in `assets/` is shipped as-is via Shopify's CDN; imports use a native `<script type="importmap">` declared in `snippets/scripts.liquid` (e.g. `@theme/component` → `component.js`). When adding a new JS module that should be importable by other modules, register it there.

### Running the admin scripts in `scripts/`

`scripts/update-merchant-data.mjs` is a one-shot Node 18+ script (no install needed; uses built-in `fetch`). It bulk-edits products via the Shopify Admin API. Read `scripts/README.md` for usage; never check tokens in.

## Key Liquid patterns in this codebase

### Localization & URL construction (read before touching!)

This theme has had a **history of broken locale-prefixed URLs** producing `/encollections/...` and `/plcollections/...` 404s. See `README_404_ANALYSIS.md` and `SHOPIFY_URL_REDIRECTS.md`.

Two rules:

- **Always use `routes.*_url` filters and treat them as already containing a trailing slash for the root.** Build paths like `{{ routes.root_url | append: 'collections/vendors' }}`, NOT `{{ routes.root_url }}collections/vendors` (the latter has caused locale-prefix concatenation bugs — `/en` + `collections` → `/encollections`).
- **Geo-language auto-redirect** lives at the very top of `layout/theme.liquid` (lines ~10–62). It maps Shopify Markets `localization.country.iso_code` to a target locale (`de`/`pl`/`sv`/`en`) and redirects via `window.location.replace`. The redirect strips any existing known locale prefix (`en,pl,sv,da,nl,fr,it,es,cs,hu,ro,sk,fi,el,pt`) before re-prepending. Don't break this without re-testing all locales.

Supported locales for the geo redirect: `de` (default, no prefix), `en`, `pl`, `sv`. Other locales in `locales/` are inherited from Dwell but not actively promoted via geo.

### Third-party script management

`snippets/smart-script-manager.liquid` intercepts and defers heavyweight third-party tags (TrustedShops, GTM, Tidio, Usercentrics) to mitigate Total Blocking Time. **Do not add new third-party `<script src>` tags directly in `theme.liquid`** — either route them through the manager's allowlist/defer, or load them on `requestIdleCallback` like the existing pattern in `theme.liquid` (Font Awesome, Tidio, cart tracker, review widget all use this pattern).

Page-gated scripts (Tidio, cart tracker, review widget) are conditionally loaded only on `product`/`cart`/`contact` templates — preserve those guards when editing `theme.liquid`.

### SEO schema and meta tags

`snippets/meta-tags.liquid` is the canonical source of `<title>`, `<meta>`, `<link rel="canonical">`, and `hreflang` tags. `theme.liquid` actively **strips Shopify's auto-injected canonical and hreflang from `content_for_header`** (lines ~252–258) to avoid duplicates. If you need to change canonicals/hreflang, edit `meta-tags.liquid`; do not undo the stripping in `theme.liquid`.

Schema markup is split across `schema-website.liquid`, `schema-webpage.liquid`, `schema-organization.liquid`, `schema-breadcrumb.liquid`, `schema-faq.liquid`, `schema-product-smart.liquid`, `schema-howto.liquid`. Most are rendered unconditionally from `theme.liquid`; FAQ schema is gated on `page.handle == 'faq'`.

### Section/template naming

- Route entry sections are named `main-<route>.liquid` (`main-product`, `main-collection`, `main-cart`, `main-blog`, ...). Each route's JSON template references one of these as its primary section.
- Karinex-specific variants are suffixed: `product.aboutyou.json`, `product.karinex.json`, `main-loyalty-old.liquid` (kept for fallback alongside `main-loyalty.liquid`).
- Blocks for OS2.0 sections use the leading-underscore convention (`_card.liquid`, `_heading.liquid`, `_image.liquid`).

## Google Apps Script files (`assets/Karinex*.gs`)

The `.gs` and `KarinexAntiFraudDashboard.html` files in `assets/` are **not part of the storefront bundle** — they are source mirrors of Google Apps Script projects (Loyalty, Anti-Fraud, Back-in-Stock, Price Alerts, Recently-Sold, Referral Codes, Repricing, Video Engagement) that run server-side from Google Sheets and call the Shopify Admin API. They live in `assets/` because that's where they ended up historically; do not assume Shopify serves them. Edit cautiously and remember they must be copy-pasted back into the GAS editor for changes to deploy.

## Conventions and gotchas

- **JSON template files have a `/* auto-generated */` banner**. Modifying them in-repo is allowed for one-off setup, but expect Shopify to overwrite. Persistent changes belong in the Liquid section, not the JSON.
- **Liquid comment style varies**: both `{% comment %}` and `{%- comment -%}` (whitespace-trimming) are used. Prefer the trimming form in `<head>`-adjacent code to keep HTML clean.
- **Inline CSS for FOUC prevention** is intentional (`theme.liquid` ~200–232). Do not move these into external stylesheets — they need to apply before `base.css` loads.
- **German is the primary language** of user-facing copy. New strings should be translated for at least `de`, `en`, `pl`, `sv` via `locales/*.json`.
- **Commit messages** follow Conventional Commits (`feat(...)`, `fix(...)`, `chore(...)`) with PR number suffix. Match the existing style when committing.
- **Don't add `package.json` or build tooling** unless the user explicitly asks. The theme is intentionally build-step-free so Shopify can sync raw files.

## Working with PRs and the live theme

- Pushes to `main` deploy immediately. Use draft PRs and theme preview branches for any non-trivial change.
- When fixing URL bugs, **search both `sections/` and `snippets/` for the malformed pattern** — the 404 incident hit duplicate code paths in `product-information.liquid` and `product-meta-compact.liquid`.
- After fixing template bugs that produced 404s, also update `docs/shopify-redirects.csv` and re-import in Shopify Admin → Online Store → Navigation → URL Redirects to clean up external/cached references.

## Useful files to read first when onboarding

1. `layout/theme.liquid` — global head/body, geo redirect, third-party loading strategy
2. `snippets/scripts.liquid` — JS module map (importmap)
3. `snippets/smart-script-manager.liquid` — third-party defer logic
4. `snippets/meta-tags.liquid` — SEO source of truth
5. `README_404_ANALYSIS.md` + `SHOPIFY_URL_REDIRECTS.md` — context on past URL-construction bugs
6. `scripts/README.md` — admin script usage
