// Hybrid Parser: Metafields + Zusatzinformation Description
(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', parseAndMergeSpecs);
  } else {
    parseAndMergeSpecs();
  }

  function parseAndMergeSpecs() {
    const specsGrid = document.querySelector('.watch-specs-grid');
    if (!specsGrid) return;

    // 1. Collect existing Metafields from DOM
    const metafieldsMap = new Map();
    const existingCells = specsGrid.querySelectorAll('.spec-cell');

    existingCells.forEach(cell => {
      const labelEl = cell.querySelector('.s-label');
      const valueEl = cell.querySelector('.s-value');
      if (!labelEl || !valueEl) return;

      const labelText = (labelEl.textContent || '').trim().replace(/\s*\?.*$/, '').replace(/\s*ⓘ.*$/, '').trim();
      const valueText = (valueEl.textContent || valueEl.innerHTML || '').trim();

      if (labelText && valueText && valueText !== '-') {
        metafieldsMap.set(labelText.toLowerCase(), {
          name: labelEl.innerHTML, // Keep original HTML (icons, etc.)
          value: valueEl.innerHTML,
          isHtml: true,
          source: 'metafield'
        });
      }
    });

    // Metafields loaded

    // 2. Parse Zusatzinformation from Description
    const descriptionMap = new Map();
    let fullDesc = window.PRODUCT_DESCRIPTION_ORIGINAL;

    if (fullDesc && fullDesc.includes('Zusatzinformation')) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = fullDesc;
      const textContent = (tempDiv.textContent || tempDiv.innerText).trim();

      const parts = textContent.split('Zusatzinformation');
      if (parts.length >= 2) {
        const specsSection = parts[1].trim();

        // Regex: accepts field names with numbers, dots, spaces
        const fieldRegex = /([\d\.\s]*[A-Za-zÄÖÜäöüß][\dA-Za-zÄÖÜäöüß\-\.\s]*?):\s*([^]*?)(?=\s*[\d\.\s]*[A-Za-zÄÖÜäöüß][\dA-Za-zÄÖÜäöüß\-\.\s]*?:|$)/gi;

        let match;
        while ((match = fieldRegex.exec(specsSection)) !== null) {
          const fieldName = match[1].trim();
          let fieldValue = match[2].trim();

          fieldValue = fieldValue.replace(/\s+$/, '').replace(/\.+$/, '');

          if (fieldName && fieldValue) {
            descriptionMap.set(fieldName.toLowerCase(), {
              originalName: fieldName,
              value: fieldValue,
              source: 'description'
            });
          }
        }
      }
    }

    // Description fields loaded

    // 3. Configuration
    const deleteValues = ['löschen', 'delete'];
    const emptyValues = ['leer', 'null', '-'];

    const knownFieldsOrder = [
      'marke', 'uhren stil', 'stil', 'zielgruppe', 'uhrwerk', 'kaliber',
      'gangreserve', 'wasserdichtigkeit', 'gehäuseform', 'gehäusedurchmesser',
      'gehäusehöhe', 'gehäuse material', 'material', 'zifferblatt',
      'uhrenglas', 'glas', 'armband', 'armbandfarbe', 'verschluss',
      'funktionen', 'garantie', 'referenz-nr', 'referenznr', 'swiss made',
      'modell', 'weitere details'
    ];

    // 4. Merge: Description overrides Metafields
    const finalFieldsMap = new Map();

    // Start with metafields
    for (const [key, data] of metafieldsMap.entries()) {
      finalFieldsMap.set(key, data);
    }

    // Override/add from description
    for (const [key, data] of descriptionMap.entries()) {
      const valueLower = data.value.toLowerCase().trim();

      // Check for delete command
      if (deleteValues.includes(valueLower)) {
        finalFieldsMap.delete(key); // Remove from final map
        continue;
      }

      let finalValue = data.value;
      let alignment = null;

      // Check for empty command
      if (emptyValues.includes(valueLower)) {
        finalValue = '';
      } else if (valueLower === 'r') {
        alignment = 'R';
        finalValue = '';
      } else if (valueLower === 'l') {
        alignment = 'L';
        finalValue = '';
      }

      finalFieldsMap.set(key, {
        name: data.originalName,
        value: finalValue,
        alignment: alignment,
        isHtml: false,
        source: 'description'
      });
    }

    // 5. Sort Fields (Garantie will be handled separately)
    let garantieField = null;
    const fieldsWithoutGarantie = [];

    for (const [key, data] of finalFieldsMap.entries()) {
      if (key === 'garantie') {
        garantieField = [key, data];
      } else {
        fieldsWithoutGarantie.push([key, data]);
      }
    }

    const sortedFields = fieldsWithoutGarantie.sort(([keyA], [keyB]) => {
      const indexA = knownFieldsOrder.indexOf(keyA);
      const indexB = knownFieldsOrder.indexOf(keyB);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });

    // 6. Rebuild Grid
    specsGrid.innerHTML = '';

    // Add all fields except Garantie
    sortedFields.forEach(([key, data], index) => {
      const cell = document.createElement('div');
      cell.className = 'spec-cell';

      // Add alignment class if specified
      if (data.alignment === 'R') {
        cell.classList.add('align-right');
      } else if (data.alignment === 'L') {
        cell.classList.add('align-left');
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 's-label';
      nameSpan.innerHTML = data.name;

      const valueSpan = document.createElement('span');
      valueSpan.className = 's-value';
      if (data.isHtml) {
        valueSpan.innerHTML = data.value;
      } else {
        valueSpan.textContent = data.value;
      }

      cell.appendChild(nameSpan);
      cell.appendChild(valueSpan);
      specsGrid.appendChild(cell);
    });

    // Add Garantie as last item, full width
    if (garantieField) {
      const [key, data] = garantieField;
      const cell = document.createElement('div');
      cell.className = 'spec-cell';
      cell.style.gridColumn = 'span 2'; // Always full width

      const nameSpan = document.createElement('span');
      nameSpan.className = 's-label';
      nameSpan.innerHTML = data.name;

      const valueSpan = document.createElement('span');
      valueSpan.className = 's-value';
      if (data.isHtml) {
        valueSpan.innerHTML = data.value;
      } else {
        valueSpan.textContent = data.value;
      }

      cell.appendChild(nameSpan);
      cell.appendChild(valueSpan);
      specsGrid.appendChild(cell);
    }

    const totalFields = sortedFields.length + (garantieField ? 1 : 0);
    // Grid built successfully
  }
})();
