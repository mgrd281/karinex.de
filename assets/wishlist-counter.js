/**
 * Wishlist Counter - Shared counter using JSONBin.io (FREE)
 * Each customer counts once, count is shared across all users globally
 * 
 * Setup:
 * 1. Go to https://jsonbin.io
 * 2. Create a free account
 * 3. Create a new Bin
 * 4. Copy your MASTER KEY and Bin ID
 * 5. Replace the values below
 */
(function() {
  'use strict';

  // ==== CONFIGURATION ====
  const JSONBIN_API_KEY = '$2a$10$wWFQg8azWQ2Ty7ngiGqF4e5xwpt10RHvZPWVDudP.YECQhW.DBuOO';
  const JSONBIN_BIN_ID = '69b03c686a0858658be236be';
  // ======================

  // If no API key is set, fallback to localStorage (single browser only)
  const USE_LOCALSTORAGE = !JSONBIN_API_KEY.includes('YOUR');

  function initWishlistCounter() {
    const wishlistBtns = document.querySelectorAll('.wishlist-pdp-btn');
    if (!wishlistBtns.length) return;

    // Get or create unique customer ID
    function getCustomerId() {
      let customerId = localStorage.getItem('customer_unique_id');
      if (!customerId) {
        customerId = 'cust_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('customer_unique_id', customerId);
      }
      return customerId;
    }

    const customerId = getCustomerId();

    // Check if customer has wishlisted this product
    function hasCustomerWishlisted(productHandle) {
      const key = 'customer_wishlist_' + productHandle;
      return localStorage.getItem(key) === 'true';
    }

    // Set customer wishlist state
    function setCustomerWishlisted(productHandle, hasWishlisted) {
      const key = 'customer_wishlist_' + productHandle;
      if (hasWishlisted) {
        localStorage.setItem(key, 'true');
      } else {
        localStorage.removeItem(key);
      }
    }

    // Update counter display
    function updateCounterDisplay(counter, count) {
      if (!counter) return;
      if (count > 0) {
        counter.textContent = count;
        counter.style.display = 'block';
      } else {
        counter.textContent = '';
        counter.style.display = 'none';
      }
    }

    // ==== LOCALSTORAGE MODE (Fallback) ====
    function getSharedCountLocal(productHandle) {
      const sharedKey = 'shared_wishlist_count_' + productHandle;
      return parseInt(localStorage.getItem(sharedKey) || '0', 10);
    }

    function setSharedCountLocal(productHandle, count) {
      const sharedKey = 'shared_wishlist_count_' + productHandle;
      localStorage.setItem(sharedKey, count.toString());
    }

    // ==== JSONBIN.IO MODE (Free Shared Counter) ====
    async function getAllWishlistData() {
      try {
        const response = await fetch('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID + '/latest', {
          method: 'GET',
          headers: {
            'X-Master-Key': JSONBIN_API_KEY,
            'X-Bin-Meta': 'false'
          }
        });
        if (!response.ok) {
          console.error('[Wishlist] JSONBin fetch failed:', response.status, response.statusText);
          throw new Error('Failed to fetch: ' + response.status);
        }
        const data = await response.json();
        return data.record || {};
      } catch (error) {
        console.error('[Wishlist] JSONBin fetch error:', error);
        return {};
      }
    }

    async function updateWishlistData(productHandle, increment) {
      try {
        // Get current data
        const allData = await getAllWishlistData();

        // Initialize product data if not exists
        if (!allData[productHandle]) {
          allData[productHandle] = {
            count: 0,
            customers: []
          };
        }

        const productData = allData[productHandle];

        if (increment) {
          // Add customer if not already in list
          if (!productData.customers.includes(customerId)) {
            productData.customers.push(customerId);
            productData.count = productData.customers.length;
          }
        } else {
          // Remove customer from list
          productData.customers = productData.customers.filter(function(id) {
            return id !== customerId;
          });
          productData.count = productData.customers.length;
        }

        // Save back to JSONBin
        const response = await fetch('https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID, {
          method: 'PUT',
          headers: {
            'X-Master-Key': JSONBIN_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(allData)
        });

        if (!response.ok) throw new Error('Failed to update');

        return productData.count;
      } catch (error) {
        console.error('JSONBin update error:', error);
        return null;
      }
    }

    async function getProductCount(productHandle) {
      try {
        const allData = await getAllWishlistData();
        if (allData[productHandle]) {
          return allData[productHandle].count || 0;
        }
        return 0;
      } catch (error) {
        console.error('Error getting product count:', error);
        return 0;
      }
    }

    // ==== MAIN FUNCTIONS ====
    async function updateSharedCounter(productHandle, increment) {
      if (USE_LOCALSTORAGE) {
        // LocalStorage mode (single browser only)
        const currentCount = getSharedCountLocal(productHandle);
        let newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);
        setSharedCountLocal(productHandle, newCount);

        // Dispatch event for other tabs
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'shared_wishlist_count_' + productHandle,
          newValue: newCount.toString()
        }));

        return newCount;
      } else {
        // JSONBin mode (shared across all users globally)
        return await updateWishlistData(productHandle, increment);
      }
    }

    async function getSharedCount(productHandle) {
      if (USE_LOCALSTORAGE) {
        return getSharedCountLocal(productHandle);
      } else {
        return await getProductCount(productHandle);
      }
    }

    // ==== INITIALIZATION ====
    
    wishlistBtns.forEach(function(btn) {
      const productHandle = btn.dataset.handle;
      if (!productHandle) return;

      const counter = btn.querySelector('.wishlist-counter__value');

      if (hasCustomerWishlisted(productHandle)) {
        btn.classList.add('active');
      }

      // Get initial count
      getSharedCount(productHandle).then(function(count) {
        updateCounterDisplay(counter, count);
      });

      // Listen for storage changes (sync across tabs in localStorage mode)
      if (USE_LOCALSTORAGE) {
        window.addEventListener('storage', function(e) {
          if (e.key === 'shared_wishlist_count_' + productHandle) {
            const newCount = parseInt(e.newValue || '0', 10);
            updateCounterDisplay(counter, newCount);
          }
        });
      }

      // Periodic refresh (every 30 seconds) for JSONBin mode
      if (!USE_LOCALSTORAGE) {
        setInterval(function() {
          getSharedCount(productHandle).then(function(count) {
            updateCounterDisplay(counter, count);
          });
        }, 30000);
      }
    });

    // ==== CLICK HANDLERS ====
    wishlistBtns.forEach(function(btn) {
      btn.addEventListener('click', async function() {
        const productHandle = btn.dataset.handle;
        if (!productHandle) return;

        const counter = btn.querySelector('.wishlist-counter__value');
        const hasWishlisted = hasCustomerWishlisted(productHandle);

        if (!hasWishlisted) {
          // Adding to wishlist
          setCustomerWishlisted(productHandle, true);
          btn.classList.add('active');

          const newCount = await updateSharedCounter(productHandle, true);
          if (newCount !== null) {
            updateCounterDisplay(counter, newCount);
          }
        } else {
          // Removing from wishlist
          setCustomerWishlisted(productHandle, false);
          btn.classList.remove('active');

          const newCount = await updateSharedCounter(productHandle, false);
          if (newCount !== null) {
            updateCounterDisplay(counter, newCount);
          }
        }
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWishlistCounter);
  } else {
    initWishlistCounter();
  }
})();

/**
 * INSTRUCTIONS TO SETUP FREE JSONBIN.IO ACCOUNT:
 * 
 * 1. Go to https://jsonbin.io
 * 2. Sign up for a free account (no credit card needed)
 * 3. Click "Create New Bin"
 * 4. Set the content to: {}
 * 5. Click "Create"
 * 6. Copy your Bin ID from the URL (after /b/)
 * 7. Go to "API Keys" and copy your "$2a$10$..." Master Key
 * 8. Replace the values in lines 13-14 above:
 *    - JSONBIN_API_KEY = your master key
 *    - JSONBIN_BIN_ID = your bin id
 * 9. Save and upload to Shopify
 * 
 * FREE TIER LIMITS:
 * - 10,000 requests per month
 * - 512 KB storage per bin
 * - More than enough for small-medium stores!
 */

