// مُولَّد آلياً من brand.config.json — لا تعدّله يدوياً.
// شغّل: node scripts/apply-brand.mjs

export const BRAND = {
  "$comment": "مصدر الحقيقة الوحيد لهوية التطبيق. غيّر هنا فقط ثم شغّل: node scripts/apply-brand.mjs",
  "appId": "com.example.shipping",
  "appKey": "shipping",
  "name": {
    "ar": "نظام الشحن",
    "en": "Shipping System"
  },
  "shortName": {
    "ar": "الشحن",
    "en": "Shipping"
  },
  "tagline": {
    "ar": "إدارة الشحن والمندوبين والتجار",
    "en": "Delivery, Drivers & Merchants Management"
  },
  "company": {
    "ar": "شركتك",
    "en": "Your Company"
  },
  "theme": {
    "primary": "#1F3A5F",
    "accent": "#1E7A46",
    "danger": "#A61B1B",
    "logoLight": "assets/logo-light.png",
    "logoDark": "assets/logo-dark.png",
    "icon": "assets/icon.png",
    "iconIco": "assets/icon.ico"
  },
  "locale": {
    "default": "ar",
    "supported": [
      "ar",
      "en"
    ],
    "direction": "rtl"
  },
  "support": {
    "website": "https://example.com",
    "email": "support@example.com",
    "phone": ""
  },
  "deployment": {
    "webOnly": false,
    "desktop": true,
    "defaultWebPort": 5173,
    "defaultApiPort": 3000
  },
  "features": {
    "cashOnDelivery": true,
    "multiCurrency": true,
    "multiBranch": true,
    "liveTracking": true,
    "publicTracking": true,
    "generalLedger": false
  }
} as const;

export function appName(locale: 'ar' | 'en' = 'ar'): string {
  return BRAND.name[locale] ?? BRAND.name.ar;
}

/** يُستخدم في ترويسات الطباعة وتذييل التقارير */
export function documentHeader(locale: 'ar' | 'en' = 'ar') {
  return {
    title: appName(locale),
    company: BRAND.company[locale] ?? BRAND.company.ar,
    website: BRAND.support.website,
    phone: BRAND.support.phone,
  };
}

export const FEATURES = BRAND.features;
