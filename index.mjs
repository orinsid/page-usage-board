// magpie 窗口里的「用量看板」页面。
//
// 两层结构（同 Magiczerowxy/magpie-chat、magpie-community/page-usage-tree 的做法）：
//   1. 本文件作为 OpenCode v1 插件被 magpie 的 Bun 宿主加载，加载时启动看板服务。
//   2. page/index.html + page/boot.js 是 magpie 托管的「带路页」：优先跳
//      window.magpie.service（magpie web 在自己域名下的转发路径，页面留在 magpie
//      origin、由 magpie 自己的 key 保护），桌面回退 http://127.0.0.1:3455/。
//      服务端把口令注入返回的看板（window.__KEY__），只有 API 路由校验它。
//
// 服务已在本机跑着（另一个插件实例 / 手动 node）时端口占用，server.mjs 会静默复用。
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

const started = import(pathToFileURL(path.join(here, "server.mjs")).href)
  .then((m) => { m.startServer(); return { ok: true }; })
  .catch((err) => {
    console.error("[magpie-usage-board] server not started:", err?.message || err);
    return { ok: false };
  });

// magpie 把每个导出函数当成插件调用；服务已在加载时起来，这里只等它就绪。
export default {
  id: "magpie-usage-board",
  server: async () => {
    await started.catch(() => null);
    return {};
  },
};
