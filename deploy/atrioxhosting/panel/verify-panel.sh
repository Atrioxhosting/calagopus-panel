#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/versions.env"

RUNTIME_DIR=/opt/calagopus-panel
COMPOSE_FILE=$RUNTIME_DIR/compose.yml

test "$(stat -c %a "$RUNTIME_DIR")" = 750
test "$(stat -c %a "$COMPOSE_FILE")" = 600
test "$(stat -c %a "$RUNTIME_DIR/.env")" = 600

docker compose --project-directory "$RUNTIME_DIR" -f "$COMPOSE_FILE" config --quiet
docker compose --project-directory "$RUNTIME_DIR" -f "$COMPOSE_FILE" ps
docker exec calagopus-panel-web-1 /usr/bin/panel-rs version | grep -F " $PANEL_VERSION "

for mapping in \
    'calagopus-panel-db-1:/opt/calagopus-panel/postgres:/data' \
    'calagopus-panel-web-1:/opt/calagopus-panel/data:/var/lib/calagopus' \
    'calagopus-panel-web-1:/opt/calagopus-panel/logs:/var/log/calagopus' \
    'calagopus-panel-cache-1:/opt/calagopus-panel/cache:/data'; do
    container=${mapping%%:*}
    remainder=${mapping#*:}
    source=${remainder%:*}
    destination=${remainder##*:}
    docker inspect "$container" --format '{{range .Mounts}}{{.Source}}:{{.Destination}}{{println}}{{end}}' \
        | grep -Fxq "$source:$destination"
done

docker inspect calagopus-panel-db-1 --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -Fxq 'PGDATA=/data'
docker inspect calagopus-panel-web-1 --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -Fxq 'APP_ENABLE_WINGS_PROXY=false'
docker inspect calagopus-panel-web-1 --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -Fxq 'APP_TRUSTED_PROXIES=172.30.0.1/32'

docker network inspect calagopus-panel_backend \
    --format '{{.EnableIPv6}} {{json .IPAM.Config}}' \
    | grep -Fq 'fd6d:3f4b:7e9c::/64'
docker inspect calagopus-panel-web-1 \
    --format '{{range .NetworkSettings.Networks}}{{.GlobalIPv6Address}}{{end}}' \
    | grep -Eq '^fd6d:3f4b:7e9c::'

systemctl is-enabled --quiet calagopus-nat66.service
systemctl is-active --quiet calagopus-nat66.service
nft list chain ip6 calagopus_nat66 postrouting \
    | grep -Fq 'snat to 2a0c:b641:620::6'

test -z "$(ss -H -lnt 'sport = :80')"
test -z "$(ss -H -4 -lnt 'sport = :443')"
test -n "$(ss -H -6 -lnt 'sport = :443')"
test "$(ss -H -lnt 'sport = :8000' | awk '{print $4}')" = '127.0.0.1:8000'
test "$(ss -H -lnt 'sport = :7080' | awk '{print $4}')" = '127.0.0.1:7080'

curl --noproxy '*' -6 -fsS \
    --resolve 'dev-atrioxgame-panel.atrioxhost.com:443:[2a0c:b641:620::6]' \
    -o /dev/null https://dev-atrioxgame-panel.atrioxhost.com/

echo "Panel infrastructure verification passed."
