// controllers/uploadController.ts
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../middleware/error";
import { UploadService } from "../services/uploadService";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
const ALLOWED_TYPES = ["progress_photo", "document"] as const;

const uploadInitSchema = z
  .object({
    type: z.enum(ALLOWED_TYPES),
    contentType: z.enum(ALLOWED_CONTENT_TYPES),
    // Optional now; not enforced against S3 yet, but validated + stored for policy and later enforcement
    sizeBytes: z.coerce.number().int().min(1).max(25 * 1024 * 1024).optional()
  })
  .superRefine((val, ctx) => {
    // Rule: progress_photo must be an image
    if (val.type === "progress_photo" && !val.contentType.startsWith("image/")) {
      ctx.addIssue({
        code: 'custom',
        message: "progress_photo must be an image contentType"
      });
    }

    // Rule: document must be a pdf
    if (val.type === "document" && val.contentType !== "application/pdf") {
      ctx.addIssue({
        code: 'custom',
        message: "document must be application/pdf"
      });
    }
  });
const clientIdSchema = z.object({
  clientId: z.uuid()
});

export class UploadController {
  constructor(private readonly service: UploadService = new UploadService()) { }

  createUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paramsParsed = clientIdSchema.safeParse(req.params);
      if (!paramsParsed.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      const bodyParsed = uploadInitSchema.safeParse(req.body);
      if (!bodyParsed.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const result = await this.service.createUploadUrl(req.user.id, paramsParsed.data.clientId, {
        type: bodyParsed.data.type,
        contentType: bodyParsed.data.contentType,
        sizeBytes: bodyParsed.data.sizeBytes ?? null
      });

      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  };

  listUploads = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paramsParsed = clientIdSchema.safeParse(req.params);
      if (!paramsParsed.success) throw new AppError("BAD_REQUEST", "Invalid input", 400);

      if (!req.user) throw new AppError("UNAUTHORIZED", "Missing or invalid token", 401);

      const result = await this.service.listUploads(req.user.id, paramsParsed.data.clientId);
      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  };
}
