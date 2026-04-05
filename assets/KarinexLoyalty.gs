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

      /* ── Admin endpoints ── */
      case 'admin_dashboard':
        if (!verifyAdmin_(p.key)) return asJson_({ ok: false, error: 'unauthorized' });
        return serveAdminDashboard_();

      case 'admin_get':
        if (!verifyAdmin_(p.key)) return asJson_({ ok: false, error: 'unauthorized' });
        if (!p.email) return asJson_({ ok: false, error: 'missing_email' });
        return handleGetPointsByEmail_(p.email);

      case 'admin_add':
        if (!verifyAdmin_(p.key)) return asJson_({ ok: false, error: 'unauthorized' });
        return handleAdminPoints_(p.email, parseInt(p.points) || 0, p.reason || 'Admin-Gutschrift');

      case 'admin_remove':
        if (!verifyAdmin_(p.key)) return asJson_({ ok: false, error: 'unauthorized' });
        return handleAdminPoints_(p.email, -(Math.abs(parseInt(p.points) || 0)), p.reason || 'Admin-Abzug');

      case 'admin_list':
        if (!verifyAdmin_(p.key)) return asJson_({ ok: false, error: 'unauthorized' });
        return handleAdminList_();

      default:
        return asJson_({ ok: true, service: 'karinex-loyalty', version: '2.3' });
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
   ADMIN: Authentication & Handlers
   ═══════════════════════════════════════════════════════ */

function verifyAdmin_(key) {
  var adminKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return adminKey && key === adminKey;
}

function handleAdminPoints_(email, points, reason) {
  email = String(email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return asJson_({ ok: false, error: 'invalid_email' });
  }
  if (!points || points === 0) return asJson_({ ok: false, error: 'invalid_points' });

  addPoints_(email, points, reason, '');

  /* Update Shopify metafields if customer exists */
  try {
    var q = '{ customers(first:1, query:"email:' + email + '") { nodes { id } } }';
    var result = shopifyGQL_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      var newData = getCustomerData_(email);
      var newTier = getTier_(newData.points);
      updateCustomerMetafields_(nodes[0].id, newData.points, newTier.name);
      try { updateCustomerTierTag_(nodes[0].id, newTier.name); } catch(e) {}
    }
  } catch(e) {}

  var updated = getCustomerData_(email);
  var tier = getTier_(updated.points);
  return asJson_({ ok: true, email: email, points: updated.points, tier: tier.name, changed: points });
}

function handleAdminList_() {
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.points.getDataRange().getValues();
    var customers = [];
    for (var i = 1; i < data.length; i++) {
      customers.push({
        email: String(data[i][0]),
        points: parseInt(data[i][1]) || 0,
        tier: String(data[i][2] || 'bronze'),
        updated: data[i][3] ? new Date(data[i][3]).toISOString() : ''
      });
    }
    customers.sort(function(a, b) { return b.points - a.points; });
    return asJson_({ ok: true, customers: customers, total: customers.length });
  } catch(e) {
    return asJson_({ ok: false, error: e.message });
  }
}

/* ═══════════════════════════════════════════════════════
   ADMIN: Server-side functions called by google.script.run
   ═══════════════════════════════════════════════════════ */

function adminGetCustomer(email) {
  email = String(email).trim().toLowerCase();
  var data = getCustomerData_(email);
  var tier = getTier_(data.points);
  var next = getNextTier_(data.points);
  return {
    ok: true, email: email, points: data.points,
    tier: tier.name, cashback: tier.cashback,
    next_tier: next ? next.name : null,
    points_to_next: next ? next.min - data.points : 0
  };
}

function adminAdjustPoints(email, points, reason, isRemove) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'invalid_email' };
  points = parseInt(points) || 0;
  if (!points) return { ok: false, error: 'invalid_points' };
  if (isRemove) points = -Math.abs(points);

  addPoints_(email, points, reason || (points > 0 ? 'Admin-Gutschrift' : 'Admin-Abzug'), '');

  try {
    var q = '{ customers(first:1, query:"email:' + email + '") { nodes { id } } }';
    var result = shopifyGQL_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      var newData = getCustomerData_(email);
      var newTier = getTier_(newData.points);
      updateCustomerMetafields_(nodes[0].id, newData.points, newTier.name);
      try { updateCustomerTierTag_(nodes[0].id, newTier.name); } catch(e) {}
    }
  } catch(e) {}

  var updated = getCustomerData_(email);
  var tier = getTier_(updated.points);
  return { ok: true, email: email, points: updated.points, tier: tier.name, changed: points };
}

function adminListCustomers() {
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.points.getDataRange().getValues();
    var customers = [];
    for (var i = 1; i < data.length; i++) {
      customers.push({
        email: String(data[i][0]),
        points: parseInt(data[i][1]) || 0,
        tier: String(data[i][2] || 'bronze'),
        updated: data[i][3] ? new Date(data[i][3]).toISOString() : ''
      });
    }
    customers.sort(function(a, b) { return b.points - a.points; });
    return { ok: true, customers: customers, total: customers.length };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

/* ═══════════════════════════════════════════════════════
   ADMIN: Stats, Registration & History
   ═══════════════════════════════════════════════════════ */

function adminGetStats() {
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.points.getDataRange().getValues();
    var s = { total: 0, gold: 0, silber: 0, bronze: 0, totalPoints: 0 };
    for (var i = 1; i < data.length; i++) {
      s.total++;
      s.totalPoints += parseInt(data[i][1]) || 0;
      var t = String(data[i][2] || 'bronze').toLowerCase();
      if (t === 'gold') s.gold++; else if (t === 'silber') s.silber++; else s.bronze++;
    }
    return { ok: true, stats: s };
  } catch(e) { return { ok: false, error: e.message }; }
}

function adminAddNewCustomer(email, initialPoints, reason) {
  email = String(email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'invalid_email' };
  var ex = getCustomerData_(email);
  if (ex.row > 0) return { ok: false, error: 'Kunde existiert bereits' };
  initialPoints = parseInt(initialPoints) || 0;
  if (initialPoints > 0) {
    addPoints_(email, initialPoints, reason || 'Willkommensbonus', '');
  } else {
    try {
      var sheets = getOrCreateLoyaltySheet_();
      sheets.points.appendRow([email, 0, 'bronze', new Date()]);
      sheets.history.appendRow([new Date(), email, '+0', reason || 'Kunde registriert', 0]);
    } catch(e) { return { ok: false, error: e.message }; }
  }
  try {
    var q = '{ customers(first:1, query:"email:' + email + '") { nodes { id } } }';
    var result = shopifyGQL_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      var nd = getCustomerData_(email); var nt = getTier_(nd.points);
      updateCustomerMetafields_(nodes[0].id, nd.points, nt.name);
    }
  } catch(e) {}
  var d = getCustomerData_(email); var t = getTier_(d.points);
  return { ok: true, email: email, points: d.points, tier: t.name };
}

function adminGetHistory(email) {
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.history.getDataRange().getValues();
    var hist = []; email = email ? String(email).trim().toLowerCase() : '';
    for (var i = 1; i < data.length; i++) {
      var r = { date: data[i][0] ? new Date(data[i][0]).toISOString() : '', email: String(data[i][1] || ''), points: String(data[i][2] || ''), reason: String(data[i][3] || ''), balance: parseInt(data[i][4]) || 0 };
      if (!email || r.email.toLowerCase() === email) hist.push(r);
    }
    hist.reverse();
    return { ok: true, history: hist.slice(0, 200), total: hist.length };
  } catch(e) { return { ok: false, error: e.message }; }
}

/* ═══════════════════════════════════════════════════════
   ADMIN: Dashboard HTML
   ═══════════════════════════════════════════════════════ */

function serveAdminDashboard_() {
  var html = HtmlService.createHtmlOutput(getAdminHtml_())
    .setTitle('Karinex Admin — Loyalty Points')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

function getAdminHtml_() {
  return '<!DOCTYPE html>'
+ '<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
+ '<title>Karinex Admin</title>'
+ '<style>'
+ ':root{--bg:#f0f2f5;--sb:#0f172a;--sb-h:#1e293b;--card:#fff;--accent:#6366f1;--accent-l:#818cf8;--green:#22c55e;--red:#ef4444;--gold:#f59e0b;--silver:#94a3b8;--bronze:#f97316;--txt:#1e293b;--txt2:#64748b;--bdr:#e2e8f0;--r:12px}'
+ '*{box-sizing:border-box;margin:0;padding:0}'
+ 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--txt);display:flex;min-height:100vh}'
+ '.sb{width:260px;background:var(--sb);color:#fff;display:flex;flex-direction:column;position:fixed;height:100vh;z-index:100}'
+ '.sb-h{padding:24px 20px;border-bottom:1px solid rgba(255,255,255,.1)}.sb-h h1{font-size:20px;font-weight:700;letter-spacing:1px}.sb-h p{font-size:12px;color:rgba(255,255,255,.5);margin-top:4px}'
+ '.nav{flex:1;padding:16px 0}'
+ '.nav a{display:flex;align-items:center;gap:12px;padding:12px 20px;color:rgba(255,255,255,.6);text-decoration:none;font-size:14px;font-weight:500;transition:all .2s;cursor:pointer;border-left:3px solid transparent}'
+ '.nav a:hover,.nav a.on{background:var(--sb-h);color:#fff;border-left-color:var(--accent)}'
+ '.nav a .ic{width:20px;text-align:center;font-size:16px}'
+ '.sb-f{padding:16px 20px;border-top:1px solid rgba(255,255,255,.1);font-size:11px;color:rgba(255,255,255,.3)}'
+ '.mn{margin-left:260px;flex:1;padding:32px;min-height:100vh}'
+ '.pg{display:none}.pg.on{display:block}'
+ '.pt{font-size:24px;font-weight:700;margin-bottom:24px}.pt span{font-weight:400;color:var(--txt2);font-size:14px;margin-left:8px}'
+ '.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:32px}'
+ '.sc{background:var(--card);border-radius:var(--r);padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.06)}.sc .lb{font-size:11px;color:var(--txt2);text-transform:uppercase;font-weight:600;letter-spacing:.5px}.sc .vl{font-size:32px;font-weight:700;margin-top:8px}'
+ '.sc.a .vl{color:var(--accent)}.sc.go .vl{color:var(--gold)}.sc.si .vl{color:var(--silver)}.sc.gr .vl{color:var(--green)}'
+ '.cd{background:var(--card);border-radius:var(--r);padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}'
+ '.cd h2{font-size:15px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px}'
+ 'label{display:block;font-size:12px;color:var(--txt2);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}'
+ 'input{width:100%;padding:10px 14px;border:1.5px solid var(--bdr);border-radius:8px;font-size:14px;margin-bottom:12px;outline:none;transition:border .2s;background:#fff}input:focus{border-color:var(--accent)}'
+ '.rw{display:flex;gap:12px}.rw>div{flex:1}'
+ 'button{padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px}'
+ '.bt{background:var(--accent);color:#fff}.bt:hover{background:var(--accent-l);transform:translateY(-1px)}'
+ '.bg{background:var(--green);color:#fff}.bg:hover{background:#16a34a}'
+ '.br{background:var(--red);color:#fff}.br:hover{background:#dc2626}'
+ '.bd{background:var(--txt);color:#fff}.bd:hover{background:#334155}'
+ '.bo{background:transparent;color:var(--txt);border:1.5px solid var(--bdr)}.bo:hover{border-color:var(--txt)}'
+ '.bf{width:100%}'
+ '.badge{display:inline-block;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}'
+ '.badge.gold{background:#fef3c7;color:#92400e}.badge.silber{background:#f1f5f9;color:#475569}.badge.bronze{background:#fed7aa;color:#9a3412}'
+ '.cc{display:flex;align-items:center;gap:20px;padding:20px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:var(--r);margin-bottom:16px}'
+ '.cc .pts{font-size:36px;font-weight:800;color:var(--accent)}.cc .mt{font-size:12px;color:var(--txt2)}.cc .em{font-size:14px;font-weight:600;margin-bottom:4px}'
+ 'table{width:100%;border-collapse:collapse;font-size:13px}'
+ 'th{text-align:left;padding:10px 14px;border-bottom:2px solid var(--bdr);color:var(--txt2);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}'
+ 'td{padding:10px 14px;border-bottom:1px solid #f1f5f9}tr:hover td{background:#f8fafc}tr.ck{cursor:pointer}'
+ '.msg{padding:14px 16px;border-radius:8px;font-size:14px;margin-top:12px;display:none;font-weight:500}'
+ '.msg.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;display:block}'
+ '.msg.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;display:block}'
+ '.toast{position:fixed;top:20px;right:20px;padding:14px 20px;border-radius:10px;color:#fff;font-size:14px;font-weight:500;z-index:9999;transform:translateX(120%);transition:transform .3s ease;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:400px}'
+ '.toast.show{transform:translateX(0)}.toast.ok{background:#22c55e}.toast.err{background:#ef4444}'
+ '.emp{text-align:center;padding:40px;color:var(--txt2);font-size:14px}'
+ '.mob{display:none;position:fixed;top:12px;left:12px;z-index:200;background:var(--sb);color:#fff;border:none;border-radius:8px;width:40px;height:40px;font-size:20px;cursor:pointer}'
+ '@media(max-width:768px){.sb{transform:translateX(-100%);transition:transform .3s}.sb.open{transform:translateX(0)}.mn{margin-left:0;padding:16px;padding-top:60px}.mob{display:block}.rw{flex-direction:column}.stats{grid-template-columns:1fr 1fr}.cc{flex-direction:column;text-align:center}}'
+ '</style></head><body>'
+ '<button class="mob" onclick="document.getElementById(\'sb\').classList.toggle(\'open\')">&#9776;</button>'
+ '<nav class="sb" id="sb">'
+ '<div class="sb-h"><h1>KARINEX</h1><p>Admin Panel</p></div>'
+ '<div class="nav">'
+ '<a onclick="go(\'dash\')" class="on" data-p="dash"><span class="ic">&#128202;</span> Dashboard</a>'
+ '<a onclick="go(\'cust\')" data-p="cust"><span class="ic">&#128269;</span> Kunden</a>'
+ '<a onclick="go(\'neu\')" data-p="neu"><span class="ic">&#10133;</span> Neuer Kunde</a>'
+ '<a onclick="go(\'hist\')" data-p="hist"><span class="ic">&#128203;</span> Verlauf</a>'
+ '</div>'
+ '<div class="sb-f">Karinex Loyalty v2.3</div>'
+ '</nav>'
+ '<div class="mn">'
+ '<div class="pg on" id="pg-dash">'
+ '<div class="pt">Dashboard</div>'
+ '<div class="stats">'
+ '<div class="sc a"><div class="lb">Gesamt Kunden</div><div class="vl" id="sT">&#8212;</div></div>'
+ '<div class="sc gr"><div class="lb">Gesamtpunkte</div><div class="vl" id="sP">&#8212;</div></div>'
+ '<div class="sc go"><div class="lb">Gold Kunden</div><div class="vl" id="sG">&#8212;</div></div>'
+ '<div class="sc si"><div class="lb">Silber Kunden</div><div class="vl" id="sS">&#8212;</div></div>'
+ '</div>'
+ '<div class="cd"><h2>&#128203; Letzte Aktivitaeten</h2><div id="rAct"><div class="emp">Wird geladen...</div></div></div>'
+ '</div>'
+ '<div class="pg" id="pg-cust">'
+ '<div class="pt">Kunden verwalten</div>'
+ '<div class="cd"><h2>&#128269; Kunden suchen</h2>'
+ '<div style="display:flex;gap:8px"><input type="email" id="sEm" placeholder="E-Mail eingeben..." style="margin-bottom:0"><button class="bt" onclick="doSearch()" style="white-space:nowrap">Suchen</button></div>'
+ '<div id="sMsg" class="msg"></div></div>'
+ '<div id="cDet" style="display:none"><div class="cd"><h2>&#128202; Kundendaten</h2><div class="cc" id="cCard"></div>'
+ '<h2 style="margin-top:16px">&#9998; Punkte anpassen</h2>'
+ '<div class="rw"><div><label>Punkte</label><input type="number" id="aP" placeholder="z.B. 500" min="1"></div><div><label>Grund</label><input type="text" id="aR" placeholder="z.B. Support-Bonus"></div></div>'
+ '<div style="display:flex;gap:8px"><button class="bg" onclick="doAdj(false)">+ Hinzufuegen</button><button class="br" onclick="doAdj(true)">&#8722; Abziehen</button></div>'
+ '<div id="aMsg" class="msg"></div></div></div>'
+ '<div class="cd"><h2>&#128101; Alle Kunden <span id="cCnt" style="font-weight:400;color:#94a3b8;font-size:13px"></span></h2>'
+ '<button class="bd" onclick="doList()" style="margin-bottom:16px">Liste laden</button>'
+ '<div id="cTbl"><div class="emp">Auf &quot;Liste laden&quot; klicken</div></div></div>'
+ '</div>'
+ '<div class="pg" id="pg-neu">'
+ '<div class="pt">Neuer Kunde <span>Kunde im System registrieren</span></div>'
+ '<div class="cd" style="max-width:500px"><h2>&#10133; Kunde registrieren</h2>'
+ '<label>E-Mail-Adresse *</label><input type="email" id="nEm" placeholder="kunde@beispiel.de">'
+ '<label>Startpunkte</label><input type="number" id="nPt" placeholder="0 (optional)" min="0">'
+ '<label>Grund / Notiz</label><input type="text" id="nRe" placeholder="z.B. Willkommensbonus">'
+ '<button class="bt bf" onclick="doReg()" style="margin-top:8px">Kunde registrieren</button>'
+ '<div id="nMsg" class="msg"></div></div>'
+ '</div>'
+ '<div class="pg" id="pg-hist">'
+ '<div class="pt">Verlauf <span>Alle Punktebuchungen</span></div>'
+ '<div class="cd">'
+ '<div style="display:flex;gap:8px;margin-bottom:16px"><input type="email" id="hEm" placeholder="E-Mail filtern (optional)" style="margin-bottom:0">'
+ '<button class="bt" onclick="doHist()">Laden</button><button class="bo" onclick="document.getElementById(\'hEm\').value=\'\';doHist()">Alle</button></div>'
+ '<div id="hTbl"><div class="emp">Auf &quot;Laden&quot; klicken</div></div></div>'
+ '</div>'
+ '</div>'
+ '<div class="toast" id="tst"></div>'
+ '<script>'
+ 'function go(p){var pgs=document.querySelectorAll(\'.pg\');for(var i=0;i<pgs.length;i++)pgs[i].classList.remove(\'on\');document.getElementById(\'pg-\'+p).classList.add(\'on\');var lk=document.querySelectorAll(\'.nav a\');for(var j=0;j<lk.length;j++)lk[j].classList.remove(\'on\');var a=document.querySelector(\'[data-p="\'+p+\'"]\');if(a)a.classList.add(\'on\');if(p===\'dash\')loadDash();document.getElementById(\'sb\').classList.remove(\'open\')}'
+ 'function tst(m,t){var e=document.getElementById(\'tst\');e.textContent=m;e.className=\'toast \'+(t||\'ok\')+\' show\';setTimeout(function(){e.classList.remove(\'show\')},3500)}'
+ 'function sm(id,t,m){var e=document.getElementById(id);e.className=\'msg \'+t;e.textContent=m;e.style.display=\'block\'}'
+ 'function fmt(n){return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,\'.\')}'
+ 'function loadDash(){google.script.run.withSuccessHandler(function(d){if(!d||!d.ok)return;var s=d.stats;document.getElementById(\'sT\').textContent=fmt(s.total);document.getElementById(\'sP\').textContent=fmt(s.totalPoints);document.getElementById(\'sG\').textContent=fmt(s.gold);document.getElementById(\'sS\').textContent=fmt(s.silber)}).adminGetStats();google.script.run.withSuccessHandler(function(d){if(!d||!d.ok||!d.history||!d.history.length){document.getElementById(\'rAct\').innerHTML=\'<div class="emp">Noch keine Aktivitaeten</div>\';return}var h=\'<table><thead><tr><th>Datum</th><th>E-Mail</th><th>Punkte</th><th>Grund</th><th>Saldo</th></tr></thead><tbody>\';var it=d.history.slice(0,10);for(var i=0;i<it.length;i++){var r=it[i];var dt=r.date?new Date(r.date).toLocaleDateString(\'de-DE\',{day:\'2-digit\',month:\'2-digit\',year:\'2-digit\',hour:\'2-digit\',minute:\'2-digit\'}):\'-\';var cl=String(r.points).indexOf(\'-\')===0?\'color:#ef4444\':\'color:#22c55e\';h+=\'<tr><td>\'+dt+\'</td><td>\'+r.email+\'</td><td style="font-weight:700;\'+cl+\'">\'+r.points+\'</td><td>\'+r.reason+\'</td><td><strong>\'+fmt(r.balance)+\'</strong></td></tr>\'}h+=\'</tbody></table>\';document.getElementById(\'rAct\').innerHTML=h}).adminGetHistory(\'\')}'
+ 'function doSearch(){var em=document.getElementById(\'sEm\').value.trim();if(!em){sm(\'sMsg\',\'err\',\'Bitte E-Mail eingeben\');return}sm(\'sMsg\',\'ok\',\'Suche...\');google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){sm(\'sMsg\',\'err\',\'Kunde nicht gefunden\');document.getElementById(\'cDet\').style.display=\'none\';return}document.getElementById(\'sMsg\').style.display=\'none\';showCust(d)}).withFailureHandler(function(e){sm(\'sMsg\',\'err\',\'Fehler: \'+e.message)}).adminGetCustomer(em)}'
+ 'function showCust(d){document.getElementById(\'cDet\').style.display=\'block\';var h=\'<div style="flex:1"><div class="em">\'+d.email+\'</div><div class="mt"><span class="badge \'+d.tier+\'">\'+d.tier+\'</span> &nbsp; \'+d.cashback+\'% Cashback</div></div>\';h+=\'<div style="text-align:right"><div class="pts">\'+fmt(d.points)+\'</div><div class="mt">Punkte</div></div>\';if(d.next_tier)h+=\'<div style="text-align:right"><div class="mt">Noch \'+fmt(d.points_to_next)+\' bis \'+d.next_tier+\'</div></div>\';document.getElementById(\'cCard\').innerHTML=h}'
+ 'function doAdj(rm){var em=document.getElementById(\'sEm\').value.trim();var pts=parseInt(document.getElementById(\'aP\').value)||0;var re=document.getElementById(\'aR\').value.trim();if(!em||!pts){sm(\'aMsg\',\'err\',\'E-Mail und Punkte eingeben\');return}sm(\'aMsg\',\'ok\',\'Wird gespeichert...\');google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){sm(\'aMsg\',\'err\',(d&&d.error)||\'Fehler\');return}var si=d.changed>0?\'+\':\'\';tst(si+d.changed+\' Punkte \u2014 Neuer Stand: \'+fmt(d.points)+\' (\'+d.tier+\')\',\'ok\');document.getElementById(\'aMsg\').style.display=\'none\';document.getElementById(\'aP\').value=\'\';document.getElementById(\'aR\').value=\'\';doSearch()}).withFailureHandler(function(e){sm(\'aMsg\',\'err\',e.message)}).adminAdjustPoints(em,pts,re,rm)}'
+ 'function doList(){document.getElementById(\'cTbl\').innerHTML=\'<div class="emp">Laedt...</div>\';google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){document.getElementById(\'cTbl\').innerHTML=\'<div class="emp">Fehler</div>\';return}document.getElementById(\'cCnt\').textContent=\'(\'+d.total+\')\';if(!d.customers.length){document.getElementById(\'cTbl\').innerHTML=\'<div class="emp">Noch keine Kunden</div>\';return}var h=\'<table><thead><tr><th>E-Mail</th><th>Punkte</th><th>Tier</th><th>Aktualisiert</th></tr></thead><tbody>\';for(var i=0;i<d.customers.length;i++){var c=d.customers[i];var dt=c.updated?new Date(c.updated).toLocaleDateString(\'de-DE\'):\'-\';h+=\'<tr class="ck" onclick="selC(\\'\'+c.email+\'\\')"><td>\'+c.email+\'</td><td><strong>\'+fmt(c.points)+\'</strong></td><td><span class="badge \'+c.tier+\'">\'+c.tier+\'</span></td><td>\'+dt+\'</td></tr>\'}h+=\'</tbody></table>\';document.getElementById(\'cTbl\').innerHTML=h}).withFailureHandler(function(e){document.getElementById(\'cTbl\').innerHTML=\'<div class="emp">Fehler: \'+e.message+\'</div>\'}).adminListCustomers()}'
+ 'function selC(em){document.getElementById(\'sEm\').value=em;doSearch();window.scrollTo(0,0)}'
+ 'function doReg(){var em=document.getElementById(\'nEm\').value.trim();var pts=parseInt(document.getElementById(\'nPt\').value)||0;var re=document.getElementById(\'nRe\').value.trim();if(!em){sm(\'nMsg\',\'err\',\'Bitte E-Mail eingeben\');return}sm(\'nMsg\',\'ok\',\'Wird registriert...\');google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){sm(\'nMsg\',\'err\',(d&&d.error)||\'Fehler\');return}sm(\'nMsg\',\'ok\',\'Kunde registriert: \'+d.email+\' \u2014 \'+fmt(d.points)+\' Punkte (\'+d.tier+\')\');tst(\'Neuer Kunde: \'+d.email,\'ok\');document.getElementById(\'nEm\').value=\'\';document.getElementById(\'nPt\').value=\'\';document.getElementById(\'nRe\').value=\'\'}).withFailureHandler(function(e){sm(\'nMsg\',\'err\',e.message)}).adminAddNewCustomer(em,pts,re)}'
+ 'function doHist(){var em=document.getElementById(\'hEm\').value.trim();document.getElementById(\'hTbl\').innerHTML=\'<div class="emp">Laedt...</div>\';google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){document.getElementById(\'hTbl\').innerHTML=\'<div class="emp">Fehler</div>\';return}if(!d.history.length){document.getElementById(\'hTbl\').innerHTML=\'<div class="emp">Keine Eintraege</div>\';return}var h=\'<table><thead><tr><th>Datum</th><th>E-Mail</th><th>Punkte</th><th>Grund</th><th>Saldo</th></tr></thead><tbody>\';for(var i=0;i<d.history.length;i++){var r=d.history[i];var dt=r.date?new Date(r.date).toLocaleDateString(\'de-DE\',{day:\'2-digit\',month:\'2-digit\',year:\'2-digit\',hour:\'2-digit\',minute:\'2-digit\'}):\'-\';var cl=String(r.points).indexOf(\'-\')===0?\'color:#ef4444\':\'color:#22c55e\';h+=\'<tr><td style="white-space:nowrap">\'+dt+\'</td><td>\'+r.email+\'</td><td style="font-weight:700;\'+cl+\'">\'+r.points+\'</td><td>\'+r.reason+\'</td><td><strong>\'+fmt(r.balance)+\'</strong></td></tr>\'}h+=\'</tbody></table>\';if(d.total>200)h+=\'<div class="emp" style="padding:12px">Zeige 200 von \'+d.total+\'</div>\';document.getElementById(\'hTbl\').innerHTML=h}).withFailureHandler(function(e){document.getElementById(\'hTbl\').innerHTML=\'<div class="emp">Fehler: \'+e.message+\'</div>\'}).adminGetHistory(em)}'
+ 'document.getElementById(\'sEm\').addEventListener(\'keydown\',function(e){if(e.key===\'Enter\')doSearch()});'
+ 'document.getElementById(\'nEm\').addEventListener(\'keydown\',function(e){if(e.key===\'Enter\')doReg()});'
+ 'document.getElementById(\'hEm\').addEventListener(\'keydown\',function(e){if(e.key===\'Enter\')doHist()});'
+ 'loadDash();'
+ '</script></body></html>';
}

/* ═══════════════════════════════════════════════════════
   SETUP: Admin Key Generation
   ═══════════════════════════════════════════════════════ */

/** Creates a random admin key for the dashboard. Run ONCE from GAS editor. */
function setupAdminKey() {
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty('ADMIN_KEY');
  if (existing) {
    Logger.log('⚠️ Admin-Key existiert bereits: ' + existing);
    Logger.log('Dashboard-URL: <DEINE_GAS_URL>?action=admin_dashboard&key=' + existing);
    return;
  }
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var key = '';
  for (var i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  props.setProperty('ADMIN_KEY', key);
  Logger.log('✅ Admin-Key erstellt: ' + key);
  Logger.log('Dashboard-URL: <DEINE_GAS_URL>?action=admin_dashboard&key=' + key);
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
