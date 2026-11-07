// 同步插件包自带 logo → static/logos/<substance>.<ext> + manifest.json
// 用法: node tools/sync-plugin-logos.mjs
// 数据源（对应关系来自插件源码本身；新 provider 装好后重跑本脚本即可点亮）:
//   1. 插件 package.json 的 "icon" 字段（data URI，base64 或 URL 编码 SVG）
//   2. 插件源码里的内嵌 data URI 常量（如 OFFICEACE_ICON）
//   3. 插件 assets/ 下的图片文件
//   4. 插件源码里引用的 vendor 官方 favicon/logo URL（下载）
//   5. my-patches/*.diff 里内嵌的 data URI（patch 新增 provider 时带图标）
// 产出: static/logos/<substance>.<ext>（文件名=provider substance，即映射本身）
//      static/logos/manifest.json（{substance: /logos/文件}，含别名；deploy.sh 注入页面为 window.QLOGOS）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';

// 可用环境变量覆盖（默认值只依赖当前用户与当前仓库，不含个人绝对路径）
//   MAGPIE_PLUGINS_NM  magpie 插件 node_modules 目录
//   WORKSPACE          仓库根（默认当前目录）
//   OUT                输出目录（默认 <WORKSPACE>/static/logos）
const HOME = process.env.HOME || os.homedir();
const NM = process.env.MAGPIE_PLUGINS_NM || path.join(HOME, '.config', 'magpie', 'plugins', 'node_modules');
const WS = process.env.WORKSPACE || process.cwd();
const OUT = process.env.OUT || path.join(WS, 'static', 'logos');
fs.mkdirSync(OUT, { recursive: true });

// 来源表：substance → 提取声明
const SOURCES = [
  // === @magpie-community auth 插件 ===
  { sub: 'raccoon',   kind: 'pkg-icon', dir: '@magpie-community/opencode-raccoon-auth' },
  { sub: 'autoclaw',  kind: 'pkg-icon', dir: '@magpie-community/opencode-autoclaw-auth' },
  { sub: 'codearts',  kind: 'pkg-icon', dir: '@magpie-community/opencode-codearts-auth' },
  { sub: 'officeace', kind: 'const',    dir: '@magpie-community/opencode-codearts-auth', file: 'index.mjs', constName: 'OFFICEACE_ICON' },
  // === opencode-cn-ai-auth（XcodeFish，多 vendor）===
  { sub: 'loomy',     kind: 'url',      url: 'https://loomy.xunfei.cn/icon.png' },
  { sub: 'astudio',   kind: 'data-in-file', dir: 'opencode-cn-ai-auth', file: 'src/vendors/astudio/product.ts' },
  // === magpie-* / my-* 插件 ===
  { sub: 'kuku',       kind: 'pkg-icon', ws: 'my-kuku' },
  { sub: 'workbuddy',  kind: 'pkg-icon', ws: 'my-workbuddy-extra' },
  { sub: 'monkeycode', kind: 'pkg-icon', ws: 'my-monkeycode-intl' },
  { sub: 'qingyan',    kind: 'url',      ws: 'my-qingyan', urlFrom: /https:\/\/chatglm\.cn\/favicon\.ico/ },
  { sub: 'modelscope', kind: 'url',      ws: 'my-modelscope', urlFrom: /https:\/\/modelscope\.cn\/favicon\.ico/ },
  { sub: 'duanyan',    kind: 'data-in-file', file: 'my-patches/intern-ai.diff', constName: 'const ICON' },
  { sub: 'trae',       kind: 'url',      url: 'https://lf-cdn.trae.com.cn/obj/trae-com-cn/trae_website_prod_cn/favicon.png' },
  { sub: 'zen',        kind: 'url',      url: 'https://opencode.ai/favicon-v3.ico' },
  { sub: 'kiro',       kind: 'url',      url: 'https://kiro.dev/favicon.ico' },
  // === 2026-11-02 补：官方域名 favicon（二进制 grep 到的官方 API 域名 + 站点 favicon）===
  { sub: 'qiniu',      kind: 'url',      url: 'https://www.qiniu.com/favicon.ico' },
  { sub: 'meituan',    kind: 'url',      url: 'https://www.meituan.com/favicon.ico' },
  // === 2026-11-02 补：变体 provider 的官方站标（qoder/cline/qwenwork 取自站点 HTML 的 <link rel=icon>）===
  { sub: 'qoder',      kind: 'url',      url: 'https://img.alicdn.com/imgextra/i4/O1CN01QkSxiCocd3D0prc8_!!6000000008124-2-tps-412-412.png' },
  { sub: 'cline',      kind: 'url',      url: 'https://cline.bot/assets/branding/favicons/favicon-256x256.png' },
  { sub: 'qwenwork',   kind: 'url',      url: 'https://img.alicdn.com/imgextra/i3/O1CN01sMKDxc1tfzpFpRuzW_!!6000000005930-2-tps-48-48.png' },
  { sub: 'sensenova',  kind: 'url',      url: 'https://platform.sensenova.cn/favicon.ico', ext: 'png', min: 100 },
  { sub: 'magicrew',   kind: 'url',      url: 'https://www.magicrew.ai/favicon.ico' },
  { sub: 'zcode',      kind: 'url',      url: 'https://zcode.z.ai/favicon.ico' },
  { sub: 'orcaterm',   kind: 'url',      url: 'https://cloudcache.tencent-cloud.com/qcloud/orcaterm/website/favicon.d6ced2b3.svg' },
  { sub: 'dumate',     kind: 'url',      url: 'https://now.bdstatic.com/store/v2/d33e0f5/qianfan-desktop-h5/286981d/favicon.png' },
  { sub: 'magpie',     kind: 'url',      url: 'https://usemagpie.ai/img/icon-256.png' },
];
// 别名：额度条目的 provider substance → logo substance
const ALIASES = {
  'msmoli': 'modelscope', 'msmoli-ai': 'modelscope',
  'autoclaw-cn': 'autoclaw', 'qingyan-checkin': 'qingyan', 'opencode-zen-free': 'zen',
  'opencode-2-free': 'zen', 'trae-cn': 'trae', 'trae-global': 'trae',
  'workbuddy-extra': 'workbuddy', 'monkeycode-intl': 'monkeycode',
  'hub-magicrew': 'magicrew', 'hub-magicrew-intl': 'magicrew',
  '~keys': 'magpie',
};

const results = [];
function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null));
  });
}
function extOf(uri) {
  const m = uri.match(/^data:image\/(png|jpeg|svg\+xml|webp)/);
  return m ? (m[1] === 'svg+xml' ? 'svg' : m[1] === 'jpeg' ? 'jpg' : m[1]) : null;
}
function pkgIconUri(base) {
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
    const raw = JSON.stringify(pj).match(/"icon"\s*:\s*"(data:image\/[^"]{50,})"/);
    return raw ? raw[1] : null;
  } catch { return null; }
}

for (const src of SOURCES) {
  try {
    let buf = null, ext = null;
    if (src.kind === 'pkg-icon') {
      const base = src.dir ? path.join(NM, src.dir) : path.join(WS, src.ws);
      const uri = pkgIconUri(base);
      if (!uri) { results.push([src.sub, 'skip', '包内无 icon 声明']); continue; }
      ext = extOf(uri); buf = Buffer.from(uri.replace(/^data:image\/[a-z+]+;base64,/, ''), 'base64');
      if (uri.startsWith('data:image/svg+xml,')) { buf = Buffer.from(decodeURIComponent(uri.slice('data:image/svg+xml,'.length))); ext = 'svg'; }
    } else if (src.kind === 'const') {
      const text = fs.readFileSync(path.join(NM, src.dir, src.file), 'utf8');
      const re = new RegExp('const ' + src.constName + ' = "data:image\\/([a-z+]+);base64,([A-Za-z0-9+/=]+)"');
      const m = text.match(re);
      if (!m) { results.push([src.sub, 'skip', '常量未找到']); continue; }
      ext = m[1] === 'svg+xml' ? 'svg' : m[1]; buf = Buffer.from(m[2], 'base64');
    } else if (src.kind === 'data-in-file') {
      const fp = src.dir ? path.join(NM, src.dir, src.file) : path.join(WS, src.file);
      const text = fs.readFileSync(fp, 'utf8');
      const m = text.match(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/);
      if (!m) { results.push([src.sub, 'skip', 'data URI 未找到']); continue; }
      ext = 'svg'; buf = Buffer.from(m[1], 'base64');
    } else if (src.kind === 'asset') {
      const fp = path.join(NM, src.dir, src.file);
      if (!fs.existsSync(fp)) { results.push([src.sub, 'skip', '资产不存在']); continue; }
      buf = fs.readFileSync(fp); ext = path.extname(fp).slice(1);
    } else if (src.kind === 'url') {
      let url = src.url || null;
      if (!url && src.urlFrom) {
        const text = fs.readFileSync(path.join(WS, src.ws, 'index.mjs'), 'utf8') + '\n' + fs.readFileSync(path.join(WS, src.ws, 'package.json'), 'utf8');
        const m = text.match(src.urlFrom); url = m ? m[0] : null;
      }
      if (!url) { results.push([src.sub, 'skip', 'URL 未找到']); continue; }
      // 同步阻塞下载（脚本场景可接受）；只有下载内容才做大小校验
      buf = await fetchUrl(url); ext = src.ext || url.split('.').pop().split('?')[0];
      if (!buf || buf.length < (src.min || 500)) { results.push([src.sub, 'skip', '下载失败/过小']); continue; }
    }
    // 插件声明的图标再小也有效；仅 URL 下载做 <500B 校验（上面已做）
    const file = path.join(OUT, src.sub + '.' + ext);
    fs.writeFileSync(file, buf);
    results.push([src.sub, 'ok', `${buf.length}B → logos/${src.sub}.${ext}`]);
  } catch (e) { results.push([src.sub, 'fail', e.message]); }
}
for (const [sub, st, msg] of results) console.log(st.padEnd(5), sub.padEnd(12), msg);

// manifest.json：目录文件名即映射（substance → /logos/文件），外加别名
const manifest = {};
for (const f of fs.readdirSync(OUT)) {
  const m = f.match(/^([a-z0-9-]+)\.(png|svg|webp|ico|jpg)$/);
  if (m && !f.startsWith('_')) manifest[m[1]] = '/logos/' + f;
}
for (const [from, to] of Object.entries(ALIASES)) if (manifest[to]) manifest[from] = manifest[to];
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log('manifest:', Object.keys(manifest).length, '个映射（含别名）');
