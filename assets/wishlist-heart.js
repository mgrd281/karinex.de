/**
 * Wishlist Heart Custom Element
 * Handles localStorage persistence and AboutYou-style micro-interactions.
 * Synced with theme's wishlist page (localStorage: 'wishlist').
 */
class WishlistHeart extends HTMLElement {
    constructor() {
        super();
        this.STORAGE_KEY = 'wishlist';
    }

    connectedCallback() {
        this.productHandle = this.getAttribute('data-product-handle');
        if (!this.productHandle) return;

        this.render();
        this.checkInitialState();

        this.button = this.querySelector('button');
        if (this.button) {
            this.button.addEventListener('click', this.toggleWishlist.bind(this));
        }

        // Listen for changes from other cards with same product handle
        window.addEventListener('wishlist:update', (e) => {
            if (e.detail.productHandle === this.productHandle) {
                this.updateState(e.detail.isSaved);
            }
        });

        // Also listen for generic theme wishlist-updated event
        window.addEventListener('wishlist-updated', () => {
            this.checkInitialState();
        });
    }

    render() {
        const label = this.hasAttribute('saved')
            ? 'Von Wunschliste entfernen'
            : 'Zur Wunschliste hinzufügen';

        // Elegant thin heart — Heroicons outline style
        this.innerHTML = `
      <button type="button" class="wishlist-heart__button" aria-label="${label}" title="${label}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/>
        </svg>
      </button>
      <div class="wishlist-social-proof" style="display:none; text-align:center;">
          <span class="wishlist-social-proof__count" style="font-size:11px; font-weight:600; color:#1a1a1a; display:block; margin-top:2px;"></span>
      </div>
    `;
    }

    getSavedProducts() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading wishlist from localStorage:', e);
            return [];
        }
    }

    checkInitialState() {
        const products = this.getSavedProducts();
        if (products.includes(this.productHandle)) {
            this.setAttribute('saved', '');
            this.updateState(true);
        } else {
            this.removeAttribute('saved');
            this.updateState(false);
        }
    }

    updateState(isSaved) {
        if (isSaved) {
            this.setAttribute('saved', '');
            if (this.button) {
                this.button.setAttribute('aria-label', 'Von Wunschliste entfernen');
                this.button.setAttribute('title', 'Von Wunschliste entfernen');
            }
        } else {
            this.removeAttribute('saved');
            if (this.button) {
                this.button.setAttribute('aria-label', 'Zur Wunschliste hinzufügen');
                this.button.setAttribute('title', 'Zur Wunschliste hinzufügen');
            }
        }
    }

    toggleWishlist(event) {
        event.preventDefault();
        // event.stopPropagation();

        let products = this.getSavedProducts();
        const isSaved = this.hasAttribute('saved');

        if (isSaved) {
            products = products.filter(handle => handle !== this.productHandle);
        } else {
            if (!products.includes(this.productHandle)) {
                products.push(this.productHandle);
            }
        }

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(products));

            const newState = !isSaved;
            this.updateState(newState);

            // Notify other cards for instant sync
            window.dispatchEvent(new CustomEvent('wishlist:update', {
                detail: {
                    productHandle: this.productHandle,
                    isSaved: newState
                }
            }));

            // Notify theme components (wishlist page, counter, etc.)
            window.dispatchEvent(new Event('wishlist-updated'));
        } catch (e) {
            console.error('Error saving wishlist to localStorage:', e);
        }
    }
}

if (!customElements.get('wishlist-heart')) {
    customElements.define('wishlist-heart', WishlistHeart);
}
