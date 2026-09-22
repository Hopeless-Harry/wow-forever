#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo ./scripts/setup.sh" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/guild-ledger/app"
DATA_DIR="/var/lib/guild-ledger"
ENV_FILE="/etc/guild-ledger.env"

node_major="$(node --version 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)"
if [[ -z "${node_major}" || "${node_major}" -lt 20 ]]; then
  echo "Node.js 20 or newer is required before running setup." >&2
  exit 1
fi

if ! id guild-ledger >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/guild-ledger --shell /usr/sbin/nologin guild-ledger
fi

install -d -o guild-ledger -g guild-ledger -m 0750 "${APP_DIR}" "${DATA_DIR}"
rm -rf "${APP_DIR}/src" "${APP_DIR}/public" "${APP_DIR}/config" "${APP_DIR}/test"
cp -R "${PROJECT_DIR}/src" "${PROJECT_DIR}/public" "${PROJECT_DIR}/config" "${PROJECT_DIR}/test" "${APP_DIR}/"
install -m 0644 "${PROJECT_DIR}/package.json" "${PROJECT_DIR}/package-lock.json" "${APP_DIR}/"
chown -R guild-ledger:guild-ledger /opt/guild-ledger "${DATA_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  install -o root -g guild-ledger -m 0640 "${PROJECT_DIR}/.env.example" "${ENV_FILE}"
  echo "Created ${ENV_FILE}. Add the Google Sheet and service-account values there."
fi

cd "${APP_DIR}"
sudo -u guild-ledger npm ci --omit=dev
install -o root -g root -m 0644 "${PROJECT_DIR}/config/guild-ledger.service" /etc/systemd/system/guild-ledger.service
systemctl daemon-reload
systemctl enable --now guild-ledger

echo "Guild Ledger installed. Check it with: curl http://127.0.0.1:3000/health/ready"
