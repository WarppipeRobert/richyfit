import { AppError } from "../middleware/error";
import { CheckinRepository } from "../repositories/checkinRepository";
import { ClientService } from "./clientService";
import { bumpCheckinsVersion, getCachedCheckins, getCheckinsVersion, setCachedCheckins } from "../cache/checkinsCache";

export class CheckinService {
  constructor(
    private readonly repo: CheckinRepository = new CheckinRepository(),
    private readonly clientService: ClientService = new ClientService()
  ) { }

  async upsertDailyCheckin(coachUserId: string, clientId: string, input: {
    date: string;
    metrics: Record<string, unknown>;
    notes?: string;
  }): Promise<{ status: 200 | 201; checkinId: string }> {
    // ✅ single reusable guard
    await this.clientService.assertCoachOwnsClient(coachUserId, clientId);

    const { id, created } = await this.repo.upsertByClientAndDate({
      clientId,
      date: input.date,
      metrics: input.metrics,
      notes: input.notes
    });

    await bumpCheckinsVersion(clientId);

    return { status: created ? 201 : 200, checkinId: id };
  }

  async listCheckinsRange(coachUserId: string, clientId: string, input: {
    from: string;
    to: string;
    limit: number;
    cursor?: string | null;
  }) {
    await this.clientService.assertCoachOwnsClient(coachUserId, clientId);

    const ver = await getCheckinsVersion(clientId);

    const cacheParams = {
      ver,
      clientId,
      from: input.from,
      to: input.to,
      limit: input.limit,
      cursor: input.cursor ?? null
    };

    const cached = await getCachedCheckins(cacheParams);

    if (cached) return cached;

    const { items, nextCursor } = await this.repo.listByClientAndRange({
      clientId,
      from: input.from,
      to: input.to,
      limit: input.limit,
      cursor: input.cursor ?? null
    });

    const result = {
      items: items.map((d) => ({
        id: String(d._id),
        clientId: d.clientId,
        date: d.date,
        metrics: d.metrics,
        notes: d.notes,
        createdAt: d.createdAt
      })),
      nextCursor
    };

    await setCachedCheckins(cacheParams, result);

    return result;
  }
}
