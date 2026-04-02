/**
 * Thumbnail Gallery Scroll Functionality - Otto Style
 * Fixed container showing 4 thumbnails, arrows scroll within container
 */
(function() {
  'use strict';

  function initThumbnailScroll() {
    const thumbsRail = document.querySelector('.thumbs-rail.is-scroll');
    if (!thumbsRail) return;

    const galleryThumbs = thumbsRail.querySelector('.gallery-thumbs');
    const btnUp = thumbsRail.querySelector('.thumbs-scroll-btn--up');
    const btnDown = thumbsRail.querySelector('.thumbs-scroll-btn--down');

    if (!galleryThumbs || !btnUp || !btnDown) return;

    const thumbItems = Array.from(galleryThumbs.querySelectorAll('.thumb-item'));
    if (thumbItems.length <= 4) {
      btnUp.style.display = 'none';
      btnDown.style.display = 'none';
      return;
    }

    const thumbHeight = thumbItems[0].offsetHeight || 80;
    const gap = 12;
    const scrollStep = (thumbHeight + gap) * 2; // Scroll 2 thumbnails at a time
    const maxScroll = galleryThumbs.scrollHeight - galleryThumbs.clientHeight;

    function updateButtons() {
      const scrollTop = galleryThumbs.scrollTop;
      btnUp.style.opacity = scrollTop > 5 ? '1' : '0.3';
      btnUp.style.pointerEvents = scrollTop > 5 ? 'auto' : 'none';
      btnDown.style.opacity = scrollTop < maxScroll - 5 ? '1' : '0.3';
      btnDown.style.pointerEvents = scrollTop < maxScroll - 5 ? 'auto' : 'none';
    }

    // Scroll down
    btnDown.addEventListener('click', function() {
      galleryThumbs.scrollBy({
        top: scrollStep,
        behavior: 'smooth'
      });
    });

    // Scroll up
    btnUp.addEventListener('click', function() {
      galleryThumbs.scrollBy({
        top: -scrollStep,
        behavior: 'smooth'
      });
    });

    // Update buttons on scroll (throttled with RAF)
    let thumbScrollTicking = false;
    galleryThumbs.addEventListener('scroll', function() {
      if (!thumbScrollTicking) {
        requestAnimationFrame(function() {
          updateButtons();
          thumbScrollTicking = false;
        });
        thumbScrollTicking = true;
      }
    }, { passive: true });

    // Initial state
    updateButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThumbnailScroll);
  } else {
    initThumbnailScroll();
  }
})();
