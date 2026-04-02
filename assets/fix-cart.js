
/**
 * Global Failsafe for "Add to Cart" forms.
 * Prevents redirection to /cart if the main theme JS fails to intercept.
 */
document.addEventListener('submit', async (e) => {
    const form = e.target;

    // Only target cart addition forms
    if (form && form.action && form.action.includes('/cart/add')) {

        // If the theme's product-form.js has already handled this (prevented default),
        // we back off to avoid double-adding items.
        if (e.defaultPrevented) {
            console.log('Cart submission already handled by theme JS.');
            return;
        }

        console.log('Failsafe: Intercepting cart submission to prevent redirect.');
        e.preventDefault();

        const submitBtn = form.querySelector('[type="submit"]');
        // Removed loading class logic as per user request to keep button static
        // if (submitBtn) submitBtn.classList.add('loading');

        try {
            const formData = new FormData(form);
            const config = {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/javascript'
                },
                body: formData
            };

            // 1. Add to Cart
            const response = await fetch('/cart/add.js', config);
            const addedItem = await response.json();

            if (response.ok) {
                console.log('Failsafe: Item added successfully.', addedItem);

                // 2. Fetch updated cart state AND the specific section HTML
                // Find the cart-drawer section ID from the DOM
                const cartDrawer = document.querySelector('cart-drawer-component');
                const sectionId = cartDrawer ? cartDrawer.dataset.sectionId : null;

                let sections = {};
                if (sectionId) {
                    const sectionsRes = await fetch(`${window.location.pathname}?sections=${sectionId}`);
                    const sectionsData = await sectionsRes.json();
                    sections = sectionsData;
                }

                const cartRes = await fetch('/cart.js');
                const cart = await cartRes.json();

                // 3. Dispatch 'cart:update' event with HTML
                document.dispatchEvent(new CustomEvent('cart:update', {
                    bubbles: true,
                    detail: {
                        resource: cart,
                        sourceId: form.id || 'failsafe-script',
                        data: {
                            sections: sections,
                            itemCount: cart.item_count
                        }
                    }
                }));

                // Button remains static, no need to remove loading class or blur
                if (submitBtn) {
                    submitBtn.blur(); // Just remove focus style
                }

            } else {
                console.error('Failsafe: Cart add failed', addedItem);
                // If AJAX fails (e.g. OOS), fallback to standard redirect so user sees error
                window.location.href = '/cart';
            }
        } catch (err) {
            console.error('Failsafe: Critical Error', err);
            window.location.href = '/cart';
        } finally {
            // No loading class to remove
        }
    }
});
