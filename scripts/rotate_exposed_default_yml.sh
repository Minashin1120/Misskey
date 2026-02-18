#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-/home/misskey/misskey}"
CONFIG_PATH="${REPO_DIR}/.config/default.yml"
TS="$(date +%F-%H%M%S)"
BACKUP_PATH="${CONFIG_PATH}.bak.${TS}"

if [[ ${EUID} -ne 0 ]]; then
  echo "[ERROR] run this script as root so it can update PostgreSQL credentials." >&2
  exit 1
fi

if [[ ! -f "${CONFIG_PATH}" ]]; then
  echo "[ERROR] config not found: ${CONFIG_PATH}" >&2
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "[ERROR] openssl command not found" >&2
  exit 1
fi

DB_PASS="$(openssl rand -base64 48 | tr -d "\n")"
SETUP_PASS="$(openssl rand -base64 48 | tr -dc "A-Za-z0-9" | head -c 32)"
DB_PASS_ESCAPED="$(printf '%s' "${DB_PASS}" | sed -e 's/[\\&|]/\\&/g')"
SETUP_PASS_ESCAPED="$(printf '%s' "${SETUP_PASS}" | sed -e 's/[\\&|]/\\&/g')"

sudo -u misskey -H bash -lc "cp -a '${CONFIG_PATH}' '${BACKUP_PATH}'"

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE misskey WITH PASSWORD '${DB_PASS}';"

sudo -u misskey -H bash -lc "sed -i -E -e 's|^  pass: .*|  pass: ${DB_PASS_ESCAPED}|' -e 's|^setupPassword: .*|setupPassword: ${SETUP_PASS_ESCAPED}|' '${CONFIG_PATH}'"

printf '%s\n' "${DB_PASS}" > /root/misskey_db_password.txt
printf '%s\n' "${SETUP_PASS}" > /root/misskey_setup_password.txt
chmod 600 /root/misskey_db_password.txt /root/misskey_setup_password.txt

cat <<MSG
[DONE] Rotated secrets.
- backup: ${BACKUP_PATH}
- updated: ${CONFIG_PATH}
- updated postgres role: misskey
- updated files: /root/misskey_db_password.txt, /root/misskey_setup_password.txt
MSG
