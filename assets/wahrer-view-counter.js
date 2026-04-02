// Wahrer View Counter - Beginnt bei 1, +1 für jeden echten Besucher
class WahrerViewCounter {
  constructor() {
    this.storageKey = 'wahre_article_views';
    this.articleId = this.getArticleId();
    
    this.init();
  }
  
  init() {
    if (!this.articleId) return;
    
    console.log('👁️ Wahrer Counter für Artikel:', this.articleId);
    
    // Prüfen ob dieser Browser heute bereits gezählt wurde
    if (!this.heuteBereitsBesucht()) {
      // Nach 1 Sekunde zählen (echter Besucher)
      setTimeout(() => this.erhoeheCounter(), 1000);
    }
    
    // Aktuellen Stand anzeigen
    this.zeigeAktuelleViews();
  }
  
  getArticleId() {
    const path = window.location.pathname;
    if (path.includes('/blogs/') && path.includes('/')) {
      return path.split('/').pop();
    }
    return null;
  }
  
  heuteBereitsBesucht() {
    const heute = new Date().toISOString().split('T')[0];
    const key = `${this.articleId}_${heute}`;
    const besucht = localStorage.getItem(this.storageKey);
    
    if (!besucht) return false;
    
    const besucheArray = JSON.parse(besucht);
    return besucheArray.includes(key);
  }
  
  markiereAlsBesucht() {
    const heute = new Date().toISOString().split('T')[0];
    const key = `${this.articleId}_${heute}`;
    const besucht = localStorage.getItem(this.storageKey) || '[]';
    const array = JSON.parse(besucht);
    
    array.push(key);
    
    // Nur letzte 30 Einträge behalten
    if (array.length > 30) {
      array.splice(0, array.length - 30);
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(array));
  }
  
  erhoeheCounter() {
    // Als besucht markieren
    this.markiereAlsBesucht();
    
    // Counter um 1 erhöhen
    const key = `views_${this.articleId}`;
    let aktuelleViews = parseInt(localStorage.getItem(key) || '0');
    aktuelleViews += 1;
    
    // Speichern
    localStorage.setItem(key, aktuelleViews.toString());
    
    // Anzeige aktualisieren
    this.updateViewDisplay(aktuelleViews);
    
    console.log('✅ Counter erhöht auf:', aktuelleViews);
  }
  
  zeigeAktuelleViews() {
    const key = `views_${this.articleId}`;
    let views = parseInt(localStorage.getItem(key) || '0');
    
    // Wenn noch keine Views vorhanden, bei 1 beginnen
    if (views === 0) {
      views = 1;
      localStorage.setItem(key, '1');
    }
    
    this.updateViewDisplay(views);
  }
  
  updateViewDisplay(anzahl) {
    const counters = document.querySelectorAll('.wahrer-view-count');
    counters.forEach(counter => {
      counter.textContent = anzahl.toString();
      
      // Kleine Animation bei Update
      counter.style.transform = 'scale(1.2)';
      counter.style.color = '#e30613';
      
      setTimeout(() => {
        counter.style.transform = 'scale(1)';
        counter.style.color = '#333';
      }, 300);
    });
  }
}

// Einfache deutsche Styles
const einfacheStyles = `
<style>
.wahrer-view-counter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: #333;
  font-weight: 600;
}

.wahrer-view-count {
  font-weight: 700;
  color: #e30613;
  transition: all 0.3s ease;
}

.wahrer-view-counter::before {
  content: '👁️';
  font-size: 1rem;
}

.artikel-info-deutsch {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  font-size: 0.85rem;
  color: #666;
}

.deutsches-datum {
  opacity: 0.8;
}

/* Mobile */
@media (max-width: 768px) {
  .artikel-info-deutsch {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
`;

// Styles injizieren
document.head.insertAdjacentHTML('beforeend', einfacheStyles);

// Automatisch starten
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new WahrerViewCounter());
} else {
  new WahrerViewCounter();
}

// Global verfügbar
window.WahrerViewCounter = WahrerViewCounter;
