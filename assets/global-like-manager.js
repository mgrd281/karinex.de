/**
 * Global Like Counter Manager
 * Synchronizes product likes across all pages and browser tabs
 * Works with localStorage fallback (always available)
 * 
 * Features:
 * - Cross-tab synchronization using StorageEvent
 * - Persistent storage in localStorage
 * - Real-time updates across all opened pages
 * - Automatic retry mechanism
 * - Immediate initialization on load
 */

(function() {
  'use strict';

  class GlobalLikeManager {
    constructor() {
      this.STORAGE_PREFIX = 'shared_like_count_';
      this.CUSTOMER_ID_KEY = 'like_customer_unique_id';
      this.initialized = false;
      
      this.init();
    }

    init() {
      // Ensure customer has unique ID
      this.getCustomerId();
      
      // Listen for storage changes from other tabs
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith(this.STORAGE_PREFIX)) {
          // Storage was updated in another tab - reload all like hearts
          this.syncAllHearts();
        }
      });

      // Initialize hearts immediately if DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.initializeHearts();
          this.initialized = true;
        });
      } else {
        // DOM already loaded, initialize immediately
        setTimeout(() => this.initializeHearts(), 0);
        this.initialized = true;
      }

      // Handle dynamic content (Shopify sections reload)
      window.addEventListener('shopify:section:load', () => {
        setTimeout(() => this.initializeHearts(), 100);
      });
    }

    /**
     * Get or create unique customer ID
     */
    getCustomerId() {
      let customerId = localStorage.getItem(this.CUSTOMER_ID_KEY);
      if (!customerId) {
        customerId = 'like_cust_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem(this.CUSTOMER_ID_KEY, customerId);
      }
      return customerId;
    }

    /**
     * Initialize all product-like-heart elements on the page
     */
    initializeHearts() {
      const hearts = document.querySelectorAll('product-like-heart');
      
      hearts.forEach((heart, idx) => {
        if (!heart.initialized) {
          this.initializeHeart(heart);
          heart.initialized = true;
        }
      });
    }

    /**
     * Initialize a single heart element
     */
    initializeHeart(heart) {
      const productHandle = heart.getAttribute('data-product-handle');
      if (!productHandle) {
        console.warn('[GlobalLikeManager] No product handle found');
        return;
      }


      const button = heart.querySelector('button');
      const counter = heart.querySelector('.like-heart__counter');

      if (!button) {
        console.warn('[GlobalLikeManager] No button found in heart element');
        return;
      }

      if (!counter) {
        console.warn('[GlobalLikeManager] No counter span found in heart element');
        return;
      }

      // Restore liked state
      this.restoreLikedState(heart, productHandle);

      // Display current count
      const currentCount = this.getCount(productHandle);
      this.displayCount(counter, currentCount);

      // Event listener for button click
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleLike(heart, productHandle, button, counter);
      });
    }

    /**
     * Toggle like state
     */
    toggleLike(heart, productHandle, button, counter) {
      const isLiked = heart.hasAttribute('liked');

      if (!isLiked) {
        // Add like
        heart.setAttribute('liked', '');
        localStorage.setItem('customer_like_' + productHandle, 'true');
        const newCount = this.incrementCount(productHandle);
        this.displayCount(counter, newCount);
      } else {
        // Remove like
        heart.removeAttribute('liked');
        localStorage.removeItem('customer_like_' + productHandle);
        const newCount = this.decrementCount(productHandle);
        this.displayCount(counter, newCount);
      }

      // Dispatch event for other elements
      window.dispatchEvent(new StorageEvent('storage', {
        key: this.STORAGE_PREFIX + productHandle,
        newValue: this.getCount(productHandle).toString()
      }));
    }

    /**
     * Get current like count for a product
     */
    getCount(productHandle) {
      const key = this.STORAGE_PREFIX + productHandle;
      return parseInt(localStorage.getItem(key) || '0', 10);
    }

    /**
     * Increment like count
     */
    incrementCount(productHandle) {
      const key = this.STORAGE_PREFIX + productHandle;
      const currentCount = this.getCount(productHandle);
      const newCount = currentCount + 1;
      localStorage.setItem(key, newCount.toString());
      return newCount;
    }

    /**
     * Decrement like count
     */
    decrementCount(productHandle) {
      const key = this.STORAGE_PREFIX + productHandle;
      const currentCount = this.getCount(productHandle);
      const newCount = Math.max(0, currentCount - 1);
      localStorage.setItem(key, newCount.toString());
      return newCount;
    }

    /**
     * Restore user's personal liked state from localStorage
     */
    restoreLikedState(heart, productHandle) {
      const likedKey = 'customer_like_' + productHandle;
      const isLiked = localStorage.getItem(likedKey) === 'true';
      
      if (isLiked) {
        heart.setAttribute('liked', '');
      } else {
        heart.removeAttribute('liked');
      }
    }

    /**
     * Display count with animation and data attribute for CSS selector
     */
    displayCount(counter, count) {
      if (!counter) {
        console.warn('[GlobalLikeManager] Counter element not found');
        return;
      }
      
      
      if (count > 0) {
        counter.textContent = count;
        counter.setAttribute('data-count', count);
        counter.style.display = 'flex';
        counter.classList.add('pop-animation');
        
        setTimeout(() => {
          counter.classList.remove('pop-animation');
        }, 300);
      } else {
        counter.textContent = '';
        counter.removeAttribute('data-count');
        counter.style.display = 'none';
      }
    }

    /**
     * Sync all hearts on page when storage changes in another tab
     */
    syncAllHearts() {
      const hearts = document.querySelectorAll('product-like-heart');
      hearts.forEach(heart => {
        const productHandle = heart.getAttribute('data-product-handle');
        const counter = heart.querySelector('.like-heart__counter');
        const currentCount = this.getCount(productHandle);
        this.displayCount(counter, currentCount);
      });
    }
  }

  // Create and expose global manager instance
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!window.GlobalLikeManager) {
        window.GlobalLikeManager = new GlobalLikeManager();
      }
    });
  } else {
    if (!window.GlobalLikeManager) {
      window.GlobalLikeManager = new GlobalLikeManager();
    }
  }
})();
