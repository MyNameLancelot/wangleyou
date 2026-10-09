import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, parseConfig } from './config';

const endpoint = 'https://00000000000000000000000000000000.r2.cloudflarestorage.com';
const folders: string[] = [];
const credentials = { accessKeyId: 'FAKE_FILE_KEY', secretAccessKey: 'FAKE_FILE_SECRET' };
const target = { bucket: 'family-media', endpoint };
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
describe('R2 local configuration', () => {
  it('accepts only a bucket and an official HTTPS endpoint', () => {
    expect(parseConfig({ ...target, endpoint: endpoint + '/', credentials })).toEqual({ ...target, credentials });
    for (const invalid of ['http://example.test', endpoint + '/bucket', endpoint + '?token=secret', endpoint.replace('https://', 'https://secret@')]) {
      expect(() => parseConfig({ ...target, endpoint: invalid, credentials })).toThrow();
    }
    expect(() => parseConfig({ ...target, credentials, secretAccessKey: 'sample-secret' })).toThrow(/只允许/);
  });
  it('requires explicit static keys, rejecting missing, blank, malformed and extra fields without echoing input', () => {
    for (const invalid of [undefined, null, [], 'sample-secret', {}, { ...credentials, accessKeyId: '' },
      { ...credentials, secretAccessKey: 123 }, { ...credentials, secretAccessKey: ' ' },
      { ...credentials, secretAccessKey: ' sample-secret ' }, { ...credentials, sessionToken: '' },
      { ...credentials, credential_process: 'sample-secret' }, { ...credentials, role_arn: 'sample-secret' }]) {
      expect(() => parseConfig({ ...target, credentials: invalid })).toThrow();
      expect(() => parseConfig({ ...target, credentials: invalid })).not.toThrow(/sample-secret/);
    }
    expect(parseConfig({ ...target, credentials: { ...credentials, sessionToken: 'FAKE_TOKEN' } }).credentials.sessionToken).toBe('FAKE_TOKEN');
  });
  it('loads only the merged JSON, never falling back to the old file or environment, and redacts JSON errors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'r2-config-')); folders.push(root);
    const directory = join(root, '.private/r2'); await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'config.json'), JSON.stringify({ ...target, credentials }));
    await writeFile(join(directory, 'credentials'), '[r2]\naws_access_key_id = FAKE_OLD_KEY\naws_secret_access_key = FAKE_OLD_SECRET\n');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'FAKE_ENV_KEY'); vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'FAKE_ENV_SECRET');
    const config = await loadConfig(root);
    expect(config.credentials.accessKeyId).toBe('FAKE_FILE_KEY');
    expect(config.credentials.secretAccessKey).toBe('FAKE_FILE_SECRET');
    await writeFile(join(directory, 'config.json'), '{ "secret": "secret_should_never_be_printed",');
    await expect(loadConfig(root)).rejects.not.toThrow(/secret_should/);
    await rm(join(directory, 'config.json'));
    await expect(loadConfig(root)).rejects.toThrow(/无法加载/);
  });
});
