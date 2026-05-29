# SEO Audit — karinex.de Shopify Theme

> **Date:** 2026-05-29
> **Scope:** Code-level (theme repository) audit only. No live crawl data.
> **Reviewer:** automated theme analysis
> **Status:** Report only — no code changes were made.

This audit inspects the rendered `<head>`, structured data, templates,
sections and assets of the theme. Issues are ordered **highest → lowest
SEO impact**. Each finding lists the **file**, the **problem**, and the
**recommended fix**.

---

## Executive summary

The theme is, overall, in **good technical SEO health** — far better than
a typical Shopify theme. Meta-tag handling, canonical normalisation,
hreflang locale-stripping, robots rules and Open Graph coverage are all
implemented thoughtfully (clearly the product of the earlier Ahrefs 404
clean-up workstream).

The **highest-value problems left are in structured data** (the same
entity types are emitted twice on product pages, and a site-wide
self-serving `aggregateRating` risks a Google penalty) and in **page
speed** (render-blocking Font Awesome + a 120 KB product stylesheet + a
261 KB product section blow the performance budget). A secondary cluster
is **duplicate meta descriptions** from the shop-description fallback and
the **deliberate de-listing of the Swedish market**.

| # | Area | Severity | One-line |
|---|------|----------|----------|
| 1 | Schema markup | 🔴 High | Duplicate `BreadcrumbList` + `Organization` on every product page |
| 2 | Schema markup | 🔴 High | Site-wide hardcoded `aggregateRating` on `Organization` (policy risk) |
| 3 | Page speed | 🔴 High | 3 render-blocking Font Awesome CSS files + 120 KB product CSS |
| 4 | Page speed | 🔴 High | `product-information.liquid` is 261 KB of inline section markup |
| 5 | Meta descriptions | 🟠 Med | Mass-duplicate descriptions via `shop.description` fallback |
| 6 | hreflang | 🟠 Med | Swedish (`sv`) market excluded from hreflang + blanket-noindexed |
| 7 | H1 tags | 🟠 Med | Homepage H1 is a hidden, non-descriptive brand string |
| 8 | Meta / OG | 🟡 Low | `og:availability` uses non-standard value `oos` |
| 9 | Image alt | 🟡 Low | A handful of empty/dynamic `alt=""` on potentially meaningful images |
| 10 | Internal linking | 🟡 Low | Thin contextual cross-linking on collection/blog pages |
| 11 | robots/sitemap | 🟢 OK | Healthy — minor notes only |
| 12 | Canonical | 🟢 OK | Well handled — no errors found |

---

## 1. Meta titles & descriptions

### 1.1 Titles — generally strong ✅

`snippets/meta-tags.liquid` (lines 67–278) contains an unusually thorough
title engine: per-collection and per-page hand-tuned titles, comma
truncation for collections, 50/70-char caps, suffix suppression when the
brand already appears, search/cart/404 handling. **No critical title
issues.**

Minor observations:

| File | Problem | Recommended fix |
|---|---|---|
| `snippets/meta-tags.liquid:79` | Product pages get **no** `\| karinex` suffix and no brand/keyword tail (`title_suffix = ''`, line 225). Product titles in SERPs therefore lack a brand signal. | Optional: append a short ` – karinex` only when `seo_title.size <= 55`, so the brand still appears without truncation. |
| `snippets/meta-tags.liquid:88–135` | Collection titles are a long hardcoded `if/elsif` ladder keyed on `collection.handle`. New collections fall back to the raw Shopify title. | Move these to a metafield (`collection.metafields.seo.title`) or the Shopify SEO field so the merchant can self-serve without code edits. |

### 1.2 Descriptions — duplicate-content risk 🟠

**File:** `snippets/meta-tags.liquid:49–56`

```liquid
assign meta_description = page_description | strip_html | ... | truncate: 155
if meta_description == blank
  assign meta_description = shop.description | default: shop.name | truncate: 155
endif
```

**Problem:** Every page, collection, blog, article and most CMS pages that
do **not** have a hand-written SEO description fall back to the *same*
`shop.description` string. Google treats large numbers of identical meta
descriptions as a quality signal and will rewrite/ignore them. Only
`cookie-policy` (line 59) has a bespoke override.

**Recommended fix:** Add per-template fallbacks the way titles are
handled — e.g. for collections compose
`"<Collection> günstig kaufen bei karinex – schnelle Lieferung, …"`,
for products use `product.description | strip_html | truncate: 155`,
for articles use `article.excerpt_or_content`. Reserve `shop.description`
only for the homepage.

**Pages most affected** (rely on the fallback today): all `page.*`
templates without a manual description, vendor pages, blog index,
`list-collections`, and any collection not in the hardcoded title ladder.

---

## 2. H1 / H2 tags

### 2.1 Homepage H1 is hidden and non-descriptive 🟠

**File:** `sections/header.liquid:396–397`

```liquid
{%- if request.page_type == 'index' -%}
  <h1 class="visually-hidden">{{ shop.name }}</h1>
{%- endif -%}
```

**Problem:** On the homepage the **only** `<h1>` is a visually-hidden
`karinex`. The most important page on the site spends its single H1 on
the brand name rather than a keyword-rich proposition (e.g. *"Software-
Lizenzen, Microsoft Office & Windows günstig kaufen"*).

**Recommended fix:** Either give the homepage hero section a real,
visible, keyword-bearing `<h1>` and remove the hidden one, or change the
hidden H1 copy to a descriptive phrase. Keep exactly one H1 per page.

### 2.2 Single-H1 hygiene — mostly OK ✅

Checked the two product templates and the article template:

- `sections/product-information.liquid` — exactly **one** real H1 (line
  2446). Lines 45–47 are `replace` filters that *demote* any `<h1>` inside
  the merchant's product description to `<h2>` — a good defensive measure.
- `sections/product-aboutyou.liquid` — one real H1 (line 487), same
  description-demotion guard (lines 14–16). ✅
- `sections/article-layout.liquid` — two `<h1>` literals (lines 72 & 108)
  but they sit in mutually-exclusive `if/else` branches (with-image vs
  no-image hero), so **only one renders**. ✅ The same file also demotes
  in-body `<h1>` to `<h2>` (lines 159–161). ✅

**No action required** for 2.2, but note the pattern as the correct one to
copy into any future template.

### 2.3 Pages assembled from multiple sections — verify in editor

JSON templates (`templates/*.json`) compose several sections. Because each
`main-*` section ships its own H1, a page is correct **only if the
merchant places exactly one H1-bearing section**. Most `main-*` sections
carry exactly one H1 (verified: `main-about`, `main-faq`, `main-shipping`,
`main-impressum`, etc. = 1 each). **Risk:** stacking two such sections in
the editor would yield two H1s. Document this constraint for the merchant.

---

## 3. Image alt text

**Overall: good.** A slurp scan of every `<img>` in `sections/` and
`snippets/` found only **two** files with a literally missing `alt`
attribute, and both are dynamic helpers (`snippets/image.liquid`,
`snippets/util-autofill-img-size-attr.liquid`) where alt is passed in by
the caller. The high `<img>` counts in `custom-slider`, `product-*`, etc.
all carry alt attributes.

Empty `alt=""` occurrences (decorative — acceptable, but verify):

| File | Line | Note |
|---|---|---|
| `sections/article-layout.liquid` | 157 | AI tracking pixel — `alt="" aria-hidden role=presentation` ✅ correct decorative pattern |
| `snippets/karinex-cookie-banner.liquid` | 774 | Google Analytics logo, `alt=""` — minor; a logo is meaningful, give it `alt="Google Analytics"` |
| `snippets/karinex-live-chat.liquid` | 1952 | Lightbox `<img>`, alt set dynamically at runtime — acceptable |
| `sections/product-karinex-v2.liquid` | 152 | `alt=""` on a product-context image — **verify** it isn't a primary product image; if it is, populate `alt="{{ product.title }}"` |

**Recommended fix:** Audit the `product-karinex-v2.liquid:152` and the GA
logo cases; everything else is fine. For galleries, ensure alt derives
from `image.alt | default: product.title`.

---

## 4. hreflang tags

**File:** `snippets/meta-tags.liquid:308–373`

### 4.1 Implementation quality — strong ✅

- Correctly strips **any** known locale prefix before rebuilding alternate
  URLs (lines 321–331) — this is the fix for the historical
  `/en/sv/page` 404 flood and it is solid.
- Emits `de`, `en`, `pl`, `x-default`.
- Per-product handle metafields (`custom.handle_de/en/pl`, lines 357–367)
  let the merchant emit the exact 200-OK URL per market, avoiding the
  "hreflang to redirect" Ahrefs warning. Excellent.
- Shopify's own duplicate hreflang/canonical tags are stripped in
  `layout/theme.liquid:255–259`. ✅

### 4.2 Swedish market is excluded 🟠

**Files:** `snippets/meta-tags.liquid:313` (hreflang `unless … iso_code == 'sv'`)
and `:420–434` + `templates/robots.txt.liquid:25–43`.

**Problem:** The geo-redirect in `layout/theme.liquid:29–30` sends Swedish
visitors (`SE`) to `/sv/`, yet:
- `sv` is **omitted** from every hreflang cluster, and
- **all** `/sv/` product / collection / article / blog pages are
  `noindex,nofollow` (lines 421–423), plus named `/sv/` pages are
  `Disallow`-ed in robots.txt.

So Sweden is effectively de-listed from organic search even though it is
an active redirect target. The code comments explain this is deliberate
(SV pages serve German content with no SV navigation), but for the stated
goal of **"European markets"** this is a real coverage gap.

**Recommended fix (pick one):**
- **If Sweden is not a target:** also drop the `SE → sv` geo-redirect
  (`layout/theme.liquid:29–30`) so Swedish visitors land on `/en` (an
  indexable locale) instead of a noindexed `/sv` page. This is the
  cleaner, consistent option.
- **If Sweden is a target:** translate the `sv` locale properly, add
  `hreflang="sv"`, and remove the blanket noindex. Half-measures (redirect
  but noindex) waste crawl budget and strand users on dead-end pages.

### 4.3 Region targeting note (low)

`de` hreflang serves DE/AT/CH/LU from one locale. That's fine, but you
forgo region-specific targeting (`de-AT`, `de-CH`). Only worth doing if
you publish country-specific pricing/content. No action needed now.

---

## 5. Schema markup (structured data)

This is the **biggest opportunity area.** The head renders five global
schema snippets (`layout/theme.liquid:240–246`):
`schema-website`, `schema-webpage`, `schema-organization`,
`schema-breadcrumb`, and `schema-faq` (FAQ page only). Product templates
additionally render `product-rich-schema` and `schema-howto`.

### 5.1 Duplicate `BreadcrumbList` on product pages 🔴

**Files:** `snippets/schema-breadcrumb.liquid` (rendered site-wide in head,
emits `BreadcrumbList` for products at lines 7+) **and**
`snippets/product-rich-schema.liquid:106–141` (emits a second
`BreadcrumbList` inside its `@graph`).

**Problem:** Every product page ships **two** `BreadcrumbList` blocks with
overlapping but not identical trails (one uses the first non-generic
collection, the other uses `collection` or vendor fallback). Google may
pick the wrong one or flag a conflict; at best it's wasted bytes.

**Recommended fix:** Emit `BreadcrumbList` in **one** place. Since
`product-rich-schema` already builds a full `@graph`, suppress the
breadcrumb branch of `schema-breadcrumb.liquid` when
`request.page_type == 'product'` (or vice-versa). Keep
`schema-breadcrumb` for collection/page/article, and let
`product-rich-schema` own product breadcrumbs.

### 5.2 Duplicate `Organization` on product pages 🔴

**Files:** `snippets/schema-organization.liquid` (`@id …/#organization`,
site-wide) **and** `snippets/product-rich-schema.liquid:88–105`
(`@id …#org`).

**Problem:** Product pages carry two `Organization` entities with
different `@id`s and different property sets (one has address/VAT/rating,
the other has contactPoint/sameAs). This fragments the entity graph.

**Recommended fix:** In `product-rich-schema.liquid`, drop the inline
`Organization` node and instead reference the canonical one by its global
id, i.e. set the offer's `seller` to
`{ "@id": "<shop.url>/#organization" }` so all nodes point at the single
site-wide Organization defined in `schema-organization.liquid`.

### 5.3 Site-wide self-serving `aggregateRating` 🔴 (policy risk)

**File:** `snippets/schema-organization.liquid:8–9, 39–46`

```liquid
assign org_rating = settings.org_rating_value | default: '4.73'
assign org_reviews = settings.org_rating_count | default: '118'
...
"aggregateRating": { "ratingValue": "{{ org_rating }}", "reviewCount": "{{ org_reviews }}", ... }
```

**Problem:** A hardcoded `aggregateRating` attached to the `Organization`
and rendered on **every page** is exactly the pattern Google's
[review-snippet guidelines](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
call out as *self-serving* ("ratings about the business as a whole").
This can trigger a structured-data manual action or simply be ignored —
and it isn't tied to verifiable, on-page review markup.

**Recommended fix:** Remove `aggregateRating` from `Organization`. Put
ratings only where there is real, visible review content — i.e. on
`Product` schema via `product.metafields.reviews.*` (note: `product-rich-
schema.liquid:12–13` already *correctly* omits product ratings unless
reviews exist — apply that same discipline here). If you want star
snippets for the brand, use a third-party aggregator that supports
sameAs/`Review` with real reviews.

### 5.4 `Product` schema completeness ✅ (with one note)

`snippets/product-rich-schema.liquid` is strong: `Offer` with
`priceValidUntil`, `MerchantReturnPolicy`, `OfferShippingDetails`,
conditional `SoftwareApplication`, conditional `FAQPage`, and a smart
`is_software` detector. Good.

- **Note (low):** `priceValidUntil` is set to *now + 1 year* (line 33).
  Fine, but if a sale ends sooner the date is misleading. Consider tying
  it to the actual sale end if/when one exists.
- **Note (low):** `gtin` uses `variant.barcode` unconditionally (line 42).
  Ensure barcodes are real GTINs; an invalid GTIN is worse than none.

### 5.5 Missing / thin schema (opportunities) 🟡

| Missing | Where it'd help | Recommended fix |
|---|---|---|
| `ItemList` on collection pages | `snippets/schema-webpage.liquid:52–` already emits a `CollectionPage` + `ItemList` (good) — **but only first 10 products**. | Acceptable; optionally raise the limit or paginate the list. ✅ mostly covered |
| `BreadcrumbList` on CMS `page` templates | Many `page.*` templates show visual breadcrumbs but no breadcrumb schema unless `schema-breadcrumb` covers them | Verify `schema-breadcrumb.liquid` handles `request.page_type == 'page'`; extend if not |
| `Article`/`BlogPosting` schema | Blog articles | Confirm an `Article` schema is emitted for `article` pages; if not, add one (the OG article tags exist in meta-tags but JSON-LD `Article` is the rich-result driver) |
| `VideoObject` | Any product/landing video | Add if videos are present |

**Action:** confirm `Article`/`BlogPosting` JSON-LD exists for blog
articles — it was not found among the rendered schema snippets and is the
single most valuable *missing* type for the blog.

---

## 6. Canonical tags

**File:** `snippets/meta-tags.liquid:280–306` + `layout/theme.liquid:255–256`

**Status: healthy ✅ — no errors found.** Highlights:

- Single canonical output; Shopify's duplicate is stripped in the layout.
- Vendor filter pages canonicalise to `/collections/all` (line 291).
- Search pages normalise `%20 → +` (line 293).
- Pagination canonicalises to page 1 (lines 294–298).

Minor notes:

| File | Note | Suggestion |
|---|---|---|
| `snippets/meta-tags.liquid:291` | Vendor pages canonical → `/collections/all`, but `/collections/all` is itself `noindex` (line 406/438). Canonicalising to a noindexed URL sends a mixed signal. | Point vendor canonicals at an **indexable** hub (e.g. the relevant brand collection) instead of `all`. |
| Pagination | Canonical to page 1 + `rel=prev/next` (lines 376–383) is slightly contradictory under current Google guidance (it ignores prev/next). Harmless, but page-1 canonical can drop deep paginated products from discovery. | Consider `self`-canonical on paginated pages with `max-snippet:0` (already set) rather than canonical-to-page-1. |

---

## 7. sitemap.xml & robots.txt

### 7.1 robots.txt — healthy ✅

**File:** `templates/robots.txt.liquid`

- Correctly strips `Crawl-delay` for Googlebot (line 10) — fixes the GSC
  warning.
- Disallows `/search`, OAuth login redirects, vendor filters, and the
  `/sv/` orphan pages.
- Appends the Google News sitemap for `*` agents (line 50).

Notes:

| Line | Note | Suggestion |
|---|---|---|
| 16–17 | `Disallow: /search` and `/search?*` — good, and `/search` is also `noindex`. | ✅ |
| 28–43 | Hardcoded `/sv/` disallow list. | Ties into finding 4.2 — if Sweden is dropped, this list becomes unnecessary maintenance. |
| — | No explicit `Sitemap:` line for the **main** `sitemap.xml`. | Shopify injects the default `sitemap.xml` via `robots.rules`/`group.sitemap` (line 45–47), so it *is* present — just confirm it appears in the rendered output. |

### 7.2 sitemap.xml — Shopify-managed ✅

The main `sitemap.xml` is generated by Shopify automatically (no custom
template overrides it, which is correct — you generally should not). The
Google News sitemap is referenced manually. **No action**, but verify in
GSC that the auto-sitemap excludes the noindexed `/sv/` URLs (it may still
list them, creating "indexed-but-noindex"/"submitted-but-blocked"
warnings — another reason to resolve finding 4.2).

---

## 8. Internal linking

**Status: adequate, with thin spots 🟡**

Strengths:
- Product pages render HTML breadcrumbs (`product-information.liquid:492+`)
  using the locale-safe `routes.root_url` homepage link — and a scan
  confirmed **no** instances of the historical
  `{{ routes.root_url }}pages/…` concatenation 404 bug remain. ✅
- Footer and mega-menu provide site-wide navigational links.

Weak areas / recommendations:

| Area | Problem | Recommended fix |
|---|---|---|
| Collection → product depth | `schema-webpage` lists only 10 products; ensure the **rendered** collection grid links all products with descriptive anchors (not just images). | Verify product cards include the title as a text link, not image-only. |
| Blog ↔ product cross-linking | Articles (`article-layout.liquid`) don't appear to link to related products/collections. | Add a "related products" or contextual in-content links block to articles — strong topical-authority signal for a software shop. |
| Orphan-risk on CMS pages | Many `main-*` pages (garantie, zertifikate, b2b, loyalty…) may only be reachable from the footer. | Add contextual links from high-traffic pages (product, homepage) to the most commercially relevant ones. |
| Anchor text | Breadcrumb home link uses translated "Start/Startseite" (good); confirm collection/category links use keyword anchors, not "hier"/"mehr". | Audit anchor text in mega-menu and footer for keyword relevance. |

(Internal-link *equity* distribution is best confirmed with a live crawl —
Ahrefs "Pages by internal links" — which is out of scope for this
code-only audit.)

---

## 9. Page speed issues

Performance budget (from `CLAUDE.md §12`): HTML ≤ 150 KB, critical CSS
≤ 20 KB, JS-before-interaction ≤ 60 KB, LCP ≤ 2.5 s. Several budgets are
exceeded.

### 9.1 Render-blocking Font Awesome (3 files) 🔴

**File:** `layout/theme.liquid:95–97`

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/.../fontawesome.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/.../solid.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/.../brands.min.css">
```

**Problem:** Three **synchronous, render-blocking** stylesheets from a
third-party origin (cdnjs) in the `<head>`, on every page. They block
first paint and add an extra DNS/TLS/connection cost. The inline comment
says this was a deliberate trade-off to stop an icon layout-shift, but the
fix (sync-load *all* of Font Awesome) is heavier than necessary.

**Recommended fix:** Self-host a **subset** of Font Awesome (only the
glyphs actually used) as a single small CSS file served from Shopify's
CDN, and inline the handful of critical icon rules. This removes the
third-party round-trip and the layout shift simultaneously. Alternatively,
replace the few used icons with inline SVG (the theme already uses inline
SVGs in `article-layout.liquid`).

### 9.2 120 KB product stylesheet, render-blocking 🔴

**File:** `sections/product-information.liquid:59`

```liquid
<link rel="stylesheet" href="{{ 'product-information.css' | asset_url | append: '?v=5' }}">
```

`assets/product-information.css` is **120 KB** and loaded with a plain,
render-blocking `<link>` inside the section. On the most important
commercial template this directly delays LCP.

**Recommended fix:** Split into critical (above-the-fold gallery/title/buy-
box) inlined CSS (≤ 20 KB, per budget) + the remainder loaded
non-blockingly. Audit the 120 KB for dead rules — a file this size on one
template almost certainly contains unused selectors.

### 9.3 261 KB inline product section 🔴

**File:** `sections/product-information.liquid` (**261 KB**),
`sections/product-aboutyou.liquid` (**146 KB**)

**Problem:** These sections inline enormous amounts of markup + `<style>`
+ `<script>`. Combined with 9.2, a product page's HTML alone blows the
150 KB HTML budget before product content. Large DOM = slower parse,
style, layout, and worse INP.

**Recommended fix:** Extract repeated `<style>`/`<script>` blocks into
cached `assets/*.css`/`*.js`, and break the section into smaller blocks.
Even moving the inline `<style>` to an external (CDN-cached) file removes
weight from every product HTML response.

### 9.4 Oversized images in assets 🟠

**File:** `assets/affiliate-dashboard-mockup.png` (**445 KB**),
`assets/microsoft-partner-logo.png` (**411 KB**)

**Problem:** A 411 KB PNG for a partner logo and a 445 KB mockup are very
large. If either renders above the fold (the partner logo plausibly does),
it hurts LCP and wastes bandwidth.

**Recommended fix:** Re-encode as WebP/optimised PNG and serve via
`image_url` with explicit `width`/`height`. A logo should be < 30 KB; a
mockup < 100 KB.

### 9.5 Non-served `.gs` files in `assets/` 🟢 (housekeeping)

`assets/` contains several large Google Apps Script files
(`KarinexLoyaltyFull.gs` 98 KB, `KarinexRepricing.gs` 93 KB,
`KarinexAntiFraud.gs` 34 KB, …). These are **not** referenced by the
browser so they don't affect page speed, but they bloat the theme and are
pushed to the live theme on every sync.

**Recommended fix:** Move backend `.gs` scripts to `scripts/` or a
separate repo; keep `assets/` for browser-served files only. (No SEO
impact — listed for completeness.)

### 9.6 Third-party JS — well managed ✅

Usercentrics, GTM, Tidio, Crisp, cart-tracker and the review widget are
all loaded via `requestIdleCallback`/`setTimeout` with timeouts
(`layout/theme.liquid:103–121, 344–394`). This is the correct pattern and
keeps TBT down. ✅ The Ahrefs analytics tag (line 267) is `async`. ✅

---

## Prioritised action list

**Do first (high impact, mostly low effort):**
1. **De-duplicate `BreadcrumbList`** on product pages (§5.1).
2. **De-duplicate `Organization`** on product pages → reference one `@id` (§5.2).
3. **Remove the site-wide `aggregateRating`** from `Organization` (§5.3) — policy risk.
4. **Add per-template meta-description fallbacks** (§1.2) — kills duplicate descriptions.
5. **Resolve the Swedish market contradiction** (§4.2) — either index it or stop redirecting to it.

**Do next (high impact, more effort):**
6. **Self-host a Font Awesome subset / inline SVG** to remove 3 render-blocking CSS files (§9.1).
7. **Split & trim `product-information.css`** (120 KB) and externalise inline section styles (§9.2–9.3).
8. **Give the homepage a real, descriptive H1** (§2.1).

**Polish (lower impact):**
9. Add `Article`/`BlogPosting` JSON-LD to blog articles (§5.5).
10. Optimise the 411 KB / 445 KB images (§9.4).
11. Fix `og:availability` value `oos` → `out of stock` / `instock` (`meta-tags.liquid:489–492`).
12. Re-point vendor canonical away from the noindexed `/collections/all` (§6).
13. Add contextual internal links from articles to products (§8).
14. Populate alt on `product-karinex-v2.liquid:152` and the GA logo (§3).

---

## What's already good (don't regress)

- Locale-prefix stripping for hreflang **and** geo-redirect (the historic
  404 source) — solid.
- Canonical normalisation (vendor/search/pagination).
- Robots: Crawl-delay strip, search/OAuth/vendor disallow.
- Idle-loaded third-party scripts.
- Defensive H1 demotion of merchant-supplied `<h1>` inside descriptions.
- Rich, dynamic `Product` schema that *omits* ratings until real reviews exist.
- Comprehensive Open Graph / Twitter / product OG tags.

---

*End of report. No theme code was modified — this document is the only
file added.*
