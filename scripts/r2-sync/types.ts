export const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
export const UPLOAD_CONCURRENCY = 4;
export const HASH_CONCURRENCY = 2;

export type FileStamp = {
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
  ino: bigint;
  dev: bigint;
};
export type LocalMedia = {
  key: string;
  absolutePath: string;
  size: number;
  md5Hex: string;
  md5Base64: string;
  contentType: string;
  cacheControl: string;
  stamp: FileStamp;
};
export type RemoteMedia = {
  key: string;
  size: number;
  etag: string;
  lastModified: string;
};
export type SyncPlan = {
  uploads: Array<{ file: LocalMedia; reason: 'new' | 'changed' | 'unverified' }>;
  skipped: string[];
  removals: RemoteMedia[];
};
export type SyncFailure = { key: string; phase: string; code: string };
export type SyncResult = {
  uploaded: string[];
  deleted: string[];
  skipped: string[];
  failures: SyncFailure[];
  uploadedBytes: number;
};
export interface R2Store {
  list(signal: AbortSignal): Promise<Map<string, RemoteMedia>>;
  headMd5(key: string, signal: AbortSignal): Promise<string | undefined>;
  put(file: LocalMedia, signal: AbortSignal): Promise<string>;
  remove(objects: RemoteMedia[], signal: AbortSignal): Promise<SyncFailure[]>;
  close(): void;
}
