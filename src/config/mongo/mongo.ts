import { MongoClient } from "mongodb";

let client: MongoClient | null = null;

export function getMongoClient(): MongoClient {
  if (!client) {
    const url = process.env.MONGO_URL;
    if (!url) throw new Error("MONGO_URL is not set");

    client = new MongoClient(url, {
      serverSelectionTimeoutMS: 5_000
    });
  }
  return client;
}

export async function connectMongo(): Promise<void> {
  const c = getMongoClient();
  await c.connect();

  const dbName = process.env.MONGO_DB || "admin";
  await c.db(dbName).command({ ping: 1 });
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
