#!/usr/bin/env node
// Karinex: bulk-fix Vendor + Google product category + GTIN-exists on all products.
// Run:  SHOPIFY_TOKEN=shpat_xxx node scripts/update-merchant-data.mjs --shop 45dv93-bk.myshopify.com
// Add  --apply  to actually write changes (default is dry-run).

import { argv, env, exit } from 'node:process';

const args = Object.fromEntries(argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.replace(/^--/, ''), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]] : []).filter(Boolean));
const SHOP   = args.shop || env.SHOPIFY_SHOP;
const TOKEN  = env.SHOPIFY_TOKEN;
const APPLY  = !!args.apply;
const API    = '2025-01';

if (!SHOP || !TOKEN) {
  console.error('Need SHOPIFY_TOKEN env var and --shop <store>.myshopify.com');
  exit(1);
}

const ENDPOINT = `https://${SHOP}/admin/api/${API}/graphql.json`;

async function gql(query, variables = {}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (r.status === 429 || r.status >= 500) {
      const wait = 2 ** attempt * 500;
      console.warn(`  ↻ ${r.status} — retry in ${wait}ms`);
      await new Promise(res => setTimeout(res, wait));
      continue;
    }
    const j = await r.json();
    if (j.errors) throw new Error(JSON.stringify(j.errors));
    if (j.data && Object.values(j.data).some(v => v?.userErrors?.length)) {
      const errs = Object.values(j.data).flatMap(v => v?.userErrors || []);
      if (errs.length) throw new Error(JSON.stringify(errs));
    }
    return j.data;
  }
  throw new Error('GQL retries exhausted');
}

// ------- Detection rules ----------------------------------------------------

const MS_PATTERNS = /\b(office|word|excel|powerpoint|outlook|onenote|access|publisher|project|visio|onedrive|microsoft|windows|server|exchange|sharepoint|sql\s*server|visual\s*studio|defender|teams|skype)\b/i;
const WATCH_PATTERNS = /\b(uhr|watch|chrono|automatik|tissot|seiko|casio)\b/i;
const LEGO_PATTERN = /\blego\b/i;
const ANTIVIRUS_PATTERN = /\b(eset|kaspersky|norton|bitdefender|avast|avg|mcafee|antivirus|antiviren|sicherheit)\b/i;
const OS_PATTERN = /\bwindows\s*(11|10|8|7|server)\b/i;
const DEV_PATTERN = /\b(visual\s*studio|developer|programming|compiler)\b/i;

function detectVendor(title, currentVendor) {
  const v = (currentVendor || '').trim().toLowerCase();
  if (v && v !== 'unknown' && v !== 'unbekannt') return null; // keep existing
  if (LEGO_PATTERN.test(title))     return 'LEGO';
  if (/\bboss\b/i.test(title))       return 'BOSS';
  if (/\bdiesel\b/i.test(title))     return 'Diesel';
  if (/\barmani\b/i.test(title))     return 'Emporio Armani';
  if (/\bdaniel\s*wellington\b/i.test(title)) return 'Daniel Wellington';
  if (/\beset\b/i.test(title))       return 'ESET';
  if (/\bkaspersky\b/i.test(title))  return 'Kaspersky';
  if (/\bnorton\b/i.test(title))     return 'Norton';
  if (/\bbitdefender\b/i.test(title))return 'Bitdefender';
  if (MS_PATTERNS.test(title))       return 'Microsoft';
  return 'Karinex';
}

// Google Product Category IDs (https://support.google.com/merchants/answer/6324436)
function detectGoogleCategoryId(title) {
  if (LEGO_PATTERN.test(title))        return '3287';  // Toys > Building Toys
  if (WATCH_PATTERNS.test(title))      return '201';   // Apparel > Watches
  if (OS_PATTERN.test(title))          return '5299';  // Operating Systems
  if (ANTIVIRUS_PATTERN.test(title))   return '5300';  // Antivirus & Security Software
  if (DEV_PATTERN.test(title))         return '5302';  // Compilers & Programming Tools
  if (MS_PATTERNS.test(title))         return '313';   // Business & Productivity Software
  return '5298'; // Computer Software (general)
}

// ------- Iterate all products -----------------------------------------------

async function* allProducts() {
  let cursor = null;
  while (true) {
    const data = await gql(`
      query($cursor: String) {
        products(first: 100, after: $cursor) {
          edges {
            cursor
            node {
              id
              title
              vendor
              googleCategoryMf: metafield(namespace: "mm-google-shopping", key: "google_product_category") { id value }
              customProductMf: metafield(namespace: "mm-google-shopping", key: "custom_product") { id value }
              conditionMf: metafield(namespace: "mm-google-shopping", key: "condition") { id value }
            }
          }
          pageInfo { hasNextPage }
        }
      }
    `, { cursor });

    for (const e of data.products.edges) yield e.node;
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.edges.at(-1).cursor;
  }
}

// ------- Mutations ----------------------------------------------------------

async function updateProduct(id, fields) {
  await gql(`
    mutation($input: ProductInput!) {
      productUpdate(input: $input) {
        userErrors { field message }
      }
    }
  `, { input: { id, ...fields } });
}

async function setMetafields(productId, metafields) {
  await gql(`
    mutation($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }
  `, { metafields: metafields.map(m => ({ ownerId: productId, ...m })) });
}

// ------- Main ---------------------------------------------------------------

const stats = { scanned: 0, vendorFixed: 0, categorySet: 0, customProductSet: 0, conditionSet: 0, errors: 0 };

console.log(`\n${APPLY ? '🚀 LIVE RUN' : '🔍 DRY RUN'} — shop: ${SHOP}\n`);

for await (const p of allProducts()) {
  stats.scanned++;
  const updates = {};
  const metafields = [];

  // 1. Vendor
  const newVendor = detectVendor(p.title, p.vendor);
  if (newVendor && newVendor !== p.vendor) {
    updates.vendor = newVendor;
    stats.vendorFixed++;
  }

  // 2. Google product category
  const catId = detectGoogleCategoryId(p.title);
  if (!p.googleCategoryMf || p.googleCategoryMf.value !== catId) {
    metafields.push({ namespace: 'mm-google-shopping', key: 'google_product_category', type: 'single_line_text_field', value: catId });
    stats.categorySet++;
  }

  // 3. Identifier exists = NO (software keys have no GTIN/MPN)
  if (!p.customProductMf || p.customProductMf.value !== 'TRUE') {
    metafields.push({ namespace: 'mm-google-shopping', key: 'custom_product', type: 'single_line_text_field', value: 'TRUE' });
    stats.customProductSet++;
  }

  // 4. Condition = new
  if (!p.conditionMf || p.conditionMf.value !== 'new') {
    metafields.push({ namespace: 'mm-google-shopping', key: 'condition', type: 'single_line_text_field', value: 'new' });
    stats.conditionSet++;
  }

  const willChange = Object.keys(updates).length > 0 || metafields.length > 0;
  if (!willChange) continue;

  console.log(`[${stats.scanned}] ${p.title.slice(0, 60)}`);
  if (updates.vendor)            console.log(`   vendor: "${p.vendor || '(empty)'}" → "${updates.vendor}"`);
  if (metafields.length)         console.log(`   metafields: ${metafields.map(m => `${m.key}=${m.value}`).join(', ')}`);

  if (APPLY) {
    try {
      if (Object.keys(updates).length)  await updateProduct(p.id, updates);
      if (metafields.length)            await setMetafields(p.id, metafields);
    } catch (err) {
      stats.errors++;
      console.error(`   ✗ ${err.message.slice(0, 200)}`);
    }
  }

  // Stay polite on rate-limit (2 req/s default for Admin API)
  await new Promise(r => setTimeout(r, 250));
}

console.log(`\n=== SUMMARY ===`);
console.log(`Mode:           ${APPLY ? 'LIVE (changes written)' : 'DRY RUN (no writes)'}`);
console.log(`Products seen:  ${stats.scanned}`);
console.log(`Vendor fixed:   ${stats.vendorFixed}`);
console.log(`Category set:   ${stats.categorySet}`);
console.log(`No-GTIN flag:   ${stats.customProductSet}`);
console.log(`Condition set:  ${stats.conditionSet}`);
console.log(`Errors:         ${stats.errors}`);
if (!APPLY && (stats.vendorFixed + stats.categorySet + stats.customProductSet + stats.conditionSet > 0)) {
  console.log(`\n→ To apply, re-run with --apply flag.`);
}
