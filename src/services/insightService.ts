// src/services/insightService.ts
import { ClientService } from "./clientService";
import { enqueueInsightGeneration } from "../jobs/insight.queue";
import { getCachedInsight, setCachedInsight } from "../cache/insightCache";
import { InsightRepository } from "../repositories/insightRepository";
import { AppError } from "../middleware/error";

export class InsightService {
  constructor(
    private readonly clientService: ClientService = new ClientService(),
    private readonly repo: InsightRepository = new InsightRepository()
  ) { }

  async enqueueInsight(
    coachUserId: string,
    clientId: string,
    input: { from: string; to: string }
  ): Promise<{ jobId: string }> {
    // ownership check (Postgres)
    await this.clientService.assertCoachOwnsClient(coachUserId, clientId);

    const jobId = `insight_${clientId}_${input.from}_${input.to}`;
    console.log("Enqueueing insight generation job:", jobId);

    const job = await enqueueInsightGeneration(
      { clientId, from: input.from, to: input.to },
      { jobId }
    );

    return { jobId: job.id as string };
  }

  async getInsight(coachUserId: string, clientId: string, input: { from: string; to: string }) {
    await this.clientService.assertCoachOwnsClient(coachUserId, clientId);

    const cached = await getCachedInsight(clientId, input.from, input.to);
    if (cached) return cached;

    const doc = await this.repo.findByClientAndRange({ clientId, from: input.from, to: input.to });
    if (!doc) throw new AppError("NOT_FOUND", "Insight not found", 404);

    const result = {
      insight: {
        id: String((doc as any)._id),
        clientId: doc.clientId,
        from: doc.from,
        to: doc.to,
        avgSleep: doc.signals.avgSleep,
        avgSoreness: doc.signals.avgSoreness,
        weightDelta: doc.signals.weightDelta,
        summary: doc.summary,
        createdAt: doc.createdAt,
      }
    };

    await setCachedInsight(clientId, input.from, input.to, result);
    return result;
  }
}
