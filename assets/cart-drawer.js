import { DialogComponent, DialogOpenEvent } from '@theme/dialog';
import { CartAddEvent, ThemeEvents } from '@theme/events';

/**
 * A custom element that manages a cart drawer.
 *
 * @typedef {object} Refs
 * @property {HTMLDialogElement} dialog - The dialog element.
 *
 * @extends {DialogComponent}
 */
class CartDrawerComponent extends DialogComponent {
  /** @type {number} */
  #summaryThreshold = 0.5;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener(CartAddEvent.eventName, this.#handleCartAdd);
    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
    document.addEventListener('cart:empty', this.#handleCartEmpty);
    this.addEventListener(DialogOpenEvent.eventName, this.#updateStickyState);

    // Global listener for opening the drawer from anywhere (e.g. header icons)
    document.addEventListener('click', this.#handleGlobalClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(CartAddEvent.eventName, this.#handleCartAdd);
    document.removeEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
    document.removeEventListener('cart:empty', this.#handleCartEmpty);
    this.removeEventListener(DialogOpenEvent.eventName, this.#updateStickyState);
    document.removeEventListener('click', this.#handleGlobalClick);
  }

  /** @param {any} event */
  #handleGlobalClick = (event) => {
    const target = event.target.closest('[on\\:click="cart-drawer-component/open"]');
    if (target) {
      event.preventDefault();
      this.open();
    }
  };

  /** @param {any} event */
  #handleCartAdd = (event) => {
    if (this.hasAttribute('auto-open')) {
      this.showDialog();
      // @ts-ignore
      setTimeout(() => window.initCartUpsell?.(true, event.detail?.resource), 100);
    }
  };

  /**
   * Handles cart updates — morph section for non-removal updates (e.g. add, discount).
   */
  /** @param {any} event */
  #handleCartUpdate = (event) => {
    // Only handle non-removal updates (adds, quantity changes, discounts)
    // Removals are fully handled by the inline masterRemove script
    const detail = event.detail;
    if (detail && detail.data && detail.data.itemCount === 0) {
      this.#loadRecentlyViewed();
    }
  };

  /**
   * Handles explicit cart:empty events — close the drawer.
   */
  #handleCartEmpty = () => {
    this.#loadRecentlyViewed();
  };

  open() {
    this.showDialog();
    // @ts-ignore
    setTimeout(() => window.initCartUpsell?.(true), 100);
    this.#loadRecentlyViewed();

    /**
     * Close cart drawer when installments CTA is clicked to avoid overlapping dialogs
     */
    customElements.whenDefined('shopify-payment-terms').then(() => {
      const installmentsContent = document.querySelector('shopify-payment-terms')?.shadowRoot;
      const cta = installmentsContent?.querySelector('#shopify-installments-cta');
      cta?.addEventListener('click', this.closeDialog, { once: true });
    });
  }

  close() {
    this.closeDialog();
  }

  #updateStickyState() {
    const { dialog } = /** @type {Refs} */ (this.refs);
    if (!dialog) return;

    // Refs do not cross nested `*-component` boundaries (e.g., `cart-items-component`), so we query within the dialog.
    const content = dialog.querySelector('.cart-drawer__content');
    const summary = dialog.querySelector('.cart-drawer__summary');

    if (!content || !summary) {
      // Ensure the dialog doesn't get stuck in "unsticky" mode when summary disappears (e.g., empty cart).
      dialog.setAttribute('cart-summary-sticky', 'false');
      return;
    }

    const drawerHeight = dialog.getBoundingClientRect().height;
    const summaryHeight = summary.getBoundingClientRect().height;
    const ratio = summaryHeight / drawerHeight;
    dialog.setAttribute('cart-summary-sticky', ratio > this.#summaryThreshold ? 'false' : 'true');
  }

  /**
   * Fetches and injects "Zuletzt angesehen" products into whichever container
   * is currently present — works for both empty and non-empty cart states.
   */
  async #loadRecentlyViewed() {
    // Support both the empty-cart container and the filled-cart container
    const container =
      document.getElementById('cart-drawer-empty-extras') ||
      document.getElementById('cart-drawer-rv-items');

    if (!container || container.classList.contains('is-loaded')) return;

    // Get Recently Viewed IDs from localStorage
    const viewedProductsRaw = localStorage.getItem('viewedProducts');
    const viewedProducts = JSON.parse(viewedProductsRaw || '[]').slice(0, 10);

    if (viewedProducts.length === 0) return;

    const rvUrl = new URL(window.location.origin + '/search');
    rvUrl.searchParams.set('section_id', 'cart-recently-viewed');
    rvUrl.searchParams.set('type', 'product');
    rvUrl.searchParams.set('q', viewedProducts.map(/** @param {string} id */ (id) => `id:${id}`).join(' OR '));

    try {
      const rvRes = await fetch(rvUrl.toString());
      if (rvRes.ok) {
        const rvHtml = await rvRes.text();
        if (rvHtml.trim().length > 0) {
          container.innerHTML = rvHtml;
          // Re-sort cards newest → oldest (matching localStorage order)
          const list = container.querySelector('.recently-viewed-drawer__list');
          if (list) {
            const cards = Array.from(list.querySelectorAll('.rv-card'));
            cards.sort((a, b) => {
              const ia = viewedProducts.indexOf(a.dataset.productId);
              const ib = viewedProducts.indexOf(b.dataset.productId);
              return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
            });
              cards.forEach((c, i) => {
              c.style.animationDelay = `${i * 80}ms`;
              list.appendChild(c);
            });
          }
          container.classList.add('is-loaded');
        }
      }
    } catch (e) {
      console.error('Failed to load recently viewed:', e);
    }
  }
}

if (!customElements.get('cart-drawer-component')) {
  customElements.define('cart-drawer-component', CartDrawerComponent);
}
