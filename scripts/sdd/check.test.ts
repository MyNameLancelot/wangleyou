import { expect, it } from 'vitest';
import { validateSnapshot } from './check';

export function fixture(mode = 'full') {
  const root = 'docs/changes/example';
  const record = { mode, summary: 'Change example', reason: 'Existing behavior is preserved', behavior: false, architecture: false,
    designImpact: 'none', designReason: 'No user-visible visual or interaction changes',
    verification: ['npm test passed'], impacts: Object.fromEntries(['requirements', 'architecture', 'modules', 'decisions', 'readme'].map(k => [k, { status: 'none', reason: 'No relevant contract changed' }])) };
  const files = new Map<string, string>([[`${root}/change.json`, JSON.stringify(record)]]);
  if (mode === 'full') for (const name of ['spec', 'plan', 'tasks']) files.set(`${root}/${name}.md`, '# Record\n\n## Evidence\n\nMeaningful details.\n- [x] Verified');
  return { files, record, root, changed: [...files.keys(), 'src/example.ts'] };
}
it('rejects missing declarations', () => expect(validateSnapshot(new Map(), ['src/a.ts'])).toContain('本次差异缺少 change.json；请新增或更新完整/轻量变更声明。'));
it.each(['full', 'light'])('accepts %s records', mode => { const f = fixture(mode); expect(validateSnapshot(f.files, f.changed)).toEqual([]); });
it('requires full documents', () => { const f = fixture(); f.files.delete(`${f.root}/plan.md`); expect(validateSnapshot(f.files, f.changed).join()).toContain('plan.md'); });
it('rejects light behavior changes and missing reasons', () => { const f = fixture('light'); f.record.behavior = true; f.record.reason = ''; f.files.set(`${f.root}/change.json`, JSON.stringify(f.record)); expect(validateSnapshot(f.files, f.changed).length).toBeGreaterThanOrEqual(2); });
it.each([
  ['missing', undefined, 'Visible impact must be classified'],
  ['invalid', 'visual', 'Visible impact must be classified'],
  ['empty reason', 'sync', ''],
])('rejects %s design impact declarations', (_name, impact, reason) => {
  const f = fixture();
  if (impact === undefined) delete (f.record as Partial<typeof f.record>).designImpact;
  else f.record.designImpact = impact;
  f.record.designReason = reason;
  f.files.set(`${f.root}/change.json`, JSON.stringify(f.record));
  expect(validateSnapshot(f.files, f.changed).length).toBeGreaterThan(0);
});
it('requires full mode for design updates', () => {
  const f = fixture('light');
  f.record.designImpact = 'update';
  f.record.designReason = 'A new interaction pattern changes the Penpot baseline';
  f.files.set(`${f.root}/change.json`, JSON.stringify(f.record));
  expect(validateSnapshot(f.files, f.changed).join()).toContain('设计更新必须使用 full');
});
it('rejects invalid JSON and broken local references', () => { const f = fixture(); f.files.set(`${f.root}/change.json`, '{'); f.files.set(`${f.root}/spec.md`, '# Spec\n[missing](missing.md)'); expect(validateSnapshot(f.files, f.changed).join()).toMatch(/JSON/); expect(validateSnapshot(f.files, f.changed).join()).toMatch(/missing.md/); });
it('requires updated impact paths to occur in diff', () => { const f = fixture(); Object.assign(f.record.impacts.requirements, {status: 'updated', paths: ['docs/requirements.md']}); f.files.set('docs/requirements.md', '# Requirements'); f.files.set(`${f.root}/change.json`, JSON.stringify(f.record)); expect(validateSnapshot(f.files, f.changed).join()).toContain('差异'); });
it('accepts archived records', () => { const f = fixture(); const move = (p: string) => p.replace('changes/example', 'archive/2026-09-15-example'); expect(validateSnapshot(new Map([...f.files].map(([p,c]) => [move(p),c])), [...f.changed, ...f.changed.map(move)])).toEqual([]); });

it('rejects empty full documents and unfinished archives', () => {
  const f = fixture(); f.files.set(`${f.root}/spec.md`, '# Title only');
  expect(validateSnapshot(f.files, f.changed).join()).toContain('spec.md');
  f.files.set(`${f.root}/tasks.md`, '# Tasks\n- [ ] Unfinished');
  const move = (p: string) => p.replace('changes/example', 'archive/example');
  expect(validateSnapshot(new Map([...f.files].map(([p,c]) => [move(p),c])), f.changed.map(move)).join()).toContain('未完成任务');
});
it('rejects missing impact categories and verification evidence', () => {
  const f = fixture(); f.files.set(`${f.root}/change.json`, JSON.stringify({mode:'full', reason:'Example', summary:'Example', behavior:false, architecture:false}));
  expect(validateSnapshot(f.files, f.changed).join()).toContain('impacts.requirements');
  expect(validateSnapshot(f.files, f.changed).join()).toContain('verification');
});
