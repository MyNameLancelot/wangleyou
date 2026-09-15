import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { validateModules, validateSnapshot } from './check';

function git(...args: string[]): string {
  try { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw new Error(`Git 命令失败：git ${args.join(' ')}。请检查引用存在、历史完整且位于仓库根目录。`); }
}
const split = (s: string) => s.split('\0').filter(Boolean);
try {
  const args = process.argv.slice(2);
  let base: string | undefined;
  let head = 'HEAD';
  let mode = 'range';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' || args[i] === '--head') {
      const key = args[i++];
      if (!args[i] || args[i].startsWith('-')) throw new Error(`${key} 缺少引用`);
      if (key === '--base') base = args[i]; else head = args[i];
    } else if (['--staged', '--worktree', '--structure'].includes(args[i])) {
      if (mode !== 'range') throw new Error('只能选择一种快照模式');
      mode = args[i].slice(2);
    } else throw new Error(`未知参数：${args[i]}`);
  }
  const sha = (ref: string) => git('rev-parse', '--verify', `${ref}^{commit}`).trim();
  let changed: string[] = [];
  let paths: string[];
  let revision: string;
  if (mode === 'staged') {
    if (base || head !== 'HEAD') throw new Error('--staged 不接受 --base/--head');
    changed = split(git('diff', '--cached', '--name-only', '--no-renames', '-z'));
    paths = split(git('ls-files', '-z')); revision = ':';
  } else if (mode === 'structure') {
    if (base || head !== 'HEAD') throw new Error('--structure 不接受 --base/--head');
    paths = split(git('ls-files', '--cached', '--others', '--exclude-standard', '-z')); revision = '';
  } else {
    if (!base) throw new Error('必须显式指定 --base REF；暂存检查用 --staged，结构检查用 --structure。');
    const headSha = sha(head);
    const ancestor = git('merge-base', sha(base), headSha).trim();
    if (mode === 'worktree') {
      if (head !== 'HEAD') throw new Error('--worktree 不接受 --head');
      changed = [...split(git('diff', ancestor, '--name-only', '--no-renames', '-z')), ...split(git('ls-files', '--others', '--exclude-standard', '-z'))];
      paths = split(git('ls-files', '--cached', '--others', '--exclude-standard', '-z')); revision = '';
    } else {
      changed = split(git('diff', ancestor, headSha, '--name-only', '--no-renames', '-z'));
      paths = split(git('ls-tree', '-r', '--name-only', '-z', headSha)); revision = `${headSha}:`;
    }
  }
  const files = new Map<string, string>();
  for (const p of new Set(paths)) {
    if (!revision) {
      try { files.set(p, /\.(md|json|[cm]?[jt]sx?)$/.test(p) ? readFileSync(p, 'utf8') : ''); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    } else files.set(p, /\.(md|json|[cm]?[jt]sx?)$/.test(p) ? git('show', `${revision}${p}`) : '');
  }
  const errors = [...validateSnapshot(files, [...new Set(changed)]), ...validateModules(files)];
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`SDD 检查通过（${mode}，${new Set(changed).size} 个差异路径）。结构通过不代表语义审查完成。`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
