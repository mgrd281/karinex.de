// Instant Blog Indexing System
class BlogInstantIndexer {
  constructor() {
    this.apiEndpoints = {
      google: 'https://blogsearch.google.com/ping/RPC2',
      bing: 'https://www.bing.com/ping.aspx',
      pubsubhubbub: 'https://pubsubhubbub.appspot.com/'
    };

    this.init();
  }

  init() {
    // Check if this is a new article
    if (this.isNewArticle()) {
      this.startIndexingProcess();
    }

    // Setup Service Worker for background indexing
    this.setupServiceWorker();
  }

  isNewArticle() {
    const publishDate = new Date(document.querySelector('meta[property="article:published_time"]')?.content || '');
    const now = new Date();
    const hoursSincePublished = (now - publishDate) / (1000 * 60 * 60);
    return hoursSincePublished <= 2; // Articles published within 2 hours
  }

  startIndexingProcess() {

    // Phase 1: Browser-side pings are deactivated (CORS restrictions).
    // Discovery relies on updated Sitemaps and Schema.

    // Phase 2: RSS feed updates (optional triggering)
    setTimeout(() => this.updateRSSFeeds(), 5000);

    // Phase 3: API submissions preparation
    setTimeout(() => this.submitToAPIs(), 10000);

    // Phase 4: Social media signals
    setTimeout(() => this.generateSocialSignals(), 15000);
  }

  // Note: Pings were removed here due to CORS.
  // Use Google Search Console for manual submission.

  generateGooglePingXML(url) {
    const siteName = document.querySelector('meta[property="og:site_name"]')?.content || 'Blog';
    const rssUrl = `${window.location.origin}/blogs/main.atom`;

    return `<?xml version="1.0" encoding="UTF-8"?>
    <methodCall>
      <methodName>weblogUpdates.extendedPing</methodName>
      <params>
        <param><value>${siteName}</value></param>
        <param><value>${window.location.origin}/blogs/main</value></param>
        <param><value>${url}</value></param>
        <param><value>${rssUrl}</value></param>
      </params>
    </methodCall>`;
  }

  async updateRSSFeeds() {
    // Trigger RSS update via PubSubHubbub
    try {
      const rssUrl = `${window.location.origin}/blogs/main.atom`;
      await fetch(this.apiEndpoints.pubsubhubbub, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `hub.mode=publish&hub.url=${encodeURIComponent(rssUrl)}`
      });
    } catch (e) {
    }
  }

  async submitToAPIs() {
    const url = window.location.href;
    const articleData = this.extractArticleData();

    // This would require server-side implementation
    // For now, we'll prepare the data
    const submissionData = {
      url: url,
      type: 'URL_UPDATED',
      article: articleData,
      timestamp: new Date().toISOString()
    };


    // Store for Service Worker to process
    localStorage.setItem('pendingIndexSubmission', JSON.stringify(submissionData));
  }

  extractArticleData() {
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      image: document.querySelector('meta[property="og:image"]')?.content,
      publishedAt: document.querySelector('meta[property="article:published_time"]')?.content,
      modifiedAt: document.querySelector('meta[property="article:modified_time"]')?.content,
      author: document.querySelector('meta[property="article:author"]')?.content,
      tags: Array.from(document.querySelectorAll('meta[property="article:tag"]')).map(tag => tag.content),
      wordCount: document.querySelector('.blog-main-content')?.innerText.split(' ').length || 0
    };
  }

  async generateSocialSignals() {
    // Simulate social media signals for SEO
    const shareButtons = document.querySelectorAll('.share-btn');

    // Add priority class to new articles
    shareButtons.forEach(btn => {
      btn.classList.add('priority-indexing');
    });

  }

  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data.type === 'INDEX_COMPLETE') {
          }
        });

        // Register for background sync
        return registration.sync.register('blog-indexing');
      });
    }
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new BlogInstantIndexer());
} else {
  new BlogInstantIndexer();
}

// Export for potential manual triggering
window.BlogInstantIndexer = BlogInstantIndexer;
