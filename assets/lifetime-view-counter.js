// Lifetime View Counter - 1 View pro Gerät/Browser LEBENSLANG
class LifetimeViewCounter {
  constructor() {
    this.storageKey = 'lifetime_device_views';
    this.articleId = this.getArticleId();
    this.deviceFingerprint = this.generateDeviceFingerprint();
    
    this.init();
  }
  
  init() {
    if (!this.articleId) return;
    
    console.log('🖥️ Lifetime Counter für Artikel:', this.articleId);
    console.log('🔍 Device Fingerprint:', this.deviceFingerprint);
    
    // Prüfen ob dieses Gerät diesen Artikel JE gesehen hat
    if (!this.deviceHatArtikelSchonGesehen()) {
      // Nach 2 Sekunden als gesehen markieren
      setTimeout(() => this.markiereAlsGesehen(), 2000);
    }
    
    // Aktuelle Views anzeigen
    this.zeigeLifetimeViews();
  }
  
  getArticleId() {
    const path = window.location.pathname;
    if (path.includes('/blogs/') && path.includes('/')) {
      return path.split('/').pop();
    }
    return null;
  }
  
  // Einzigartige Device/Browser ID generieren
  generateDeviceFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint 🖥️', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      !!window.sessionStorage,
      !!window.localStorage,
      canvas.toDataURL(),
      navigator.hardwareConcurrency || 'unknown',
      navigator.deviceMemory || 'unknown',
      navigator.platform
    ].join('|');
    
    // Einfacher Hash für konsistente ID
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return 'device_' + Math.abs(hash).toString(36);
  }
  
  deviceHatArtikelSchonGesehen() {
    const gesehen = localStorage.getItem(this.storageKey);
    if (!gesehen) return false;
    
    const gesehenObj = JSON.parse(gesehen);
    const deviceKey = `${this.deviceFingerprint}_${this.articleId}`;
    
    return gesehenObj[deviceKey] === true;
  }
  
  markiereAlsGesehen() {
    const gesehen = localStorage.getItem(this.storageKey) || '{}';
    const gesehenObj = JSON.parse(gesehen);
    
    const deviceKey = `${this.deviceFingerprint}_${this.articleId}`;
    gesehenObj[deviceKey] = true;
    gesehenObj[deviceKey + '_zeit'] = new Date().toISOString();
    
    localStorage.setItem(this.storageKey, JSON.stringify(gesehenObj));
    
    // View Counter erhöhen
    this.erhoeheLifetimeCounter();
    
    console.log('✅ Gerät als gesehen markiert:', deviceKey);
  }
  
  erhoeheLifetimeCounter() {
    const key = `lifetime_views_${this.articleId}`;
    let aktuelleViews = parseInt(localStorage.getItem(key) || '0');
    aktuelleViews += 1;
    
    localStorage.setItem(key, aktuelleViews.toString());
    
    this.updateViewDisplay(aktuelleViews);
    
    console.log('📈 Lifetime Counter erhöht auf:', aktuelleViews);
  }
  
  zeigeLifetimeViews() {
    const key = `lifetime_views_${this.articleId}`;
    let views = parseInt(localStorage.getItem(key) || '0');
    
    // Wenn noch keine Views, bei 1 beginnen (erster Besucher)
    if (views === 0) {
      views = 1;
      localStorage.setItem(key, '1');
    }
    
    this.updateViewDisplay(views);
  }
  
  updateViewDisplay(anzahl) {
    const counters = document.querySelectorAll('.lifetime-view-count');
    counters.forEach(counter => {
      counter.textContent = anzahl.toString();
      
      // Spezielle Animation für Lifetime Views
      counter.style.transform = 'scale(1.3)';
      counter.style.color = '#28a745';
      counter.style.fontWeight = '800';
      
      setTimeout(() => {
        counter.style.transform = 'scale(1)';
        counter.style.color = '#e30613';
        counter.style.fontWeight = '700';
      }, 500);
    });
    
    // Spezielle Nachricht für neue Geräte
    if (anzahl === 1) {
      this.zeigeErsteBesucherNachricht();
    }
  }
  
  zeigeErsteBesucherNachricht() {
    const nachricht = document.createElement('div');
    nachricht.innerHTML = '🎉 Sie sind der erste Besucher dieses Artikels!';
    nachricht.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      font-weight: 600;
      z-index: 10000;
      animation: slideInRight 0.5s ease;
      box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
    `;
    
    document.body.appendChild(nachricht);
    
    setTimeout(() => {
      nachricht.style.animation = 'slideOutRight 0.5s ease';
      setTimeout(() => document.body.removeChild(nachricht), 500);
    }, 4000);
  }
  
  // Statistik-Funktion
  getDeviceStats() {
    const gesehen = localStorage.getItem(this.storageKey) || '{}';
    const gesehenObj = JSON.parse(gesehen);
    
    const deviceKeys = Object.keys(gesehenObj).filter(key => key.includes(this.articleId));
    const uniqueDevices = new Set();
    
    deviceKeys.forEach(key => {
      const deviceId = key.split('_' + this.articleId)[0];
      uniqueDevices.add(deviceId);
    });
    
    return {
      artikel: this.articleId,
      uniqueDevices: uniqueDevices.size,
      currentDevice: this.deviceFingerprint,
      hatSchonGesehen: this.deviceHatArtikelSchonGesehen()
    };
  }
}

// Lifetime Styles
const lifetimeStyles = `
<style>
.lifetime-view-counter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: #333;
  font-weight: 600;
  padding: 6px 12px;
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border: 2px solid #dee2e6;
  border-radius: 25px;
  transition: all 0.3s ease;
}

.lifetime-view-counter:hover {
  border-color: #e30613;
  box-shadow: 0 2px 8px rgba(227, 6, 19, 0.1);
}

.lifetime-view-count {
  font-weight: 800;
  color: #e30613;
  font-size: 1.1rem;
  transition: all 0.3s ease;
}

.lifetime-view-counter::before {
  content: '🖥️';
  font-size: 1.1rem;
}

.lifetime-info {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 10px;
  font-size: 0.85rem;
  color: #666;
}

.lifetime-datum {
  opacity: 0.8;
}

.device-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #e3f2fd;
  color: #1976d2;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.device-indicator::before {
  content: '🔍';
}

@keyframes slideInRight {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutRight {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}

/* Mobile Optimierung */
@media (max-width: 768px) {
  .lifetime-view-counter {
    font-size: 0.85rem;
    padding: 4px 10px;
  }
  
  .lifetime-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
`;

// Styles injizieren
document.head.insertAdjacentHTML('beforeend', lifetimeStyles);

// Automatisch starten
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new LifetimeViewCounter());
} else {
  new LifetimeViewCounter();
}

// Global verfügbar machen
window.LifetimeViewCounter = LifetimeViewCounter;

// Debug-Funktion
window.showLifetimeStats = function() {
  const counter = new LifetimeViewCounter();
  console.log('📊 Lifetime Stats:', counter.getDeviceStats());
};
