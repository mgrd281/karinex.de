// @ts-nocheck
/**
 * PDP Cart Counter — Firebase Realtime Database
 * Tracks how many people added each product to their cart.
 * Displays social-proof count on the mobile cart tag (e.g. "12 🛒 Warenkorb").
 * Uses the same Firebase project as the wishlist counter.
 */
(function () {
  'use strict';

  var DB = 'https://karinex-final-default-rtdb.europe-west1.firebasedatabase.app/cart-counts';
  var CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  var SESSION_KEY = 'kx_cart_added'; // tracks which handles were added this session

  // ── Cache ──────────────────────────────────────────────────────────────────
  function getCached(handle) {
    try {
      var raw = localStorage.getItem('kx_cart_cnt_' + handle);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (Date.now() - o.ts < CACHE_TTL) ? o.count : null;
    } catch (e) { return null; }
  }

  function setCache(handle, count) {
    try { localStorage.setItem('kx_cart_cnt_' + handle, JSON.stringify({ count: count, ts: Date.now() })); } catch (e) {}
  }

  // ── Session dedup — only count once per product per session ───────────────
  function hasAddedThisSession(handle) {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
      return s.indexOf(handle) !== -1;
    } catch (e) { return false; }
  }

  
  function unmarkAddedThisSession(handle) {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
      var idx = s.indexOf(handle);
      if (idx !== -1) {
        s.splice(idx, 1);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      }
    } catch (e) {}
  }

  function markAddedThisSession(handle) {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '[]');
      if (s.indexOf(handle) === -1) s.push(handle);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  // ── Firebase REST ──────────────────────────────────────────────────────────
  function fbUrl(handle) {
    return DB + '/' + encodeURIComponent(handle).replace(/%2F/g, '%252F') + '.json';
  }

  function fbRead(handle, cb) {
    fetch(fbUrl(handle))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { cb(d && typeof d.count === 'number' ? d.count : 0); })
      .catch(function () { cb(0); });
  }

  function fbWrite(handle, count, cb) {
    fetch(fbUrl(handle), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: count })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { cb(d && typeof d.count === 'number' ? d.count : count); })
      .catch(function () { cb(count); });
  }

  function increment(handle, cb) {
    fbRead(handle, function (current) {
      var next = current + 1;
      fbWrite(handle, next, function (saved) {
        setCache(handle, saved);
        cb(saved);
      });
    });
  }

  // ── Format number ──────────────────────────────────────────────────────────
  
  function decrement(handle, cb) {
    fbRead(handle, function (current) {
      var next = Math.max(0, current - 1);
      fbWrite(handle, next, function (saved) {
        setCache(handle, saved);
        cb(saved);
      });
    });
  }

  // ── Format number ──────────────────────────────────────────────────────────
  function fmt(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
    return String(n);
  }

  // ── Update cart button count display ──────────────────────────────────────
  function updateCartCount(btn, count) {
    if (!btn) return;
    var countEl = btn.querySelector('.cart-count-badge');
    if (count >= 1) {
      if (!countEl) {
        countEl = document.createElement('span');
        countEl.className = 'cart-count-badge';
        // Insert before the SVG
        var svg = btn.querySelector('svg');
        if (svg) btn.insertBefore(countEl, svg);
        else btn.prepend(countEl);
      }
      countEl.textContent = fmt(count);
      btn.classList.add('has-count');
    } else {
      if (countEl) countEl.remove();
      btn.classList.remove('has-count');
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    var cartBtn = document.querySelector('.mobile-cart-btn.floating-cart-icon');
    if (!cartBtn) return;

    var handle = (function () {
      // Extract from meta tag or body data attribute
      var el = document.querySelector('[data-product-handle]');
      if (el) return el.getAttribute('data-product-handle');
      // Fallback: parse from URL
      var m = window.location.pathname.match(/\/products\/([^/?#]+)/);
      return m ? m[1] : null;
    })();

    if (!handle) return;

    // Show cached count immediately
    var cached = getCached(handle);
    if (cached !== null && cached >= 1) {
      updateCartCount(cartBtn, cached);
    }

    // Fetch fresh count from Firebase
    fbRead(handle, function (count) {
      setCache(handle, count);
      updateCartCount(cartBtn, count);
    });

    // Listen for cart additions — both from floating button and main ATC form
    function onCartAdd() {
      if (hasAddedThisSession(handle)) return; // Don't double-count
      markAddedThisSession(handle);

      // Optimistic UI update
      var currentCached = getCached(handle) || 0;
      var optimistic = currentCached + 1;
      setCache(handle, optimistic);
      updateCartCount(cartBtn, optimistic);

      // Write to Firebase
      increment(handle, function (saved) {
        updateCartCount(cartBtn, saved);
      });
    }

    // Hook into floating cart button clicks
    cartBtn.addEventListener('click', onCartAdd, { capture: true });

    // Also hook into main ATC form submission for non-floating button adds
    var atcForm = document.getElementById('add-to-cart-form');
    if (atcForm) {
      atcForm.addEventListener('submit', function () {
        setTimeout(onCartAdd, 500); // slight delay to let Shopify process it
      });
    }

    // Also listen for Shopify theme ATC success events
    document.addEventListener('cart:add', onCartAdd);
    document.addEventListener('product:added-to-cart', onCartAdd);

    function onCartRemove() {
      if (!hasAddedThisSession(handle)) return; // Only decrement if we incremented it this session
      unmarkAddedThisSession(handle);

      var currentCached = getCached(handle) || 1;
      var optimistic = Math.max(0, currentCached - 1);
      setCache(handle, optimistic);
      updateCartCount(cartBtn, optimistic);

      decrement(handle, function (saved) {
        updateCartCount(cartBtn, saved);
      });
    }

    function checkCartState() {
      fetch(window.Shopify.routes.root + 'cart.js')
        .then(function(r) { return r.json(); })
        .then(function(cart) {
          var stillInCart = false;
          if (cart.items) {
            for (var i = 0; i < cart.items.length; i++) {
              if (cart.items[i].handle === handle) {
                stillInCart = true;
                break;
              }
            }
          }
          if (!stillInCart) onCartRemove();
        }).catch(function(){});
    }

    document.addEventListener('cart:refresh', checkCartState);
    document.addEventListener('cart:update', checkCartState);

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
