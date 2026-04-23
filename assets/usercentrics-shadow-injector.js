if ('requestIdleCallback' in window) {
  requestIdleCallback(initUCStyles, { timeout: 3000 });
} else {
  setTimeout(initUCStyles, 3000);
}

function initUCStyles() {
  var UC_CSS = [
    '@keyframes karinex-modal-in {',
    '  0%   { opacity: 0; transform: translateY(12px) scale(0.985); }',
    '  100% { opacity: 1; transform: translateY(0)    scale(1); }',
    '}',
    '@keyframes karinex-fade-in { from { opacity: 0; } to { opacity: 1; } }',
    '@keyframes karinex-tab-slide {',
    '  from { transform: scaleX(0.4); opacity: 0; }',
    '  to   { transform: scaleX(1);   opacity: 1; }',
    '}',
    '#uc-main-dialog.cmp *, #uc-main-dialog.cmp *::before, #uc-main-dialog.cmp *::after {',
    '  font-family: inherit !important;',
    '}',
    '#uc-overlay, .uc-overlay, .sc-overlay {',
    '  background: radial-gradient(ellipse at center, rgba(15,30,25,0.55) 0%, rgba(0,0,0,0.72) 100%) !important;',
    '  backdrop-filter: blur(8px) saturate(120%) !important;',
    '  -webkit-backdrop-filter: blur(8px) saturate(120%) !important;',
    '  animation: karinex-fade-in 380ms ease-out both !important;',
    '}',
    '#uc-main-dialog.cmp {',
    '  position: relative !important; top: auto !important; left: auto !important; right: auto !important; bottom: auto !important;',
    '  transform: none !important; width: 90vw !important; max-width: 680px !important;',
    '  max-height: 80vh !important; overflow-y: auto !important;',
    '  background: #FFFFFF !important; border-radius: 20px !important;',
    '  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08), 0 30px 80px rgba(15,30,25,0.28) !important;',
    '  border: 1px solid rgba(255,255,255,0.8) !important;',
    '  pointer-events: all !important;',
    '  display: flex !important; flex-direction: column !important;',
    '  margin: 7vh auto 0 !important; box-sizing: border-box !important;',
    '  font-feature-settings: "ss01", "kern", "liga" !important;',
    '  animation: karinex-modal-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both !important;',
    '}',
    '#uc-main-dialog.cmp .sections-body, #uc-main-dialog.cmp #uc-sections-body, #uc-main-dialog.cmp .first {',
    '  padding: 0 32px !important; margin-top: 0 !important;',
    '}',
    '#uc-main-dialog.cmp.mobile {',
    '  width: 100vw !important; max-width: 100vw !important; max-height: 85vh !important;',
    '  border-radius: 18px 18px 0 0 !important; margin: 0 !important;',
    '}',
    '#uc-main-dialog.cmp.mobile .sections-body, #uc-main-dialog.cmp.mobile .first {',
    '  padding: 0 24px !important; margin-top: 0 !important;',
    '}',
    '#uc-main-dialog.cmp::before {',
    '  content: "" !important; display: block !important;',
    '  background-image: url("https://cdn.shopify.com/s/files/1/0917/5328/3851/files/KARINEX-Brand-Banner.webp") !important;',
    '  background-size: contain !important; background-repeat: no-repeat !important; background-position: left center !important;',
    '  height: 38px !important; width: 166px !important;',
    '  margin: 28px 32px 20px !important; flex-shrink: 0 !important;',
    '}',
    '#uc-main-dialog.cmp.mobile::before { margin: 24px 24px 16px !important; height: 32px !important; width: 140px !important; }',
    '#uc-main-dialog.cmp header, header { display: none !important; }',
    '.category-count, .badge, [data-testid="uc-category-count"] { display: none !important; }',
    '.sc-eCImPb.iUSZkF { display: none !important; }',
    '#uc-main-dialog.first .sections-header, #uc-main-dialog.first #uc-tabs-header, #uc-main-dialog.first [role="tablist"], #uc-main-dialog.first .tab-header, #uc-main-dialog.first .categories-header { display: none !important; }',
    '#uc-main-dialog.first [data-testid="uc-categories-list"], #uc-main-dialog.first .categories-section, #uc-main-dialog.first .toggles-section { display: none !important; }',
    '#uc-main-dialog.first #save, #uc-main-dialog.first .save, #uc-main-dialog.first .uc-save-button { display: none !important; }',
    '#uc-main-dialog.first .powered-by-wrapper, #uc-main-dialog.first [data-testid="uc-powered-by"] { display: none !important; }',
    '.sections-body, #uc-sections-body { display: flex !important; flex-direction: column !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }',
    '.cb-dialog-intro, #uc-cmp-description, .overflow { display: flex !important; flex-direction: column !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }',
    '#uc-main-dialog.cmp h1, #uc-main-dialog.cmp h2, .headline, .privacy-title, #uc-privacy-title { display: none !important; }',
    '.privacy-text, #uc-privacy-description, .description { display: none !important; }',
    '#karinex-thalia-text { display: none !important; text-align: left !important; }',
    '#uc-main-dialog.first #karinex-thalia-text { display: block !important; }',
    '.cb-dialog-intro .links, .links {',
    '  display: flex !important; flex-wrap: wrap !important; gap: 12px 24px !important; margin: 0 0 32px !important;',
    '  justify-content: flex-start !important;',
    '}',
    '.links a, .links button, #uc-more-link, .uc-button-link, a.more-info-link, a[data-id="moreInformation"], button.uc-button-link {',
    '  position: relative !important;',
    '  font-size: 13px !important; color: #555555 !important; text-decoration: none !important;',
    '  background: none !important; border: none !important; padding: 0 !important; cursor: pointer !important; opacity: 1 !important; transition: color 0.2s ease !important;',
    '}',
    '.links a::after, .links button::after, #uc-more-link::after, a.more-info-link::after, a[data-id="moreInformation"]::after {',
    '  content: "" !important; position: absolute !important;',
    '  bottom: -2px !important; left: 0 !important;',
    '  width: 0 !important; height: 1px !important;',
    '  background: #1D4739 !important;',
    '  transition: width 0.25s ease !important;',
    '}',
    '.links a:hover, .links button:hover, #uc-more-link:hover, .uc-button-link:hover, a.more-info-link:hover, a[data-id="moreInformation"]:hover, button.uc-button-link:hover { color: #1D4739 !important; }',
    '.links a:hover::after, .links button:hover::after, #uc-more-link:hover::after, a.more-info-link:hover::after, a[data-id="moreInformation"]:hover::after { width: 100% !important; }',
    'footer { width: 100% !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; }',
    '#uc-main-dialog.first .buttons-row, #uc-main-dialog.first .buttons {',
    '  display: flex !important; flex-direction: row !important; gap: 18px !important;',
    '  align-items: stretch !important; justify-content: space-between !important; width: 100% !important; margin: 0 !important; padding-bottom: 32px !important;',
    '}',
    '@media (max-width: 600px) { #uc-main-dialog.first .buttons-row, #uc-main-dialog.first .buttons { flex-direction: column !important; gap: 12px !important; padding-bottom: calc(24px + env(safe-area-inset-bottom)) !important; } }',
    '.buttons-row button, footer button {',
    '  font-size: 0 !important; color: transparent !important;',
    '  font-family: inherit !important; font-weight: 600 !important; cursor: pointer !important;',
    '  border-radius: 14px !important; height: 48px !important; padding: 0 24px !important;',
    '  transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease, background 0.22s ease, border-color 0.22s ease, filter 0.2s ease !important;',
    '  display: flex !important; align-items: center !important; justify-content: center !important;',
    '  box-sizing: border-box !important; border: 1px solid transparent !important;',
    '}',
    '#uc-main-dialog.first footer button { width: 100% !important; flex: 1 !important; }',
    '#accept, .accept, .uc-accept-button {',
    '  background: linear-gradient(180deg, #1D4739 0%, #173A2E 100%) !important;',
    '  border-color: #1D4739 !important; order: 3 !important; display: flex !important;',
    '  box-shadow: 0 2px 4px rgba(29,71,57,0.18), inset 0 1px 0 rgba(255,255,255,0.12) !important;',
    '}',
    '#accept::before, .accept::before, .uc-accept-button::before {',
    '  content: "Alles akzeptieren" !important; font-size: 14.5px !important; font-weight: 600 !important; color: #FFFFFF !important; white-space: nowrap !important; letter-spacing: 0.01em !important;',
    '}',
    '#accept:hover, .accept:hover, .uc-accept-button:hover {',
    '  transform: translateY(-1px) !important;',
    '  box-shadow: 0 4px 12px rgba(29,71,57,0.28), inset 0 1px 0 rgba(255,255,255,0.15) !important;',
    '}',
    '#accept:active, .accept:active, .uc-accept-button:active { transform: translateY(0) !important; }',
    '#deny, .deny, .uc-deny-button {',
    '  background: transparent !important; border: 1.5px solid #D5D5D5 !important; order: 2 !important; display: flex !important;',
    '}',
    '#deny::before, .deny::before, .uc-deny-button::before {',
    '  content: "Nur technisch Erforderliches" !important; font-size: 14px !important; font-weight: 500 !important; color: #1a1a1a !important; white-space: nowrap !important;',
    '}',
    '#deny:hover, .deny:hover, .uc-deny-button:hover { background: #F8F8F8 !important; border-color: #1a1a1a !important; }',
    '.sections-header, #uc-tabs-header, [role="tablist"], .tab-header {',
    '  display: flex !important; justify-content: flex-start !important; gap: 40px !important; margin: 0 32px 24px !important; border-bottom: 2px solid #EAEAEA !important;',
    '}',
    '@media (max-width: 600px) { .sections-header, #uc-tabs-header, [role="tablist"], .tab-header { margin: 0 24px 24px !important; } }',
    '[role="tab"], .tab {',
    '  background: transparent !important; border: none !important; font-size: 16px !important; font-weight: 600 !important; color: #888888 !important; padding: 12px 0 10px !important; cursor: pointer !important; position: relative !important;',
    '  transition: color 0.2s ease !important;',
    '}',
    '[role="tab"]:hover, .tab:hover { color: #1a1a1a !important; }',
    '[role="tab"][aria-selected="true"], .tab.active, [aria-selected="true"] {',
    '  color: #1a1a1a !important;',
    '}',
    '[role="tab"][aria-selected="true"]::after, .tab.active::after, [aria-selected="true"]::after {',
    '  content: "" !important; position: absolute !important; bottom: -2px !important; left: 0 !important; right: 0 !important; height: 3px !important; background: #1D4739 !important; border-radius: 3px 3px 0 0 !important;',
    '  animation: karinex-tab-slide 300ms cubic-bezier(0.22,1,0.36,1) both !important;',
    '}',
    '[role="tab"]:nth-child(n+3), .tab:nth-child(n+3) { display: none !important; }',
    '.categories-section, .toggles-section { padding-bottom: 40px !important; }',
    '.category-row, .toggle-wrapper, [data-testid="uc-category-row"], div[role="group"] > div {',
    '  background: #FAFAFA !important; border-radius: 14px !important; padding: 20px 24px !important; margin-bottom: 16px !important; border: 1px solid transparent !important;',
    '  transition: background 0.2s ease, border-color 0.2s ease !important;',
    '}',
    '.category-row:hover, .toggle-wrapper:hover, [data-testid="uc-category-row"]:hover, div[role="group"] > div:hover {',
    '  background: #F5F5F5 !important; border-color: #EAEAEA !important;',
    '}',
    'div[role="group"] > div { border-bottom: none !important; }',
    '.toggle-name, .uc-category-name { font-size: 15px !important; font-weight: 700 !important; color: #1a1a1a !important; margin-bottom: 4px !important; letter-spacing: -0.005em !important; }',
    '.toggle-description, .uc-category-description { font-size: 13.5px !important; color: #6a6a6a !important; line-height: 1.55 !important; }',
    '.uc-toggle-container {',
    '  display: flex !important; align-items: center !important;',
    '}',
    'button.uc-switch {',
    '  position: relative !important; width: 42px !important; height: 24px !important;',
    '  border-radius: 24px !important; border: none !important; cursor: pointer !important;',
    '  background-color: #D1D1D1 !important;',
    '  box-shadow: inset 0 1px 3px rgba(0,0,0,0.15) !important;',
    '  transition: background-color 0.25s ease, box-shadow 0.25s ease !important;',
    '  padding: 0 !important; outline: none !important;',
    '  flex-shrink: 0 !important;',
    '}',
    'button.uc-switch::after {',
    '  content: "" !important; position: absolute !important;',
    '  width: 18px !important; height: 18px !important; border-radius: 50% !important;',
    '  background: #FFFFFF !important;',
    '  box-shadow: 0 1px 4px rgba(0,0,0,0.25) !important;',
    '  top: 3px !important; left: 3px !important;',
    '  transition: left 0.25s ease !important;',
    '}',
    'button.uc-switch[aria-checked="true"] {',
    '  background-color: #1D4739 !important;',
    '  box-shadow: inset 0 1px 3px rgba(29,71,57,0.4), 0 0 0 3px rgba(29,71,57,0.08) !important;',
    '}',
    'button.uc-switch[aria-checked="true"]::after {',
    '  left: 21px !important;',
    '}',
    'button.uc-switch.disabled { opacity: 0.6 !important; cursor: default !important; }',
    'button.uc-switch svg, button.uc-switch span { display: none !important; }',
    'button.uc-switch div { display: none !important; }',
    '.chevron, .sc-iJCRLp svg, svg[direction], button svg { vertical-align: middle !important; margin-left: auto !important; }',
    '.flex-row { display: flex !important; align-items: center !important; }',
    '#uc-main-dialog:not(.first) footer {',
    '  margin-top: 0 !important; padding: 24px 32px !important; background: #FFFFFF !important; border-top: 1px solid #EAEAEA !important;',
    '  height: auto !important; min-height: 70px !important; flex-shrink: 0 !important;',
    '}',
    '#uc-main-dialog:not(.first) .buttons-row, #uc-main-dialog:not(.first) .buttons {',
    '  display: flex !important; flex-wrap: nowrap !important; gap: 16px !important; flex-direction: row !important; justify-content: space-between !important; width: 100% !important; margin: 0 !important;',
    '}',
    '#uc-main-dialog:not(.first) footer button { flex: 1 !important; height: 48px !important; width: auto !important; }',
    '#save, .save, .uc-save-button {',
    '  background: transparent !important; border-color: #D0D0D0 !important; order: 1 !important; display: flex !important;',
    '}',
    '#save::before, .save::before, .uc-save-button::before {',
    '  content: "Speichern" !important; font-size: 14px !important; font-weight: 500 !important; color: #1a1a1a !important; white-space: nowrap !important;',
    '}',
    '#save:hover, .save:hover, .uc-save-button:hover { background: #FAFAFA !important; border-color: #111111 !important; }',
    '.powered-by-wrapper, [data-testid="uc-powered-by"] {',
    '  display: block !important; text-align: center !important; margin-top: 20px !important; opacity: 0.5 !important; font-size: 12px !important;',
    '}',
    '#uc-main-dialog.first .powered-by-wrapper, #uc-main-dialog.first [data-testid="uc-powered-by"] { display: none !important; }',
    '#uc-main-dialog.cmp::-webkit-scrollbar { width: 6px; }',
    '#uc-main-dialog.cmp::-webkit-scrollbar-track { background: transparent; }',
    '#uc-main-dialog.cmp::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #D0D0D0, #B8B8B8); border-radius: 6px; }',
    '#uc-main-dialog.cmp::-webkit-scrollbar-thumb:hover { background: #1D4739; }',
    '@media (max-width: 768px) {',
    '  #uc-main-dialog:not(.first) footer { padding: 20px 24px calc(24px + env(safe-area-inset-bottom)) !important; }',
    '  #uc-main-dialog:not(.first) .buttons-row { flex-direction: column !important; gap: 12px !important; }',
    '  #uc-main-dialog:not(.first) footer button { width: 100% !important; flex: none !important; }',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  #uc-main-dialog.cmp, #uc-overlay, .uc-overlay, .sc-overlay,',
    '  [role="tab"][aria-selected="true"]::after, .tab.active::after {',
    '    animation: none !important;',
    '  }',
    '  #uc-main-dialog.cmp *, .buttons-row button, footer button {',
    '    transition-duration: 0.01ms !important;',
    '  }',
    '}',
    '#uc-privacy-button, #uc-corner-modal-button, [data-testid="uc-privacy-button"], .uc-privacy-button {',
    '  display: none !important;',
    '}'
  ].join('\n');

  var UC_HTML = '<div id="karinex-thalia-text" style="text-align: left; margin-bottom: 28px;">' +
                '<div style="font-size: 24px; font-weight: 700; margin: 0 0 10px; color: #1a1a1a; letter-spacing: -0.02em; line-height: 1.25;">Ihre Privatsph&auml;re &mdash; unser Versprechen.</div>' +
                '<p style="font-size: 14.5px; line-height: 1.65; color: #4a4a4a; margin: 0 0 18px;">Wir verwenden Cookies, um Ihr Einkaufserlebnis bei KARINEX zu personalisieren, die Leistung unserer Website zu verbessern und Ihnen relevante Angebote zu zeigen.</p>' +
                '<p style="font-size: 13.5px; line-height: 1.65; color: #6a6a6a; margin: 0;">Mit &bdquo;Alles akzeptieren&ldquo; stimmen Sie der Verwendung zu. Sie k&ouml;nnen Ihre Auswahl jederzeit in den Einstellungen &auml;ndern. Details in unseren <strong style="color: #1a1a1a;">Datenschutzhinweisen</strong>.</p>' +
                '</div>';

  function tryInject() {
    var host = document.getElementById('usercentrics-root') || document.getElementById('usercentrics-cmp-ui');
    if (!host || !host.shadowRoot) return false;

    if (!host.shadowRoot.getElementById('uc-karinex-custom-styles')) {
      var style = document.createElement('style');
      style.id = 'uc-karinex-custom-styles';
      style.textContent = UC_CSS;
      host.shadowRoot.appendChild(style);
    }

    var introContainer = host.shadowRoot.querySelector('.cb-dialog-intro') || host.shadowRoot.querySelector('#uc-cmp-description');
    if (introContainer && !host.shadowRoot.getElementById('karinex-thalia-text')) {
      var div = document.createElement('div');
      div.innerHTML = UC_HTML;
      var firstNode = div.firstChild;
      if (firstNode) {
        introContainer.insertBefore(firstNode, introContainer.firstChild);
      }
    }

    return !!(host && host.shadowRoot && host.shadowRoot.getElementById('uc-karinex-custom-styles'));
  }

  var observer = new MutationObserver(function (mutations, obs) {
    if (tryInject()) {
      var ucRoot = document.querySelector('#usercentrics-root');
      var isFullyLoaded = !!(
        ucRoot &&
        ucRoot.shadowRoot &&
        ucRoot.shadowRoot.querySelector('.accept')
      );
      if (isFullyLoaded) {
        // Keep watching for UC view changes.
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('UC_UI_VIEW_CHANGED', tryInject);
  window.addEventListener('UC_UI_INITIALIZED', tryInject);

  setTimeout(tryInject, 4000);
}
