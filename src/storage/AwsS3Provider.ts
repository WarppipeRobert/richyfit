// storage/AwsS3Provider.ts

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./StorageProvider";

type AwsS3ProviderConfig = {
  bucket: string;
  region: string;
  publicBaseUrl?: string; // e.g. https://cdn.example.com or https://my-bucket.s3.amazonaws.com
  endpoint?: string; // optional for S3-compatible (minio/r2), e.g. https://...
  forcePathStyle?: boolean; // needed for some S3-compatible endpoints
};

export class AwsS3Provider implements StorageProvider {
  private readonly enabled: boolean;
  private readonly config: AwsS3ProviderConfig;
  private readonly client?: S3Client;

  constructor(config: AwsS3ProviderConfig, enabled: boolean) {
    this.config = config;
    this.enabled = enabled;

    if (!enabled) return;

    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      ...(typeof config.forcePathStyle === "boolean"
        ? { forcePathStyle: config.forcePathStyle }
        : {}),
      // Credentials are resolved by AWS SDK:
      // - env vars: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN
      // - shared config/credentials files
      // - IAM role (ECS/EC2)
    });
  }

  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresSeconds: number
  ): Promise<string> {
    if (!this.enabled || !this.client) {
      throw new Error(
        "AwsS3Provider is disabled. Set STORAGE_PROVIDER=s3 and AWS_S3_BUCKET/AWS_REGION (+ credentials) to enable."
      );
    }

    if (!key || key.trim().length === 0) {
      throw new Error("key is required");
    }
    if (!contentType || contentType.trim().length === 0) {
      throw new Error("contentType is required");
    }
    if (!Number.isFinite(expiresSeconds) || expiresSeconds <= 0) {
      throw new Error("expiresSeconds must be a positive number");
    }

    const cmd = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, cmd, { expiresIn: expiresSeconds });
  }

  getPublicUrl(key: string): string | undefined {
    if (!this.enabled) return undefined;

    const base = this.config.publicBaseUrl?.replace(/\/+$/, "");
    if (base) {
      return `${base}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
    }

    // Default S3 virtual-hosted style (works for standard AWS S3)
    // If using a custom endpoint (minio/r2) you should set publicBaseUrl explicitly.
    const region = this.config.region;
    const bucket = this.config.bucket;

    // us-east-1 has a slightly different pattern sometimes, but this works broadly.
    return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key).replace(
      /%2F/g,
      "/"
    )}`;
  }

  static fromEnv(): AwsS3Provider {
    const provider = process.env.STORAGE_PROVIDER?.toLowerCase();
    const enabled = provider === "s3";

    const bucket = process.env.AWS_S3_BUCKET ?? "";
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "";
    const publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL; // optional
    const endpoint = process.env.AWS_S3_ENDPOINT; // optional
    const forcePathStyle =
      process.env.AWS_S3_FORCE_PATH_STYLE?.toLowerCase() === "true";

    // Gate by env: compile-time complete; runtime throws only if you call methods while disabled/misconfigured.
    return new AwsS3Provider(
      {
        bucket,
        region,
        publicBaseUrl,
        endpoint,
        forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE
          ? forcePathStyle
          : undefined,
      },
      enabled && bucket.length > 0 && region.length > 0
    );
  }
}
