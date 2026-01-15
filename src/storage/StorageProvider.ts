// storage/StorageProvider.ts

export interface StorageProvider {
  /**
   * Returns a presigned URL suitable for HTTP PUT uploads.
   * Caller is responsible for performing the PUT with the same Content-Type.
   */
  getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresSeconds: number
  ): Promise<string>;

  /**
   * Optional: returns a public (or CDN) URL for the object key.
   * If not supported, return undefined.
   */
  getPublicUrl?(key: string): string | undefined;
}
