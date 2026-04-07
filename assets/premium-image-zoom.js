/**
 * Premium Product Image Zoom — Karinex v2
 * Luxury inner-drift zoom (Net-a-Porter / SSENSE style)
 * Desktop: hover to zoom + cursor-following pan
 * Mobile: untouched (drag-zoom-wrapper.js)
 */
(function () {
  'use strict';

  var ZOOM = 2.5;
  var BP = 990;

  var container, img, layer, active, raf;

  function mobile() { return window.innerWidth < BP; }

  function src() {
    var t = document.querySelector('.thumb-item.active');
    if (t) return (t.getAttribute('data-zoom') || t.getAttribute('data-src') || '').trim();
    // Fallback: use main image src
    if (img) return img.src || '';
    return '';
  }

  function ensure() {
    if (layer) return;
    layer = document.createElement('div');
    // Apply all critical styles via JS to avoid CSS cascade issues
    var s = layer.style;
    s.position = 'absolute';
    s.top = '0';
    s.left = '0';
    s.width = '100%';
    s.height = '100%';
    s.zIndex = '6';
    s.opacity = '0';
    s.pointerEvents = 'none';
    s.backgroundRepeat = 'no-repeat';
    s.backgroundSize = (ZOOM * 100) + '%';
    s.backgroundColor = '#f7f7f7';
    s.transition = 'opacity 0.35s cubic-bezier(0.25,0.1,0.25,1)';
    layer.setAttribute('aria-hidden', 'true');
    container.appendChild(layer);
  }

  function load(url, cb) {
    if (!url) return;
    var i = new Image();
    i.onload = function () { cb(url); };
    i.onerror = function () {
      // Fallback: try main image src
      if (img && url !== img.src) cb(img.src);
    };
    i.src = url;
  }

  function show(e) {
    if (!layer || !container) return;
    active = true;
    layer.style.opacity = '1';
    container.style.cursor = 'crosshair';
    if (img) img.style.opacity = '0';
    pos(e);
  }

  function pos(e) {
    if (!active || !layer || !container) return;
    var r = container.getBoundingClientRect();
    var x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    var y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      if (layer) layer.style.backgroundPosition = x + '% ' + y + '%';
    });
  }

  function hide() {
    active = false;
    if (layer) layer.style.opacity = '0';
    if (container) container.style.cursor = 'zoom-in';
    if (img) img.style.opacity = '1';
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function enter(e) {
    if (mobile()) return;
    // Only images — skip if video/iframe/model visible
    if (img && img.style.display === 'none') return;

    var url = src();
    if (!url) return;

    ensure();

    // Ensure container is positioned
    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    if (layer.getAttribute('data-src') === url) {
      // Already loaded
      show(e);
    } else {
      // Use current low-res immediately for instant feedback
      layer.style.backgroundImage = 'url(' + (img ? img.src : url) + ')';
      show(e);
      // Then upgrade to hi-res
      load(url, function (loaded) {
        layer.style.backgroundImage = 'url(' + loaded + ')';
        layer.setAttribute('data-src', loaded);
      });
    }
  }

  function move(e) {
    pos(e);
  }

  function leave() {
    hide();
  }

  function reset() {
    if (layer) {
      layer.removeAttribute('data-src');
      layer.style.backgroundImage = '';
      layer.style.opacity = '0';
    }
    active = false;
    if (img) img.style.opacity = '1';
  }

  function init() {
    container = document.querySelector('.main-image-container');
    img = document.querySelector('.main-image');

    if (!container || !img || mobile()) return;

    container.addEventListener('mouseenter', enter);
    container.addEventListener('mousemove', move);
    container.addEventListener('mouseleave', leave);

    // Thumb changes
    document.querySelectorAll('.thumb-item').forEach(function (t) {
      t.addEventListener('click', function () { setTimeout(reset, 60); });
    });
    document.addEventListener('variant:update', function () { setTimeout(reset, 120); });

    // Preload first image
    var first = src();
    if (first) {
      ensure();
      container.style.position = 'relative';
      container.style.overflow = 'hidden';
      load(first, function (u) {
        if (layer) {
          layer.style.backgroundImage = 'url(' + u + ')';
          layer.setAttribute('data-src', u);
        }
      });
    }

    // Cleanup on resize to mobile
    window.addEventListener('resize', function () {
      if (mobile()) { hide(); if (layer) { layer.remove(); layer = null; } }
    });
  }

  // Boot — wait for gallery script to finish
  function boot() {
    // Delay to ensure gallery script has run first
    setTimeout(init, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
