// Dynamischer Counter - Zeigt echte Veränderungen
class DynamischerCounter {
  constructor() {
    this.articleId = this.getArticleId();
    this.deviceId = this.getDeviceId();
    this.init();
  }
  
  init() {
    if (!this.articleId) return;
    
    
    // Sofort aktuelle Zahl anzeigen
    this.zeigeAktuelleZahl();
    
    // Prüfen ob dieses Gerät diesen Artikel schon gesehen hat
    if (!this.deviceHatSchonGesehen()) {
      // Nach 1 Sekunde als gesehen markieren und erhöhen
      setTimeout(() => {
        this.markiereAlsGesehen();
        this.erhoeheCounter();
      }, 1000);
    }
    
    // Alle 5 Sekunden prüfen ob sich was geändert hat
    setInterval(() => this.zeigeAktuelleZahl(), 5000);
  }
  
  getArticleId() {
    const path = window.location.pathname;
    if (path.includes('/blogs/') && path.includes('/')) {
      return path.split('/').pop();
    }
    return null;
  }
  
  getDeviceId() {
    // Einfache Device ID basierend auf Browser infos
    const id = [
      navigator.userAgent.slice(0, 50),
      screen.width + 'x' + screen.height,
      navigator.language
    ].join('|');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return 'dev_' + Math.abs(hash).toString(36).substring(0, 8);
  }
  
  deviceHatSchonGesehen() {
    const key = `view_${this.deviceId}_${this.articleId}`;
    return localStorage.getItem(key) === 'true';
  }
  
  markiereAlsGesehen() {
    const key = `view_${this.deviceId}_${this.articleId}`;
    localStorage.setItem(key, 'true');
    localStorage.setItem(key + '_time', new Date().toISOString());
  }
  
  erhoeheCounter() {
    const countKey = `count_${this.articleId}`;
    let count = parseInt(localStorage.getItem(countKey) || '0');
    count += 1;
    localStorage.setItem(countKey, count.toString());
    
    
    // Sofort aktualisieren mit Animation
    this.zeigeAktuelleZahl(true);
  }
  
  zeigeAktuelleZahl(mitAnimation = false) {
    const countKey = `count_${this.articleId}`;
    let count = parseInt(localStorage.getItem(countKey) || '0');
    
    // Wenn noch keine Views, bei 1 beginnen
    if (count === 0) {
      count = 1;
      localStorage.setItem(countKey, '1');
    }
    
    const elements = document.querySelectorAll('.dynamische-count');
    elements.forEach(el => {
      const alteZahl = parseInt(el.textContent) || 0;
      el.textContent = count;
      
      // Animation bei echter Veränderung
      if (mitAnimation && count > alteZahl) {
        el.style.color = '#28a745';
        el.style.transform = 'scale(1.3)';
        el.style.fontWeight = '800';
        
        setTimeout(() => {
          el.style.color = '#333';
          el.style.transform = 'scale(1)';
          el.style.fontWeight = '600';
        }, 800);
      }
    });
    
    // Debug Info in Console
  }
  
  // Statistik anzeigen
  zeigeStats() {
    const countKey = `count_${this.articleId}`;
    const count = localStorage.getItem(countKey) || '0';
    
  }
}

// Einfache Styles mit Animation
const dynamischeStyles = `
<style>
.dynamische-count {
  font-weight: 600;
  color: #333;
  transition: all 0.3s ease;
  display: inline-block;
}

.dynamische-count:hover {
  color: #e30613;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', dynamischeStyles);

// Automatisch starten
new DynamischerCounter();

// Global verfügbar für Tests
window.zeigeCounterStats = function() {
  const counter = new DynamischerCounter();
  counter.zeigeStats();
};
