import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export type TargetConfig = { bucket: string; endpoint: string };
export type R2Config = TargetConfig & {
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string };
};

export class ConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'ConfigError'; }
}

export function parseTarget(input: unknown): TargetConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ConfigError('R2 config 必须是 JSON 对象');
  const value = input as Record<string, unknown>;
  if (typeof value.bucket !== 'string' || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value.bucket)
    || value.bucket.includes('..') || /^\d+\.\d+\.\d+\.\d+$/.test(value.bucket)) throw new ConfigError('R2 bucket 名称无效');
  let endpoint: URL;
  try { endpoint = new URL(String(value.endpoint)); } catch { throw new ConfigError('R2 endpoint 无效'); }
  if (endpoint.protocol !== 'https:' || !/^[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname)
    || endpoint.port || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
    throw new ConfigError('R2 endpoint 必须是 Cloudflare R2 的 HTTPS S3 API 地址');
  }
  return { bucket: value.bucket, endpoint: endpoint.origin };
}

export function parseConfig(input: unknown): R2Config {
  const target = parseTarget(input);
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !['bucket', 'endpoint', 'credentials'].includes(key))) {
    throw new ConfigError('R2 config 只允许 bucket、endpoint 和 credentials');
  }
  const credentials = value.credentials;
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
    throw new ConfigError('R2 credentials 必须是静态密钥对象');
  }
  const fields = credentials as Record<string, unknown>;
  if (Object.keys(fields).some(key => !['accessKeyId', 'secretAccessKey', 'sessionToken'].includes(key))) {
    throw new ConfigError('R2 credentials 仅允许 accessKeyId、secretAccessKey 和可选 sessionToken');
  }
  const valid = (field: unknown): field is string => typeof field === 'string' && field.length > 0 && field.trim() === field;
  if (!valid(fields.accessKeyId) || !valid(fields.secretAccessKey) || (Object.hasOwn(fields, 'sessionToken') && !valid(fields.sessionToken))) {
    throw new ConfigError('R2 credentials 密钥必须为非空且无首尾空白的字符串');
  }
  return { ...target, credentials: {
    accessKeyId: fields.accessKeyId, secretAccessKey: fields.secretAccessKey,
    ...(typeof fields.sessionToken === 'string' ? { sessionToken: fields.sessionToken } : {}),
  } };
}

export async function loadConfig(root = PROJECT_ROOT): Promise<R2Config> {
  try {
    return parseConfig(JSON.parse(await readFile(resolve(root, '.private/r2/config.json'), 'utf8')));
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError('无法加载 .private/r2/config.json；请检查文件格式与权限');
  }
}
