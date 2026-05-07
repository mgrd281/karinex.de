/* ============================================================
   Karinex — Software product template behaviors
   - Sticky desktop header (appears when main CTA leaves viewport)
   - Sticky mobile buy-bar (appears after 200px scroll)
   - Gallery thumbnail switcher
   - Add-to-cart inline confirmation (no drawer pop, no redirect)
   - Cart counter scaleUp animation
   ============================================================ */
(function () {
  'use strict';

  var root = document.querySelector('[data-product-software]');
  if (!root) return;

  var stickyHeader = root.querySelector('[data-sticky-header]');
  var stickyBar = document.querySelector('[data-sticky-bar]');
  var buyForm = root.querySelector('[data-buy-form]');
  var buyCta = root.querySelector('[data-buy-cta]');
  var stickyHeaderForm = root.querySelector('[data-sticky-header-form]');
  var stickyBarForm = stickyBar ? stickyBar.querySelector('[data-sticky-form]') : null;

  /* ─── Sticky header (desktop only) ─────────────────────── */
  if (stickyHeader && buyCta && 'IntersectionObserver' in window) {
    var headerObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          stickyHeader.classList.remove('is-visible');
          stickyHeader.setAttribute('aria-hidden', 'true');
        } else {
          stickyHeader.classList.add('is-visible');
          stickyHeader.setAttribute('aria-hidden', 'false');
        }
      });
    }, { rootMargin: '-40px 0px 0px 0px', threshold: 0 });
    headerObs.observe(buyCta);
  }

  /* ─── Sticky mobile bar (after 200px scroll) ───────────── */
  if (stickyBar) {
    var barShown = false;
    var onScroll = function () {
      var shouldShow = window.scrollY > 200;
      if (shouldShow && !barShown) {
        stickyBar.classList.add('is-visible');
        stickyBar.setAttribute('aria-hidden', 'false');
        barShown = true;
      } else if (!shouldShow && barShown) {
        stickyBar.classList.remove('is-visible');
        stickyBar.setAttribute('aria-hidden', 'true');
        barShown = false;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ─── Gallery thumbnail switcher ───────────────────────── */
  var mainImg = root.querySelector('[data-gallery-main-image]');
  var thumbs = root.querySelectorAll('[data-gallery-thumb]');
  if (mainImg && thumbs.length) {
    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var full = thumb.getAttribute('data-full');
        var srcset = thumb.getAttribute('data-srcset');
        var alt = thumb.getAttribute('data-alt');
        if (full) mainImg.setAttribute('src', full);
        if (srcset) mainImg.setAttribute('srcset', srcset);
        if (alt) mainImg.setAttribute('alt', alt);
        thumbs.forEach(function (t) {
          t.classList.remove('is-active');
          t.setAttribute('aria-pressed', 'false');
        });
        thumb.classList.add('is-active');
        thumb.setAttribute('aria-pressed', 'true');
      });
    });
  }

  /* ─── Add-to-cart inline confirmation ──────────────────── */
  function flashSuccess(btn) {
    if (!btn) return;
    var def = btn.querySelector('[data-cta-default]');
    var ok = btn.querySelector('[data-cta-success]');
    if (!def || !ok) return;
    btn.classList.add('is-success');
    def.hidden = true;
    ok.hidden = false;
    setTimeout(function () {
      btn.classList.remove('is-success');
      def.hidden = false;
      ok.hidden = true;
    }, 2000);
  }

  function bumpCartCounter() {
    var candidates = document.querySelectorAll(
      '[data-cart-count], .cart-count, .cart-count-bubble, .cart-bubble, [data-cart-counter]'
    );
    candidates.forEach(function (el) {
      el.style.transition = 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'scale(1.25)';
      setTimeout(function () { el.style.transform = ''; }, 240);
    });
  }

  function updateCartCount() {
    fetch(window.Shopify && window.Shopify.routes && window.Shopify.routes.root
      ? window.Shopify.routes.root + 'cart.js'
      : '/cart.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var els = document.querySelectorAll('[data-cart-count], .cart-count-bubble, .cart-count');
        els.forEach(function (el) {
          if ('value' in el) el.value = cart.item_count;
          else el.textContent = cart.item_count;
        });
      })
      .catch(function () { /* silent */ });
  }

  function bindAjaxAdd(form, ctaBtn) {
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = ctaBtn || form.querySelector('[type="submit"]');
      if (btn) btn.disabled = true;
      var data = new FormData(form);
      fetch(window.Shopify && window.Shopify.routes && window.Shopify.routes.root
        ? window.Shopify.routes.root + 'cart/add.js'
        : '/cart/add.js', {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      })
        .then(function (r) {
          if (!r.ok) throw new Error('add failed');
          return r.json();
        })
        .then(function () {
          flashSuccess(btn);
          updateCartCount();
          bumpCartCounter();
          document.dispatchEvent(new CustomEvent('cart:refresh'));
        })
        .catch(function () {
          // Fallback: traditional submit
          form.removeEventListener('submit', arguments.callee);
          form.submit();
        })
        .finally(function () {
          if (btn) btn.disabled = false;
        });
    });
  }

  bindAjaxAdd(buyForm, buyCta);
  bindAjaxAdd(stickyHeaderForm, root.querySelector('[data-sticky-header-cta]'));
  bindAjaxAdd(stickyBarForm, stickyBar ? stickyBar.querySelector('[data-sticky-cta]') : null);
})();
