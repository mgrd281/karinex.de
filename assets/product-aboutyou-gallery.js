/**
 * Product Gallery - About You Style
 * Handles main image/video switching, thumbnail selection, and video playback
 */

class AYProductGallery {
  constructor(sectionId) {
    this.sectionId = sectionId || null;
    this.galleryEl = document.querySelector(`[data-section-id="${sectionId}"]`);
    
    if (!this.galleryEl) {
      console.warn('Gallery element not found for section:', sectionId);
      return;
    }

    this.mainDisplay = this.galleryEl.querySelector('.ay-gallery__main');
    this.thumbnails = document.querySelectorAll('.ay-gallery__thumbnail');
    this.allMedia = [...document.querySelectorAll('.ay-gallery__thumbnail')];
    
    this.currentIndex = 0;
    this.mediaCache = {};
    
    this.init();
  }

  init() {
    if (this.thumbnails.length === 0) return;

    // Add click listeners to thumbnails
    this.thumbnails.forEach((thumb, index) => {
      thumb.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectMedia(index);
      });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && this.isGalleryInView()) this.prevMedia();
      if (e.key === 'ArrowDown' && this.isGalleryInView()) this.nextMedia();
    });

    // Prevent default on play button
    document.querySelectorAll('.ay-gallery__play-btn-large').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playExternalVideo(btn);
      });
    });
  }

  isGalleryInView() {
    if (!this.mainDisplay) return false;
    const rect = this.mainDisplay.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  selectMedia(index) {
    if (index < 0 || index >= this.thumbnails.length) return;

    // Remove active class from all thumbnails
    this.thumbnails.forEach(t => t.classList.remove('is-active'));

    // Add active class to selected thumbnail
    const selectedThumb = this.thumbnails[index];
    selectedThumb.classList.add('is-active');

    // Smooth scroll thumbnail into view
    selectedThumb.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'nearest',
      inline: 'nearest'
    });

    this.currentIndex = index;
    this.updateMainDisplay(index);
  }

  updateMainDisplay(index) {
    const thumbnail = this.thumbnails[index];
    if (!thumbnail) return;

    // Get image from thumbnail
    const thumbImg = thumbnail.querySelector('img');
    if (!thumbImg) return;

    // Determine if it's a video
    const isVideo = thumbnail.querySelector('.ay-gallery__thumbnail-video');

    // Clear main display
    this.mainDisplay.innerHTML = '';

    if (isVideo) {
      this.displayVideoMain(thumbnail);
    } else {
      this.displayImageMain(thumbImg);
    }

    // Re-attach sold out overlay if needed
    if (this.galleryEl.classList.contains('is-soldout')) {
      const overlay = document.createElement('div');
      overlay.className = 'ay-gallery__soldout-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = `
        <span class="ay-gallery__soldout-sub">Leider ausverkauft</span>
        <strong class="ay-gallery__soldout-title">Ausverkauft</strong>
      `;
      this.mainDisplay.appendChild(overlay);
    }
  }

  displayImageMain(thumbImg) {
    // Create main image with larger size
    const mainImg = document.createElement('img');
    mainImg.id = 'ay-main-media';
    mainImg.className = 'ay-gallery__display-img';
    
    // Replace width parameter to get larger image
    let srcUrl = thumbImg.src;
    if (srcUrl.includes('width=100')) {
      srcUrl = srcUrl.replace('width=100', 'width=1000');
    }
    
    mainImg.src = srcUrl;
    mainImg.alt = thumbImg.alt || 'Product Image';
    mainImg.loading = 'lazy';
    mainImg.width = thumbImg.naturalWidth || 1000;
    mainImg.height = thumbImg.naturalHeight || 1000;
    
    this.mainDisplay.appendChild(mainImg);
  }

  displayVideoMain(thumbnail) {
    // Check if this is a native video or external video
    const isExternal = thumbnail.getAttribute('data-video-type') === 'external';
    
    if (isExternal) {
      this.displayExternalVideoMain(thumbnail);
    } else {
      this.displayNativeVideoMain(thumbnail);
    }
  }

  displayNativeVideoMain(thumbnail) {
    const videoContainer = document.createElement('div');
    videoContainer.className = 'ay-gallery__display-video ay-gallery__display-video--native';
    
    // Try to find video element in page and copy it
    // This is a simplified version - in production, would need to clone actual video
    videoContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: #000; color: #999;">
        <p>Video Player</p>
      </div>
    `;
    
    this.mainDisplay.appendChild(videoContainer);
  }

  displayExternalVideoMain(thumbnail) {
    const thumbImg = thumbnail.querySelector('img');
    const embedUrl = thumbnail.getAttribute('data-embed-url');
    
    const videoContainer = document.createElement('div');
    videoContainer.className = 'ay-gallery__display-video ay-gallery__display-video--external';
    videoContainer.id = 'ay-main-video-container';

    const posterImg = document.createElement('img');
    posterImg.id = 'ay-main-media';
    posterImg.className = 'ay-gallery__display-img';
    
    let srcUrl = thumbImg.src;
    if (srcUrl.includes('width=100')) {
      srcUrl = srcUrl.replace('width=100', 'width=1000');
    }
    
    posterImg.src = srcUrl;
    posterImg.alt = thumbImg.alt || 'Video Thumbnail';
    posterImg.loading = 'lazy';
    posterImg.setAttribute('data-type', 'external_video');
    posterImg.setAttribute('data-embed-url', embedUrl);

    const playBtn = document.createElement('button');
    playBtn.className = 'ay-gallery__play-btn-large';
    playBtn.setAttribute('aria-label', 'Video abspielen');
    playBtn.setAttribute('type', 'button');
    playBtn.innerHTML = '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="rgba(0,0,0,0.6)"/><polygon points="19,14 36,24 19,34" fill="#fff"/></svg>';
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.playExternalVideo(playBtn, embedUrl, posterImg);
    });

    videoContainer.appendChild(posterImg);
    videoContainer.appendChild(playBtn);
    this.mainDisplay.appendChild(videoContainer);
  }

  playExternalVideo(element, embedUrl, posterImg) {
    if (!embedUrl) return;
    
    // Replace poster with iframe
    const container = element.closest('.ay-gallery__display-video--external') || this.mainDisplay;
    
    const iframe = document.createElement('iframe');
    iframe.className = 'ay-gallery__inline-video';
    iframe.src = embedUrl;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.width = '100%';
    iframe.height = '100%';
    
    // Remove poster and play button
    if (posterImg) posterImg.style.display = 'none';
    if (element) element.style.display = 'none';
    
    container.appendChild(iframe);
  }

  nextMedia() {
    if (this.currentIndex < this.thumbnails.length - 1) {
      this.selectMedia(this.currentIndex + 1);
    }
  }

  prevMedia() {
    if (this.currentIndex > 0) {
      this.selectMedia(this.currentIndex - 1);
    }
  }
}

// Global function for play button (called from HTML onclick)
function ayPlayLargeVideo(button) {
  const container = button.closest('.ay-gallery__display-video--external');
  if (container && window.ayGallery) {
    const posterImg = container.querySelector('img');
    const embedUrl = posterImg ? posterImg.getAttribute('data-embed-url') : null;
    window.ayGallery.playExternalVideo(button, embedUrl, posterImg);
  }
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('[data-section-id]');
  if (section) {
    const sectionId = section.getAttribute('data-section-id');
    window.ayGallery = new AYProductGallery(sectionId);
  }
});

// Re-initialize if section is updated (Shopify theme editor)
if (typeof Shopify !== 'undefined' && Shopify.onSectionLoad) {
  Shopify.onSectionLoad(function(section) {
    if (section.name === 'product-aboutyou') {
      window.ayGallery = new AYProductGallery(section.id);
    }
  });
}
