/* ============================================================
   KARINEX – Idealo Style Price Alert Popup
   ============================================================ */

(function () {
  'use strict';

  /* ── Helpers ─────────────────────────────────────────────── */
  function fmt(n) { return n.toFixed(2).replace('.', ',') + ' €'; }

  /* ── Build DOM ───────────────────────────────────────────── */
  function buildPopup(productData) {
    var old = document.getElementById('price-alert-overlay');
    if (old) old.remove();

    var currentPrice = productData.price;
    var minPrice = Math.round(currentPrice * 0.50); /* allow down to 50% */
    var maxPrice = Math.round(currentPrice * 1.05); /* slightly above */
    var alertPrice = currentPrice;
    
    var productId = productData.id || productData.handle;
    var storageKey = 'karinex_pa_' + productId;
    var savedStr = localStorage.getItem(storageKey);
    var savedAlert = null;
    try { if (savedStr) savedAlert = JSON.parse(savedStr); } catch(e){}

    var initialTarget = savedAlert && savedAlert.price ? savedAlert.price : (currentPrice * 0.95);
    var initialEmail = savedAlert && savedAlert.email ? savedAlert.email : '';

    /* Theme Colors: we use store's #1d4739 for accent, but can use an orange or blue for the chart lines to match idealo */
    var chartColor = '#f97316'; // Orange like idealo
    var targetColor = '#1d4739'; // Store brand color for target line

    /* ── DOM Container ── */
    var overlay = document.createElement('div');
    overlay.id = 'price-alert-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    /* ── HTML Template ── */
    var html = [
      '<div id="price-alert-modal">',
      '  <button id="price-alert-close">&times;</button>',
      '  <div class="pa-header-title">Preiswecker stellen</div>',
      
      '  <div class="pa-time-filters">',
      '    <span class="pa-t-btn pa-t-active">1M</span><span class="pa-t-btn">3M</span><span class="pa-t-btn">6M</span><span class="pa-t-btn">1J</span>',
      '  </div>',
      
      '  <div id="pa-chart-container"></div>',

      '  <div class="pa-current-price-blk">',
      '    <div class="pa-cp-val">' + fmt(currentPrice) + '</div>',
      '    <div class="pa-cp-lbl">Aktueller Preis</div>',
      '  </div>',

      '  <div class="pa-target-input-blk">',
      '    <input type="text" id="pa-target-val" value="' + fmt(initialTarget) + '" readonly>',
      '  </div>',

      '  <div class="pa-slider-container">',
      '    <input type="range" id="pa-slider" min="' + minPrice + '" max="' + maxPrice + '" value="' + initialTarget + '" step="1">',
      '    <div class="pa-slider-labels">',
      '      <span>unrealistisch</span>',
      '      <span>realistisch</span>',
      '    </div>',
      '  </div>',

      '  <div class="pa-toggles">',
      '    <label class="pa-toggle-row">',
      '      <span class="pa-toggle-text">Verfügbarkeit ändert sich</span>',
      '      <div class="pa-switch"><input type="checkbox" id="pa-stock-check" checked><span class="pa-slider-round"></span></div>',
      '    </label>',
      '    <label class="pa-toggle-row">',
      '      <span class="pa-toggle-text">Neue Bewertungen</span>',
      '      <div class="pa-switch"><input type="checkbox" id="pa-review-check" checked><span class="pa-slider-round"></span></div>',
      '    </label>',
      '  </div>',

      '  <div class="pa-email-wrap">',
      '    <span class="pa-email-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7"></path><rect x="3" y="5" width="18" height="14" rx="2"></rect></svg></span>',
      '    <input type="email" id="pa-email-input" placeholder="deine@email.de" autocomplete="email" value="' + initialEmail + '">',
      '  </div>',

      '  <button id="price-alert-save">Preiswecker stellen</button>',
      '</div>'
    ].join('');

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    /* ── Selectors ── */
    var modal = overlay.querySelector('#price-alert-modal');
    var closeBtn = overlay.querySelector('#price-alert-close');
    var chartContainer = overlay.querySelector('#pa-chart-container');
    var slider = overlay.querySelector('#pa-slider');
    var targetInput = overlay.querySelector('#pa-target-val');
    var emailInput = overlay.querySelector('#pa-email-input');
    var saveBtn = overlay.querySelector('#price-alert-save');

    /* ── Pre-fill Email ── */
    // This block is now redundant as emailInput is initialized in the HTML template
    // try {
    //   var savedPrefs = JSON.parse(localStorage.getItem('karinex_price_alerts') || '{}');
    //   if (savedPrefs._email) emailInput.value = savedPrefs._email;
    // } catch(e) {}

    /* ── Chart Generation ── */
    var targetLineEl, targetIconGroup;
    var w = 340, h = 140, padY = 15, padX = 20;
    var currentHistoryData = [];
    var currentDaysView = 30;
    
    function buildChartSVG(historyRecords, daysView) {
      daysView = daysView || 30;
      var points = [];
      var now = new Date();
      
      // Generate rolling window
      for (var i = daysView; i >= 0; i--) {
        var d = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        var dStr = d.toISOString().split('T')[0];
        
        var priceForDay = currentPrice;
        
        if (historyRecords && historyRecords.length > 0) {
          var pastRecords = historyRecords.filter(function(r) { return r.date <= dStr; });
          if (pastRecords.length > 0) {
            priceForDay = pastRecords[pastRecords.length - 1].price;
          } else {
            // Before tracking started: fallback to compare at price or first known price
            priceForDay = productData.comparePrice ? productData.comparePrice : historyRecords[0].price;
          }
        } else {
           // No history yet: flat line, or drop from comparePrice if available to simulate recent sale
           priceForDay = (productData.comparePrice && i > (daysView/2)) ? productData.comparePrice : currentPrice;
        }
        
        points.push(priceForDay);
      }
      points[points.length - 1] = currentPrice; // strict anchor to current price

      var cMax = Math.max.apply(null, points);
      var cMin = Math.min.apply(null, points);
      var absoluteMax = Math.max(cMax, maxPrice);
      var absoluteMin = Math.min(cMin, minPrice);
      var range = (absoluteMax - absoluteMin) || 1;

      var stepX = (w - 2 * padX) / (points.length - 1);
      
      var pathData = [];
      for (var j = 0; j < points.length; j++) {
        var px = padX + j * stepX;
        var py = padY + (h - 2 * padY) * (1 - (points[j] - absoluteMin) / range);
        pathData.push((j === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1));
      }
      var dStr = pathData.join(' ');

      var svgNS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.setAttribute('class', 'pa-chart-svg');

      // Grid lines & labels (Y Axis)
      var gridCount = 4;
      for (var k = 0; k < gridCount; k++) {
        var yVal = absoluteMax - (k * (range / (gridCount - 1)));
        var yPos = padY + (h - 2 * padY) * (k / (gridCount - 1));
        
        var line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', padX);
        line.setAttribute('x2', w);
        line.setAttribute('y1', yPos);
        line.setAttribute('y2', yPos);
        line.setAttribute('stroke', '#ebebeb');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);

        var txt = document.createElementNS(svgNS, 'text');
        txt.setAttribute('x', w);
        txt.setAttribute('y', yPos - 4);
        txt.setAttribute('text-anchor', 'end');
        txt.setAttribute('fill', '#888');
        txt.setAttribute('font-size', '9');
        txt.textContent = fmt(yVal);
        svg.appendChild(txt);
      }

      // X Axis labels (Dates)
      var dateLabels = [];
      for (var step = 0; step < 4; step++) {
          var dayOffset = Math.floor(step * (daysView / 3));
          var lblDate = new Date(now.getTime() - ((daysView - dayOffset) * 24 * 60 * 60 * 1000));
          dateLabels.push(('0' + lblDate.getDate()).slice(-2) + '.' + ('0' + (lblDate.getMonth() + 1)).slice(-2) + '.');
      }

      for (var m = 0; m < dateLabels.length; m++) {
        var dtxt = document.createElementNS(svgNS, 'text');
        dtxt.setAttribute('x', padX + (m * ((w - 2 * padX) / 3)));
        dtxt.setAttribute('y', h);
        dtxt.setAttribute('text-anchor', m === 0 ? 'start' : (m === 3 ? 'end' : 'middle'));
        dtxt.setAttribute('fill', '#555');
        dtxt.setAttribute('font-size', '10');
        dtxt.textContent = dateLabels[m];
        svg.appendChild(dtxt);
      }

      // Area under curve
      var defs = document.createElementNS(svgNS, 'defs');
      var grad = document.createElementNS(svgNS, 'linearGradient');
      grad.setAttribute('id', 'pa-chart-grad');
      grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
      grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
      var stop1 = document.createElementNS(svgNS, 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', chartColor);
      stop1.setAttribute('stop-opacity', '0.15');
      var stop2 = document.createElementNS(svgNS, 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', chartColor);
      stop2.setAttribute('stop-opacity', '0');
      grad.appendChild(stop1); grad.appendChild(stop2);
      defs.appendChild(grad);
      svg.appendChild(defs);

      var area = document.createElementNS(svgNS, 'path');
      area.setAttribute('d', dStr + ' L' + (w - padX) + ',' + (h - padY) + ' L' + padX + ',' + (h - padY) + ' Z');
      area.setAttribute('fill', 'url(#pa-chart-grad)');
      svg.appendChild(area);

      // Price Line
      var pline = document.createElementNS(svgNS, 'path');
      pline.setAttribute('d', dStr);
      pline.setAttribute('fill', 'none');
      pline.setAttribute('stroke', chartColor);
      pline.setAttribute('stroke-width', '2');
      pline.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pline);

      // Current Price Dot
      var dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', w - padX);
      dot.setAttribute('cy', padY + (h - 2 * padY) * (1 - (currentPrice - absoluteMin) / range));
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', '#fff');
      dot.setAttribute('stroke', chartColor);
      dot.setAttribute('stroke-width', '2');
      svg.appendChild(dot);

      // Target Line
      targetLineEl = document.createElementNS(svgNS, 'line');
      targetLineEl.setAttribute('x1', padX);
      targetLineEl.setAttribute('x2', w - padX);
      targetLineEl.setAttribute('stroke', targetColor);
      targetLineEl.setAttribute('stroke-width', '1.5');
      targetLineEl.setAttribute('stroke-dasharray', '5 5');
      svg.appendChild(targetLineEl);

      // Target Icon
      targetIconGroup = document.createElementNS(svgNS, 'g');
      var iconBg = document.createElementNS(svgNS, 'circle');
      iconBg.setAttribute('cx', '0'); iconBg.setAttribute('cy', '0');
      iconBg.setAttribute('r', '8');
      iconBg.setAttribute('fill', '#fff');
      var iconSvg = document.createElementNS(svgNS, 'path');
      iconSvg.setAttribute('d', 'M0,-4 A4,4 0 1,1 0,4 A4,4 0 1,1 0,-4 M0,-2 L0,0 L1.5,1.5 M-3,-5 L-4,-4 M3,-5 L4,-4');
      iconSvg.setAttribute('fill', 'none');
      iconSvg.setAttribute('stroke', targetColor);
      iconSvg.setAttribute('stroke-width', '1.2');
      targetIconGroup.appendChild(iconBg);
      targetIconGroup.appendChild(iconSvg);
      svg.appendChild(targetIconGroup);

      chartContainer.innerHTML = '';
      chartContainer.appendChild(svg);

      return { min: absoluteMin, range: range };
    }

    var chartData = { min: minPrice, range: (maxPrice - minPrice) || 1 };
    
    // Fetch REAL data from Firebase
    function fetchAndBuildChart() {
      // Create initial optimistic skeleton so it doesn't look empty
      chartData = buildChartSVG([], currentDaysView);
      updateSlider();

      var fUrl = 'https://karinex-36f7d-default-rtdb.europe-west1.firebasedatabase.app/priceHistory/' + productData.handle + '.json';
      fetch(fUrl)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          var history = [];
          if (data) {
             if (Array.isArray(data)) history = data;
             else history = Object.keys(data).map(function(k){ return data[k]; });
          }
           history = history.filter(function(i){ return i && i.date && typeof i.price === 'number'; });
           currentHistoryData = history;
           if (history.length > 0) {
             chartData = buildChartSVG(currentHistoryData, currentDaysView);
             updateSlider();
           }
        })
        .catch(function(e) { console.error("History Error", e); });
    }

    fetchAndBuildChart();

    /* ── Interaction ── */
    function updateSlider() {
      var val = parseFloat(slider.value);
      targetInput.value = fmt(val);

      // Percentage of the slider range
      var rawPct = (val - parseFloat(slider.min)) / (parseFloat(slider.max) - parseFloat(slider.min));
      var pct = Math.max(0, Math.min(1, rawPct)) * 100;
      var pctStr = pct.toFixed(1) + '%';

      // Webkit: update CSS custom prop so -webkit-slider-runnable-track gradient re-renders
      slider.style.setProperty('--pa-pct', pctStr);
      // Firefox + fallback: direct background on the element
      slider.style.background = 'linear-gradient(to right, #1d4739 ' + pctStr + ', #e5e7eb ' + pctStr + ')';

      if (targetLineEl && targetIconGroup) {
        var yPos = padY + (h - 2 * padY) * (1 - (val - chartData.min) / chartData.range);
        targetLineEl.setAttribute('y1', yPos);
        targetLineEl.setAttribute('y2', yPos);
        // Position icon on line
        targetIconGroup.setAttribute('transform', 'translate(' + (padX + 20) + ',' + yPos + ')');
      }
    }

    slider.addEventListener('input', updateSlider);
    updateSlider(); // Initial state

    function closePopup() {
      overlay.classList.remove('pa-visible');
      setTimeout(function () { overlay.remove(); }, 300);
    }
    closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closePopup(); });
    document.addEventListener('keydown', function onEsc(e){ if (e.key === 'Escape') { closePopup(); document.removeEventListener('keydown', onEsc); } });

    if (saveBtn && emailInput) {
      saveBtn.addEventListener('click', function() {
        var email = emailInput.value.trim();

        if (!email || email.indexOf('@') === -1) {
          emailInput.style.borderColor = 'red';
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Speichern...';
        saveBtn.style.opacity = '0.7';

        var targetInput = overlay.querySelector('#pa-target-input');
        var targetVal = targetInput ? parseFloat(targetInput.value) : (slider ? parseFloat(slider.value) : 0);

        var payload = {
          action: 'set_alert',
          email: email,
          productHandle: productData.handle,
          productTitle: productData.title,
          currentPrice: currentPrice,
          targetPrice: targetVal
        };

        // Save to localStorage so it stays on alert when reopened
        var productId = productData.id || productData.handle;
        var storageKey = 'karinex_pa_' + productId;
        localStorage.setItem(storageKey, JSON.stringify({
            price: payload.targetPrice,
            email: payload.email
        }));

        var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxIC_-dpEms2lm_rNJQoU4gLOh2mMqdMHXSwmGuwyJHi3Ps9a3OxHtZ-cIWVOMba0eacg/exec';

        fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        })
        .then(function() {
          saveBtn.textContent = '✓ Preiswecker gestellt!';
          saveBtn.style.background = '#10b981'; // success green
          setTimeout(function() {
             closePopup();
          }, 1500);
        })
        .catch(function(e) {
          saveBtn.textContent = 'Fehler! Bitte nochmal versuchen.';
          setTimeout(function() {
             saveBtn.disabled = false;
             saveBtn.style.opacity = '1';
             saveBtn.textContent = 'Preiswecker stellen';
             saveBtn.style.background = '#1d4739';
          }, 3000);
        });
      });
    }

    // Time filter mock clicks
    var tBtns = overlay.querySelectorAll('.pa-t-btn');
    tBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        tBtns.forEach(function(b) { b.classList.remove('pa-t-active'); });
        btn.classList.add('pa-t-active');
        
        var txt = btn.textContent.trim();
        if (txt === '1M') currentDaysView = 30;
        else if (txt === '3M') currentDaysView = 90;
        else if (txt === '6M') currentDaysView = 180;
        else if (txt === '1J') currentDaysView = 365;
        
        chartData = buildChartSVG(currentHistoryData, currentDaysView);
        updateSlider();
      });
    });

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('pa-visible');
      });
    });
  }

  /* ── CSS Injection ───────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('price-alert-css')) return;
    var style = document.createElement('style');
    style.id = 'price-alert-css';
    style.textContent = [
      '#price-alert-overlay{',
        'position:fixed;inset:0;z-index:999999;',
        'display:flex;align-items:center;justify-content:center;',
        'background:rgba(0,0,0,0);',
        'transition:background 0.3s ease;',
        'padding:16px;box-sizing:border-box;',
        'font-family:inherit;',
      '}',
      '#price-alert-overlay.pa-visible{background:rgba(0,0,0,0.5);}',
      
      '#price-alert-modal{',
        'position:relative;width:100%;max-width:440px;',
        'background:#ffffff;border-radius:16px;',
        'padding:28px 25px 24px;',
        'box-shadow:0 12px 48px rgba(0,0,0,0.14);',
        'box-sizing:border-box;',
        'transform:translateY(20px);opacity:0;',
        /* Only animate transform+opacity — avoid jitter from 'all' */
        'transition:transform 0.38s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease;',
      '}',
      '#price-alert-overlay.pa-visible #price-alert-modal{transform:translateY(0);opacity:1;}',,

      '#price-alert-close{',
        'position:absolute;top:16px;right:18px;',
        'background:none;border:none;cursor:pointer;',
        'font-size:26px;font-weight:300;color:#999;',
        'transition:color 0.2s;line-height:1;padding:4px;',
      '}',
      '#price-alert-close:hover{color:#333;}',

      '.pa-header-title{',
        'font-size:20px;font-weight:600;color:#222;margin-bottom:20px;text-align:center;',
      '}',

      '.pa-time-filters{',
        'display:flex;justify-content:center;gap:16px;margin-bottom:12px;',
      '}',
      '.pa-t-btn{',
        'font-size:12px;font-weight:600;color:#666;cursor:pointer;padding:4px 10px;',
        'border-radius:12px;transition:all 0.2s;',
      '}',
      '.pa-t-btn:hover{color:#1d4739;}',
      '.pa-t-btn.pa-t-active{background:#1d4739;color:#fff;}',

      '#pa-chart-container{',
        'width:100%;height:140px;position:relative;margin-bottom:10px;',
      '}',
      '.pa-chart-svg{width:100%;height:100%;overflow:visible;display:block;}',

      '.pa-current-price-blk{',
        'margin-bottom:16px;',
      '}',
      '.pa-cp-val{font-size:24px;font-weight:700;color:#222;}',
      '.pa-cp-lbl{font-size:13px;color:#777;}',

      '.pa-target-input-blk{',
        'border:1.5px solid #eaeaea;border-radius:8px;padding:12px 14px;',
        'margin-bottom:18px;',
      '}',
      '#pa-target-val{',
        'width:100%;border:none;outline:none;background:none;',
        'font-size:22px;font-weight:700;color:#1d4739;text-align:right;',
        'padding:0;margin:0;',
      '}',

      '.pa-slider-container{margin-bottom:20px;}',
      /* accent-color forces all browsers to use green for the thumb */
      '#pa-slider{',
        '-webkit-appearance:none;appearance:none;',
        'accent-color:#1d4739;',
        'width:100%;height:5px;border-radius:3px;',
        'outline:none;cursor:pointer;margin-bottom:10px;',
        'background:var(--pa-track,#e5e7eb);',
      '}',
      /* Webkit – custom thumb + dynamic filled track via linear-gradient */
      '#pa-slider::-webkit-slider-runnable-track{',
        'height:5px;border-radius:3px;',
        'background:linear-gradient(to right, #1d4739 var(--pa-pct,50%), #e5e7eb var(--pa-pct,50%));',
      '}',
      '#pa-slider::-webkit-slider-thumb{',
        '-webkit-appearance:none;',
        'width:22px;height:22px;margin-top:-8.5px;',
        'border-radius:50%;background:#1d4739;',
        'border:3px solid #fff;',
        'box-shadow:0 1px 8px rgba(29,71,57,0.35);cursor:pointer;',
        'transition:transform 0.15s ease;',
      '}',
      '#pa-slider::-webkit-slider-thumb:active{transform:scale(1.18);}',
      /* Firefox */
      '#pa-slider::-moz-range-track{',
        'height:5px;border-radius:3px;',
        'background:#e5e7eb;',
      '}',
      '#pa-slider::-moz-range-progress{',
        'height:5px;border-radius:3px;background:#1d4739;',
      '}',
      '#pa-slider::-moz-range-thumb{',
        'width:22px;height:22px;border-radius:50%;',
        'background:#1d4739;border:3px solid #fff;',
        'box-shadow:0 1px 8px rgba(29,71,57,0.35);cursor:pointer;',
      '}',
      '.pa-slider-labels{',
        'display:flex;justify-content:space-between;font-size:12px;color:#aaa;letter-spacing:0.02em;',
      '}',

      /* Toggles */
      '.pa-toggles{margin-bottom:20px;}',
      '.pa-toggle-row{',
        'display:flex;justify-content:space-between;align-items:center;',
        'margin-bottom:12px;cursor:pointer;',
      '}',
      '.pa-toggle-text{font-size:14px;color:#444;}',
      '.pa-switch{position:relative;width:40px;height:22px;}',
      '.pa-switch input{opacity:0;width:0;height:0;}',
      '.pa-slider-round{',
        'position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;',
        'background-color:#ccc;transition:.3s;border-radius:22px;',
      '}',
      '.pa-slider-round:before{',
        'position:absolute;content:"";height:18px;width:18px;',
        'left:2px;bottom:2px;background-color:white;transition:.3s;border-radius:50%;',
      '}',
      '.pa-switch input:checked + .pa-slider-round{background-color:#1d4739;}',
      '.pa-switch input:checked + .pa-slider-round:before{transform:translateX(18px);}',

      /* Email */
      '.pa-email-wrap{',
        'display:flex;align-items:center;',
        'border:1.5px solid #d1d5db;border-radius:8px;',
        'padding:10px 12px;background:#fff;',
        'transition:border-color 0.2s;',
      '}',
      '.pa-email-wrap:focus-within{border-color:#1d4739;}',
      '.pa-email-icon{margin-right:10px;color:#999;display:flex;}',
      '.pa-email-icon svg{width:20px;height:20px;}',
      '#pa-email-input{',
        'flex:1;border:none;outline:none;font-size:14px;font-family:inherit;background:transparent;',
      '}',
      '#pa-email-input::placeholder{color:#aaa;}',

      /* Submit Button */
      '#price-alert-save{',
        'width:100%;height:52px;margin-top:20px;',
        'background:#1d4739;color:#fff;', 
        'border:none;border-radius:8px;',
        'font-size:16px;font-weight:600;',
        'cursor:pointer;transition:transform 0.1s,background 0.2s;',
      '}',
      '#price-alert-save:hover{background:#143329;}',
      '#price-alert-save:active{transform:scale(0.98);}',

      '@media(max-width:480px){',
        '#price-alert-modal{padding:24px 20px;max-width:calc(100% - 32px);}',
        '.pa-cp-val{font-size:22px;}',
        '#pa-target-val{font-size:20px;}',
      '}',

      /* ── Mobile: Bottom Sheet layout ─────────────────────── */
      '@media(max-width:768px){',
        /* Overlay: align to bottom */
        '#price-alert-overlay{',
          'align-items:flex-end !important;',
          'justify-content:stretch !important;',
          'padding:0 !important;',
        '}',
        /* Modal: full width, slides up from bottom */
        '#price-alert-modal{',
          'max-width:100% !important;width:100% !important;',
          'border-radius:20px 20px 0 0 !important;',
          'padding:10px 20px 36px !important;',
          'box-shadow:0 -4px 32px rgba(0,0,0,0.14) !important;',
          /* Transform-only transition — no opacity conflict */
          'transition:transform 0.4s cubic-bezier(0.16,1,0.3,1) !important;',
          'transform:translateY(100%) !important;',
          'opacity:1 !important;',
          'max-height:92dvh;overflow-y:auto;',
        '}',
        '#price-alert-overlay.pa-visible #price-alert-modal{transform:translateY(0) !important;}',,

        /* Drag handle pill at top of sheet */
        '#price-alert-modal::before{',
          'content:"";display:block;',
          'width:40px;height:4px;border-radius:2px;',
          'background:#d1d5db;',
          'margin:0 auto 16px;',
        '}',

        /* Close button — moved to top-right inside sheet */
        '#price-alert-close{top:14px;right:16px;}',

        /* Title: larger on sheet */
        '.pa-header-title{font-size:18px;margin-bottom:16px;}',

        /* Save button: sticky at bottom */
        '#price-alert-save{',
          'position:sticky;bottom:0;',
          'border-radius:10px !important;',
          'height:54px;font-size:17px;',
          'margin-top:16px;',
        '}',
      '}',
    ].join('');
    document.head.appendChild(style);
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.PriceAlertPopup = {
    open: function (opts) {
      injectCSS();
      buildPopup({
        handle:  opts.handle  || '',
        title:   opts.title   || 'Produkt',
        image:   opts.image   || '',
        price:   parseFloat(opts.price) || 0,
        comparePrice: opts.comparePrice ? parseFloat(opts.comparePrice) : 0
      });
    }
  };

  /* ── Auto-bind bell buttons ──────────────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.pdp-bell-btn, [data-price-alert]');
    if (!btn) return;
    
    try {
      e.preventDefault();
      e.stopPropagation();
      
      var handle = btn.dataset.handle || (document.querySelector('[data-product-handle]') && document.querySelector('[data-product-handle]').dataset.productHandle) || '';
      var title  = btn.dataset.title  || (document.querySelector('.product-title') && document.querySelector('.product-title').textContent.trim()) || '';
      var image  = btn.dataset.image  || (document.querySelector('.gallery-slide-img') && document.querySelector('.gallery-slide-img').src) || '';
      var priceStr  = btn.dataset.price || (document.querySelector('[data-product-price]') && document.querySelector('[data-product-price]').dataset.productPrice) || '0';
      var compareStr= btn.dataset.comparePrice || '';

      var price = parseFloat(priceStr) / 100;
      var comparePrice = parseFloat(compareStr) / 100;

      if (isNaN(price) || price === 0) {
        var priceEl = document.querySelector('.price__regular .price-item--regular, .price-item.price-item--regular, [data-product-price]');
        if (priceEl) {
          var txt = priceEl.textContent.replace(/[^\d,.]/g, '').replace(',', '.');
          price = parseFloat(txt) || 0;
        }
      }
      
      window.PriceAlertPopup.open({ handle: handle, title: title, image: image, price: price, comparePrice: comparePrice });
    } catch (err) {
      console.error("[Price Alert] Error:", err);
    }
  }, true);

})();
