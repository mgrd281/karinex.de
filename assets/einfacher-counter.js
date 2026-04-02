// Einfacher Counter - Nur Zahl, nichts anderes
class EinfacherCounter {
  constructor() {
    this.articleId = this.getArticleId();
    this.init();
  }
  
  init() {
    if (!this.articleId) return;
    
    // Prüfen ob dieses Gerät diesen Artikel schon gesehen hat
    if (!this.schonGesehen()) {
      setTimeout(() => this.erhoehe(), 1000);
    }
    
    this.zeigeZahl();
  }
  
  getArticleId() {
    const path = window.location.pathname;
    if (path.includes('/blogs/') && path.includes('/')) {
      return path.split('/').pop();
    }
    return null;
  }
  
  schonGesehen() {
    const key = `seen_${this.articleId}`;
    return localStorage.getItem(key) === 'true';
  }
  
  markiereAlsGesehen() {
    const key = `seen_${this.articleId}`;
    localStorage.setItem(key, 'true');
  }
  
  erhoehe() {
    this.markiereAlsGesehen();
    
    const key = `count_${this.articleId}`;
    let count = parseInt(localStorage.getItem(key) || '0');
    count += 1;
    localStorage.setItem(key, count.toString());
    
    this.zeigeZahl();
  }
  
  zeigeZahl() {
    const key = `count_${this.articleId}`;
    let count = parseInt(localStorage.getItem(key) || '0');
    
    if (count === 0) {
      count = 1;
      localStorage.setItem(key, '1');
    }
    
    const elements = document.querySelectorAll('.einfache-count');
    elements.forEach(el => {
      el.textContent = count;
    });
  }
}

// Einfache Styles
const einfacheStyles = `
<style>
.einfache-count {
  font-weight: 600;
  color: #333;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', einfacheStyles);

// Starten
new EinfacherCounter();
