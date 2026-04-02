/**
 * OTTO-Style Search Page with Shopify Facets
 * ============================================
 */

class SearchPage {
  constructor() {
    this.form = document.querySelector('#FacetFiltersForm');
    this.mobileFilterBtn = document.getElementById('mobileFilterBtn');
    this.sidebarClose = document.getElementById('sidebarClose');
    this.sidebar = document.getElementById('searchSidebar');
    this.overlay = document.getElementById('mobileFilterOverlay');
    
    if (this.form) {
      this.init();
    }
  }

  init() {
    this.setupMobileFilter();
    this.setupFacetChangeListeners();
    this.setupQuickView();
    this.expandFirstFilterSections();
  }

  setupMobileFilter() {
    if (this.mobileFilterBtn) {
      this.mobileFilterBtn.addEventListener('click', () => {
        this.sidebar.classList.add('active');
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    if (this.sidebarClose) {
      this.sidebarClose.addEventListener('click', () => this.closeMobileFilter());
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.closeMobileFilter());
    }
  }

  closeMobileFilter() {
    this.sidebar.classList.remove('active');
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  setupFacetChangeListeners() {
    // Listen for changes on all facet inputs
    this.form.addEventListener('change', (e) => {
      if (e.target.matches('input[name*="filter"], select[name="sort_by"]')) {
        this.submitForm();
      }
    });

    // Setup price range inputs
    const priceInputs = this.form.querySelectorAll('.price-facet__input');
    priceInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.submitForm();
      });
    });
  }

  submitForm() {
    const formData = new FormData(this.form);
    const searchParams = new URLSearchParams(formData);
    
    // Show loading state
    this.showLoadingState();

    // Update URL and fetch new results
    const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
    
    fetch(`${newUrl}&sections=main`)
      .then(response => response.json())
      .then(data => {
        // Update the main content
        const newContent = new DOMParser().parseFromString(data.main, 'text/html');
        const newMainContent = newContent.querySelector('.search-page-container');
        
        if (newMainContent) {
          document.querySelector('.search-page-container').innerHTML = newMainContent.innerHTML;
          
          // Re-initialize after content update
          this.form = document.querySelector('#FacetFiltersForm');
          this.setupFacetChangeListeners();
          this.setupQuickView();
        }

        // Update browser URL without page reload
        history.replaceState({}, '', newUrl);
        
        this.hideLoadingState();
      })
      .catch(error => {
        // Facet update failed
        // Fallback: submit form normally
        this.form.submit();
      });
  }

  showLoadingState() {
    const grid = document.querySelector('.products-grid');
    if (grid) {
      grid.style.opacity = '0.6';
      grid.style.pointerEvents = 'none';
    }
  }

  hideLoadingState() {
    const grid = document.querySelector('.products-grid');
    if (grid) {
      grid.style.opacity = '1';
      grid.style.pointerEvents = 'auto';
    }
  }

  expandFirstFilterSections() {
    // Expand filter sections that have active values
    const filterSections = document.querySelectorAll('.filter-section');
    filterSections.forEach(section => {
      const hasActiveInput = section.querySelector('input:checked');
      const hasActivePriceRange = section.querySelector('.price-facet__input[value]');
      
      if (hasActiveInput || hasActivePriceRange) {
        section.classList.add('expanded');
      }
    });
  }

  setupQuickView() {
    const quickViewBtns = document.querySelectorAll('.quick-view-btn');
    const modal = document.getElementById('quickViewModal');
    const modalContent = document.getElementById('quickViewContent');
    const closeBtn = document.getElementById('quickViewClose');

    quickViewBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const productUrl = btn.dataset.productUrl;
        if (productUrl) {
          this.loadQuickView(productUrl, modalContent, modal);
        }
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      });
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('quick-view-modal__backdrop')) {
          modal.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }
  }

  loadQuickView(productUrl, modalContent, modal) {
    modalContent.innerHTML = '<div class="loading">Laden...</div>';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    fetch(productUrl + '?view=quick')
      .then(response => response.text())
      .then(html => {
        modalContent.innerHTML = html;
        
        // Initialize any product form functionality
        this.initQuickViewForm();
      })
      .catch(error => {
        // Quick view failed
        modalContent.innerHTML = '<div class="error">Fehler beim Laden.</div>';
      });
  }

  initQuickViewForm() {
    const form = document.querySelector('#quickViewModal product-form form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Add to cart via AJAX
        const formData = new FormData(form);
        fetch('/cart/add.js', {
          method: 'POST',
          body: formData
        })
        .then(response => response.json())
        .then(data => {
          // Show success message or update cart
          // Added to cart
          
          // Close modal
          document.getElementById('quickViewModal').classList.remove('active');
          document.body.style.overflow = '';
        })
        .catch(error => {
          // Add to cart failed
        });
      });
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SearchPage();
});

// Reinitialize after dynamic content updates
document.addEventListener('shopify:section:load', () => {
  new SearchPage();
});