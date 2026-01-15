import type { Db, Collection } from "mongodb";
import { getMongoClient } from "./mongo";
export type InsightDoc = {
  clientId: string; // uuid string
  from: string;     // normalized "YYYY-MM-DD"
  to: string;     // normalized "YYYY-MM-DD"
  summary: string;
  signals: Record<string, unknown>;
  createdAt: Date;
};

function getDb(): Db {
  const dbName = process.env.MONGO_DB || "everfit";
  return getMongoClient().db(dbName);
}

export function getInsightsCollection(): Collection<InsightDoc> {
  return getDb().collection<InsightDoc>("insights");
}


export async function ensureInsightsIndexes(): Promise<void> {
  const col = getInsightsCollection();

  const indexes: { key: { [key: string]: number }; name: string; unique?: boolean }[] = [
    { key: { clientId: 1, fromDate: 1, toDate: 1 }, name: "uq_insights_clientId_fromDate_toDate", unique: true },
  ];

  await col.createIndexes(indexes);
}
