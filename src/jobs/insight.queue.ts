// src/jobs/insight.queue.ts
import type { JobsOptions } from "bullmq";
import { createQueue } from "./queues";

export const INSIGHT_QUEUE_NAME = "insight-generation";

export type InsightJobData = {
  clientId: string;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

export type InsightJobResult = {
  ok: true;
};

export const insightQueue = createQueue<InsightJobData, InsightJobResult>(INSIGHT_QUEUE_NAME);

export async function enqueueInsightGeneration(
  data: InsightJobData,
  opts: JobsOptions = {}
) {
  // jobId makes it naturally idempotent if you want (caller can pass their own)
  return insightQueue.add("generate", data, {
    removeOnComplete: 1000,
    removeOnFail: 1000,
    ...opts
  });
}
