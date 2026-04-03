/**
 * ============================================================
 * LEGO Accordion — Intelligent Content Parser & Accordion Engine
 * ============================================================
 * Parst die Produktbeschreibung und ordnet Inhalte automatisch
 * den richtigen LEGO-Accordion-Bereichen zu.
 *
 * Erkannte Sektionen (in Reihenfolge):
 *   1. Artikelbeschreibung
 *   2. Produktdetails
 *   3. Spielmerkmale
 *   4. Altersempfehlung
 *   5. Maße & Größe
 *   6. Material
 *   7. Lieferumfang
 *   8. Sicherheitshinweise
 *   9. Pflegehinweise
 *  10. Herstellerinformationen
 * ============================================================
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════
     1. Konstanten & Section-Definitionen
     ═══════════════════════════════════════════════ */

  var SECTIONS = [
    {
      id: 'artikelbeschreibung',
      title: 'Artikelbeschreibung',
      icon: '📦',
      keywords: ['artikelbeschreibung', 'beschreibung', 'produktbeschreibung', 'description']
    },
    {
      id: 'produktdetails',
      title: 'Produktdetails',
      icon: '🧩',
      keywords: ['produktdetails', 'details', 'technische details', 'zusatzinformationen', 'zusatzinformation', 'technische spezifikationen', 'spezifikationen', 'technische daten']
    },
    {
      id: 'spielmerkmale',
      title: 'Spielmerkmale',
      icon: '🎮',
      keywords: ['spielmerkmale', 'spielfunktionen', 'features', 'merkmale', 'besonderheiten', 'highlights', 'auf einen blick']
    },
    {
      id: 'altersempfehlung',
      title: 'Altersempfehlung',
      icon: '👶',
      keywords: ['altersempfehlung', 'altersangabe', 'empfohlenes alter', 'alter']
    },
    {
      id: 'masse',
      title: 'Maße & Größe',
      icon: '📐',
      keywords: ['maße & größe', 'masse & groesse', 'maße', 'größe', 'abmessungen', 'dimensionen', 'masse']
    },
    {
      id: 'material',
      title: 'Material',
      icon: '🔧',
      keywords: ['material', 'werkstoffe', 'materialien']
    },
    {
      id: 'lieferumfang',
      title: 'Lieferumfang',
      icon: '📋',
      keywords: ['lieferumfang', 'inhalt', 'packungsinhalt', 'im set enthalten', 'enthält']
    },
    {
      id: 'sicherheitshinweise',
      title: 'Sicherheitshinweise',
      icon: '⚠️',
      keywords: ['sicherheitshinweise', 'sicherheit', 'warnhinweise', 'warnungen', 'achtung']
    },
    {
      id: 'pflegehinweise',
      title: 'Pflegehinweise',
      icon: '🧽',
      keywords: ['pflegehinweise', 'pflege', 'reinigung', 'reinigungshinweise']
    },
    {
      id: 'herstellerinformationen',
      title: 'Herstellerinformationen',
      icon: '🏭',
      keywords: ['herstellerinformationen', 'hersteller', 'herstellerinfo', 'manufacturer']
    }
  ];

  /* Map: spec label → welche Section bekommt diesen Eintrag */
  var SPEC_ROUTING = {
    'marke':             'herstellerinformationen',
    'hersteller':        'herstellerinformationen',
    'modellnummer':      'herstellerinformationen',
    'referenz':          'herstellerinformationen',
    'ean':               'herstellerinformationen',
    'artikelnummer':     'herstellerinformationen',

    'themenwelt':        'produktdetails',
    'lizenz':            'produktdetails',
    'serie':             'produktdetails',
    'kollektion':        'produktdetails',
    'produktlinie':      'produktdetails',
    'modelltyp':         'produktdetails',
    'antrieb':           'produktdetails',
    'anzahl teile':      'produktdetails',
    'teileanzahl':       'produktdetails',
    'teilezahl':         'produktdetails',
    'farbe':             'produktdetails',
    'typ':               'produktdetails',
    'stil':              'produktdetails',
    'lego builder app':  'produktdetails',

    'altersempfehlung':  'altersempfehlung',
    'empfohlenes alter': 'altersempfehlung',
    'alter':             'altersempfehlung',
    'zielgruppe':        'altersempfehlung',
    'schwierigkeitsgrad':'altersempfehlung',

    'maße modell':       'masse',
    'maße':              'masse',
    'abmessungen':       'masse',
    'verpackungsmaße':   'masse',
    'gewicht':           'masse',
    'höhe':              'masse',
    'breite':            'masse',
    'tiefe':             'masse',
    'länge':             'masse',
    'durchmesser':       'masse',
    'größe':             'masse',

    'material':          'material',
    'werkstoff':         'material',

    'lieferumfang':      'lieferumfang',
    'inhalt':            'lieferumfang',

    'sicherheitshinweis':'sicherheitshinweise',
    'warnhinweis':       'sicherheitshinweise',

    'pflege':            'pflegehinweise',
    'reinigung':         'pflegehinweise'
  };

  /* ═══════════════════════════════════════════════
     2. HTML → Lines Parser
     ═══════════════════════════════════════════════ */
  function htmlToLines(html) {
    var text = html
      .replace(/<\/p>/gi,      '\n')
      .replace(/<\/div>/gi,    '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li>/gi,     '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<\/?(strong|b|em|i|u|s|span)[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '');

    text = text
      .replace(/&amp;/g,  '&')
      .replace(/&lt;/g,   '<')
      .replace(/&gt;/g,   '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#39;/g,  "'")
      .replace(/&quot;/g, '"')
      .replace(/&auml;/g, 'ä').replace(/&Auml;/g, 'Ä')
      .replace(/&ouml;/g, 'ö').replace(/&Ouml;/g, 'Ö')
      .replace(/&uuml;/g, 'ü').replace(/&Uuml;/g, 'Ü')
      .replace(/&szlig;/g,'ß');

    return text.split('\n');
  }

  /* ═══════════════════════════════════════════════
     3. Sektion-Erkennung: Prüft ob eine Zeile ein
        Sektions-Header ist
     ═══════════════════════════════════════════════ */
  function matchSectionHeader(line) {
    var lower = line.trim().toLowerCase();
    if (!lower) return null;

    for (var i = 0; i < SECTIONS.length; i++) {
      var sec = SECTIONS[i];
      for (var k = 0; k < sec.keywords.length; k++) {
        if (lower === sec.keywords[k]) {
          return sec.id;
        }
      }
    }
    return null;
  }

  /* ═══════════════════════════════════════════════
     4. Intelligent Parser — Analysiert die Beschreibung
        und verteilt Inhalte auf die Sektionen
     ═══════════════════════════════════════════════ */
  function parseDescription(html) {
    var lines = htmlToLines(html);
    var result = {};

    // Initialisiere alle Sektionen
    for (var i = 0; i < SECTIONS.length; i++) {
      result[SECTIONS[i].id] = { text: [], specs: [] };
    }

    var currentSection = null;  // null = Vor dem ersten Header
    var beforeFirstHeader = []; // Zeilen vor dem ersten Header = gehören zu "artikelbeschreibung"

    for (var j = 0; j < lines.length; j++) {
      var line = lines[j].trim();
      if (!line) continue;

      // Prüfe ob diese Zeile ein Sektions-Header ist
      var sectionId = matchSectionHeader(line);
      if (sectionId) {
        currentSection = sectionId;
        continue;
      }

      // Prüfe ob es eine "Key: Value"-Zeile ist
      var colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < 50) {
        var label = line.substring(0, colonIdx).trim();
        var value = line.substring(colonIdx + 1).trim();

        if (label && value && label.length < 50) {
          // Routing: Wohin gehört dieser Spec? 
          var labelLower = label.toLowerCase();
          var targetSection = SPEC_ROUTING[labelLower];

          if (targetSection && result[targetSection]) {
            result[targetSection].specs.push({ label: label, value: value });
          } else if (currentSection && result[currentSection]) {
            result[currentSection].specs.push({ label: label, value: value });
          } else {
            // Fallback: produktdetails
            result['produktdetails'].specs.push({ label: label, value: value });
          }
          continue;
        }
      }

      // Freitext — zuordnen
      if (currentSection && result[currentSection]) {
        result[currentSection].text.push(line);
      } else {
        beforeFirstHeader.push(line);
      }
    }

    // Alles vor dem ersten Header → Artikelbeschreibung
    if (beforeFirstHeader.length > 0) {
      // Nur echte Beschreibung (keine kurzen Produktnamen / Einzeiler)
      for (var m = 0; m < beforeFirstHeader.length; m++) {
        result['artikelbeschreibung'].text.push(beforeFirstHeader[m]);
      }
    }

    return result;
  }

  /* ═══════════════════════════════════════════════
     5. HTML Escape
     ═══════════════════════════════════════════════ */
  function esc(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  /* ═══════════════════════════════════════════════
     6. Render — Accordion-Inhalte einfügen
     ═══════════════════════════════════════════════ */
  function renderAccordionContent(container, data) {
    var items = container.querySelectorAll('.lego-acc-item');

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var sectionId = item.getAttribute('data-section');
      if (!sectionId || !data[sectionId]) continue;

      var sectionData = data[sectionId];
      var body = item.querySelector('.lego-acc-body');
      if (!body) continue;

      var hasContent = false;
      var html = '';

      // Freitext
      if (sectionData.text.length > 0) {
        html += '<div class="lego-acc-text">';
        for (var t = 0; t < sectionData.text.length; t++) {
          html += '<p>' + esc(sectionData.text[t]) + '</p>';
        }
        html += '</div>';
        hasContent = true;
      }

      // Spec rows
      if (sectionData.specs.length > 0) {
        html += '<ul class="lego-spec-list">';
        for (var s = 0; s < sectionData.specs.length; s++) {
          html += '<li class="lego-spec-row">' +
            '<span class="lego-spec-label">' + esc(sectionData.specs[s].label) + '</span>' +
            '<span class="lego-spec-value">' + esc(sectionData.specs[s].value) + '</span>' +
            '</li>';
        }
        html += '</ul>';
        hasContent = true;
      }

      if (hasContent) {
        body.innerHTML = html;
        item.style.display = '';  // Sichtbar machen
      } else {
        // Sektion ausblenden wenn leer
        item.style.display = 'none';
      }
    }
  }

  /* ═══════════════════════════════════════════════
     7. Render — Desktop: Description + Tabs + Specs
     ═══════════════════════════════════════════════ */

  /* ── Description box (expandable) ── */
  function renderDescriptionBox(container, data) {
    var textEl  = container.querySelector('#legoDescText');
    var wrapEl  = container.querySelector('.lego-dk-desc-wrap');
    var gradEl  = container.querySelector('#legoDescGradient');
    var btnEl   = container.querySelector('#legoMehrBtn');
    if (!textEl) return;

    var artikelData = data['artikelbeschreibung'] || { text: [], specs: [] };
    var spielData   = data['spielmerkmale']       || { text: [], specs: [] };

    // Combine all description text
    var lines = artikelData.text.concat(spielData.text);
    if (lines.length === 0) {
      var box = container.querySelector('.lego-dk-desc-box');
      if (box) box.style.display = 'none';
      return;
    }

    var html = '';
    for (var i = 0; i < lines.length; i++) {
      html += '<p>' + esc(lines[i]) + '</p>';
    }
    textEl.innerHTML = html;

    // Check if content exceeds max-height → show gradient & button
    requestAnimationFrame(function () {
      if (wrapEl && wrapEl.scrollHeight <= 160) {
        if (gradEl) gradEl.style.display = 'none';
        if (btnEl) btnEl.style.display = 'none';
      }
    });

    // Expand/collapse toggle
    if (btnEl) {
      btnEl.addEventListener('click', function () {
        var isExpanded = wrapEl.classList.contains('expanded');
        if (isExpanded) {
          wrapEl.classList.remove('expanded');
          if (gradEl) gradEl.classList.remove('hidden');
          btnEl.innerHTML = 'weiterlesen &raquo;';
        } else {
          wrapEl.classList.add('expanded');
          if (gradEl) gradEl.classList.add('hidden');
          btnEl.innerHTML = 'weniger anzeigen &laquo;';
        }
      });
    }
  }

  /* ── Specs grid: collect ALL specs into one flat grid ── */
  function renderSpecsGrid(container, data) {
    var grid = container.querySelector('.lego-dk-specs-grid');
    if (!grid) return;

    // Preferred order of spec sections
    var SECTION_ORDER = [
      'produktdetails', 'spielmerkmale', 'altersempfehlung',
      'masse', 'material', 'lieferumfang',
      'sicherheitshinweise', 'pflegehinweise', 'herstellerinformationen',
      'artikelbeschreibung'
    ];

    var allSpecs = [];
    for (var o = 0; o < SECTION_ORDER.length; o++) {
      var sid = SECTION_ORDER[o];
      if (data[sid] && data[sid].specs) {
        for (var s = 0; s < data[sid].specs.length; s++) {
          allSpecs.push(data[sid].specs[s]);
        }
      }
    }

    if (allSpecs.length === 0) {
      grid.innerHTML = '<div style="padding:20px;color:#888;">Keine Zusatzinformationen verfügbar.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < allSpecs.length; i++) {
      html += '<div class="lego-spec-cell">' +
        '<span class="lego-s-label">' + esc(allSpecs[i].label) + '</span>' +
        '<span class="lego-s-value">' + esc(allSpecs[i].value) + '</span>' +
        '</div>';
    }

    // Pad with empty cell if odd count (for clean 2-col grid)
    if (allSpecs.length % 2 !== 0) {
      html += '<div class="lego-spec-cell lego-empty-cell"></div>';
    }

    grid.innerHTML = html;
  }

  /* ── Tab switching ── */
  function initLegoTabs(container) {
    var btns = container.querySelectorAll('.lego-tab-btn');
    var panels = container.querySelectorAll('.lego-tab-content');

    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var tabId = this.getAttribute('data-tab');

        // Deactivate all
        for (var b = 0; b < btns.length; b++) {
          btns[b].classList.remove('active');
        }
        for (var p = 0; p < panels.length; p++) {
          panels[p].style.display = 'none';
        }

        // Activate clicked
        this.classList.add('active');
        var target = container.querySelector('#' + tabId);
        if (target) target.style.display = 'block';
      });
    }
  }

  /* ── Age Warning Badge ── */
  function renderAgeBadge(badgeEl, data) {
    if (!badgeEl) return;

    var ageData  = data['altersempfehlung']     || { text: [], specs: [] };
    var safeData = data['sicherheitshinweise']  || { text: [], specs: [] };

    /* Extract age from specs */
    var ageValue = '';
    for (var i = 0; i < ageData.specs.length; i++) {
      var l = ageData.specs[i].label.toLowerCase();
      if (l.indexOf('alter') !== -1 || l.indexOf('empfehlung') !== -1) {
        ageValue = ageData.specs[i].value;
        break;
      }
    }

    /* Extract safety warning from specs or text */
    var safetyText = '';
    for (var s = 0; s < safeData.specs.length; s++) {
      var sl = safeData.specs[s].label.toLowerCase();
      if (sl.indexOf('sicherheit') !== -1 || sl.indexOf('warnhinweis') !== -1) {
        safetyText = safeData.specs[s].value;
        break;
      }
    }
    if (!safetyText && safeData.text.length > 0) {
      safetyText = safeData.text[0];
    }

    /* Need at least one of them */
    if (!ageValue && !safetyText) return;

    /* Determine if "unter 3" warning applies */
    var isUnder3 = safetyText.toLowerCase().indexOf('unter 3') !== -1
                || safetyText.toLowerCase().indexOf('under 3') !== -1;

    /* Extract short age number for the circle (e.g. "7+" from "Ab 7 Jahren") */
    var ageShort = '';
    if (isUnder3) {
      ageShort = '0–3';
    } else if (ageValue) {
      var ageMatch = ageValue.match(/(\d+)/);
      if (ageMatch) ageShort = ageMatch[1] + '+';
    }

    /* Build — inline minimal: dot + text */
    var badgeVariant = isUnder3 ? 'lego-age-badge--warn' : 'lego-age-badge--info';
    badgeEl.classList.add(badgeVariant);

    var html = '<span class="lego-age-badge__dot"></span>';
    html += '<div class="lego-age-badge__content">';

    if (ageValue) {
      html += '<span class="lego-age-badge__age">' + esc(ageValue) + '</span>';
    }

    if (safetyText) {
      html += '<span class="lego-age-badge__text">· ' + esc(safetyText) + '</span>';
    }

    html += '</div>';

    badgeEl.innerHTML = html;
    badgeEl.style.display = 'flex';
  }

  /* ── Desktop main render ── */
  function renderDesktopContent(container, data) {
    renderDescriptionBox(container, data);
    renderAgeBadge(container.querySelector('#legoAgeBadge'), data);
    renderSpecsGrid(container, data);
    initLegoTabs(container);
  }

  /* ═══════════════════════════════════════════════
     8. Accordion Toggle
     ═══════════════════════════════════════════════ */
  function toggleLegoAccordion(header) {
    var item = header.closest('.lego-acc-item');
    if (!item) return;

    var container = item.parentElement;
    var allItems = container.querySelectorAll('.lego-acc-item');

    var isOpen = item.classList.contains('open');

    if (isOpen) {
      var content = item.querySelector('.lego-acc-content');
      if (!content) return;
      content.style.maxHeight = content.scrollHeight + 'px';
      requestAnimationFrame(function () {
        content.style.maxHeight = '0px';
      });
      item.classList.remove('open');
    } else {
      // Close all other items immediately
      for (var i = 0; i < allItems.length; i++) {
        if (allItems[i] !== item) {
          allItems[i].classList.remove('open');
          var otherContent = allItems[i].querySelector('.lego-acc-content');
          if (otherContent) {
            otherContent.style.maxHeight = '0px';
          }
        }
      }
      // Open clicked item
      var content = item.querySelector('.lego-acc-content');
      if (!content) return;
      item.classList.add('open');
      content.style.maxHeight = '0px';
      requestAnimationFrame(function () {
        content.style.maxHeight = content.scrollHeight + 'px';
        content.addEventListener('transitionend', function handler() {
          if (item.classList.contains('open')) {
            content.style.maxHeight = 'none';
          }
          content.removeEventListener('transitionend', handler);
        });
      });
    }
  }

  // Global verfügbar machen
  window.toggleLegoAccordion = toggleLegoAccordion;

  /* ═══════════════════════════════════════════════
     9. Init — DOM Ready
     ═══════════════════════════════════════════════ */
  function init() {
    var raw = window.PRODUCT_DESCRIPTION_ORIGINAL || '';
    if (!raw) return;

    var data = parseDescription(raw);

    // ── Mobile Accordion ──
    var mobileContainer = document.querySelector('.lego-accordion');
    if (mobileContainer) {
      renderAccordionContent(mobileContainer, data);
      renderAgeBadge(document.querySelector('#legoAgeBadgeMobile'), data);

      // Add click event to all headers
      var headers = mobileContainer.querySelectorAll('.lego-acc-header');
      for (var h = 0; h < headers.length; h++) {
        headers[h].addEventListener('click', function() {
          toggleLegoAccordion(this);
        });
      }

      // Open only 'Artikelbeschreibung' by default
      var items = mobileContainer.querySelectorAll('.lego-acc-item');
      for (var i = 0; i < items.length; i++) {
        var section = items[i].getAttribute('data-section');
        if (section === 'artikelbeschreibung') {
          var header = items[i].querySelector('.lego-acc-header');
          if (header) {
            toggleLegoAccordion(header);
          }
        } else {
          // Ensure all others are closed
          items[i].classList.remove('open');
          var content = items[i].querySelector('.lego-acc-content');
          if (content) content.style.maxHeight = '0px';
        }
      }
    }

    // ── Desktop Blocks ──
    var desktopContainer = document.querySelector('.lego-desktop');
    if (desktopContainer) {
      renderDesktopContent(desktopContainer, data);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 50);
  }

})();
