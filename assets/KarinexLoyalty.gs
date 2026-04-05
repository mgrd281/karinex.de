/* ================================================================
   KARINEX — Loyalty & Referral System (Combined)
   Google Apps Script Web App

   Features:
   - Referral code generation (10% discount for referred friends)
   - Loyalty points tracking (cashback on every order)
   - VIP tier management (Bronze / Silber / Gold)
   - Referrer bonus (500 points when friend buys with KX-code)
   - Customer metafield updates (visible in Shopify account)
   - Automatic order polling (every 15 min)

   SETUP:
   1. Paste this code in your existing GAS project (replace old code)
   2. Set Script Property: SHOPIFY_ADMIN_TOKEN
      → Project Settings → Script Properties → Add property
   3. Run setupTrigger() once from GAS editor (Run → setupTrigger)
   4. Run setupMetafields() once from GAS editor (Run → setupMetafields)
   5. Update deployment → Neue Version → Bereitstellen
   ================================================================ */

/* ─── Configuration ─── */

var SHOP_DOMAIN       = '45dv93-bk.myshopify.com';
var API_VERSION       = '2025-10';
var DISCOUNT_PERCENT  = 10;   // Referral discount for new customer
var DISCOUNT_USAGE    = 1;    // Each referral code: single use
var REFERRAL_BONUS    = 500;  // Points for referrer when friend buys
var POINTS_PER_EURO   = 100;  // 100 points = €1

/* Tier definitions — ordered from highest to lowest */
var TIERS = [
  { name: 'gold',   min: 20000, cashback: 10 },
  { name: 'silber', min: 8000,  cashback: 7  },
  { name: 'bronze', min: 0,     cashback: 5  }
];

/* Token from Script Properties (never hardcode in repo) */
function getToken_() {
  return PropertiesService.getScriptProperties().getProperty('SHOPIFY_ADMIN_TOKEN') || '';
}

/* ═══════════════════════════════════════════════════════
   ENTRY POINTS
   ═══════════════════════════════════════════════════════ */

function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  var action = String(p.action || '').trim().toLowerCase();

  try {
    switch (action) {
      case 'create_code':
        if (!p.email) return asJson_({ ok: false, error: 'missing_email' });
        return handleCreateCode_({ email: p.email, ref: p.ref || 'direct' });

      case 'get_points':
        if (p.customer_id) return handleGetPoints_(p.customer_id);
        if (p.email) return handleGetPointsByEmail_(p.email);
        return asJson_({ ok: false, error: 'missing_identifier' });

      default:
        return asJson_({ ok: true, service: 'karinex-loyalty', version: '2.0' });
    }
  } catch (err) {
    return asJson_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    /* Detect Shopify order webhook (has order_number field) */
    if (data.order_number || (data.id && data.line_items)) {
      return processOrder_(data);
    }

    /* Otherwise: referral API call */
    var action = String(data.action || 'create_code').trim().toLowerCase();
    if (action === 'create_code') return handleCreateCode_(data);

    return asJson_({ ok: false, error: 'unsupported_action' });
  } catch (err) {
    return asJson_({ ok: false, error: err.message });
  }
}

/* ═══════════════════════════════════════════════════════
   ORDER PROCESSING (called by polling trigger)
   ═══════════════════════════════════════════════════════ */

function checkNewOrders() {
  var props = PropertiesService.getScriptProperties();
  var lastCheck = props.getProperty('LAST_ORDER_CHECK');
  if (!lastCheck) lastCheck = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  var url = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/orders.json'
    + '?status=any&financial_status=paid'
    + '&updated_at_min=' + encodeURIComponent(lastCheck)
    + '&limit=250&fields=id,name,order_number,email,subtotal_price,total_price,customer,discount_codes';

  try {
    var resp = UrlFetchApp.fetch(url, {
      headers: { 'X-Shopify-Access-Token': getToken_() },
      muteHttpExceptions: true
    });
    var result = JSON.parse(resp.getContentText());
    var orders = result.orders || [];

    for (var i = 0; i < orders.length; i++) {
      var oid = String(orders[i].id);
      if (props.getProperty('processed_' + oid)) continue;
      processOrder_(orders[i]);
      props.setProperty('processed_' + oid, '1');
    }
  } catch (err) {
    Logger.log('checkNewOrders error: ' + err.message);
  }

  props.setProperty('LAST_ORDER_CHECK', new Date().toISOString());
}

function processOrder_(order) {
  var email = String(order.email || '').trim().toLowerCase();
  if (!email) return asJson_({ ok: false, error: 'no_email' });

  var subtotal   = parseFloat(order.subtotal_price || order.total_price || 0);
  var customerId = (order.customer && order.customer.id) ? String(order.customer.id) : '';
  var orderName  = order.name || '#' + order.order_number;

  /* 1. Calculate cashback points based on current tier */
  var data = getCustomerData_(email);
  var tier = getTier_(data.points);
  var earned = Math.round(subtotal * POINTS_PER_EURO * (tier.cashback / 100));

  if (earned > 0) {
    addPoints_(email, earned, 'Bestellung ' + orderName + ' (' + tier.cashback + '% Cashback)', customerId);
  }

  /* 2. Check for referral discount code → credit referrer */
  var codes = order.discount_codes || [];
  for (var i = 0; i < codes.length; i++) {
    var code = String(codes[i].code || '').toUpperCase();
    if (code.indexOf('KX-') === 0) {
      creditReferrer_(code, email, orderName);
      break;
    }
  }

  /* 3. Update Shopify customer metafields */
  if (customerId) {
    var newData = getCustomerData_(email);
    var newTier = getTier_(newData.points);
    updateCustomerMetafields_(customerId, newData.points, newTier.name);

    /* Update customer tags with tier */
    try { updateCustomerTierTag_(customerId, newTier.name); } catch(e) {}
  }

  return asJson_({ ok: true, points: earned, order: orderName });
}

/* ═══════════════════════════════════════════════════════
   REFERRAL: Code Creation
   ═══════════════════════════════════════════════════════ */

function handleCreateCode_(data) {
  var email   = String(data.email || '').trim().toLowerCase();
  var refCode = String(data.ref || 'direct').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return asJson_({ ok: false, error: 'invalid_email' });
  }

  /* De-duplicate: email already has a code */
  var existing = findExistingCode_(email);
  if (existing) return asJson_({ ok: true, code: existing, existing: true });

  /* Generate & create in Shopify */
  var code = generateCode_('KX-');
  var result = createShopifyPercentDiscount_(code, DISCOUNT_PERCENT, DISCOUNT_USAGE);
  if (!result.ok) return asJson_({ ok: false, error: 'shopify_error', detail: result.error });

  /* Save mappings */
  saveCode_(email, code, refCode);

  /* Tag customer (if exists) */
  try { tagCustomer_(email, refCode, code); } catch(e) {}

  /* Log to sheet */
  try { logReferralToSheet_(email, refCode, code); } catch(e) {}

  return asJson_({ ok: true, code: code });
}

/* ═══════════════════════════════════════════════════════
   REFERRAL: Credit Referrer
   ═══════════════════════════════════════════════════════ */

function creditReferrer_(discountCode, buyerEmail, orderName) {
  var props = PropertiesService.getScriptProperties();

  /* Already credited? */
  if (props.getProperty('credited_' + discountCode)) return;

  /* Look up who referred this code */
  var meta = props.getProperty('code_meta_' + discountCode);
  if (!meta) return;

  try {
    var info = JSON.parse(meta);
    var referrerId = info.ref; // Shopify customer ID of referrer

    if (!referrerId || referrerId === 'direct') return;

    /* Resolve referrer email */
    var referrerEmail = '';
    if (/^\d+$/.test(referrerId)) {
      referrerEmail = getCustomerEmailById_(referrerId);
    }
    if (!referrerEmail) return;

    /* Credit bonus points */
    props.setProperty('credited_' + discountCode, '1');
    addPoints_(referrerEmail, REFERRAL_BONUS, 'Empfehlung: ' + buyerEmail + ' (' + orderName + ')', referrerId);

    /* Update referrer's metafields */
    var newData = getCustomerData_(referrerEmail);
    var newTier = getTier_(newData.points);
    updateCustomerMetafields_(referrerId, newData.points, newTier.name);

    Logger.log('Credited ' + REFERRAL_BONUS + ' pts to referrer ' + referrerEmail);
  } catch(e) {
    Logger.log('creditReferrer_ error: ' + e.message);
  }
}

/* ═══════════════════════════════════════════════════════
   LOYALTY: Get Points API
   ═══════════════════════════════════════════════════════ */

function handleGetPoints_(customerId) {
  var email = getCustomerEmailById_(customerId);
  if (!email) return asJson_({ ok: false, error: 'customer_not_found' });
  return handleGetPointsByEmail_(email);
}

function handleGetPointsByEmail_(email) {
  email = String(email).trim().toLowerCase();
  var data = getCustomerData_(email);
  var tier = getTier_(data.points);
  var next = getNextTier_(data.points);

  return asJson_({
    ok: true,
    email: email,
    points: data.points,
    tier: tier.name,
    cashback: tier.cashback,
    next_tier: next ? next.name : null,
    points_to_next: next ? next.min - data.points : 0
  });
}

/* ═══════════════════════════════════════════════════════
   TIER LOGIC
   ═══════════════════════════════════════════════════════ */

function getTier_(points) {
  for (var i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].min) return TIERS[i];
  }
  return TIERS[TIERS.length - 1];
}

function getNextTier_(points) {
  var current = getTier_(points);
  for (var i = TIERS.length - 1; i >= 0; i--) {
    if (TIERS[i].min > current.min && points < TIERS[i].min) return TIERS[i];
  }
  return null;
}

/* ═══════════════════════════════════════════════════════
   SHOPIFY: GraphQL Helper
   ═══════════════════════════════════════════════════════ */

function shopifyGQL_(query, variables) {
  var url = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/graphql.json';
  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': getToken_() },
      payload: JSON.stringify({ query: query, variables: variables || {} }),
      muteHttpExceptions: true
    });
    return JSON.parse(resp.getContentText());
  } catch (err) {
    return { errors: [{ message: err.message }] };
  }
}

/* ═══════════════════════════════════════════════════════
   SHOPIFY: Discount Creation
   ═══════════════════════════════════════════════════════ */

function createShopifyPercentDiscount_(code, percent, usageLimit) {
  var mutation = 'mutation discountCodeBasicCreate($d: DiscountCodeBasicInput!) {'
    + ' discountCodeBasicCreate(basicCodeDiscount: $d) {'
    + '   codeDiscountNode { id } userErrors { field message }'
    + ' } }';

  var variables = {
    d: {
      title: 'Referral ' + code, code: code,
      startsAt: new Date().toISOString(),
      usageLimit: usageLimit,
      appliesOncePerCustomer: true,
      customerSelection: { all: true },
      customerGets: {
        value: { percentage: percent / 100 },
        items: { all: true }
      },
      combinesWith: { orderDiscounts: false, productDiscounts: false, shippingDiscounts: true }
    }
  };

  var result = shopifyGQL_(mutation, variables);
  if (result.data && result.data.discountCodeBasicCreate) {
    var errs = result.data.discountCodeBasicCreate.userErrors;
    if (errs && errs.length) return { ok: false, error: errs[0].message };
    return { ok: true };
  }
  if (result.errors) return { ok: false, error: result.errors[0].message };
  return { ok: false, error: 'unexpected_response' };
}

/* ═══════════════════════════════════════════════════════
   SHOPIFY: Customer Operations
   ═══════════════════════════════════════════════════════ */

function tagCustomer_(email, refCode, discountCode) {
  var q = '{ customers(first:1, query:"email:' + email + '") { nodes { id tags } } }';
  var result = shopifyGQL_(q);
  var nodes = result.data && result.data.customers && result.data.customers.nodes;
  if (!nodes || !nodes.length) return;

  var cust = nodes[0];
  var tags = (cust.tags || []).concat(['referral', 'ref_' + refCode, discountCode]);
  var unique = tags.filter(function(t, i, a) { return a.indexOf(t) === i; });

  shopifyGQL_(
    'mutation { customerUpdate(input: { id: "' + cust.id + '", tags: ' + JSON.stringify(unique) + ' }) { userErrors { message } } }'
  );
}

function updateCustomerTierTag_(customerId, tierName) {
  var gid = /^gid:/.test(customerId) ? customerId : 'gid://shopify/Customer/' + customerId;
  var q = '{ customer(id: "' + gid + '") { tags } }';
  var result = shopifyGQL_(q);
  if (!result.data || !result.data.customer) return;

  var tags = result.data.customer.tags || [];
  /* Remove old tier tags, add new */
  tags = tags.filter(function(t) { return t.indexOf('tier_') !== 0; });
  tags.push('tier_' + tierName);
  var unique = tags.filter(function(t, i, a) { return a.indexOf(t) === i; });

  shopifyGQL_(
    'mutation { customerUpdate(input: { id: "' + gid + '", tags: ' + JSON.stringify(unique) + ' }) { userErrors { message } } }'
  );
}

function getCustomerEmailById_(customerId) {
  var gid = /^gid:/.test(customerId) ? customerId : 'gid://shopify/Customer/' + customerId;
  var result = shopifyGQL_('{ customer(id: "' + gid + '") { email } }');
  return (result.data && result.data.customer) ? result.data.customer.email : '';
}

function updateCustomerMetafields_(customerId, points, tierName) {
  var gid = /^gid:/.test(customerId) ? customerId : 'gid://shopify/Customer/' + customerId;
  var mutation = 'mutation customerUpdate($input: CustomerInput!) {'
    + ' customerUpdate(input: $input) { userErrors { field message } } }';

  shopifyGQL_(mutation, {
    input: {
      id: gid,
      metafields: [
        { namespace: 'karinex', key: 'loyalty_points', value: String(points), type: 'number_integer' },
        { namespace: 'karinex', key: 'loyalty_tier', value: tierName, type: 'single_line_text_field' }
      ]
    }
  });
}

/* ═══════════════════════════════════════════════════════
   STORAGE: Referral Codes (Script Properties)
   ═══════════════════════════════════════════════════════ */

function findExistingCode_(email) {
  return PropertiesService.getScriptProperties().getProperty('ref_' + email) || null;
}

function saveCode_(email, code, refCode) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('ref_' + email, code);
  /* Reverse mapping: code → { invited email, referrer ID } */
  props.setProperty('code_meta_' + code, JSON.stringify({ email: email, ref: refCode }));
}

/* ═══════════════════════════════════════════════════════
   STORAGE: Loyalty Points (Google Sheet)
   ═══════════════════════════════════════════════════════ */

function getOrCreateLoyaltySheet_() {
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty('LOYALTY_SHEET_ID');

  if (sid) {
    try {
      var ss = SpreadsheetApp.openById(sid);
      var pts = ss.getSheetByName('Points') || ss.insertSheet('Points');
      var hist = ss.getSheetByName('History') || ss.insertSheet('History');
      return { points: pts, history: hist };
    } catch(e) {}
  }

  var ss = SpreadsheetApp.create('Karinex Loyalty Points');
  props.setProperty('LOYALTY_SHEET_ID', ss.getId());

  var pts = ss.getActiveSheet();
  pts.setName('Points');
  pts.getRange(1, 1, 1, 4).setValues([['Email', 'Punkte', 'Tier', 'Updated']]);
  pts.getRange(1, 1, 1, 4).setFontWeight('bold');
  pts.setFrozenRows(1);

  var hist = ss.insertSheet('History');
  hist.getRange(1, 1, 1, 5).setValues([['Datum', 'Email', 'Punkte', 'Grund', 'Saldo']]);
  hist.getRange(1, 1, 1, 5).setFontWeight('bold');
  hist.setFrozenRows(1);

  return { points: pts, history: hist };
}

function getCustomerData_(email) {
  email = String(email).trim().toLowerCase();
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.points.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === email) {
        return { points: parseInt(data[i][1]) || 0, row: i + 1 };
      }
    }
  } catch(e) {}
  return { points: 0, row: 0 };
}

function addPoints_(email, points, reason, customerId) {
  email = String(email).trim().toLowerCase();
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.points.getDataRange().getValues();
    var newTotal = 0;
    var found = false;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === email) {
        newTotal = Math.max(0, (parseInt(data[i][1]) || 0) + points);
        var tier = getTier_(newTotal);
        sheets.points.getRange(i + 1, 2, 1, 3).setValues([[newTotal, tier.name, new Date()]]);
        found = true;
        break;
      }
    }

    if (!found) {
      newTotal = Math.max(0, points);
      var tier = getTier_(newTotal);
      sheets.points.appendRow([email, newTotal, tier.name, new Date()]);
    }

    /* Log transaction */
    sheets.history.appendRow([
      new Date(), email, (points >= 0 ? '+' : '') + points, reason, newTotal
    ]);

  } catch(e) {
    Logger.log('addPoints_ error: ' + e.message);
  }
}

/* ═══════════════════════════════════════════════════════
   STORAGE: Referral Sheet Logging
   ═══════════════════════════════════════════════════════ */

function getOrCreateReferralSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty('REFERRAL_SHEET_ID');

  if (sid) {
    try {
      var ss = SpreadsheetApp.openById(sid);
      return ss.getSheetByName('ReferralCodes') || ss.insertSheet('ReferralCodes');
    } catch(e) {}
  }

  var ss = SpreadsheetApp.create('Karinex Referral Codes');
  props.setProperty('REFERRAL_SHEET_ID', ss.getId());
  var sheet = ss.getActiveSheet();
  sheet.setName('ReferralCodes');
  sheet.getRange(1, 1, 1, 5).setValues([['Datum', 'Email', 'Code', 'Referrer', 'Eingelöst']]);
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function logReferralToSheet_(email, refCode, code) {
  getOrCreateReferralSheet_().appendRow([new Date(), email, code, refCode, 'Nein']);
}

/* ═══════════════════════════════════════════════════════
   CODE GENERATION
   ═══════════════════════════════════════════════════════ */

function generateCode_(prefix) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = prefix || 'KX-';
  for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

/* ═══════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════ */

function asJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════════════════════════════════
   SETUP FUNCTIONS — Run each ONCE from GAS editor
   ═══════════════════════════════════════════════════════ */

/** Creates a 15-minute trigger that polls Shopify for new paid orders */
function setupTrigger() {
  /* Remove old triggers for this function */
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'checkNewOrders') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('checkNewOrders')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('✅ Trigger erstellt: checkNewOrders alle 15 Minuten');
}

/** Creates customer metafield definitions so they're visible in Liquid/Storefront */
function setupMetafields() {
  var mutation = 'mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {'
    + ' metafieldDefinitionCreate(definition: $definition) {'
    + '   createdDefinition { id } userErrors { field message }'
    + ' } }';

  /* loyalty_points */
  var r1 = shopifyGQL_(mutation, {
    definition: {
      name: 'Loyalty Points', namespace: 'karinex', key: 'loyalty_points',
      type: 'number_integer', ownerType: 'CUSTOMER',
      access: { storefront: 'PUBLIC_READ' }
    }
  });
  Logger.log('loyalty_points: ' + JSON.stringify(r1));

  /* loyalty_tier */
  var r2 = shopifyGQL_(mutation, {
    definition: {
      name: 'Loyalty Tier', namespace: 'karinex', key: 'loyalty_tier',
      type: 'single_line_text_field', ownerType: 'CUSTOMER',
      access: { storefront: 'PUBLIC_READ' }
    }
  });
  Logger.log('loyalty_tier: ' + JSON.stringify(r2));

  Logger.log('✅ Metafield-Definitionen erstellt');
}
