if ('requestIdleCallback' in window) {
  requestIdleCallback(initUCStyles, { timeout: 3000 });
} else {
  setTimeout(initUCStyles, 3000);
}

function initUCStyles() {
  var UC_CSS = [
    '#uc-main-dialog.cmp *, #uc-main-dialog.cmp *::before, #uc-main-dialog.cmp *::after {',
    '  font-family: inherit !important;',
    '}',
    '#uc-overlay, .uc-overlay, .sc-overlay {',
    '  background: rgba(0,0,0,0.55) !important;',
    '}',
    '#uc-main-dialog.cmp {',
    '  position: relative !important; top: auto !important; left: auto !important; right: auto !important; bottom: auto !important;',
    '  transform: none !important; width: 90vw !important; max-width: 680px !important;',
    '  max-height: 80vh !important; overflow-y: auto !important;',
    '  background: #FFFFFF !important; border-radius: 18px !important;',
    '  box-shadow: 0 25px 70px rgba(0,0,0,0.30) !important;',
    '  pointer-events: all !important;',
    '  display: flex !important; flex-direction: column !important;',
    '  margin: 7vh auto 0 !important; box-sizing: border-box !important;',
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
    '  font-size: 13px !important; color: #555555 !important; text-decoration: none !important;',
    '  background: none !important; border: none !important; padding: 0 !important; cursor: pointer !important; opacity: 1 !important; transition: color 0.2s ease !important;',
    '}',
    '.links a:hover, .links button:hover, #uc-more-link:hover, .uc-button-link:hover, a.more-info-link:hover, a[data-id="moreInformation"]:hover, button.uc-button-link:hover { color: #1a1a1a !important; }',
    'footer { width: 100% !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; }',
    '#uc-main-dialog.first .buttons-row, #uc-main-dialog.first .buttons {',
    '  display: flex !important; flex-direction: row !important; gap: 18px !important;',
    '  align-items: stretch !important; justify-content: space-between !important; width: 100% !important; margin: 0 !important; padding-bottom: 32px !important;',
    '}',
    '@media (max-width: 600px) { #uc-main-dialog.first .buttons-row, #uc-main-dialog.first .buttons { flex-direction: column !important; gap: 12px !important; padding-bottom: calc(24px + env(safe-area-inset-bottom)) !important; } }',
    '.buttons-row button, footer button {',
    '  font-size: 0 !important; color: transparent !important;',
    '  font-family: inherit !important; font-weight: 600 !important; cursor: pointer !important;',
    '  border-radius: 14px !important; height: 46px !important; padding: 0 24px !important;',
    '  transition: transform 0.2s ease, filter 0.2s ease, background 0.2s ease, border-color 0.2s ease !important;',
    '  display: flex !important; align-items: center !important; justify-content: center !important;',
    '  box-sizing: border-box !important; border: 1px solid transparent !important;',
    '}',
    '#uc-main-dialog.first footer button { width: 100% !important; flex: 1 !important; }',
    '#accept, .accept, .uc-accept-button {',
    '  background: #1D4739 !important; border-color: #1D4739 !important; order: 3 !important; display: flex !important;',
    '}',
    '#accept::before, .accept::before, .uc-accept-button::before {',
    '  content: "Alles akzeptieren" !important; font-size: 14.5px !important; font-weight: 600 !important; color: #FFFFFF !important; white-space: nowrap !important;',
    '}',
    '#accept:hover, .accept:hover, .uc-accept-button:hover { filter: brightness(0.92) !important; }',
    '#deny, .deny, .uc-deny-button {',
    '  background: #F0F0F0 !important; border-color: #F0F0F0 !important; order: 2 !important; display: flex !important;',
    '}',
    '#deny::before, .deny::before, .uc-deny-button::before {',
    '  content: "Nur technisch Erforderliches" !important; font-size: 14px !important; font-weight: 500 !important; color: #1a1a1a !important; white-space: nowrap !important;',
    '}',
    '#deny:hover, .deny:hover, .uc-deny-button:hover { background: #E5E5E5 !important; border-color: #E5E5E5 !important; }',
    '.sections-header, #uc-tabs-header, [role="tablist"], .tab-header {',
    '  display: flex !important; justify-content: flex-start !important; gap: 40px !important; margin: 0 32px 24px !important; border-bottom: 2px solid #EAEAEA !important;',
    '}',
    '@media (max-width: 600px) { .sections-header, #uc-tabs-header, [role="tablist"], .tab-header { margin: 0 24px 24px !important; } }',
    '[role="tab"], .tab {',
    '  background: transparent !important; border: none !important; font-size: 16px !important; font-weight: 600 !important; color: #888888 !important; padding: 12px 0 10px !important; cursor: pointer !important; position: relative !important;',
    '}',
    '[role="tab"][aria-selected="true"], .tab.active, [aria-selected="true"] {',
    '  color: #1a1a1a !important;',
    '}',
    '[role="tab"][aria-selected="true"]::after, .tab.active::after, [aria-selected="true"]::after {',
    '  content: "" !important; position: absolute !important; bottom: -2px !important; left: 0 !important; right: 0 !important; height: 3px !important; background: #1D4739 !important; border-radius: 3px 3px 0 0 !important;',
    '}',
    '[role="tab"]:nth-child(n+3), .tab:nth-child(n+3) { display: none !important; }',
    '.categories-section, .toggles-section { padding-bottom: 40px !important; }',
    '.category-row, .toggle-wrapper, [data-testid="uc-category-row"], div[role="group"] > div {',
    '  background: #F8F8F8 !important; border-radius: 14px !important; padding: 20px 24px !important; margin-bottom: 16px !important; border: 1px solid transparent !important;',
    '}',
    'div[role="group"] > div { border-bottom: none !important; }',
    '.toggle-name, .uc-category-name { font-size: 15px !important; font-weight: 700 !important; color: #1a1a1a !important; margin-bottom: 4px !important; }',
    '.toggle-description, .uc-category-description { font-size: 13.5px !important; color: #6a6a6a !important; line-height: 1.5 !important; }',
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
    '  box-shadow: inset 0 1px 3px rgba(29,71,57,0.4) !important;',
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
    '#uc-main-dialog:not(.first) footer button { flex: 1 !important; height: 46px !important; width: auto !important; }',
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
    '#uc-main-dialog.cmp::-webkit-scrollbar { width: 4px; }',
    '#uc-main-dialog.cmp::-webkit-scrollbar-track { background: transparent; }',
    '#uc-main-dialog.cmp::-webkit-scrollbar-thumb { background: #E0E0E0; border-radius: 4px; }',
    '@media (max-width: 768px) {',
    '  #uc-main-dialog:not(.first) footer { padding: 20px 24px calc(24px + env(safe-area-inset-bottom)) !important; }',
    '  #uc-main-dialog:not(.first) .buttons-row { flex-direction: column !important; gap: 12px !important; }',
    '  #uc-main-dialog:not(.first) footer button { width: 100% !important; flex: none !important; }',
    '}',
    '#uc-privacy-button, #uc-corner-modal-button, [data-testid="uc-privacy-button"], .uc-privacy-button {',
    '  display: none !important;',
    '}'
  ].join('\n');

  var UC_HTML = '<div id="karinex-thalia-text" style="text-align: left; margin-bottom: 24px;">' +
                '<div style="font-size: 20px; font-weight: 700; margin: 0 0 20px; color: #1a1a1a; letter-spacing: -0.01em;">Helfen Sie uns, Ihr KARINEX Erlebnis zu verbessern!</div>' +
                '<p style="font-size: 14px; line-height: 1.6; color: #4a4a4a; margin: 0 0 16px;">Wir moechten Ihr Shopping-Erlebnis einzigartig und persoenlich machen. Dafuer verwenden wir und unsere Partner (auch Dritte) Cookies, Pixel und aehnliche Dienste ("Services"), die Informationen und Daten speichern und/oder von Ihrem Endgeraet abrufen.</p>' +
                '<p style="font-size: 14px; line-height: 1.6; color: #4a4a4a; margin: 0 0 16px;">Diese Informationen und Daten werden von uns z.B. zur Identifikation auf Drittseiten, zur Personalisierung, Marktforschung, Analyse und zur Produktentwicklung genutzt und koennen auch im EU-Ausland (Drittstaaten) verarbeitet werden.</p>' +
                '<p style="font-size: 14px; line-height: 1.6; color: #4a4a4a; margin: 0 0 16px;"><strong>Sie haben die Wahl:</strong> Durch einen Klick auf "Alles akzeptieren" stimmen Sie der Verwendung und Verarbeitung insgesamt zu.</p>' +
                '<p style="font-size: 14px; line-height: 1.6; color: #4a4a4a; margin: 0 0 16px;">Lehnen Sie die Verwendung von Cookies ab, sind nur die Dienste aktiv, die wir brauchen, um unsere Website fuer Sie sicher, zuverlaessig und leistungsstark zu halten.</p>' +
                '<p style="font-size: 14px; line-height: 1.6; color: #4a4a4a; margin: 0;"><strong>Wichtig:</strong> Diese Auswahl koennen Sie jederzeit und mit Wirkung fuer die Zukunft widerrufen. Weitere Details finden Sie in unseren Datenschutzhinweisen.</p>' +
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
