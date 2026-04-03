/**
 * Radical Search Page Redesign - JavaScript
 * Modern E-commerce Search Experience
 */

class AdvancedSearch {
  constructor() {
    this.init();
    this.bindEvents();
    this.setupLazyLoading();
  }

  init() {
    // Initialize components
    this.modal = document.getElementById('quickViewModal');
    this.modalContent = document.getElementById('quickViewContent');
    this.filters = document.getElementById('searchFilters');
    this.sortSelect = document.getElementById('sortSelect');
    this.productsGrid = document.getElementById('productsGrid');
    
    // State
    this.activeFilters = {};
    this.currentSort = 'relevance';
    this.isLoading = false;
    
    // Initialize URL parameters
    this.parseUrlParams();
    
    // Setup performance observer
    this.setupPerformanceObserver();
  }

  bindEvents() {
    // Filter pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        this.toggleFilter(e.currentTarget);
      });
    });

    // Sort dropdown
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.handleSort(e.target.value);
      });
    }

    // Quick view buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.quick-view-btn')) {
        e.preventDefault();
        const btn = e.target.closest('.quick-view-btn');
        const productUrl = btn.dataset.productUrl;
        this.openQuickView(productUrl);
      }
    });

    // Quick add buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.quick-add-btn')) {
        e.preventDefault();
        const btn = e.target.closest('.quick-add-btn');
        const productId = btn.dataset.productId;
        this.quickAdd(productId);
      }
    });

    // Modal close
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-view-modal__backdrop') || 
            e.target.closest('.quick-view-modal__close')) {
          this.closeQuickView();
        }
      });
    }

    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.closeQuickView();
      }
    });

    // Product hover prefetch
    this.setupHoverPrefetch();
  }

  parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const sort = params.get('sort_by');
    if (sort && this.sortSelect) {
      this.sortSelect.value = sort;
      this.currentSort = sort;
    }
  }

  toggleFilter(pill) {
    const filterType = pill.dataset.filter;
    const isActive = pill.classList.contains('active');
    
    if (isActive) {
      pill.classList.remove('active');
      delete this.activeFilters[filterType];
    } else {
      pill.classList.add('active');
      this.showFilterDropdown(pill, filterType);
    }
    
    this.updateFilters();
  }

  showFilterDropdown(pill, filterType) {
    // Create dropdown dynamically based on filter type
    const dropdown = this.createFilterDropdown(filterType);
    
    // Position dropdown
    const rect = pill.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.zIndex = '20';
    
    document.body.appendChild(dropdown);
    
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !pill.contains(e.target)) {
          dropdown.remove();
          pill.classList.remove('active');
        }
      }, { once: true });
    }, 100);
  }

  createFilterDropdown(filterType) {
    const dropdown = document.createElement('div');
    dropdown.className = 'filter-dropdown';
    dropdown.innerHTML = `
      <div class="filter-dropdown__content">
        <div class="filter-dropdown__header">
          <h3>${this.getFilterTitle(filterType)}</h3>
        </div>
        <div class="filter-dropdown__body">
          ${this.getFilterOptions(filterType)}
        </div>
      </div>
    `;
    return dropdown;
  }

  getFilterTitle(type) {
    const titles = {
      category: 'Kategorie',
      brand: 'Marke',
      price: 'Preis',
      availability: 'Verfügbarkeit'
    };
    return titles[type] || type;
  }

  getFilterOptions(type) {
    // In a real implementation, these would come from the backend
    const options = {
      category: ['Uhren', 'Schmuck', 'Accessoires'],
      brand: ['BOSS', 'Omega', 'Rolex', 'Casio'],
      price: ['<100€', '100-500€', '500-1000€', '>1000€'],
      availability: ['Sofort verfügbar', 'Vorbestellung', 'Ausverkauft']
    };
    
    return (options[type] || []).map(option => `
      <label class="filter-option">
        <input type="checkbox" value="${option}">
        <span>${option}</span>
      </label>
    `).join('');
  }

  handleSort(sortValue) {
    this.currentSort = sortValue;
    this.updateUrl({ sort_by: sortValue });
    this.refreshResults();
  }

  updateFilters() {
    // Update URL with current filters
    const params = new URLSearchParams(window.location.search);
    
    Object.keys(this.activeFilters).forEach(key => {
      if (this.activeFilters[key]) {
        params.set(key, this.activeFilters[key]);
      } else {
        params.delete(key);
      }
    });
    
    this.updateUrl(Object.fromEntries(params));
    this.refreshResults();
  }

  updateUrl(params) {
    const url = new URL(window.location);
    Object.keys(params).forEach(key => {
      if (params[key]) {
        url.searchParams.set(key, params[key]);
      } else {
        url.searchParams.delete(key);
      }
    });
    
    // Update URL without reload
    window.history.replaceState({}, '', url);
  }

  refreshResults() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.showLoadingState();
    
    // In a real implementation, this would make an AJAX call
    setTimeout(() => {
      this.hideLoadingState();
      this.isLoading = false;
    }, 500);
  }

  showLoadingState() {
    if (this.productsGrid) {
      this.productsGrid.style.opacity = '0.5';
      this.productsGrid.style.pointerEvents = 'none';
    }
  }

  hideLoadingState() {
    if (this.productsGrid) {
      this.productsGrid.style.opacity = '1';
      this.productsGrid.style.pointerEvents = 'auto';
    }
  }

  async openQuickView(productUrl) {
    if (!this.modal || this.isLoading) return;
    
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Show loading state
    this.modalContent.innerHTML = `
      <div class="quick-view-loading">
        <div class="loading-skeleton" style="height: 300px; border-radius: 8px; margin-bottom: 16px;"></div>
        <div class="loading-skeleton" style="height: 20px; width: 60%; margin-bottom: 8px;"></div>
        <div class="loading-skeleton" style="height: 20px; width: 40%; margin-bottom: 16px;"></div>
        <div class="loading-skeleton" style="height: 80px; border-radius: 8px;"></div>
      </div>
    `;
    
    try {
      // Fetch product data
      const response = await fetch(`${productUrl}?view=quick-view`);
      const html = await response.text();
      
      // Parse and inject content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const productData = this.extractProductData(doc);
      
      this.modalContent.innerHTML = this.renderQuickViewContent(productData);
      
      // Initialize product form
      this.initializeQuickViewForm();
      
    } catch (error) {
      // Quick view error
      this.modalContent.innerHTML = `
        <div class="quick-view-error">
          <p>Fehler beim Laden des Produkts.</p>
          <button onclick="this.closest('.quick-view-modal').classList.remove('active')">Schließen</button>
        </div>
      `;
    }
  }

  extractProductData(doc) {
    // Extract product information from the document
    return {
      title: doc.querySelector('.product-title')?.textContent || 'Produkt',
      price: doc.querySelector('.product-price')?.textContent || 'Preis auf Anfrage',
      image: doc.querySelector('.product-image')?.src || '',
      description: doc.querySelector('.product-description')?.textContent || '',
      variants: [] // Extract variants if needed
    };
  }

  renderQuickViewContent(product) {
    return `
      <div class="quick-view-product">
        <div class="quick-view-product__media">
          <img src="${product.image}" alt="${product.title.replace(/"/g,'&quot;')}" loading="lazy" width="200" height="200">
        </div>
        <div class="quick-view-product__info">
          <h2>${product.title}</h2>
          <div class="quick-view-product__price">${product.price}</div>
          <div class="quick-view-product__description">${product.description}</div>
          <form class="quick-view-product__form" action="/cart/add" method="post">
            <div class="quantity-selector">
              <label for="quantity">Anzahl:</label>
              <input type="number" id="quantity" name="quantity" value="1" min="1">
            </div>
            <button type="submit" class="btn btn--primary">In den Warenkorb</button>
          </form>
        </div>
      </div>
    `;
  }

  initializeQuickViewForm() {
    const form = this.modalContent.querySelector('form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleQuickViewAdd(form);
      });
    }
  }

  async handleQuickViewAdd(form) {
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Show loading state
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Wird hinzugefügt...';
    submitBtn.disabled = true;
    
    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      if (response.ok) {
        // Success
        submitBtn.textContent = 'Hinzugefügt ✓';
        setTimeout(() => {
          this.closeQuickView();
        }, 1000);
        
        // Update cart count if exists
        this.updateCartCount();
        
      } else {
        throw new Error('Add to cart failed');
      }
      
    } catch (error) {
      // Add to cart error
      submitBtn.textContent = 'Fehler - Versuche erneut';
      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }, 2000);
    }
  }

  async quickAdd(productId) {
    const btn = document.querySelector(`[data-product-id="${productId}"]`);
    if (!btn) return;
    
    // Show loading state
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<div class="spinner"></div>';
    btn.disabled = true;
    
    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          id: productId,
          quantity: 1
        })
      });
      
      if (response.ok) {
        // Success animation
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 4.5L6 12l-3.5-3.5" stroke="currentColor" stroke-width="2"/>
          </svg>
        `;
        btn.classList.add('success');
        
        // Update cart count
        this.updateCartCount();
        
        // Reset after delay
        setTimeout(() => {
          btn.innerHTML = originalContent;
          btn.disabled = false;
          btn.classList.remove('success');
        }, 2000);
        
      } else {
        throw new Error('Quick add failed');
      }
      
    } catch (error) {
      // Quick add error
      btn.innerHTML = '✕';
      btn.classList.add('error');
      
      setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        btn.classList.remove('error');
      }, 2000);
    }
  }

  closeQuickView() {
    if (this.modal) {
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  updateCartCount() {
    // Update cart count in header if exists
    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        const cartCountEl = document.querySelector('.cart-count');
        if (cartCountEl) {
          cartCountEl.textContent = cart.item_count;
        }
      })
      .catch(error => { /* Cart count update error */ });
  }

  setupLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            observer.unobserve(img);
          }
        });
      });

      // Observe all images with data-src
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  setupHoverPrefetch() {
    const prefetchCache = new Set();
    
    document.addEventListener('mouseenter', (e) => {
      const productLink = e.target.closest('.product-card__link');
      if (productLink && !prefetchCache.has(productLink.href)) {
        // Prefetch product page
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = productLink.href;
        document.head.appendChild(link);
        
        prefetchCache.add(productLink.href);
      }
    }, { passive: true });
  }

  setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              // Track LCP for optimization
              // LCP metric recorded
            }
          }
        });
        
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (error) {
        // Ignore errors in performance observer
      }
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AdvancedSearch();
});

// Service Worker registration for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Ignore service worker registration errors
  });
}