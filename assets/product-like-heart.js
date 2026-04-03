/**
 * Product Like Heart Counter - Custom Element
 * Lightweight wrapper that works with global-like-manager.js
 * 
 * The global manager handles:
 * - localStorage synchronization
 * - Cross-tab updates
 * - Persistent counting
 * - Initialization
 * 
 * This element simply provides the UI structure
 */

class ProductLikeHeart extends HTMLElement {
  connectedCallback() {
    // Wait for global manager to be ready and initialize this element
    const waitForManager = () => {
      if (window.GlobalLikeManager) {
        window.GlobalLikeManager.initializeHeart(this);
        this.initialized = true;
      } else {
        // Retry every 50ms
        setTimeout(waitForManager, 50);
      }
    };

    // Check immediately in case manager is already loaded
    if (window.GlobalLikeManager) {
      window.GlobalLikeManager.initializeHeart(this);
      this.initialized = true;
    } else {
      waitForManager();
    }
  }
}

if (!customElements.get('product-like-heart')) {
  customElements.define('product-like-heart', ProductLikeHeart);
}



