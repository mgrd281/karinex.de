// TTS Player - Text to Speech für Artikel

let isPlaying = false;
let currentUtterance = null;

function startTTS() {
  const btn = document.querySelector('.tts-play-btn');
  
  if (isPlaying) {
    // Stoppen
    stopTTS();
    return;
  }
  
  // Artikel Inhalt holen
  const articleContent = document.querySelector('.article-content') || 
                        document.querySelector('.article-body') || 
                        document.querySelector('main') ||
                        document.querySelector('[class*="content"]') ||
                        document.querySelector('article');
  
  if (!articleContent) {
    alert('Artikel Inhalt nicht gefunden');
    return;
  }
  
  // Text bereinigen
  let text = articleContent.textContent || articleContent.innerText;
  text = text.replace(/\s+/g, ' ').trim();
  
  if (!text || text.length < 50) {
    alert('Kein ausreichender Text gefunden');
    return;
  }
  
  
  // Deutsche Stimme finden
  const voices = speechSynthesis.getVoices();
  let germanVoice = voices.find(voice => 
    voice.lang.startsWith('de') && 
    (voice.name.includes('German') || voice.name.includes('Deutsch'))
  );
  
  // Fallback auf erste deutsche Stimme
  if (!germanVoice) {
    germanVoice = voices.find(voice => voice.lang.startsWith('de'));
  }
  
  // Fallback auf englische Stimme
  if (!germanVoice) {
    germanVoice = voices.find(voice => voice.lang.startsWith('en'));
  }
  
  
  // Utterance erstellen
  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.voice = germanVoice;
  currentUtterance.lang = germanVoice ? germanVoice.lang : 'de-DE';
  currentUtterance.rate = 0.9;  // Etwas langsamer
  currentUtterance.pitch = 1.0;
  currentUtterance.volume = 1.0;
  
  // Events
  currentUtterance.onstart = function() {
    isPlaying = true;
    btn.classList.add('playing');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
      </svg>
    `;
  };
  
  currentUtterance.onend = function() {
    isPlaying = false;
    btn.classList.remove('playing');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `;
  };
  
  currentUtterance.onerror = function(event) {
    stopTTS();
    alert('Fehler bei der Wiedergabe');
  };
  
  // Starten
  speechSynthesis.speak(currentUtterance);
}

function stopTTS() {
  speechSynthesis.cancel();
  isPlaying = false;
  
  const btn = document.querySelector('.tts-play-btn');
  if (btn) {
    btn.classList.remove('playing');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
    `;
  }
  
}

// Voices laden
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = function() {
  };
}

// Global verfügbar machen
window.startTTS = startTTS;
window.stopTTS = stopTTS;

