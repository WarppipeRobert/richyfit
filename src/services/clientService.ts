import { ClientRepository, type Pagination, type ClientForCoach } from "../repositories/clientRepository";

export class ClientService {
  constructor(private readonly clients: ClientRepository = new ClientRepository()) { }

  async createClient(coachUserId: string, data: { name: string; email?: string | null }) {
    const { client } = await this.clients.createClientWithLink(coachUserId, {
      name: data.name,
      email: data.email ?? null
    });

    return { clientId: client.id };
  }

  async listClients(coachUserId: string, pagination: Pagination) {
    return this.clients.listClientsForCoach(coachUserId, pagination);
  }

  async getClient(coachUserId: string, clientId: string): Promise<ClientForCoach | null> {
    return this.clients.getClientForCoach(coachUserId, clientId);
  }
}
