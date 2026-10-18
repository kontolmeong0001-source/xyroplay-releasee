import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let sharedPool;

/** Explicit DATABASE_URL locally; Netlify native connections are branch-aware. */
export async function getPool(env = process.env) {
  if (sharedPool) return sharedPool;
  let connectionString = env.DATABASE_URL || null;
  // NETLIFY is a build-time marker, not a required Functions runtime variable.
  // The SDK reads the branch-aware connection from Netlify.env at runtime.
  if (!connectionString) {
    try {
      const netlifyDb = await import('@netlify/database');
      connectionString = await netlifyDb.getConnectionString();
    } catch { return null; }
  }
  if (!connectionString) return null;

  let parsed;
  try { parsed = new URL(connectionString); } catch { return null; }
  const host = parsed.hostname.toLowerCase();
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(host);
  const localWithoutTls = env.XYRO_ALLOW_LOCAL_DB === 'true' && loopback;
  for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(key);
  const safeConnectionString = parsed.toString();
  const { Pool } = require('pg');
  sharedPool = new Pool({
    connectionString: safeConnectionString,
    ssl: localWithoutTls ? false : { rejectUnauthorized: true },
    max: 4,
    connectionTimeoutMillis: 5000,
  });
  return sharedPool;
}
