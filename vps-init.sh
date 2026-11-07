#!/bin/bash
# VPS 独立看板（可选）：只用于在另一台机器上单独查看。
# 本机看板的远端归因直接读远端 magpie 的 usage API，不再依赖这个服务。
# 首次装机：解包、写 systemd 单元、启动。
# 归档需先在检出目录生成：git archive HEAD -o /tmp/dashboard.tgz（或 npm pack 取包内文件）。
#
# 必填环境变量：
#   PAGE_KEY        页面访问口令（32 位 hex 或任意长随机串）；不设就退出，绝不内置默认值
# 可选：
#   ALLOWED_HOSTS   反代域名，逗号分隔（HOST=0.0.0.0 时必填，否则 Host 校验会拒绝公网域名）
#   PORT            端口，默认 3455
#   INSTALL_DIR     安装目录，默认 /opt/magpie-usage
#   TARBALL         待解包归档，默认 /tmp/dashboard.tgz；必须先自行生成，脚本会校验存在
#   MAGPIE_CONF_DIR magpie 配置目录，默认 /opt/stacks/magpie/config/magpie
#   GATEWAY         上游网关，默认 http://127.0.0.1:3425
#   BUN             bun 可执行文件，默认 /root/.bun/bin/bun
set -e
INSTALL_DIR="${INSTALL_DIR:-/opt/magpie-usage}"
TARBALL="${TARBALL:-/tmp/dashboard.tgz}"
PORT="${PORT:-3455}"
MAGPIE_CONF_DIR="${MAGPIE_CONF_DIR:-/opt/stacks/magpie/config/magpie}"
GATEWAY="${GATEWAY:-http://127.0.0.1:3425}"
BUN="${BUN:-/root/.bun/bin/bun}"
: "${PAGE_KEY:?PAGE_KEY must be set (the dashboard page key)}"
[ -n "${ALLOWED_HOSTS:-}" ] || echo "warning: ALLOWED_HOSTS is empty — a reverse proxy's Host name will get 403" >&2

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
if [ ! -f "$TARBALL" ]; then
  echo "error: $TARBALL not found. Build it first, from a checkout of this repository:" >&2
  echo "  git archive HEAD -o $TARBALL" >&2
  echo "(or take the file from an npm pack tarball)" >&2
  exit 1
fi
tar xzf "$TARBALL"
chmod 644 static/*
chmod 755 "$INSTALL_DIR"

# 读 cloud caller key 作为上游 key
UPKEY=$(CALLER_KEYS="$MAGPIE_CONF_DIR/caller-keys.json" python3 - <<'PY'
import json, os
d = json.load(open(os.environ['CALLER_KEYS']))
print([k['secret'] for k in d if k['name'] == 'cloud'][0])
PY
) || UPKEY=$(grep -o '"secret": *"[^"]*"' "$MAGPIE_CONF_DIR/caller-keys.json" | head -1)

# systemd 服务
cat > /etc/systemd/system/magpie-usage.service <<UNIT
[Unit]
Description=magpie usage dashboard
After=network.target docker.service

[Service]
ExecStart=$BUN $INSTALL_DIR/server.mjs
Environment=PORT=$PORT
Environment=HOST=0.0.0.0
Environment=GATEWAY=$GATEWAY
Environment=MAGPIE_KEY=$UPKEY
Environment=USAGE_JSONL=$MAGPIE_CONF_DIR/usage.jsonl
Environment=ALLOWED_HOSTS=${ALLOWED_HOSTS:-}
Environment=DATA_DIR=$INSTALL_DIR/data
Environment=PAGE_KEY=$PAGE_KEY
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now magpie-usage
sleep 2
systemctl is-active magpie-usage
curl -s -m 5 "http://127.0.0.1:$PORT/api/health"