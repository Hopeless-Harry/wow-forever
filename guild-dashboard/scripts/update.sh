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

cd "${APP_DIR}"
sudo -u guild-ledger npm ci --omit=dev
systemctl restart guild-ledger
systemctl --no-pager --full status guild-ledger
