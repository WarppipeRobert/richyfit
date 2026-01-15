// repositories/uploadRepository.ts
import type { Pool, PoolClient } from "pg";
import { getPostgresPool } from "../config/postgres";
import type { UploadType } from "../services/uploadService";

export type Attachment = {
  id: string;
  clientId: string;
  uploadedByUserId: string;
  type: UploadType;
  s3Key: string;
  contentType: string;
  sizeBytes: number | null;
  createdAt: string; // ISO
};


export class UploadRepository {
  constructor(private readonly pool: Pool = getPostgresPool()) { }

  async insertAttachment(data: {
    id: string;
    clientId: string;
    uploadedByUserId: string;
    type: UploadType;
    s3Key: string;
    contentType: string;
    sizeBytes: number | null;
  }) {
    await this.pool.query(
      `
      INSERT INTO attachments (
        id,
        client_id,
        uploaded_by_user_id,
        type,
        s3_key,
        content_type,
        size_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        data.id,
        data.clientId,
        data.uploadedByUserId,
        data.type,
        data.s3Key,
        data.contentType,
        data.sizeBytes
      ]
    );

    return { attachmentId: data.id };
  }

  async listAttachmentsForClient(clientId: string): Promise<Attachment[]> {
    const result = await this.pool.query(
      `
      SELECT
        id,
        client_id,
        uploaded_by_user_id,
        type,
        s3_key,
        content_type,
        size_bytes,
        created_at
      FROM attachments
      WHERE client_id = $1
      ORDER BY created_at DESC
      `,
      [clientId]
    );

    return result.rows.map((r: any) => ({
      id: r.id,
      clientId: r.client_id,
      uploadedByUserId: r.uploaded_by_user_id,
      type: r.type as UploadType,
      s3Key: r.s3_key,
      contentType: r.content_type,
      sizeBytes: r.size_bytes,
      createdAt: new Date(r.created_at).toISOString()
    }));
  }
}
