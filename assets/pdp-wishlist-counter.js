// @ts-nocheck
/**
 * PDP Wishlist Counter — Firebase Realtime Database
 * - Firebase (Google) infrastructure = never blocked by ad-blockers
 * - Full CORS support for browser requests
 * - Free forever on Spark plan
 */
(function() {
  'use strict';

  var DB = 'https://karinex-wishlist-default-rtdb.europe-west1.firebasedatabase.app/wishlist';
  var CACHE_TTL = 3 * 60 * 1000; // 3 minutes

  // ── Cache ────────────────────────────────────────────────────────────────
  function getCached(handle) {
    try {
      var raw = localStorage.getItem('kx_cnt_' + handle);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (Date.now() - o.ts < CACHE_TTL) ? o.count : null;
    } catch(e) { return null; }
  }

  function setCache(handle, count) {
    try { localStorage.setItem('kx_cnt_' + handle, JSON.stringify({ count: count, ts: Date.now() })); } catch(e) {}
  }

  // ── Wishlist state (per device - integrated with theme wishlist) ────────
  function getWishlistArray() {
    try {
      var data = localStorage.getItem('wishlist');
      return data ? JSON.parse(data) : [];
    } catch(e) { return []; }
  }

  function isWishlisted(h) { 
    return getWishlistArray().indexOf(h) !== -1;
  }

  function setWishlisted(h, v) {
    var arr = getWishlistArray();
    var idx = arr.indexOf(h);
    if (v && idx === -1) arr.push(h);
    else if (!v && idx !== -1) arr.splice(idx, 1);
    
    try { 
      localStorage.setItem('wishlist', JSON.stringify(arr)); 
      window.dispatchEvent(new CustomEvent('wishlist:update', {
        detail: { productHandle: h, isSaved: v }
      }));
      window.dispatchEvent(new Event('wishlist-updated'));
    } catch(e) {}
  }

  // ── UI ───────────────────────────────────────────────────────────────────
  function fmt(n) { return n >= 1000 ? (n/1000).toFixed(1).replace('.0','') + 'K' : String(n); }

  function showCount(wrapper, count) {
    var p = wrapper && wrapper.querySelector('.wishlist-social-proof');
    var c = wrapper && wrapper.querySelector('.wishlist-social-proof__count');
    if (!p || !c) return;
    if (count >= 1) { 
      c.textContent = fmt(count); 
      p.style.display = 'flex'; 
      wrapper.classList.add('has-count');
    }
    else { 
      p.style.display = 'none'; 
      wrapper.classList.remove('has-count');
    }
  }

  // ── Firebase REST API ────────────────────────────────────────────────────
  function fbUrl(handle) {
    return DB + '/' + encodeURIComponent(handle).replace(/%2F/g, '%252F') + '.json';
  }

  function fbRead(handle, cb) {
    fetch(fbUrl(handle))
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) { cb(d && typeof d.count === 'number' ? d.count : 0); })
      .catch(function() { cb(0); });
  }

  function fbWrite(handle, count, cb) {
    fetch(fbUrl(handle), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: count })
    })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) { cb(d && typeof d.count === 'number' ? d.count : count); })
      .catch(function() { cb(count); });
  }

  function increment(handle, cb) {
    fbRead(handle, function(current) {
      var next = current + 1;
      fbWrite(handle, next, function(saved) {
        setCache(handle, saved);
        cb(saved);
      });
    });
  }

  function decrement(handle, cb) {
    fbRead(handle, function(current) {
      var next = Math.max(0, current - 1);
      fbWrite(handle, next, function(saved) {
        setCache(handle, saved);
        cb(saved);
      });
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  var ready = new Set();

  function initButtons() {
    document.querySelectorAll('.wishlist-pdp-btn, .mobile-wishlist-btn, wishlist-heart').forEach(function(btn) {
      var isComponent = btn.tagName.toLowerCase() === 'wishlist-heart';
      var h = btn.dataset.handle || btn.getAttribute('data-product-handle');
      if (!h || ready.has(btn)) return;
      ready.add(btn);

      var wrapper = btn.closest('.wishlist-pdp-wrapper') || btn.parentElement || btn;

      // Restore per-device state for basic buttons
      if (!isComponent && isWishlisted(h)) btn.classList.add('active');

      // Show cached count instantly
      var cached = getCached(h);
      if (cached !== null && cached >= 1) showCount(wrapper, cached);

      // Fetch fresh count from Firebase
      fbRead(h, function(count) {
        setCache(h, count);
        showCount(wrapper, count);
      });

      // Click logic ONLY for basic buttons, wishlist-heart component handles itself
      if (!isComponent) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var adding = !isWishlisted(h);
          if (adding) {
            btn.classList.add('active');
            setWishlisted(h, true); // This emits wishlist:update
          } else {
            btn.classList.remove('active');
            setWishlisted(h, false); // This emits wishlist:update
          }
        });
      }
    });
  }

  // Reactive Firebase updates from generic events
  window.addEventListener('wishlist:update', function(e) {
    if (!e.detail || !e.detail.productHandle) return;
    var h = e.detail.productHandle;
    var isSaved = e.detail.isSaved;

    // Find all wrappers for this product to update optimistically
    document.querySelectorAll('.wishlist-pdp-btn[data-handle="'+h+'"], .mobile-wishlist-btn[data-handle="'+h+'"], wishlist-heart[data-product-handle="'+h+'"]').forEach(function(btn) {
      var w = btn.closest('.wishlist-pdp-wrapper') || btn.parentElement || btn;
      if (isSaved) {
        var opt = (getCached(h) || 0) + 1;
        setCache(h, opt);
        showCount(w, opt);
      } else {
        var opt2 = Math.max(0, (getCached(h) || 1) - 1);
        setCache(h, opt2);
        showCount(w, opt2);
      }
    });

    // Proceed to Firebase
    if (isSaved) {
      increment(h, function(n) {
        document.querySelectorAll('.wishlist-pdp-btn[data-handle="'+h+'"], .mobile-wishlist-btn[data-handle="'+h+'"], wishlist-heart[data-product-handle="'+h+'"]').forEach(function(btn) {
          var w = btn.closest('.wishlist-pdp-wrapper') || btn.parentElement || btn;
          showCount(w, n);
        });
      });
    } else {
      decrement(h, function(n) {
        document.querySelectorAll('.wishlist-pdp-btn[data-handle="'+h+'"], .mobile-wishlist-btn[data-handle="'+h+'"], wishlist-heart[data-product-handle="'+h+'"]').forEach(function(btn) {
          var w = btn.closest('.wishlist-pdp-wrapper') || btn.parentElement || btn;
          showCount(w, n);
        });
      });
    }
  });

  function updatePill(pill, count, h) {
    var countEl = pill.querySelector('.mobile-wishlist-pill__count');
    if (countEl) {
      if (count >= 1) {
        countEl.textContent = fmt(count);
        countEl.style.display = 'inline-block';
      } else {
        countEl.textContent = '';
        countEl.style.display = 'none';
      }
    }
    if (isWishlisted(h)) pill.classList.add('saved');
    else pill.classList.remove('saved');
  }

  var pillsReady = new Set();

  function initPills() {
    document.querySelectorAll('.mobile-wishlist-pill').forEach(function(pill) {
      var h = pill.getAttribute('data-product-handle');
      if (!h || pillsReady.has(pill)) return;
      pillsReady.add(pill);

      // Saved state
      if (isWishlisted(h)) pill.classList.add('saved');

      // Show cached count instantly
      var cached = getCached(h);
      if (cached !== null) updatePill(pill, cached, h);

      // Fetch fresh count
      fbRead(h, function(count) {
        setCache(h, count);
        updatePill(pill, count, h);
      });

      // Click handler
      pill.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var adding = !isWishlisted(h);
        setWishlisted(h, adding); // emits wishlist:update
      });
    });
  }

  // Reactive updates for pills
  window.addEventListener('wishlist:update', function(e) {
    if (!e.detail || !e.detail.productHandle) return;
    var h = e.detail.productHandle;
    var isSaved = e.detail.isSaved;

    // Update pills optimistically
    document.querySelectorAll('.mobile-wishlist-pill[data-product-handle="'+h+'"]').forEach(function(pill) {
      var opt = isSaved ? (getCached(h) || 0) + 1 : Math.max(0, (getCached(h) || 1) - 1);
      setCache(h, opt);
      updatePill(pill, opt, h);
    });

    // Also update desktop buttons
    document.querySelectorAll('.wishlist-pdp-btn[data-handle="'+h+'"], .mobile-wishlist-btn[data-handle="'+h+'"], wishlist-heart[data-product-handle="'+h+'"]').forEach(function(btn) {
      var w = btn.closest('.wishlist-pdp-wrapper') || btn.parentElement || btn;
      showCount(w, getCached(h) || 0);
    });

    // Confirm from Firebase
    if (isSaved) {
      increment(h, function(n) {
        setCache(h, n);
        document.querySelectorAll('.mobile-wishlist-pill[data-product-handle="'+h+'"]').forEach(function(pill) { updatePill(pill, n, h); });
        document.querySelectorAll('.wishlist-pdp-btn[data-handle="'+h+'"], wishlist-heart[data-product-handle="'+h+'"]').forEach(function(btn) {
          var w = btn.closest('.wishlist-pdp-wrapper') || btn.parentElement || btn;
          showCount(w, n);
        });
      });
    } else {
      decrement(h, function(n) {
        setCache(h, n);
        document.querySelectorAll('.mobile-wishlist-pill[data-product-handle="'+h+'"]').forEach(function(pill) { updatePill(pill, n, h); });
        document.querySelectorAll('.wishlist-pdp-btn[data-handle="'+h+'"], wishlist-heart[data-product-handle="'+h+'"]').forEach(function(btn) {
          var w = btn.closest('.wishlist-pdp-wrapper') || btn.parentElement || btn;
          showCount(w, n);
        });
      });
    }
  });

  initButtons();
  initPills();
  document.addEventListener('DOMContentLoaded', function() { initButtons(); initPills(); });
  window.addEventListener('load', function() { initButtons(); initPills(); });
  setTimeout(function() { initButtons(); initPills(); }, 400);
  setTimeout(function() { initButtons(); initPills(); }, 1500);
  new MutationObserver(function() { initButtons(); initPills(); }).observe(document.documentElement, { childList: true, subtree: true });

})();
