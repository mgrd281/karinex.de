import { Component } from '@theme/component';
import { onAnimationEnd } from '@theme/utilities';
import { ThemeEvents, CartUpdateEvent } from '@theme/events';

/**
 * A custom element that displays a cart icon.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} cartBubble - The cart bubble element.
 * @property {HTMLElement} cartBubbleText - The cart bubble text element.
 * @property {HTMLElement} cartBubbleCount - The cart bubble count element.
 *
 * @extends {Component<Refs>}
 */
class CartIcon extends Component {
  requiredRefs = ['cartBubble', 'cartBubbleText', 'cartBubbleCount'];

  /** @type {number} */
  get currentCartCount() {
    const countText = this.refs.cartBubbleCount.textContent?.trim();
    if (!countText) return 0;
    const parsed = parseInt(countText, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  set currentCartCount(value) {
    this.refs.cartBubbleCount.textContent = value < 100 ? String(value) : '';
  }

  connectedCallback() {
    super.connectedCallback();

    document.addEventListener(ThemeEvents.cartUpdate, this.onCartUpdate);
    window.addEventListener('pageshow', this.onPageShow);
    this.ensureCartBubbleIsCorrect();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener(ThemeEvents.cartUpdate, this.onCartUpdate);
    window.removeEventListener('pageshow', this.onPageShow);
  }

  /**
   * Handles the page show event when the page is restored from cache.
   * @param {PageTransitionEvent} event - The page show event.
   */
  onPageShow = (event) => {
    if (event.persisted) {
      this.ensureCartBubbleIsCorrect();
    }
  };

  /**
   * Handles the cart update event.
   * @param {CartUpdateEvent} event - The cart update event.
   */
  onCartUpdate = async (event) => {
    // Prioritize total count from resource (cart.js object) if it exists, otherwise use delta from data
    const totalCountFromResource = event.detail.resource?.item_count;
    const deltaCountFromData = event.detail.data?.itemCount;
    
    // If we have a total count, use it directly. Otherwise, calculate based on delta.
    const newTotalCount = (totalCountFromResource !== undefined) 
      ? totalCountFromResource 
      : (this.currentCartCount + (deltaCountFromData ?? 0));

    const comingFromProductForm = event.detail.data?.source === 'product-form-component';

    this.renderCartBubble(newTotalCount, comingFromProductForm);
  };

  /**
   * Renders the cart bubble.
   * @param {number} totalItemCount - The total number of items in the cart.
   * @param {boolean} comingFromProductForm - Whether the cart update is coming from the product form.
   * @param {boolean} [animate=true] - Whether to animate the transition.
   */
  renderCartBubble = async (totalItemCount, comingFromProductForm, animate = true) => {
    // Ensure totalItemCount is a valid number
    const count = Math.max(0, parseInt(String(totalItemCount), 10) || 0);

    // Sync visibility and attributes with the NEW TOTAL count
    this.refs.cartBubbleCount.classList.toggle('hidden', count === 0);
    this.refs.cartBubble.classList.toggle('visually-hidden', count === 0);
    this.refs.cartBubble.setAttribute('data-count', String(count));
    
    // Update the visual text
    this.currentCartCount = count;

    this.classList.toggle('header-actions__cart-icon--has-cart', count > 0);

    sessionStorage.setItem(
      'cart-count',
      JSON.stringify({
        value: String(count),
        timestamp: Date.now(),
      })
    );

    if (!animate || itemCount === 0) return;

    // Ensure element is visible before starting animation
    // Use requestAnimationFrame to ensure the browser sees the state change
    await new Promise((resolve) => requestAnimationFrame(resolve));

    this.refs.cartBubble.classList.add('cart-bubble--animating');
    await onAnimationEnd(this.refs.cartBubbleText);

    this.refs.cartBubble.classList.remove('cart-bubble--animating');
  };

  /**
   * Checks if the cart count is correct.
   */
  ensureCartBubbleIsCorrect = () => {
    // Ensure refs are available
    if (!this.refs.cartBubbleCount) return;

    const sessionStorageCount = sessionStorage.getItem('cart-count');

    // If no session storage data, nothing to check
    if (sessionStorageCount === null) return;

    const visibleCount = this.refs.cartBubbleCount.textContent;

    try {
      const { value, timestamp } = JSON.parse(sessionStorageCount);

      // Check if the stored count matches what's visible
      if (value === visibleCount) return;

      // Only update if timestamp is recent (within 10 seconds)
      if (Date.now() - timestamp < 10000) {
        const count = parseInt(value, 10);

        if (count >= 0) {
          this.renderCartBubble(count, false, false);
        }
      }
    } catch (_) {
      // no-op
    }
  };
}

if (!customElements.get('cart-icon')) {
  customElements.define('cart-icon', CartIcon);
}
