# Karinex Auto-Fix Scripts

## update-merchant-data.mjs

Bulk-updates **Vendor**, **Google product category**, and **GTIN-exempt flag** on
every product in the Shopify store — so Google Merchant Center accepts them
without "missing identifier / missing brand / missing category" errors.

### What it does
For every product:
1. Sets `product.vendor` based on title detection
   - "Microsoft Office 2024..." → `Microsoft`
   - "LEGO Star Wars..."        → `LEGO`
   - Watches (BOSS / Diesel / Daniel Wellington / Armani) → brand name
   - Antivirus (ESET / Kaspersky / Norton / Bitdefender) → brand
   - Fallback → `Karinex`
2. Sets metafield `mm-google-shopping.google_product_category` to a Google ID:
   - Operating Systems: `5299`
   - Antivirus: `5300`
   - Compilers / Dev tools: `5302`
   - Business & Productivity Software: `313`
   - Watches: `201`
   - LEGO / Building toys: `3287`
3. Sets `mm-google-shopping.custom_product = TRUE` (= "no GTIN/MPN", correct
   for software keys)
4. Sets `mm-google-shopping.condition = new`

Only writes fields that need changing — re-runs are idempotent.

### Requirements
- Node.js **18+** (uses built-in `fetch`, no `npm install` needed)
- Shopify Admin API access token with scopes:
  - `read_products`
  - `write_products`

### Get a token
1. Shopify Admin → **Settings** → **Apps and sales channels** → **Develop apps**
2. **Create an app** → name it `Karinex Auto-Fix`
3. **Configure Admin API scopes** → enable `read_products`, `write_products` → **Save**
4. **Install app** → copy the **Admin API access token** (starts with `shpat_`)

### Usage

```bash
# 1. Dry run — shows what WOULD change, writes nothing
SHOPIFY_TOKEN=shpat_xxx node scripts/update-merchant-data.mjs \
  --shop 45dv93-bk.myshopify.com

# 2. Live run — actually writes
SHOPIFY_TOKEN=shpat_xxx node scripts/update-merchant-data.mjs \
  --shop 45dv93-bk.myshopify.com --apply
```

Expected runtime for ~1100 products: **5-10 minutes** (paced at 4 req/s to
stay under Shopify's Admin API throttle).

### After it finishes
1. Open Google & YouTube app in Shopify → trigger a **manual sync**
   (or wait up to 24h for the next auto-sync)
2. In Merchant Center → **Products → Diagnostics** the error count should
   drop from ~81 to near zero.
3. After 3-7 days, more products start showing in Google Shopping with the
   green sale price and strike-through.

### Security
After running, **uninstall the custom app** in Shopify (Develop apps →
Karinex Auto-Fix → Uninstall) so the token is revoked.
