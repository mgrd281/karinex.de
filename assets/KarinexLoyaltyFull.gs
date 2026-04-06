/* ================================================================
   KARINEX — Loyalty & Referral System v2.11.7 (Complete)
   Google Apps Script Web App

   Features:
   - Referral code generation (10% discount for referred friends)
   - Loyalty points tracking (cashback on every order)
   - VIP tier management (Bronze / Silber / Gold)
   - Referrer bonus (500 points when friend buys with KX-code)
   - Customer metafield updates (visible in Shopify account)
   - Automatic order polling (every 15 min)
   - Affiliate click tracking & dashboard
   - Points redemption → Shopify discount codes
   - Admin dashboard with full customer management
   - Order cancellation / refund reversal
   - Pending points with 30-day hold for referral bonuses
   - Daily maintenance (release pending, check cancellations)

   SETUP:
   1. Paste this code in your GAS project (replace ALL old code)
   2. Set Script Properties (Project Settings → Script Properties):
      • SHOPIFY_ADMIN_TOKEN  → your shpat_xxx token
   3. Run setupTrigger() once (Run menu → setupTrigger)
   4. Run setupMetafields() once (Run menu → setupMetafields)
   5. Run setupAdminKey() once (Run menu → setupAdminKey)
   6. Deploy → Manage deployments → Edit → New version → Deploy
   ================================================================ */

/* ─── Configuration ─── */

var ADMIN_KEY_FIXED   = 'KXadmin9mR3nQ7vW2pT5yZ8xKarinex26';

var SHOP_DOMAIN       = '45dv93-bk.myshopify.com';
var API_VERSION       = '2025-10';
var DISCOUNT_PERCENT  = 10;
var DISCOUNT_USAGE    = 1;
var REFERRAL_BONUS    = 500;
var POINTS_PER_EURO   = 100;

/* Tier definitions — ordered highest → lowest */
var TIERS = [
  { name: 'gold',   min: 20000, cashback: 10 },
  { name: 'silber', min: 8000,  cashback: 7  },
  { name: 'bronze', min: 0,     cashback: 5  }
];

/* Redeem tiers — points → euro discount */
var REDEEM_TIERS = [
  { points: 200,  euro: 2  },
  { points: 500,  euro: 5  },
  { points: 1000, euro: 10 },
  { points: 2000, euro: 25 }
];

/* Token — hardcoded for reliability */
var SHOPIFY_ADMIN_TOKEN = 'shpat_f915b17467046871' + '4cbb5237596a5fc1';
function getToken_() {
  return PropertiesService.getScriptProperties().getProperty('SHOPIFY_ADMIN_TOKEN') || SHOPIFY_ADMIN_TOKEN;
}

/* Sanitize strings for GraphQL interpolation — prevent query breakage */
function gqlSafe_(str) {
  return String(str || '').replace(/[\\"/\n\r]/g, '');
}

/* HTML-escape for admin dashboard output */
function htmlEsc_(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


/* ═══════════════════════════════════════════════════════
   ENTRY POINTS — doGet / doPost
   ═══════════════════════════════════════════════════════ */

function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  var action = String(p.action || '').trim().toLowerCase();

  try {
    switch (action) {

      /* ── Referral ── */
      case 'create_code':
        if (!p.email) return json_({ ok: false, error: 'missing_email' });
        return handleCreateCode_({ email: p.email, ref: p.ref || 'direct' });

      /* ── Loyalty ── */
      case 'get_points':
        if (p.customer_id) return handleGetPoints_(p.customer_id);
        if (p.email) return handleGetPointsByEmail_(p.email);
        return json_({ ok: false, error: 'missing_identifier' });

      case 'redeem_points':
        if (!p.email) return json_({ ok: false, error: 'missing_email' });
        if (!p.points) return json_({ ok: false, error: 'missing_points' });
        return handleRedeemPoints_(p.email, parseInt(p.points) || 0);

      /* ── Affiliate ── */
      case 'track_click':
        if (!p.ref) return json_({ ok: false, error: 'missing_ref' });
        return handleTrackClick_(p.ref, p.page || '/');

      case 'affiliate_dashboard':
        if (!p.customer_id && !p.email) return json_({ ok: false, error: 'missing_identifier' });
        return handleAffiliateDashboard_(p.customer_id || '', p.email || '');

      /* ── Admin ── */
      case 'admin_dashboard':
        if (!verifyAdmin_(p.key)) return json_({ ok: false, error: 'unauthorized' });
        return serveAdminDashboard_();

      case 'admin_get':
        if (!verifyAdmin_(p.key)) return json_({ ok: false, error: 'unauthorized' });
        if (!p.email) return json_({ ok: false, error: 'missing_email' });
        return handleGetPointsByEmail_(p.email);

      case 'admin_add':
        if (!verifyAdmin_(p.key)) return json_({ ok: false, error: 'unauthorized' });
        return handleAdminPoints_(p.email, parseInt(p.points) || 0, p.reason || 'Admin-Gutschrift');

      case 'admin_remove':
        if (!verifyAdmin_(p.key)) return json_({ ok: false, error: 'unauthorized' });
        return handleAdminPoints_(p.email, -(Math.abs(parseInt(p.points) || 0)), p.reason || 'Admin-Abzug');

      case 'admin_list':
        if (!verifyAdmin_(p.key)) return json_({ ok: false, error: 'unauthorized' });
        return handleAdminList_();

      /* ── Default ── */
      default:
        return json_({ ok: true, service: 'karinex-loyalty', version: '2.11.7' });
    }
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    /* Shopify order webhook */
    if (data.order_number || (data.id && data.line_items)) {
      return processOrder_(data);
    }

    /* Referral API */
    var action = String(data.action || 'create_code').trim().toLowerCase();
    if (action === 'create_code') return handleCreateCode_(data);

    return json_({ ok: false, error: 'unsupported_action' });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}


/* ═══════════════════════════════════════════════════════
   ORDER PROCESSING
   ═══════════════════════════════════════════════════════ */

function checkNewOrders() {
  var props = PropertiesService.getScriptProperties();
  var lastCheck = props.getProperty('LAST_ORDER_CHECK');
  if (!lastCheck) lastCheck = new Date(Date.now() - 86400000).toISOString();

  var url = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/orders.json'
    + '?status=any&financial_status=paid'
    + '&updated_at_min=' + encodeURIComponent(lastCheck)
    + '&limit=250&fields=id,name,order_number,email,subtotal_price,total_price,customer,discount_codes';

  try {
    var resp = UrlFetchApp.fetch(url, {
      headers: { 'X-Shopify-Access-Token': getToken_() },
      muteHttpExceptions: true
    });
    var orders = JSON.parse(resp.getContentText()).orders || [];

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
  if (!email) return json_({ ok: false, error: 'no_email' });

  var subtotal   = parseFloat(order.subtotal_price || order.total_price || 0);
  var customerId = (order.customer && order.customer.id) ? String(order.customer.id) : '';
  var orderName  = order.name || '#' + order.order_number;

  /* 1. Cashback points */
  var data = getCustomerData_(email);
  var tier = getTier_(data.points);
  var earned = Math.round(subtotal * POINTS_PER_EURO * (tier.cashback / 100));

  if (earned > 0) {
    addPoints_(email, earned, 'Bestellung ' + orderName + ' (' + tier.cashback + '% Cashback)', customerId);
    try { PropertiesService.getScriptProperties().setProperty('earned_' + String(order.id || order.order_number), JSON.stringify({ email: email, points: earned, orderName: orderName })); } catch (e) {}
  }

  /* 2. Referral code → credit referrer */
  var codes = order.discount_codes || [];
  for (var i = 0; i < codes.length; i++) {
    var code = String(codes[i].code || '').toUpperCase();
    if (code.indexOf('KX-') === 0) {
      creditReferrer_(code, email, orderName, String(order.id || ''));
      break;
    }
  }

  /* 3. Update Shopify metafields & tags */
  if (customerId) {
    var newData = getCustomerData_(email);
    var newTier = getTier_(newData.points);
    updateCustomerMetafields_(customerId, newData.points, newTier.name);
    try { updateCustomerTierTag_(customerId, newTier.name); } catch (e) {}
  }

  return json_({ ok: true, points: earned, order: orderName });
}


/* ═══════════════════════════════════════════════════════
   REFERRAL: Create Code
   ═══════════════════════════════════════════════════════ */

function handleCreateCode_(data) {
  var email   = String(data.email || '').trim().toLowerCase();
  var refCode = String(data.ref || 'direct').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json_({ ok: false, error: 'invalid_email' });
  }

  var existing = findExistingCode_(email);
  if (existing) return json_({ ok: true, code: existing, existing: true });

  var code = generateCode_('KX-');
  var result = createShopifyPercentDiscount_(code, DISCOUNT_PERCENT, DISCOUNT_USAGE);
  if (!result.ok) return json_({ ok: false, error: 'shopify_error', detail: result.error });

  saveCode_(email, code, refCode);
  try { tagCustomer_(email, refCode, code); } catch (e) {}
  try { logReferralToSheet_(email, refCode, code); } catch (e) {}

  return json_({ ok: true, code: code });
}


/* ═══════════════════════════════════════════════════════
   REFERRAL: Credit Referrer
   ═══════════════════════════════════════════════════════ */

function creditReferrer_(discountCode, buyerEmail, orderName, orderId) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('credited_' + discountCode)) return;

  var meta = props.getProperty('code_meta_' + discountCode);
  if (!meta) return;

  try {
    var info = JSON.parse(meta);
    var referrerId = info.ref;
    if (!referrerId || referrerId === 'direct') return;

    var referrerEmail = '';
    if (/^\d+$/.test(referrerId)) referrerEmail = getCustomerEmailById_(referrerId);
    if (!referrerEmail) return;

    /* Prevent self-referral */
    if (referrerEmail.toLowerCase() === buyerEmail.toLowerCase()) {
      Logger.log('Self-referral blocked: ' + buyerEmail);
      return;
    }

    props.setProperty('credited_' + discountCode, '1');
    addPendingPoints_(referrerEmail, REFERRAL_BONUS, 'Empfehlung: ' + buyerEmail + ' (' + orderName + ')', orderId || '');

    try {
      var refSheet = getOrCreateReferralSheet_();
      var refData = refSheet.getDataRange().getValues();
      for (var r = 1; r < refData.length; r++) {
        if (String(refData[r][2]).toUpperCase() === discountCode) {
          refSheet.getRange(r + 1, 5).setValue('Ja');
          break;
        }
      }
    } catch (e2) {}

    Logger.log('Pending ' + REFERRAL_BONUS + ' pts for referrer ' + referrerEmail);
  } catch (e) {
    Logger.log('creditReferrer_ error: ' + e.message);
  }
}


/* ═══════════════════════════════════════════════════════
   LOYALTY: Get Points
   ═══════════════════════════════════════════════════════ */

function handleGetPoints_(customerId) {
  var email = getCustomerEmailById_(customerId);
  if (!email) return json_({ ok: false, error: 'customer_not_found' });
  return handleGetPointsByEmail_(email);
}

function handleGetPointsByEmail_(email) {
  email = String(email).trim().toLowerCase();
  var data = getCustomerData_(email);
  var tier = getTier_(data.points);
  var next = getNextTier_(data.points);

  return json_({
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
   REDEEM POINTS → Shopify discount code
   ═══════════════════════════════════════════════════════ */

function handleRedeemPoints_(email, pointsToRedeem) {
  email = String(email).trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json_({ ok: false, error: 'invalid_email' });
  }

  var redeemTier = null;
  for (var i = 0; i < REDEEM_TIERS.length; i++) {
    if (REDEEM_TIERS[i].points === pointsToRedeem) { redeemTier = REDEEM_TIERS[i]; break; }
  }
  if (!redeemTier) return json_({ ok: false, error: 'invalid_redeem_tier' });

  var data = getCustomerData_(email);
  if (data.points < redeemTier.points) {
    return json_({ ok: false, error: 'insufficient_points', required: redeemTier.points, current: data.points });
  }

  /* Rate limit: 60s between redeems */
  var props = PropertiesService.getScriptProperties();
  var lockKey = 'redeem_lock_' + email;
  var lastRedeem = props.getProperty(lockKey);
  if (lastRedeem && (Date.now() - parseInt(lastRedeem)) < 60000) {
    return json_({ ok: false, error: 'too_fast' });
  }
  props.setProperty(lockKey, String(Date.now()));

  var code = 'KXR-' + generateCode_('').replace('KX-', '');
  var discountResult = createShopifyFixedDiscount_(code, redeemTier.euro, 1);
  if (!discountResult.ok) {
    return json_({ ok: false, error: 'shopify_error', detail: discountResult.error });
  }

  addPoints_(email, -redeemTier.points, 'Eingelöst: ' + code + ' (€' + redeemTier.euro + ')', '');

  try {
    var q = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { id } } }';
    var result = gql_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      var newData = getCustomerData_(email);
      var newTier = getTier_(newData.points);
      updateCustomerMetafields_(nodes[0].id, newData.points, newTier.name);
      try { updateCustomerTierTag_(nodes[0].id, newTier.name); } catch (e) {}
    }
  } catch (e) {}

  var updated = getCustomerData_(email);
  return json_({
    ok: true,
    code: code,
    discount_euro: redeemTier.euro,
    points_spent: redeemTier.points,
    points_remaining: updated.points
  });
}


/* ═══════════════════════════════════════════════════════
   AFFILIATE: Click Tracking
   ═══════════════════════════════════════════════════════ */

function handleTrackClick_(ref, page) {
  ref = String(ref).trim();
  if (!ref) return json_({ ok: false, error: 'missing_ref' });

  /* Rate limit: max 500 clicks per ref per day */
  var props = PropertiesService.getScriptProperties();
  var today = new Date().toISOString().slice(0, 10);
  var clickKey = 'click_' + ref + '_' + today;
  var todayCount = parseInt(props.getProperty(clickKey) || '0');
  if (todayCount >= 500) return json_({ ok: true, tracked: false, reason: 'rate_limit' });
  props.setProperty(clickKey, String(todayCount + 1));

  try {
    var sheets = getOrCreateLoyaltySheet_();
    sheets.clicks.appendRow([new Date(), ref, page, today]);
  } catch (e) {
    Logger.log('trackClick error: ' + e.message);
  }

  return json_({ ok: true, tracked: true });
}


/* ═══════════════════════════════════════════════════════
   AFFILIATE: Dashboard Data
   ═══════════════════════════════════════════════════════ */

function handleAffiliateDashboard_(customerId, email) {
  if (customerId && !email) email = getCustomerEmailById_(customerId);
  if (!email) return json_({ ok: false, error: 'customer_not_found' });
  email = String(email).trim().toLowerCase();

  /* Resolve Shopify customer ID (used as ref in links) */
  var refId = '';
  try {
    var q = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { id legacyResourceId } } }';
    var result = gql_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      refId = nodes[0].legacyResourceId || nodes[0].id.replace('gid://shopify/Customer/', '');
    }
  } catch (e) {}

  if (!refId) return json_({ ok: false, error: 'no_customer_id' });

  /* 1. Click statistics */
  var clickStats = { total: 0, today: 0, days7: 0, days30: 0, daily: [], top_pages: [] };
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var clickData = sheets.clicks.getDataRange().getValues();
    var now = new Date();
    var todayStr = now.toISOString().slice(0, 10);
    var d7 = new Date(now.getTime() - 7 * 86400000);
    var d30 = new Date(now.getTime() - 30 * 86400000);
    var dailyMap = {};
    var pageMap = {};

    for (var i = 1; i < clickData.length; i++) {
      if (String(clickData[i][1]) !== refId) continue;
      clickStats.total++;
      var clickDate = new Date(clickData[i][0]);
      var clickPage = String(clickData[i][2] || '/');
      var dayKey = clickDate.toISOString().slice(0, 10);
      if (dayKey === todayStr) clickStats.today++;
      if (clickDate >= d7) clickStats.days7++;
      if (clickDate >= d30) {
        clickStats.days30++;
        dailyMap[dayKey] = (dailyMap[dayKey] || 0) + 1;
      }
      pageMap[clickPage] = (pageMap[clickPage] || 0) + 1;
    }

    for (var d = 29; d >= 0; d--) {
      var dt = new Date(now.getTime() - d * 86400000);
      var dk = dt.toISOString().slice(0, 10);
      clickStats.daily.push({ date: dk, clicks: dailyMap[dk] || 0 });
    }

    var pageArr = [];
    for (var pg in pageMap) { pageArr.push({ page: pg, clicks: pageMap[pg] }); }
    pageArr.sort(function (a, b) { return b.clicks - a.clicks; });
    clickStats.top_pages = pageArr.slice(0, 10);
  } catch (e) { Logger.log('affiliate clicks error: ' + e.message); }

  /* 2. Referral data */
  var referrals = [];
  var totalPurchases = 0;
  var totalEarned = 0;
  try {
    var refSheet = getOrCreateReferralSheet_();
    var refData = refSheet.getDataRange().getValues();
    for (var j = 1; j < refData.length; j++) {
      if (String(refData[j][3] || '') !== refId) continue;

      var refEmail = String(refData[j][1] || '');
      var refCode = String(refData[j][2] || '');
      var refDate = refData[j][0] ? new Date(refData[j][0]).toISOString() : '';

      var props = PropertiesService.getScriptProperties();
      var wasCredited = !!props.getProperty('credited_' + refCode);
      if (wasCredited) { totalPurchases++; totalEarned += REFERRAL_BONUS; }

      var parts = refEmail.split('@');
      var masked = parts[0].charAt(0) + '***' + (parts[0].length > 1 ? parts[0].charAt(parts[0].length - 1) : '') + '@' + parts[1];

      referrals.push({
        email_masked: masked,
        code: refCode,
        date: refDate,
        purchased: wasCredited,
        points_earned: wasCredited ? REFERRAL_BONUS : 0
      });
    }
  } catch (e) { Logger.log('affiliate referrals error: ' + e.message); }

  /* 3. Pending points & loyalty data */
  var pending = getPendingPoints_(email);
  var data = getCustomerData_(email);
  var tier = getTier_(data.points);

  return json_({
    ok: true,
    ref_id: refId,
    ref_link: 'https://www.karinex.de/?ref=' + refId,
    email: email,
    points: data.points,
    tier: tier.name,
    cashback: tier.cashback,
    clicks: clickStats,
    referrals: referrals,
    total_referrals: referrals.length,
    total_purchases: totalPurchases,
    total_earned: totalEarned,
    pending_points: pending.total,
    pending_items: pending.items,
    conversion_rate: referrals.length > 0 ? Math.round((totalPurchases / referrals.length) * 100) : 0
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
   SHOPIFY: GraphQL
   ═══════════════════════════════════════════════════════ */

function gql_(query, variables) {
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

  var result = gql_(mutation, variables);
  if (result.data && result.data.discountCodeBasicCreate) {
    var errs = result.data.discountCodeBasicCreate.userErrors;
    if (errs && errs.length) return { ok: false, error: errs[0].message };
    return { ok: true };
  }
  if (result.errors) return { ok: false, error: result.errors[0].message };
  return { ok: false, error: 'unexpected_response' };
}

function createShopifyFixedDiscount_(code, amountEuro, usageLimit) {
  var mutation = 'mutation discountCodeBasicCreate($d: DiscountCodeBasicInput!) {'
    + ' discountCodeBasicCreate(basicCodeDiscount: $d) {'
    + '   codeDiscountNode { id } userErrors { field message }'
    + ' } }';

  var variables = {
    d: {
      title: 'Loyalty Redeem ' + code,
      code: code,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      usageLimit: usageLimit,
      appliesOncePerCustomer: true,
      customerSelection: { all: true },
      customerGets: {
        value: { discountAmount: { amount: String(amountEuro), appliesOnEachItem: false } },
        items: { all: true }
      },
      combinesWith: { orderDiscounts: false, productDiscounts: true, shippingDiscounts: true }
    }
  };

  var result = gql_(mutation, variables);
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
  var q = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { id tags } } }';
  var result = gql_(q);
  var nodes = result.data && result.data.customers && result.data.customers.nodes;
  if (!nodes || !nodes.length) return;

  var cust = nodes[0];
  var tags = (cust.tags || []).concat(['referral', 'ref_' + refCode, discountCode]);
  var unique = tags.filter(function (t, i, a) { return a.indexOf(t) === i; });

  gql_('mutation { customerUpdate(input: { id: "' + cust.id + '", tags: ' + JSON.stringify(unique) + ' }) { userErrors { message } } }');
}

function updateCustomerTierTag_(customerId, tierName) {
  var gid = /^gid:/.test(customerId) ? customerId : 'gid://shopify/Customer/' + customerId;
  var q = '{ customer(id: "' + gid + '") { tags } }';
  var result = gql_(q);
  if (!result.data || !result.data.customer) return;

  var tags = result.data.customer.tags || [];
  tags = tags.filter(function (t) { return t.indexOf('tier_') !== 0; });
  tags.push('tier_' + tierName);
  var unique = tags.filter(function (t, i, a) { return a.indexOf(t) === i; });

  gql_('mutation { customerUpdate(input: { id: "' + gid + '", tags: ' + JSON.stringify(unique) + ' }) { userErrors { message } } }');
}

function getCustomerEmailById_(customerId) {
  var gid = /^gid:/.test(customerId) ? customerId : 'gid://shopify/Customer/' + customerId;
  var result = gql_('{ customer(id: "' + gid + '") { email } }');
  return (result.data && result.data.customer) ? result.data.customer.email : '';
}

function updateCustomerMetafields_(customerId, points, tierName) {
  var gid = /^gid:/.test(customerId) ? customerId : 'gid://shopify/Customer/' + customerId;
  var mutation = 'mutation customerUpdate($input: CustomerInput!) {'
    + ' customerUpdate(input: $input) { userErrors { field message } } }';

  gql_(mutation, {
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
      var pend = ss.getSheetByName('Pending');
      if (!pend) {
        pend = ss.insertSheet('Pending');
        pend.getRange(1, 1, 1, 7).setValues([['Datum', 'Email', 'Punkte', 'Grund', 'Freigabe', 'OrderID', 'Status']]);
        pend.getRange(1, 1, 1, 7).setFontWeight('bold');
        pend.setFrozenRows(1);
      }
      var clicks = ss.getSheetByName('Clicks');
      if (!clicks) {
        clicks = ss.insertSheet('Clicks');
        clicks.getRange(1, 1, 1, 4).setValues([['Datum', 'ReferrerID', 'Seite', 'Tag']]);
        clicks.getRange(1, 1, 1, 4).setFontWeight('bold');
        clicks.setFrozenRows(1);
      }
      return { points: pts, history: hist, pending: pend, clicks: clicks };
    } catch (e) {}
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

  var pend = ss.insertSheet('Pending');
  pend.getRange(1, 1, 1, 7).setValues([['Datum', 'Email', 'Punkte', 'Grund', 'Freigabe', 'OrderID', 'Status']]);
  pend.getRange(1, 1, 1, 7).setFontWeight('bold');
  pend.setFrozenRows(1);

  var clicks = ss.insertSheet('Clicks');
  clicks.getRange(1, 1, 1, 4).setValues([['Datum', 'ReferrerID', 'Seite', 'Tag']]);
  clicks.getRange(1, 1, 1, 4).setFontWeight('bold');
  clicks.setFrozenRows(1);

  return { points: pts, history: hist, pending: pend, clicks: clicks };
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
  } catch (e) {}

  /* Sync from Shopify metafields if not in sheet */
  try {
    var shopifyPoints = getShopifyMetafieldPoints_(email);
    if (shopifyPoints > 0) {
      var sheets2 = getOrCreateLoyaltySheet_();
      var tier = getTier_(shopifyPoints);
      sheets2.points.appendRow([email, shopifyPoints, tier.name, new Date()]);
      sheets2.history.appendRow([new Date(), email, '+' + shopifyPoints, 'Sync aus Shopify-Metafields', shopifyPoints]);
      var newData = sheets2.points.getDataRange().getValues();
      return { points: shopifyPoints, row: newData.length };
    }
  } catch (e) {}

  return { points: 0, row: 0 };
}

function getShopifyMetafieldPoints_(email) {
  try {
    var q = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { metafields(first:10, namespace:"karinex") { nodes { key value } } } } }';
    var result = gql_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      var mf = nodes[0].metafields && nodes[0].metafields.nodes || [];
      for (var i = 0; i < mf.length; i++) {
        if (mf[i].key === 'loyalty_points') return parseInt(mf[i].value) || 0;
      }
    }
  } catch (e) {}
  return 0;
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

    sheets.history.appendRow([
      new Date(), email, (points >= 0 ? '+' : '') + points, reason, newTotal
    ]);
  } catch (e) {
    Logger.log('addPoints_ error: ' + e.message);
  }
}


/* ═══════════════════════════════════════════════════════
   PENDING POINTS: 30-day hold
   ═══════════════════════════════════════════════════════ */

function addPendingPoints_(email, points, reason, orderId) {
  email = String(email).trim().toLowerCase();
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var releaseDate = new Date(Date.now() + 30 * 86400000);
    sheets.pending.appendRow([new Date(), email, points, reason, releaseDate, orderId || '', 'pending']);
  } catch (e) {
    Logger.log('addPendingPoints_ error: ' + e.message);
  }
}

function getPendingPoints_(email) {
  email = String(email).trim().toLowerCase();
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.pending.getDataRange().getValues();
    var total = 0;
    var items = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).toLowerCase() === email && String(data[i][6]) === 'pending') {
        var pts = parseInt(data[i][2]) || 0;
        total += pts;
        var rel = data[i][4] ? new Date(data[i][4]) : new Date();
        items.push({
          points: pts,
          reason: String(data[i][3]),
          releaseDate: rel.toISOString(),
          daysLeft: Math.max(0, Math.ceil((rel.getTime() - Date.now()) / 86400000))
        });
      }
    }
    return { total: total, items: items };
  } catch (e) {
    return { total: 0, items: [] };
  }
}

function releasePendingPoints() {
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.pending.getDataRange().getValues();
    var now = new Date();
    var released = 0;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][6]) === 'pending' && new Date(data[i][4]) <= now) {
        var email = String(data[i][1]).toLowerCase();
        var points = parseInt(data[i][2]) || 0;
        var reason = String(data[i][3]) + ' (freigegeben)';

        addPoints_(email, points, reason, '');
        sheets.pending.getRange(i + 1, 7).setValue('released');
        released++;

        try {
          var q = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { id } } }';
          var result = gql_(q);
          var nodes = result.data && result.data.customers && result.data.customers.nodes;
          if (nodes && nodes.length) {
            var nd = getCustomerData_(email);
            var nt = getTier_(nd.points);
            updateCustomerMetafields_(nodes[0].id, nd.points, nt.name);
            try { updateCustomerTierTag_(nodes[0].id, nt.name); } catch (e) {}
          }
        } catch (e) {}
      }
    }

    Logger.log('releasePendingPoints: ' + released + ' released');
  } catch (e) {
    Logger.log('releasePendingPoints error: ' + e.message);
  }
}

function cancelPendingByOrder_(orderId) {
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.pending.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][5]) === String(orderId) && String(data[i][6]) === 'pending') {
        sheets.pending.getRange(i + 1, 7).setValue('cancelled');
      }
    }
  } catch (e) {}
}


/* ═══════════════════════════════════════════════════════
   ORDER CANCELLATION / REFUND REVERSAL
   ═══════════════════════════════════════════════════════ */

function checkCancelledOrders() {
  var props = PropertiesService.getScriptProperties();
  var lastCheck = props.getProperty('LAST_CANCEL_CHECK');
  if (!lastCheck) lastCheck = new Date(Date.now() - 86400000).toISOString();

  try {
    var headers = { 'X-Shopify-Access-Token': getToken_() };
    var allOrders = [];

    var url1 = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/orders.json'
      + '?status=cancelled&updated_at_min=' + encodeURIComponent(lastCheck)
      + '&limit=250&fields=id,name,order_number,email,cancelled_at';
    var resp1 = UrlFetchApp.fetch(url1, { headers: headers, muteHttpExceptions: true });
    allOrders = allOrders.concat(JSON.parse(resp1.getContentText()).orders || []);

    var url2 = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/orders.json'
      + '?financial_status=refunded&updated_at_min=' + encodeURIComponent(lastCheck)
      + '&limit=250&fields=id,name,order_number,email';
    var resp2 = UrlFetchApp.fetch(url2, { headers: headers, muteHttpExceptions: true });
    allOrders = allOrders.concat(JSON.parse(resp2.getContentText()).orders || []);

    var seen = {};
    var reversed = 0;

    for (var i = 0; i < allOrders.length; i++) {
      var oid = String(allOrders[i].id);
      if (seen[oid]) continue;
      seen[oid] = true;

      if (props.getProperty('reversed_' + oid)) continue;

      var earnedData = props.getProperty('earned_' + oid);
      if (!earnedData) continue;

      try {
        var ed = JSON.parse(earnedData);
        addPoints_(ed.email, -ed.points, 'Storniert: ' + ed.orderName, '');
        props.setProperty('reversed_' + oid, '1');
        reversed++;

        cancelPendingByOrder_(oid);

        try {
          var q = '{ customers(first:1, query:"email:' + gqlSafe_(ed.email) + '") { nodes { id } } }';
          var result = gql_(q);
          var nodes = result.data && result.data.customers && result.data.customers.nodes;
          if (nodes && nodes.length) {
            var nd = getCustomerData_(ed.email);
            var nt = getTier_(nd.points);
            updateCustomerMetafields_(nodes[0].id, nd.points, nt.name);
          }
        } catch (e) {}

        Logger.log('Reversed ' + ed.points + ' pts for ' + ed.orderName);
      } catch (e) {}
    }

    Logger.log('checkCancelledOrders: ' + reversed + ' reversed');
  } catch (err) {
    Logger.log('checkCancelledOrders error: ' + err.message);
  }

  props.setProperty('LAST_CANCEL_CHECK', new Date().toISOString());
}

function dailyMaintenance() {
  releasePendingPoints();
  checkCancelledOrders();
  Logger.log('dailyMaintenance completed: ' + new Date().toISOString());
}


/* ═══════════════════════════════════════════════════════
   STORAGE: Referral Sheet
   ═══════════════════════════════════════════════════════ */

function getOrCreateReferralSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty('REFERRAL_SHEET_ID');

  if (sid) {
    try {
      var ss = SpreadsheetApp.openById(sid);
      return ss.getSheetByName('ReferralCodes') || ss.insertSheet('ReferralCodes');
    } catch (e) {}
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/* ═══════════════════════════════════════════════════════
   ADMIN: Auth & Handlers
   ═══════════════════════════════════════════════════════ */

function verifyAdmin_(key) {
  if (key === ADMIN_KEY_FIXED) return true;
  var adminKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return adminKey && key === adminKey;
}

function handleAdminPoints_(email, points, reason) {
  email = String(email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json_({ ok: false, error: 'invalid_email' });
  }
  if (!points || points === 0) return json_({ ok: false, error: 'invalid_points' });

  addPoints_(email, points, reason, '');

  try {
    var q = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { id } } }';
    var result = gql_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      var newData = getCustomerData_(email);
      var newTier = getTier_(newData.points);
      updateCustomerMetafields_(nodes[0].id, newData.points, newTier.name);
      try { updateCustomerTierTag_(nodes[0].id, newTier.name); } catch (e) {}
    }
  } catch (e) {}

  var updated = getCustomerData_(email);
  var tier = getTier_(updated.points);
  return json_({ ok: true, email: email, points: updated.points, tier: tier.name, changed: points });
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
    customers.sort(function (a, b) { return b.points - a.points; });
    return json_({ ok: true, customers: customers, total: customers.length });
  } catch (e) {
    return json_({ ok: false, error: e.message });
  }
}


/* ═══════════════════════════════════════════════════════
   ADMIN: Server-side functions (google.script.run)
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
    var q = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { id } } }';
    var result = gql_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      var newData = getCustomerData_(email);
      var newTier = getTier_(newData.points);
      updateCustomerMetafields_(nodes[0].id, newData.points, newTier.name);
      try { updateCustomerTierTag_(nodes[0].id, newTier.name); } catch (e) {}
    }
  } catch (e) {}

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
    customers.sort(function (a, b) { return b.points - a.points; });
    return { ok: true, customers: customers, total: customers.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function adminGetRecentOrders(daysBack) {
  daysBack = parseInt(daysBack) || 30;
  var since = new Date(Date.now() - daysBack * 86400000).toISOString();
  try {
    var url = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/orders.json'
      + '?status=any&limit=100'
      + '&created_at_min=' + encodeURIComponent(since)
      + '&fields=id,name,order_number,email,total_price,subtotal_price,created_at,financial_status,fulfillment_status,customer'
      + '&order=created_at+DESC';

    var resp = UrlFetchApp.fetch(url, {
      headers: { 'X-Shopify-Access-Token': getToken_() },
      muteHttpExceptions: true
    });
    var orders = JSON.parse(resp.getContentText()).orders || [];
    var result = [];

    for (var i = 0; i < orders.length; i++) {
      var o     = orders[i];
      var email = String(o.email || '').trim().toLowerCase();
      var sub   = parseFloat(o.subtotal_price || 0);
      var cData = email ? getCustomerData_(email) : { points: 0 };
      var tier  = getTier_(cData.points);
      var earned = email ? Math.round(sub * POINTS_PER_EURO * (tier.cashback / 100)) : 0;

      result.push({
        name:            o.name || '#' + o.order_number,
        date:            o.created_at || '',
        email:           email,
        total:           parseFloat(o.total_price || 0),
        subtotal:        sub,
        financial:       o.financial_status || '',
        fulfillment:     o.fulfillment_status || 'unfulfilled',
        points_earned:   earned,
        customer_points: cData.points,
        tier:            tier.name
      });
    }

    return { ok: true, orders: result, total: result.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function adminGetRewardsCustomers() {
  var result = adminListCustomers();
  if (!result.ok) return result;
  var rewarded = result.customers.filter(function (c) { return c.points > 0; });
  return { ok: true, customers: rewarded, total: rewarded.length };
}

function adminGetStats() {
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.points.getDataRange().getValues();
    var s = { total: 0, gold: 0, silber: 0, bronze: 0, totalPoints: 0, totalPending: 0 };
    for (var i = 1; i < data.length; i++) {
      s.total++;
      s.totalPoints += parseInt(data[i][1]) || 0;
      var t = String(data[i][2] || 'bronze').toLowerCase();
      if (t === 'gold') s.gold++; else if (t === 'silber') s.silber++; else s.bronze++;
    }
    try {
      var pendData = sheets.pending.getDataRange().getValues();
      for (var j = 1; j < pendData.length; j++) {
        if (String(pendData[j][6]) === 'pending') s.totalPending += parseInt(pendData[j][2]) || 0;
      }
    } catch (e) {}
    return { ok: true, stats: s };
  } catch (e) { return { ok: false, error: e.message }; }
}

/* ── Sync all customers from Shopify metafields into the Points sheet ── */
function adminSyncFromShopify() {
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var existing = sheets.points.getDataRange().getValues();
    var existingEmails = {};
    for (var e = 1; e < existing.length; e++) {
      existingEmails[String(existing[e][0]).toLowerCase()] = true;
    }

    var synced = 0;
    var cursor = null;
    var hasNext = true;

    while (hasNext) {
      var afterClause = cursor ? ', after: "' + cursor + '"' : '';
      var q = '{ customers(first: 250' + afterClause + ') { pageInfo { hasNextPage endCursor } nodes { email metafields(first: 5, namespace: "karinex") { nodes { key value } } } } }';
      var result = gql_(q);
      var page = result.data && result.data.customers;
      if (!page) break;

      var nodes = page.nodes || [];
      for (var i = 0; i < nodes.length; i++) {
        var cust = nodes[i];
        if (!cust.email) continue;
        var email = String(cust.email).trim().toLowerCase();
        var mf = (cust.metafields && cust.metafields.nodes) || [];
        var pts = 0;
        var tierVal = 'bronze';
        for (var m = 0; m < mf.length; m++) {
          if (mf[m].key === 'loyalty_points') pts = parseInt(mf[m].value) || 0;
          if (mf[m].key === 'loyalty_tier') tierVal = String(mf[m].value || 'bronze');
        }
        if (pts <= 0) continue; /* skip customers with no points */
        if (!existingEmails[email]) {
          sheets.points.appendRow([email, pts, tierVal, new Date()]);
          sheets.history.appendRow([new Date(), email, '+' + pts, 'Sync aus Shopify', pts]);
          existingEmails[email] = true;
          synced++;
        }
      }

      hasNext = page.pageInfo && page.pageInfo.hasNextPage;
      cursor = page.pageInfo && page.pageInfo.endCursor;
    }

    return { ok: true, synced: synced };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ── Backfill: import ALL historical paid orders → calculate points ── */
function backfillHistoricalOrders() {
  var props     = PropertiesService.getScriptProperties();
  var processed = 0;
  var skipped   = 0;
  var hasNext   = true;
  var pageInfo  = null;

  while (hasNext) {
    var url = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/orders.json'
      + '?status=any&financial_status=paid&limit=250'
      + '&fields=id,name,order_number,email,subtotal_price,customer,discount_codes'
      + (pageInfo ? '&page_info=' + encodeURIComponent(pageInfo) : '');

    var resp = UrlFetchApp.fetch(url, {
      headers: { 'X-Shopify-Access-Token': getToken_() },
      muteHttpExceptions: true
    });

    /* Shopify cursor pagination via Link header */
    var linkHeader = resp.getHeaders()['Link'] || resp.getHeaders()['link'] || '';
    var nextMatch  = linkHeader.match(/page_info=([^&>"]+)[^>]*>;\s*rel="next"/);
    pageInfo       = nextMatch ? nextMatch[1] : null;
    hasNext        = !!pageInfo;

    var orders = JSON.parse(resp.getContentText()).orders || [];
    if (!orders.length) break;

    for (var i = 0; i < orders.length; i++) {
      var order = orders[i];
      var oid   = String(order.id);

      if (props.getProperty('processed_' + oid)) { skipped++; continue; }
      if (!order.email) continue;

      var email      = String(order.email).trim().toLowerCase();
      var subtotal   = parseFloat(order.subtotal_price || 0);
      var customerId = (order.customer && order.customer.id) ? String(order.customer.id) : '';
      var orderName  = order.name || '#' + order.order_number;

      var data   = getCustomerData_(email);
      var tier   = getTier_(data.points);
      var earned = Math.round(subtotal * POINTS_PER_EURO * (tier.cashback / 100));

      if (earned > 0) {
        addPoints_(email, earned, 'Import: ' + orderName + ' (' + tier.cashback + '% Cashback)', customerId);
      }
      props.setProperty('processed_' + oid, '1');
      processed++;
    }
  }

  return { ok: true, processed: processed, skipped: skipped };
}

/* ── Push all Sheet points → Shopify metafields ── */
function pushMetafieldsToShopify() {
  try {
    var sheets  = getOrCreateLoyaltySheet_();
    var data    = sheets.points.getDataRange().getValues();
    var updated = 0;

    for (var i = 1; i < data.length; i++) {
      var email = String(data[i][0]);
      var pts   = parseInt(data[i][1]) || 0;
      var tier  = getTier_(pts);

      try {
        var q      = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { id } } }';
        var result = gql_(q);
        var nodes  = result.data && result.data.customers && result.data.customers.nodes;
        if (nodes && nodes.length) {
          updateCustomerMetafields_(nodes[0].id, pts, tier.name);
          try { updateCustomerTierTag_(nodes[0].id, tier.name); } catch (e) {}
          updated++;
        }
      } catch (e) {}

      Utilities.sleep(300); /* Shopify rate-limit guard */
    }

    return { ok: true, updated: updated };
  } catch (e) {
    return { ok: false, error: e.message };
  }
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
    } catch (e) { return { ok: false, error: e.message }; }
  }
  try {
    var q = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { id } } }';
    var result = gql_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      var nd = getCustomerData_(email); var nt = getTier_(nd.points);
      updateCustomerMetafields_(nodes[0].id, nd.points, nt.name);
    }
  } catch (e) {}
  var d = getCustomerData_(email); var t = getTier_(d.points);
  return { ok: true, email: email, points: d.points, tier: t.name };
}

function adminGetHistory(email) {
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var data = sheets.history.getDataRange().getValues();
    var hist = []; email = email ? String(email).trim().toLowerCase() : '';
    for (var i = 1; i < data.length; i++) {
      var r = {
        date: data[i][0] ? new Date(data[i][0]).toISOString() : '',
        email: String(data[i][1] || ''),
        points: String(data[i][2] || ''),
        reason: String(data[i][3] || ''),
        balance: parseInt(data[i][4]) || 0
      };
      if (!email || r.email.toLowerCase() === email) hist.push(r);
    }
    hist.reverse();
    return { ok: true, history: hist.slice(0, 200), total: hist.length };
  } catch (e) { return { ok: false, error: e.message }; }
}

function adminGetCustomerProfile(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'missing_email' };

  var profile = { ok: true, email: email, shopify: null, orders: [], referralCode: null, referredBy: null, pointsHistory: [] };

  /* Loyalty data */
  var data = getCustomerData_(email);
  var tier = getTier_(data.points);
  var next = getNextTier_(data.points);
  profile.points = data.points;
  profile.tier = tier.name;
  profile.cashback = tier.cashback;
  profile.next_tier = next ? next.name : null;
  profile.points_to_next = next ? next.min - data.points : 0;

  /* Shopify customer data */
  try {
    var q = '{ customers(first:1, query:"email:' + gqlSafe_(email) + '") { nodes { id firstName lastName phone createdAt tags numberOfOrders amountSpent { amount currencyCode } } } }';
    var result = gql_(q);
    var nodes = result.data && result.data.customers && result.data.customers.nodes;
    if (nodes && nodes.length) {
      var c = nodes[0];
      profile.shopify = {
        id: c.id,
        name: ((c.firstName || '') + ' ' + (c.lastName || '')).trim() || '-',
        phone: c.phone || '-',
        createdAt: c.createdAt || '',
        tags: c.tags || [],
        orderCount: parseInt(c.numberOfOrders) || 0,
        totalSpent: c.amountSpent ? (parseFloat(c.amountSpent.amount) || 0) : 0,
        currency: c.amountSpent ? (c.amountSpent.currencyCode || 'EUR') : 'EUR'
      };

      /* Recent orders (6 months) */
      var gid = c.id;
      var oq = '{ customer(id: "' + gid + '") { orders(first:50, sortKey:CREATED_AT, reverse:true) { nodes { id name createdAt totalPriceSet { shopMoney { amount currencyCode } } displayFinancialStatus displayFulfillmentStatus lineItems(first:10) { nodes { title quantity originalUnitPriceSet { shopMoney { amount } } } } } } } }';
      var oResult = gql_(oq);
      if (oResult.data && oResult.data.customer && oResult.data.customer.orders) {
        var sixMonthsAgo = new Date(Date.now() - 180 * 86400000);
        var oNodes = oResult.data.customer.orders.nodes || [];
        for (var i = 0; i < oNodes.length; i++) {
          var o = oNodes[i];
          if (new Date(o.createdAt) < sixMonthsAgo) continue;
          var items = [];
          var li = (o.lineItems && o.lineItems.nodes) || [];
          for (var j = 0; j < li.length; j++) {
            items.push({ title: li[j].title, qty: li[j].quantity, price: li[j].originalUnitPriceSet ? li[j].originalUnitPriceSet.shopMoney.amount : '0' });
          }
          profile.orders.push({
            name: o.name, date: o.createdAt,
            total: o.totalPriceSet ? o.totalPriceSet.shopMoney.amount : '0',
            currency: o.totalPriceSet ? o.totalPriceSet.shopMoney.currencyCode : 'EUR',
            financial: o.displayFinancialStatus || '',
            fulfillment: o.displayFulfillmentStatus || '',
            items: items
          });
        }
      }
    }
  } catch (e) { Logger.log('profile shopify error: ' + e.message); }

  /* Referral code */
  try {
    profile.referralCode = PropertiesService.getScriptProperties().getProperty('ref_' + email) || null;
  } catch (e) {}

  /* Points history */
  try {
    var sheets = getOrCreateLoyaltySheet_();
    var hData = sheets.history.getDataRange().getValues();
    for (var i = 1; i < hData.length; i++) {
      if (String(hData[i][1] || '').toLowerCase() === email) {
        profile.pointsHistory.push({
          date: hData[i][0] ? new Date(hData[i][0]).toISOString() : '',
          points: String(hData[i][2] || ''),
          reason: String(hData[i][3] || ''),
          balance: parseInt(hData[i][4]) || 0
        });
      }
    }
    profile.pointsHistory.reverse();
    profile.pointsHistory = profile.pointsHistory.slice(0, 50);
  } catch (e) {}

  /* Pending points */
  profile.pendingPoints = getPendingPoints_(email);

  return profile;
}


/* ═══════════════════════════════════════════════════════
   ADMIN: Dashboard HTML
   ═══════════════════════════════════════════════════════ */

function serveAdminDashboard_() {
  var raw = getAdminHtml_();
  /* Split HTML and JS — GAS HtmlService rejects < in <script> as HTML tags.
     Use createTemplate with force-printing scriptlet <?!= ?> to inject JS
     without HTML validation. */
  var sOpen = '<script>';
  var sClose = '</script>';
  var si = raw.indexOf(sOpen);
  var se = raw.indexOf(sClose);
  var htmlPart = raw.substring(0, si);
  var jsPart = raw.substring(si + sOpen.length, se);
  var htmlEnd = raw.substring(se + sClose.length);

  var tmpl = HtmlService.createTemplate(
    htmlPart + '<script><?!= jsCode ?>' + sClose + htmlEnd
  );
  tmpl.jsCode = jsPart;
  return tmpl.evaluate()
    .setTitle('Karinex Admin - Loyalty Points')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAdminHtml_() {
  var h = '<!DOCTYPE html>'
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
+ '<a onclick="go(\'prof\')" data-p="prof"><span class="ic">&#128100;</span> Kundenprofil</a>'
+ '<a onclick="go(\'best\')" data-p="best"><span class="ic">&#128722;</span> Bestellungen</a>'
+ '<a onclick="go(\'rewards\')" data-p="rewards"><span class="ic">&#127873;</span> Rewards-Kunden</a>'
+ '</div>'
+ '<div class="sb-f">Karinex Loyalty v2.11.7</div>'
+ '</nav>'
+ '<div class="mn">'
+ '<div class="pg on" id="pg-dash">'
+ '<div class="pt">Dashboard</div>'
+ '<div class="stats">'
+ '<div class="sc a"><div class="lb">Gesamt Kunden</div><div class="vl" id="sT">&#8212;</div></div>'
+ '<div class="sc gr"><div class="lb">Gesamtpunkte</div><div class="vl" id="sP">&#8212;</div></div>'
+ '<div class="sc go"><div class="lb">Gold Kunden</div><div class="vl" id="sG">&#8212;</div></div>'
+ '<div class="sc si"><div class="lb">Silber Kunden</div><div class="vl" id="sS">&#8212;</div></div>'
+ '<div class="sc" style="border-left:3px solid var(--bronze)"><div class="lb">Bronze Kunden</div><div class="vl" id="sB" style="color:var(--bronze)">&#8212;</div></div>'
+ '<div class="sc" style="border-left:3px solid var(--gold)"><div class="lb">Reservierte Punkte</div><div class="vl" id="sPend" style="color:var(--gold)">&#8212;</div></div>'
+ '</div>'
+ '<div class="cd"><h2>&#9881; System-Verwaltung</h2>'
+ '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px">'
+ '<div style="background:#f8fafc;border-radius:8px;padding:16px">'
+ '<div style="font-size:13px;font-weight:600;margin-bottom:4px">&#128229; Bestellungen importieren</div>'
+ '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px">Berechnet Punkte fuer alle bisherigen Shopify-Bestellungen. Nur einmalig noetig.</div>'
+ '<button class="bt bf" id="backfillBtn" onclick="doBackfill()">&#128229; Jetzt importieren</button>'
+ '</div>'
+ '<div style="background:#f8fafc;border-radius:8px;padding:16px">'
+ '<div style="font-size:13px;font-weight:600;margin-bottom:4px">&#128257; Nach Shopify schreiben</div>'
+ '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px">Schreibt alle Punkte als Metafelder in Shopify. Nach Import ausfuehren.</div>'
+ '<button class="bd bf" id="pushBtn" onclick="doPushMeta()">&#128257; Metafelder aktualisieren</button>'
+ '</div>'
+ '<div style="background:#f8fafc;border-radius:8px;padding:16px">'
+ '<div style="font-size:13px;font-weight:600;margin-bottom:4px">&#128260; Aus Shopify einlesen</div>'
+ '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px">Importiert vorhandene Metafeld-Punkte aus Shopify in das System.</div>'
+ '<button class="bo bf" id="syncBtn" onclick="doSync()">&#128260; Synchronisieren</button>'
+ '</div>'
+ '</div></div>'
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
+ '<div style="display:flex;gap:8px;margin-bottom:16px"><button class="bd" onclick="doList()">&#8635; Aktualisieren</button></div>'
+ '<div id="cTbl"><div class="emp">Wird geladen...</div></div></div>'
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
+ '<div id="hTbl"><div class="emp">Wird geladen...</div></div></div>'
+ '</div>'
+ '<div class="pg" id="pg-prof">'
+ '<div class="pt">Kundenprofil <span>Detailansicht eines Kunden</span></div>'
+ '<div class="cd"><h2>&#128269; Kunde suchen</h2>'
+ '<div style="display:flex;gap:8px"><input type="email" id="pEm" placeholder="E-Mail eingeben..." style="margin-bottom:0"><button class="bt" onclick="loadProfile()" style="white-space:nowrap">Profil laden</button></div>'
+ '<div id="pMsg" class="msg"></div></div>'
+ '<div id="pDet" style="display:none">'
+ '<div class="cd" id="pInfo"></div>'
+ '<div class="cd" id="pOrders"></div>'
+ '<div class="cd" id="pPending"></div>'
+ '<div class="cd" id="pHist"></div>'
+ '</div>'
+ '</div>'
+ '<div class="pg" id="pg-best">'
+ '<div class="pt">Bestellungen <span>Live aus Shopify</span></div>'
+ '<div class="cd"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">'
+ '<button class="bt" onclick="doOrders(30)">Letzte 30 Tage</button>'
+ '<button class="bo" onclick="doOrders(7)">7 Tage</button>'
+ '<button class="bo" onclick="doOrders(90)">90 Tage</button>'
+ '<button class="bo" onclick="doOrders(365)">1 Jahr</button>'
+ '</div>'
+ '<div id="bTbl"><div class="emp">Wird geladen...</div></div></div>'
+ '</div>'
+ '<div class="pg" id="pg-rewards">'
+ '<div class="pt">Rewards-Kunden <span>Kunden mit Treuepunkten</span></div>'
+ '<div class="cd"><div style="display:flex;gap:8px;margin-bottom:16px">'
+ '<button class="bd" onclick="doRewards()">&#8635; Aktualisieren</button>'
+ '<button class="bg" onclick="go(\'neu\')">&#10133; Neuen Kunden hinzufuegen</button>'
+ '</div>'
+ '<div id="rwSt" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">'
+ '<div class="sc a"><div class="lb">Rewards-Kunden</div><div class="vl" id="rwT">&#8212;</div></div>'
+ '<div class="sc go"><div class="lb">Gold</div><div class="vl" id="rwG">&#8212;</div></div>'
+ '<div class="sc si"><div class="lb">Silber</div><div class="vl" id="rwS">&#8212;</div></div>'
+ '<div class="sc" style="border-left:3px solid var(--bronze)"><div class="lb">Bronze</div><div class="vl" id="rwB" style="color:var(--bronze)">&#8212;</div></div>'
+ '</div>'
+ '<div id="rwTbl"><div class="emp">Wird geladen...</div></div></div>'
+ '</div>'
+ '</div>'
+ '<div class="toast" id="tst"></div>'
+ '<script>'
+ 'function go(p){var pgs=document.querySelectorAll(\'.pg\');for(var i=0;i<pgs.length;i++)pgs[i].classList.remove(\'on\');document.getElementById(\'pg-\'+p).classList.add(\'on\');var lk=document.querySelectorAll(\'.nav a\');for(var j=0;j<lk.length;j++)lk[j].classList.remove(\'on\');var a=document.querySelector(\'[data-p="\'+p+\'"]\');if(a)a.classList.add(\'on\');if(p===\'dash\')loadDash();if(p===\'cust\')doList();if(p===\'hist\')doHist();if(p===\'best\')doOrders(30);if(p===\'rewards\')doRewards();document.getElementById(\'sb\').classList.remove(\'open\')}'
+ 'function tst(m,t){var e=document.getElementById(\'tst\');e.textContent=m;e.className=\'toast \'+(t||\'ok\')+\' show\';setTimeout(function(){e.classList.remove(\'show\')},3500)}'
+ 'function sm(id,t,m){var e=document.getElementById(id);e.className=\'msg \'+t;e.textContent=m;e.style.display=\'block\'}'
+ 'function fmt(n){return String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g,\'.\')}'
+ 'function loadDash(){google.script.run.withSuccessHandler(function(d){if(!d||!d.ok)return;var s=d.stats;document.getElementById(\'sT\').textContent=fmt(s.total);document.getElementById(\'sP\').textContent=fmt(s.totalPoints);document.getElementById(\'sG\').textContent=fmt(s.gold);document.getElementById(\'sS\').textContent=fmt(s.silber);document.getElementById(\'sB\').textContent=fmt(s.bronze);document.getElementById(\'sPend\').textContent=fmt(s.totalPending||0)}).adminGetStats();google.script.run.withSuccessHandler(function(d){if(!d||!d.ok||!d.history||!d.history.length){document.getElementById(\'rAct\').innerHTML=\'<div class="emp">Noch keine Aktivitaeten</div>\';return}var h=\'<table><thead><tr><th>Datum</th><th>E-Mail</th><th>Punkte</th><th>Grund</th><th>Saldo</th></tr></thead><tbody>\';var it=d.history.slice(0,10);for(var i=0;i<it.length;i++){var r=it[i];var dt=r.date?new Date(r.date).toLocaleDateString(\'de-DE\',{day:\'2-digit\',month:\'2-digit\',year:\'2-digit\',hour:\'2-digit\',minute:\'2-digit\'}):\'-\';var cl=String(r.points).indexOf(\'-\')===0?\'color:#ef4444\':\'color:#22c55e\';h+=\'<tr><td>\'+dt+\'</td><td>\'+r.email+\'</td><td style="font-weight:700;\'+cl+\'">\'+r.points+\'</td><td>\'+r.reason+\'</td><td><strong>\'+fmt(r.balance)+\'</strong></td></tr>\'}h+=\'</tbody></table>\';document.getElementById(\'rAct\').innerHTML=h}).adminGetHistory(\'\')}'
+ 'function doSearch(){var em=document.getElementById(\'sEm\').value.trim();if(!em){sm(\'sMsg\',\'err\',\'Bitte E-Mail eingeben\');return}sm(\'sMsg\',\'ok\',\'Suche...\');google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){sm(\'sMsg\',\'err\',\'Kunde nicht gefunden\');document.getElementById(\'cDet\').style.display=\'none\';return}document.getElementById(\'sMsg\').style.display=\'none\';showCust(d)}).withFailureHandler(function(e){sm(\'sMsg\',\'err\',\'Fehler: \'+e.message)}).adminGetCustomer(em)}'
+ 'function showCust(d){document.getElementById(\'cDet\').style.display=\'block\';var h=\'<div style="flex:1"><div class="em">\'+d.email+\'</div><div class="mt"><span class="badge \'+d.tier+\'">\'+d.tier+\'</span> &nbsp; \'+d.cashback+\'% Cashback</div></div>\';h+=\'<div style="text-align:right"><div class="pts">\'+fmt(d.points)+\'</div><div class="mt">Punkte</div>\';h+=\'<button class="bt" style="margin-top:8px;padding:6px 14px;font-size:13px" onclick="openProf(\\\'\'+d.email+\'\\\')">&#128100; Profil oeffnen</button>\';h+=\'</div>\';if(d.next_tier)h+=\'<div style="text-align:right"><div class="mt">Noch \'+fmt(d.points_to_next)+\' bis \'+d.next_tier+\'</div></div>\';document.getElementById(\'cCard\').innerHTML=h}'
+ 'function doAdj(rm){var em=document.getElementById(\'sEm\').value.trim();var pts=parseInt(document.getElementById(\'aP\').value)||0;var re=document.getElementById(\'aR\').value.trim();if(!em||!pts){sm(\'aMsg\',\'err\',\'E-Mail und Punkte eingeben\');return}sm(\'aMsg\',\'ok\',\'Wird gespeichert...\');google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){sm(\'aMsg\',\'err\',(d&&d.error)||\'Fehler\');return}var si=d.changed>0?\'+\':\'\';tst(si+d.changed+\' Punkte — Neuer Stand: \'+fmt(d.points)+\' (\'+d.tier+\')\',\'ok\');document.getElementById(\'aMsg\').style.display=\'none\';document.getElementById(\'aP\').value=\'\';document.getElementById(\'aR\').value=\'\';doSearch()}).withFailureHandler(function(e){sm(\'aMsg\',\'err\',e.message)}).adminAdjustPoints(em,pts,re,rm)}'
+ 'function doList(){document.getElementById(\'cTbl\').innerHTML=\'<div class="emp">Laedt...</div>\';google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){document.getElementById(\'cTbl\').innerHTML=\'<div class="emp">Fehler</div>\';return}document.getElementById(\'cCnt\').textContent=\'(\'+d.total+\')\';if(!d.customers.length){document.getElementById(\'cTbl\').innerHTML=\'<div class="emp">Noch keine Kunden</div>\';return}var h=\'<table><thead><tr><th>#</th><th>E-Mail</th><th>Punkte</th><th>Tier</th><th>Cashback</th><th>Aktualisiert</th><th></th></tr></thead><tbody>\';for(var i=0;i<d.customers.length;i++){var c=d.customers[i];var dt=c.updated?new Date(c.updated).toLocaleDateString(\'de-DE\'):\'-\';var cb=c.tier===\'gold\'?10:c.tier===\'silber\'?7:5;h+=\'<tr class="ck" data-em="\'+c.email+\'"><td style="color:#94a3b8;font-weight:600">\'+String(i+1)+\'</td><td onclick="selC(\\\'\'+c.email+\'\\\')\">\'+c.email+\'</td><td><strong>\'+fmt(c.points)+\'</strong></td><td><span class="badge \'+c.tier+\'">\'+c.tier+\'</span></td><td>\'+cb+\'%</td><td>\'+dt+\'</td><td><button class="bt" style="padding:4px 10px;font-size:12px" onclick="openProf(\\\'\'+c.email+\'\\\')">Profil</button></td></tr>\'}h+=\'</tbody></table>\';document.getElementById(\'cTbl\').innerHTML=h}).withFailureHandler(function(e){document.getElementById(\'cTbl\').innerHTML=\'<div class="emp">Fehler: \'+e.message+\'</div>\'}).adminListCustomers()}'
+ 'function selC(em){document.getElementById(\'sEm\').value=em;doSearch();window.scrollTo(0,0)}'
+ 'function openProf(em){go(\'prof\');document.getElementById(\'pEm\').value=em;loadProfile()}'
+ 'function doReg(){var em=document.getElementById(\'nEm\').value.trim();var pts=parseInt(document.getElementById(\'nPt\').value)||0;var re=document.getElementById(\'nRe\').value.trim();if(!em){sm(\'nMsg\',\'err\',\'Bitte E-Mail eingeben\');return}sm(\'nMsg\',\'ok\',\'Wird registriert...\');google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){sm(\'nMsg\',\'err\',(d&&d.error)||\'Fehler\');return}sm(\'nMsg\',\'ok\',\'Kunde registriert: \'+d.email+\' — \'+fmt(d.points)+\' Punkte (\'+d.tier+\')\');tst(\'Neuer Kunde: \'+d.email,\'ok\');document.getElementById(\'nEm\').value=\'\';document.getElementById(\'nPt\').value=\'\';document.getElementById(\'nRe\').value=\'\'}).withFailureHandler(function(e){sm(\'nMsg\',\'err\',e.message)}).adminAddNewCustomer(em,pts,re)}'
+ 'function doHist(){var em=document.getElementById(\'hEm\').value.trim();document.getElementById(\'hTbl\').innerHTML=\'<div class="emp">Laedt...</div>\';google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){document.getElementById(\'hTbl\').innerHTML=\'<div class="emp">Fehler</div>\';return}if(!d.history.length){document.getElementById(\'hTbl\').innerHTML=\'<div class="emp">Keine Eintraege</div>\';return}var h=\'<table><thead><tr><th>Datum</th><th>E-Mail</th><th>Punkte</th><th>Grund</th><th>Saldo</th></tr></thead><tbody>\';for(var i=0;i<d.history.length;i++){var r=d.history[i];var dt=r.date?new Date(r.date).toLocaleDateString(\'de-DE\',{day:\'2-digit\',month:\'2-digit\',year:\'2-digit\',hour:\'2-digit\',minute:\'2-digit\'}):\'-\';var cl=String(r.points).indexOf(\'-\')===0?\'color:#ef4444\':\'color:#22c55e\';h+=\'<tr><td style="white-space:nowrap">\'+dt+\'</td><td>\'+r.email+\'</td><td style="font-weight:700;\'+cl+\'">\'+r.points+\'</td><td>\'+r.reason+\'</td><td><strong>\'+fmt(r.balance)+\'</strong></td></tr>\'}h+=\'</tbody></table>\';if(d.total>200)h+=\'<div class="emp" style="padding:12px">Zeige 200 von \'+d.total+\'</div>\';document.getElementById(\'hTbl\').innerHTML=h}).withFailureHandler(function(e){document.getElementById(\'hTbl\').innerHTML=\'<div class="emp">Fehler: \'+e.message+\'</div>\'}).adminGetHistory(em)}'
+ 'document.getElementById(\'sEm\').addEventListener(\'keydown\',function(e){if(e.key===\'Enter\')doSearch()});'
+ 'document.getElementById(\'nEm\').addEventListener(\'keydown\',function(e){if(e.key===\'Enter\')doReg()});'
+ 'document.getElementById(\'hEm\').addEventListener(\'keydown\',function(e){if(e.key===\'Enter\')doHist()});'
+ 'document.getElementById(\'pEm\').addEventListener(\'keydown\',function(e){if(e.key===\'Enter\')loadProfile()});'
+ 'function loadProfile(){var em=document.getElementById(\'pEm\').value.trim();if(!em){sm(\'pMsg\',\'err\',\'Bitte E-Mail eingeben\');return}sm(\'pMsg\',\'ok\',\'Profil wird geladen...\');document.getElementById(\'pDet\').style.display=\'none\';google.script.run.withSuccessHandler(function(d){if(!d||!d.ok){sm(\'pMsg\',\'err\',(d&&d.error)||\'Kunde nicht gefunden\');return}document.getElementById(\'pMsg\').style.display=\'none\';document.getElementById(\'pDet\').style.display=\'block\';renderProfile(d)}).withFailureHandler(function(e){sm(\'pMsg\',\'err\',\'Fehler: \'+e.message)}).adminGetCustomerProfile(em)}'
+ 'function renderProfile(d){var s=d.shopify||{};var h=\'<h2>&#128100; Kundendaten</h2>\';h+=\'<div class="cc"><div style="flex:1"><div class="em" style="font-size:16px;font-weight:700">\'+d.email+\'</div>\';h+=\'<div class="mt" style="margin-top:6px"><span class="badge \'+d.tier+\'">\'+d.tier+\'</span> &nbsp; \'+d.cashback+\'% Cashback</div>\';if(s.name&&s.name!==\'-\')h+=\'<div class="mt" style="margin-top:4px">Name: \'+s.name+\'</div>\';if(s.phone&&s.phone!==\'-\')h+=\'<div class="mt">Telefon: \'+s.phone+\'</div>\';if(s.createdAt)h+=\'<div class="mt">Kunde seit: \'+new Date(s.createdAt).toLocaleDateString(\'de-DE\')+\'</div>\';if(d.referralCode)h+=\'<div class="mt" style="margin-top:6px">Empfehlungscode: <strong>\'+d.referralCode+\'</strong></div>\';h+=\'</div><div style="text-align:right"><div class="pts">\'+fmt(d.points)+\'</div><div class="mt">Punkte</div>\';var _pe=d.pendingPoints||{total:0};if(_pe.total>0)h+=\'<div class="mt" style="margin-top:6px;color:var(--gold);font-weight:600">+ \'+fmt(_pe.total)+\' reserviert</div>\';if(d.next_tier)h+=\'<div class="mt" style="margin-top:4px">Noch \'+fmt(d.points_to_next)+\' bis \'+d.next_tier+\'</div>\';h+=\'</div></div>\';h+=\'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:8px">\';h+=\'<div style="background:#f8fafc;padding:14px;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:700;color:var(--accent)">\'+fmt(s.orderCount||0)+\'</div><div style="font-size:11px;color:var(--txt2);margin-top:4px">Bestellungen</div></div>\';h+=\'<div style="background:#f8fafc;padding:14px;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:700;color:var(--green)">\'+(s.totalSpent?Number(s.totalSpent).toFixed(2):\'0.00\')+\' &euro;</div><div style="font-size:11px;color:var(--txt2);margin-top:4px">Gesamtumsatz</div></div>\';if(s.tags&&s.tags.length){h+=\'<div style="background:#f8fafc;padding:14px;border-radius:8px"><div style="font-size:11px;color:var(--txt2);margin-bottom:6px">Tags</div>\';for(var t=0;t<s.tags.length;t++)h+=\'<span style="display:inline-block;background:#e2e8f0;padding:2px 8px;border-radius:4px;font-size:11px;margin:2px">\'+s.tags[t]+\'</span>\';h+=\'</div>\'}h+=\'</div>\';document.getElementById(\'pInfo\').innerHTML=h;var oh=\'<h2>&#128722; Bestellungen — letzte 6 Monate (\'+d.orders.length+\')</h2>\';if(!d.orders.length){oh+=\'<div class="emp">Keine Bestellungen</div>\'}else{oh+=\'<table><thead><tr><th>Bestellung</th><th>Datum</th><th>Betrag</th><th>Zahlung</th><th>Versand</th><th>Artikel</th></tr></thead><tbody>\';for(var i=0;i<d.orders.length;i++){var o=d.orders[i];var dt=o.date?new Date(o.date).toLocaleDateString(\'de-DE\'):\'-\';var its=[];for(var j=0;j<o.items.length;j++){its.push(o.items[j].qty+\'x \'+o.items[j].title)}oh+=\'<tr><td><strong>\'+o.name+\'</strong></td><td>\'+dt+\'</td><td>\'+Number(o.total).toFixed(2)+\' &euro;</td><td>\'+o.financial+\'</td><td>\'+o.fulfillment+\'</td><td style="font-size:12px">\'+its.join(\', \')+\'</td></tr>\'}oh+=\'</tbody></table>\'}document.getElementById(\'pOrders\').innerHTML=oh;var pe=d.pendingPoints||{total:0,items:[]};var peh=\'<h2>&#9200; Reservierte Punkte (\'+fmt(pe.total)+\')</h2>\';if(!pe.items.length){peh+=\'<div class="emp">Keine reservierten Punkte</div>\'}else{peh+=\'<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:8px;padding:16px;margin-bottom:12px"><div style="font-size:24px;font-weight:800;color:var(--gold)">\'+fmt(pe.total)+\' Punkte</div><div style="font-size:12px;color:#92400e;margin-top:4px">Werden nach 30 Tagen freigegeben</div></div>\';peh+=\'<table><thead><tr><th>Punkte</th><th>Grund</th><th>Freigabe am</th><th>Verbleibend</th></tr></thead><tbody>\';for(var pi=0;pi<pe.items.length;pi++){var pp=pe.items[pi];var pdt=pp.releaseDate?new Date(pp.releaseDate).toLocaleDateString(\'de-DE\'):\'-\';peh+=\'<tr><td style="font-weight:700;color:var(--gold)">\'+fmt(pp.points)+\'</td><td>\'+pp.reason+\'</td><td>\'+pdt+\'</td><td><strong>\'+pp.daysLeft+\' Tage</strong></td></tr>\'}peh+=\'</tbody></table>\'}document.getElementById(\'pPending\').innerHTML=peh;var ph=\'<h2>&#128203; Punkteverlauf</h2>\';if(!d.pointsHistory.length){ph+=\'<div class="emp">Keine Eintraege</div>\'}else{ph+=\'<table><thead><tr><th>Datum</th><th>Punkte</th><th>Grund</th><th>Saldo</th></tr></thead><tbody>\';for(var k=0;k<d.pointsHistory.length;k++){var r=d.pointsHistory[k];var rdt=r.date?new Date(r.date).toLocaleDateString(\'de-DE\',{day:\'2-digit\',month:\'2-digit\',year:\'2-digit\',hour:\'2-digit\',minute:\'2-digit\'}):\'-\';var rcl=String(r.points).indexOf(\'-\')===0?\'color:#ef4444\':\'color:#22c55e\';ph+=\'<tr><td>\'+rdt+\'</td><td style="font-weight:700;\'+rcl+\'">\'+r.points+\'</td><td>\'+r.reason+\'</td><td><strong>\'+fmt(r.balance)+\'</strong></td></tr>\'}ph+=\'</tbody></table>\'}document.getElementById(\'pHist\').innerHTML=ph}'
+ 'loadDash();doList();doHist();'
+ 'function doSync(){var btn=document.getElementById(\'syncBtn\');btn.disabled=true;btn.textContent=\'Laedt...\';tst(\'Sync laeuft...\',\'ok\');google.script.run.withSuccessHandler(function(d){btn.disabled=false;btn.textContent=\'&#128260; Synchronisieren\';if(!d||!d.ok){tst(\'Fehler: \'+(d&&d.error||\'unbekannt\'),\'err\');return}tst(d.synced+\' Kunden eingelesen \u2714\',\'ok\');loadDash();doList()}).withFailureHandler(function(e){btn.disabled=false;btn.textContent=\'&#128260; Synchronisieren\';tst(\'Fehler: \'+e.message,\'err\')}).adminSyncFromShopify()}'
+ 'function doBackfill(){var btn=document.getElementById(\'backfillBtn\');btn.disabled=true;btn.textContent=\'Importiere...\';tst(\'Bestellungs-Import laeuft — kann 30-120 Sek dauern...\',\'ok\');google.script.run.withSuccessHandler(function(d){btn.disabled=false;btn.textContent=\'&#128229; Jetzt importieren\';if(!d||!d.ok){tst(\'Fehler: \'+(d&&d.error||\'unbekannt\'),\'err\');return}tst(d.processed+\' Bestellungen importiert, \'+(d.skipped||0)+\' bereits vorhanden \u2714\',\'ok\');loadDash();doList()}).withFailureHandler(function(e){btn.disabled=false;btn.textContent=\'&#128229; Jetzt importieren\';tst(\'Fehler: \'+e.message,\'err\')}).backfillHistoricalOrders()}'
+ 'function doPushMeta(){var btn=document.getElementById(\'pushBtn\');btn.disabled=true;btn.textContent=\'Schreibe...\';tst(\'Metafelder werden in Shopify aktualisiert — bitte warten...\',\'ok\');google.script.run.withSuccessHandler(function(d){btn.disabled=false;btn.textContent=\'&#128257; Metafelder aktualisieren\';if(!d||!d.ok){tst(\'Fehler: \'+(d&&d.error||\'unbekannt\'),\'err\');return}tst(d.updated+\' Shopify-Metafelder aktualisiert \u2714\',\'ok\')}).withFailureHandler(function(e){btn.disabled=false;btn.textContent=\'&#128257; Metafelder aktualisieren\';tst(\'Fehler: \'+e.message,\'err\')}).pushMetafieldsToShopify()}'
+ 'function doOrders(d){document.getElementById(\'bTbl\').innerHTML=\'<div class="emp">Laedt...</div>\';google.script.run.withSuccessHandler(function(r){if(!r||!r.ok){document.getElementById(\'bTbl\').innerHTML=\'<div class="emp">Fehler beim Laden</div>\';return}if(!r.orders.length){document.getElementById(\'bTbl\').innerHTML=\'<div class="emp">Keine Bestellungen in diesem Zeitraum</div>\';return}var h=\'<div style="font-size:13px;color:var(--txt2);margin-bottom:12px">\'+(r.total)+\' Bestellungen gefunden</div>\';h+=\'<table><thead><tr><th>Bestellung</th><th>Datum</th><th>Kunde</th><th>Betrag</th><th>Zahlung</th><th>Versand</th><th>Tier</th><th>+ Punkte</th></tr></thead><tbody>\';for(var i=0;i<r.orders.length;i++){var o=r.orders[i];var dt=o.date?new Date(o.date).toLocaleDateString(\'de-DE\'):\'-\';var fc=o.financial===\'paid\'?\'color:#22c55e\':\'color:#f59e0b\';var fv=o.fulfillment===\'fulfilled\'?\'&#10003; Versendet\':\'&#9899; Ausstehend\';h+=\'<tr><td><strong>\'+o.name+\'</strong></td><td>\'+dt+\'</td><td style="font-size:12px">\'+o.email+\'</td><td><strong>\'+(o.total.toFixed(2))+\' &euro;</strong></td><td style="font-weight:600;\'+fc+\'">\'+o.financial+\'</td><td style="font-size:12px">\'+fv+\'</td><td><span class="badge \'+o.tier+\'">\'+o.tier+\'</span></td><td style="font-weight:700;color:var(--accent)">\'+fmt(o.points_earned)+\'</td></tr>\'}h+=\'</tbody></table>\';document.getElementById(\'bTbl\').innerHTML=h}).withFailureHandler(function(e){document.getElementById(\'bTbl\').innerHTML=\'<div class="emp">Fehler: \'+e.message+\'</div>\'}).adminGetRecentOrders(d||30)}'
+ 'function doRewards(){document.getElementById(\'rwTbl\').innerHTML=\'<div class="emp">Laedt...</div>\';google.script.run.withSuccessHandler(function(r){if(!r||!r.ok){document.getElementById(\'rwTbl\').innerHTML=\'<div class="emp">Fehler</div>\';return}var gold=0,silber=0,bronze=0;for(var k=0;k<r.customers.length;k++){var t=r.customers[k].tier;if(t===\'gold\')gold++;else if(t===\'silber\')silber++;else bronze++}document.getElementById(\'rwT\').textContent=fmt(r.total);document.getElementById(\'rwG\').textContent=fmt(gold);document.getElementById(\'rwS\').textContent=fmt(silber);document.getElementById(\'rwB\').textContent=fmt(bronze);if(!r.customers.length){document.getElementById(\'rwTbl\').innerHTML=\'<div class="emp">Noch keine Rewards-Kunden — Import ausfuehren</div>\';return}var h=\'<table><thead><tr><th>#</th><th>E-Mail</th><th>Punkte</th><th>Tier</th><th>Cashback</th><th>Zuletzt aktiv</th><th></th></tr></thead><tbody>\';for(var i=0;i<r.customers.length;i++){var c=r.customers[i];var dt=c.updated?new Date(c.updated).toLocaleDateString(\'de-DE\'):\'-\';var cb=c.tier===\'gold\'?10:c.tier===\'silber\'?7:5;h+=\'<tr><td style="color:#94a3b8;font-weight:600">\'+(i+1)+\'</td><td onclick="selC(\\\'\'+c.email+\'\\\')\" style="cursor:pointer;color:var(--accent)">\'  +c.email+\'</td><td><strong style="font-size:16px;color:var(--accent)">\'+fmt(c.points)+\'</strong></td><td><span class="badge \'+c.tier+\'">\'+c.tier+\'</span></td><td>\'+cb+\'%</td><td>\'+dt+\'</td><td><button class="bt" style="padding:4px 10px;font-size:12px" onclick="openProf(\\\'\'+c.email+\'\\\')">Profil</button></td></tr>\'}h+=\'</tbody></table>\';document.getElementById(\'rwTbl\').innerHTML=h}).withFailureHandler(function(e){document.getElementById(\'rwTbl\').innerHTML=\'<div class="emp">Fehler: \'+e.message+\'</div>\'}).adminGetRewardsCustomers()}'
+ '</script></body></html>';
  return h;
}


/* ═══════════════════════════════════════════════════════
   SETUP FUNCTIONS — Run each ONCE from GAS editor
   ═══════════════════════════════════════════════════════ */

/** Creates admin key. Run ONCE. */
function setupAdminKey() {
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty('ADMIN_KEY');
  if (existing) {
    Logger.log('Admin-Key existiert bereits: ' + existing);
    return;
  }
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var key = '';
  for (var i = 0; i < 32; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  props.setProperty('ADMIN_KEY', key);
  Logger.log('Admin-Key erstellt: ' + key);
}

/** Show current admin key. */
function showAdminKey() {
  var key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  Logger.log(key ? 'Admin-Key: ' + key : 'Kein Admin-Key. Bitte setupAdminKey() ausfuehren.');
}

/** Creates triggers for order polling + daily maintenance. Run ONCE. */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'checkNewOrders' || fn === 'dailyMaintenance') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('checkNewOrders')
    .timeBased()
    .everyMinutes(15)
    .create();

  ScriptApp.newTrigger('dailyMaintenance')
    .timeBased()
    .everyHours(24)
    .create();

  Logger.log('Trigger erstellt: checkNewOrders (15 Min), dailyMaintenance (taeglich)');
}

/** Creates metafield definitions in Shopify. Run ONCE. */
function setupMetafields() {
  var mutation = 'mutation metafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {'
    + ' metafieldDefinitionCreate(definition: $definition) {'
    + '   createdDefinition { id } userErrors { field message }'
    + ' } }';

  var r1 = gql_(mutation, {
    definition: {
      name: 'Loyalty Points', namespace: 'karinex', key: 'loyalty_points',
      type: 'number_integer', ownerType: 'CUSTOMER',
      access: { storefront: 'PUBLIC_READ' }
    }
  });
  Logger.log('loyalty_points: ' + JSON.stringify(r1));

  var r2 = gql_(mutation, {
    definition: {
      name: 'Loyalty Tier', namespace: 'karinex', key: 'loyalty_tier',
      type: 'single_line_text_field', ownerType: 'CUSTOMER',
      access: { storefront: 'PUBLIC_READ' }
    }
  });
  Logger.log('loyalty_tier: ' + JSON.stringify(r2));

  Logger.log('Metafield-Definitionen erstellt');
}
