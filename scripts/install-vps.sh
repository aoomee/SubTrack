#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${SUBTRACK_INSTALL_DIR:-/opt/subtrack}"
HOST_PORT="${SUBTRACK_HOST_PORT:-3001}"
IMAGE_REF="${SUBTRACK_IMAGE:-ghcr.io/aoomee/subtrack:latest}"
CONTAINER_NAME="${SUBTRACK_CONTAINER_NAME:-subtrack}"
DATA_VOLUME="${SUBTRACK_DATA_VOLUME:-}"
ENV_FILE="${APP_DIR}/.env"
COMPOSE_FILE="${APP_DIR}/docker-compose.yml"
generated_password=""
login_password=""

die() {
  echo "[ERROR] $*" >&2
  exit 1
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n'
  else
    head -c 48 /dev/urandom | base64 | tr -d '\n'
  fi
}

generate_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 12
  else
    head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24
  fi
}

quote_env_value() {
  local value="$1"
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/}
  printf '"%s"' "$value"
}

[[ "${EUID}" -eq 0 ]] || die "请使用 root 执行，例如：curl -fsSL https://raw.githubusercontent.com/aoomee/SubTrack/main/scripts/install-vps.sh | sudo bash"

if ! command -v docker >/dev/null 2>&1; then
  echo "[INFO] 未检测到 Docker，开始安装 Docker..."
  command -v curl >/dev/null 2>&1 || die "系统缺少 curl，无法安装 Docker。"
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || die "未检测到 Docker Compose 插件，请先安装 docker compose plugin。"

[[ "$HOST_PORT" =~ ^[0-9]+$ ]] || die "SUBTRACK_HOST_PORT 必须是数字。"
(( HOST_PORT >= 1 && HOST_PORT <= 65535 )) || die "SUBTRACK_HOST_PORT 必须在 1-65535 范围内。"

install -d -m 700 "$APP_DIR"

if [[ -z "$DATA_VOLUME" ]]; then
  if docker volume inspect subtrack-data >/dev/null 2>&1; then
    DATA_VOLUME="subtrack-data"
  elif docker volume inspect subscription-data >/dev/null 2>&1; then
    DATA_VOLUME="subscription-data"
  else
    DATA_VOLUME="subtrack-data"
  fi
fi

for old_container in subtrack subscription-manager; do
  if [[ "$old_container" == "$CONTAINER_NAME" ]]; then
    continue
  fi
  if docker container inspect "$old_container" >/dev/null 2>&1; then
    old_image="$(docker inspect --format '{{.Config.Image}}' "$old_container" 2>/dev/null || true)"
    if [[ "$old_image" == *subtrack* || "$old_image" == *subscription* ]]; then
      echo "[INFO] 替换旧的 SubTrack 容器：$old_container（数据卷不会删除）"
      docker rm -f "$old_container" >/dev/null
    fi
  fi
done

if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  current_image="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)"
  [[ "$current_image" == *subtrack* || "$current_image" == *subscription* ]] \
    || die "容器名 $CONTAINER_NAME 已被其他镜像占用，请设置 SUBTRACK_CONTAINER_NAME。"
  echo "[INFO] 替换现有容器：$CONTAINER_NAME（数据卷不会删除）"
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

if [[ -f "$ENV_FILE" ]]; then
  grep -Eq '^SESSION_SECRET=[^[:space:]]+' "$ENV_FILE" \
    || die "$ENV_FILE 缺少 SESSION_SECRET，请补充后重新执行。"
  grep -Eq '^ADMIN_PASSWORD(_HASH)?=[^[:space:]]+' "$ENV_FILE" \
    || die "$ENV_FILE 缺少 ADMIN_PASSWORD 或 ADMIN_PASSWORD_HASH，请补充后重新执行。"
  echo "[INFO] 已保留现有 .env 配置和登录信息。"
else
  admin_password=""
  if [[ -r /dev/tty ]]; then
    read -r -s -p "请输入 SubTrack 管理员密码（留空则自动生成）: " admin_password </dev/tty || true
    echo
  fi

  if [[ -z "$admin_password" ]]; then
    generated_password="$(generate_password)"
    admin_password="$generated_password"
  fi

  login_password="$admin_password"

  session_secret="$(generate_secret)"
  {
    printf 'SESSION_SECRET=%s\n' "$session_secret"
    printf 'ADMIN_USERNAME=admin\n'
    printf 'ADMIN_PASSWORD=%s\n' "$(quote_env_value "$admin_password")"
    printf 'BASE_CURRENCY=CNY\n'
    printf 'SCHEDULER_TIMEZONE=Asia/Shanghai\n'
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "[INFO] 已生成新的 .env 配置。"
fi

cat > "$COMPOSE_FILE" <<EOF
version: '3.8'

services:
  subscription-manager:
    image: ${IMAGE_REF}
    pull_policy: always
    container_name: ${CONTAINER_NAME}
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: "3001"
      DATABASE_PATH: /app/data/database.sqlite
    ports:
      - "0.0.0.0:${HOST_PORT}:3001"
    volumes:
      - subtrack-data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "const http=require('http');const req=http.request({hostname:'localhost',port:3001,path:'/api/health',timeout:2000},res=>process.exit(res.statusCode===200||res.statusCode===401?0:1));req.on('error',()=>process.exit(1));req.end();"]
      interval: 30s
      timeout: 3s
      start_period: 15s
      retries: 3

volumes:
  subtrack-data:
    name: ${DATA_VOLUME}
    driver: local
EOF

chmod 600 "$COMPOSE_FILE"
cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" config >/dev/null
docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

healthy=0
attempt=0
while (( attempt < 30 )); do
  health="$(docker inspect --format '{{.State.Health.Status}}' subscription-manager 2>/dev/null || true)"
  if [[ "$health" == "healthy" ]]; then
    healthy=1
    break
  fi
  ((attempt += 1))
  sleep 1
done

docker compose -f "$COMPOSE_FILE" ps

if (( healthy == 1 )); then
  echo "[OK] SubTrack 已启动并通过容器健康检查。"
else
  echo "[WARN] 容器已启动，但健康检查仍在等待，请查看日志："
  echo "      docker compose -f $COMPOSE_FILE logs --tail=100"
fi

echo
echo "访问地址：http://你的VPS公网IP:${HOST_PORT}"
echo "如果无法访问，请在云厂商安全组和 VPS 防火墙放行 TCP ${HOST_PORT}。"
echo "数据卷：${DATA_VOLUME}（不要删除）"

if [[ -n "$login_password" ]]; then
  echo
  echo "首次登录账号：admin"
  echo "首次登录密码：${login_password}"
  echo "请立即保存此密码。"
else
  echo
  echo "账号信息沿用已有 /opt/subtrack/.env，脚本没有覆盖原密码。"
fi
