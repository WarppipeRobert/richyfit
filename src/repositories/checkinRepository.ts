import type { Collection, ObjectId, WithId } from "mongodb";
import { getCheckinsCollection, type CheckinDoc } from "../config/mongo/mongoCheckins";

export type CheckinEntity = WithId<CheckinDoc>;

export class CheckinRepository {
  private readonly col: Collection<CheckinDoc>;

  constructor(col: Collection<CheckinDoc> = getCheckinsCollection()) {
    this.col = col;
  }

  async upsertByClientAndDate(params: {
    clientId: string;
    date: string; // YYYY-MM-DD
    metrics: Record<string, unknown>;
    notes?: string;
  }): Promise<{ id: string; created: boolean }> {
    const now = new Date();

    const metricSets: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params.metrics ?? {})) {
      metricSets[`metrics.${k}`] = v;
    }

    const update: any = {
      $setOnInsert: { clientId: params.clientId, date: params.date, createdAt: now },
      $set: {
        ...metricSets
      }
    };

    if (typeof params.notes === "string") {
      update.$set.notes = params.notes;
    }

    const result = await this.col.findOneAndUpdate(
      { clientId: params.clientId, date: params.date },
      update,
      { upsert: true, returnDocument: "after", includeResultMetadata: true }
    );

    const doc = result.value;
    if (!doc?._id) {
      throw new Error("Upsert failed: no document returned");
    }

    const created = result.lastErrorObject?.updatedExisting === false;
    return { id: String(doc._id), created };
  }

  async listByClientAndRange(params: {
    clientId: string;
    from: string;
    to: string;
    limit: number;
    cursor?: string | null; // last date from previous page
  }): Promise<{ items: CheckinEntity[]; nextCursor: string | null }> {
    const filter: any = {
      clientId: params.clientId,
      date: { $gte: params.from, $lte: params.to }
    };

    if (params.cursor) {
      filter.date.$lt = params.cursor;
    }

    const docs = await this.col
      .find(filter)
      .sort({ date: -1, _id: -1 })
      .limit(params.limit + 1)
      .toArray();

    const hasMore = docs.length > params.limit;
    const items = hasMore ? docs.slice(0, params.limit) : docs;

    const nextCursor = hasMore ? items[items.length - 1]?.date ?? null : null;
    return { items, nextCursor };
  }
}
