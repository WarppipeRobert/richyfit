import Redis from "ioredis";

let redis: Redis | null = null;
let connectPromise: Promise<void> | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");

    redis = new Redis(url, {
      connectTimeout: 5_000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }
  return redis;
}

function waitReady(r: Redis): Promise<void> {
  if (r.status === "ready") return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      r.off("ready", onReady);
      r.off("error", onError);
    };

    r.on("ready", onReady);
    r.on("error", onError);
  });
}

export async function connectRedis(): Promise<void> {
  const r = getRedis();

  // already ready
  if (r.status === "ready") return;

  // already connecting / connected: wait for ready instead of calling connect()
  if (r.status === "connecting" || r.status === "connect" || r.status === "reconnecting") {
    await waitReady(r);
    return;
  }

  // first/only connect attempt
  if (!connectPromise) {
    connectPromise = (async () => {
      await r.connect();          // safe: only executed once
      const pong = await r.ping();
      if (pong !== "PONG") throw new Error(`Unexpected Redis PING response: ${pong}`);
    })().finally(() => {
      // keep promise if ready; clear on failure
      if (r.status !== "ready") connectPromise = null;
    });
  }

  await connectPromise;
}

export async function disconnectRedis(): Promise<void> {
  if (!redis) return;

  const r = redis;
  redis = null;
  connectPromise = null;

  try {
    await r.quit();
  } catch {
    r.disconnect();
  }
}
