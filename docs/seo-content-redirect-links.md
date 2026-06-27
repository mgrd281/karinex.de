# Interne Redirect-Links in Inhalten — Korrekturliste

> Zweck: Ahrefs **"3XX redirect" / "Page has links to redirect"** Warnungen.
> Die *seitenweiten* Links (Footer/Wishlist/404) sind bereits im Theme korrigiert
> (PR „seo-fix-redirect-links"). Diese Liste deckt die restlichen Links ab, die
> **im Inhalt** von Blog-Artikeln / Seiten / Produkten stehen (Shopify Admin →
> Inhalt bzw. Produkt → „Code anzeigen `<>`" im Rich-Text-Editor).
>
> **Wichtig:** Das sind **301-Weiterleitungen** — sie sind *nicht schädlich*
> (volle SEO-Kraft wird übertragen, Besucher landen korrekt). Diese Korrektur
> entfernt nur den zusätzlichen „Sprung" und macht den Ahrefs-Report sauber.
> Stand der Daten: Ahrefs-Crawl 26.06.2026.

## Alte → neue Ziele (Suchen & Ersetzen)

Jeder Link links zeigt aktuell auf eine URL, die per 301 auf die rechte URL
weiterleitet. Im jeweiligen Artikel/Seiten-Body `href="…alt…"` durch
`href="…neu…"` ersetzen.

### Blog-Artikel-Links (Querverweise zwischen Artikeln)

| Alt (leitet weiter) | Neu (direktes Ziel) |
|---|---|
| `/blogs/news/office-2021-support-ende-oktober-2026` | `/blogs/news/office-2021-support-ende-jetzt-handeln` |
| `/blogs/news/office-2021-vs-2024-vergleich` | `/blogs/news/office-2021-vs-2024-welche-version-passt-zu-dir` |
| `/blogs/news/office-2024-home-vs-professional-plus-vergleich` | `/blogs/news/office-2024-home-vs-professional-plus-im-vergleich` |
| `/blogs/news/office-2024-mac-home-business-vs-standard` | `/blogs/news/office-2024-standard-die-unterschatzte-alternative` |
| `/blogs/news/office-2024-standard-unterschaetzte-alternative` | `/blogs/news/office-2024-standard-die-unterschatzte-alternative` |
| `/blogs/news/office-ltsc-2021-support-ende-2026` | `/blogs/news/office-ltsc-2021-lauft-aus-was-jetzt` |
| `/blogs/news/windows-11-home-vs-pro-unterschiede` | `/blogs/news/windows-11-home-oder-pro-die-ehrliche-entscheidung` |
| `/blogs/news/windows-11-mai-update-2026-kb5083631` | `/blogs/news/windows-11-mai-update-2026-was-sie-wissen-mussen` |
| `/blogs/news/windows-11-pro-vs-enterprise-vergleich` | `/blogs/news/windows-11-pro-vs-enterprise-die-richtige-wahl` |

### Collection-Links

| Alt (leitet weiter) | Neu (direktes Ziel) |
|---|---|
| `/collections/office` | `/collections/microsoft-office` |
| `/collections/office-2024` | `/collections/microsoft-office` |
| `/collections/office-2024-lizenzen` | `/collections/microsoft-office` |
| `/collections/software` | `/collections/microsoft-office` |
| `/collections/unsere-bestseller` | `/collections/bestseller` |
| `/collections/windows-11-lizenz` | `/collections/windows` |
| `/collections/windows-11-lizenz-kaufen` | `/collections/windows` |

### Seiten-/Produkt-Links

| Alt (leitet weiter) | Neu (direktes Ziel) |
|---|---|
| `/pages/datenschutz` | `/policies/privacy-policy` |
| `/pages/downloadsmicrosoft-office2024professionalpluswindows` | `/pages/office-2024-professional-plus-windows` |
| `/products/microsoft-office-2021-home-business-key-download` | `/collections/microsoft-office` |
| `/products/microsoft-windows-11-pro-64-bit-oem-lizenz-mit-dvd-und-produktschluessel` | `/collections/windows` |
| `/products/office-2024-home-and-business-mac` | `/collections/microsoft-office-fur-mac` |
| `/products/products-office-2021-professional-plus-1pc` | `/products/office-2021-professional-plus-1pc` |
| `/products/windows-11-home-key-kaufen` | `/collections/windows` |
| `/products/windows-11-pro` | `/products/windows-11-pro-key-kaufen-download` |
| `/products/windows-11-pro-key-kaufen` | `/collections/windows` |

### Nicht-www-Links (Domain-Weiterleitung)

Manche Links in Artikeln nutzen `https://karinex.de/…` (ohne `www`) — das leitet
per 301 auf `https://www.karinex.de/…` um. In diesen Fällen einfach `www.`
ergänzen, oder den Link relativ machen (`/products/…`).

## Quell-Seiten (wo die alten Links gefunden wurden)

Diese Artikel/Seiten enthalten mindestens einen der obigen Links:

**Blog-Artikel**
- `/blogs/news/office-2021-support-ende-jetzt-handeln`
- `/blogs/news/office-ltsc-2021-lauft-aus-was-jetzt`
- `/blogs/news/visual-studio-2022-pro-lohnt-sich-der-kauf`
- `/blogs/news/windows-11-home-oder-pro-die-ehrliche-entscheidung`
- `/blogs/news/windows-11-updates-pausieren-die-neuen-funktionen-2026`

**Seiten**
- `/pages/office-2021-vs-2024`
- `/pages/office-2024-kaufen`
- `/pages/office-2024-lizenz-kaufen`
- `/pages/office-2024-professional-plus-windows`
- `/pages/visual-studio-2026-installieren-anleitung`
- `/pages/widerrufsformular`
- `/pages/windows-11-installieren-anleitung`
- `/pages/windows-11-kaufen`
- `/pages/windows-11-key-kaufen`
- `/pages/windows-11-lizenz-kaufen`

**Produkte**
- `/products/office-2021-home-business-mac`
- `/products/office-2021-home-student`
- `/products/office-365-personal`
- `/products/windows-11-home-key`
