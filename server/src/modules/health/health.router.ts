import type { FastifyInstance } from 'fastify';
import { pool } from '../../shared/db/pool.js';
import { BRAND } from '../../shared/branding/brand.js';

export async function registerHealth(app: FastifyInstance) {
  app.get('/health', async () => ({
    ok: true,
    app: BRAND.name.ar,
    version: process.env.npm_package_version ?? '0.1.0',
    time: new Date().toISOString(),
  }));

  app.get('/health/db', async (_req, reply) => {
    try {
      const r = await pool.query('SELECT 1 AS ok');
      return { ok: r.rows[0]?.ok === 1 };
    } catch (err) {
      app.log.error(err);
      return reply.status(503).send({ ok: false, error: 'DB_UNREACHABLE' });
    }
  });
}
