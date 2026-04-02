// ══════════════════════════════════════════════════
// KARINEX – Recently Sold Tracker (GraphQL Version 3)
// ══════════════════════════════════════════════════

var SHOP_DOMAIN  = '45dv93-bk.myshopify.com';
var ACCESS_TOKEN = 'YOUR_SHOPIFY_ACCESS_TOKEN'; // ← In Apps Script direkt eintragen
var HOURS_WINDOW = 720; // 30 Tage
var API_VERSION  = '2025-04';

// ── Shopify Webhook empfangen (orders/paid) ───────
function doPost(e) {
  try {
    updateRecentlySold();
    return ContentService
      .createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch(err) {
    Logger.log('Webhook Fehler: ' + err.message);
    return ContentService
      .createTextOutput('Fehler: ' + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// ── Debug: Einzelnes Produkt prüfen ───────────────
// Trage die numerische Product-ID ein und führe diese Funktion aus,
// um im Ausführungsprotokoll zu sehen, welche Bestellungen gezählt werden.
function debugSingleProduct() {
  var TARGET_PID = ''; // ← Shopify Product ID hier eintragen (z.B. '8234567890123')
  if (!TARGET_PID) {
    Logger.log('❌ Bitte TARGET_PID in debugSingleProduct() setzen!');
    return;
  }

  var since = new Date();
  since.setHours(since.getHours() - HOURS_WINDOW);
  var sinceISO = since.toISOString().split('.')[0] + "Z";
  var gqlUrl = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/graphql.json';
  var queryStr = "status:any created_at:>=" + sinceISO;

  var totalQty = 0;
  var foundOrders = [];
  var hasNextPage = true;
  var cursor = null;

  while (hasNextPage) {
    var payload = {
      query: 'query($cursor: String) { orders(first: 200, sortKey: CREATED_AT, reverse: true, after: $cursor, query: "' + queryStr + '") { pageInfo { hasNextPage endCursor } edges { node { id name createdAt billingAddress { city } shippingAddress { city } lineItems(first: 50) { edges { node { title quantity product { id } } } } } } } }',
      variables: { cursor: cursor }
    };

    var response = UrlFetchApp.fetch(gqlUrl, {
      method: 'post',
      headers: { 'X-Shopify-Access-Token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var body = JSON.parse(response.getContentText());
    if (body.errors) {
      Logger.log('❌ GraphQL Errors: ' + JSON.stringify(body.errors));
      return;
    }
    if (!body.data || !body.data.orders) { Logger.log('❌ Keine Order-Daten'); return; }

    body.data.orders.edges.forEach(function(edge) {
      var order = edge.node;
      if (order.lineItems && order.lineItems.edges) {
        order.lineItems.edges.forEach(function(li) {
          var item = li.node;
          var prodId = item.product ? item.product.id : null;
          var pidNum = prodId ? prodId.replace(/\D/g, '') : null;

          if (pidNum === TARGET_PID) {
            totalQty += item.quantity;
            var city = (order.shippingAddress && order.shippingAddress.city)
                    || (order.billingAddress && order.billingAddress.city)
                    || '—';
            foundOrders.push(order.name + ' | qty=' + item.quantity + ' | city=' + city + ' | ' + order.createdAt);
          }

          // Auch Zeilen OHNE product loggen (null = Bug-Indikator)
          if (!prodId) {
            Logger.log('⚠️ lineItem OHNE product: order=' + order.name + ' title="' + item.title + '" qty=' + item.quantity);
          }
        });
      }
    });

    var pi = body.data.orders.pageInfo;
    hasNextPage = pi.hasNextPage;
    cursor = pi.endCursor;
  }

  Logger.log('═══ Debug für Product ' + TARGET_PID + ' ═══');
  Logger.log('Gefundene Bestellungen: ' + foundOrders.length);
  Logger.log('Gesamtmenge (qty): ' + totalQty);
  foundOrders.forEach(function(line) { Logger.log('  → ' + line); });
  if (foundOrders.length === 0) {
    Logger.log('⚠️ Keine Bestellungen gefunden! Mögliche Ursachen:');
    Logger.log('   1. Falsche Product-ID (Varianten-ID ≠ Product-ID!)');
    Logger.log('   2. Produkt wurde neu erstellt → alte Bestellungen haben alte ID');
    Logger.log('   3. Bestellungen als Draft-Orders erstellt (product=null)');
  }
}

// ── Haupt-Funktion ────────────
function updateRecentlySold() {
  var since = new Date();
  since.setHours(since.getHours() - HOURS_WINDOW);
  var sinceISO = since.toISOString().split('.')[0] + "Z";
  
  var salesMap = {};  
  var cityMap = {};   
  var hasNextPage = true;
  var cursor = null;
  var queryStr = "status:any created_at:>=" + sinceISO;
  var gqlUrl = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/graphql.json';
  
  while (hasNextPage) {
    // 💡 sortKey: CREATED_AT, reverse: true (Neueste zuerst!)
    // ⚠️ clientIp entfernt – ab API 2024-04 nicht mehr verfügbar
    var payload = {
      query: 'query($cursor: String) { orders(first: 200, sortKey: CREATED_AT, reverse: true, after: $cursor, query: "' + queryStr + '") { pageInfo { hasNextPage endCursor } edges { node { billingAddress { city } shippingAddress { city } customer { defaultAddress { city } } lineItems(first: 50) { edges { node { quantity product { id } } } } } } } }',
      variables: { cursor: cursor }
    };
    
    var response = UrlFetchApp.fetch(gqlUrl, {
      method: 'post',
      headers: { 'X-Shopify-Access-Token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      Logger.log("HTTP Error " + response.getResponseCode() + ": " + response.getContentText());
      break;
    }
    
    var data = JSON.parse(response.getContentText());

    // ⚠️ GraphQL-Fehler abfangen (HTTP 200, aber errors im Body)
    if (data.errors) {
      Logger.log("GraphQL Error: " + JSON.stringify(data.errors));
      break;
    }
    if (!data.data || !data.data.orders) break;
    
    var orders = data.data.orders.edges;
    orders.forEach(function(edge) {
      var order = edge.node;
      var city = null;
      
      // Step A: Extract city from explicitly provided addresses
      if (order.shippingAddress && order.shippingAddress.city) {
        city = order.shippingAddress.city;
      } else if (order.billingAddress && order.billingAddress.city) {
        city = order.billingAddress.city;
      } else if (order.customer && order.customer.defaultAddress && order.customer.defaultAddress.city) {
        city = order.customer.defaultAddress.city;
      }
      
      // Step B: Determine if we actually NEED to fetch a city for any missing-city items
      var needsCity = false;
      var productIdsInOrder = [];
      
      if (order.lineItems && order.lineItems.edges) {
        order.lineItems.edges.forEach(function(itemEdge) {
          var item = itemEdge.node;
          if (item.product && item.product.id) {
            var pidMatch = item.product.id.match(/Product\/(\d+)/);
            if (pidMatch && pidMatch[1]) {
              var pid = String(pidMatch[1]);
              productIdsInOrder.push({ pid: pid, qty: item.quantity });
              
              if (!cityMap[pid]) {
                needsCity = true;
              }
            }
          }
        });
      }
      
      // Step C: City-Fallback über IP-API (nur wenn keine Adresse vorhanden)
      // ⚠️ clientIp nicht mehr verfügbar – nutze IP-API nur wenn explizit IP übergeben wird
      // Da clientIp ab API 2024-04 entfernt ist, entfällt dieser Schritt.
      // City kommt jetzt ausschließlich aus Adressen.
      
      // Step D: Update salesMap and cityMap
      productIdsInOrder.forEach(function(item) {
         salesMap[item.pid] = (salesMap[item.pid] || 0) + item.qty;
         
         if (city && !cityMap[item.pid]) {
             cityMap[item.pid] = city;
         }
      });
    });
    
    var pageInfo = data.data.orders.pageInfo;
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
  
  Logger.log("Produkte mit Verkäufen: " + Object.keys(salesMap).length);
  
  var productIds = Object.keys(salesMap);
  for (var i = 0; i < productIds.length; i++) {
    var pid = productIds[i];
    var count = salesMap[pid];
    if (count > 0) {
      updateProductMetafields_(pid, count, HOURS_WINDOW, cityMap[pid]);
      Utilities.sleep(500);
    }
  }
}

// ── Metafields Update ────────────────────────
function updateProductMetafields_(productId, count, hours, city) {
  var gqlUrl = 'https://' + SHOP_DOMAIN + '/admin/api/' + API_VERSION + '/graphql.json';
  
  var metafields = [
    {
      ownerId: "gid://shopify/Product/" + productId,
      namespace: "custom",
      key: "recently_sold_count",
      value: String(count),
      type: "number_integer"
    },
    {
      ownerId: "gid://shopify/Product/" + productId,
      namespace: "custom",
      key: "recently_sold_hours",
      value: String(hours),
      type: "number_integer"
    }
  ];
  
  if (city) {
    metafields.push({
      ownerId: "gid://shopify/Product/" + productId,
      namespace: "custom",
      key: "recently_sold_city",
      value: String(city),
      type: "single_line_text_field"
    });
  }
  
  var payload = {
    query: "mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { field message } } }",
    variables: {
      metafields: metafields
    }
  };
  
  var res = UrlFetchApp.fetch(gqlUrl, {
    method: 'post',
    headers: { 'X-Shopify-Access-Token': ACCESS_TOKEN, 'Content-Type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  var result = JSON.parse(res.getContentText());
  if (result.data && result.data.metafieldsSet && result.data.metafieldsSet.userErrors.length > 0) {
     Logger.log("Metafield Error: " + JSON.stringify(result.data.metafieldsSet.userErrors));
  }
}

