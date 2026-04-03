// Radical Search Results JS (structure only)
document.addEventListener('DOMContentLoaded', function() {
  function escapeHTML(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
  function renderHeroSearchArea(query, resultCount) {
    query = query || '';
    resultCount = resultCount || 0;
    var hero = document.getElementById('search-hero');
    if (!hero) return;
    var safeQuery = escapeHTML(query);
    hero.innerHTML =
      '<div style="max-width:520px;margin:0 auto;text-align:center;padding:32px 0 16px 0;">' +
        '<form id="searchForm" autocomplete="off" style="display:flex;align-items:center;gap:12px;justify-content:center;">' +
          '<input id="searchInput" type="text" placeholder="Produktname, Marke oder Artikelnummer eingeben\u2026" value="' + safeQuery + '" style="flex:1;font-size:1.25rem;padding:18px 20px;border-radius:12px;border:1.5px solid #e0e0e0;outline:none;max-width:400px;box-shadow:0 2px 8px #0001;" autofocus />' +
          '<button id="clearSearch" type="button" style="background:none;border:none;font-size:1.5rem;color:#888;cursor:pointer;display:' + (query ? 'block' : 'none') + ';">&times;</button>' +
        '</form>' +
        '<div style="font-size:1.05rem;color:#666;margin-top:8px;">' +
          resultCount + ' Ergebnisse f\u00fcr \u201e<span id="searchQueryText">' + safeQuery + '</span>\u201c' +
        '</div>' +
        '<div id="searchChips" style="margin-top:12px;"></div>' +
      '</div>';
    setTimeout(function() {
      var input = document.getElementById('searchInput');
      if (input) input.focus();
    }, 100);
    var clearBtn = document.getElementById('clearSearch');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        document.getElementById('searchInput').value = '';
        document.getElementById('searchInput').focus();
      });
    }
  }

  renderHeroSearchArea('', 0);
});
