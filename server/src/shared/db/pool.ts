import pg from 'pg';

/**
 * مجمّع اتصالات قاعدة البيانات.
 * يُستبدل هذا الملف بنسخة Rayyan Pro عند تشغيل سكربت الفصل،
 * وهو موجود هنا كبديل مؤقت حتى يتم ذلك.
 */
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('[db] خطأ غير متوقع في المجمّع:', err);
});

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
