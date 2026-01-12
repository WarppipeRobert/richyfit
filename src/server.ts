import "dotenv/config";

import app from "./app";
import { connectMongo, disconnectMongo } from "./config/mongo";
import { connectPostgres, disconnectPostgres } from "./config/postgres";
import { connectRedis, disconnectRedis } from "./config/redis";

const PORT = Number(process.env.PORT) || 3000;

function logOk(name: string) {
  console.log(JSON.stringify({ level: "info", msg: "dep.ok", dep: name }));
}
function logFail(name: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(JSON.stringify({ level: "error", msg: "dep.fail", dep: name, error: message }));
}

async function boot(): Promise<void> {
  // Connect in parallel; fail fast if any fail.
  const results = await Promise.allSettled([
    connectPostgres(),
    connectMongo(),
    connectRedis()
  ]);

  const deps = ["postgres", "mongo", "redis"] as const;

  let failed = false;
  results.forEach((r, i) => {
    const dep = deps[i];
    if (r.status === "fulfilled") logOk(dep);
    else {
      failed = true;
      logFail(dep, r.reason);
    }
  });

  if (failed) {
    // Best-effort cleanup
    await Promise.allSettled([disconnectPostgres(), disconnectMongo(), disconnectRedis()]);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(JSON.stringify({ level: "info", msg: "server.start", port: PORT }));
  });
}

// Graceful shutdown on SIGINT/SIGTERM
async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", msg: "server.shutdown", signal }));
  await Promise.allSettled([disconnectPostgres(), disconnectMongo(), disconnectRedis()]);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void boot();
