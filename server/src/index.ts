import 'dotenv/config';
import { buildApp } from './app.js';
import { BRAND } from './shared/branding/brand.js';

const PORT = Number(process.env.PORT ?? BRAND.deployment.defaultApiPort ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = await buildApp();

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`${BRAND.name.ar} — الخادم يعمل على ${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    app.log.info('إيقاف الخادم...');
    await app.close();
    process.exit(0);
  });
}
