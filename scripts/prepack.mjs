// npm pack / publish 前的守卫：公开包里不能出现口令或本机部署配置。
// 这些文件不进 git（见 .gitignore），但 deploy.sh 会把它们生成为运行时副本，
// 在错误的目录里执行 npm pack 就会把 key 带上船。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const forbidden = [
  'static/remote.js',
  'server.log',
  'usage-page-key',
];
for (const f of forbidden) {
  if (existsSync(path.join(root, f))) problems.push(`${f} must not be in the package`);
}

const secret = /[?&]key=[0-9a-f]{16,}|"key"\s*:\s*"[0-9a-f]{16,}"|PAGE_KEY\s*[:=]\s*['"]?[0-9a-f]{16,}/i;
for (const f of ['page/index.html', 'static/index.html', 'server.mjs', 'index.mjs']) {
  const full = path.join(root, f);
  if (!existsSync(full)) continue;
  const text = readFileSync(full, 'utf8');
  if (secret.test(text)) problems.push(`${f} contains what looks like a page key`);
}

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const f of pkg.files) {
  if (!existsSync(path.join(root, f))) problems.push(`files entry is missing: ${f}`);
}
if (!pkg.files.includes('LICENSE')) problems.push('files must include LICENSE');

if (problems.length) {
  console.error('✗ cannot pack:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('✓ package is publishable');