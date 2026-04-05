/* ================================================================
   KARINEX - Referral Discount Code Generator
   Google Apps Script Web App

   WHAT IT DOES:
   - Receives email + referrer code from the referral popup
   - Creates a unique 10% discount code via Shopify Admin API
   - Subscribes the email to the newsletter with referral tags
   - Returns the unique discount code to the frontend
   - Logs everything in a Google Sheet for tracking

   DEPLOY STEPS:
   1. Open https://script.google.com and create a new project.
   2. Paste this file in Code.gs.
   3. Go to Project Settings → Script Properties:
      - Add: SHOPIFY_ADMIN_TOKEN = your Admin API access token
   4. Deploy → New deployment → Type: Web app.
   5. Execute as: Me.
   6. Who has access: Anyone.
   7. Copy the Web App URL into referral-popup.liquid (REFERRAL_API_URL).

   SHOPIFY ADMIN API TOKEN:
   - Go to Shopify Admin → Settings → Apps → Develop apps
   - Create app → Configure Admin API scopes:
     ✓ write_discounts, read_discounts
     ✓ write_customers, read_customers
   - Install app → Copy Admin API access token
   ================================================================ */

var SHOPIFY_SHOP_DOMAIN = '45dv93-bk.myshopify.com';
var SHOPIFY_API_VERSION = '2025-10';
var SHEET_NAME = 'ReferralCodes';
var DISCOUNT_PERCENT = 10;
var DISCOUNT_USAGE_LIMIT = 1; /* Each code works once */

function getAdminToken_() {
  return PropertiesService.getScriptProperties().getProperty('SHOPIFY_ADMIN_TOKEN') || '';
}

/* ─── CORS + Entry Points ─── */

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);
    var action = String(data.action || 'create_code').trim().toLowerCase();

    if (action === 'create_code') {
      return handleCreateCode_(data);
    }

    return cors_(asJson_({ ok: false, error: 'unsupported_action' }));
  } catch (err) {
    return cors_(asJson_({ ok: false, error: err.message }));
  }
}

function doGet(e) {
  return cors_(asJson_({ ok: true, service: 'karinex-referral', version: '1.0' }));
}

/* ─── Main Handler ─── */

function handleCreateCode_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var refCode = String(data.ref || 'direct').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return cors_(asJson_({ ok: false, error: 'invalid_email' }));
  }

  /* Check if this email already got a code */
  var existing = findExistingCode_(email);
  if (existing) {
    return cors_(asJson_({ ok: true, code: existing, existing: true }));
  }

  /* Generate unique code */
  var code = generateCode_();

  /* Create discount in Shopify */
  var shopifyResult = createShopifyDiscount_(code);
  if (!shopifyResult.ok) {
    return cors_(asJson_({ ok: false, error: 'shopify_error', detail: shopifyResult.error }));
  }

  /* Subscribe email as customer with tags */
  tagCustomer_(email, refCode, code);

  /* Log to sheet */
  logToSheet_(email, refCode, code);

  return cors_(asJson_({ ok: true, code: code }));
}

/* ─── Shopify Discount Creation ─── */

function createShopifyDiscount_(code) {
  var token = getAdminToken_();
  if (!token) {
    return { ok: false, error: 'no_admin_token' };
  }

  var url = 'https://' + SHOPIFY_SHOP_DOMAIN + '/admin/api/' + SHOPIFY_API_VERSION + '/graphql.json';

  var mutation = 'mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {'
    + ' discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {'
    + '   codeDiscountNode { id codeDiscount { ... on DiscountCodeBasic { codes(first:1) { nodes { code } } } } }'
    + '   userErrors { field message }'
    + ' }'
    + '}';

  var now = new Date().toISOString();
  var variables = {
    basicCodeDiscount: {
      title: 'Referral ' + code,
      code: code,
      startsAt: now,
      usageLimit: DISCOUNT_USAGE_LIMIT,
      appliesOncePerCustomer: true,
      customerSelection: {
        all: true
      },
      customerGets: {
        value: {
          percentage: DISCOUNT_PERCENT / 100
        },
        items: {
          all: true
        }
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
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      payload: JSON.stringify({ query: mutation, variables: variables }),
      muteHttpExceptions: true
    });

    var result = JSON.parse(response.getContentText());

    if (result.data && result.data.discountCodeBasicCreate) {
      var errors = result.data.discountCodeBasicCreate.userErrors;
      if (errors && errors.length > 0) {
        return { ok: false, error: errors[0].message };
      }
      return { ok: true };
    }

    if (result.errors) {
      return { ok: false, error: result.errors[0].message };
    }

    return { ok: false, error: 'unexpected_response' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ─── Customer Tagging ─── */

function tagCustomer_(email, refCode, discountCode) {
  var token = getAdminToken_();
  if (!token) return;

  var url = 'https://' + SHOPIFY_SHOP_DOMAIN + '/admin/api/' + SHOPIFY_API_VERSION + '/graphql.json';

  /* First find existing customer */
  var searchQuery = 'query { customers(first: 1, query: "email:' + email + '") { nodes { id tags } } }';

  try {
    var searchResp = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      payload: JSON.stringify({ query: searchQuery }),
      muteHttpExceptions: true
    });
    var searchResult = JSON.parse(searchResp.getContentText());
    var customers = searchResult.data && searchResult.data.customers && searchResult.data.customers.nodes;

    if (customers && customers.length > 0) {
      /* Update existing customer tags */
      var customerId = customers[0].id;
      var existingTags = customers[0].tags || [];
      var newTags = existingTags.concat(['referral', 'ref_' + refCode, discountCode]);
      var unique = newTags.filter(function(t, i, a) { return a.indexOf(t) === i; });

      var updateMutation = 'mutation { customerUpdate(input: { id: "' + customerId + '", tags: ' + JSON.stringify(unique) + ' }) { userErrors { message } } }';
      UrlFetchApp.fetch(url, {
        method: 'post',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
        payload: JSON.stringify({ query: updateMutation }),
        muteHttpExceptions: true
      });
    }
    /* If no customer found, the /contact form submission from the popup will create one */
  } catch (err) {
    Logger.log('tagCustomer_ error: ' + err.message);
  }
}

/* ─── Sheet Logging ─── */

function findExistingCode_(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return null;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === email) {
      return String(data[i][2]);
    }
  }
  return null;
}

function logToSheet_(email, refCode, discountCode) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, 5).setValues([['Datum', 'Email', 'Code', 'Referrer', 'Eingelöst']]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    email,
    discountCode,
    refCode,
    'Nein'
  ]);
}

/* ─── Code Generation ─── */

function generateCode_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var prefix = 'KX-';
  var code = '';
  for (var i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + code;
}

/* ─── Utilities ─── */

function asJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function cors_(output) {
  /* GAS web apps handle CORS automatically for deployed scripts */
  return output;
}
