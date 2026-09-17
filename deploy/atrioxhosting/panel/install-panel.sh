#!/bin/sh
set -eu

EXPECTED_HOSTNAME=dev-panel.atrioxhost.com
EXPECTED_IPV4=82.153.147.6/32
EXPECTED_IPV6=2a0c:b641:620::6/64
RUNTIME_DIR=/opt/calagopus-panel
TLS_ZIP=/root/workspace/SSL.zip
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/versions.env"

if [ "$(id -u)" -ne 0 ]; then
    echo "run as root" >&2
    exit 1
fi

if [ "$(hostname)" != "$EXPECTED_HOSTNAME" ]; then
    echo "unexpected hostname" >&2
    exit 1
fi
ip -o -4 address show dev ens18 | grep -Fq " $EXPECTED_IPV4 "
ip -o -6 address show dev ens18 | grep -Fq " $EXPECTED_IPV6 "

if [ -e "$RUNTIME_DIR" ]; then
    echo "$RUNTIME_DIR already exists; refusing to overwrite it" >&2
    exit 1
fi

for command in docker unzip openssl nft systemctl install; do
    command -v "$command" >/dev/null
done
test -f "$TLS_ZIP"

DEPLOY_TMP=$(mktemp -d /tmp/calagopus-panel-deploy.XXXXXX)
cleanup() {
    rm -f -- "$DEPLOY_TMP/fullchain.pem" "$DEPLOY_TMP/private-key.pem"
    rmdir "$DEPLOY_TMP" 2>/dev/null || true
}
trap cleanup EXIT HUP INT TERM

unzip -p "$TLS_ZIP" fullchain.pem > "$DEPLOY_TMP/fullchain.pem"
unzip -p "$TLS_ZIP" private-key.pem > "$DEPLOY_TMP/private-key.pem"
chmod 0600 "$DEPLOY_TMP/private-key.pem"

CERT_HASH=$(openssl x509 -in "$DEPLOY_TMP/fullchain.pem" -pubkey -noout \
    | openssl pkey -pubin -outform DER | sha256sum | cut -d' ' -f1)
KEY_HASH=$(openssl pkey -in "$DEPLOY_TMP/private-key.pem" -pubout -outform DER \
    | sha256sum | cut -d' ' -f1)
if [ "$CERT_HASH" != "$KEY_HASH" ]; then
    echo "TLS certificate and private key do not match" >&2
    exit 1
fi

install -d -m 0750 "$RUNTIME_DIR"
install -d -m 0750 \
    "$RUNTIME_DIR/postgres" \
    "$RUNTIME_DIR/data" \
    "$RUNTIME_DIR/logs" \
    "$RUNTIME_DIR/cache"
install -m 0600 "$SCRIPT_DIR/compose.yml" "$RUNTIME_DIR/compose.yml"

umask 077
APP_ENCRYPTION_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 32)
WEBADMIN_PASSWORD=$(openssl rand -hex 32)
printf 'APP_ENCRYPTION_KEY=%s\nPOSTGRES_PASSWORD=%s\nWEBADMIN_PASSWORD=%s\n' \
    "$APP_ENCRYPTION_KEY" "$POSTGRES_PASSWORD" "$WEBADMIN_PASSWORD" \
    > "$RUNTIME_DIR/.env"
chmod 0600 "$RUNTIME_DIR/.env"
unset APP_ENCRYPTION_KEY POSTGRES_PASSWORD

docker compose --project-directory "$RUNTIME_DIR" \
    -f "$RUNTIME_DIR/compose.yml" config --quiet
docker compose --project-directory "$RUNTIME_DIR" \
    -f "$RUNTIME_DIR/compose.yml" pull
docker image inspect ghcr.io/calagopus/panel:latest --format '{{json .RepoDigests}}' \
    | grep -Fq "$PANEL_DIGEST"
docker image inspect ghcr.io/calagopus/pgautoupgrade:18-alpine --format '{{json .RepoDigests}}' \
    | grep -Fq "$POSTGRES_DIGEST"
docker image inspect ghcr.io/calagopus/valkey:latest --format '{{json .RepoDigests}}' \
    | grep -Fq "$VALKEY_DIGEST"
docker compose --project-directory "$RUNTIME_DIR" \
    -f "$RUNTIME_DIR/compose.yml" up -d

PANEL_VERSION_OUTPUT=$(docker exec calagopus-panel-web-1 /usr/bin/panel-rs version)
printf '%s\n' "$PANEL_VERSION_OUTPUT" | grep -Fq " $PANEL_VERSION "

CERT_DIR=/usr/local/lsws/conf/cert/dev-atrioxgame-panel.atrioxhost.com
install -d -m 0750 "$CERT_DIR"
install -m 0644 "$DEPLOY_TMP/fullchain.pem" "$CERT_DIR/fullchain.pem"
install -m 0600 "$DEPLOY_TMP/private-key.pem" "$CERT_DIR/private-key.pem"

install -d -m 0750 /usr/local/lsws/conf/vhosts/calagopus-panel
install -m 0640 -o lsadm -g nogroup \
    "$SCRIPT_DIR/openlitespeed/httpd_config.conf" \
    /usr/local/lsws/conf/httpd_config.conf
install -m 0640 -o lsadm -g nogroup \
    "$SCRIPT_DIR/openlitespeed/vhconf.conf" \
    /usr/local/lsws/conf/vhosts/calagopus-panel/vhconf.conf
install -m 0640 -o lsadm -g nogroup \
    "$SCRIPT_DIR/openlitespeed/admin_config.conf" \
    /usr/local/lsws/admin/conf/admin_config.conf

WEBADMIN_HASH=$(/usr/local/lsws/admin/fcgi-bin/admin_php \
    -c /usr/local/lsws/admin/conf/php.ini \
    -q /usr/local/lsws/admin/misc/htpasswd.php "$WEBADMIN_PASSWORD")
if ! /usr/local/lsws/admin/fcgi-bin/admin_php \
    -c /usr/local/lsws/admin/conf/php.ini \
    -q "$SCRIPT_DIR/openlitespeed/verify-password.php" \
    "$WEBADMIN_PASSWORD" "$WEBADMIN_HASH"; then
    echo "generated OpenLiteSpeed WebAdmin password hash failed verification" >&2
    exit 1
fi
printf 'admin:%s\n' "$WEBADMIN_HASH" > /usr/local/lsws/admin/conf/htpasswd
chmod 0600 /usr/local/lsws/admin/conf/htpasswd
unset WEBADMIN_PASSWORD WEBADMIN_HASH

install -d -m 0755 /etc/nftables.d
install -m 0644 "$SCRIPT_DIR/nat66/calagopus-nat66.nft" \
    /etc/nftables.d/calagopus-nat66.nft
install -m 0755 "$SCRIPT_DIR/nat66/calagopus-nat66-load" \
    /usr/local/sbin/calagopus-nat66-load
install -m 0644 "$SCRIPT_DIR/systemd/calagopus-nat66.service" \
    /etc/systemd/system/calagopus-nat66.service
systemctl daemon-reload
systemctl enable --now calagopus-nat66.service

/usr/local/lsws/bin/lswsctrl stop || true
attempt=0
while pgrep -x openlitespeed >/dev/null && [ "$attempt" -lt 15 ]; do
    sleep 1
    attempt=$((attempt + 1))
done
if pgrep -x openlitespeed >/dev/null; then
    echo "OpenLiteSpeed did not stop cleanly; resolve before starting it" >&2
    exit 1
fi
rm -f /tmp/lshttpd/lshttpd.pid /tmp/lshttpd/graceful.pid \
    /run/openlitespeed.pid /usr/local/lsws/admin/tmp/.restart
/usr/local/lsws/bin/lswsctrl start

echo "Panel host deployment installed. Runtime secrets are in $RUNTIME_DIR/.env."
echo "Run verify-panel.sh and verify-persistence.sh before presenting OOBE."
