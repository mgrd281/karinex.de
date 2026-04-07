/* Collection Filters & Popularity Sort — extracted for deferred loading */
if (!window.__collectionFilterInit) {
  window.__collectionFilterInit = true;
  document.addEventListener('DOMContentLoaded', function() {

    function syncCheckboxes(changed, cls, attr) {
      if (!changed) return;
      var val = changed.getAttribute(attr);
      var checked = changed.checked;
      document.querySelectorAll('.' + cls + '[' + attr + '="' + val + '"]').forEach(function(cb) {
        cb.checked = checked;
      });
    }

    function applyFilters() {
      var selectedVendors = new Set();
      document.querySelectorAll('.js-vendor-checkbox:checked').forEach(function(cb) {
        selectedVendors.add(cb.getAttribute('data-vendor-name'));
      });

      var selectedAges = new Set();
      document.querySelectorAll('.js-age-checkbox:checked').forEach(function(cb) {
        selectedAges.add(cb.getAttribute('data-age-value'));
      });

      var selectedGenders = new Set();
      document.querySelectorAll('.js-gender-checkbox:checked').forEach(function(cb) {
        selectedGenders.add(cb.getAttribute('data-gender-value'));
      });

      var selectedDiscounts = new Set();
      document.querySelectorAll('.js-discount-checkbox:checked').forEach(function(cb) {
        selectedDiscounts.add(cb.getAttribute('data-discount-value'));
      });

      var selectedCategories = new Set();
      document.querySelectorAll('.js-category-checkbox:checked').forEach(function(cb) {
        selectedCategories.add(cb.getAttribute('data-category-value'));
      });

      var selectedColors = new Set();
      document.querySelectorAll('.js-color-checkbox:checked').forEach(function(cb) {
        selectedColors.add(cb.getAttribute('data-color-value'));
      });

      var selectedDurchmessers = new Set();
      document.querySelectorAll('.js-durchmesser-checkbox:checked').forEach(function(cb) {
        selectedDurchmessers.add(cb.getAttribute('data-durchmesser-value'));
      });

      var selectedZubehoerstyps = new Set();
      document.querySelectorAll('.js-zubehoerstyp-checkbox:checked').forEach(function(cb) {
        selectedZubehoerstyps.add(cb.getAttribute('data-zubehoerstyp-value'));
      });

      // Update vendor count badges
      document.querySelectorAll('.vendor-filter-count').forEach(function(el) {
        if (selectedVendors.size > 0) {
          el.textContent = selectedVendors.size;
          el.className = 'vendor-filter-count bubble facets__bubble';
          el.style.display = '';
        } else {
          el.textContent = '';
          el.style.display = 'none';
        }
      });

      // Update age count badges
      document.querySelectorAll('.age-filter-count').forEach(function(el) {
        if (selectedAges.size > 0) {
          el.textContent = selectedAges.size;
          el.className = 'age-filter-count bubble facets__bubble';
          el.style.display = '';
        } else {
          el.textContent = '';
          el.style.display = 'none';
        }
      });

      // Update gender count badges
      document.querySelectorAll('.gender-filter-count').forEach(function(el) {
        if (selectedGenders.size > 0) {
          el.textContent = selectedGenders.size;
          el.className = 'gender-filter-count bubble facets__bubble';
          el.style.display = '';
        } else {
          el.textContent = '';
          el.style.display = 'none';
        }
      });

      // Update discount count badges
      document.querySelectorAll('.discount-filter-count').forEach(function(el) {
        if (selectedDiscounts.size > 0) {
          el.textContent = selectedDiscounts.size;
          el.className = 'discount-filter-count bubble facets__bubble';
          el.style.display = '';
        } else {
          el.textContent = '';
          el.style.display = 'none';
        }
      });

      // Update category count badges
      document.querySelectorAll('.category-filter-count').forEach(function(el) {
        if (selectedCategories.size > 0) {
          el.textContent = selectedCategories.size;
          el.className = 'category-filter-count bubble facets__bubble';
          el.style.display = '';
        } else {
          el.textContent = '';
          el.style.display = 'none';
        }
      });

      // Update color count badges
      document.querySelectorAll('.color-filter-count').forEach(function(el) {
        if (selectedColors.size > 0) {
          el.textContent = selectedColors.size;
          el.className = 'color-filter-count bubble facets__bubble';
          el.style.display = '';
        } else {
          el.textContent = '';
          el.style.display = 'none';
        }
      });

      // Update durchmesser count badges
      document.querySelectorAll('.durchmesser-filter-count').forEach(function(el) {
        if (selectedDurchmessers.size > 0) {
          el.textContent = selectedDurchmessers.size;
          el.className = 'durchmesser-filter-count bubble facets__bubble';
          el.style.display = '';
        } else {
          el.textContent = '';
          el.style.display = 'none';
        }
      });

      // Update zubehoerstyp count badges
      document.querySelectorAll('.zubehoerstyp-filter-count').forEach(function(el) {
        if (selectedZubehoerstyps.size > 0) {
          el.textContent = selectedZubehoerstyps.size;
          el.className = 'zubehoerstyp-filter-count bubble facets__bubble';
          el.style.display = '';
        } else {
          el.textContent = '';
          el.style.display = 'none';
        }
      });

      // Filter items — AND logic: must match all active filters
      var items = document.querySelectorAll('.product-grid__item');
      items.forEach(function(item) {
        var vendorMatch = selectedVendors.size === 0 || selectedVendors.has(item.getAttribute('data-vendor'));
        var itemAge = item.getAttribute('data-age') || '';
        var ageMatch = selectedAges.size === 0 || selectedAges.has(itemAge);
        var itemGender = item.getAttribute('data-gender') || '';
        var genderMatch = selectedGenders.size === 0 || selectedGenders.has(itemGender);
        var itemDiscount = item.getAttribute('data-discount') || '';
        var discountMatch = selectedDiscounts.size === 0 || selectedDiscounts.has(itemDiscount);
        var itemCategory = item.getAttribute('data-category') || '';
        var categoryMatch = selectedCategories.size === 0 || selectedCategories.has(itemCategory);
        var itemColor = item.getAttribute('data-color') || '';
        var colorMatch = selectedColors.size === 0 || selectedColors.has(itemColor);
        var itemDurchmesser = item.getAttribute('data-durchmesser') || '';
        var durchmesserMatch = selectedDurchmessers.size === 0 || selectedDurchmessers.has(itemDurchmesser);
        var itemZubehoerstyp = item.getAttribute('data-zubehoerstyp') || '';
        var zubehoerstypMatch = selectedZubehoerstyps.size === 0 || selectedZubehoerstyps.has(itemZubehoerstyp);
        item.style.display = (vendorMatch && ageMatch && genderMatch && discountMatch && categoryMatch && colorMatch && durchmesserMatch && zubehoerstypMatch) ? '' : 'none';
      });
    }

    // Event delegation for all filters
    document.addEventListener('change', function(e) {
      if (e.target.classList && e.target.classList.contains('js-vendor-checkbox')) {
        syncCheckboxes(e.target, 'js-vendor-checkbox', 'data-vendor-name');
        applyFilters();
      }
      if (e.target.classList && e.target.classList.contains('js-age-checkbox')) {
        syncCheckboxes(e.target, 'js-age-checkbox', 'data-age-value');
        applyFilters();
      }
      if (e.target.classList && e.target.classList.contains('js-gender-checkbox')) {
        syncCheckboxes(e.target, 'js-gender-checkbox', 'data-gender-value');
        applyFilters();
      }
      if (e.target.classList && e.target.classList.contains('js-discount-checkbox')) {
        syncCheckboxes(e.target, 'js-discount-checkbox', 'data-discount-value');
        applyFilters();
      }
      if (e.target.classList && e.target.classList.contains('js-category-checkbox')) {
        syncCheckboxes(e.target, 'js-category-checkbox', 'data-category-value');
        applyFilters();
      }
      if (e.target.classList && e.target.classList.contains('js-color-checkbox')) {
        syncCheckboxes(e.target, 'js-color-checkbox', 'data-color-value');
        applyFilters();
      }
      if (e.target.classList && e.target.classList.contains('js-durchmesser-checkbox')) {
        syncCheckboxes(e.target, 'js-durchmesser-checkbox', 'data-durchmesser-value');
        applyFilters();
      }
      if (e.target.classList && e.target.classList.contains('js-zubehoerstyp-checkbox')) {
        syncCheckboxes(e.target, 'js-zubehoerstyp-checkbox', 'data-zubehoerstyp-value');
        applyFilters();
      }
    });

    // Re-apply filters when infinite scroll loads new items
    var observer = new MutationObserver(function() {
      var hasActive = document.querySelector('.js-vendor-checkbox:checked') ||
                      document.querySelector('.js-age-checkbox:checked') ||
                      document.querySelector('.js-gender-checkbox:checked') ||
                      document.querySelector('.js-discount-checkbox:checked') ||
                      document.querySelector('.js-category-checkbox:checked') ||
                      document.querySelector('.js-color-checkbox:checked') ||
                      document.querySelector('.js-durchmesser-checkbox:checked') ||
                      document.querySelector('.js-zubehoerstyp-checkbox:checked');
      if (hasActive) {
        applyFilters();
      }
    });

    var productGrid = document.querySelector('.product-grid');
    if (productGrid) {
      observer.observe(productGrid, { childList: true, subtree: true });
    }

    // Live Popularity Sorting
    function sortProductsByMetafield() {
      var grid = document.querySelector('.collection-wrapper.grid');
      if (!grid) {
        grid = document.querySelector('results-list .collection-wrapper');
      }
      var searchStr = window.location.search || '';
      
      // Only auto-sort if no manual sort_by is enforced, or if it's best-selling/manual
      if (!searchStr.includes('sort_by') || searchStr.includes('sort_by=manual') || searchStr.includes('sort_by=best-selling')) {
        var itemsContainer = document.querySelector('.product-grid') || grid;
        if (!itemsContainer) return;
        
        var items = Array.from(itemsContainer.querySelectorAll('li.product-grid__item'));
        if (items.length <= 1) return;
        
        items.sort(function(a, b) {
          var countA = parseInt(a.getAttribute('data-sold') || '0', 10);
          var countB = parseInt(b.getAttribute('data-sold') || '0', 10);
          return countB - countA;
        });
        
        // Using a DocumentFragment ensures reflow is minimized
        var df = document.createDocumentFragment();
        items.forEach(function(item) {
          df.appendChild(item);
        });
        itemsContainer.appendChild(df);
      }
    }
    
    // Execute the sorting immediately
    sortProductsByMetafield();
  });
}
