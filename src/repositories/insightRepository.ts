// src/repositories/insightRepository.ts
import type { Collection } from "mongodb";
import { getInsightsCollection, InsightDoc } from "../config/mongo/mongoInsights";

export class InsightRepository {
  private readonly col: Collection<InsightDoc>;

  constructor(col: Collection<InsightDoc> = getInsightsCollection()) {
    this.col = col;
  }

  async upsertByClientAndRange(params: {
    clientId: string;
    from: string;
    to: string;
    signals: Record<string, unknown>;
    summary: string;
  }): Promise<{ id: string; created: boolean }> {
    const now = new Date();

    const result = await this.col.findOneAndUpdate(
      { clientId: params.clientId, from: params.from, to: params.to },
      {
        $setOnInsert: { clientId: params.clientId, from: params.from, to: params.to, createdAt: now },
        $set: {
          signals: params.signals,
          summary: params.summary,
          updatedAt: now
        }
      },
      { upsert: true, returnDocument: "after", includeResultMetadata: true }
    );

    const doc = result.value;
    if (!doc?._id) throw new Error("Insight upsert failed: no document returned");

    const created = result.lastErrorObject?.updatedExisting === false;
    return { id: String(doc._id), created };
  }

  async findByClientAndRange(params: { clientId: string; from: string; to: string }) {
    return this.col.findOne({ clientId: params.clientId, from: params.from, to: params.to });
  }
}
