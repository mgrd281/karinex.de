# Shopify URL Redirects for 404 Fix

## Instructions
Go to Settings → URL Redirects → Add redirect for each entry below.

---

## Critical Redirects (Top Priority)

### 1. Broken Collections/Vendors URLs

| Redirect from | Redirect to | Type |
|---|---|---|
| `/encollections/vendors` | `/en/collections/vendors` | Permanent (301) |
| `/plcollections/vendors` | `/pl/collections/vendors` | Permanent (301) |
| `/collections/vendors` | `/collections/vendors` | Manual fix required |

### 2. Query String Variants (if accessible)
- `/encollections/vendors?*` → `/en/collections/vendors`
- `/plcollections/vendors?*` → `/pl/collections/vendors`

---

## Windows 11 Product Links
| Redirect from | Redirect to |
|---|---|
| `/pages/windows-11-key-kaufen` | `/collections/microsoft-office-windows` |

---

## Implementation Steps

1. **Go to Shopify Admin**
2. Settings → URL Redirects
3. Add each redirect above
4. Test with `/encollections/vendors?q=Microsoft`

Expected result: Should redirect to `/en/collections/vendors?q=Microsoft` (or current locale version)

---

## Code Fixes Applied

✅ `sections/product-information.liquid` line 446
- Changed: `{{ routes.root_url }}collections/vendors`
- To: `{{ routes.root_url | append: 'collections/vendors' }}`

✅ `snippets/product-meta-compact.liquid` line 105
- Changed: `{{ _root }}collections/vendors`
- To: `{{ _root | append: 'collections/vendors' }}`

These fixes prevent future `/encollections/` and `/plcollections/` malformed URLs.
