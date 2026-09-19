import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { validateModules } from './check';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true}); });
function repo() {
  const root = mkdtempSync(path.join(tmpdir(), 'sdd-test-')); roots.push(root);
  const git = (...args: string[]) => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const put = (p: string, c: string) => { mkdirSync(path.dirname(path.join(root,p)), {recursive:true}); writeFileSync(path.join(root,p), c); };
  git('init'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'SDD test');
  put('README.md', '# Test'); git('add', '.'); git('commit', '-m', 'base'); const base = git('rev-parse', 'HEAD');
  const run = (...args: string[]) => spawnSync(process.execPath, ['--import', path.resolve('node_modules/tsx/dist/loader.mjs'), path.resolve('scripts/sdd/cli.ts'), ...args], {cwd: root, encoding:'utf8'});
  const declare = () => put('docs/changes/test/change.json', JSON.stringify({mode:'light', summary:'Documentation', reason:'No behavior change', behavior:false, architecture:false, verification:['Reviewed'], impacts:Object.fromEntries(['requirements','architecture','modules','decisions','readme'].map(k => [k,{status:'none',reason:'No contract change'}]))}));
  return {root, git, put, base, run, declare};
}
it('uses entire multi-commit range and rejects missing base', () => {
  const r = repo(); r.declare(); r.git('add','.'); r.git('commit','-m','record'); r.put('note.md','# Note'); r.git('add','.'); r.git('commit','-m','second');
  expect(r.run('--base',r.base).status).toBe(0);
  expect(r.run('--base','missing-ref').status).toBe(1);
});
it('does not let unstaged declarations mask missing staged records', () => {
  const r = repo(); r.put('note.md','# Note'); r.git('add','.'); r.declare();
  expect(r.run('--staged').status).toBe(1);
  expect(r.run('--worktree','--base',r.base).status).toBe(0);
  r.git('add','.'); r.put('docs/changes/test/change.json','broken');
  expect(r.run('--staged').status).toBe(0);
});
it('handles archive rename and deleted references', () => {
  const r = repo(); r.declare(); r.put('note.md','# Note'); r.put('link.md','[note](note.md)'); r.git('add','.'); r.git('commit','-m','record'); const previous = r.git('rev-parse','HEAD');
  mkdirSync(path.join(r.root,'docs/archive'), {recursive:true}); renameSync(path.join(r.root,'docs/changes/test'),path.join(r.root,'docs/archive/2026-09-15-test'));
  r.git('add','.'); expect(r.run('--staged').status).toBe(0);
  r.git('commit','-m','archive'); expect(r.run('--base',previous).status).toBe(0);
  rmSync(path.join(r.root,'note.md')); r.declare(); r.git('add','.'); expect(r.run('--staged').stderr).toContain('本地链接不存在');
});
it('enforces module direction and public imports including dynamic imports', () => {
  const files = new Map([['src/shared/module.md','# Shared'],['src/shared/x.ts',"export { App } from '../app/App'; import('../albums');"]]);
  const errors = validateModules(files).join(); expect(errors).toContain('不允许依赖 app'); expect(errors).toContain('公开入口'); expect(errors).toContain('不允许依赖 albums');
});
it('rejects imports between isolated theme UI trees', () => {
  const files = new Map([
    ['src/themes/module.md', '# Themes'],
    ['src/themes/beach/Card.tsx', "import { Meadow } from '../grassland/Meadow'; export const Card = Meadow;"],
    ['src/themes/grassland/Meadow.tsx', 'export const Meadow = () => null;'],
  ]);
  expect(validateModules(files).join()).toContain('主题 beach 不得依赖主题 grassland');
});
