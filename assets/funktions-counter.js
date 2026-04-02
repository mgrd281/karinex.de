// FUNKTIONIERENDER Counter - Einfach und sicher
class FunktionsCounter {
  constructor() {
    this.articleId = this.getArticleId();
    this.init();
  }
  
  init() {
    if (!this.articleId) {
      console.log('❌ Keine Artikel ID gefunden');
      return;
    }
    
    console.log('🔢 Funktions Counter gestartet für:', this.articleId);
    
    // Sofort Zahl anzeigen
    this.ladeZeigeZahl();
    
    // Prüfen ob neuer Besucher
    if (!this.schonBesucht()) {
      setTimeout(() => {
        this.markiereBesucht();
        this.erhoeheUmEins();
      }, 1500);
    }
  }
  
  getArticleId() {
    const path = window.location.pathname;
    if (path.includes('/blogs/') && path.includes('/')) {
      const parts = path.split('/');
      return parts[parts.length - 1];
    }
    return null;
  }
  
  schonBesucht() {
    const key = `besucht_${this.articleId}`;
    return localStorage.getItem(key) === 'ja';
  }
  
  markiereBesucht() {
    const key = `besucht_${this.articleId}`;
    localStorage.setItem(key, 'ja');
    console.log('✅ Als besucht markiert:', key);
  }
  
  erhoeheUmEins() {
    const key = `zahl_${this.articleId}`;
    let zahl = parseInt(localStorage.getItem(key) || '0');
    zahl += 1;
    localStorage.setItem(key, zahl.toString());
    
    console.log('📈 Zahl erhöht auf:', zahl);
    
    // Sofort anzeigen mit Animation
    this.aktualisiereAnzeige(zahl, true);
  }
  
  ladeZeigeZahl() {
    const key = `zahl_${this.articleId}`;
    let zahl = parseInt(localStorage.getItem(key) || '0');
    
    // Wenn noch keine Zahl, bei 1 beginnen
    if (zahl === 0) {
      zahl = 1;
      localStorage.setItem(key, '1');
    }
    
    this.aktualisiereAnzeige(zahl, false);
  }
  
  aktualisiereAnzeige(zahl, mitAnimation) {
    const elemente = document.querySelectorAll('.funktionale-count');
    console.log(`🎯 Suche ${elemente.length} Elemente mit .funktionale-count`);
    
    elemente.forEach((el, index) => {
      const alteZahl = parseInt(el.textContent) || 0;
      el.textContent = zahl;
      
      console.log(`Element ${index}: ${alteZahl} → ${zahl}`);
      
      if (mitAnimation && zahl > alteZahl) {
        el.style.color = '#28a745';
        el.style.transform = 'scale(1.5)';
        el.style.fontWeight = '900';
        el.style.background = '#d4edda';
        el.style.padding = '4px 8px';
        el.style.borderRadius = '4px';
        
        setTimeout(() => {
          el.style.color = '#333';
          el.style.transform = 'scale(1)';
          el.style.fontWeight = '600';
          el.style.background = 'transparent';
          el.style.padding = '0';
          el.style.borderRadius = '0';
        }, 1000);
      }
    });
  }
  
  // Test Funktion
  testCounter() {
    console.log('🧪 Counter Test:');
    console.log('- Artikel ID:', this.articleId);
    console.log('- Schon besucht:', this.schonBesucht());
    
    const key = `zahl_${this.articleId}`;
    const zahl = localStorage.getItem(key) || '0';
    console.log('- Aktuelle Zahl:', zahl);
    
    // Manuelles erhöhen zum Testen
    if (confirm('Counter manuell erhöhen?')) {
      this.erhoeheUmEins();
    }
  }
}

// Styles
const styles = `
<style>
.funktionale-count {
  font-weight: 600;
  color: #333;
  transition: all 0.3s ease;
  display: inline-block;
}

.funktionale-count:hover {
  color: #e30613;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', styles);

// Starten
const counter = new FunktionsCounter();

// Global für Tests
window.testCounter = () => counter.testCounter();
window.zeigeCounterInfo = () => {
  console.log('📊 Counter Info:');
  console.log('- Artikel:', counter.articleId);
  console.log('- Besucht:', counter.schonBesucht());
  const key = `zahl_${counter.articleId}`;
  console.log('- Zahl:', localStorage.getItem(key) || '0');
};

console.log('🚀 Funktions Counter geladen! Test mit: testCounter()');
