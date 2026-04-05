/* ================================================================
   KARINEX - Referral Discount Code Generator
   Google Apps Script Web App — Standalone (no bound Sheet needed)

   DEPLOY: script.google.com → New project → paste → Deploy as Web App
   ================================================================ */

var SHOPIFY_SHOP_DOMAIN = '45dv93-bk.myshopify.com';
var SHOPIFY_API_VERSION = '2025-10';
var SHEET_NAME = 'ReferralCodes';
var DISCOUNT_PERCENT = 10;
var DISCOUNT_USAGE_LIMIT = 1;

/* Token is stored in GAS Script Properties, NOT in code.
   In GAS: Project Settings → Script Properties → SHOPIFY_ADMIN_TOKEN */
function getToken_() {
  return PropertiesService.getScriptProperties().getProperty('SHOPIFY_ADMIN_TOKEN') || '';
}

/* ─── Entry Points ─── */

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);
    var action = String(data.action || 'create_code').trim().toLowerCase();
    if (action === 'create_code') return handleCreateCode_(data);
    return asJson_({ ok: false, error: 'unsupported_action' });
  } catch (err) {
    return asJson_({ ok: false, error: err.message });
  }
}

function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  var action = String(p.action || '').trim().toLowerCase();
  if (action === 'create_code' && p.email) {
    return handleCreateCode_({ email: p.email, ref: p.ref || 'direct' });
  }
  return asJson_({ ok: true, service: 'karinex-referral', version: '1.0' });
}

/* ─── Main Handler ─── */

function handleCreateCode_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var refCode = String(data.ref || 'direct').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return asJson_({ ok: false, error: 'invalid_email' });
  }

  /* Check if this email already got a code (via Script Properties) */
  var existing = findExistingCode_(email);
  if (existing) {
    return asJson_({ ok: true, code: existing, existing: true });
  }

  /* Generate unique code */
  var code = generateCode_();

  /* Create discount in Shopify */
  var shopifyResult = createShopifyDiscount_(code);
  if (!shopifyResult.ok) {
    return asJson_({ ok: false, error: 'shopify_error', detail: shopifyResult.error });
  }

  /* Save email→code mapping */
  saveCode_(email, code, refCode);

  /* Tag customer in Shopify (non-blocking) */
  try { tagCustomer_(email, refCode, code); } catch(e) {}

  /* Log to sheet (non-blocking) */
  try { logToSheet_(email, refCode, code); } catch(e) {}

  return asJson_({ ok: true, code: code });
}

/* ─── Shopify Discount Creation ─── */

function createShopifyDiscount_(code) {
  var url = 'https://' + SHOPIFY_SHOP_DOMAIN + '/admin/api/' + SHOPIFY_API_VERSION + '/graphql.json';

  var mutation = 'mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {'
    + ' discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {'
    + '   codeDiscountNode { id }'
    + '   userErrors { field message }'
    + ' }'
    + '}';

  var variables = {
    basicCodeDiscount: {
      title: 'Referral ' + code,
      code: code,
      startsAt: new Date().toISOString(),
      usageLimit: DISCOUNT_USAGE_LIMIT,
      appliesOncePerCustomer: true,
      customerSelection: { all: true },
      customerGets: {
        value: { percentage: DISCOUNT_PERCENT / 100 },
        items: { all: true }
      },
      combinesWith: {
        orderDiscounts: false,
        productDiscounts: false,
        shippingDiscounts: true
      }
    }
  };

  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': getToken_() },
      payload: JSON.stringify({ query: mutation, variables: variables }),
      muteHttpExceptions: true
    });
    var result = JSON.parse(response.getContentText());

    if (result.data && result.data.discountCodeBasicCreate) {
      var errors = result.data.discountCodeBasicCreate.userErrors;
      if (errors && errors.length > 0) return { ok: false, error: errors[0].message };
      return { ok: true };
    }
    if (result.errors) return { ok: false, error: result.errors[0].message };
    return { ok: false, error: 'unexpected_response' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ─── Customer Tagging ─── */

function tagCustomer_(email, refCode, discountCode) {
  var url = 'https://' + SHOPIFY_SHOP_DOMAIN + '/admin/api/' + SHOPIFY_API_VERSION + '/graphql.json';
  var searchQuery = '{ customers(first: 1, query: "email:' + email + '") { nodes { id tags } } }';

  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': getToken_() },
    payload: JSON.stringify({ query: searchQuery }),
    muteHttpExceptions: true
  });
  var result = JSON.parse(resp.getContentText());
  var customers = result.data && result.data.customers && result.data.customers.nodes;

  if (customers && customers.length > 0) {
    var id = customers[0].id;
    var tags = (customers[0].tags || []).concat(['referral', 'ref_' + refCode, discountCode]);
    var unique = tags.filter(function(t, i, a) { return a.indexOf(t) === i; });
    var mut = 'mutation { customerUpdate(input: { id: "' + id + '", tags: ' + JSON.stringify(unique) + ' }) { userErrors { message } } }';
    UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': getToken_() },
      payload: JSON.stringify({ query: mut }),
      muteHttpExceptions: true
    });
  }
}

/* ─── Storage: Script Properties (works without bound Sheet) ─── */

function findExistingCode_(email) {
  var props = PropertiesService.getScriptProperties();
  var code = props.getProperty('ref_' + email);
  return code || null;
}

function saveCode_(email, code, refCode) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('ref_' + email, code);
}

/* ─── Optional Sheet Logging (auto-creates if needed) ─── */

function getOrCreateSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID');

  if (sheetId) {
    try {
      var ss = SpreadsheetApp.openById(sheetId);
      return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    } catch(e) { /* Sheet deleted, create new */ }
  }

  /* Create a new spreadsheet */
  var ss = SpreadsheetApp.create('Karinex Referral Codes');
  props.setProperty('SHEET_ID', ss.getId());
  var sheet = ss.getActiveSheet();
  sheet.setName(SHEET_NAME);
  sheet.getRange(1, 1, 1, 5).setValues([['Datum', 'Email', 'Code', 'Referrer', 'Eingelöst']]);
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function logToSheet_(email, refCode, discountCode) {
  var sheet = getOrCreateSheet_();
  sheet.appendRow([new Date(), email, discountCode, refCode, 'Nein']);
}

/* ─── Code Generation ─── */

function generateCode_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = 'KX-';
  for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

/* ─── Utilities ─── */

function asJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
