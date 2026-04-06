/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         KARINEX REPRICING SYSTEM — idealo Edition           ║
 * ║         Version 1.0.0 · April 2026                         ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Automatic repricing engine for idealo marketplace.         ║
 * ║  Monitors competitor prices and adjusts own offers to       ║
 * ║  maintain competitive positioning (lowest - €0.01).         ║
 * ║                                                             ║
 * ║  Architecture:                                              ║
 * ║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        ║
 * ║  │ Dashboard   │→ │ GAS Backend │→ │ idealo API  │        ║
 * ║  │ (Web App)   │  │ (this file) │  │ + Sheets DB │        ║
 * ║  └─────────────┘  └─────────────┘  └─────────────┘        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════
// 1. CONFIGURATION
// ═══════════════════════════════════════════════════════════════

var CONFIG = {
  VERSION: '1.0.0',
  SYSTEM_NAME: 'Karinex Repricing',

  // idealo Import API
  IDEALO_API_BASE: 'https://import.idealo.com/shop',
  IDEALO_AUTH_URL: 'https://import.idealo.com/oauth2/token',

  // Credentials stored in Script Properties (never hardcoded)
  // Set via: setupCredentials() or Dashboard Settings
  PROP_SHOP_ID:       'IDEALO_SHOP_ID',
  PROP_CLIENT_ID:     'IDEALO_CLIENT_ID',
  PROP_CLIENT_SECRET: 'IDEALO_CLIENT_SECRET',
  PROP_ACCESS_TOKEN:  'IDEALO_ACCESS_TOKEN',
  PROP_TOKEN_EXPIRY:  'IDEALO_TOKEN_EXPIRY',
  PROP_ADMIN_KEY:     'REPRICING_ADMIN_KEY',
  PROP_SYSTEM_ACTIVE: 'REPRICING_SYSTEM_ACTIVE',
  PROP_TELEGRAM_TOKEN:'REPRICING_TELEGRAM_TOKEN',
  PROP_TELEGRAM_CHAT: 'REPRICING_TELEGRAM_CHAT',
  PROP_EMAIL_ALERTS:  'REPRICING_EMAIL_ALERTS',

  // Sheets
  SHEET_PRODUCTS:  'Products',
  SHEET_LOG:       'PriceLog',
  SHEET_ERRORS:    'ErrorLog',
  SHEET_SETTINGS:  'Settings',
  SHEET_COMPETITORS: 'Competitors',

  // Defaults
  DEFAULT_UNDERCUT:   0.01,
  DEFAULT_INTERVAL:   15,       // minutes between repricing runs
  MAX_API_RETRIES:    3,
  RATE_LIMIT_DELAY:   1000,     // ms between API calls
  LOG_RETENTION_DAYS: 90,
  MAX_PRODUCTS_PER_RUN: 200
};


// ═══════════════════════════════════════════════════════════════
// 2. WEB APP ENTRY POINTS
// ═══════════════════════════════════════════════════════════════

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var key    = (e && e.parameter && e.parameter.key)    || '';

  // Public health check
  if (!action || action === 'ping') {
    return jsonOut_({ ok: true, service: 'karinex-repricing', version: CONFIG.VERSION });
  }

  // Dashboard
  if (action === 'dashboard') {
    if (!verifyAdmin_(key)) {
      return jsonOut_({ ok: false, error: 'Unauthorized' });
    }
    return serveDashboard_();
  }

  return jsonOut_({ ok: false, error: 'Unknown action' });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var key  = body.key || '';
    if (!verifyAdmin_(key)) {
      return jsonOut_({ ok: false, error: 'Unauthorized' });
    }

    var action = body.action || '';
    var data   = body.data   || {};

    switch (action) {
      // Products
      case 'getProducts':        return jsonOut_(adminGetProducts_());
      case 'addProduct':         return jsonOut_(adminAddProduct_(data));
      case 'updateProduct':      return jsonOut_(adminUpdateProduct_(data));
      case 'deleteProduct':      return jsonOut_(adminDeleteProduct_(data));
      case 'toggleProduct':      return jsonOut_(adminToggleProduct_(data));
      case 'bulkToggle':         return jsonOut_(adminBulkToggle_(data));
      case 'importProducts':     return jsonOut_(adminImportProducts_(data));

      // Repricing
      case 'runRepricing':       return jsonOut_(manualRepricing_());
      case 'repriceSingle':      return jsonOut_(repriceSingleProduct_(data));
      case 'fetchCompetitors':   return jsonOut_(fetchCompetitorsSingle_(data));

      // System
      case 'getDashboardData':   return jsonOut_(getDashboardData_());
      case 'getStats':           return jsonOut_(getSystemStats_());
      case 'getLogs':            return jsonOut_(getLogs_(data));
      case 'getErrors':          return jsonOut_(getErrors_(data));
      case 'getSettings':        return jsonOut_(getSettings_());
      case 'saveSettings':       return jsonOut_(saveSettings_(data));
      case 'testConnection':     return jsonOut_(testIdealoConnection_());
      case 'toggleSystem':       return jsonOut_(toggleSystem_(data));
      case 'clearLogs':          return jsonOut_(clearLogs_(data));

      default:
        return jsonOut_({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    logError_('doPost', err);
    return jsonOut_({ ok: false, error: err.message });
  }
}


// ═══════════════════════════════════════════════════════════════
// 3. AUTH & SECURITY
// ═══════════════════════════════════════════════════════════════

function verifyAdmin_(key) {
  var stored = getProp_(CONFIG.PROP_ADMIN_KEY);
  return stored && key === stored;
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function setProp_(key, val) {
  PropertiesService.getScriptProperties().setProperty(key, val);
}

function getProps_() {
  return PropertiesService.getScriptProperties().getProperties();
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ═══════════════════════════════════════════════════════════════
// 4. idealo IMPORT API — OAuth2 + REST
// ═══════════════════════════════════════════════════════════════

/**
 * Get valid access token (auto-refresh if expired)
 */
function getAccessToken_() {
  var token  = getProp_(CONFIG.PROP_ACCESS_TOKEN);
  var expiry = parseInt(getProp_(CONFIG.PROP_TOKEN_EXPIRY) || '0', 10);

  if (token && Date.now() < expiry - 60000) {
    return token;
  }

  // Refresh token
  var clientId     = getProp_(CONFIG.PROP_CLIENT_ID);
  var clientSecret = getProp_(CONFIG.PROP_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    throw new Error('idealo API credentials not configured');
  }

  var resp = UrlFetchApp.fetch(CONFIG.IDEALO_AUTH_URL, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: 'grant_type=client_credentials',
    headers: {
      'Authorization': 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret)
    },
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var body = JSON.parse(resp.getContentText());

  if (code !== 200 || !body.access_token) {
    throw new Error('OAuth failed (' + code + '): ' + (body.error_description || body.error || 'Unknown'));
  }

  var expiresIn = (body.expires_in || 3600) * 1000;
  setProp_(CONFIG.PROP_ACCESS_TOKEN, body.access_token);
  setProp_(CONFIG.PROP_TOKEN_EXPIRY, String(Date.now() + expiresIn));

  return body.access_token;
}

/**
 * Generic idealo API call with retry logic
 */
function idealoApi_(method, path, payload) {
  var shopId = getProp_(CONFIG.PROP_SHOP_ID);
  if (!shopId) throw new Error('Shop ID not configured');

  var url = CONFIG.IDEALO_API_BASE + '/' + shopId + path;
  var lastErr;

  for (var attempt = 1; attempt <= CONFIG.MAX_API_RETRIES; attempt++) {
    try {
      var token = getAccessToken_();
      var opts = {
        method: method,
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type':  'application/json;charset=UTF-8',
          'Accept':        'application/json'
        },
        muteHttpExceptions: true
      };

      if (payload && (method === 'put' || method === 'post' || method === 'patch')) {
        opts.payload = JSON.stringify(payload);
      }

      var resp = UrlFetchApp.fetch(url, opts);
      var code = resp.getResponseCode();

      if (code === 429) {
        // Rate limited — wait and retry
        var retryAfter = parseInt(resp.getHeaders()['Retry-After'] || '5', 10);
        Utilities.sleep(retryAfter * 1000);
        continue;
      }

      if (code === 401) {
        // Token expired — clear and retry
        setProp_(CONFIG.PROP_ACCESS_TOKEN, '');
        continue;
      }

      var text = resp.getContentText();
      var result = text ? JSON.parse(text) : {};

      if (code >= 200 && code < 300) {
        return { ok: true, status: code, data: result };
      }

      lastErr = 'HTTP ' + code + ': ' + (result.message || text.substring(0, 200));

    } catch (err) {
      lastErr = err.message;
    }

    if (attempt < CONFIG.MAX_API_RETRIES) {
      Utilities.sleep(CONFIG.RATE_LIMIT_DELAY * attempt);
    }
  }

  throw new Error('idealo API failed after ' + CONFIG.MAX_API_RETRIES + ' attempts: ' + lastErr);
}

/**
 * Update offer price on idealo
 */
function updateIdealoPrice_(sku, priceEur) {
  var priceFormatted = formatPrice_(priceEur);

  return idealoApi_('put', '/offers/' + encodeURIComponent(sku) + '/', {
    sku: sku,
    price: String(priceFormatted),
    currency: 'EUR',
    url: '',               // keep existing URL
    deliveryCosts: '',     // keep existing
    deliveryTime: ''       // keep existing
  });
}

/**
 * Fetch own offer from idealo
 */
function getIdealoOffer_(sku) {
  return idealoApi_('get', '/offers/' + encodeURIComponent(sku) + '/');
}

/**
 * Fetch price comparison data for a product from idealo
 * Uses the idealo product page to get competitor prices
 */
function fetchCompetitorPrices_(idealoProductUrl) {
  if (!idealoProductUrl) return { ok: false, prices: [], cheapest: null };

  try {
    // idealo product page scraping (legal for own products monitoring)
    var resp = UrlFetchApp.fetch(idealoProductUrl, {
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KarinexRepricing/1.0)',
        'Accept': 'text/html'
      },
      followRedirects: true
    });

    if (resp.getResponseCode() !== 200) {
      return { ok: false, prices: [], cheapest: null, error: 'HTTP ' + resp.getResponseCode() };
    }

    var html = resp.getContentText();
    var prices = [];

    // Extract offer prices from idealo JSON-LD or structured data
    var jsonLdMatch = html.match(/"offers"\s*:\s*(\[[\s\S]*?\])/);
    if (jsonLdMatch) {
      try {
        var offers = JSON.parse(jsonLdMatch[1]);
        for (var i = 0; i < offers.length; i++) {
          var p = parseFloat(offers[i].price || offers[i].lowPrice || 0);
          var seller = offers[i].seller ? (offers[i].seller.name || 'Unknown') : 'Unknown';
          if (p > 0) {
            prices.push({ price: p, seller: seller });
          }
        }
      } catch (e) { /* parse error, try fallback */ }
    }

    // Fallback: extract from offer list pattern
    if (prices.length === 0) {
      var pricePattern = /data-shop-name="([^"]+)"[\s\S]*?(\d+[.,]\d{2})\s*€/g;
      var m;
      while ((m = pricePattern.exec(html)) !== null) {
        var pVal = parseFloat(m[2].replace(',', '.'));
        if (pVal > 0) {
          prices.push({ price: pVal, seller: m[1] });
        }
      }
    }

    // Fallback 2: plain price extraction
    if (prices.length === 0) {
      var plainPattern = /class="[^"]*offerList[^"]*"[\s\S]*?(\d+[.,]\d{2})\s*[€&euro;]/g;
      while ((m = plainPattern.exec(html)) !== null) {
        var pv = parseFloat(m[1].replace(',', '.'));
        if (pv > 0) prices.push({ price: pv, seller: 'Unknown' });
      }
    }

    // Sort by price ascending
    prices.sort(function(a, b) { return a.price - b.price; });

    // Filter out own shop
    var shopName = getProp_('SHOP_DISPLAY_NAME') || 'karinex';
    var competitorPrices = prices.filter(function(p) {
      return p.seller.toLowerCase().indexOf(shopName.toLowerCase()) === -1;
    });

    return {
      ok: true,
      prices: competitorPrices,
      allPrices: prices,
      cheapest: competitorPrices.length > 0 ? competitorPrices[0].price : null,
      cheapestSeller: competitorPrices.length > 0 ? competitorPrices[0].seller : null
    };

  } catch (err) {
    logError_('fetchCompetitorPrices', err);
    return { ok: false, prices: [], cheapest: null, error: err.message };
  }
}


// ═══════════════════════════════════════════════════════════════
// 5. GOOGLE SHEETS — DATA LAYER
// ═══════════════════════════════════════════════════════════════

function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = getProp_('SPREADSHEET_ID');
    if (id) ss = SpreadsheetApp.openById(id);
  }
  if (!ss) throw new Error('Spreadsheet not found. Run setupSheets() first.');
  return ss;
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    initSheetHeaders_(sh, name);
  }
  return sh;
}

function initSheetHeaders_(sh, name) {
  switch (name) {
    case CONFIG.SHEET_PRODUCTS:
      sh.appendRow([
        'SKU', 'Title', 'Category', 'idealo_URL', 'Current_Price', 'Min_Price', 'Max_Price',
        'Undercut', 'Active', 'Last_Competitor_Price', 'Last_Competitor_Name',
        'Last_Repriced', 'Last_Status', 'Notes'
      ]);
      sh.setFrozenRows(1);
      sh.getRange('A1:N1').setFontWeight('bold').setBackground('#1a1a2e').setFontColor('#fff');
      break;

    case CONFIG.SHEET_LOG:
      sh.appendRow([
        'Timestamp', 'SKU', 'Title', 'Old_Price', 'New_Price', 'Competitor_Price',
        'Competitor_Name', 'Reason', 'Status', 'Details'
      ]);
      sh.setFrozenRows(1);
      sh.getRange('A1:J1').setFontWeight('bold').setBackground('#16213e').setFontColor('#fff');
      break;

    case CONFIG.SHEET_ERRORS:
      sh.appendRow(['Timestamp', 'Function', 'Error', 'Details', 'Resolved']);
      sh.setFrozenRows(1);
      sh.getRange('A1:E1').setFontWeight('bold').setBackground('#c62828').setFontColor('#fff');
      break;

    case CONFIG.SHEET_SETTINGS:
      sh.appendRow(['Key', 'Value', 'Description']);
      sh.setFrozenRows(1);
      var defaults = [
        ['default_undercut', '0.01', 'Default undercut amount in EUR'],
        ['check_interval_minutes', '15', 'Minutes between automatic checks'],
        ['system_active', 'true', 'Master on/off switch'],
        ['email_alerts', '', 'Email for alert notifications'],
        ['telegram_token', '', 'Telegram bot token for alerts'],
        ['telegram_chat_id', '', 'Telegram chat ID for alerts'],
        ['shop_display_name', 'karinex', 'Your shop name on idealo (for filtering)'],
        ['max_products_per_run', '200', 'Max products per repricing cycle'],
        ['dry_run', 'false', 'If true, calculates but does not update prices']
      ];
      for (var i = 0; i < defaults.length; i++) {
        sh.appendRow(defaults[i]);
      }
      break;

    case CONFIG.SHEET_COMPETITORS:
      sh.appendRow(['Timestamp', 'SKU', 'Competitor_Name', 'Competitor_Price', 'Product_URL']);
      sh.setFrozenRows(1);
      sh.getRange('A1:E1').setFontWeight('bold').setBackground('#0d47a1').setFontColor('#fff');
      break;
  }
}

/**
 * Read all products from sheet as array of objects
 */
function readProducts_() {
  var sh = getSheet_(CONFIG.SHEET_PRODUCTS);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var products = [];
  for (var r = 1; r < data.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = data[r][c];
    }
    obj._row = r + 1; // 1-indexed sheet row
    products.push(obj);
  }
  return products;
}

/**
 * Update a single cell in Products sheet
 */
function updateProductCell_(row, colName, value) {
  var sh = getSheet_(CONFIG.SHEET_PRODUCTS);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var colIdx = headers.indexOf(colName);
  if (colIdx === -1) throw new Error('Column not found: ' + colName);
  sh.getRange(row, colIdx + 1).setValue(value);
}

/**
 * Update multiple cells in a product row
 */
function updateProductRow_(row, updates) {
  var sh = getSheet_(CONFIG.SHEET_PRODUCTS);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var key in updates) {
    var colIdx = headers.indexOf(key);
    if (colIdx !== -1) {
      sh.getRange(row, colIdx + 1).setValue(updates[key]);
    }
  }
}

/**
 * Write price change log entry
 */
function writeLog_(sku, title, oldPrice, newPrice, competitorPrice, competitorName, reason, status, details) {
  var sh = getSheet_(CONFIG.SHEET_LOG);
  sh.insertRowAfter(1);
  sh.getRange(2, 1, 1, 10).setValues([[
    new Date(), sku, title, oldPrice, newPrice,
    competitorPrice, competitorName, reason, status, details || ''
  ]]);
}

/**
 * Write error log entry
 */
function logError_(funcName, err) {
  try {
    var sh = getSheet_(CONFIG.SHEET_ERRORS);
    sh.insertRowAfter(1);
    sh.getRange(2, 1, 1, 5).setValues([[
      new Date(), funcName, err.message || String(err),
      err.stack || '', 'No'
    ]]);
  } catch (e) {
    Logger.log('logError_ failed: ' + e.message);
  }
}

/**
 * Read a setting from the Settings sheet
 */
function getSetting_(key) {
  var sh = getSheet_(CONFIG.SHEET_SETTINGS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return String(data[i][1]);
  }
  return '';
}

/**
 * Write a setting to the Settings sheet
 */
function setSetting_(key, value) {
  var sh = getSheet_(CONFIG.SHEET_SETTINGS);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value, '']);
}


// ═══════════════════════════════════════════════════════════════
// 6. REPRICING ENGINE — CORE LOGIC
// ═══════════════════════════════════════════════════════════════

/**
 * Main repricing cycle — called by trigger or manually
 */
function runRepricingCycle() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('Repricing already running, skipping.');
    return { ok: false, message: 'Already running' };
  }

  try {
    // Check master switch
    var systemActive = getSetting_('system_active');
    if (systemActive === 'false') {
      return { ok: true, message: 'System is paused', processed: 0 };
    }

    var products = readProducts_();
    var dryRun   = getSetting_('dry_run') === 'true';
    var maxPerRun = parseInt(getSetting_('max_products_per_run') || CONFIG.MAX_PRODUCTS_PER_RUN, 10);
    var defaultUndercut = parseFloat(getSetting_('default_undercut') || CONFIG.DEFAULT_UNDERCUT);

    var activeProducts = products.filter(function(p) { return String(p.Active).toLowerCase() === 'true'; });

    var stats = { processed: 0, updated: 0, skipped: 0, errors: 0, unchanged: 0 };
    var limit = Math.min(activeProducts.length, maxPerRun);

    for (var i = 0; i < limit; i++) {
      var product = activeProducts[i];
      try {
        var result = repriceProduct_(product, defaultUndercut, dryRun);
        stats.processed++;

        if (result.updated) stats.updated++;
        else if (result.unchanged) stats.unchanged++;
        else stats.skipped++;

      } catch (err) {
        stats.errors++;
        logError_('repriceProduct[' + product.SKU + ']', err);
        writeLog_(product.SKU, product.Title, product.Current_Price, '',
                  '', '', 'ERROR', 'Failed', err.message);
      }

      // Rate limiting
      if (i < limit - 1) {
        Utilities.sleep(CONFIG.RATE_LIMIT_DELAY);
      }
    }

    // Send summary notification if there were updates
    if (stats.updated > 0 || stats.errors > 0) {
      sendNotification_(
        'Repricing Complete',
        'Processed: ' + stats.processed +
        ' | Updated: ' + stats.updated +
        ' | Errors: ' + stats.errors +
        ' | Unchanged: ' + stats.unchanged
      );
    }

    return { ok: true, stats: stats, dryRun: dryRun };

  } catch (err) {
    logError_('runRepricingCycle', err);
    sendNotification_('Repricing FAILED', err.message);
    return { ok: false, error: err.message };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Reprice a single product
 */
function repriceProduct_(product, defaultUndercut, dryRun) {
  var sku        = String(product.SKU);
  var title      = String(product.Title);
  var currentPrice = parseFloat(product.Current_Price) || 0;
  var minPrice   = parseFloat(product.Min_Price) || 0;
  var maxPrice   = parseFloat(product.Max_Price) || 0;
  var undercut   = parseFloat(product.Undercut) || defaultUndercut;
  var idealoUrl  = String(product.idealo_URL);

  // 1. Fetch competitor prices
  var comp = fetchCompetitorPrices_(idealoUrl);
  if (!comp.ok || comp.cheapest === null) {
    // No competitor data — skip
    updateProductRow_(product._row, {
      Last_Repriced: new Date(),
      Last_Status: 'No competitor data'
    });
    return { updated: false, unchanged: false, skipped: true };
  }

  var cheapestPrice = comp.cheapest;
  var cheapestName  = comp.cheapestSeller || 'Unknown';

  // Store competitor data
  updateProductRow_(product._row, {
    Last_Competitor_Price: cheapestPrice,
    Last_Competitor_Name: cheapestName
  });

  // Log competitor snapshot
  logCompetitorSnapshot_(sku, comp.prices, idealoUrl);

  // 2. Calculate target price
  var targetPrice = formatPrice_(cheapestPrice - undercut);
  var reason = '';

  // 3. Apply floor (min price)
  if (minPrice > 0 && targetPrice < minPrice) {
    targetPrice = minPrice;
    reason = 'Floor applied (min: €' + minPrice.toFixed(2) + ')';
  }

  // 4. Apply ceiling (max price) — if target > max, cap it
  if (maxPrice > 0 && targetPrice > maxPrice) {
    targetPrice = maxPrice;
    reason = 'Ceiling applied (max: €' + maxPrice.toFixed(2) + ')';
  }

  // 5. Don't undercut yourself if you're already cheapest
  if (currentPrice > 0 && currentPrice <= cheapestPrice && currentPrice <= targetPrice) {
    // Already cheapest — but check if we could raise price
    if (targetPrice > currentPrice) {
      reason = reason || 'Price raised (competitors higher)';
      // Continue to update
    } else {
      // No change needed
      updateProductRow_(product._row, {
        Last_Repriced: new Date(),
        Last_Status: 'Already cheapest'
      });
      writeLog_(sku, title, currentPrice, currentPrice, cheapestPrice,
                cheapestName, 'Already cheapest — no change', 'Skipped', '');
      return { updated: false, unchanged: true, skipped: false };
    }
  }

  // 6. Check if price actually changed
  if (formatPrice_(targetPrice) === formatPrice_(currentPrice)) {
    updateProductRow_(product._row, {
      Last_Repriced: new Date(),
      Last_Status: 'Unchanged'
    });
    return { updated: false, unchanged: true, skipped: false };
  }

  reason = reason || 'Undercut competitor by €' + undercut.toFixed(2);

  // 7. Execute price update
  if (dryRun) {
    writeLog_(sku, title, currentPrice, targetPrice, cheapestPrice,
              cheapestName, reason, 'DryRun', 'Would update');
    updateProductRow_(product._row, {
      Last_Repriced: new Date(),
      Last_Status: 'DryRun: €' + targetPrice.toFixed(2)
    });
    return { updated: false, unchanged: false, skipped: false, dryRun: true };
  }

  // Actually update price on idealo
  try {
    var apiResult = updateIdealoPrice_(sku, targetPrice);

    // Update sheet
    updateProductRow_(product._row, {
      Current_Price: targetPrice,
      Last_Repriced: new Date(),
      Last_Status: 'Updated'
    });

    writeLog_(sku, title, currentPrice, targetPrice, cheapestPrice,
              cheapestName, reason, 'Success', JSON.stringify(apiResult.data || {}));

    return { updated: true, unchanged: false, skipped: false };

  } catch (apiErr) {
    writeLog_(sku, title, currentPrice, targetPrice, cheapestPrice,
              cheapestName, reason, 'Failed', apiErr.message);
    logError_('updatePrice[' + sku + ']', apiErr);
    throw apiErr;
  }
}

/**
 * Log competitor price snapshot
 */
function logCompetitorSnapshot_(sku, prices, url) {
  if (!prices || prices.length === 0) return;
  var sh = getSheet_(CONFIG.SHEET_COMPETITORS);
  var now = new Date();
  var rows = [];
  var limit = Math.min(prices.length, 10); // top 10 competitors
  for (var i = 0; i < limit; i++) {
    rows.push([now, sku, prices[i].seller, prices[i].price, url]);
  }
  if (rows.length > 0) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }
}


// ═══════════════════════════════════════════════════════════════
// 7. DASHBOARD API HANDLERS
// ═══════════════════════════════════════════════════════════════

function getDashboardData_() {
  var products = readProducts_();
  var active   = products.filter(function(p) { return String(p.Active).toLowerCase() === 'true'; });
  var systemOn = getSetting_('system_active') !== 'false';

  // Recent logs
  var logSh = getSheet_(CONFIG.SHEET_LOG);
  var logData = logSh.getDataRange().getValues();
  var recentLogs = [];
  var logLimit = Math.min(logData.length, 51);
  for (var i = 1; i < logLimit; i++) {
    recentLogs.push({
      timestamp: logData[i][0],
      sku: logData[i][1],
      title: logData[i][2],
      oldPrice: logData[i][3],
      newPrice: logData[i][4],
      competitorPrice: logData[i][5],
      competitorName: logData[i][6],
      reason: logData[i][7],
      status: logData[i][8],
      details: logData[i][9]
    });
  }

  // Recent errors
  var errSh = getSheet_(CONFIG.SHEET_ERRORS);
  var errData = errSh.getDataRange().getValues();
  var recentErrors = [];
  var errLimit = Math.min(errData.length, 21);
  for (var j = 1; j < errLimit; j++) {
    recentErrors.push({
      timestamp: errData[j][0],
      func: errData[j][1],
      error: errData[j][2],
      details: errData[j][3],
      resolved: errData[j][4]
    });
  }

  // Stats
  var todayLogs = recentLogs.filter(function(l) {
    if (!l.timestamp) return false;
    var d = new Date(l.timestamp);
    var today = new Date();
    return d.toDateString() === today.toDateString();
  });

  var todayUpdated = todayLogs.filter(function(l) { return l.status === 'Success'; }).length;
  var todayFailed  = todayLogs.filter(function(l) { return l.status === 'Failed'; }).length;

  return {
    ok: true,
    systemActive: systemOn,
    totalProducts: products.length,
    activeProducts: active.length,
    todayUpdated: todayUpdated,
    todayFailed: todayFailed,
    totalLogs: logData.length - 1,
    products: products.map(function(p) {
      return {
        row: p._row,
        sku: p.SKU,
        title: p.Title,
        category: p.Category,
        idealoUrl: p.idealo_URL,
        currentPrice: p.Current_Price,
        minPrice: p.Min_Price,
        maxPrice: p.Max_Price,
        undercut: p.Undercut,
        active: String(p.Active).toLowerCase() === 'true',
        lastCompetitorPrice: p.Last_Competitor_Price,
        lastCompetitorName: p.Last_Competitor_Name,
        lastRepriced: p.Last_Repriced,
        lastStatus: p.Last_Status,
        notes: p.Notes
      };
    }),
    recentLogs: recentLogs.slice(0, 20),
    recentErrors: recentErrors.slice(0, 10),
    version: CONFIG.VERSION
  };
}

function adminGetProducts_() {
  return { ok: true, products: readProducts_() };
}

function adminAddProduct_(data) {
  var sh = getSheet_(CONFIG.SHEET_PRODUCTS);
  sh.appendRow([
    data.sku || '', data.title || '', data.category || '', data.idealoUrl || '',
    data.currentPrice || 0, data.minPrice || 0, data.maxPrice || 0,
    data.undercut || CONFIG.DEFAULT_UNDERCUT, 'true',
    '', '', '', '', data.notes || ''
  ]);
  return { ok: true, message: 'Product added' };
}

function adminUpdateProduct_(data) {
  if (!data.row) return { ok: false, error: 'Row not specified' };
  var updates = {};
  if (data.sku !== undefined)          updates.SKU = data.sku;
  if (data.title !== undefined)        updates.Title = data.title;
  if (data.category !== undefined)     updates.Category = data.category;
  if (data.idealoUrl !== undefined)    updates.idealo_URL = data.idealoUrl;
  if (data.currentPrice !== undefined) updates.Current_Price = data.currentPrice;
  if (data.minPrice !== undefined)     updates.Min_Price = data.minPrice;
  if (data.maxPrice !== undefined)     updates.Max_Price = data.maxPrice;
  if (data.undercut !== undefined)     updates.Undercut = data.undercut;
  if (data.active !== undefined)       updates.Active = data.active;
  if (data.notes !== undefined)        updates.Notes = data.notes;
  updateProductRow_(data.row, updates);
  return { ok: true, message: 'Product updated' };
}

function adminDeleteProduct_(data) {
  if (!data.row) return { ok: false, error: 'Row not specified' };
  var sh = getSheet_(CONFIG.SHEET_PRODUCTS);
  sh.deleteRow(data.row);
  return { ok: true, message: 'Product deleted' };
}

function adminToggleProduct_(data) {
  if (!data.row) return { ok: false, error: 'Row not specified' };
  updateProductCell_(data.row, 'Active', data.active ? 'true' : 'false');
  return { ok: true, message: 'Product ' + (data.active ? 'activated' : 'deactivated') };
}

function adminBulkToggle_(data) {
  var active = data.active ? 'true' : 'false';
  var filter = data.filter || 'all'; // all, category, selected
  var products = readProducts_();

  var count = 0;
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var match = false;
    if (filter === 'all') match = true;
    else if (filter === 'category' && p.Category === data.category) match = true;
    else if (filter === 'selected' && data.skus && data.skus.indexOf(p.SKU) !== -1) match = true;

    if (match) {
      updateProductCell_(p._row, 'Active', active);
      count++;
    }
  }
  return { ok: true, message: count + ' products ' + (data.active ? 'activated' : 'deactivated') };
}

function adminImportProducts_(data) {
  if (!data.products || !data.products.length) return { ok: false, error: 'No products' };
  var sh = getSheet_(CONFIG.SHEET_PRODUCTS);
  var count = 0;
  for (var i = 0; i < data.products.length; i++) {
    var p = data.products[i];
    sh.appendRow([
      p.sku || '', p.title || '', p.category || '', p.idealoUrl || '',
      p.currentPrice || 0, p.minPrice || 0, p.maxPrice || 0,
      p.undercut || CONFIG.DEFAULT_UNDERCUT, 'true',
      '', '', '', '', p.notes || ''
    ]);
    count++;
  }
  return { ok: true, message: count + ' products imported' };
}

function manualRepricing_() {
  return runRepricingCycle();
}

function repriceSingleProduct_(data) {
  if (!data.sku) return { ok: false, error: 'SKU required' };
  var products = readProducts_();
  var product = null;
  for (var i = 0; i < products.length; i++) {
    if (String(products[i].SKU) === String(data.sku)) {
      product = products[i];
      break;
    }
  }
  if (!product) return { ok: false, error: 'Product not found' };

  var defaultUndercut = parseFloat(getSetting_('default_undercut') || CONFIG.DEFAULT_UNDERCUT);
  var dryRun = getSetting_('dry_run') === 'true';

  try {
    var result = repriceProduct_(product, defaultUndercut, dryRun);
    return { ok: true, result: result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function fetchCompetitorsSingle_(data) {
  if (!data.idealoUrl) return { ok: false, error: 'idealo URL required' };
  return fetchCompetitorPrices_(data.idealoUrl);
}

function getSystemStats_() {
  var products = readProducts_();
  var active = products.filter(function(p) { return String(p.Active).toLowerCase() === 'true'; }).length;
  var logSh = getSheet_(CONFIG.SHEET_LOG);
  var errSh = getSheet_(CONFIG.SHEET_ERRORS);
  return {
    ok: true,
    totalProducts: products.length,
    activeProducts: active,
    totalLogs: Math.max(0, logSh.getLastRow() - 1),
    totalErrors: Math.max(0, errSh.getLastRow() - 1),
    systemActive: getSetting_('system_active') !== 'false',
    version: CONFIG.VERSION
  };
}

function getLogs_(data) {
  var sh = getSheet_(CONFIG.SHEET_LOG);
  var allData = sh.getDataRange().getValues();
  var limit = Math.min(data.limit || 100, allData.length);
  var logs = [];
  for (var i = 1; i < limit; i++) {
    logs.push({
      timestamp: allData[i][0],
      sku: allData[i][1], title: allData[i][2],
      oldPrice: allData[i][3], newPrice: allData[i][4],
      competitorPrice: allData[i][5], competitorName: allData[i][6],
      reason: allData[i][7], status: allData[i][8], details: allData[i][9]
    });
  }
  return { ok: true, logs: logs };
}

function getErrors_(data) {
  var sh = getSheet_(CONFIG.SHEET_ERRORS);
  var allData = sh.getDataRange().getValues();
  var limit = Math.min(data.limit || 50, allData.length);
  var errors = [];
  for (var i = 1; i < limit; i++) {
    errors.push({
      timestamp: allData[i][0], func: allData[i][1],
      error: allData[i][2], details: allData[i][3], resolved: allData[i][4]
    });
  }
  return { ok: true, errors: errors };
}

function getSettings_() {
  var sh = getSheet_(CONFIG.SHEET_SETTINGS);
  var data = sh.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < data.length; i++) {
    settings[data[i][0]] = { value: data[i][1], description: data[i][2] };
  }
  // Also include Script Properties (masked)
  settings._shopId = getProp_(CONFIG.PROP_SHOP_ID) ? '***configured***' : '';
  settings._clientId = getProp_(CONFIG.PROP_CLIENT_ID) ? '***configured***' : '';
  settings._clientSecret = getProp_(CONFIG.PROP_CLIENT_SECRET) ? '***configured***' : '';
  settings._adminKey = getProp_(CONFIG.PROP_ADMIN_KEY) ? '***configured***' : '';
  return { ok: true, settings: settings };
}

function saveSettings_(data) {
  // Sheet settings
  if (data.sheetSettings) {
    for (var key in data.sheetSettings) {
      setSetting_(key, data.sheetSettings[key]);
    }
  }
  // Script Properties (sensitive)
  if (data.shopId)       setProp_(CONFIG.PROP_SHOP_ID, data.shopId);
  if (data.clientId)     setProp_(CONFIG.PROP_CLIENT_ID, data.clientId);
  if (data.clientSecret) setProp_(CONFIG.PROP_CLIENT_SECRET, data.clientSecret);
  if (data.adminKey)     setProp_(CONFIG.PROP_ADMIN_KEY, data.adminKey);

  return { ok: true, message: 'Settings saved' };
}

function testIdealoConnection_() {
  try {
    var token = getAccessToken_();
    var shopId = getProp_(CONFIG.PROP_SHOP_ID);
    return {
      ok: true,
      message: 'Connection successful',
      shopId: shopId,
      tokenValid: !!token
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function toggleSystem_(data) {
  var active = data.active ? 'true' : 'false';
  setSetting_('system_active', active);
  setProp_(CONFIG.PROP_SYSTEM_ACTIVE, active);

  if (data.active) {
    setupTrigger_();
  } else {
    removeTriggers_();
  }

  return { ok: true, systemActive: data.active, message: 'System ' + (data.active ? 'activated' : 'deactivated') };
}

function clearLogs_(data) {
  var type = data.type || 'logs';
  if (type === 'logs' || type === 'all') {
    var logSh = getSheet_(CONFIG.SHEET_LOG);
    if (logSh.getLastRow() > 1) logSh.deleteRows(2, logSh.getLastRow() - 1);
  }
  if (type === 'errors' || type === 'all') {
    var errSh = getSheet_(CONFIG.SHEET_ERRORS);
    if (errSh.getLastRow() > 1) errSh.deleteRows(2, errSh.getLastRow() - 1);
  }
  if (type === 'competitors' || type === 'all') {
    var compSh = getSheet_(CONFIG.SHEET_COMPETITORS);
    if (compSh.getLastRow() > 1) compSh.deleteRows(2, compSh.getLastRow() - 1);
  }
  return { ok: true, message: type + ' logs cleared' };
}


// ═══════════════════════════════════════════════════════════════
// 8. NOTIFICATIONS — Telegram + Email
// ═══════════════════════════════════════════════════════════════

function sendNotification_(subject, message) {
  // Telegram
  try {
    var tgToken = getSetting_('telegram_token') || getProp_(CONFIG.PROP_TELEGRAM_TOKEN);
    var tgChat  = getSetting_('telegram_chat_id') || getProp_(CONFIG.PROP_TELEGRAM_CHAT);
    if (tgToken && tgChat) {
      var text = '🔔 *' + subject + '*\n' + message;
      UrlFetchApp.fetch('https://api.telegram.org/bot' + tgToken + '/sendMessage', {
        method: 'post',
        payload: { chat_id: tgChat, text: text, parse_mode: 'Markdown' },
        muteHttpExceptions: true
      });
    }
  } catch (e) { Logger.log('Telegram notify failed: ' + e.message); }

  // Email
  try {
    var email = getSetting_('email_alerts') || getProp_(CONFIG.PROP_EMAIL_ALERTS);
    if (email) {
      MailApp.sendEmail({
        to: email,
        subject: '[Karinex Repricing] ' + subject,
        body: message
      });
    }
  } catch (e) { Logger.log('Email notify failed: ' + e.message); }
}


// ═══════════════════════════════════════════════════════════════
// 9. TRIGGERS & AUTOMATION
// ═══════════════════════════════════════════════════════════════

function setupTrigger_() {
  removeTriggers_();
  var interval = parseInt(getSetting_('check_interval_minutes') || CONFIG.DEFAULT_INTERVAL, 10);
  ScriptApp.newTrigger('runRepricingCycle')
    .timeBased()
    .everyMinutes(interval)
    .create();
  Logger.log('Trigger created: every ' + interval + ' minutes');
}

function removeTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runRepricingCycle') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function setupLogCleanup() {
  // Daily cleanup of old logs
  var triggers = ScriptApp.getProjectTriggers();
  var exists = false;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'cleanOldLogs_') exists = true;
  }
  if (!exists) {
    ScriptApp.newTrigger('cleanOldLogs_')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .create();
  }
}

function cleanOldLogs_() {
  var retention = CONFIG.LOG_RETENTION_DAYS;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retention);

  ['PriceLog', 'ErrorLog', 'Competitors'].forEach(function(name) {
    try {
      var sh = getSheet_(name);
      var data = sh.getDataRange().getValues();
      var rowsToDelete = [];
      for (var i = data.length - 1; i >= 1; i--) {
        var ts = new Date(data[i][0]);
        if (ts < cutoff) rowsToDelete.push(i + 1);
      }
      for (var j = 0; j < rowsToDelete.length; j++) {
        sh.deleteRow(rowsToDelete[j]);
      }
    } catch (e) { Logger.log('Cleanup error on ' + name + ': ' + e.message); }
  });
}


// ═══════════════════════════════════════════════════════════════
// 10. SETUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Run ONCE to initialize the system
 */
function setupRepricingSystem() {
  // Create all sheets
  var sheets = [CONFIG.SHEET_PRODUCTS, CONFIG.SHEET_LOG, CONFIG.SHEET_ERRORS,
                CONFIG.SHEET_SETTINGS, CONFIG.SHEET_COMPETITORS];
  for (var i = 0; i < sheets.length; i++) {
    getSheet_(sheets[i]);
  }

  // Set default admin key if not set
  if (!getProp_(CONFIG.PROP_ADMIN_KEY)) {
    var key = 'KXrepricing' + Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    setProp_(CONFIG.PROP_ADMIN_KEY, key);
    Logger.log('Admin Key generated: ' + key);
    Logger.log('SAVE THIS KEY — you need it to access the dashboard!');
  }

  // Store spreadsheet ID
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) setProp_('SPREADSHEET_ID', ss.getId());

  Logger.log('✅ Repricing system initialized successfully.');
  Logger.log('📋 Sheets created: ' + sheets.join(', '));
  Logger.log('🔑 Admin Key: ' + getProp_(CONFIG.PROP_ADMIN_KEY));
  Logger.log('');
  Logger.log('NEXT STEPS:');
  Logger.log('1. Run setupCredentials() to configure idealo API');
  Logger.log('2. Deploy as Web App');
  Logger.log('3. Open dashboard at: [deployment-url]?action=dashboard&key=[admin-key]');
}

/**
 * Configure idealo API credentials
 * Call with your actual credentials
 */
function setupCredentials() {
  // ⚠️ REPLACE these with your actual values, then run ONCE, then DELETE the values from code
  var SHOP_ID       = 'YOUR_SHOP_ID';        // from idealo Business Center
  var CLIENT_ID     = 'YOUR_CLIENT_ID';       // from idealo API access
  var CLIENT_SECRET = 'YOUR_CLIENT_SECRET';   // from idealo API access

  if (SHOP_ID === 'YOUR_SHOP_ID') {
    Logger.log('⚠️ Please edit setupCredentials() with your actual idealo credentials first!');
    Logger.log('');
    Logger.log('You need:');
    Logger.log('1. Shop ID — from idealo Business Center > Shop Settings');
    Logger.log('2. Client ID — from idealo Business Center > API Access');
    Logger.log('3. Client Secret — from idealo Business Center > API Access');
    Logger.log('');
    Logger.log('Or configure via Dashboard > Settings page.');
    return;
  }

  setProp_(CONFIG.PROP_SHOP_ID, SHOP_ID);
  setProp_(CONFIG.PROP_CLIENT_ID, CLIENT_ID);
  setProp_(CONFIG.PROP_CLIENT_SECRET, CLIENT_SECRET);

  Logger.log('✅ Credentials saved to Script Properties (secure storage).');
  Logger.log('⚠️ NOW DELETE the credentials from the code above!');
}


// ═══════════════════════════════════════════════════════════════
// 11. UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Format price to 2 decimal EUR (avoid floating point issues)
 */
function formatPrice_(val) {
  return Math.round(parseFloat(val) * 100) / 100;
}


// ═══════════════════════════════════════════════════════════════
// 12. DASHBOARD — HTML SERVING
// ═══════════════════════════════════════════════════════════════

function serveDashboard_() {
  var html = getRepricingDashboardHtml_();

  // Split HTML/JS for GAS template (avoids HTML validator issues with JS < operators)
  var scriptStart = html.indexOf('<script>');
  var scriptEnd   = html.lastIndexOf('</script>');

  if (scriptStart === -1 || scriptEnd === -1) {
    return HtmlService.createHtmlOutput(html)
      .setTitle('Karinex Repricing Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var beforeScript = html.substring(0, scriptStart);
  var jsCode       = html.substring(scriptStart + 8, scriptEnd);
  var afterScript  = html.substring(scriptEnd + 9);

  var templateHtml = beforeScript + '<script><?!= jsCode ?></script>' + afterScript;
  var tmpl = HtmlService.createTemplate(templateHtml);
  tmpl.jsCode = jsCode;

  return tmpl.evaluate()
    .setTitle('Karinex Repricing Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getRepricingDashboardHtml_() {
  var h = '';
  h += '<!DOCTYPE html><html lang="de"><head>';
  h += '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
  h += '<title>Karinex Repricing</title>';
  h += '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">';
  h += '<style>';

  // === CSS ===
  h += ':root{--bg:#0a0a0f;--surface:#12121a;--surface2:#1a1a2e;--surface3:#222240;';
  h += '--border:#2a2a4a;--text:#e8e8f0;--text2:#9898b0;--text3:#686880;';
  h += '--accent:#6c63ff;--accent2:#8b83ff;--green:#22c55e;--red:#ef4444;';
  h += '--orange:#f59e0b;--blue:#3b82f6;--radius:12px;--font:"Inter",sans-serif}';
  h += '*{margin:0;padding:0;box-sizing:border-box}';
  h += 'body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}';
  h += 'a{color:var(--accent);text-decoration:none}';
  h += '::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--bg)}';
  h += '::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}';

  // Layout
  h += '.app{display:flex;min-height:100vh}';
  h += '.sidebar{width:240px;background:var(--surface);border-right:1px solid var(--border);padding:20px 0;position:fixed;height:100vh;overflow-y:auto;z-index:100}';
  h += '.sidebar-logo{padding:0 20px 24px;font-size:18px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:10px}';
  h += '.sidebar-logo svg{width:28px;height:28px}';
  h += '.nav-item{display:flex;align-items:center;gap:12px;padding:10px 20px;color:var(--text2);font-size:14px;cursor:pointer;transition:all .2s;border-left:3px solid transparent}';
  h += '.nav-item:hover{background:var(--surface2);color:var(--text)}';
  h += '.nav-item.active{background:var(--surface2);color:var(--accent);border-left-color:var(--accent);font-weight:500}';
  h += '.nav-section{padding:16px 20px 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text3)}';
  h += '.main{flex:1;margin-left:240px;padding:24px 32px}';

  // Header
  h += '.page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}';
  h += '.page-title{font-size:24px;font-weight:700}';
  h += '.page-subtitle{color:var(--text2);font-size:13px;margin-top:4px}';
  h += '.header-actions{display:flex;gap:10px}';

  // Cards
  h += '.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}';
  h += '.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px}';
  h += '.stat-label{font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}';
  h += '.stat-value{font-size:28px;font-weight:700}';
  h += '.stat-value.green{color:var(--green)}.stat-value.red{color:var(--red)}.stat-value.blue{color:var(--blue)}.stat-value.orange{color:var(--orange)}';
  h += '.stat-sub{font-size:12px;color:var(--text3);margin-top:4px}';

  // Panel
  h += '.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:24px;overflow:hidden}';
  h += '.panel-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)}';
  h += '.panel-title{font-size:15px;font-weight:600}';
  h += '.panel-body{padding:20px}';

  // Table
  h += 'table{width:100%;border-collapse:collapse}';
  h += 'th{text-align:left;padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);border-bottom:1px solid var(--border);background:var(--surface2)}';
  h += 'td{padding:10px 14px;font-size:13px;border-bottom:1px solid var(--border);vertical-align:middle}';
  h += 'tr:last-child td{border-bottom:none}';
  h += 'tr:hover td{background:var(--surface2)}';

  // Buttons
  h += '.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s;font-family:var(--font)}';
  h += '.btn-primary{background:var(--accent);color:#fff}.btn-primary:hover{background:var(--accent2)}';
  h += '.btn-success{background:var(--green);color:#fff}.btn-success:hover{opacity:.9}';
  h += '.btn-danger{background:var(--red);color:#fff}.btn-danger:hover{opacity:.9}';
  h += '.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}.btn-outline:hover{border-color:var(--accent);color:var(--accent)}';
  h += '.btn-sm{padding:5px 10px;font-size:12px}';
  h += '.btn-icon{width:32px;height:32px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:var(--surface2);border:1px solid var(--border);color:var(--text);cursor:pointer}.btn-icon:hover{border-color:var(--accent);color:var(--accent)}';

  // Badge
  h += '.badge{display:inline-flex;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600}';
  h += '.badge-green{background:#22c55e20;color:var(--green)}';
  h += '.badge-red{background:#ef444420;color:var(--red)}';
  h += '.badge-orange{background:#f59e0b20;color:var(--orange)}';
  h += '.badge-blue{background:#3b82f620;color:var(--blue)}';
  h += '.badge-gray{background:#68688020;color:var(--text3)}';

  // Toggle
  h += '.toggle{position:relative;width:44px;height:24px;cursor:pointer}';
  h += '.toggle input{opacity:0;width:0;height:0}';
  h += '.toggle-slider{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--surface3);border-radius:24px;transition:.3s;border:1px solid var(--border)}';
  h += '.toggle-slider:before{content:"";position:absolute;width:18px;height:18px;left:2px;bottom:2px;background:#fff;border-radius:50%;transition:.3s}';
  h += '.toggle input:checked+.toggle-slider{background:var(--green);border-color:var(--green)}';
  h += '.toggle input:checked+.toggle-slider:before{transform:translateX(20px)}';

  // Form
  h += '.form-group{margin-bottom:16px}';
  h += '.form-label{display:block;font-size:12px;font-weight:500;color:var(--text2);margin-bottom:6px}';
  h += '.form-input{width:100%;padding:9px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;font-family:var(--font)}';
  h += '.form-input:focus{outline:none;border-color:var(--accent)}';
  h += 'select.form-input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\' fill=\'%239898b0\'%3E%3Cpath d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}';

  // Modal
  h += '.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:1000;display:none;align-items:center;justify-content:center}';
  h += '.modal-overlay.open{display:flex}';
  h += '.modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);width:90%;max-width:560px;max-height:85vh;overflow-y:auto}';
  h += '.modal-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)}';
  h += '.modal-title{font-size:16px;font-weight:600}';
  h += '.modal-close{cursor:pointer;color:var(--text3);font-size:20px;background:none;border:none}';
  h += '.modal-body{padding:20px}';
  h += '.modal-footer{display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid var(--border)}';

  // Toast
  h += '.toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:500;z-index:2000;animation:slideIn .3s ease}';
  h += '.toast-success{background:var(--green);color:#fff}';
  h += '.toast-error{background:var(--red);color:#fff}';
  h += '.toast-info{background:var(--blue);color:#fff}';
  h += '@keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:none;opacity:1}}';

  // System indicator
  h += '.system-status{display:flex;align-items:center;gap:8px;padding:12px 20px;margin:0 16px 16px;border-radius:8px;font-size:13px;font-weight:500}';
  h += '.system-status.on{background:#22c55e15;border:1px solid #22c55e40;color:var(--green)}';
  h += '.system-status.off{background:#ef444415;border:1px solid #ef444440;color:var(--red)}';
  h += '.pulse{width:8px;height:8px;border-radius:50%;animation:pulse 2s infinite}';
  h += '.pulse.on{background:var(--green)}';
  h += '.pulse.off{background:var(--red)}';
  h += '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}';

  // Loading
  h += '.loading{display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text3)}';
  h += '.spinner{width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite;margin-right:10px}';
  h += '@keyframes spin{to{transform:rotate(360deg)}}';

  // Page sections
  h += '.page{display:none}.page.active{display:block}';

  // Search
  h += '.search-bar{display:flex;gap:10px;margin-bottom:16px}';
  h += '.search-input{flex:1;padding:9px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;font-family:var(--font)}';
  h += '.search-input:focus{outline:none;border-color:var(--accent)}';

  // Responsive
  h += '@media(max-width:768px){.sidebar{width:60px;padding:12px 0}';
  h += '.sidebar-logo span,.nav-item span,.nav-section,.system-status span{display:none}';
  h += '.nav-item{justify-content:center;padding:12px}.main{margin-left:60px;padding:16px}';
  h += '.stats-grid{grid-template-columns:repeat(2,1fr)}}';

  h += '</style></head><body>';

  // === SIDEBAR ===
  h += '<div class="app">';
  h += '<aside class="sidebar">';
  h += '<div class="sidebar-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><span>Repricing</span></div>';

  h += '<div id="systemIndicator" class="system-status off"><div class="pulse off"></div><span>System Offline</span></div>';

  h += '<div class="nav-section">Main</div>';
  h += '<div class="nav-item active" onclick="go(\'dashboard\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><span>Dashboard</span></div>';
  h += '<div class="nav-item" onclick="go(\'products\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg><span>Products</span></div>';

  h += '<div class="nav-section">Monitoring</div>';
  h += '<div class="nav-item" onclick="go(\'logs\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span>Price Log</span></div>';
  h += '<div class="nav-item" onclick="go(\'errors\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Errors</span></div>';

  h += '<div class="nav-section">System</div>';
  h += '<div class="nav-item" onclick="go(\'settings\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg><span>Settings</span></div>';

  h += '</aside>';

  // === MAIN CONTENT ===
  h += '<main class="main">';

  // ── Dashboard Page ──
  h += '<div id="page-dashboard" class="page active">';
  h += '<div class="page-header"><div><h1 class="page-title">Dashboard</h1><p class="page-subtitle">Repricing overview & quick actions</p></div>';
  h += '<div class="header-actions">';
  h += '<button class="btn btn-outline" onclick="refreshData()">↻ Refresh</button>';
  h += '<button class="btn btn-primary" onclick="runRepricing()" id="btnRun">▶ Run Now</button>';
  h += '<button class="btn btn-success" id="btnToggle" onclick="toggleSystem()">⏻ Start</button>';
  h += '</div></div>';

  h += '<div id="statsGrid" class="stats-grid"></div>';

  h += '<div class="panel"><div class="panel-header"><span class="panel-title">Recent Price Changes</span></div>';
  h += '<div class="panel-body" style="padding:0"><div id="recentLogsTable" class="loading"><div class="spinner"></div>Loading...</div></div></div>';
  h += '</div>';

  // ── Products Page ──
  h += '<div id="page-products" class="page">';
  h += '<div class="page-header"><div><h1 class="page-title">Products</h1><p class="page-subtitle">Manage repricing rules per product</p></div>';
  h += '<div class="header-actions">';
  h += '<button class="btn btn-outline" onclick="bulkToggle(true)">Activate All</button>';
  h += '<button class="btn btn-outline" onclick="bulkToggle(false)">Deactivate All</button>';
  h += '<button class="btn btn-primary" onclick="openAddProduct()">+ Add Product</button>';
  h += '</div></div>';

  h += '<div class="search-bar"><input class="search-input" id="productSearch" placeholder="Search SKU, title, category..." oninput="filterProducts()"></div>';
  h += '<div class="panel"><div class="panel-body" style="padding:0"><div id="productsTable" class="loading"><div class="spinner"></div>Loading...</div></div></div>';
  h += '</div>';

  // ── Logs Page ──
  h += '<div id="page-logs" class="page">';
  h += '<div class="page-header"><div><h1 class="page-title">Price Log</h1><p class="page-subtitle">Complete history of all price changes</p></div>';
  h += '<div class="header-actions"><button class="btn btn-outline btn-danger" onclick="clearLogs(\'logs\')">Clear Logs</button></div></div>';
  h += '<div class="panel"><div class="panel-body" style="padding:0"><div id="allLogsTable" class="loading"><div class="spinner"></div>Loading...</div></div></div>';
  h += '</div>';

  // ── Errors Page ──
  h += '<div id="page-errors" class="page">';
  h += '<div class="page-header"><div><h1 class="page-title">Error Log</h1><p class="page-subtitle">System errors & failures</p></div>';
  h += '<div class="header-actions"><button class="btn btn-outline btn-danger" onclick="clearLogs(\'errors\')">Clear Errors</button></div></div>';
  h += '<div class="panel"><div class="panel-body" style="padding:0"><div id="errorsTable" class="loading"><div class="spinner"></div>Loading...</div></div></div>';
  h += '</div>';

  // ── Settings Page ──
  h += '<div id="page-settings" class="page">';
  h += '<div class="page-header"><div><h1 class="page-title">Settings</h1><p class="page-subtitle">API credentials & system configuration</p></div></div>';

  h += '<div class="panel"><div class="panel-header"><span class="panel-title">idealo API Credentials</span></div><div class="panel-body">';
  h += '<div class="form-group"><label class="form-label">Shop ID</label><input class="form-input" id="setShopId" placeholder="Your idealo Shop ID"></div>';
  h += '<div class="form-group"><label class="form-label">Client ID</label><input class="form-input" id="setClientId" placeholder="OAuth Client ID"></div>';
  h += '<div class="form-group"><label class="form-label">Client Secret</label><input type="password" class="form-input" id="setClientSecret" placeholder="OAuth Client Secret"></div>';
  h += '<div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="saveApiSettings()">Save Credentials</button>';
  h += '<button class="btn btn-outline" onclick="testConnection()">Test Connection</button></div>';
  h += '<div id="connResult" style="margin-top:10px;font-size:13px"></div>';
  h += '</div></div>';

  h += '<div class="panel"><div class="panel-header"><span class="panel-title">Repricing Settings</span></div><div class="panel-body">';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  h += '<div class="form-group"><label class="form-label">Default Undercut (€)</label><input class="form-input" id="setUndercut" type="number" step="0.01" value="0.01"></div>';
  h += '<div class="form-group"><label class="form-label">Check Interval (minutes)</label><select class="form-input" id="setInterval"><option value="5">5</option><option value="10">10</option><option value="15" selected>15</option><option value="30">30</option><option value="60">60</option></select></div>';
  h += '<div class="form-group"><label class="form-label">Max Products per Run</label><input class="form-input" id="setMaxProducts" type="number" value="200"></div>';
  h += '<div class="form-group"><label class="form-label">Shop Display Name</label><input class="form-input" id="setShopName" placeholder="karinex" value="karinex"></div>';
  h += '</div>';
  h += '<div class="form-group" style="margin-top:4px"><label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);cursor:pointer"><input type="checkbox" id="setDryRun"> Dry Run Mode (calculate but don\'t update prices)</label></div>';
  h += '<button class="btn btn-primary" onclick="saveRepricingSettings()" style="margin-top:8px">Save Settings</button>';
  h += '</div></div>';

  h += '<div class="panel"><div class="panel-header"><span class="panel-title">Notifications</span></div><div class="panel-body">';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  h += '<div class="form-group"><label class="form-label">Email Alerts</label><input class="form-input" id="setEmail" type="email" placeholder="alerts@example.com"></div>';
  h += '<div class="form-group"><label class="form-label">Telegram Bot Token</label><input class="form-input" id="setTgToken" placeholder="123456:ABC-DEF..."></div>';
  h += '<div class="form-group"><label class="form-label">Telegram Chat ID</label><input class="form-input" id="setTgChat" placeholder="-100123456789"></div>';
  h += '</div>';
  h += '<button class="btn btn-primary" onclick="saveNotificationSettings()">Save Notifications</button>';
  h += '</div></div>';

  h += '</div>'; // end settings page

  // ── MODALS ──
  // Add/Edit Product Modal
  h += '<div class="modal-overlay" id="productModal">';
  h += '<div class="modal"><div class="modal-header"><h3 class="modal-title" id="productModalTitle">Add Product</h3><button class="modal-close" onclick="closeModal(\'productModal\')">&times;</button></div>';
  h += '<div class="modal-body">';
  h += '<input type="hidden" id="editRow">';
  h += '<div class="form-group"><label class="form-label">SKU *</label><input class="form-input" id="fSku" placeholder="Product SKU"></div>';
  h += '<div class="form-group"><label class="form-label">Title *</label><input class="form-input" id="fTitle" placeholder="Product title"></div>';
  h += '<div class="form-group"><label class="form-label">Category</label><input class="form-input" id="fCategory" placeholder="e.g. Software, Watches"></div>';
  h += '<div class="form-group"><label class="form-label">idealo Product URL *</label><input class="form-input" id="fIdealoUrl" placeholder="https://www.idealo.de/preisvergleich/..."></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  h += '<div class="form-group"><label class="form-label">Current Price (€)</label><input class="form-input" id="fCurrentPrice" type="number" step="0.01"></div>';
  h += '<div class="form-group"><label class="form-label">Minimum Price (€) *</label><input class="form-input" id="fMinPrice" type="number" step="0.01"></div>';
  h += '<div class="form-group"><label class="form-label">Maximum Price (€)</label><input class="form-input" id="fMaxPrice" type="number" step="0.01"></div>';
  h += '<div class="form-group"><label class="form-label">Undercut (€)</label><input class="form-input" id="fUndercut" type="number" step="0.01" value="0.01"></div>';
  h += '</div>';
  h += '<div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="fNotes" placeholder="Optional notes"></div>';
  h += '</div>';
  h += '<div class="modal-footer"><button class="btn btn-outline" onclick="closeModal(\'productModal\')">Cancel</button><button class="btn btn-primary" onclick="saveProduct()">Save</button></div>';
  h += '</div></div>';

  h += '</main></div>';

  // === JAVASCRIPT ===
  h += '<script>';
  h += 'var API_URL=window.location.href.split("?")[0];';
  h += 'var API_KEY=new URLSearchParams(window.location.search).get("key")||"";';
  h += 'var D={};'; // dashboard data cache

  // API helper
  h += 'function api(action,data){';
  h += 'return fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain"},';
  h += 'body:JSON.stringify({key:API_KEY,action:action,data:data||{}})';
  h += '}).then(function(r){return r.json()})';
  h += '.catch(function(e){toast("API Error: "+e.message,"error");return{ok:false}});';
  h += '}';

  // Navigation
  h += 'function go(page){';
  h += 'var pages=document.querySelectorAll(".page");';
  h += 'for(var i=0;i<pages.length;i++)pages[i].classList.remove("active");';
  h += 'document.getElementById("page-"+page).classList.add("active");';
  h += 'var navs=document.querySelectorAll(".nav-item");';
  h += 'for(var j=0;j<navs.length;j++)navs[j].classList.remove("active");';
  h += 'event.currentTarget.classList.add("active");';
  h += 'if(page==="logs")loadLogs();';
  h += 'if(page==="errors")loadErrors();';
  h += 'if(page==="settings")loadSettings();';
  h += '}';

  // Toast
  h += 'function toast(msg,type){';
  h += 'var t=document.createElement("div");t.className="toast toast-"+(type||"info");t.textContent=msg;';
  h += 'document.body.appendChild(t);setTimeout(function(){t.remove()},4000);';
  h += '}';

  // Modal
  h += 'function openModal(id){document.getElementById(id).classList.add("open")}';
  h += 'function closeModal(id){document.getElementById(id).classList.remove("open")}';

  // Load dashboard data
  h += 'function refreshData(){';
  h += 'api("getDashboardData").then(function(r){';
  h += 'if(!r.ok){toast("Failed to load data","error");return}';
  h += 'D=r;renderDashboard();renderProducts();';
  h += '});';
  h += '}';

  // Render dashboard
  h += 'function renderDashboard(){';
  h += 'var si=document.getElementById("systemIndicator");';
  h += 'var bt=document.getElementById("btnToggle");';
  h += 'if(D.systemActive){';
  h += 'si.className="system-status on";si.innerHTML=\'<div class="pulse on"></div><span>System Active</span>\';';
  h += 'bt.textContent="⏻ Stop";bt.className="btn btn-danger";';
  h += '}else{';
  h += 'si.className="system-status off";si.innerHTML=\'<div class="pulse off"></div><span>System Offline</span>\';';
  h += 'bt.textContent="⏻ Start";bt.className="btn btn-success";';
  h += '}';

  // Stats cards
  h += 'var sg=document.getElementById("statsGrid");';
  h += 'sg.innerHTML=\'<div class="stat-card"><div class="stat-label">Total Products</div><div class="stat-value blue">\'+D.totalProducts+\'</div></div>\'+';
  h += '\'<div class="stat-card"><div class="stat-label">Active Repricing</div><div class="stat-value green">\'+D.activeProducts+\'</div></div>\'+';
  h += '\'<div class="stat-card"><div class="stat-label">Updated Today</div><div class="stat-value orange">\'+D.todayUpdated+\'</div></div>\'+';
  h += '\'<div class="stat-card"><div class="stat-label">Failed Today</div><div class="stat-value red">\'+D.todayFailed+\'</div></div>\';';

  // Recent logs table
  h += 'var logs=D.recentLogs||[];';
  h += 'var lt=document.getElementById("recentLogsTable");';
  h += 'if(logs.length===0){lt.innerHTML="<p style=\\"padding:20px;color:var(--text3)\\">No recent price changes</p>";return}';
  h += 'var html="<table><thead><tr><th>Time</th><th>SKU</th><th>Old</th><th>New</th><th>Competitor</th><th>Status</th></tr></thead><tbody>";';
  h += 'for(var i=0;i<logs.length;i++){var l=logs[i];';
  h += 'var sc=l.status==="Success"?"badge-green":l.status==="Failed"?"badge-red":"badge-orange";';
  h += 'html+="<tr><td>"+fmtTime(l.timestamp)+"</td><td>"+esc(l.sku)+"</td>";';
  h += 'html+="<td>€"+fmtP(l.oldPrice)+"</td><td>€"+fmtP(l.newPrice)+"</td>";';
  h += 'html+="<td>€"+fmtP(l.competitorPrice)+" <span style=\\"color:var(--text3);font-size:11px\\">"+esc(l.competitorName)+"</span></td>";';
  h += 'html+="<td><span class=\\"badge "+sc+"\\">"+esc(l.status)+"</span></td></tr>";}';
  h += 'html+="</tbody></table>";lt.innerHTML=html;';
  h += '}';

  // Render products table
  h += 'function renderProducts(){';
  h += 'var prods=D.products||[];';
  h += 'var pt=document.getElementById("productsTable");';
  h += 'if(prods.length===0){pt.innerHTML="<p style=\\"padding:20px;color:var(--text3)\\">No products added yet. Click + Add Product.</p>";return}';
  h += 'var html="<table><thead><tr><th>Active</th><th>SKU</th><th>Title</th><th>Price</th><th>Min</th><th>Max</th><th>Competitor</th><th>Status</th><th>Actions</th></tr></thead><tbody>";';
  h += 'for(var i=0;i<prods.length;i++){var p=prods[i];';
  h += 'var status=p.lastStatus||"-";var sc="badge-gray";';
  h += 'if(status.indexOf("Updated")>-1)sc="badge-green";';
  h += 'else if(status.indexOf("Failed")>-1||status.indexOf("Error")>-1)sc="badge-red";';
  h += 'else if(status.indexOf("cheapest")>-1||status.indexOf("Unchanged")>-1)sc="badge-blue";';

  h += 'html+="<tr data-sku=\\""+esc(p.sku)+"\\" data-title=\\""+esc(p.title)+"\\" data-cat=\\""+esc(p.category)+"\\">";';
  h += 'html+="<td><label class=\\"toggle\\"><input type=\\"checkbox\\" "+(p.active?"checked":"")+" onchange=\\"toggleProd("+p.row+",this.checked)\\"><span class=\\"toggle-slider\\"></span></label></td>";';
  h += 'html+="<td style=\\"font-family:monospace\\">"+esc(p.sku)+"</td>";';
  h += 'html+="<td>"+esc((p.title||"").substring(0,40))+"</td>";';
  h += 'html+="<td style=\\"font-weight:600\\">€"+fmtP(p.currentPrice)+"</td>";';
  h += 'html+="<td>€"+fmtP(p.minPrice)+"</td>";';
  h += 'html+="<td>"+(p.maxPrice?"€"+fmtP(p.maxPrice):"-")+"</td>";';
  h += 'html+="<td>"+(p.lastCompetitorPrice?"€"+fmtP(p.lastCompetitorPrice)+"<br><span style=\\"font-size:11px;color:var(--text3)\\">"+esc(p.lastCompetitorName||"")+"</span>":"-")+"</td>";';
  h += 'html+="<td><span class=\\"badge "+sc+"\\">"+esc(status)+"</span></td>";';
  h += 'html+="<td style=\\"white-space:nowrap\\"><button class=\\"btn-icon\\" onclick=\\"editProduct("+i+")\\" title=\\"Edit\\">✎</button> ";';
  h += 'html+="<button class=\\"btn-icon\\" onclick=\\"repriceSingle(\'"+esc(p.sku)+"\')\\" title=\\"Reprice now\\">▶</button> ";';
  h += 'html+="<button class=\\"btn-icon\\" onclick=\\"deleteProduct("+p.row+")\\" title=\\"Delete\\" style=\\"color:var(--red)\\">✕</button></td>";';
  h += 'html+="</tr>";}';
  h += 'html+="</tbody></table>";pt.innerHTML=html;';
  h += '}';

  // Product CRUD
  h += 'function openAddProduct(){';
  h += 'document.getElementById("productModalTitle").textContent="Add Product";';
  h += 'document.getElementById("editRow").value="";';
  h += '["fSku","fTitle","fCategory","fIdealoUrl","fCurrentPrice","fMinPrice","fMaxPrice","fNotes"].forEach(function(id){document.getElementById(id).value=""});';
  h += 'document.getElementById("fUndercut").value="0.01";';
  h += 'openModal("productModal");';
  h += '}';

  h += 'function editProduct(idx){';
  h += 'var p=D.products[idx];if(!p)return;';
  h += 'document.getElementById("productModalTitle").textContent="Edit: "+p.sku;';
  h += 'document.getElementById("editRow").value=p.row;';
  h += 'document.getElementById("fSku").value=p.sku||"";';
  h += 'document.getElementById("fTitle").value=p.title||"";';
  h += 'document.getElementById("fCategory").value=p.category||"";';
  h += 'document.getElementById("fIdealoUrl").value=p.idealoUrl||"";';
  h += 'document.getElementById("fCurrentPrice").value=p.currentPrice||"";';
  h += 'document.getElementById("fMinPrice").value=p.minPrice||"";';
  h += 'document.getElementById("fMaxPrice").value=p.maxPrice||"";';
  h += 'document.getElementById("fUndercut").value=p.undercut||0.01;';
  h += 'document.getElementById("fNotes").value=p.notes||"";';
  h += 'openModal("productModal");';
  h += '}';

  h += 'function saveProduct(){';
  h += 'var row=document.getElementById("editRow").value;';
  h += 'var d={sku:document.getElementById("fSku").value.trim(),title:document.getElementById("fTitle").value.trim(),';
  h += 'category:document.getElementById("fCategory").value.trim(),idealoUrl:document.getElementById("fIdealoUrl").value.trim(),';
  h += 'currentPrice:parseFloat(document.getElementById("fCurrentPrice").value)||0,';
  h += 'minPrice:parseFloat(document.getElementById("fMinPrice").value)||0,';
  h += 'maxPrice:parseFloat(document.getElementById("fMaxPrice").value)||0,';
  h += 'undercut:parseFloat(document.getElementById("fUndercut").value)||0.01,';
  h += 'notes:document.getElementById("fNotes").value.trim()};';
  h += 'if(!d.sku||!d.title){toast("SKU and Title are required","error");return}';
  h += 'var action=row?"updateProduct":"addProduct";';
  h += 'if(row)d.row=parseInt(row);';
  h += 'api(action,d).then(function(r){';
  h += 'if(r.ok){toast(r.message,"success");closeModal("productModal");refreshData()}';
  h += 'else toast(r.error||"Failed","error")});';
  h += '}';

  h += 'function deleteProduct(row){if(!confirm("Delete this product?"))return;';
  h += 'api("deleteProduct",{row:row}).then(function(r){';
  h += 'if(r.ok){toast("Deleted","success");refreshData()}else toast(r.error,"error")});';
  h += '}';

  h += 'function toggleProd(row,active){';
  h += 'api("toggleProduct",{row:row,active:active}).then(function(r){';
  h += 'if(r.ok)toast(r.message,"success");else toast(r.error,"error")});';
  h += '}';

  h += 'function bulkToggle(active){';
  h += 'if(!confirm((active?"Activate":"Deactivate")+" ALL products?"))return;';
  h += 'api("bulkToggle",{active:active,filter:"all"}).then(function(r){';
  h += 'if(r.ok){toast(r.message,"success");refreshData()}else toast(r.error,"error")});';
  h += '}';

  // Repricing actions
  h += 'function runRepricing(){';
  h += 'var btn=document.getElementById("btnRun");btn.textContent="Running...";btn.disabled=true;';
  h += 'api("runRepricing").then(function(r){';
  h += 'btn.textContent="▶ Run Now";btn.disabled=false;';
  h += 'if(r.ok&&r.stats){toast("Done: "+r.stats.updated+" updated, "+r.stats.errors+" errors","success");refreshData()}';
  h += 'else toast(r.error||r.message||"Done","info")});';
  h += '}';

  h += 'function repriceSingle(sku){';
  h += 'toast("Repricing "+sku+"...","info");';
  h += 'api("repriceSingle",{sku:sku}).then(function(r){';
  h += 'if(r.ok)toast("Done","success");else toast(r.error||"Failed","error");refreshData()});';
  h += '}';

  h += 'function toggleSystem(){';
  h += 'var active=!D.systemActive;';
  h += 'api("toggleSystem",{active:active}).then(function(r){';
  h += 'if(r.ok){D.systemActive=active;renderDashboard();toast("System "+(active?"activated":"deactivated"),"success")}';
  h += 'else toast(r.error,"error")});';
  h += '}';

  // Logs & Errors
  h += 'function loadLogs(){';
  h += 'document.getElementById("allLogsTable").innerHTML=\'<div class="loading"><div class="spinner"></div>Loading...</div>\';';
  h += 'api("getLogs",{limit:200}).then(function(r){';
  h += 'if(!r.ok||!r.logs||r.logs.length===0){document.getElementById("allLogsTable").innerHTML="<p style=\\"padding:20px;color:var(--text3)\\">No logs yet</p>";return}';
  h += 'var html="<table><thead><tr><th>Time</th><th>SKU</th><th>Title</th><th>Old</th><th>New</th><th>Competitor</th><th>Reason</th><th>Status</th></tr></thead><tbody>";';
  h += 'for(var i=0;i<r.logs.length;i++){var l=r.logs[i];';
  h += 'var sc=l.status==="Success"?"badge-green":l.status==="Failed"?"badge-red":"badge-orange";';
  h += 'html+="<tr><td>"+fmtTime(l.timestamp)+"</td><td>"+esc(l.sku)+"</td><td>"+esc((l.title||"").substring(0,30))+"</td>";';
  h += 'html+="<td>€"+fmtP(l.oldPrice)+"</td><td>€"+fmtP(l.newPrice)+"</td>";';
  h += 'html+="<td>€"+fmtP(l.competitorPrice)+"</td><td>"+esc(l.reason)+"</td>";';
  h += 'html+="<td><span class=\\"badge "+sc+"\\">"+esc(l.status)+"</span></td></tr>";}';
  h += 'html+="</tbody></table>";document.getElementById("allLogsTable").innerHTML=html;});';
  h += '}';

  h += 'function loadErrors(){';
  h += 'document.getElementById("errorsTable").innerHTML=\'<div class="loading"><div class="spinner"></div>Loading...</div>\';';
  h += 'api("getErrors",{limit:100}).then(function(r){';
  h += 'if(!r.ok||!r.errors||r.errors.length===0){document.getElementById("errorsTable").innerHTML="<p style=\\"padding:20px;color:var(--text3)\\">No errors</p>";return}';
  h += 'var html="<table><thead><tr><th>Time</th><th>Function</th><th>Error</th><th>Details</th></tr></thead><tbody>";';
  h += 'for(var i=0;i<r.errors.length;i++){var e=r.errors[i];';
  h += 'html+="<tr><td>"+fmtTime(e.timestamp)+"</td><td>"+esc(e.func)+"</td>";';
  h += 'html+="<td style=\\"color:var(--red)\\">"+esc(e.error)+"</td><td style=\\"font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis\\">"+esc((e.details||"").substring(0,100))+"</td></tr>";}';
  h += 'html+="</tbody></table>";document.getElementById("errorsTable").innerHTML=html;});';
  h += '}';

  // Settings
  h += 'function loadSettings(){';
  h += 'api("getSettings").then(function(r){';
  h += 'if(!r.ok)return;var s=r.settings;';
  h += 'if(s.default_undercut)document.getElementById("setUndercut").value=s.default_undercut.value;';
  h += 'if(s.check_interval_minutes)document.getElementById("setInterval").value=s.check_interval_minutes.value;';
  h += 'if(s.max_products_per_run)document.getElementById("setMaxProducts").value=s.max_products_per_run.value;';
  h += 'if(s.shop_display_name)document.getElementById("setShopName").value=s.shop_display_name.value;';
  h += 'if(s.dry_run)document.getElementById("setDryRun").checked=s.dry_run.value==="true";';
  h += 'if(s.email_alerts)document.getElementById("setEmail").value=s.email_alerts.value;';
  h += 'if(s.telegram_token)document.getElementById("setTgToken").value=s.telegram_token.value;';
  h += 'if(s.telegram_chat_id)document.getElementById("setTgChat").value=s.telegram_chat_id.value;';
  h += 'document.getElementById("setShopId").placeholder=s._shopId||"Not set";';
  h += 'document.getElementById("setClientId").placeholder=s._clientId||"Not set";';
  h += 'document.getElementById("setClientSecret").placeholder=s._clientSecret||"Not set";';
  h += '});';
  h += '}';

  h += 'function saveApiSettings(){';
  h += 'var d={};';
  h += 'var v=document.getElementById("setShopId").value.trim();if(v)d.shopId=v;';
  h += 'v=document.getElementById("setClientId").value.trim();if(v)d.clientId=v;';
  h += 'v=document.getElementById("setClientSecret").value.trim();if(v)d.clientSecret=v;';
  h += 'api("saveSettings",d).then(function(r){';
  h += 'if(r.ok)toast("API credentials saved","success");else toast(r.error,"error")});';
  h += '}';

  h += 'function saveRepricingSettings(){';
  h += 'api("saveSettings",{sheetSettings:{';
  h += 'default_undercut:document.getElementById("setUndercut").value,';
  h += 'check_interval_minutes:document.getElementById("setInterval").value,';
  h += 'max_products_per_run:document.getElementById("setMaxProducts").value,';
  h += 'shop_display_name:document.getElementById("setShopName").value,';
  h += 'dry_run:document.getElementById("setDryRun").checked?"true":"false"';
  h += '}}).then(function(r){if(r.ok)toast("Settings saved","success");else toast(r.error,"error")});';
  h += '}';

  h += 'function saveNotificationSettings(){';
  h += 'api("saveSettings",{sheetSettings:{';
  h += 'email_alerts:document.getElementById("setEmail").value.trim(),';
  h += 'telegram_token:document.getElementById("setTgToken").value.trim(),';
  h += 'telegram_chat_id:document.getElementById("setTgChat").value.trim()';
  h += '}}).then(function(r){if(r.ok)toast("Notification settings saved","success");else toast(r.error,"error")});';
  h += '}';

  h += 'function testConnection(){';
  h += 'document.getElementById("connResult").innerHTML="Testing...";';
  h += 'api("testConnection").then(function(r){';
  h += 'if(r.ok)document.getElementById("connResult").innerHTML=\'<span style="color:var(--green)">✓ \'+r.message+\' (Shop: \'+r.shopId+\')</span>\';';
  h += 'else document.getElementById("connResult").innerHTML=\'<span style="color:var(--red)">✕ \'+r.error+\'</span>\';');
  h += '});';
  h += '}';

  h += 'function clearLogs(type){if(!confirm("Clear "+type+"?"))return;';
  h += 'api("clearLogs",{type:type}).then(function(r){';
  h += 'if(r.ok){toast("Cleared","success");if(type==="logs")loadLogs();else loadErrors()}';
  h += 'else toast(r.error,"error")});';
  h += '}';

  // Product search
  h += 'function filterProducts(){';
  h += 'var q=document.getElementById("productSearch").value.toLowerCase();';
  h += 'var rows=document.querySelectorAll("#productsTable tbody tr");';
  h += 'for(var i=0;i<rows.length;i++){';
  h += 'var txt=(rows[i].getAttribute("data-sku")||"")+" "+(rows[i].getAttribute("data-title")||"")+" "+(rows[i].getAttribute("data-cat")||"");';
  h += 'rows[i].style.display=txt.toLowerCase().indexOf(q)>-1?"":"none";';
  h += '}}';

  // Helpers
  h += 'function esc(s){if(s===null||s===undefined)return"";var d=document.createElement("div");d.textContent=String(s);return d.innerHTML}';
  h += 'function fmtP(v){var n=parseFloat(v);return isNaN(n)?"-.--":n.toFixed(2)}';
  h += 'function fmtTime(t){if(!t)return"-";try{var d=new Date(t);return d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}catch(e){return String(t)}}';

  // Init
  h += 'refreshData();';
  h += '</script>';
  h += '</body></html>';
  return h;
}
