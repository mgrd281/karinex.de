# Karinex.de 404 & Broken Links - Strategic Action Plan
**Analysis Date:** April 4, 2026  
**Report Source:** Ahrefs Site Audit (49 × 404 pages, 233 × broken links)

---

## EXECUTIVE SUMMARY

### Critical Finding: URL Construction Bug
Your site has a **systematic URL malformation issue** affecting 80% of broken links. Language locale prefixes (`/en/`, `/pl/`) are being concatenated without proper spacing, creating URLs like `/encollections/` instead of `/en/collections/`.

**Impact:** 
- ~200+ broken internal links across dozens of 404 URLs
- Affecting high-authority product pages (PR 21-26)
- Primarily impacting vendor filter URLs (site search/faceted navigation)

**Fix Difficulty:** ⚠️ **HIGH PRIORITY - Template-Level Bug** (1-2 hours dev time)

---

## TOP 10 CRITICAL 404 URLs

| Rank | 404 URL | PR | Inlinks | Root Cause | Fix Priority |
|------|---------|----|---------|-----------|----|
| 1 | `/collections/vendors` | 4 | 234 | Locale path malformation + missing leading locale prefix | **CRITICAL** |
| 2 | `/en/collections/vendors` | 2 | 117 | Missing slash between locale & path | **CRITICAL** |
| 3 | `/pl/collections/vendors` | 2 | 117 | Missing slash between locale & path | **CRITICAL** |
| 4 | `/encollections/vendors?q=Microsoft` | 2 | 135 | Locale prefix concatenation bug in template | **CRITICAL** |
| 5 | `/plcollections/vendors?q=Microsoft` | 2 | 135 | Locale prefix concatenation bug in template | **CRITICAL** |
| 6 | `/encollections/vendors?q=Michael%20Kors` | 0 | 30 | Locale prefix concatenation bug | **HIGH** |
| 7 | `/plcollections/vendors?q=Michael%20Kors` | 0 | 30 | Locale prefix concatenation bug | **HIGH** |
| 8 | `/encollections/vendors?q=LEGO%C2%AE` | 0 | 15 | Locale prefix concatenation bug | **HIGH** |
| 9 | `/plcollections/vendors?q=LEGO%C2%AE` | 0 | 15 | Locale prefix concatenation bug | **HIGH** |
| 10 | `/en/products/windows-11-pro` | 0 | 1 | Product URL changed/deleted | **MEDIUM** |

**Total Impact:** ~430 inlinks spread across these top 10 URLs alone.

---

## TOP 10 PAGES LINKING TO BROKEN PAGES

| Rank | Page URL | PR | Type | Broken Link Target | Inlinks to 404 |
|------|----------|----|----|-------|---------|
| 1 | `/policies/legal-notice` | 70 | **LEGAL PAGE - HIGH AUTHORITY** | Trustami (external 403) | 2 |
| 2-50 | `/en/products/[microsoft-office/windows/visio]` | 21 | Product Pages | `/encollections/vendors?q=Microsoft*` | 30+ |
| 2-50 | `/pl/products/[microsoft-office/windows/visio]` | 21 | Product Pages | `/plcollections/vendors?q=Microsoft*` | 30+ |
| 35-60 | `/en/products/[boss-watch]` | 26 | Product Pages | `/encollections/vendors?q=BOSS` | 12+ |
| 35-60 | `/pl/products/[boss-watch]` | 26 | Product Pages | `/plcollections/vendors?q=BOSS` | 12+ |
| 61-100 | `/en/products/[michael-kors-watch]` | 20 | Product Pages | `/encollections/vendors?q=Michael%20Kors` | 30+ |
| 61-100 | `/pl/products/[michael-kors-watch]` | 20 | Product Pages | `/plcollections/vendors?q=Michael%20Kors` | 30+ |
| 101-120 | `/en/products/[lego-set]` | 20 | Product Pages | `/encollections/vendors?q=LEGO%C2%AE` | 15+ |
| 101-120 | `/pl/products/[lego-set]` | 20 | Product Pages | `/plcollections/vendors?q=LEGO%C2%AE` | 15+ |
| 121-140 | `/pages/windows-11-key-kaufen` | 20 | Informational | `/products/windows-11-pro` | 3 |

---

## ROOT CAUSE ANALYSIS

### Issue #1: URL Locale Concatenation Bug (80% of problem)
**Affected URLs:** `/encollections/*`, `/plcollections/*` patterns  
**Likely Location:** 
- Product template (Shopify Liquid)
- Vendor/brand filter component
- Faceted search side panel or header menu  

**How it happens:**
```
// ❌ CURRENT (BROKEN)
locale_prefix = "en"
path = "collections/vendors"
url = "/" + locale_prefix + path  // Results in: /encollections/vendors

// ✅ CORRECT
url = "/" + locale_prefix + "/" + path  // Results in: /en/collections/vendors
```

**Fix Strategy:** Find where vendor filter URLs are built and add `/` between locale prefix and path.

---

### Issue #2: Missing Locale Prefix on Base Collections URLs
**Affected URLs:** `/collections/vendors`, `/en/collections/vendors`, `/pl/collections/vendors`  
**Root Cause:** Collection/vendor filter pages may not exist at root level or localized paths require proper Shopify route mapping.

**Action:** Check Shopify theme collections page structure and verify vendor filter page exists in all locales.

---

### Issue #3: Hardcoded Product Links
**Affected URLs:** `/en/products/windows-11-pro`, `/pl/products/windows-11-pro`  
**Linking from:** `/pages/windows-11-key-kaufen` (Windows 11 key buying guide)

**Problem:** Links to a product that either:
1. Never existed
2. Was deleted/renamed
3. Is localized differently

---

## RECOMMENDED FIXES - PRIORITY ORDER

### 🔴 PRIORITY 1: Fix Template Bug (CRITICAL - 1-2 hours)
**Impact:** Resolves ~90% of broken links (200+ links)

1. **Locate the vendor/brand filter component** in your Shopify theme:
   - Search in theme files for: `encollections` or `vendor filter`
   - Check: `product-aboutyou.js`, `product-card-link.js`, or similar gallery/product components
   - Look for any template building `/collections/vendors` URLs with query parameters

2. **Fix the URL construction:**
   ```javascript
   // ❌ WRONG:
   const vendorUrl = `/${locale}collections/vendors?q=${vendorName}`;
   
   // ✅ CORRECT:
   const vendorUrl = `/${locale}/collections/vendors?q=${vendorName}`;
   
   // Or if locale is empty for default:
   const vendorUrl = locale ? `/${locale}/collections/vendors?q=${vendorName}` : `/collections/vendors?q=${vendorName}`;
   ```

3. **Search in these files (line numbers are clues):**
   - [product-aboutyou.css](product-aboutyou.css) / product-aboutyou.js
   - Any product comparison or carousel component
   - Header or navigation menu if vendor filter is site-wide

4. **Test:** After fix, re-audit with Ahrefs to confirm `/encollections` and `/plcollections` URLs no longer appear.

---

### 🟡 PRIORITY 2: Redirect or Remove Broken Collection URLs (2 hours)
**Impact:** Converts 404s to useful user journeys

#### Option A: Redirect Strategy (Recommended for SEO)
Use Shopify admin or `.htaccess` to redirect:

```htaccess
# Redirect malformed locale URLs to correct ones
RewriteRule ^encollections/vendors$ /en/collections/vendors [R=301,L]
RewriteRule ^encollections/vendors\?(.*)$ /en/collections/vendors?$1 [R=301,L]

RewriteRule ^plcollections/vendors$ /pl/collections/vendors [R=301,L]
RewriteRule ^plcollections/vendors\?(.*)$ /pl/collections/vendors?$1 [R=301,L]

# Redirect root /collections/vendors to /collections or /en/collections
RewriteRule ^collections/vendors$ /collections [R=301,L]
RewriteRule ^collections/vendors\?(.*)$ /collections?$1 [R=301,L]
```

**Shopify Alternative:**
- Use Shopify URL Redirects admin panel:  
  Settings → Apps & Channels → URL Redirects
- Create redirects for top 20 404s manually if .htaccess not available

#### Option B: Verify Collection Pages Exist
Check if `/collections/vendors`, `/en/collections/vendors`, `/pl/collections/vendors` actually exist in Shopify:
- If they don't exist, create them as faceted navigation pages
- If they do, update Shopify routing to handle these paths properly

---

### 🟢 PRIORITY 3: Fix Individual Product Links (1 hour)

**Windows 11 Pro Issue:**
1. Find the page: `/pages/windows-11-key-kaufen`
2. Update broken link from `/products/windows-11-pro` to the correct product URL
3. Verify the actual Windows 11 product pages exist:
   - `/en/products/[correct-url]`
   - `/pl/products/[correct-url]`

**Step-by-step:**
- Search in Shopify Products for "Windows 11 Pro"
- Copy the exact URL slug
- Update the link in the Windows 11 guide page in all locales

---

### 🔵 PRIORITY 4: Fix Legal Notice External Link (Low - External Issue)
**Page:** `/policies/legal-notice` (PR 70 - HIGH AUTHORITY)  
**Issue:** Links to `https://www.trustami.com/...` returning 403 (Trustami access blocked)

**Actions:**
1. Check if Trustami link is still relevant/needed
2. Option A: Update to correct Trustami review URL (if it moved)
3. Option B: Remove if Trustami partnership ended
4. Option C: Replace with direct link to your company info

**Timeline:** Can do after Priority 1-3 (lower impact for internal SEO)

---

## IMPLEMENTATION ROADMAP

| Phase | Task | Effort | Impact | Timeline |
|-------|------|--------|--------|----------|
| 1️⃣ | Audit codebase for locale concatenation bug | 30 min | ~200 broken links fixed | Day 1 |
| 2️⃣ | Implement URL construction fix | 1 hour | Validate fix works | Day 1 |
| 3️⃣ | Deploy and test (staging) | 30 min | QA pass | Day 1 |
| 4️⃣ | Setup redirects for historical 404s | 1 hour | Preserve PageRank | Day 2 |
| 5️⃣ | Update Windows 11 product links | 20 min | Fix remaining 3 URLs | Day 2 |
| 6️⃣ | Re-audit with Ahrefs | 30 min | Verify cleanup | Day 3 |

**Total Estimated Time:** 4-5 hours  
**Expected Results:** 90%+ 404 reduction (from 49 down to ~5-8 pages)

---

## SPECIFIC CODE CHANGES CHECKLIST

### Search for and fix these patterns:

**In JavaScript/Liquid files:**
```
❌ ${locale}collections
❌ ${locale}products  
❌ "/" + locale + "collections
❌ locale + "collections

✅ ${locale}/collections
✅ ${locale}/products
✅ "/" + locale + "/collections"
✅ locale ? `/${locale}/collections` : `/collections`
```

**Files to search:**
- [ ] `assets/product-aboutyou.js`
- [ ] `assets/product-card-link.js`
- [ ] `assets/header.js`
- [ ] `sections/product*` (all product sections)
- [ ] `snippets/product*` (all product snippets)
- [ ] Any JavaScript with `vendor`, `filter`, or `facet` in the name

---

## VERIFICATION CHECKLIST

After implementation:

- [ ] No URLs containing `/encollections/` exist (search: site:karinex.de/encollections)
- [ ] No URLs containing `/plcollections/` exist (search: site:karinex.de/plcollections)
- [ ] `/collections/vendors` redirects or works properly
- [ ] All Windows 11 product links point to valid products
- [ ] Legal notice page validated (or Trustami link updated)
- [ ] Redirects return 301 (permanent) not 302 (temporary)
- [ ] Ahrefs re-audit shows <10 remaining 404s

---

## SEO IMPACT SUMMARY

**Current State:**
- 49 × 404 pages discovered
- 233 × internal broken links
- ~430 inlinks to top 10 broken URLs
- Potential loss of ~50+ ranking opportunities

**After Fix:**
- Expected reduction to 5-10 404 pages (legitimate removes only)
- Recovered ~200+ internal link juice via redirects
- Improved crawl efficiency (less 404 crawl waste)
- Better UX (users reach correct product pages/collections)

**Rankings Impact:**
- Pages currently linking to 404s will pass link equity correctly
- Reduced 404 count improves site health metrics
- Estimated +5-10% organic traffic recovery from fixed broken navigation

---

## QUESTIONS FOR YOUR TEAM

1. **Do `/collections/vendors` pages exist?** Or is this an unsupported URL?
2. **Which template handles product vendor/brand filters?** (Search in: header, product page, sidebar)
3. **Is Windows 11 Pro product still in catalog?** Or renamed/replaced?
4. **Who maintains URL structure changes?** (May need dev sign-off on fix)

---

## NEXT STEPS

1. **TODAY:** Search codebase for locale concatenation bug, reply with findings
2. **TOMORROW:** Implement fix + test on staging
3. **DAY 3:** Deploy + create redirects + re-audit

**Questions? I can help with:**
- Specific file content review if you share code
- .htaccess redirect optimization
- Shopify URL redirect setup
- Ahrefs monitoring post-fix

