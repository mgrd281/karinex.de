/**
 * KARINEX Premium Gift Cards Page
 * Interactive functionality with live preview
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  const state = {
    amount: 25,
    recipientName: '',
    senderName: '',
    message: '',
    recipientEmail: '',
    deliveryType: 'now',
    deliveryDate: null
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  const elements = {
    amountCards: document.querySelectorAll('[data-amount]'),
    customAmountInput: document.querySelector('[data-custom-amount]'),
    recipientNameInput: document.querySelector('[data-recipient-name]'),
    senderNameInput: document.querySelector('[data-sender-name]'),
    messageInput: document.querySelector('[data-message]'),
    recipientEmailInput: document.querySelector('[data-recipient-email]'),
    deliveryOptions: document.querySelectorAll('[data-delivery-option]'),
    datePicker: document.querySelector('[data-date-picker]'),
    deliveryDateInput: document.querySelector('[data-delivery-date]'),
    previewAmount: document.querySelector('[data-preview-amount]'),
    previewRecipient: document.querySelector('[data-preview-recipient]'),
    previewMessage: document.querySelector('[data-preview-message]'),
    buyButton: document.querySelector('[data-buy-button]'),
    stickyPrice: document.querySelector('[data-sticky-price]'),
    stickyBuyButton: document.querySelector('[data-sticky-buy-button]'),
    stickyCta: document.querySelector('[data-sticky-cta]')
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  function init() {
    if (!document.querySelector('[data-gift-cards-page]')) return;
    
    setupAmountSelection();
    setupPersonalization();
    setupDeliveryOptions();
    setupBuyButtons();
    setupStickyBehavior();
    setMinDate();
    
    // Initial preview update
    updatePreview();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AMOUNT SELECTION
  // ═══════════════════════════════════════════════════════════════════════════
  function setupAmountSelection() {
    // Card selection
    elements.amountCards.forEach(card => {
      card.addEventListener('click', () => selectAmount(card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectAmount(card);
        }
      });
    });

    // Custom amount
    if (elements.customAmountInput) {
      elements.customAmountInput.addEventListener('input', handleCustomAmount);
      elements.customAmountInput.addEventListener('focus', () => {
        // Deselect all cards when focusing custom input
        elements.amountCards.forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-pressed', 'false');
        });
      });
    }
  }

  function selectAmount(card) {
    // Remove selection from all cards
    elements.amountCards.forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-pressed', 'false');
    });

    // Select clicked card
    card.classList.add('selected');
    card.setAttribute('aria-pressed', 'true');

    // Update state
    state.amount = parseInt(card.dataset.amount, 10);

    // Clear custom input
    if (elements.customAmountInput) {
      elements.customAmountInput.value = '';
    }

    // Animate selection
    card.style.transform = 'scale(0.95)';
    setTimeout(() => {
      card.style.transform = '';
    }, 100);

    updatePreview();
  }

  function handleCustomAmount(e) {
    const value = parseInt(e.target.value, 10);
    
    if (value && value >= 10 && value <= 500) {
      state.amount = value;
      
      // Deselect all preset cards
      elements.amountCards.forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      
      updatePreview();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONALIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  function setupPersonalization() {
    // Recipient name
    if (elements.recipientNameInput) {
      elements.recipientNameInput.addEventListener('input', (e) => {
        state.recipientName = e.target.value;
        updatePreview();
      });
    }

    // Sender name
    if (elements.senderNameInput) {
      elements.senderNameInput.addEventListener('input', (e) => {
        state.senderName = e.target.value;
      });
    }

    // Message
    if (elements.messageInput) {
      elements.messageInput.addEventListener('input', (e) => {
        state.message = e.target.value;
        updatePreview();
      });
    }

    // Email
    if (elements.recipientEmailInput) {
      elements.recipientEmailInput.addEventListener('input', (e) => {
        state.recipientEmail = e.target.value;
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELIVERY OPTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  function setupDeliveryOptions() {
    elements.deliveryOptions.forEach(option => {
      option.addEventListener('change', (e) => {
        // Update visual state
        document.querySelectorAll('.gc-delivery-option').forEach(opt => {
          opt.classList.remove('selected');
        });
        e.target.closest('.gc-delivery-option').classList.add('selected');

        // Update state
        state.deliveryType = e.target.value;

        // Toggle date picker
        if (elements.datePicker) {
          if (state.deliveryType === 'later') {
            elements.datePicker.classList.add('visible');
          } else {
            elements.datePicker.classList.remove('visible');
          }
        }
      });
    });

    // Delivery date
    if (elements.deliveryDateInput) {
      elements.deliveryDateInput.addEventListener('change', (e) => {
        state.deliveryDate = e.target.value;
      });
    }
  }

  function setMinDate() {
    if (elements.deliveryDateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      elements.deliveryDateInput.min = tomorrow.toISOString().split('T')[0];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIVE PREVIEW
  // ═══════════════════════════════════════════════════════════════════════════
  function updatePreview() {
    // Amount
    if (elements.previewAmount) {
      elements.previewAmount.textContent = `${state.amount}€`;
      
      // Animate change
      elements.previewAmount.style.transform = 'scale(1.1)';
      setTimeout(() => {
        elements.previewAmount.style.transform = '';
      }, 150);
    }

    // Recipient name
    if (elements.previewRecipient) {
      elements.previewRecipient.textContent = state.recipientName || 'Empfänger Name';
    }

    // Message
    if (elements.previewMessage) {
      if (state.message) {
        elements.previewMessage.textContent = `"${state.message}"`;
        elements.previewMessage.style.display = 'block';
      } else {
        elements.previewMessage.style.display = 'none';
      }
    }

    // Sticky price
    if (elements.stickyPrice) {
      elements.stickyPrice.textContent = `${state.amount}€`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUY BUTTONS
  // ═══════════════════════════════════════════════════════════════════════════
  function setupBuyButtons() {
    const handleBuy = () => {
      if (!validateForm()) return;
      
      // Create cart item data
      const giftCardData = {
        amount: state.amount,
        recipientName: state.recipientName,
        recipientEmail: state.recipientEmail,
        senderName: state.senderName,
        message: state.message,
        deliveryType: state.deliveryType,
        deliveryDate: state.deliveryDate
      };

      // Store in session for checkout
      sessionStorage.setItem('giftCardData', JSON.stringify(giftCardData));

      // Find gift card product and add to cart
      addGiftCardToCart(giftCardData);
    };

    if (elements.buyButton) {
      elements.buyButton.addEventListener('click', handleBuy);
    }

    if (elements.stickyBuyButton) {
      elements.stickyBuyButton.addEventListener('click', handleBuy);
    }
  }

  function validateForm() {
    let isValid = true;
    const errors = [];

    if (!state.recipientName.trim()) {
      errors.push('Bitte gib den Namen des Empfängers ein');
      isValid = false;
    }

    if (!state.recipientEmail.trim()) {
      errors.push('Bitte gib die E-Mail des Empfängers ein');
      isValid = false;
    } else if (!isValidEmail(state.recipientEmail)) {
      errors.push('Bitte gib eine gültige E-Mail-Adresse ein');
      isValid = false;
    }

    if (state.deliveryType === 'later' && !state.deliveryDate) {
      errors.push('Bitte wähle ein Versanddatum');
      isValid = false;
    }

    if (!isValid) {
      showError(errors[0]);
      
      // Scroll to form
      document.querySelector('.gc-form').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }

    return isValid;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showError(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'gc-toast gc-toast--error';
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <span>${message}</span>
    `;
    
    // Style toast
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#ff4757',
      color: 'white',
      padding: '14px 24px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 4px 20px rgba(255, 71, 87, 0.3)',
      zIndex: '9999',
      fontSize: '0.95rem',
      fontWeight: '600',
      animation: 'slideDown 0.3s ease'
    });

    document.body.appendChild(toast);

    // Remove after 3s
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async function addGiftCardToCart(data) {
    // Show loading state
    const buttons = [elements.buyButton, elements.stickyBuyButton].filter(Boolean);
    buttons.forEach(btn => {
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="gc-spinner" width="20" height="20" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="60" stroke-dashoffset="20">
            <animateTransform attributeName="transform" type="rotate" dur="1s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
          </circle>
        </svg>
        Wird hinzugefügt...
      `;
    });

    try {
      // Search for gift card product in the store
      const searchResponse = await fetch('/search/suggest.json?q=geschenkkarte&resources[type]=product&resources[limit]=5');
      const searchData = await searchResponse.json();
      
      let giftCardProduct = null;
      let variantId = null;
      
      // Check if we found a gift card product
      if (searchData.resources?.results?.products?.length > 0) {
        const products = searchData.resources.results.products;
        giftCardProduct = products.find(p => 
          p.title.toLowerCase().includes('geschenkkarte') || 
          p.title.toLowerCase().includes('gift card') ||
          p.title.toLowerCase().includes('gutschein')
        );
        
        if (giftCardProduct) {
          // Fetch product details to get variants
          const productResponse = await fetch(`${giftCardProduct.url}.js`);
          const productData = await productResponse.json();
          
          // Find variant matching selected amount
          const matchingVariant = productData.variants.find(v => {
            const variantPrice = v.price / 100;
            return variantPrice === data.amount;
          });
          
          if (matchingVariant) {
            variantId = matchingVariant.id;
          } else {
            // Use first available variant
            variantId = productData.variants[0]?.id;
          }
        }
      }
      
      if (variantId) {
        // Add to cart with line item properties
        const formData = {
          items: [{
            id: variantId,
            quantity: 1,
            properties: {
              '_Empfänger': data.recipientName,
              '_E-Mail': data.recipientEmail,
              '_Von': data.senderName || 'KARINEX Shop',
              '_Nachricht': data.message || '',
              '_Versand': data.deliveryType === 'now' ? 'Sofort' : data.deliveryDate
            }
          }]
        };

        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          showSuccess('Geschenkkarte wurde hinzugefügt!');
          setTimeout(() => {
            window.location.href = '/cart';
          }, 1000);
          return;
        }
      }
      
      // If no product found or cart add failed, show contact option
      showGiftCardModal(data);
      
    } catch (error) {
      console.error('Error adding gift card:', error);
      showGiftCardModal(data);
    } finally {
      // Reset buttons
      resetButtons(buttons);
    }
  }
  
  function showGiftCardModal(data) {
    // Create modal for gift card request
    const modal = document.createElement('div');
    modal.className = 'gc-modal';
    modal.innerHTML = `
      <div class="gc-modal__backdrop"></div>
      <div class="gc-modal__content">
        <button class="gc-modal__close" aria-label="Schließen">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        
        <div class="gc-modal__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7"/>
            <path d="M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7z"/>
            <path d="M12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z"/>
          </svg>
        </div>
        
        <h3 class="gc-modal__title">Geschenkkarte anfragen</h3>
        <p class="gc-modal__text">
          Deine ${data.amount}€ Geschenkkarte für <strong>${data.recipientName}</strong> wird per E-Mail versendet.
        </p>
        
        <div class="gc-modal__summary">
          <div class="gc-modal__row">
            <span>Betrag:</span>
            <strong>${data.amount}€</strong>
          </div>
          <div class="gc-modal__row">
            <span>Empfänger:</span>
            <strong>${data.recipientName}</strong>
          </div>
          <div class="gc-modal__row">
            <span>E-Mail:</span>
            <strong>${data.recipientEmail}</strong>
          </div>
          ${data.message ? `
          <div class="gc-modal__row">
            <span>Nachricht:</span>
            <strong>"${data.message}"</strong>
          </div>
          ` : ''}
        </div>
        
        <a href="mailto:info@karinex.de?subject=Geschenkkarte%20${data.amount}€%20für%20${encodeURIComponent(data.recipientName)}&body=Hallo,%0A%0Aich%20möchte%20eine%20Geschenkkarte%20bestellen:%0A%0ABetrag:%20${data.amount}€%0AEmpfänger:%20${encodeURIComponent(data.recipientName)}%0AE-Mail:%20${encodeURIComponent(data.recipientEmail)}%0ANachricht:%20${encodeURIComponent(data.message || '-')}%0AVersand:%20${data.deliveryType === 'now' ? 'Sofort' : data.deliveryDate}%0A%0AVielen%20Dank!" 
           class="gc-modal__button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Per E-Mail anfragen
        </a>
        
        <p class="gc-modal__note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          Wir melden uns innerhalb von 24 Stunden bei dir.
        </p>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .gc-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeIn 0.3s ease;
      }
      .gc-modal__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
      }
      .gc-modal__content {
        position: relative;
        background: white;
        border-radius: 20px;
        padding: 40px;
        max-width: 440px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.4s ease;
      }
      .gc-modal__close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: #f3f4f6;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      .gc-modal__close:hover {
        background: #e5e7eb;
        transform: rotate(90deg);
      }
      .gc-modal__icon {
        width: 80px;
        height: 80px;
        margin: 0 auto 20px;
        background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #00a651;
      }
      .gc-modal__title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1a1a2e;
        margin: 0 0 12px;
      }
      .gc-modal__text {
        color: #6b7280;
        margin: 0 0 24px;
        line-height: 1.6;
      }
      .gc-modal__summary {
        background: #f9fafb;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 24px;
        text-align: left;
      }
      .gc-modal__row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 0.95rem;
      }
      .gc-modal__row:last-child {
        border-bottom: none;
      }
      .gc-modal__row span {
        color: #6b7280;
      }
      .gc-modal__row strong {
        color: #1a1a2e;
      }
      .gc-modal__button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 16px 24px;
        background: linear-gradient(135deg, #00a651 0%, #008c45 100%);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 1.05rem;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s;
      }
      .gc-modal__button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 166, 81, 0.4);
      }
      .gc-modal__note {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin: 16px 0 0;
        font-size: 0.85rem;
        color: #9ca3af;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Close handlers
    const closeModal = () => {
      modal.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(() => modal.remove(), 200);
    };
    
    modal.querySelector('.gc-modal__close').addEventListener('click', closeModal);
    modal.querySelector('.gc-modal__backdrop').addEventListener('click', closeModal);
  }
  
  function resetButtons(buttons) {
    buttons.forEach(btn => {
      btn.disabled = false;
    });
    if (elements.buyButton) {
      elements.buyButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
        </svg>
        Jetzt Geschenkkarte kaufen
      `;
    }
    if (elements.stickyBuyButton) {
      elements.stickyBuyButton.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
        </svg>
        Jetzt kaufen
      `;
    }
  }

  function showSuccess(message) {
    const toast = document.createElement('div');
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>${message}</span>
    `;
    
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#00a651',
      color: 'white',
      padding: '14px 24px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 4px 20px rgba(0, 166, 81, 0.3)',
      zIndex: '9999',
      fontSize: '0.95rem',
      fontWeight: '600'
    });

    document.body.appendChild(toast);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STICKY BEHAVIOR
  // ═══════════════════════════════════════════════════════════════════════════
  function setupStickyBehavior() {
    if (!elements.stickyCta) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          elements.stickyCta.style.transform = 'translateY(100%)';
        } else {
          elements.stickyCta.style.transform = 'translateY(0)';
        }
      });
    }, {
      threshold: 0.1
    });

    const selectionSection = document.querySelector('.gc-selection');
    if (selectionSection) {
      observer.observe(selectionSection);
    }

    // Add transition
    elements.stickyCta.style.transition = 'transform 0.3s ease';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SMOOTH SCROLL
  // ═══════════════════════════════════════════════════════════════════════════
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ADD CSS ANIMATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes slideUp {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
    .gc-spinner {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT ON DOM READY
  // ═══════════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
