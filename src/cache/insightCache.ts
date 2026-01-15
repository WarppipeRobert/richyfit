import { getRedis } from "../config/redis";

const TTL_SECONDS = Number(process.env.INSIGHTS_CACHE_TTL_SECONDS ?? 600); // 5–10 min default 10

function key(clientId: string, from: string, to: string) {
  return `insight:${clientId}:${from}:${to}`;
}

export async function getCachedInsight(clientId: string, from: string, to: string) {
  const v = await getRedis().get(key(clientId, from, to));
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export async function setCachedInsight(clientId: string, from: string, to: string, payload: any) {
  await getRedis().set(key(clientId, from, to), JSON.stringify(payload), "EX", TTL_SECONDS);
}

export async function invalidateCachedInsight(clientId: string, from: string, to: string) {
  await getRedis().del(key(clientId, from, to));
}
