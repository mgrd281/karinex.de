/* ================================================================
   KARINEX – Price Alert System
   Google Apps Script Web App
   
   HOW TO DEPLOY:
   1. Go to: https://script.google.com → New Project
   2. Paste this entire file → replace "Code.gs"
   3. Click "Deploy" → "New Deployment"
   4. Type: Web App
   5. Execute as: Me
   6. Who has access: Anyone
   7. Click Deploy → copy the Web App URL
   8. Paste the URL into price-alert-popup.js  APPS_SCRIPT_URL
   
   SETUP TIME TRIGGER:
   1. In the Apps Script editor, click "Triggers" (clock icon left sidebar)
   2. Click "+ Add Trigger"
   3. Function: checkPrices
   4. Event source: Time-driven
   5. Type: Hour timer → Every 1 hour
   6. Save
   ================================================================ */

// ── Configuration ─────────────────────────────────────────────────
var SHEET_NAME   = 'PriceAlerts';
var STORE_URL    = 'https://www.karinex.de';
var STORE_NAME   = 'Karinex';
var STORE_COLOR  = '#1d4739';
var LOGO_URL     = 'https://cdn.shopify.com/s/files/1/0688/3187/7423/files/karinex-logo.png';

// ── Helpers ────────────────────────────────────────────────────────
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Timestamp','Email','Handle','Title','ProductURL',
      'Image','TargetPrice','CurrentPrice','Status'
    ]);
    sheet.getRange(1,1,1,9).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function fmt(price) {
  return parseFloat(price).toFixed(2).replace('.', ',') + ' €';
}

// ── Web App Entry Point ────────────────────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var email       = (data.email || '').trim().toLowerCase();
    var handle      = data.handle || '';
    var title       = data.title  || '';
    var productUrl  = data.productUrl || (STORE_URL + '/products/' + handle);
    var image       = data.image  || '';
    var targetPrice = parseFloat(data.targetPrice) || 0;
    var currentPrice= parseFloat(data.currentPrice) || 0;

    if (!email || !email.includes('@') || !handle) {
      return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Missing fields'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = getSheet();
    var rows  = sheet.getDataRange().getValues();
    var existingRow = -1;

    /* Check for duplicate (same email + handle) */
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][1] === email && rows[i][2] === handle) {
        existingRow = i + 1; /* 1-based */
        break;
      }
    }

    if (existingRow > 0) {
      /* Update existing alert (customer changed their price) */
      sheet.getRange(existingRow, 6).setValue(targetPrice);
      sheet.getRange(existingRow, 7).setValue(currentPrice);
      sheet.getRange(existingRow, 9).setValue('active');
    } else {
      /* New alert */
      sheet.appendRow([
        new Date().toISOString(),
        email, handle, title, productUrl,
        image, targetPrice, currentPrice, 'active'
      ]);
    }

    /* Send welcome email */
    sendWelcomeEmail(email, title, productUrl, image, targetPrice, currentPrice);

    return ContentService.createTextOutput(JSON.stringify({ok:true}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Welcome Email ──────────────────────────────────────────────────
function sendWelcomeEmail(email, title, productUrl, image, targetPrice, currentPrice) {
  var subject = '🔔 Preisalarm aktiviert – ' + title;
  var unsub   = STORE_URL + '/pages/preisalarm-abmelden?email=' + encodeURIComponent(email);

  var html = buildEmailWrapper(
    'Dein Preisalarm ist aktiv! 🎉',
    '<p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6;">' +
    'Hallo,<br><br>' +
    'wir haben deinen Preisalarm für das folgende Produkt eingerichtet:</p>' +
    buildProductCard(title, image, productUrl, currentPrice) +
    '<div style="background:#f5f9f7;border-left:4px solid ' + STORE_COLOR + ';border-radius:4px;padding:14px 16px;margin:20px 0;">' +
    '  <p style="margin:0;font-size:14px;color:#333;">' +
    '    <strong>Dein Preisziel:</strong> ' + fmt(targetPrice) + '<br>' +
    '    <span style="color:#666;">Sobald der Preis auf <strong>' + fmt(targetPrice) + '</strong> oder weniger fällt, erhältst du sofort eine E-Mail von uns.</span>' +
    '  </p>' +
    '</div>' +
    '<p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 24px;">' +
    'Du kannst deinen Preisalarm jederzeit anpassen, indem du die Seite erneut besuchst und den Alarm neu einstellst.' +
    '</p>' +
    buildCTA('Produkt ansehen', productUrl) +
    '<p style="margin-top:20px;font-size:12px;color:#999;text-align:center;">' +
    'Möchtest du keine Benachrichtigungen mehr? <a href="' + unsub + '" style="color:#999;">Abmelden</a></p>',
    email
  );

  GmailApp.sendEmail(email, subject, '', {htmlBody: html, name: STORE_NAME});
}

// ── Price Drop Email ───────────────────────────────────────────────
function sendPriceDropEmail(email, title, productUrl, image, targetPrice, newPrice) {
  var subject = '🎉 Preissenkung! ' + title + ' – Jetzt ' + fmt(newPrice);
  var unsub   = STORE_URL + '/pages/preisalarm-abmelden?email=' + encodeURIComponent(email);

  var html = buildEmailWrapper(
    '🎉 Der Preis ist gefallen!',
    '<p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6;">' +
    'Gute Nachrichten! Ein Produkt aus deiner Preisalarm-Liste hat dein Preisziel erreicht:</p>' +
    buildProductCard(title, image, productUrl, newPrice) +
    '<div style="background:#f0faf4;border:1px solid #a8dbc0;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">' +
    '  <p style="margin:0 0 4px;font-size:13px;color:#666;">Dein Preisziel war: <s>' + fmt(targetPrice) + '</s></p>' +
    '  <p style="margin:0;font-size:24px;font-weight:800;color:' + STORE_COLOR + ';">' + fmt(newPrice) + '</p>' +
    '  <p style="margin:4px 0 0;font-size:12px;color:#999;">Aktueller Preis</p>' +
    '</div>' +
    buildCTA('Jetzt kaufen →', productUrl) +
    '<p style="margin-top:16px;font-size:12px;color:#999;text-align:center;">' +
    'Preisalarm abmelden: <a href="' + unsub + '" style="color:#999;">hier klicken</a></p>',
    email
  );

  GmailApp.sendEmail(email, subject, '', {htmlBody: html, name: STORE_NAME});
}

// ── Email Primitives ───────────────────────────────────────────────
function buildEmailWrapper(heading, body, email) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '</head><body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 16px;">' +
    '<table width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);" cellpadding="0" cellspacing="0">' +
    /* HEADER */
    '<tr><td style="background:' + STORE_COLOR + ';padding:24px 28px;text-align:center;">' +
    '<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">' + heading + '</h1>' +
    '</td></tr>' +
    /* BODY */
    '<tr><td style="padding:28px 28px 20px;">' + body + '</td></tr>' +
    /* FOOTER */
    '<tr><td style="background:#f8f8f8;border-top:1px solid #eee;padding:14px 28px;text-align:center;">' +
    '<p style="margin:0;font-size:12px;color:#aaa;">' + STORE_NAME + ' · <a href="' + STORE_URL + '" style="color:#aaa;text-decoration:none;">' + STORE_URL.replace('https://','') + '</a></p>' +
    '<p style="margin:4px 0 0;font-size:11px;color:#ccc;">Diese E-Mail wurde an ' + email + ' gesendet.</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function buildProductCard(title, image, url, price) {
  return '<a href="' + url + '" style="display:block;text-decoration:none;border:1px solid #eee;border-radius:8px;padding:12px;margin:0 0 16px;overflow:hidden;">' +
    (image ? '<img src="' + image + '" width="64" height="64" style="float:left;object-fit:contain;border-radius:6px;margin-right:14px;" alt="' + title + '">' : '') +
    '<div style="overflow:hidden;">' +
    '<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#111;">' + title + '</p>' +
    '<p style="margin:0;font-size:13px;color:#666;">ab <strong style="color:' + STORE_COLOR + ';">' + fmt(price) + '</strong></p>' +
    '</div><div style="clear:both;"></div>' +
    '</a>';
}

function buildCTA(text, url) {
  return '<div style="text-align:center;margin:8px 0 0;">' +
    '<a href="' + url + '" style="display:inline-block;background:' + STORE_COLOR + ';color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.01em;">' + text + '</a>' +
    '</div>';
}

// ── Hourly Price Checker ───────────────────────────────────────────
function checkPrices() {
  var sheet = getSheet();
  var rows  = sheet.getDataRange().getValues();

  /* Group active alerts by handle to batch-fetch prices */
  var handleMap = {};
  for (var i = 1; i < rows.length; i++) {
    var status = rows[i][8];
    if (status !== 'active') continue;
    var handle = rows[i][2];
    if (!handleMap[handle]) handleMap[handle] = [];
    handleMap[handle].push(i); /* 0-based index of row in rows array */
  }

  Object.keys(handleMap).forEach(function(handle) {
    var currentPrice = fetchShopifyPrice(handle);
    if (currentPrice === null) return; /* couldn't fetch */

    handleMap[handle].forEach(function(rowIdx) {
      var rowNum      = rowIdx + 1; /* 1-based sheet row */
      var email       = rows[rowIdx][1];
      var title       = rows[rowIdx][3];
      var productUrl  = rows[rowIdx][4];
      var image       = rows[rowIdx][5];
      var targetPrice = parseFloat(rows[rowIdx][6]);

      if (currentPrice <= targetPrice) {
        /* 🎉 Price dropped! */
        try {
          sendPriceDropEmail(email, title, productUrl, image, targetPrice, currentPrice);
          sheet.getRange(rowNum, 9).setValue('sent');
          sheet.getRange(rowNum, 10).setValue(new Date().toISOString()); /* sent timestamp */
          Logger.log('Price drop alert sent to: ' + email + ' for ' + handle + ' at ' + currentPrice);
        } catch(mailErr) {
          Logger.log('Mail error for ' + email + ': ' + mailErr.message);
        }
      }

      /* Update current price column for tracking */
      sheet.getRange(rowNum, 8).setValue(currentPrice);
    });
  });
}

// ── Shopify Price Fetcher ──────────────────────────────────────────
function fetchShopifyPrice(handle) {
  try {
    var url      = STORE_URL + '/products/' + handle + '.js';
    var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    if (response.getResponseCode() !== 200) return null;
    var product  = JSON.parse(response.getContentText());
    /* Find lowest available variant price (in cents → convert to EUR) */
    var minPrice = Infinity;
    product.variants.forEach(function(v) {
      if (v.available && v.price < minPrice) minPrice = v.price;
    });
    if (!product.available) {
      /* Not available – use first variant price */
      minPrice = product.variants[0].price;
    }
    return minPrice / 100; /* Shopify prices are in cents */
  } catch(e) {
    Logger.log('fetchShopifyPrice error for ' + handle + ': ' + e.message);
    return null;
  }
}

// ── Test function (run manually from editor) ───────────────────────
function TEST_sendWelcomeEmail() {
  sendWelcomeEmail(
    Session.getActiveUser().getEmail(),
    'Test Produkt – Boss Chronograph',
    STORE_URL + '/products/boss-chronograph',
    '',
    279,
    379
  );
  Logger.log('Test welcome email sent!');
}

function TEST_sendPriceDropEmail() {
  sendPriceDropEmail(
    Session.getActiveUser().getEmail(),
    'Test Produkt – Boss Chronograph',
    STORE_URL + '/products/boss-chronograph',
    '',
    279,
    249
  );
  Logger.log('Test price drop email sent!');
}
