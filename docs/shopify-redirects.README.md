# Shopify URL Redirects — Import Guide

This folder contains a ready-to-import CSV of 301 redirects for the
top-impact 404 URLs from the **May 14 Ahrefs report**. Upload it once
in Shopify Admin and the 404s are gone for crawlers and bookmarks.

## File

`shopify-redirects.csv` — Shopify's required two-column format:

```
Redirect from,Redirect to
/old-path,/new-path
```

## How to import (5 minutes)

1. **Shopify Admin** → **Online Store** → **Navigation**
2. Click **URL Redirects** (top right)
3. Click **Import** → **Add file** → pick `shopify-redirects.csv`
4. **Upload and continue** → review preview → **Import**

Shopify deduplicates against existing redirects automatically — safe
to re-import after edits.

## What's in this file

| Group | Why | Target |
|---|---|---|
| `/pages/impressum` (+ `/en/`, `/pl/`) | Old handle, page no longer in Admin | `/policies/legal-notice` (matches footer + cookie banner) |
| `/pages/reparaturen-beschwerden` | Old page handle, returns 404 | `/pages/kontakt` |
| `/collections/windows-server` (+ locales) | Belt-and-suspenders for PR #98 mega-menu fix | `/collections/windows` |
| `/collections/microsoft-office-windows` | Collection renamed | `/collections/microsoft-office` |
| Luxury watches collections (herrenuhren, damenuhren, luxus-uhren, michael-kors-damenuhr, boss-uhren) | Legacy from previous business | Homepage `/` |
| Gaming / toys collections (playstation, playstation-5, xbox, games, controller, spielzeug) | Legacy from previous business | Homepage `/` |
| `adobe`, `antivirus` | Not currently sold | `/collections/all` |
| `black-friday`, `fruhlings-sale-1` | Expired promo collections | `/collections/sale` |
| Legacy product handles for Office 2021/2024 Mac | Handle changed in catalog | `/collections/microsoft-office-fur-mac` |
| `/products/office-2024-home-and-business-mac` (+ locales) | Doesn't exist; referenced in Theme Editor settings | `/collections/microsoft-office-fur-mac` |
| `/products/visual-studio-2026-professional-kaufen` (+ locales) | Not a published product; linked in Admin nav | `/collections/microsoft-tools` |
| `/products/windows-11-pro-key-kaufen`, `windows-11-home-key-kaufen`, …-pro-64-bit-oem-… | Old handles | `/collections/windows` |
| Locale-concat bug residue (`/enpages/`, `/plpages/`, `/svpages/`, `/enpolicies/`, …) | Already fixed structurally in PR #95–#97, but external sites / crawler caches keep hitting them | Correct locale-prefixed equivalents |

## After import

Re-run an Ahrefs site audit ~24h later. The top URLs from the May 14
report should all drop to **0 inlinks**.

## Notes

- Shopify URL redirects are **exact-match only** — no regex. That's
  why locale variants are listed individually.
- Don't add redirects for URLs you actually want crawled (avoid
  `/collections/all` → `/` etc.).
- If you later create the missing products/collections, just delete
  the matching row in **Admin → URL Redirects** before re-launching.
- Adding redirects does not back-fill internal site links. The
  underlying code fixes from PR #95–#98 already handle that.
