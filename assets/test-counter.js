// TEST COUNTER - Super einfach und garantiert funktionierend

// Warte bis DOM ready
document.addEventListener('DOMContentLoaded', function() {
  
  // Suche alle Elemente
  const elemente = document.querySelectorAll('.funktionale-count');
  
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
  
  
  // Local Storage Key
  const key = `counter_${artikelId}`;
  
  // Aktuelle Zahl laden
  let zahl = parseInt(localStorage.getItem(key) || '0');
  
  // Wenn 0, bei 1 beginnen
  if (zahl === 0) {
    zahl = 1;
    localStorage.setItem(key, '1');
  }
  
  // Zahl anzeigen
  elemente.forEach((el, index) => {
    el.textContent = zahl;
    el.style.color = '#e30613';
    el.style.fontWeight = '700';
  });
  
  // Prüfen ob neuer Besucher
  const visitKey = `visit_${artikelId}`;
  const hatBesucht = localStorage.getItem(visitKey) === 'yes';
  
  
  if (!hatBesucht) {
    
    setTimeout(() => {
      // Als besucht markieren
      localStorage.setItem(visitKey, 'yes');
      
      // Zahl erhöhen
      zahl += 1;
      localStorage.setItem(key, zahl.toString());
      
      
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
      
      
    }, 2000);
  } else {
  }
  
  // Test Funktion
  window.testeCounter = function() {
    
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
      
    }
  };
  
});

// Sofort testen
const sofortElemente = document.querySelectorAll('.funktionale-count');
