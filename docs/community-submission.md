# Community submission

The community publishes packages by merging a pull request into
[`magpie-community/plugins`](https://github.com/magpie-community/plugins). There is no npm
publish and no dashboard form. One PR adds three things:

1. `packages/page-usage-board/` — this package (all files from `npm pack`, plus `LICENSE`,
   `README.md` and `docs/` — see the layout trap below).
2. One entry in `registry.json`.
3. One row in the README's **Pages** table.

## registry.json entry

```json
{
  "package": "@magpie-community/page-usage-board",
  "name": "Usage Board",
  "kind": "page",
  "community": true,
  "summary": {
    "en": "A quota wall with expiry tiers, daily and per-provider usage charts, 24-hour cache-hit and token curves, optional remote attribution and account detail. Served by the plugin's own local service.",
    "zh": "额度到期卡片墙 + 每日/模型/provider 用量图表 + 24 小时缓存命中与 token 曲线，可选远端归因与账号明细。由插件自带本机服务供数。"
  }
}
```

## README Pages row

```md
| [page-usage-board](packages/page-usage-board) | Full usage board: quota cards with expiry tiers, daily and per-provider charts, 24-hour cache-hit and token curves, optional remote attribution and account detail | your local `usage.jsonl` and Magpie's local usage/quota API |
```

## The `docs/` layout trap

`npm pack` ships only what the `files` field in package.json lists, and `docs/` is not among
them. If the PR copies just the pack output, the merged package has no `docs/` directory and
every relative link in README.md — `docs/docker.md`, `docs/self-hosting.md`,
`docs/data-semantics.md` — 404s, along with the Docker files those pages tell readers to use.

Correct layout for `packages/page-usage-board/`: the `npm pack` output, plus `LICENSE`,
`README.md`, the whole `docs/` directory, and `Dockerfile`, `docker-compose.yml` and
`.env.example` (referenced by `docs/docker.md`).

Check before opening the PR:

- `docs/` (and the Docker files) are in the staged tree, not only in the pack output.
- Every relative link in README.md and `docs/*.md` resolves inside
  `packages/page-usage-board/` — click through them in the GitHub PR preview.

## Checks before opening the PR

- `npm test` passes (auth, `Host`, traversal, lead-page, package metadata).
- `npm pack --dry-run` contains no `remote.js`, no page key, and includes `LICENSE`.
- The host part guards every route with a token **and checks `Host`** (community requirement
  for pages that navigate to a local service). Three deliberate anonymous exemptions, filed
  here for review: `GET /api/ping` and `GET /api/health` (liveness fingerprints — they return
  `{ok:true}` only, no data), and the board page itself on a loopback bind, where the token is
  injected into the served HTML rather than typed.
- The hosted page uses `window.magpie.service` when present, so a remote `magpie web`
  deployment keeps the frame under magpie's own origin and key.
- The lead page is script-free; the board itself only calls its own service on
  `127.0.0.1` (plus two deliberate exceptions: Cloudflare's injected analytics
  beacon on proxied deployments, and brand-icon favicon downloads for the
  quota wall — cosmetic only).
- `magpie.permissions` is `[]`: the page reads nothing through the bridge.