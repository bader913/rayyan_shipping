import { useEffect, useState } from 'react';
import { BRAND, appName, tagline } from './config/brand';

type Health = { ok: boolean; app?: string; version?: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const isDesktop = typeof window !== 'undefined' && (window as any).desktop?.isDesktop;

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, Segoe UI, Tahoma, sans-serif', padding: 40 }}>
      <header style={{ borderBottom: `3px solid ${BRAND.theme.primary}`, paddingBottom: 16 }}>
        <h1 style={{ color: BRAND.theme.primary, margin: 0 }}>{appName()}</h1>
        <p style={{ color: '#555', marginTop: 6 }}>{tagline()}</p>
      </header>

      <section style={{ marginTop: 28 }}>
        <p>
          حالة الخادم:{' '}
          <strong style={{ color: health?.ok ? BRAND.theme.accent : BRAND.theme.danger }}>
            {health === null ? 'جارٍ الفحص…' : health.ok ? 'متصل' : 'غير متصل'}
          </strong>
        </p>
        <p>وضع التشغيل: <strong>{isDesktop ? 'سطح المكتب' : 'ويب'}</strong></p>
      </section>

      <section style={{ marginTop: 28, padding: 20, background: '#F2F5F9', borderRadius: 10 }}>
        <h3 style={{ marginTop: 0 }}>الخطوة التالية</h3>
        <ol style={{ lineHeight: 2, paddingInlineStart: 20 }}>
          <li><code>node scripts/extract-from-rayyan.mjs --src ../Rayyan_pro_final</code></li>
          <li><code>node scripts/merge-migrations.mjs</code></li>
          <li>فعّل مسارات الشحن في <code>server/src/app.ts</code></li>
          <li>اربط الصفحات المنسوخة بالتوجيه هنا</li>
        </ol>
      </section>
    </div>
  );
}
