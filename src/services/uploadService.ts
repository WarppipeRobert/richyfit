// services/uploadService.ts
import { randomUUID } from "crypto";

import { AppError } from "../middleware/error";
import { getStorageProvider } from "../storage";
import { UploadRepository } from "../repositories/uploadRepository";
import { ClientService } from "./clientService";

export type UploadType = "progress_photo" | "document";

/**
 * Policy (documented):
 * - progress_photo: max 10MB
 * - document (pdf): max 25MB
 * Enforcement can be done via S3 bucket policy / presigned conditions later.
 */
const MAX_SIZE_BYTES: Record<UploadType, number> = {
  progress_photo: 10 * 1024 * 1024,
  document: 25 * 1024 * 1024
};

// Hard rule
const PRESIGN_EXPIRES_MIN = 60;
const PRESIGN_EXPIRES_MAX = 300;

export class UploadService {
  constructor(
    private readonly uploads: UploadRepository = new UploadRepository(),
    private readonly clientService: ClientService = new ClientService()
  ) { }

  async createUploadUrl(
    coachUserId: string,
    clientId: string,
    data: { type: UploadType; contentType: string; sizeBytes: number | null }
  ) {
    await this.clientService.assertCoachOwnsClient(coachUserId, clientId);

    // Max file size policy (validated here; enforcement at upload time can be via S3 policy later)
    if (data.sizeBytes !== null) {
      const max = MAX_SIZE_BYTES[data.type];
      if (data.sizeBytes > max) {
        throw new AppError(
          "BAD_REQUEST",
          `File too large. Max ${max} bytes for ${data.type}`,
          400
        );
      }
    }

    const attachmentId = randomUUID();
    const ext = this.extFromContentType(data.contentType);
    const s3Key = `clients/${clientId}/${attachmentId}.${ext}`;

    await this.uploads.insertAttachment({
      id: attachmentId,
      clientId,
      uploadedByUserId: coachUserId,
      type: data.type,
      s3Key,
      contentType: data.contentType,
      sizeBytes: null
    });

    const storage = getStorageProvider();

    const expiresSeconds = Number(process.env.S3_PRESIGN_EXPIRES_SECONDS ?? 300);
    if (!Number.isFinite(expiresSeconds) || expiresSeconds <= 0) {
      throw new AppError("INTERNAL", "Invalid S3_PRESIGN_EXPIRES_SECONDS", 500);
    }

    const putUrl = await storage.getPresignedPutUrl(s3Key, data.contentType, expiresSeconds);

    return {
      attachmentId,
      putUrl,
      s3Key
    };
  }

  async listUploads(coachUserId: string, clientId: string) {
    await this.clientService.assertCoachOwnsClient(coachUserId, clientId);

    const attachments = await this.uploads.listAttachmentsForClient(clientId);

    return { attachments };
  }


  private extFromContentType(contentType: string): string {
    const ct = contentType.toLowerCase().trim();

    // common image types
    if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
    if (ct === "image/png") return "png";
    if (ct === "image/webp") return "webp";
    if (ct === "image/heic") return "heic";
    if (ct === "image/heif") return "heif";
    if (ct === "image/gif") return "gif";

    // documents
    if (ct === "application/pdf") return "pdf";
    if (ct === "text/plain") return "txt";

    // safe fallback
    return "bin";
  }
}
