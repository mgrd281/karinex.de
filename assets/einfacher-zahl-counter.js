// EINFACHER ZAHL COUNTER - Garantiert funktionierend

// Sofort ausführen - keine Wartezeit
(function() {
  
  // Element finden
  const element = document.querySelector('.funktionale-count');
  
  if (!element) {
    console.error('❌ KEIN ELEMENT GEFUNDEN!');
    return;
  }
  
  // Artikel ID aus URL holen
  const path = window.location.pathname;
  const artikelId = path.split('/').pop() || 'unknown';
  
  // Local Storage Keys
  const zahlKey = `zahl_${artikelId}`;
  const besuchtKey = `besucht_${artikelId}`;
  
  // Aktuelle Zahl laden
  let zahl = parseInt(localStorage.getItem(zahlKey) || '0');
  
  // Wenn 0, bei 1 beginnen
  if (zahl === 0) {
    zahl = 1;
    localStorage.setItem(zahlKey, '1');
  }
  
  // Sofort anzeigen
  element.textContent = zahl;
  element.style.color = '#e30613';
  element.style.fontWeight = '700';
  
  // Prüfen ob schon besucht
  const schonBesucht = localStorage.getItem(besuchtKey) === 'ja';
  
  if (!schonBesucht) {
    
    // Sofort erhöhen - keine Verzögerung
    zahl += 1;
    localStorage.setItem(zahlKey, zahl.toString());
    localStorage.setItem(besuchtKey, 'ja');
    
    
    // Mit Animation anzeigen
    element.textContent = zahl;
    element.style.color = '#28a745';
    element.style.transform = 'scale(1.5)';
    element.style.background = '#d4edda';
    element.style.padding = '4px 8px';
    element.style.borderRadius = '4px';
    
    setTimeout(() => {
      element.style.color = '#e30613';
      element.style.transform = 'scale(1)';
      element.style.background = 'transparent';
      element.style.padding = '0';
      element.style.borderRadius = '0';
    }, 2000);
    
  } else {
  }
  
  // Testfunktion
  window.erhoeheZahl = function() {
    zahl += 1;
    localStorage.setItem(zahlKey, zahl.toString());
    
    element.textContent = zahl;
    element.style.color = '#28a745';
    element.style.transform = 'scale(1.5)';
    
    setTimeout(() => {
      element.style.color = '#e30613';
      element.style.transform = 'scale(1)';
    }, 1000);
    
  };
  
  
})();

// Zweite Überprüfung nach 1 Sekunde
setTimeout(() => {
  const element = document.querySelector('.funktionale-count');
  if (element) {
  } else {
    console.error('❌ Element verschwunden!');
  }
}, 1000);
