/**
 * Animated Trend Icon Component
 * Provides multiple animation styles for trend icons
 */

class AnimatedTrendIcon {
  constructor(selector = '.animated-trend-icon', animationType = 'bounce') {
    this.icon = document.querySelector(selector);
    this.animationType = animationType;
    this.isAnimating = false;
    
    if (this.icon) {
      this.init();
    }
  }

  init() {
    this.applyAnimationType();
    this.addInteractions();
  }

  applyAnimationType() {
    // Remove all animation classes
    this.icon.classList.remove('rotation', 'pulse', 'glow', 'wave', 'bounce');
    
    // Add the selected animation class
    if (this.animationType !== 'bounce') {
      this.icon.classList.add(this.animationType);
    }
  }

  addInteractions() {
    this.icon.addEventListener('mouseenter', () => this.onHover());
    this.icon.addEventListener('mouseleave', () => this.onHoverEnd());
    this.icon.addEventListener('click', () => this.triggerPulse());
  }

  onHover() {
    if (!this.isAnimating) {
      this.icon.style.animationPlayState = 'paused';
    }
  }

  onHoverEnd() {
    if (!this.isAnimating) {
      this.icon.style.animationPlayState = 'running';
    }
  }

  triggerPulse() {
    this.isAnimating = true;
    this.icon.style.animation = 'none';
    
    setTimeout(() => {
      this.icon.style.animation = '';
      this.applyAnimationType();
      this.isAnimating = false;
    }, 50);
  }

  setAnimationType(type) {
    this.animationType = type;
    this.applyAnimationType();
  }

  stop() {
    this.icon.style.animation = 'none';
  }

  start() {
    this.icon.style.animation = '';
    this.applyAnimationType();
  }
}

// Auto-initialize all trend icons on page load
document.addEventListener('DOMContentLoaded', () => {
  const trendIcons = document.querySelectorAll('.animated-trend-icon-wrapper');
  trendIcons.forEach((wrapper) => {
    new AnimatedTrendIcon(
      wrapper.querySelector('.trend-icon'),
      wrapper.dataset.animation || 'bounce'
    );
  });
});

// Export for manual usage
if (typeof window !== 'undefined') {
  window.AnimatedTrendIcon = AnimatedTrendIcon;
}
