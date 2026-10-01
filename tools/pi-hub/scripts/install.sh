#!/usr/bin/env bash
# Installs the guild hub on a Raspberry Pi. Run from the tools/pi-hub folder: sudo ./scripts/install.sh
# No ports are opened and nothing is exposed to the internet. The hub listens on the home network only.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo." >&2; exit 1; fi
command -v node >/dev/null || { echo "Node.js 22.5 or newer is required (https://nodejs.org)." >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=5)?0:1)' || { echo "Node.js 22.5 or newer is required, found $(node -v)." >&2; exit 1; }

id mam-hub >/dev/null 2>&1 || useradd --system --home /var/lib/mam-pi-hub --shell /usr/sbin/nologin mam-hub
mkdir -p /opt/mam-pi-hub/app /var/lib/mam-pi-hub/backups
cp -r package.json src public /opt/mam-pi-hub/app/
# The companion app is served to the PC so it can update itself (tools/pi-gateway sits next to tools/pi-hub).
if [ -d ../pi-gateway ]; then
  mkdir -p /opt/mam-pi-hub/companion
  cp -r ../pi-gateway/package.json ../pi-gateway/src /opt/mam-pi-hub/companion/
fi
chown -R root:root /opt/mam-pi-hub
chown -R mam-hub:mam-hub /var/lib/mam-pi-hub
chmod 700 /var/lib/mam-pi-hub

if [ ! -f /etc/mam-pi-hub.env ]; then
  printf '# PORT=8080\n# HOST=0.0.0.0\n# Leave ALLOW_PUBLIC unset: the hub only answers private networks.\n' > /etc/mam-pi-hub.env
  chmod 640 /etc/mam-pi-hub.env
fi

cp config/mam-pi-hub.service /etc/systemd/system/mam-pi-hub.service
systemctl daemon-reload
systemctl enable --now mam-pi-hub

cat <<'EOF'

Installed. Next steps (run them on the Pi):
  sudo -u mam-hub env DB_PATH=/var/lib/mam-pi-hub/pi-hub.sqlite BACKUP_DIR=/var/lib/mam-pi-hub/backups node --experimental-sqlite /opt/mam-pi-hub/app/src/cli.js add-user <your-name> admin
  sudo -u mam-hub env DB_PATH=/var/lib/mam-pi-hub/pi-hub.sqlite node --experimental-sqlite /opt/mam-pi-hub/app/src/cli.js add-source "owner pc"
Open http://<pi-address>:8080 on your home network. Do not forward this port on your router.
EOF
