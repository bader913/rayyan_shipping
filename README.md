# نظام الشحن — مستودع مستقل

نظام إدارة الشحن والمندوبين والتجار، مفصول عن Rayyan Pro.

**ويب أولاً** — سطح المكتب غلاف اختياري فوق نفس بناء الويب.
**الاسم قابل للتخصيص من اليوم الأول** — ملف واحد يغيّر كل شيء.

---

## ⚠️ اقرأ هذا أولاً

هذا المستودع **لا يحتوي كود Rayyan Pro**. يحتوي:

1. هيكل مشروع جاهز (خادم + واجهة + سطح مكتب)
2. نظام هوية قابل للتخصيص
3. **سكربت فصل آلي** ينسخ الكود من نسختك المحلية من Rayyan Pro

**لماذا؟** النسخ يتم على جهازك بايت-بايت من المصدر الأصلي.
لا وسيط، لا إعادة كتابة، لا خطر أخطاء نسخ في كود مالي.

---

## البدء — 5 خطوات

```bash
# 1) ضع المستودعين جنباً إلى جنب
#    ~/work/Rayyan_pro_final
#    ~/work/rayyan-shipping        ← أنت هنا

cd rayyan-shipping

# 2) معاينة أولاً — لا يكتب شيئاً
node scripts/extract-from-rayyan.mjs --src ../Rayyan_pro_final --dry-run

# 3) النسخ الفعلي
node scripts/extract-from-rayyan.mjs --src ../Rayyan_pro_final

# 4) دمج المهاجرات في مخطط واحد
node scripts/merge-migrations.mjs

# 5) اسم برنامجك
#    عدّل brand.config.json ثم:
node scripts/apply-brand.mjs

# التشغيل
cp .env.example .env        # عدّل DATABASE_URL و JWT_SECRET
npm install
createdb shipping_db
psql -d shipping_db -f migrations/001_shipping_initial_schema.sql
npm run dev
```

---

## ✅ ضمانة السلامة

سكربت الفصل **يقرأ فقط** من Rayyan Pro.
لا يكتب، لا يعدّل، لا يحذف، لا يعمل commit أو push هناك. إطلاقاً.

كل الكتابة تحدث داخل هذا المستودع فقط.

---

## تخصيص اسم البرنامج

كل الهوية في **`brand.config.json`** — مصدر الحقيقة الوحيد.

```jsonc
{
  "appId": "com.yourcompany.delivery",
  "appKey": "delivery",
  "name":      { "ar": "نَقول للشحن", "en": "Noqol Delivery" },
  "shortName": { "ar": "نَقول",       "en": "Noqol" },
  "theme": { "primary": "#0B5FFF" }
}
```

ثم:

```bash
node scripts/apply-brand.mjs
```

يُحدَّث تلقائياً:

| الملف | ماذا يأخذ |
|---|---|
| `client/src/config/brand.ts` | الهوية للواجهة |
| `server/src/shared/branding/brand.ts` | الهوية للخادم والطباعة |
| `client/index.html` | `<title>` واللغة والاتجاه |
| `client/src/styles/brand.css` | متغيّرات الألوان |
| `client/public/manifest.webmanifest` | تطبيق الويب |
| `electron/brand.json` | اسم التطبيق والأيقونة |
| `package.json` | `name` و `productName` |

**القاعدة:** لا تكتب اسم التطبيق حرفياً في أي ملف مصدري.
استخدم `appName()` من `config/brand`.

للتحقق في الـ CI:

```bash
node scripts/apply-brand.mjs --check
```

---

## أوضاع التشغيل

| الوضع | الأمر | الاستخدام |
|---|---|---|
| ويب — تطوير | `npm run dev` | العمل اليومي |
| ويب — إنتاج | `npm run build && npm start` | السيرفر السحابي |
| سطح مكتب — تطوير | `npm run electron:dev` | اختبار الغلاف |
| سطح مكتب — تثبيت | `npm run electron:build` | مثبّت Windows/Mac/Linux |

Electron يعمل بثلاثة أوضاع عبر `APP_SHELL_MODE`:

- **`dev`** — يتصل بخادم Vite
- **`bundled`** — يشغّل الخادم داخلياً ويقدّم الويب المبني
- **`remote`** — غلاف رقيق فوق نشر سحابي (`APP_REMOTE_URL`)

> للنشر السحابي البحت: `brand.config.json → deployment.webOnly = true`
> وتجاهل مجلد `electron/` كلياً.

---

## ماذا يُنسخ بالضبط

مُتحقَّق منه مقابل `integration/general-hotel-mainline`
عند `HEAD 82d33b6050bc888f06c072c539ad159d3b8f874c`

### الخادم — 12 ملف شحن
`deliveryShipping.router.ts` (114 KB) · `deliveryShippingMerchant.router.ts` (47 KB) ·
`deliveryShippingRepresentative.router.ts` · `deliveryShippingRestoreIntegrity.ts` ·
`deliveryShippingProfitCenter.service.ts` · `deliveryShippingMerchantFinancial.service.ts` ·
`deliveryShippingMerchantLedger.service.ts` · `deliveryShippingMerchantAccess.ts` ·
`deliveryShippingRepresentativeAccess.ts` · `deliveryShippingExternalSupervisor.ts` ·
`deliveryShippingCurrency.service.ts` · `deliveryShipping.supervisor.ts`

> `deliveryShippingFeature.ts` **مستبعد عمداً** — بوابة ميزة خاصة بـ Rayyan Pro.

### الخادم — 7 ملفات مندوب
`representativeMobile.service.ts` (71 KB) · `representativeMobile.analytics.ts` (66 KB) ·
`representativeMobile.sales.ts` (58 KB) · `representativeMobile.router.ts` (40 KB) ·
`representativeMobile.auth.ts` · `representativeRateQuote.ts` · `representativeSaleAdmission.ts`

### السلطات المشتركة
`currency/` · `db/` · `middleware/` · `permissions/` · `utils/` · `services/` · `performance/`

### الواجهة — 9 صفحات
`ShippingPage.tsx` (143 KB) · `RepresentativeMobilePOSPage.tsx` (193 KB) ·
`RepresentativeMobileManagementPage.tsx` (99 KB) · `RepresentativeAnalyticsPage.tsx` ·
`RepresentativePairingPage.tsx` · `ShippingSupervisorDashboard.tsx` ·
`RepresentativeSupervisorDashboard.tsx` · `RepresentativeShippingPortalPage.tsx` ·
`ShippingPortalPage.tsx`

### المهاجرات — 26

**الشحن (14):** `143`–`153`, `158`, `159`, `175`
**المندوب (9):** `086`–`089`, `107`–`109`, `111`, `177`
**الأساس (3):** `076`, `122`, `132`

**مستبعد:** `154_gl_posting_authority` · `155_gl_link_seed_repair`

---

## 🔴 قرار دفتر الأستاذ العام

المهاجرتان `154` و `155` تربطان الشحن بالمحاسبة العامة.

**مستبعدتان افتراضياً.** لماذا؟

الشحن يملك **دفتر أستاذ فرعي مستقل بالكامل**:

```
delivery_shipments
delivery_shipping_merchant_ledger_entries
delivery_shipping_representative_ledger_entries
delivery_shipping_settlement_entries
```

`getDeliveryShippingMerchantAccountBalance()` يحسب
`accrued − collected = outstanding` من هذه الجداول **دون لمس دفتر الأستاذ العام**.

تضمين `154`/`155` يجرّ خلفه 5 موديولات محاسبية ثقيلة
(`accountant`, `accountingPostings`, `accountingPeriods`, `compoundJournal`, `treasuryMovements`)
وكلها من فئة **السلطات عالية الخطورة**.

إن كنت مصمّماً:

```bash
node scripts/extract-from-rayyan.mjs --src ../Rayyan_pro_final --with-gl
```

**التوصية: لا تفعل.** صدّر ملخصاً دورياً لمحاسبك الخارجي بدلاً من ذلك.

---

## التحويلات الآلية

يطبّق السكربت هذه التحويلات أثناء النسخ:

| # | التحويل |
|---|---|
| 1 | حذف استيرادات `deliveryShippingFeature` |
| 2 | إزالة `preHandler: requireDeliveryShippingFeature` (مفردة أو ضمن مصفوفة) |
| 3 | تحييد `isDeliveryShippingFeatureEnabledAndLicensed()` → `true` |
| 4 | `modules/deliveryShipping/` → `modules/shipping/` |
| 5 | `../deliveryShipping/` → `../shipping/` |
| 6 | `modules/representativeMobile/` → `modules/representative/` |
| 7 | `shared/security/shippingActivation` → `shared/branding/activation` |
| 8 | تنظيف بقايا تركيبية |
| 9 | إضافة ترويسة مصدر لكل ملف |

كل ملف منسوخ يحمل ترويسة تذكر مصدره والـ HEAD.

---

## بعد الفصل — قائمة مهام

- [ ] فعّل المسارات في `server/src/app.ts` (مُعلَّمة بتعليق)
- [ ] راجع `migrations/001_shipping_initial_schema.sql` بحثاً عن مراجع لجداول غير منسوخة
- [ ] استبدل ربط `expenses` في `deliveryShippingProfitCenter.service.ts` بجدول `shipping_expenses`
- [ ] اربط الصفحات المنسوخة بتوجيه `App.tsx`
- [ ] `npm run typecheck` وأصلح الاستيرادات المعلّقة
- [ ] **أثبت تكافؤ الأرقام** (انظر أدناه) قبل أي إعادة هيكلة

---

## اختبار القبول — تكافؤ الأرقام

**لا تعِد هيكلة أي شيء قبل اجتياز هذا.**

1. **كشف التاجر:** نفس المدخلات في النظامين →
   `accrued_amount` / `collected_amount` / `outstanding_amount` متطابقة بدقة 4 خانات عشرية

2. **تعدد العملات:** `getDeliveryShippingProfitCenterReadModel()` →
   `cross_currency_shipment_count` و `unknown_rep_currency_*` صحيحة،
   و **بدون أي تحويل عملة** (`semantics.cross_currency_conversion === false`)

3. **عدم التكرار:** أرسل نفس `idempotency_key` مرتين → قيد واحد فقط

4. **الحِمل:** استورد 100,000 شحنة → تحقق أن فهارس `158_million_scale_listing` تعمل

### البوابة العملية

شغّل النظام **بلا أي اتصال بقاعدة Rayyan Pro**:

> تاجر جديد → 10 شحنات → عيّن مندوب → سلّم 7 وأرجع 3 →
> سجّل تحصيل نقدي → افتح كشف التاجر

**يجب أن يطابق أرقام Rayyan Pro بالضبط، وبصفر صفوف في جداول دفتر الأستاذ العام.**

---

## تطبيق المندوب

انظر `mobile/README.md`.

الواجهة تحتاج إعادة بناء (React → Flutter)، لكن **الجزء الصعب جاهز**:
عقد الـ API، المزامنة الأوفلاين (`087`)، ومنع الازدواجية المالية (`089`).

**القاعدة الحاكمة:** التخزين المحلي على الجهاز ليس سلطة مالية.
الجهاز يسجّل *نية* العملية مع مفتاح عدم تكرار — والخادم وحده يحسب الأرصدة.

---

## ⛔ ممنوع لمسه

- **مستودع `Rayyan_pro_final` بالكامل** — قراءة فقط
- `migrations/143..179` في المصدر — تاريخية وغير قابلة للتعديل
- موديولات `accountant`, `accountingPostings`, `accountingPeriods`,
  `compoundJournal`, `treasuryMovements`, `license`, `rayyanSentinel`

---

## البنية

```
rayyan-shipping/
├── brand.config.json          ★ مصدر الهوية الوحيد
├── scripts/
│   ├── extract-from-rayyan.mjs   ★ الفصل الآلي
│   ├── apply-brand.mjs           ★ نشر الهوية
│   └── merge-migrations.mjs
├── electron/                  غلاف سطح المكتب (اختياري)
├── server/src/
│   ├── modules/shipping/         ← يُملأ بالفصل
│   ├── modules/representative/   ← يُملأ بالفصل
│   └── shared/branding/
├── client/src/
│   ├── config/brand.ts           ← مُولَّد
│   └── pages/                    ← يُملأ بالفصل
├── migrations/
│   ├── _source/                  ← منسوخة (غير مرفوعة)
│   └── 001_shipping_initial_schema.sql   ← مدموجة
└── mobile/
```
