import 'server-only';

// Graceful Redis wrapper — fully no-ops when REDIS_URL is unset.
// Set REDIS_URL=redis://localhost:6379 in .env.local to enable.

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
};

let _client: RedisLike | null | undefined = undefined; // undefined = not yet initialised

async function getClient(): Promise<RedisLike | null> {
  if (!process.env.REDIS_URL) return null;
  if (_client !== undefined) return _client;

  try {
    const { default: Redis } = await import('ioredis');
    const r = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
    });
    _client = r as unknown as RedisLike;
  } catch {
    console.warn('[cache] ioredis failed to initialise — caching disabled');
    _client = null;
  }
  return _client;
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    const c = await getClient();
    return c ? c.get(key) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  try {
    const c = await getClient();
    if (c) await c.set(key, value, 'EX', ttlSeconds);
  } catch {}
}
