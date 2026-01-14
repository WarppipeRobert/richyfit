import type { Db, Collection, IndexSpecification } from "mongodb";
import { getMongoClient } from "./mongo";
export type CheckinDoc = {
  clientId: string; // uuid string
  date: string;     // normalized "YYYY-MM-DD"
  metrics: Record<string, unknown>;
  notes?: string;
  createdAt: Date;
};

function getDb(): Db {
  const dbName = process.env.MONGO_DB || "admin";
  return getMongoClient().db(dbName);
}

export function getCheckinsCollection(): Collection<CheckinDoc> {
  return getDb().collection<CheckinDoc>("checkins");
}


export async function ensureCheckinsIndexes(): Promise<void> {
  const col = getCheckinsCollection();

  const indexes: { key: { [key: string]: number }; name: string; unique?: boolean }[] = [
    { key: { clientId: 1, date: 1 }, name: "uq_checkins_clientId_date", unique: true },
    { key: { clientId: 1, date: -1 }, name: "idx_checkins_clientId_date_desc" }
  ];

  await col.createIndexes(indexes);
}
