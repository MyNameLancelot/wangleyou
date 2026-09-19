import path from 'node:path';
import ts from 'typescript';

const recordPath = /^docs\/(changes|archive)\/[^/]+\/change\.json$/;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const safePath = (v: unknown): v is string => text(v) && !v.startsWith('/') && !v.includes('\\') && !v.split('/').includes('..');

export function validateSnapshot(files: Map<string, string>, changed: string[]): string[] {
  const errors: string[] = [];
  const records = changed.filter(p => recordPath.test(p) && files.has(p));
  if (changed.length && !records.length) errors.push('本次差异缺少 change.json；请新增或更新完整/轻量变更声明。');
  for (const p of records) {
    const fail = (s: string) => errors.push(`${p}: ${s}`);
    let r: unknown;
    try { r = JSON.parse(files.get(p)!); } catch { fail('JSON 无效'); continue; }
    if (!object(r)) { fail('声明必须是对象'); continue; }
    if (!['full', 'light'].includes(String(r.mode))) fail('mode 必须为 full 或 light');
    for (const key of ['summary', 'reason']) if (!text(r[key])) fail(`${key} 必须填写实际内容`);
    for (const key of ['behavior', 'architecture']) if (typeof r[key] !== 'boolean') fail(`${key} 必须为布尔值`);
    if ((r.behavior === true || r.architecture === true) && r.mode !== 'full') fail('行为或架构变化必须使用 full');
    if (!Array.isArray(r.verification) || !r.verification.length || !r.verification.every(text)) fail('verification 必须列出验证证据');
    if (r.mode === 'full') for (const name of ['spec', 'plan', 'tasks']) {
      const doc = `${path.posix.dirname(p)}/${name}.md`;
      const body = files.get(doc) ?? '';
      if (!/^#\s+.+/m.test(body) || !text(body.replace(/^#+.*$/gm, ''))) fail(`缺少有效 ${name}.md（需要标题与实际内容）`);
      if (name === 'tasks' && !/^- \[([ xX])\] .+/m.test(body)) fail('tasks.md 需要任务勾选列表');
      if (name === 'tasks' && p.startsWith('docs/archive/') && /^- \[ \]/m.test(body)) fail('归档 tasks.md 仍有未完成任务');
    }
    for (const key of ['requirements', 'architecture', 'modules', 'decisions', 'readme']) {
      const impact = object(r.impacts) ? r.impacts[key] : null;
      if (!object(impact) || !text(impact.reason) || !['updated', 'none'].includes(String(impact.status))) { fail(`impacts.${key} 需要 status(updated/none) 和 reason`); continue; }
      if (impact.status === 'updated') {
        if (!Array.isArray(impact.paths) || !impact.paths.length) fail(`impacts.${key}.paths 不能为空`);
        else for (const target of impact.paths) {
          if (!safePath(target) || !changed.includes(target)) fail(`${String(target)} 必须是本次差异中的仓库相对路径`);
          // A deleted document is valid if its removal is explicitly declared and reviewed.
        }
      }
    }
  }
  // Check changed Markdown links, including removed targets referenced by unchanged docs.
  for (const [p, content] of files) {
    if (!p.endsWith('.md')) continue;
    const prose = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');
    for (const match of prose.matchAll(/!?\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g)) {
      const href = match[1];
      if (/^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(href)) continue;
      let target: string;
      try { target = path.posix.normalize(path.posix.join(path.posix.dirname(p), decodeURIComponent(href.split(/[?#]/)[0]))); }
      catch { errors.push(`${p}: 无效链接 ${href}`); continue; }
      if (!changed.includes(p) && !changed.includes(target)) continue;
      if (!files.has(target) && ![...files.keys()].some(f => f.startsWith(`${target}/`))) errors.push(`${p}: 本地链接不存在 ${href}`);
    }
  }
  return errors;
}

const allowed: Record<string, string[]> = {
  app: ['albums', 'media-viewer', 'playback', 'content', 'themes', 'shared'],
  albums: ['content', 'shared'], 'media-viewer': ['playback', 'content', 'shared'],
  playback: ['content', 'shared'], content: ['shared'], themes: ['content', 'playback', 'albums', 'app'], shared: [],
};
export function validateModules(files: Map<string, string>): string[] {
  const errors: string[] = [];
  for (const [p, content] of files) {
    if (!/^src\/[^/]+\/.+\.[cm]?[jt]sx?$/.test(p)) continue;
    const owner = p.split('/')[1];
    if (!allowed[owner]) { errors.push(`${p}: 未声明模块依赖规则`); continue; }
    if (!files.has(`src/${owner}/module.md`)) errors.push(`${owner}: 缺少 module.md`);
    const source = ts.createSourceFile(p, content, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      let value: ts.Expression | undefined;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) value = node.moduleSpecifier;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')) value = node.arguments[0];
      if (value && ts.isStringLiteralLike(value)) {
        const spec = value.text;
        if (spec.startsWith('.')) {
          const target = path.posix.normalize(path.posix.join(path.posix.dirname(p), spec));
          const parts = target.split('/');
          const theme = /^src\/themes\/(beach|grassland)\//.exec(p)?.[1];
          const targetTheme = /^src\/themes\/(beach|grassland)(?:\/|$)/.exec(target)?.[1];
          if (theme && targetTheme && targetTheme !== theme) errors.push(`${p}: 主题 ${theme} 不得依赖主题 ${targetTheme}`);
          if (parts[0] === 'src' && parts[1] !== owner) {
            const other = parts[1];
            if (!allowed[owner].includes(other)) errors.push(`${p}: 不允许依赖 ${other}`);
            if (parts.length > 2 && !/^index(?:\.[jt]sx?)?$/.test(parts.slice(2).join('/'))) errors.push(`${p}: 跨模块必须使用 ${other} 的公开入口`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return errors;
}
