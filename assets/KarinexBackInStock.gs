/* ================================================================
   KARINEX - Back In Stock Automation
   Google Apps Script Web App + Scheduled Availability Checker

   WHAT IT DOES:
   1) On customer submit (action: subscribe):
      - sends professional confirmation email to customer
      - sends professional request email to seller
      - stores subscription in Google Sheet
   2) On stock return (checkBackInStock trigger):
      - sends professional "now available" email to customer
      - sends professional update email to seller
      - marks subscription as notified (no duplicates)

   DEPLOY STEPS:
   1. Open https://script.google.com and create a new project.
   2. Paste this file in Code.gs.
   3. Set SHOPIFY_SHOP_DOMAIN + SHOPIFY_STOREFRONT_ACCESS_TOKEN below.
   4. Deploy -> New deployment -> Type: Web app.
   5. Execute as: Me.
   6. Who has access: Anyone.
   7. Copy Web App URL into Theme setting "Back in stock Web App URL".

   TRIGGER FOR AUTOMATIC AVAILABILITY EMAILS:
   1. In Apps Script -> Triggers -> Add Trigger.
   2. Function: checkBackInStock
   3. Event source: Time-driven
   4. Run every 15 or 30 minutes
   ================================================================ */

var SHEET_NAME = 'BackInStockAlerts';
var STORE_NAME = 'Karinex';
var STORE_URL = 'https://www.karinex.de';
var STORE_COLOR = '#1d4739';

/* Required for automatic stock checks */
var SHOPIFY_SHOP_DOMAIN = '45dv93-bk.myshopify.com';
var SHOPIFY_STOREFRONT_ACCESS_TOKEN = '';
var SHOPIFY_ADMIN_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('SHOPIFY_ADMIN_TOKEN') || '';
var SHOPIFY_API_VERSION = '2025-10';

/* Sheet columns */
var COL = {
  createdAt: 1,
  email: 2,
  sellerEmail: 3,
  productHandle: 4,
  productTitle: 5,
  variantTitle: 6,
  size: 7,
  productUrl: 8,
  productImage: 9,
  productVendor: 10,
  shopName: 11,
  status: 12,
  notifiedAt: 13,
  availabilityVariant: 14,
  source: 15,
  lastError: 16
};

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);
    var action = String(data.action || 'subscribe').trim().toLowerCase();

    if (action === 'subscribe') {
      return handleSubscribe_(data);
    }

    if (action === 'check_now') {
      checkBackInStock();
      return asJson_({ ok: true, action: 'check_now' });
    }

    return asJson_({ ok: false, error: 'unsupported_action' });
  } catch (err) {
    return asJson_({ ok: false, error: err.message });
  }
}

function handleSubscribe_(data) {
  var email = String(data.email || '').trim().toLowerCase();
  var sellerEmail = String(data.sellerEmail || '').trim().toLowerCase();
  var size = normalizeSize_(data.size);
  var productTitle = String(data.productTitle || 'Produkt').trim();
  var variantTitle = String(data.variantTitle || '').trim();
  var productUrl = String(data.productUrl || STORE_URL).trim();
  var productImage = String(data.productImage || '').trim();
  var productVendor = String(data.productVendor || '').trim();
  var productHandle = String(data.productHandle || '').trim();
  var variantId = String(data.variantId || '').trim();
  var shopName = String(data.shopName || STORE_NAME).trim();

  if (!isValidEmail_(email)) {
    return asJson_({ ok: false, error: 'invalid_email' });
  }
  if (!isValidEmail_(sellerEmail)) {
    return asJson_({ ok: false, error: 'invalid_seller_email' });
  }

  if (!productHandle) {
    productHandle = extractHandleFromUrl_(productUrl);
  }

  if (!productHandle) {
    return asJson_({ ok: false, error: 'missing_product_handle' });
  }

  var sheet = getSheet_();
  upsertWaitingSubscription_(sheet, {
    email: email,
    sellerEmail: sellerEmail,
    productHandle: productHandle,
    productTitle: productTitle,
    variantTitle: variantTitle,
    size: size,
    productUrl: productUrl,
    productImage: productImage,
    productVendor: productVendor,
    shopName: shopName,
    source: 'aboutyou-webapp',
    variantId: variantId
  });

  sendCustomerRequestedEmail_(email, {
    shopName: shopName,
    productTitle: productTitle,
    variantTitle: variantTitle,
    size: size,
    productUrl: productUrl,
    productImage: productImage
  });

  sendSellerRequestedEmail_(sellerEmail, email, {
    shopName: shopName,
    productHandle: productHandle,
    productTitle: productTitle,
    variantTitle: variantTitle,
    size: size,
    productUrl: productUrl,
    productImage: productImage,
    productVendor: productVendor
  });

  return asJson_({ ok: true, action: 'subscribe' });
}

function checkBackInStock() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  if (!SHOPIFY_STOREFRONT_ACCESS_TOKEN && !SHOPIFY_ADMIN_ACCESS_TOKEN) {
    Logger.log('Missing Shopify token. Set SHOPIFY_STOREFRONT_ACCESS_TOKEN or SHOPIFY_ADMIN_ACCESS_TOKEN.');
    return;
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, 16).getValues();

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var status = String(row[COL.status - 1] || '').toLowerCase();
    if (status !== 'waiting') continue;

    var email = String(row[COL.email - 1] || '').trim();
    var sellerEmail = String(row[COL.sellerEmail - 1] || '').trim();
    var productHandle = String(row[COL.productHandle - 1] || '').trim();
    var productTitle = String(row[COL.productTitle - 1] || '').trim();
    var variantTitle = String(row[COL.variantTitle - 1] || '').trim();
    var size = normalizeSize_(row[COL.size - 1]);
    var productUrl = String(row[COL.productUrl - 1] || '').trim();
    var productImage = String(row[COL.productImage - 1] || '').trim();
    var productVendor = String(row[COL.productVendor - 1] || '').trim();
    var shopName = String(row[COL.shopName - 1] || STORE_NAME).trim();

    try {
      var availability = getAvailability_(productHandle, size);
      if (!availability.available) {
        clearLastError_(sheet, i + 2);
        continue;
      }

      var liveTitle = availability.productTitle || productTitle;
      var liveUrl = availability.productUrl || productUrl;
      var liveImage = availability.productImage || productImage;
      var liveVariant = availability.variantTitle || variantTitle;

      sendCustomerAvailableEmail_(email, {
        shopName: shopName,
        productTitle: liveTitle,
        variantTitle: liveVariant,
        size: size,
        productUrl: liveUrl,
        productImage: liveImage
      });

      sendSellerAvailableEmail_(sellerEmail, email, {
        shopName: shopName,
        productHandle: productHandle,
        productTitle: liveTitle,
        variantTitle: liveVariant,
        size: size,
        productUrl: liveUrl,
        productImage: liveImage,
        productVendor: productVendor
      });

      sheet.getRange(i + 2, COL.status).setValue('notified');
      sheet.getRange(i + 2, COL.notifiedAt).setValue(new Date().toISOString());
      sheet.getRange(i + 2, COL.availabilityVariant).setValue(liveVariant || 'available');
      clearLastError_(sheet, i + 2);

      Utilities.sleep(150);
    } catch (err) {
      sheet.getRange(i + 2, COL.lastError).setValue(String(err && err.message ? err.message : err));
    }
  }
}

function getAvailability_(productHandle, requestedSize) {
  var useAdminApi = !!SHOPIFY_ADMIN_ACCESS_TOKEN && !SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  var endpoint = useAdminApi
    ? ('https://' + SHOPIFY_SHOP_DOMAIN + '/admin/api/' + SHOPIFY_API_VERSION + '/graphql.json')
    : ('https://' + SHOPIFY_SHOP_DOMAIN + '/api/' + SHOPIFY_API_VERSION + '/graphql.json');

  var query = useAdminApi
    ? [
        'query ProductByHandle($handle: String!) {',
        '  productByHandle(handle: $handle) {',
        '    title',
        '    handle',
        '    onlineStoreUrl',
        '    vendor',
        '    featuredImage { url }',
        '    variants(first: 100) {',
        '      nodes {',
        '        title',
        '        inventoryQuantity',
        '      }',
        '    }',
        '  }',
        '}'
      ].join('\n')
    : [
        'query ProductByHandle($handle: String!) {',
        '  product(handle: $handle) {',
        '    title',
        '    handle',
        '    onlineStoreUrl',
        '    vendor',
        '    featuredImage { url }',
        '    variants(first: 100) {',
        '      nodes {',
        '        title',
        '        availableForSale',
        '      }',
        '    }',
        '  }',
        '}'
      ].join('\n');

  var payload = {
    query: query,
    variables: { handle: productHandle }
  };

  var headers = useAdminApi
    ? { 'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN }
    : { 'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_ACCESS_TOKEN };

  var res = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var body = JSON.parse(res.getContentText() || '{}');

  if (code !== 200) {
    throw new Error('Storefront HTTP ' + code);
  }
  if (body.errors && body.errors.length) {
    throw new Error('Storefront GraphQL error: ' + JSON.stringify(body.errors));
  }

  var product = body && body.data ? (useAdminApi ? body.data.productByHandle : body.data.product) : null;
  if (!product) {
    return { available: false };
  }

  var variants = (product.variants && product.variants.nodes) ? product.variants.nodes : [];
  var sizeFilter = normalizeSize_(requestedSize);
  var match = null;

  if (sizeFilter && sizeFilter !== 'nicht angegeben') {
    for (var i = 0; i < variants.length; i++) {
      var v = variants[i];
      if (!variantIsAvailable_(v, useAdminApi)) continue;
      if (variantMatchesSize_(v.title, sizeFilter)) {
        match = v;
        break;
      }
    }
  } else {
    for (var j = 0; j < variants.length; j++) {
      if (variantIsAvailable_(variants[j], useAdminApi)) {
        match = variants[j];
        break;
      }
    }
  }

  return {
    available: !!match,
    variantTitle: match ? String(match.title || '') : '',
    productTitle: String(product.title || ''),
    productUrl: String(product.onlineStoreUrl || ''),
    productImage: product.featuredImage && product.featuredImage.url ? String(product.featuredImage.url) : ''
  };
}

function variantMatchesSize_(variantTitle, requestedSize) {
  var req = normalizeSize_(requestedSize);
  var vTitle = String(variantTitle || '');
  if (!req || !vTitle) return false;

  var exact = normalizeSize_(vTitle);
  if (exact === req) return true;

  var firstPart = normalizeSize_(vTitle.split('/')[0]);
  if (firstPart === req) return true;

  return exact.indexOf(req) !== -1;
}

function variantIsAvailable_(variant, useAdminApi) {
  if (!variant) return false;
  if (useAdminApi) {
    var qty = Number(variant.inventoryQuantity);
    return !isNaN(qty) && qty > 0;
  }
  return !!variant.availableForSale;
}

function upsertWaitingSubscription_(sheet, data) {
  var lastRow = sheet.getLastRow();
  var key = buildKey_(data.email, data.productHandle, data.size);

  if (lastRow >= 2) {
    var rows = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rowKey = buildKey_(row[COL.email - 1], row[COL.productHandle - 1], row[COL.size - 1]);
      var rowStatus = String(row[COL.status - 1] || '').toLowerCase();
      if (rowKey === key && rowStatus === 'waiting') {
        sheet.getRange(i + 2, COL.sellerEmail).setValue(data.sellerEmail);
        sheet.getRange(i + 2, COL.productTitle).setValue(data.productTitle);
        sheet.getRange(i + 2, COL.variantTitle).setValue(data.variantTitle);
        sheet.getRange(i + 2, COL.productUrl).setValue(data.productUrl);
        sheet.getRange(i + 2, COL.productImage).setValue(data.productImage);
        sheet.getRange(i + 2, COL.productVendor).setValue(data.productVendor);
        sheet.getRange(i + 2, COL.shopName).setValue(data.shopName);
        sheet.getRange(i + 2, COL.source).setValue(data.source);
        sheet.getRange(i + 2, COL.lastError).setValue('');
        return;
      }
    }
  }

  sheet.appendRow([
    new Date().toISOString(),
    data.email,
    data.sellerEmail,
    data.productHandle,
    data.productTitle,
    data.variantTitle,
    data.size,
    data.productUrl,
    data.productImage,
    data.productVendor,
    data.shopName,
    'waiting',
    '',
    '',
    data.source,
    ''
  ]);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'created_at',
      'email',
      'seller_email',
      'product_handle',
      'product_title',
      'variant_title',
      'size',
      'product_url',
      'product_image',
      'product_vendor',
      'shop_name',
      'status',
      'notified_at',
      'availability_variant',
      'source',
      'last_error'
    ]);
    sheet.getRange(1, 1, 1, 16).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sendCustomerRequestedEmail_(to, info) {
  var subject = 'Du wirst erinnert: ' + info.productTitle;
  var html = buildEmailWrapper_(
    info.shopName,
    'Du wirst erinnert',
    '<p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">' +
      'Danke fuer deine Anfrage. Wir informieren dich sofort per E-Mail, sobald das Produkt wieder verfuegbar ist.</p>' +
    buildProductCard_(info.productTitle, info.variantTitle, info.size, info.productUrl, info.productImage) +
    buildCta_('Produkt ansehen', info.productUrl),
    to
  );

  GmailApp.sendEmail(to, subject, '', {
    htmlBody: html,
    name: info.shopName || STORE_NAME
  });
}

function sendSellerRequestedEmail_(to, customerEmail, info) {
  var subject = 'Neue Back-in-Stock Anfrage: ' + info.productTitle;
  var html = buildEmailWrapper_(
    info.shopName,
    'Neue Verfuegbarkeits-Anfrage',
    buildSellerBadgeRow_('NEUE ANFRAGE', '#fff6e7', '#8a5a00') +
    '<p style="margin:14px 0 14px;color:#1f2937;font-size:15px;line-height:1.7;">Ein Kunde moechte benachrichtigt werden, sobald dieser Artikel wieder verfuegbar ist.</p>' +
    buildProductCard_(info.productTitle, info.variantTitle, info.size, info.productUrl, info.productImage) +
    buildSellerSummaryCard_(customerEmail, info.productVendor, info.productHandle, info.size) +
    buildCta_('Produkt im Shop oeffnen', info.productUrl),
    to
  );

  GmailApp.sendEmail(to, subject, '', {
    htmlBody: html,
    name: info.shopName || STORE_NAME,
    replyTo: customerEmail
  });
}

function sendCustomerAvailableEmail_(to, info) {
  var subject = 'Jetzt verfuegbar: ' + info.productTitle;
  var html = buildEmailWrapper_(
    info.shopName,
    'Jetzt wieder verfuegbar',
    '<p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6;">Gute Nachrichten: Dein gewuenschtes Produkt ist wieder verfuegbar.</p>' +
    buildProductCard_(info.productTitle, info.variantTitle, info.size, info.productUrl, info.productImage) +
    buildCta_('Jetzt kaufen', info.productUrl),
    to
  );

  GmailApp.sendEmail(to, subject, '', {
    htmlBody: html,
    name: info.shopName || STORE_NAME
  });
}

function sendSellerAvailableEmail_(to, customerEmail, info) {
  var subject = 'Verfuegbar: Kunde benachrichtigt fuer ' + info.productTitle;
  var html = buildEmailWrapper_(
    info.shopName,
    'Produkt wieder verfuegbar',
    buildSellerBadgeRow_('KUNDE BENACHRICHTIGT', '#eaf8ef', '#0f6b36') +
    '<p style="margin:14px 0 14px;color:#1f2937;font-size:15px;line-height:1.7;">Gute Nachricht: Das Produkt ist wieder verfuegbar und die Kundenbenachrichtigung wurde erfolgreich versendet.</p>' +
    buildProductCard_(info.productTitle, info.variantTitle, info.size, info.productUrl, info.productImage) +
    buildSellerSummaryCard_(customerEmail, info.productVendor, info.productHandle, info.size) +
    buildCta_('Produktseite oeffnen', info.productUrl),
    to
  );

  GmailApp.sendEmail(to, subject, '', {
    htmlBody: html,
    name: info.shopName || STORE_NAME,
    replyTo: customerEmail
  });
}

function buildEmailWrapper_(shopName, heading, body, toEmail) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 16px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ececec;">' +
    '<tr><td style="background:' + STORE_COLOR + ';padding:22px 24px;text-align:center;">' +
    '<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">' + escapeHtml_(heading) + '</h1>' +
    '</td></tr>' +
    '<tr><td style="padding:24px 24px 18px;">' + body + '</td></tr>' +
    '<tr><td style="border-top:1px solid #efefef;background:#fafafa;padding:14px 24px;text-align:center;">' +
    '<p style="margin:0;color:#999;font-size:12px;">' + escapeHtml_(shopName || STORE_NAME) + ' · ' + STORE_URL + '</p>' +
    '<p style="margin:4px 0 0;color:#bbb;font-size:11px;">Gesendet an ' + escapeHtml_(toEmail) + '</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function buildProductCard_(title, variantTitle, size, url, image) {
  var safeUrl = escapeAttr_(url || STORE_URL);
  var variantLine = variantTitle ? ('<p style="margin:4px 0 0;color:#666;font-size:13px;">Variante: ' + escapeHtml_(variantTitle) + '</p>') : '';

  return '<a href="' + safeUrl + '" style="display:block;text-decoration:none;border:1px solid #eee;border-radius:10px;padding:12px;overflow:hidden;">' +
    (image ? '<img src="' + escapeAttr_(image) + '" alt="' + escapeAttr_(title) + '" width="76" height="76" style="float:left;object-fit:cover;border-radius:8px;margin-right:12px;">' : '') +
    '<div style="overflow:hidden;">' +
    '<p style="margin:0;color:#111;font-size:15px;font-weight:700;line-height:1.35;">' + escapeHtml_(title) + '</p>' +
    variantLine +
    '<p style="margin:4px 0 0;color:#666;font-size:13px;">Groesse: ' + escapeHtml_(normalizeSize_(size)) + '</p>' +
    '</div><div style="clear:both;"></div></a>';
}

function buildInfoTable_(customerEmail, productVendor, productHandle, size) {
  return '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;">' +
    '<tr><td style="padding:8px 0;color:#666;font-size:13px;">Kunden-E-Mail</td><td style="padding:8px 0;color:#111;font-size:14px;font-weight:600;text-align:right;">' + escapeHtml_(customerEmail) + '</td></tr>' +
    '<tr><td style="padding:8px 0;color:#666;font-size:13px;">Marke</td><td style="padding:8px 0;color:#111;font-size:14px;font-weight:600;text-align:right;">' + escapeHtml_(productVendor || '-') + '</td></tr>' +
    '<tr><td style="padding:8px 0;color:#666;font-size:13px;">Handle</td><td style="padding:8px 0;color:#111;font-size:14px;font-weight:600;text-align:right;">' + escapeHtml_(productHandle || '-') + '</td></tr>' +
    '<tr><td style="padding:8px 0;color:#666;font-size:13px;">Groesse</td><td style="padding:8px 0;color:#111;font-size:14px;font-weight:600;text-align:right;">' + escapeHtml_(normalizeSize_(size)) + '</td></tr>' +
    '</table>';
}

function buildSellerBadgeRow_(text, bgColor, textColor) {
  return '<div style="margin:0 0 6px;">' +
    '<span style="display:inline-block;padding:6px 10px;border-radius:999px;background:' + bgColor + ';color:' + textColor + ';font-size:11px;font-weight:700;letter-spacing:.5px;">' +
    escapeHtml_(text) +
    '</span></div>';
}

function buildSellerSummaryCard_(customerEmail, productVendor, productHandle, size) {
  return '<div style="margin-top:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;padding:14px 14px 12px;">' +
    '<p style="margin:0 0 8px;color:#111827;font-size:13px;font-weight:700;">Anfrage-Details</p>' +
    buildInfoTable_(customerEmail, productVendor, productHandle, size) +
    '</div>';
}

function buildCta_(text, url) {
  var safeUrl = escapeAttr_(url || STORE_URL);
  return '<div style="text-align:center;margin-top:16px;">' +
    '<a href="' + safeUrl + '" style="display:inline-block;background:' + STORE_COLOR + ';color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;">' +
    escapeHtml_(text) +
    '</a></div>';
}

function normalizeSize_(size) {
  var s = String(size || '').trim();
  if (!s) return 'nicht angegeben';
  if (s.toLowerCase() === 'groesse waehlen') return 'nicht angegeben';
  return s;
}

function buildKey_(email, handle, size) {
  return String(email || '').trim().toLowerCase() + '|' +
    String(handle || '').trim().toLowerCase() + '|' +
    normalizeSize_(size).toLowerCase();
}

function extractHandleFromUrl_(url) {
  var m = String(url || '').match(/\/products\/([^\/?#]+)/i);
  return m && m[1] ? m[1] : '';
}

function clearLastError_(sheet, rowNum) {
  sheet.getRange(rowNum, COL.lastError).setValue('');
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function asJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml_(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr_(str) {
  return escapeHtml_(str);
}
