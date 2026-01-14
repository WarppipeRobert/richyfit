import { getRedis } from "../config/redis";

const VERSION_TTL_SECONDS = 60 * 60 * 24 * 30; // keep version around (30 days)

function versionKey(clientId: string) {
  return `checkins_version:${clientId}`;
}

function listKey(params: {
  ver: number;
  clientId: string;
  from: string;
  to: string;
  limit: number;
  cursor?: string | null;
}) {
  const cursorPart = params.cursor ?? "";
  return `checkins:v${params.ver}:${params.clientId}:${params.from}:${params.to}:${params.limit}:${cursorPart}`;
}

function ttlSeconds(): number {
  // jitter 60–180
  return 60 + Math.floor(Math.random() * 121);
}

export async function getCheckinsVersion(clientId: string): Promise<number> {
  const redis = getRedis();
  const raw = await redis.get(versionKey(clientId));
  const n = raw ? Number(raw) : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export async function bumpCheckinsVersion(clientId: string): Promise<number> {
  const redis = getRedis();
  const n = await redis.incr(versionKey(clientId));
  // keep the version key from expiring too soon (optional but good hygiene)
  await redis.expire(versionKey(clientId), VERSION_TTL_SECONDS);
  return n;
}

export async function getCachedCheckins(params: {
  ver: number;
  clientId: string;
  from: string;
  to: string;
  limit: number;
  cursor?: string | null;
}): Promise<any | null> {
  const redis = getRedis();
  const key = listKey(params);
  const cached = await redis.get(key);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch {
    // corrupted cache; drop it
    await redis.del(key);
    return null;
  }
}

export async function setCachedCheckins(
  params: {
    ver: number;
    clientId: string;
    from: string;
    to: string;
    limit: number;
    cursor?: string | null;
  },
  value: any
): Promise<void> {
  const redis = getRedis();
  const key = listKey(params);
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds());
}
