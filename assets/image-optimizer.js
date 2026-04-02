/**
 * Optimize all Shopify CDN images by adding proper srcset and sizes
 * This reduces image payload significantly by serving appropriately sized images
 */

document.addEventListener('DOMContentLoaded', function () {
    // Find all images from Shopify CDN
    const images = document.querySelectorAll('img[src*="cdn.shopify.com"]');

    images.forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        const originalSrc = img.src;

        // Skip if already has srcset
        if (img.hasAttribute('srcset')) return;

        // Skip SVG images
        if (originalSrc.includes('.svg')) return;

        // Extract base URL and parameters
        const urlParts = originalSrc.split('?');
        const baseUrl = urlParts[0];
        const params = new URLSearchParams(urlParts[1] || '');

        // Generate srcset with multiple sizes
        const sizes = [400, 600, 800, 1200];
        const srcsetParts = sizes.map(size => {
            const newParams = new URLSearchParams(params);
            newParams.set('width', size.toString());
            // Force WebP format so bots and all clients get compressed images
            if (!newParams.has('format')) newParams.set('format', 'webp');
            return `${baseUrl}?${newParams.toString()} ${size}w`;
        });

        // Set srcset
        img.setAttribute('srcset', srcsetParts.join(', '));

        // Set sizes based on image class or default
        if (img.classList.contains('prod') || img.closest('.col-right')) {
            // Product images in slider
            img.setAttribute('sizes', '(max-width: 600px) 200px, (max-width: 1200px) 280px, 360px');
        } else if (img.classList.contains('slide-bg-image')) {
            // Background images
            img.setAttribute('sizes', '100vw');
        } else {
            // Default: assume full width on mobile, half on desktop
            img.setAttribute('sizes', '(max-width: 750px) 100vw, 50vw');
        }

        // Add loading="lazy" for images not in viewport
        if (!img.hasAttribute('fetchpriority')) {
            const rect = img.getBoundingClientRect();
            const isInViewport = (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );

            if (!isInViewport) {
                img.setAttribute('loading', 'lazy');
            }
        }
    });
});
