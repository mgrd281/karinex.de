// TEST COUNTER - Super einfach und garantiert funktionierend
console.log('🚀 Test Counter wird geladen...');

// Warte bis DOM ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM ist ready');
  
  // Suche alle Elemente
  const elemente = document.querySelectorAll('.funktionale-count');
  console.log(`🎯 Gefunden: ${elemente.length} Elemente mit .funktionale-count`);
  
  if (elemente.length === 0) {
    console.error('❌ Keine Elemente gefunden! Überprüfe class name im HTML');
    return;
  }
  
  // Artikel ID bekommen
  const path = window.location.pathname;
  let artikelId = 'unknown';
  
  if (path.includes('/blogs/') && path.includes('/')) {
    const teile = path.split('/');
    artikelId = teile[teile.length - 1];
  }
  
  console.log(`📝 Artikel ID: ${artikelId}`);
  
  // Local Storage Key
  const key = `counter_${artikelId}`;
  
  // Aktuelle Zahl laden
  let zahl = parseInt(localStorage.getItem(key) || '0');
  console.log(`💾 Gespeicherte Zahl: ${zahl}`);
  
  // Wenn 0, bei 1 beginnen
  if (zahl === 0) {
    zahl = 1;
    localStorage.setItem(key, '1');
    console.log('🆕 Zahl auf 1 gesetzt');
  }
  
  // Zahl anzeigen
  elemente.forEach((el, index) => {
    console.log(`📍 Element ${index}: Setze auf ${zahl}`);
    el.textContent = zahl;
    el.style.color = '#e30613';
    el.style.fontWeight = '700';
  });
  
  // Prüfen ob neuer Besucher
  const visitKey = `visit_${artikelId}`;
  const hatBesucht = localStorage.getItem(visitKey) === 'yes';
  
  console.log(`👤 Hat schon besucht: ${hatBesucht}`);
  
  if (!hatBesucht) {
    console.log('🆕 Neuer Besucher! Warte 2 Sekunden...');
    
    setTimeout(() => {
      // Als besucht markieren
      localStorage.setItem(visitKey, 'yes');
      
      // Zahl erhöhen
      zahl += 1;
      localStorage.setItem(key, zahl.toString());
      
      console.log(`📈 Zahl erhöht auf: ${zahl}`);
      
      // Mit Animation anzeigen
      elemente.forEach((el, index) => {
        el.textContent = zahl;
        el.style.color = '#28a745';
        el.style.transform = 'scale(1.5)';
        el.style.background = '#d4edda';
        el.style.padding = '8px 12px';
        el.style.borderRadius = '8px';
        
        setTimeout(() => {
          el.style.color = '#e30613';
          el.style.transform = 'scale(1)';
          el.style.background = 'transparent';
          el.style.padding = '0';
          el.style.borderRadius = '0';
        }, 2000);
      });
      
      console.log('✅ Counter aktualisiert!');
      
    }, 2000);
  } else {
    console.log('👤 Bereits besucht - keine Änderung');
  }
  
  // Test Funktion
  window.testeCounter = function() {
    console.log('🧪 Manueller Test:');
    console.log('- Artikel:', artikelId);
    console.log('- Aktuell:', zahl);
    console.log('- Besucht:', hatBesucht);
    
    if (confirm('Counter manuell erhöhen?')) {
      zahl += 1;
      localStorage.setItem(key, zahl.toString());
      
      elemente.forEach(el => {
        el.textContent = zahl;
        el.style.color = '#28a745';
        el.style.transform = 'scale(1.5)';
        
        setTimeout(() => {
          el.style.color = '#e30613';
          el.style.transform = 'scale(1)';
        }, 1000);
      });
      
      console.log(`➡️ Manuell erhöht auf: ${zahl}`);
    }
  };
  
  console.log('✅ Test Counter komplett geladen!');
  console.log('🧪 Teste mit: testeCounter()');
});

// Sofort testen
console.log('⚡ Sofortiger Test...');
const sofortElemente = document.querySelectorAll('.funktionale-count');
console.log(`⚡ Sofort gefunden: ${sofortElemente.length} Elemente`);
