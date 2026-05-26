# Karinex Widerruf — Shopify Checkout Extension

تطبيق Shopify خاص يضيف مربع موافقة **Widerrufsverzicht (§ 356 (5) BGB)** داخل
صفحة الـ Checkout الفعلية، مع منع المتابعة حتى يتم التفعيل.

> **مهم:** هذا التطبيق **منفصل** عن ثيم Shopify. لا يتم نشره عبر دفع الفرع
> إلى `main` كما يحصل مع تعديلات الثيم. النشر يدوي عبر `shopify app deploy`
> من جهازك.

---

## 📦 ماذا يفعل التطبيق؟

- يضيف مربع موافقة **مباشرة فوق زر "Jetzt bezahlen"** في صفحة Shopify Checkout.
- النص القانوني بالألماني (الأصل) + مترجم إلى EN / PL / SV.
- إذا لم يضع العميل علامة، الزر لا يعمل (`useBuyerJourneyIntercept` يحجب المتابعة).
- عند الموافقة، تُحفظ في `widerruf_consent` كـ cart attribute مع timestamp
  ISO 8601 → تظهر تلقائياً في تفاصيل كل طلب في Shopify Admin كإثبات قانوني.

---

## 🎯 المتطلبات (مرة واحدة فقط)

| الأداة | كيف تثبت |
|---|---|
| **Node.js 18+** | [nodejs.org/en/download](https://nodejs.org/en/download/) — حمّل LTS |
| **Shopify CLI** | `npm install -g @shopify/cli @shopify/app` |
| **Shopify Partner account** | سجّل مجاناً على [partners.shopify.com](https://partners.shopify.com) |

تحقق من النجاح:
```bash
node --version    # يجب أن يطبع v18.x.x أو أحدث
shopify version   # يجب أن يطبع رقم نسخة Shopify CLI
```

---

## 🚀 خطوات النشر (مرة واحدة فقط)

### 1) افتح Terminal في مجلد التطبيق

```bash
cd shopify-app
```

### 2) ثبّت الحزم

```bash
npm install
```

(قد يأخذ 1–2 دقيقة. بعدها يظهر مجلد `node_modules/`.)

### 3) اربط التطبيق بحساب Partner الخاص بك

```bash
shopify app config link
```

سيفتح المتصفح ويطلب منك:
- تسجيل الدخول إلى Partner account
- اختيار "Create a new app" (المرة الأولى فقط)
- اختيار اسم: `Karinex Widerruf`

سيقوم بملء `client_id` في `shopify.app.toml` تلقائياً.

### 4) ادفع التطبيق إلى Shopify

```bash
shopify app deploy
```

سيطلب منك:
- الموافقة على رفع نسخة جديدة (`y`)
- وصف للتغييرات (اختياري — اضغط Enter للتجاهل)

عند النجاح ترى:
```
✓ Extensions deployed
✓ Active version released
```

### 5) ثبّت التطبيق على متجرك

من Partner Dashboard:
1. اذهب إلى **Apps → Karinex Widerruf → Test on development store**
2. أو من المتجر مباشرة: **Settings → Apps and sales channels → Develop apps**
3. وافق على التثبيت

### 6) فعّل المربع داخل الـ Checkout

في Shopify Admin:
1. **Settings → Checkout → Customize**
2. اختر "Checkout" من القائمة العلوية
3. في القسم السفلي (قبل زر الدفع) سترى الـ extension تلقائياً
4. اضغط **Save**

---

## ✅ كيف تختبر؟

1. افتح متجرك في وضع التصفح الخفي
2. أضف منتجاً للسلة
3. اضغط "Zur Kasse"
4. ستجد مربع الموافقة فوق زر "Jetzt bezahlen"
5. حاول الضغط على زر الدفع بدون تفعيل المربع → سيظهر خطأ "Bitte bestätigen…"
6. فعّل المربع → الزر يعمل وتُكمل الشراء
7. في Shopify Admin → الطلب الجديد → التفاصيل → تجد:
   ```
   widerruf_consent: Ja (2026-05-26T14:32:11.234Z)
   ```

---

## 🔄 تحديث التطبيق لاحقاً

أي تعديل على الكود → نفس الأمر:
```bash
shopify app deploy
```

التحديث يصل المتجر خلال ثوانٍ.

---

## 🧹 إلغاء التثبيت

من Shopify Admin → Settings → Apps → Karinex Widerruf → **Uninstall**.

المربع يختفي فوراً من checkout (لكن سجلات الموافقات السابقة تبقى في الطلبات).

---

## 🆘 مشاكل شائعة

| المشكلة | الحل |
|---|---|
| `shopify: command not found` | شغّل `npm install -g @shopify/cli @shopify/app` مرة أخرى |
| `Cannot find module` | شغّل `npm install` داخل `shopify-app/` |
| المربع لا يظهر في checkout | تأكدت أنك ضغطت **Save** في Settings → Checkout → Customize |
| الـ deploy فشل بسبب صلاحيات | تأكد أنك مالك أو staff على متجر karinex.de في Partner Dashboard |

---

## 📐 بنية الملفات

```
shopify-app/
├── README.md                          ← هذا الملف
├── shopify.app.toml                   ← إعدادات التطبيق
├── package.json
└── extensions/
    └── widerruf-checkbox/
        ├── shopify.extension.toml     ← يستهدف "actions.render-before"
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   └── Checkout.tsx           ← الكود الفعلي للمربع
        └── locales/
            ├── de.json                ← النص بالألماني (الأصل)
            ├── en.default.json
            ├── pl.json
            └── sv.json
```

---

## ⚖️ ملاحظة قانونية

هذا الـ checkbox **بالإضافة** إلى المربع الموجود في صفحة السلة والـ Drawer
(داخل الثيم). كلاهما يكتب نفس الـ cart attribute (`widerruf_consent`)، فلا
يوجد ازدواج — العميل يفعّله مرة واحدة في أي مكان ويبقى مفعّلاً.

إن كنت تريد الاكتفاء بـ checkbox الـ checkout فقط (وإزالة Cart Drawer)، أزل
كتلة `kx-widerruf` من `snippets/cart-summary.liquid`.
