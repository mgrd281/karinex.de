#!/usr/bin/env node
// Karinex: rewrite non-www links (http(s)://karinex.de/...) to the canonical
// www domain inside ALL blog article bodies + summaries.
//
// Why: Ahrefs "Page has links to redirect" — the auto-generated
// "Im Artikel empfohlen" product-CTA boxes link to https://karinex.de/products/…
// (non-www), which 301-redirects to https://www.karinex.de/…. This removes that
// extra hop. Idempotent: only articles that actually contain a non-www link are
// updated, so it is safe to re-run.
//
// Run (dry-run, shows what WOULD change):
//   SHOPIFY_TOKEN=shpat_xxx node scripts/fix-article-nonwww-links.mjs --shop 45dv93-bk.myshopify.com
// Add --apply to actually write:
//   SHOPIFY_TOKEN=shpat_xxx node scripts/fix-article-nonwww-links.mjs --shop 45dv93-bk.myshopify.com --apply

import { argv, env, exit } from 'node:process';

const args = Object.fromEntries(argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.replace(/^--/, ''), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]] : []).filter(Boolean));
const SHOP  = args.shop || env.SHOPIFY_SHOP;
const TOKEN = env.SHOPIFY_TOKEN;
const APPLY = !!args.apply;
const API   = '2025-01';

if (!SHOP || !TOKEN) {
  console.error('Need SHOPIFY_TOKEN env var and --shop <store>.myshopify.com');
  exit(1);
}

const ENDPOINT = `https://${SHOP}/admin/api/${API}/graphql.json`;

async function gql(query, variables = {}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
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
      throw new Error(JSON.stringify(Object.values(j.data).flatMap(v => v?.userErrors || [])));
    }
    return j.data;
  }
  throw new Error('gql: exhausted retries');
}

// Replace any non-www karinex.de origin with the canonical www origin.
// Covers http:// and https://, with or without www already (no-op if www).
function fixLinks(html) {
  if (!html) return html;
  return html
    .replace(/https?:\/\/karinex\.de/g, 'https://www.karinex.de');
}

const LIST = `
  query($cursor: String) {
    articles(first: 50, after: $cursor) {
      edges { node { id handle title body summary } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

const UPDATE = `
  mutation($id: ID!, $article: ArticleUpdateInput!) {
    articleUpdate(id: $id, article: $article) {
      article { id }
      userErrors { field message }
    }
  }`;

let cursor = null, scanned = 0, changed = 0;
do {
  const data = await gql(LIST, { cursor });
  const conn = data.articles;
  for (const { node } of conn.edges) {
    scanned++;
    const newBody = fixLinks(node.body);
    const newSummary = fixLinks(node.summary);
    const bodyChanged = newBody !== node.body;
    const summaryChanged = newSummary !== node.summary;
    if (!bodyChanged && !summaryChanged) continue;
    changed++;
    const bodyHits = (node.body || '').match(/https?:\/\/karinex\.de/g)?.length || 0;
    const sumHits = (node.summary || '').match(/https?:\/\/karinex\.de/g)?.length || 0;
    console.log(`${APPLY ? 'FIX ' : 'DRY '} ${node.handle}  (body: ${bodyHits} non-www link(s), summary: ${sumHits})`);
    if (APPLY) {
      const input = {};
      if (bodyChanged) input.body = newBody;
      if (summaryChanged) input.summary = newSummary;
      await gql(UPDATE, { id: node.id, article: input });
    }
  }
  cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
} while (cursor);

console.log(`\n${APPLY ? 'Updated' : 'Would update'} ${changed} of ${scanned} articles.`);
if (!APPLY) console.log('Dry-run only. Re-run with --apply to write changes.');
