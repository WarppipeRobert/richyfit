// storage/index.ts
// Simple env-driven provider selection (extensible later)

import type { StorageProvider } from "./StorageProvider";
import { AwsS3Provider } from "./AwsS3Provider";

export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER?.toLowerCase();

  switch (provider) {
    case "s3":
      return AwsS3Provider.fromEnv();
    default:
      // Disabled provider to make misconfig obvious at runtime if used
      return {
        async getPresignedPutUrl(): Promise<string> {
          throw new Error(
            "Storage is not configured. Set STORAGE_PROVIDER=s3 to enable uploads."
          );
        },
        getPublicUrl(): string | undefined {
          return undefined;
        },
      };
  }
}
