import { Worker, type Job } from "bullmq";
import { getBullConnection } from "../jobs/queues";
import { INSIGHT_QUEUE_NAME, type InsightJobData, type InsightJobResult } from "../jobs/insight.queue";
import { CheckinRepository } from "../repositories/checkinRepository";
import { InsightRepository } from "../repositories/insightRepository";
import { invalidateCachedInsight } from "../cache/insightCache";

let worker: Worker<InsightJobData, InsightJobResult> | null = null;

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function pickMetric(metrics: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!metrics) return null;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(metrics, k)) {
      const n = toNumber((metrics as any)[k]);
      if (n !== null) return n;
    }
  }
  return null;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = nums.reduce((a, b) => a + b, 0);
  return s / nums.length;
}

function buildSummary(params: {
  avgSleep: number | null;
  avgSoreness: number | null;
  weightDelta: number | null;
}): string {
  const lines: string[] = [];

  const lowSleep = params.avgSleep !== null && params.avgSleep < 7;
  const highSoreness = params.avgSoreness !== null && params.avgSoreness >= 6;

  if (lowSleep && highSoreness) {
    lines.push("Recovery warning: low average sleep with high soreness.");
  }

  if (params.weightDelta !== null && params.weightDelta < 0) {
    lines.push(`Weight trend: down ${Math.abs(params.weightDelta).toFixed(1)} over the period.`);
  } else if (params.weightDelta !== null && params.weightDelta > 0) {
    lines.push(`Weight trend: up ${params.weightDelta.toFixed(1)} over the period.`);
  }

  if (lines.length === 0) return "No notable signals detected for this period.";
  return lines.join(" ");
}

export function startInsightWorker() {
  if (worker) return worker;

  const checkinsRepo = new CheckinRepository();
  const insightsRepo = new InsightRepository();

  worker = new Worker<InsightJobData, InsightJobResult>(
    INSIGHT_QUEUE_NAME,
    async (job: Job<InsightJobData>) => {
      const { clientId, from, to } = job.data;

      const all: any[] = [];
      let cursor: string | null = null;

      for (let i = 0; i < 50; i++) {
        const { items, nextCursor } = await checkinsRepo.listByClientAndRange({
          clientId,
          from,
          to,
          limit: 100,
          cursor
        });

        all.push(...items);
        if (!nextCursor) break;
        cursor = nextCursor;
      }

      const sleepVals: number[] = [];
      const sorenessVals: number[] = [];
      const weightByDateDesc: { date: string; weight: number }[] = [];

      for (const d of all) {
        const metrics = (d as any).metrics as Record<string, unknown> | undefined;

        const sleep = pickMetric(metrics, ["sleep", "sleepHours", "sleep_hours"]);
        if (sleep !== null) sleepVals.push(sleep);

        const soreness = pickMetric(metrics, ["soreness", "sorenessLevel", "soreness_level"]);
        if (soreness !== null) sorenessVals.push(soreness);

        const weight = pickMetric(metrics, ["weight", "bodyweight", "body_weight"]);
        if (weight !== null) weightByDateDesc.push({ date: (d as any).date, weight });
      }

      const avgSleep = avg(sleepVals);
      const avgSoreness = avg(sorenessVals);

      let weightDelta: number | null = null;
      if (weightByDateDesc.length >= 2) {
        const newest = weightByDateDesc[0]!.weight;
        const oldest = weightByDateDesc[weightByDateDesc.length - 1]!.weight;
        weightDelta = newest - oldest;
      }

      const summary = buildSummary({ avgSleep, avgSoreness, weightDelta });

      const upserted = await insightsRepo.upsertByClientAndRange({
        clientId,
        from,
        to,
        signals: {
          avgSleep,
          avgSoreness,
          weightDelta
        },
        summary
      });

      await invalidateCachedInsight(clientId, from, to);

      return { ok: true, insightId: upserted.id };
    },
    {
      connection: getBullConnection(),
      concurrency: Number(process.env.INSIGHT_WORKER_CONCURRENCY ?? 5)
    }
  );

  worker.on("failed", (job, err) => {
    console.error("[insight-worker] job failed", { id: job?.id, name: job?.name, err });
  });

  worker.on("error", (err) => {
    console.error("[insight-worker] worker error", err);
  });

  return worker;
}

export async function stopInsightWorker() {
  if (!worker) return;
  await worker.close();
  worker = null;
}
