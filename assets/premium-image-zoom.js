/**
 * Premium Product Image Zoom — Karinex
 * Luxury inner-drift zoom effect (Net-a-Porter / SSENSE style)
 * Desktop: hover to zoom + pan, click opens lightbox
 * Mobile: untouched (handled by drag-zoom-wrapper.js)
 */
(function () {
  'use strict';

  const ZOOM_SCALE = 2.5;
  const TRANSITION_IN = 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease';
  const TRANSITION_OUT = 'transform 0.45s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease';
  const MOBILE_BREAKPOINT = 990;

  let container = null;
  let mainImage = null;
  let zoomLayer = null;
  let isZoomed = false;
  let hiResSrc = '';
  let hiResLoaded = false;
  let rafId = null;

  function isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  function getActiveThumb() {
    return document.querySelector('.thumb-item.active');
  }

  function getHiResSrc() {
    const thumb = getActiveThumb();
    if (thumb) {
      return thumb.getAttribute('data-zoom') || thumb.getAttribute('data-src') || '';
    }
    return '';
  }

  function createZoomLayer() {
    if (zoomLayer) return;
    zoomLayer = document.createElement('div');
    zoomLayer.className = 'kx-zoom-layer';
    zoomLayer.setAttribute('aria-hidden', 'true');
    container.appendChild(zoomLayer);
  }

  function preloadHiRes(src, cb) {
    if (!src) return;
    const img = new Image();
    img.onload = function () {
      hiResLoaded = true;
      if (cb) cb(src);
    };
    img.src = src;
  }

  function activate(e) {
    if (isMobile()) return;
    // Only for images, not videos
    if (mainImage && mainImage.style.display === 'none') return;

    hiResSrc = getHiResSrc();
    if (!hiResSrc) return;

    createZoomLayer();

    if (hiResLoaded && zoomLayer.style.backgroundImage) {
      showZoom(e);
    } else {
      // Preload then show
      preloadHiRes(hiResSrc, function (src) {
        zoomLayer.style.backgroundImage = 'url(' + src + ')';
        zoomLayer.style.backgroundSize = (ZOOM_SCALE * 100) + '%';
        zoomLayer.style.backgroundRepeat = 'no-repeat';
        showZoom(e);
      });
    }
  }

  function showZoom(e) {
    if (!zoomLayer || !container) return;
    isZoomed = true;
    zoomLayer.style.transition = TRANSITION_IN;
    zoomLayer.style.opacity = '1';
    zoomLayer.style.pointerEvents = 'none';
    container.classList.add('kx-zoom-active');

    // Position immediately
    updatePosition(e);
  }

  function updatePosition(e) {
    if (!isZoomed || !zoomLayer || !container) return;

    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp
    const cx = Math.max(0, Math.min(100, x));
    const cy = Math.max(0, Math.min(100, y));

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      if (zoomLayer) {
        zoomLayer.style.backgroundPosition = cx + '% ' + cy + '%';
      }
    });
  }

  function deactivate() {
    if (!isZoomed) return;
    isZoomed = false;

    if (zoomLayer) {
      zoomLayer.style.transition = TRANSITION_OUT;
      zoomLayer.style.opacity = '0';
    }
    if (container) {
      container.classList.remove('kx-zoom-active');
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function onThumbChange() {
    // Reset zoom when image changes
    hiResLoaded = false;
    if (zoomLayer) {
      zoomLayer.style.backgroundImage = '';
      zoomLayer.style.opacity = '0';
    }
    isZoomed = false;
    if (container) container.classList.remove('kx-zoom-active');

    // Preload next hi-res
    const src = getHiResSrc();
    if (src) {
      hiResSrc = src;
      preloadHiRes(src, function (loadedSrc) {
        if (zoomLayer) {
          zoomLayer.style.backgroundImage = 'url(' + loadedSrc + ')';
          zoomLayer.style.backgroundSize = (ZOOM_SCALE * 100) + '%';
          zoomLayer.style.backgroundRepeat = 'no-repeat';
        }
      });
    }
  }

  function init() {
    container = document.querySelector('.main-image-container');
    mainImage = document.querySelector('.main-image');
    if (!container || !mainImage) return;
    if (isMobile()) return;

    // Event listeners
    container.addEventListener('mouseenter', activate);
    container.addEventListener('mousemove', updatePosition);
    container.addEventListener('mouseleave', deactivate);

    // Observe thumbnail clicks for image changes
    document.querySelectorAll('.thumb-item').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        setTimeout(onThumbChange, 50);
      });
    });

    // Listen for variant changes
    document.addEventListener('variant:update', function () {
      setTimeout(onThumbChange, 100);
    });

    // Preload first hi-res
    var firstSrc = getHiResSrc();
    if (firstSrc) {
      hiResSrc = firstSrc;
      preloadHiRes(firstSrc, function (src) {
        createZoomLayer();
        zoomLayer.style.backgroundImage = 'url(' + src + ')';
        zoomLayer.style.backgroundSize = (ZOOM_SCALE * 100) + '%';
        zoomLayer.style.backgroundRepeat = 'no-repeat';
      });
    }

    // Handle resize: destroy zoom on mobile
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (isMobile()) {
          deactivate();
          if (zoomLayer) {
            zoomLayer.remove();
            zoomLayer = null;
          }
        }
      }, 200);
    });
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
