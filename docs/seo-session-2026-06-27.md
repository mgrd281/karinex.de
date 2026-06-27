# SEO-Session 2026-06-27 — Ahrefs-Cleanup, Schema, Bewertungssterne, Disavow

> Kontext-Log für KI-Assistenten & Contributors. Fasst die Arbeit vom
> 27.06.2026 zusammen, damit eine **spätere Konversation** den Stand kennt.
> Ergänzt `CLAUDE.md` (§18 Recent workstreams) und `docs/seo-backlink-plan.md`.

---

## 1. Ausgangslage

Der Händler ging die **Ahrefs Site-Audit-Warnungen** einzeln durch. Ergebnis
vorweg: **0 echte Errors**. Fast alle „Warnungen"/„Notices" sind beabsichtigtes
oder harmloses Shopify-/Theme-Verhalten. Die wenigen echten Code-Fixes wurden
gemerged (siehe §2). Der eigentliche Wachstumshebel bleibt **Authority/Backlinks**
(`docs/seo-backlink-plan.md`), nicht Technik.

## 2. Gemergte PRs (27.06.2026)

| PR | Inhalt |
|---|---|
| #352 | `perf(theme)`: preconnect/dns-prefetch zu `cdnjs.cloudflare.com` (Font Awesome schneller; **nicht** async — würde Icon-Sprung auf Mobile verursachen) |
| #353 | `fix(seo)`: `Disallow: /account` in `templates/robots.txt.liquid`. Killt ~85 % der „Page has links to redirect / 3XX / 302 / noindex / nofollow"-Warnungen (alle = Shopify Account-/Login-Links, intrinsisch, harmlos). `/customer_authentication/` war schon disallowed |
| #354 | `fix(seo)`: Theme-Links `/collections/unsere-bestseller` → `/collections/bestseller` (wishlist, 404). + `docs/seo-content-redirect-links.md` (vollständige Liste der internen Redirect-Links in Inhalten) |
| #355 | `feat(seo)`: `aggregateRating` in `snippets/product-rich-schema.liquid` (Product + SoftwareApplication), gated auf Metafields `karinex.review_rating` + `karinex.review_count`. **Ohne Daten → kein Output** (keine Fake-Sterne) |
| #356 | `fix(seo)`: `priceSpecification`-Array aus dem Offer entfernt (Google flaggte „Ungültiger Objekttyp", non-critical). `price` reicht |

## 3. Ahrefs-Warnungen — Bewertung (alle geprüft)

| Warnung | Befund / Aktion |
|---|---|
| Noindex / Nofollow page | Shopify Login-/Account-Seiten + `/policies/*` + `/collections/all`. Korrekt noindex. robots `/account` (#353) reduziert |
| Page has links to redirect / 3XX / 302 redirect | ~85 % = Account-/Login-Links (#353). Rest = interne 301s zu alten Handles → Theme-Teil in #354, Content-Teil in `docs/seo-content-redirect-links.md` (3 Artikel per API gefixt, Rest dokumentiert) |
| Slow page | Kein echtes Problem (TTFB ~10 ms). #352 als kleiner Win |
| CSS file size too large | `compiled_assets/styles.css` ~57 KB (≈12 KB gzip, 20 ms). Shopify-auto-generiert. Ignorieren |
| Missing alt text | Tracking-Pixel `invoice-production-8cd6…/api/ai/track` aus Artikel `windows-11-update-strategien` entfernt (via Admin API) |
| Multiple H1 tags | Notice. Google: kein Ranking-Problem. 2. H1 = SEO-Text in Collection-/Produkt-Daten. Theme konvertiert Description-H1→H2 bereits teilweise. Nicht weiterverfolgt |
| Structured data validation error | **Eigentlich non-critical**: nur `review`/`aggregateRating` (optional) fehlten + `priceSpecification`. Gelöst via #355 + #356 + Review-Sync (§4) |

### Content-Edits per Shopify Admin API (Blog-Redirect-Links)
Byte-genau gefixt (verifiziert): `office-2024-guenstig-kaufen`,
`office-2024-vs-office-365-vergleich`, `office-ltsc-2021-lauft-aus-was-jetzt`.
**12 weitere Artikel** mit alten internen Links sind in
`docs/seo-content-redirect-links.md` gelistet (harmlose 301s, optional).

## 4. Bewertungssterne in Google (Review → Schema → Stars) ✅ LIVE

**Architektur (wichtig für später):**
```
Review-Backend (mgrd281/invoice, PostgreSQL/Prisma auf Railway)
   → schreibt pro Produkt 2 Shopify-Metafields via Admin API:
        karinex.review_rating  (number_decimal, z. B. "4.8")
        karinex.review_count   (number_integer, z. B. "513")
   → Theme liest sie in snippets/product-rich-schema.liquid (#355)
   → JSON-LD aggregateRating → Google zeigt Sterne
```
- Das On-Page-Widget (`review-widget.js`, `.rechnung-profi-stars`) rendert Sterne
  **client-seitig** — reicht **nicht** für Google. Server-seitige Metafields sind
  der Schlüssel.
- **Bestätigt funktionierend** (27.06.): `windows-11-pro-key-kaufen-download`
  (5.0 / 504), `office-2021-professional-plus-1pc` (5.0 / 513). Google Rich
  Results Test: „Rezensions-Snippets — gültig, Rich-Suchergebnisse möglich".
- Backend-Snippet (metafieldsSet) liegt im Chatverlauf; gehört in
  `mgrd281/invoice` (separates Repo), nicht ins Theme.

**Don't:** in `product-rich-schema.liquid` keine festen/Fake-`aggregateRating`
hardcoden — nur aus den Metafields (sonst Google-Penalty-Risiko).

## 5. Disavow (toxische Backlinks) — vom Händler ausgeführt

Ahrefs zeigte mehrere **SPAM-Backlinks**. In Google Search Console disavowed
(Property `https://www.karinex.de/`, 27.06.2026, 8 Domains):
```
seolinkkart.shop, backlinkorbit.shop, rankdepot.shop, rankmall.shop,
primebacklinks.shop, linkwares.shop, meta-preisvergleich.de, newsblogsports.site
```
- Disavow-Tool unterstützt **keine Domain-Property** → URL-Prefix `www` genutzt.
- Non-www `https://karinex.de/` hat eine separate ältere Disavow-Datei (1 Domain).
  Optional dort spiegeln (gleiche Datei via „Ersetzen").
- „Referring domains 3 → 0" war **normale Ahrefs-Recrawl-Fluktuation**, kein Bug.

## 6. Offene / optionale Punkte

- [ ] (Optional) Disavow-Datei auch auf non-www `https://karinex.de/` spiegeln.
- [ ] (Optional) 12 Content-Redirect-Links aus `docs/seo-content-redirect-links.md`
      in den Artikel-Bodies fixen (harmlose 301s).
- [ ] (Backend) Review-Sync auf **alle** Produkte ausrollen (Backfill), damit
      mehr Produkte Sterne bekommen.
- [ ] (Wachstum) `docs/seo-backlink-plan.md` abarbeiten (Trustpilot, DE-Verzeichnisse).
- DR = ~0.4, ~22 Ref-Domains, ~273 organischer Traffic/Monat → Authority ist der
  Hebel, nicht Technik.

## 7. Don'ts (damit später nichts zurückgedreht wird)

- `Disallow: /account` **nicht** aus robots.txt entfernen (#353).
- Kein manueller/Fake-`aggregateRating` im Schema (nur Metafields, #355).
- `priceSpecification` **nicht** wieder einbauen (#356).
- Font Awesome **nicht** async machen (Icon-Sprung, siehe Kommentar in
  `layout/theme.liquid`).
