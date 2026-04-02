// Radical Search Results JS (structure only)
document.addEventListener('DOMContentLoaded', function() {
  function renderHeroSearchArea(query = '', resultCount = 0) {
    const hero = document.getElementById('search-hero');
    if (!hero) return;
    hero.innerHTML = `
      <div style="max-width:520px;margin:0 auto;text-align:center;padding:32px 0 16px 0;">
        <form id="searchForm" autocomplete="off" style="display:flex;align-items:center;gap:12px;justify-content:center;">
          <input id="searchInput" type="text" placeholder="Produktname, Marke oder Artikelnummer eingeben…" value="${query.replace(/"/g, '&quot;')}" style="flex:1;font-size:1.25rem;padding:18px 20px;border-radius:12px;border:1.5px solid #e0e0e0;outline:none;max-width:400px;box-shadow:0 2px 8px #0001;" autofocus />
          <button id="clearSearch" type="button" style="background:none;border:none;font-size:1.5rem;color:#888;cursor:pointer;display:${query ? 'block' : 'none'};">&times;</button>
        </form>
        <div style="font-size:1.05rem;color:#666;margin-top:8px;">
          ${resultCount} Ergebnisse für „<span id="searchQueryText">${query}</span>“
        </div>
        <div id="searchChips" style="margin-top:12px;"></div>
      </div>
    `;
    // Autofocus workaround for some browsers
    setTimeout(() => {
      document.getElementById('searchInput')?.focus();
    }, 100);
    // Clear button logic
    document.getElementById('clearSearch')?.addEventListener('click', () => {
      document.getElementById('searchInput').value = '';
      document.getElementById('searchInput').focus();
      // Optionally trigger search update here
    });
    // TODO: Add recent/popular searches chips
  }

  renderHeroSearchArea('', 0); // Initial render, can be updated with real query/resultCount
});
