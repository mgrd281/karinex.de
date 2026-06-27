/*
 * Karinex — Admin Health Dashboard (lazy overlay).
 * Loaded only when the URL hash contains "#kx-health" (see admin-error-logger.liquid).
 * Password-gated. Shows: SEO checks (fetch + analyse same-origin URLs) and the
 * JS error log captured on THIS device (localStorage key: karinex_error_log).
 * No Shopify page, no sitemap entry, no indexing.
 */
(function () {
  if (window.__kxHealthUI) { window.__kxHealthUI.open(); return; }

  var PW = window.KX_HEALTH_PW || 'karinex-admin';

  /* ---- styles ---- */
  var css = ''
    + '.kxh-ov{position:fixed;inset:0;z-index:2147483000;background:#f7f8fa;overflow:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#0d2e22;-webkit-text-size-adjust:100%}'
    + '.kxh-wrap{max-width:980px;margin:0 auto;padding:20px 16px 60px}'
    + '.kxh-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}'
    + '.kxh-top h1{font-size:20px;margin:0}'
    + '.kxh-x{background:#e2e8f0;border:0;width:34px;height:34px;border-radius:8px;font-size:18px;cursor:pointer;line-height:1}'
    + '.kxh-gate{max-width:360px;margin:80px auto;text-align:center;padding:28px;border:1px solid #e2e8f0;border-radius:14px;background:#fff}'
    + '.kxh-gate input{width:100%;padding:12px;margin:12px 0;border:1px solid #cbd5e1;border-radius:8px;font-size:16px;box-sizing:border-box}'
    + '.kxh-btn{background:#1D4739;color:#fff;border:0;padding:11px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px}'
    + '.kxh-btn:hover{background:#2d6b54}'
    + '.kxh-err{color:#c0392b;font-size:13px;margin-top:8px}'
    + '.kxh-tabs{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}'
    + '.kxh-tabs button{background:#eef2f6;color:#0d2e22;border:0;padding:10px 16px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px}'
    + '.kxh-tabs button.on{background:#1D4739;color:#fff}'
    + '.kxh-hint{font-size:13px;color:#64748b;margin:0 0 8px}'
    + '.kxh-ov textarea{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-family:monospace;font-size:13px;box-sizing:border-box}'
    + '.kxh-row{display:flex;gap:8px;margin:10px 0}'
    + '.kxh-danger{background:#c0392b}.kxh-danger:hover{background:#a93226}'
    + '.kxh-card{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:12px;background:#fff}'
    + '.kxh-url{font-size:12px;color:#64748b;margin-bottom:10px;word-break:break-all}'
    + '.kxh-chk{display:flex;gap:8px;font-size:13px;padding:3px 0;border-top:1px solid #f1f5f9}'
    + '.kxh-chk:first-child{border-top:0}.kxh-chk .i{flex:0 0 18px;font-weight:700}'
    + '.kxh-ok{color:#1D4739}.kxh-warn{color:#b7791f}.kxh-fail{color:#c0392b}'
    + '.kxh-e{border:1px solid #f1d0d0;background:#fdf6f6;border-radius:8px;padding:10px 12px;margin-bottom:8px}'
    + '.kxh-e .b{display:inline-block;font-size:10px;font-weight:700;background:#c0392b;color:#fff;padding:2px 6px;border-radius:4px}'
    + '.kxh-e .m{font-size:13px;margin:6px 0 4px}.kxh-e .meta{font-size:11px;color:#64748b;word-break:break-all}'
    + '.kxh-empty{color:#64748b;font-size:14px;padding:16px 0}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---- markup ---- */
  var ov = document.createElement('div');
  ov.className = 'kxh-ov';
  ov.innerHTML =
    '<div class="kxh-wrap">'
    + '<div class="kxh-gate" data-gate>'
    +   '<h1>🔒 Interner Check</h1><p>Nur für den Shop-Inhaber.</p>'
    +   '<input type="password" data-pw placeholder="Passwort" autocomplete="off">'
    +   '<button class="kxh-btn" data-pwbtn>Öffnen</button>'
    +   '<p class="kxh-err" data-pwerr hidden>Falsches Passwort.</p>'
    + '</div>'
    + '<div data-app hidden>'
    +   '<div class="kxh-top"><h1>🛠️ Health Dashboard</h1><button class="kxh-x" data-close title="Schließen">✕</button></div>'
    +   '<div class="kxh-tabs"><button class="on" data-tab="seo">🔍 SEO-Check</button><button data-tab="err">🐞 Fehler-Log (dieses Gerät)</button></div>'
    +   '<div data-panel="seo">'
    +     '<p class="kxh-hint">Eine URL pro Zeile (gleiche Domain).</p>'
    +     '<textarea data-urls rows="5">/\n/collections/all\n/products/windows-11-pro-key-kaufen-download\n/blogs/news\n/pages/kontakt</textarea>'
    +     '<div class="kxh-row"><button class="kxh-btn" data-run>Prüfung starten</button></div>'
    +     '<div data-seoout></div>'
    +   '</div>'
    +   '<div data-panel="err" hidden>'
    +     '<div class="kxh-row"><button class="kxh-btn" data-refresh>Aktualisieren</button><button class="kxh-btn kxh-danger" data-clear>Liste leeren</button></div>'
    +     '<div data-errout></div>'
    +   '</div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(ov);

  function $(sel) { return ov.querySelector(sel); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---- open / close ---- */
  function open() { ov.style.display = 'block'; }
  function close() {
    ov.style.display = 'none';
    if ((location.hash || '').toLowerCase().indexOf('kx-health') !== -1) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  $('[data-close]') && $('[data-close]').addEventListener('click', close);
  window.addEventListener('kx-health-open', open);
  window.__kxHealthUI = { open: open };

  /* ---- gate ---- */
  function unlock() { $('[data-gate]').hidden = true; $('[data-app]').hidden = false; try { sessionStorage.setItem('kx_health_ok', '1'); } catch (e) {} renderErrors(); }
  try { if (sessionStorage.getItem('kx_health_ok') === '1') unlock(); } catch (e) {}
  function tryPw() { if ($('[data-pw]').value === PW) unlock(); else $('[data-pwerr]').hidden = false; }
  $('[data-pwbtn]').addEventListener('click', tryPw);
  $('[data-pw]').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryPw(); });
  setTimeout(function () { try { $('[data-pw]').focus(); } catch (e) {} }, 50);

  /* ---- tabs ---- */
  var tabs = ov.querySelectorAll('[data-tab]');
  for (var i = 0; i < tabs.length; i++) {
    (function (t) {
      t.addEventListener('click', function () {
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('on');
        t.classList.add('on');
        $('[data-panel="seo"]').hidden = (t.getAttribute('data-tab') !== 'seo');
        $('[data-panel="err"]').hidden = (t.getAttribute('data-tab') !== 'err');
      });
    })(tabs[i]);
  }

  /* ---- SEO check ---- */
  function row(state, label, detail) {
    var ico = state === 'kxh-ok' ? '✓' : (state === 'kxh-warn' ? '!' : '✗');
    return '<div class="kxh-chk"><span class="i ' + state + '">' + ico + '</span><span>' + esc(label) + (detail ? ' <span style="color:#64748b">— ' + esc(detail) + '</span>' : '') + '</span></div>';
  }
  function analyse(html, status) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var out = [];
    out.push((status >= 200 && status < 300) ? row('kxh-ok', 'HTTP-Status', String(status)) : row('kxh-fail', 'HTTP-Status', String(status)));
    var title = ((doc.querySelector('title') || {}).textContent || '').trim();
    if (!title) out.push(row('kxh-fail', 'Title', 'fehlt'));
    else if (title.length < 15 || title.length > 65) out.push(row('kxh-warn', 'Title-Länge', title.length + ' Zeichen (ideal 15–65)'));
    else out.push(row('kxh-ok', 'Title', title.length + ' Zeichen'));
    var md = doc.querySelector('meta[name="description"]');
    var mdc = md ? (md.getAttribute('content') || '').trim() : '';
    if (!mdc) out.push(row('kxh-fail', 'Meta-Description', 'fehlt'));
    else if (mdc.length < 50 || mdc.length > 165) out.push(row('kxh-warn', 'Description-Länge', mdc.length + ' Zeichen (ideal 50–165)'));
    else out.push(row('kxh-ok', 'Meta-Description', mdc.length + ' Zeichen'));
    var canon = doc.querySelector('link[rel="canonical"]');
    out.push(canon ? row('kxh-ok', 'Canonical', canon.getAttribute('href')) : row('kxh-warn', 'Canonical', 'fehlt'));
    var robots = doc.querySelector('meta[name="robots"]');
    var rc = robots ? (robots.getAttribute('content') || '').toLowerCase() : '';
    out.push(rc.indexOf('noindex') !== -1 ? row('kxh-warn', 'Robots', 'noindex') : row('kxh-ok', 'Robots', rc || 'index (Standard)'));
    var h1 = doc.querySelectorAll('h1');
    if (h1.length === 0) out.push(row('kxh-fail', 'H1', 'keine H1'));
    else if (h1.length === 1) out.push(row('kxh-ok', 'H1', '1 (korrekt)'));
    else out.push(row('kxh-warn', 'H1', h1.length + ' H1 (ideal: 1)'));
    var hl = doc.querySelectorAll('link[rel="alternate"][hreflang]');
    out.push(row(hl.length ? 'kxh-ok' : 'kxh-warn', 'Hreflang', hl.length + ' Tags'));
    var ld = doc.querySelectorAll('script[type="application/ld+json"]'), bad = 0;
    for (var k = 0; k < ld.length; k++) { try { JSON.parse(ld[k].textContent); } catch (e) { bad++; } }
    if (ld.length === 0) out.push(row('kxh-warn', 'Structured Data', 'keine JSON-LD'));
    else if (bad) out.push(row('kxh-fail', 'Structured Data', bad + '/' + ld.length + ' ungültig'));
    else out.push(row('kxh-ok', 'Structured Data', ld.length + ' Blöcke gültig'));
    var imgs = doc.querySelectorAll('img'), noalt = 0;
    for (var q = 0; q < imgs.length; q++) { if (!imgs[q].getAttribute('alt')) noalt++; }
    out.push(noalt === 0 ? row('kxh-ok', 'Bild-Alt-Texte', imgs.length + ' Bilder, alle mit alt') : row('kxh-warn', 'Bild-Alt-Texte', noalt + '/' + imgs.length + ' ohne alt'));
    return out.join('');
  }
  $('[data-run]').addEventListener('click', function () {
    var out = $('[data-seoout]');
    var urls = $('[data-urls]').value.split('\n').map(function (u) { return u.trim(); }).filter(Boolean);
    if (!urls.length) { out.innerHTML = '<p class="kxh-empty">Keine URLs.</p>'; return; }
    var html = '', i = 0;
    (function next() {
      if (i >= urls.length) { out.innerHTML = html; return; }
      var u = urls[i++], abs = u.charAt(0) === '/' ? (location.origin + u) : u;
      fetch(abs, { credentials: 'same-origin' }).then(function (res) {
        return res.text().then(function (t) { html += '<div class="kxh-card"><div class="kxh-url">' + esc(abs) + '</div>' + analyse(t, res.status) + '</div>'; });
      }).catch(function (e) {
        html += '<div class="kxh-card"><div class="kxh-url">' + esc(abs) + '</div>' + row('kxh-fail', 'Abruf fehlgeschlagen', String(e && e.message || e)) + '</div>';
      }).then(function () { out.innerHTML = html + '<p class="kxh-empty">Prüfe… (' + i + '/' + urls.length + ')</p>'; next(); });
    })();
    out.innerHTML = '<p class="kxh-empty">Prüfe ' + urls.length + ' Seiten…</p>';
  });

  /* ---- error log ---- */
  function renderErrors() {
    var out = $('[data-errout]'); if (!out) return;
    var list; try { list = JSON.parse(localStorage.getItem('karinex_error_log') || '[]'); } catch (e) { list = []; }
    list = list.slice().reverse();
    if (!list.length) { out.innerHTML = '<p class="kxh-empty">Keine Fehler auf diesem Gerät. 🎉</p>'; return; }
    out.innerHTML = list.map(function (e) {
      var d = new Date(e.t || Date.now());
      return '<div class="kxh-e"><span class="b">' + esc(e.type || 'JS') + '</span><div class="m">' + esc(e.msg || '') + '</div><div class="meta">📄 ' + esc(e.page || '') + (e.src ? ' · ' + esc(e.src) : '') + ' · ' + d.toLocaleString('de-DE') + '</div></div>';
    }).join('');
  }
  $('[data-refresh]').addEventListener('click', renderErrors);
  $('[data-clear]').addEventListener('click', function () { try { localStorage.removeItem('karinex_error_log'); } catch (e) {} renderErrors(); });

  open();
})();
