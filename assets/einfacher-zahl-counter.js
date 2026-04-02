// EINFACHER ZAHL COUNTER - Garantiert funktionierend
console.log('🔢 EINFACHER COUNTER LÄDT...');

// Sofort ausführen - keine Wartezeit
(function() {
  console.log('🚀 Starte sofort...');
  
  // Element finden
  const element = document.querySelector('.funktionale-count');
  console.log('🎯 Element gefunden:', element);
  
  if (!element) {
    console.error('❌ KEIN ELEMENT GEFUNDEN!');
    return;
  }
  
  // Artikel ID aus URL holen
  const path = window.location.pathname;
  const artikelId = path.split('/').pop() || 'unknown';
  console.log('📝 Artikel ID:', artikelId);
  
  // Local Storage Keys
  const zahlKey = `zahl_${artikelId}`;
  const besuchtKey = `besucht_${artikelId}`;
  
  // Aktuelle Zahl laden
  let zahl = parseInt(localStorage.getItem(zahlKey) || '0');
  console.log('💾 Aktuelle Zahl:', zahl);
  
  // Wenn 0, bei 1 beginnen
  if (zahl === 0) {
    zahl = 1;
    localStorage.setItem(zahlKey, '1');
    console.log('🆕 Zahl auf 1 gesetzt');
  }
  
  // Sofort anzeigen
  element.textContent = zahl;
  element.style.color = '#e30613';
  element.style.fontWeight = '700';
  console.log('📌 Zahl angezeigt:', zahl);
  
  // Prüfen ob schon besucht
  const schonBesucht = localStorage.getItem(besuchtKey) === 'ja';
  console.log('👤 Schon besucht:', schonBesucht);
  
  if (!schonBesucht) {
    console.log('🆕 NEUER BESUCHER! Erhöhe Zahl...');
    
    // Sofort erhöhen - keine Verzögerung
    zahl += 1;
    localStorage.setItem(zahlKey, zahl.toString());
    localStorage.setItem(besuchtKey, 'ja');
    
    console.log('📈 Zahl erhöht auf:', zahl);
    
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
    
    console.log('✅ ERHÖHT UND ANGEZEIGT!');
  } else {
    console.log('👤 Bereits besucht - keine Änderung');
  }
  
  // Testfunktion
  window.erhoeheZahl = function() {
    console.log('🧪 MANUELLE ERHÖHUNG...');
    zahl += 1;
    localStorage.setItem(zahlKey, zahl.toString());
    
    element.textContent = zahl;
    element.style.color = '#28a745';
    element.style.transform = 'scale(1.5)';
    
    setTimeout(() => {
      element.style.color = '#e30613';
      element.style.transform = 'scale(1)';
    }, 1000);
    
    console.log('➡️ Manuell erhöht auf:', zahl);
  };
  
  console.log('✅ COUNTER FERTIG! Test mit: erhoeheZahl()');
  
})();

// Zweite Überprüfung nach 1 Sekunde
setTimeout(() => {
  console.log('🔄 ZWEITE PRÜFUNG...');
  const element = document.querySelector('.funktionale-count');
  if (element) {
    console.log('✅ Element existiert noch:', element.textContent);
  } else {
    console.error('❌ Element verschwunden!');
  }
}, 1000);
