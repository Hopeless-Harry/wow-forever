#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo ./scripts/update.sh" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/guild-ledger/app"

cd "${PROJECT_DIR}"
npm ci --omit=dev
npm test

rm -rf "${APP_DIR}/src" "${APP_DIR}/public" "${APP_DIR}/config" "${APP_DIR}/test" "${APP_DIR}/scripts"
cp -R src public config test scripts "${APP_DIR}/"
install -m 0644 package.json package-lock.json "${APP_DIR}/"
chown -R guild-ledger:guild-ledger "${APP_DIR}"

# Pick up service-file changes (for example new data paths) so updates and installs behave the same.
UNIT_SOURCE="${PROJECT_DIR}/config/guild-ledger.service"
UNIT_TARGET="/etc/systemd/system/guild-ledger.service"
if ! cmp -s "${UNIT_SOURCE}" "${UNIT_TARGET}"; then
  install -o root -g root -m 0644 "${UNIT_SOURCE}" "${UNIT_TARGET}"
  systemctl daemon-reload
fi

cd "${APP_DIR}"
sudo -u guild-ledger npm ci --omit=dev
systemctl restart guild-ledger
systemctl --no-pager --full status guild-ledger
