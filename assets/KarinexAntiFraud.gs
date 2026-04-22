/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║       KARINEX ANTI-FRAUD BLACKLIST SYSTEM                   ║
 * ║       Version 1.0.0 · April 2026                           ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Automatic fraud detection & order cancellation.            ║
 * ║  Shopify webhook → Blacklist check → Auto-cancel.           ║
 * ║                                                             ║
 * ║  Architecture:                                              ║
 * ║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        ║
 * ║  │ Admin UI    │→ │ GAS Backend │→ │ Shopify API │        ║
 * ║  │ (Web App)   │  │ (this file) │  │ + Sheets DB │        ║
 * ║  └─────────────┘  └─────────────┘  └─────────────┘        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * SETUP:
 *  1. Run setupConfig() once → enter your Shopify token + store domain
 *  2. Deploy as web app (Execute as: Me, Access: Anyone)
 *  3. Register deployed URL as Shopify webhook for orders/create
 *     URL format: https://script.google.com/macros/s/.../exec?key=YOUR_WEBHOOK_SECRET
 */

// ═══════════════════════════════════════════════════════════════
// 1. CONFIGURATION
// ═══════════════════════════════════════════════════════════════

var SHEET_NAMES = {
  BLACKLIST: 'Blacklist',
  LOG: 'Activity Log',
  MATCHES: 'Order Matches',
  SETTINGS: 'Settings'
};

var RISK_WEIGHTS = {
  email: 80,
  phone: 70,
  fingerprint: 90,
  name: 40,
  address: 50,
  ip: 60
};

var API_VERSION = '2025-04';

/** Get config from Script Properties (secure, not in source code) */
function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    shopDomain: props.getProperty('SHOP_DOMAIN') || '',
    accessToken: props.getProperty('SHOPIFY_TOKEN') || '',
    webhookSecret: props.getProperty('WEBHOOK_SECRET') || '',
    sheetId: props.getProperty('SHEET_ID') || SpreadsheetApp.getActiveSpreadsheet().getId()
  };
}

// ═══════════════════════════════════════════════════════════════
// 2. SETUP (run once)
// ═══════════════════════════════════════════════════════════════

/**
 * Run this function once in the GAS editor to configure secrets.
 * All values are stored encrypted in Script Properties.
 * 
 * INSTRUCTIONS:
 *  1. Fill in SHOP_DOMAIN and SHOPIFY_TOKEN below
 *  2. Run this function once
 *  3. Delete the token from the code after running (for safety)
 */
function setupConfig() {
  // ─── FILL THESE IN, then run once ───
  var SHOP_DOMAIN   = '45dv93-bk.myshopify.com';
  var SHOPIFY_TOKEN = '';  // ← Paste your shpat_... token here, run, then DELETE it
  // ─────────────────────────────────────

  if (!SHOPIFY_TOKEN || SHOPIFY_TOKEN === '') {
    Logger.log('❌ ERROR: Paste your Shopify Admin API token into setupConfig() first!');
    return;
  }

  var secret = Utilities.getUuid().replace(/-/g, '').substring(0, 24);

  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    'SHOP_DOMAIN': SHOP_DOMAIN,
    'SHOPIFY_TOKEN': SHOPIFY_TOKEN,
    'WEBHOOK_SECRET': secret
  });

  // Create sheets in bound spreadsheet or log instructions
  try {
    initSheets_();
    Logger.log('✅ Sheets created successfully');
  } catch (e) {
    Logger.log('ℹ️ Standalone project — create a Google Sheet manually and run initSheetsById() with its ID');
  }

  Logger.log('════════════════════════════════════════════');
  Logger.log('✅ SETUP COMPLETE');
  Logger.log('════════════════════════════════════════════');
  Logger.log('Webhook Secret: ' + secret);
  Logger.log('');
  Logger.log('Register this Shopify webhook (Bestellerstellung / Order creation):');
  Logger.log(ScriptApp.getService().getUrl() + '?key=' + secret);
  Logger.log('');
  Logger.log('⚠️  NOW DELETE THE TOKEN FROM THE CODE and save!');
  Logger.log('════════════════════════════════════════════');
}

/**
 * If using a standalone project, run this to create sheets in an existing spreadsheet.
 * Paste the Google Sheet ID below and run once.
 */
function initSheetsById() {
  var SHEET_ID = ''; // ← Paste Google Sheet ID here
  if (!SHEET_ID) { Logger.log('❌ Paste your Google Sheet ID into initSheetsById()'); return; }
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', SHEET_ID);
  initSheets_();
  Logger.log('✅ All sheets created in: https://docs.google.com/spreadsheets/d/' + SHEET_ID);
}

/** Create all required sheets if they don't exist */
function initSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Blacklist sheet
  var bl = ss.getSheetByName(SHEET_NAMES.BLACKLIST);
  if (!bl) {
    bl = ss.insertSheet(SHEET_NAMES.BLACKLIST);
    bl.appendRow([
      'ID', 'Full Name', 'Email', 'Phone', 'Street', 'City', 'ZIP', 'Country',
      'IP Address', 'Device Fingerprint', 'User Agent', 'Browser', 'OS',
      'VPN/Proxy', 'Reason', 'Notes', 'Risk Level', 'Status',
      'Created At', 'Updated At'
    ]);
    bl.setFrozenRows(1);
    bl.getRange(1, 1, 1, 20).setFontWeight('bold').setBackground('#1d4739').setFontColor('#fff');
  }

  // Activity Log sheet
  var log = ss.getSheetByName(SHEET_NAMES.LOG);
  if (!log) {
    log = ss.insertSheet(SHEET_NAMES.LOG);
    log.appendRow([
      'Timestamp', 'Action', 'Order ID', 'Order Number', 'Customer Name',
      'Customer Email', 'Risk Score', 'Matched Signals', 'Decision', 'Details'
    ]);
    log.setFrozenRows(1);
    log.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#1d4739').setFontColor('#fff');
  }

  // Order Matches sheet
  var matches = ss.getSheetByName(SHEET_NAMES.MATCHES);
  if (!matches) {
    matches = ss.insertSheet(SHEET_NAMES.MATCHES);
    matches.appendRow([
      'Timestamp', 'Order ID', 'Order Number', 'Customer Name', 'Customer Email',
      'Customer Phone', 'Customer IP', 'Shipping Address', 'Risk Score',
      'Matched Blacklist IDs', 'Matched Signals', 'Decision', 'Action Taken',
      'Cancellation Reason'
    ]);
    matches.setFrozenRows(1);
    matches.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#1d4739').setFontColor('#fff');
  }

  // Settings sheet
  var sett = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sett) {
    sett = ss.insertSheet(SHEET_NAMES.SETTINGS);
    sett.appendRow(['Key', 'Value']);
    sett.appendRow(['auto_cancel_enabled', 'true']);
    sett.appendRow(['manual_review_mode', 'false']);
    sett.appendRow(['risk_threshold_cancel', '70']);
    sett.appendRow(['risk_threshold_review', '40']);
    sett.appendRow(['cancel_reason', 'Bestellung automatisch storniert (Betrugsverdacht)']);
    sett.appendRow(['notify_email', '']);
    sett.setFrozenRows(1);
    sett.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#1d4739').setFontColor('#fff');
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. WEB APP ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/** Serve admin dashboard */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('KarinexAntiFraudDashboard')
    .setTitle('Karinex Anti-Fraud Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Receive Shopify webhook (orders/create) */
function doPost(e) {
  try {
    var config = getConfig_();

    // Verify webhook secret
    var key = e.parameter.key || '';
    if (config.webhookSecret && key !== config.webhookSecret) {
      logActivity_('webhook_rejected', '', '', '', '', 0, '', 'rejected', 'Invalid webhook key');
      return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
    }

    var order = JSON.parse(e.postData.contents);
    processOrder_(order);

    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    Logger.log('Webhook error: ' + err.message + '\n' + err.stack);
    logActivity_('webhook_error', '', '', '', '', 0, '', 'error', err.message);
    return ContentService.createTextOutput('Error: ' + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. ORDER PROCESSING & MATCHING ENGINE
// ═══════════════════════════════════════════════════════════════

/** Main order processing pipeline */
function processOrder_(order) {
  var customer = extractCustomerData_(order);
  var blacklist = getBlacklist_();
  var settings = getSettings_();

  var result = matchAgainstBlacklist_(customer, blacklist);

  // Log the check
  logActivity_(
    'order_checked',
    String(order.id),
    String(order.order_number || order.name || ''),
    customer.fullName,
    customer.email,
    result.riskScore,
    result.signals.join(', '),
    result.decision,
    'Matched IDs: ' + (result.matchedIds.join(', ') || 'none')
  );

  // Save match record
  saveMatch_(order, customer, result);

  var cancelThreshold = parseInt(settings.risk_threshold_cancel) || 70;
  var reviewThreshold = parseInt(settings.risk_threshold_review) || 40;
  var autoCancel = settings.auto_cancel_enabled === 'true';
  var manualReview = settings.manual_review_mode === 'true';

  // Decision logic
  if (result.riskScore >= cancelThreshold && autoCancel && !manualReview) {
    var reason = settings.cancel_reason || 'Bestellung automatisch storniert (Betrugsverdacht)';
    cancelOrder_(order.id, reason);
    logActivity_(
      'order_canceled',
      String(order.id),
      String(order.order_number || order.name || ''),
      customer.fullName,
      customer.email,
      result.riskScore,
      result.signals.join(', '),
      'auto_canceled',
      reason
    );

    // Send email notification if configured
    var notifyEmail = settings.notify_email;
    if (notifyEmail) {
      sendNotification_(notifyEmail, order, customer, result, 'auto_canceled');
    }
  } else if (result.riskScore >= reviewThreshold) {
    logActivity_(
      'order_flagged',
      String(order.id),
      String(order.order_number || order.name || ''),
      customer.fullName,
      customer.email,
      result.riskScore,
      result.signals.join(', '),
      'manual_review',
      'Flagged for manual review'
    );

    var notifyEmail = settings.notify_email;
    if (notifyEmail) {
      sendNotification_(notifyEmail, order, customer, result, 'flagged');
    }
  }
}

/** Extract customer data from Shopify order */
function extractCustomerData_(order) {
  var customer = order.customer || {};
  var billing = order.billing_address || {};
  var shipping = order.shipping_address || {};
  var clientDetails = order.client_details || {};
  var addr = shipping.address1 || billing.address1 || '';

  return {
    fullName: ((customer.first_name || '') + ' ' + (customer.last_name || '')).trim()
              || ((shipping.first_name || '') + ' ' + (shipping.last_name || '')).trim(),
    email: (customer.email || order.email || '').toLowerCase().trim(),
    phone: normalizePhone_(customer.phone || shipping.phone || billing.phone || ''),
    street: addr,
    city: shipping.city || billing.city || '',
    zip: shipping.zip || billing.zip || '',
    country: shipping.country_code || billing.country_code || '',
    fullAddress: [addr, shipping.city || billing.city, shipping.zip || billing.zip, shipping.country_code || billing.country_code].filter(Boolean).join(', '),
    ip: order.browser_ip || (clientDetails.browser_ip) || '',
    userAgent: clientDetails.user_agent || '',
    fingerprint: ''
  };
}

/** Match customer data against all blacklist entries */
function matchAgainstBlacklist_(customer, blacklist) {
  var signals = [];
  var matchedIds = [];
  var totalScore = 0;
  var signalCount = 0;

  for (var i = 0; i < blacklist.length; i++) {
    var entry = blacklist[i];
    if (entry.status !== 'Active') continue;

    var entrySignals = [];
    var entryScore = 0;

    // Email match (exact, normalized)
    if (customer.email && entry.email && normalizeEmail_(customer.email) === normalizeEmail_(entry.email)) {
      entrySignals.push('email');
      entryScore += RISK_WEIGHTS.email;
    }

    // Phone match (normalized)
    if (customer.phone && entry.phone && normalizePhone_(customer.phone) === normalizePhone_(entry.phone)) {
      entrySignals.push('phone');
      entryScore += RISK_WEIGHTS.phone;
    }

    // Name match (partial)
    if (customer.fullName && entry.fullName) {
      var sim = nameSimilarity_(customer.fullName, entry.fullName);
      if (sim >= 0.85) {
        entrySignals.push('name_exact');
        entryScore += RISK_WEIGHTS.name;
      } else if (sim >= 0.6) {
        entrySignals.push('name_partial');
        entryScore += Math.round(RISK_WEIGHTS.name * 0.6);
      }
    }

    // Address match (normalized)
    if (customer.fullAddress && entry.fullAddress) {
      if (addressMatch_(customer, entry)) {
        entrySignals.push('address');
        entryScore += RISK_WEIGHTS.address;
      }
    }

    // IP match
    if (customer.ip && entry.ip && customer.ip === entry.ip) {
      entrySignals.push('ip');
      entryScore += RISK_WEIGHTS.ip;
    }

    // Fingerprint match
    if (customer.fingerprint && entry.fingerprint && customer.fingerprint === entry.fingerprint) {
      entrySignals.push('fingerprint');
      entryScore += RISK_WEIGHTS.fingerprint;
    }

    // If any signals matched for this entry
    if (entrySignals.length > 0) {
      matchedIds.push(entry.id);
      signals = signals.concat(entrySignals.map(function(s) { return s + ' (#' + entry.id + ')'; }));
      signalCount += entrySignals.length;

      // Multi-signal boost: 2+ different signals = multiply
      if (entrySignals.length >= 2) {
        entryScore = Math.min(100, Math.round(entryScore * 1.4));
      }

      totalScore = Math.max(totalScore, entryScore);
    }
  }

  // Cross-entry boost: matched across multiple blacklist entries
  if (matchedIds.length >= 2) {
    totalScore = Math.min(100, Math.round(totalScore * 1.3));
  }

  var decision = 'passed';
  if (totalScore >= (parseInt(getSettings_().risk_threshold_cancel) || 70)) {
    decision = 'auto_cancel';
  } else if (totalScore >= (parseInt(getSettings_().risk_threshold_review) || 40)) {
    decision = 'manual_review';
  }

  return {
    riskScore: totalScore,
    signals: signals,
    matchedIds: matchedIds,
    decision: decision
  };
}

// ═══════════════════════════════════════════════════════════════
// 5. NORMALIZATION & MATCHING HELPERS
// ═══════════════════════════════════════════════════════════════

function normalizeEmail_(email) {
  return (email || '').toLowerCase().trim();
}

function normalizePhone_(phone) {
  if (!phone) return '';
  var digits = phone.replace(/[^\d]/g, '');
  // Normalize German numbers: 0049... → 49..., 0... → 49...
  if (digits.indexOf('0049') === 0) digits = digits.substring(2);
  else if (digits.indexOf('49') === 0 && digits.length >= 11) { /* already normalized */ }
  else if (digits.indexOf('0') === 0) digits = '49' + digits.substring(1);
  return digits;
}

function normalizeAddress_(str) {
  if (!str) return '';
  return str.toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/str\./g, 'strasse').replace(/str$/g, 'strasse')
    .replace(/[.,\-\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName_(name) {
  return (name || '').toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/** Levenshtein-based name similarity (0-1) */
function nameSimilarity_(a, b) {
  a = normalizeName_(a);
  b = normalizeName_(b);
  if (a === b) return 1;
  if (!a || !b) return 0;

  var maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  var dist = levenshtein_(a, b);
  return 1 - (dist / maxLen);
}

function levenshtein_(a, b) {
  var matrix = [];
  for (var i = 0; i <= b.length; i++) matrix[i] = [i];
  for (var j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (var i = 1; i <= b.length; i++) {
    for (var j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/** Normalized address matching (street + city + zip) */
function addressMatch_(customer, entry) {
  var custAddr = normalizeAddress_(customer.street);
  var entryAddr = normalizeAddress_(entry.street);
  var custCity = normalizeAddress_(customer.city);
  var entryCity = normalizeAddress_(entry.city);
  var custZip = String(customer.zip || '').replace(/\s/g, '');
  var entryZip = String(entry.zip || '').replace(/\s/g, '');

  // ZIP must match if both present
  if (custZip && entryZip && custZip !== entryZip) return false;

  // City must match if both present
  if (custCity && entryCity && custCity !== entryCity) return false;

  // Street similarity
  if (custAddr && entryAddr) {
    if (custAddr === entryAddr) return true;
    var sim = nameSimilarity_(custAddr, entryAddr);
    return sim >= 0.75;
  }

  // If zip + city match, that's enough
  if (custZip && entryZip && custZip === entryZip && custCity && entryCity && custCity === entryCity) {
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// 6. SHOPIFY API — ORDER CANCELLATION
// ═══════════════════════════════════════════════════════════════

function cancelOrder_(orderId, reason) {
  var config = getConfig_();
  if (!config.shopDomain || !config.accessToken) {
    Logger.log('Cannot cancel: missing Shopify credentials');
    return false;
  }

  var url = 'https://' + config.shopDomain + '/admin/api/' + API_VERSION + '/orders/' + orderId + '/cancel.json';

  var payload = {
    reason: 'fraud',
    email: true,
    note: reason
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Shopify-Access-Token': config.accessToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code >= 200 && code < 300) {
    Logger.log('Order ' + orderId + ' canceled successfully');
    return true;
  } else {
    Logger.log('Cancel failed (' + code + '): ' + response.getContentText());
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 7. GOOGLE SHEETS DATA ACCESS
// ═══════════════════════════════════════════════════════════════

function getSpreadsheet_() {
  var config = getConfig_();
  if (config.sheetId) {
    return SpreadsheetApp.openById(config.sheetId);
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    Logger.log('No spreadsheet linked. Run initSheetsById() with your Sheet ID.');
    return null;
  }
}

/** Read all active blacklist entries */
function getBlacklist_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAMES.BLACKLIST);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var entries = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    entries.push({
      id: row[0],
      fullName: row[1] || '',
      email: row[2] || '',
      phone: row[3] || '',
      street: row[4] || '',
      city: row[5] || '',
      zip: row[6] || '',
      country: row[7] || '',
      ip: row[8] || '',
      fingerprint: row[9] || '',
      userAgent: row[10] || '',
      browser: row[11] || '',
      os: row[12] || '',
      vpnProxy: row[13] || '',
      reason: row[14] || '',
      notes: row[15] || '',
      riskLevel: row[16] || '',
      status: row[17] || 'Active',
      createdAt: row[18] || '',
      updatedAt: row[19] || '',
      fullAddress: [row[4], row[5], row[6], row[7]].filter(Boolean).join(', ')
    });
  }
  return entries;
}

/** Read settings as key-value object */
function getSettings_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) return {};

  var data = sheet.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < data.length; i++) {
    settings[data[i][0]] = String(data[i][1]);
  }
  return settings;
}

/** Save activity log entry */
function logActivity_(action, orderId, orderNumber, customerName, customerEmail, riskScore, signals, decision, details) {
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(SHEET_NAMES.LOG);
    if (!sheet) return;

    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 10).setValues([[
      new Date(),
      action,
      orderId,
      orderNumber,
      customerName,
      customerEmail,
      riskScore,
      signals,
      decision,
      details
    ]]);
  } catch (e) {
    Logger.log('Log error: ' + e.message);
  }
}

/** Save order match record */
function saveMatch_(order, customer, result) {
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(SHEET_NAMES.MATCHES);
    if (!sheet) return;

    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, 14).setValues([[
      new Date(),
      String(order.id),
      String(order.order_number || order.name || ''),
      customer.fullName,
      customer.email,
      customer.phone,
      customer.ip,
      customer.fullAddress,
      result.riskScore,
      result.matchedIds.join(', '),
      result.signals.join(', '),
      result.decision,
      result.decision === 'auto_cancel' ? 'Canceled' : (result.decision === 'manual_review' ? 'Flagged' : 'Passed'),
      result.decision === 'auto_cancel' ? (getSettings_().cancel_reason || 'Fraud') : ''
    ]]);
  } catch (e) {
    Logger.log('Match save error: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 8. DASHBOARD API (called from HTML via google.script.run)
// ═══════════════════════════════════════════════════════════════

/** Get all blacklist entries for dashboard */
function getBlacklistForDashboard() {
  return getBlacklist_();
}

/** Add new blacklist entry */
function addBlacklistEntry(entry) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAMES.BLACKLIST);
  if (!sheet) { initSheets_(); sheet = getSpreadsheet_().getSheetByName(SHEET_NAMES.BLACKLIST); }

  var id = 'BL-' + Date.now();
  var now = new Date();

  sheet.appendRow([
    id,
    entry.fullName || '',
    (entry.email || '').toLowerCase().trim(),
    entry.phone || '',
    entry.street || '',
    entry.city || '',
    entry.zip || '',
    entry.country || '',
    entry.ip || '',
    entry.fingerprint || '',
    entry.userAgent || '',
    entry.browser || '',
    entry.os || '',
    entry.vpnProxy || '',
    entry.reason || '',
    entry.notes || '',
    entry.riskLevel || 'High',
    'Active',
    now,
    now
  ]);

  logActivity_('blacklist_added', '', '', entry.fullName || '', entry.email || '', 0, '', 'admin', 'New entry: ' + id);
  return { success: true, id: id };
}

/** Update existing blacklist entry */
function updateBlacklistEntry(id, entry) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAMES.BLACKLIST);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      var row = i + 1;
      sheet.getRange(row, 2, 1, 18).setValues([[
        entry.fullName || '',
        (entry.email || '').toLowerCase().trim(),
        entry.phone || '',
        entry.street || '',
        entry.city || '',
        entry.zip || '',
        entry.country || '',
        entry.ip || '',
        entry.fingerprint || '',
        entry.userAgent || '',
        entry.browser || '',
        entry.os || '',
        entry.vpnProxy || '',
        entry.reason || '',
        entry.notes || '',
        entry.riskLevel || 'High',
        entry.status || 'Active',
        data[i][18],
        new Date()
      ]]);

      logActivity_('blacklist_updated', '', '', entry.fullName || '', entry.email || '', 0, '', 'admin', 'Updated: ' + id);
      return { success: true };
    }
  }
  return { success: false, error: 'Entry not found' };
}

/** Delete blacklist entry */
function deleteBlacklistEntry(id) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAMES.BLACKLIST);
  if (!sheet) return { success: false };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      logActivity_('blacklist_deleted', '', '', data[i][1] || '', data[i][2] || '', 0, '', 'admin', 'Deleted: ' + id);
      return { success: true };
    }
  }
  return { success: false, error: 'Entry not found' };
}

/** Get activity log entries */
function getActivityLog(limit) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAMES.LOG);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var entries = [];
  var max = Math.min(data.length, (limit || 200) + 1);
  for (var i = 1; i < max; i++) {
    entries.push({
      timestamp: data[i][0],
      action: data[i][1],
      orderId: data[i][2],
      orderNumber: data[i][3],
      customerName: data[i][4],
      customerEmail: data[i][5],
      riskScore: data[i][6],
      signals: data[i][7],
      decision: data[i][8],
      details: data[i][9]
    });
  }
  return entries;
}

/** Get order match history */
function getMatchHistory(limit) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAMES.MATCHES);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var entries = [];
  var max = Math.min(data.length, (limit || 200) + 1);
  for (var i = 1; i < max; i++) {
    entries.push({
      timestamp: data[i][0],
      orderId: data[i][1],
      orderNumber: data[i][2],
      customerName: data[i][3],
      customerEmail: data[i][4],
      customerPhone: data[i][5],
      customerIp: data[i][6],
      shippingAddress: data[i][7],
      riskScore: data[i][8],
      matchedIds: data[i][9],
      matchedSignals: data[i][10],
      decision: data[i][11],
      actionTaken: data[i][12],
      cancellationReason: data[i][13]
    });
  }
  return entries;
}

/** Get dashboard settings */
function getDashboardSettings() {
  return getSettings_();
}

/** Update a single setting */
function updateSetting(key, value) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) return { success: false };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      logActivity_('setting_changed', '', '', '', '', 0, '', 'admin', key + ' = ' + value);
      return { success: true };
    }
  }

  // Add new setting if doesn't exist
  sheet.appendRow([key, value]);
  return { success: true };
}

/** Get dashboard statistics */
function getDashboardStats() {
  var blacklist = getBlacklist_();
  var active = blacklist.filter(function(e) { return e.status === 'Active'; }).length;

  var ss = getSpreadsheet_();

  // Count matches
  var matchSheet = ss.getSheetByName(SHEET_NAMES.MATCHES);
  var totalMatches = matchSheet ? Math.max(0, matchSheet.getLastRow() - 1) : 0;

  // Count cancellations from log
  var logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
  var totalCanceled = 0;
  var totalChecked = 0;
  if (logSheet && logSheet.getLastRow() > 1) {
    var logData = logSheet.getDataRange().getValues();
    for (var i = 1; i < logData.length; i++) {
      if (logData[i][1] === 'order_canceled') totalCanceled++;
      if (logData[i][1] === 'order_checked') totalChecked++;
    }
  }

  return {
    totalBlacklisted: blacklist.length,
    activeBlacklisted: active,
    totalOrdersChecked: totalChecked,
    totalCanceled: totalCanceled,
    totalMatches: totalMatches
  };
}

/** Manually cancel an order from dashboard */
function manualCancelOrder(orderId, reason) {
  var success = cancelOrder_(orderId, reason || 'Manuell storniert — Betrugsverdacht');
  logActivity_(
    'order_canceled',
    String(orderId), '', '', '', 0, '', 'manual_cancel',
    reason || 'Manual cancel from dashboard'
  );
  return { success: success };
}

// ═══════════════════════════════════════════════════════════════
// 9. EMAIL NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

function sendNotification_(email, order, customer, result, action) {
  try {
    var subject = action === 'auto_canceled'
      ? '🚫 Bestellung storniert — #' + (order.order_number || order.name)
      : '⚠️ Bestellung markiert — #' + (order.order_number || order.name);

    var body = 'Anti-Fraud Alert\n\n' +
      'Bestellung: #' + (order.order_number || order.name) + '\n' +
      'Kunde: ' + customer.fullName + '\n' +
      'E-Mail: ' + customer.email + '\n' +
      'Telefon: ' + customer.phone + '\n' +
      'IP: ' + customer.ip + '\n' +
      'Adresse: ' + customer.fullAddress + '\n\n' +
      'Risk Score: ' + result.riskScore + '/100\n' +
      'Signals: ' + result.signals.join(', ') + '\n' +
      'Decision: ' + action + '\n\n' +
      'Matched Blacklist IDs: ' + result.matchedIds.join(', ');

    MailApp.sendEmail(email, subject, body);
  } catch (e) {
    Logger.log('Email notification error: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 10. TEST / DEBUG
// ═══════════════════════════════════════════════════════════════

/** Test with a simulated order */
function testWithFakeOrder() {
  var fakeOrder = {
    id: 'TEST-' + Date.now(),
    order_number: 'TEST-001',
    name: '#TEST-001',
    email: 'test@example.com',
    browser_ip: '127.0.0.1',
    customer: {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      phone: '+49 170 1234567'
    },
    billing_address: {
      first_name: 'Test',
      last_name: 'User',
      address1: 'Teststraße 123',
      city: 'Berlin',
      zip: '10115',
      country_code: 'DE'
    },
    shipping_address: {
      first_name: 'Test',
      last_name: 'User',
      address1: 'Teststraße 123',
      city: 'Berlin',
      zip: '10115',
      country_code: 'DE',
      phone: '+49 170 1234567'
    },
    client_details: {
      browser_ip: '127.0.0.1',
      user_agent: 'Mozilla/5.0 Test Browser'
    }
  };

  var customer = extractCustomerData_(fakeOrder);
  var blacklist = getBlacklist_();
  var result = matchAgainstBlacklist_(customer, blacklist);

  Logger.log('Customer: ' + JSON.stringify(customer));
  Logger.log('Risk Score: ' + result.riskScore);
  Logger.log('Signals: ' + result.signals.join(', '));
  Logger.log('Decision: ' + result.decision);
  Logger.log('Matched IDs: ' + result.matchedIds.join(', '));
}
