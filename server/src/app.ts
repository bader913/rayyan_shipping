import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerHealth } from './modules/health/health.router.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
          : undefined,
    },
    bodyLimit: 10 * 1024 * 1024,
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  await registerHealth(app);

  // ── مسارات الشحن ────────────────────────────────────────────────
  // تُفعَّل بعد تشغيل: node scripts/extract-from-rayyan.mjs
  //
  // const { registerShippingRoutes } = await import('./modules/shipping/deliveryShipping.router.js');
  // await app.register(registerShippingRoutes, { prefix: '/api/shipping' });
  //
  // const { registerRepresentativeRoutes } = await import('./modules/representative/representativeMobile.router.js');
  // await app.register(registerRepresentativeRoutes, { prefix: '/api/representative' });

  return app;
}
