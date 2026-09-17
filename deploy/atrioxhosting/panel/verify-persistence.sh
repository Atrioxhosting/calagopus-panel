#!/bin/sh
set -eu

RUNTIME_DIR=/opt/calagopus-panel
COMPOSE_FILE=$RUNTIME_DIR/compose.yml

check_mounts() {
    docker inspect calagopus-panel-db-1 --format '{{range .Mounts}}{{.Source}}:{{.Destination}}{{println}}{{end}}' \
        | grep -Fxq '/opt/calagopus-panel/postgres:/data'
    docker inspect calagopus-panel-web-1 --format '{{range .Mounts}}{{.Source}}:{{.Destination}}{{println}}{{end}}' \
        | grep -Fxq '/opt/calagopus-panel/data:/var/lib/calagopus'
    docker inspect calagopus-panel-web-1 --format '{{range .Mounts}}{{.Source}}:{{.Destination}}{{println}}{{end}}' \
        | grep -Fxq '/opt/calagopus-panel/logs:/var/log/calagopus'
    docker inspect calagopus-panel-cache-1 --format '{{range .Mounts}}{{.Source}}:{{.Destination}}{{println}}{{end}}' \
        | grep -Fxq '/opt/calagopus-panel/cache:/data'
    docker inspect calagopus-panel-db-1 --format '{{range .Config.Env}}{{println .}}{{end}}' \
        | grep -Fxq 'PGDATA=/data'
    for container in calagopus-panel-db-1 calagopus-panel-web-1 calagopus-panel-cache-1; do
        docker inspect "$container" --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' \
            | grep -Fxq "$COMPOSE_FILE"
        docker inspect "$container" --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' \
            | grep -Fxq "$RUNTIME_DIR"
    done
}

wait_for_database() {
    attempt=0
    while [ "$attempt" -lt 30 ]; do
        health=$(docker inspect calagopus-panel-db-1 \
            --format '{{.State.Health.Status}}' 2>/dev/null || true)
        [ "$health" = healthy ] && return 0
        sleep 2
        attempt=$((attempt + 1))
    done
    return 1
}

cleanup_test_table() {
    docker exec calagopus-panel-db-1 psql -U panel -d panel \
        -c 'DROP TABLE IF EXISTS atriox_persistence_test;' >/dev/null 2>&1 || true
}
trap cleanup_test_table EXIT HUP INT TERM

check_mounts
docker exec calagopus-panel-db-1 psql -v ON_ERROR_STOP=1 -U panel -d panel \
    -c 'CREATE TABLE IF NOT EXISTS atriox_persistence_test (id integer PRIMARY KEY, marker text NOT NULL);' \
    -c "INSERT INTO atriox_persistence_test (id, marker) VALUES (1, 'persistent-ok') ON CONFLICT (id) DO UPDATE SET marker = EXCLUDED.marker;"

SYSTEM_ID=$(docker exec calagopus-panel-db-1 psql -At -U panel -d panel \
    -c 'SELECT system_identifier FROM pg_control_system();')

docker compose --project-directory "$RUNTIME_DIR" -f "$COMPOSE_FILE" \
    up -d --force-recreate
wait_for_database
test "$SYSTEM_ID" = "$(docker exec calagopus-panel-db-1 psql -At -U panel -d panel \
    -c 'SELECT system_identifier FROM pg_control_system();')"
test "$(docker exec calagopus-panel-db-1 psql -At -U panel -d panel \
    -c 'SELECT marker FROM atriox_persistence_test WHERE id = 1;')" = persistent-ok

check_mounts
docker compose --project-directory "$RUNTIME_DIR" -f "$COMPOSE_FILE" down
docker compose --project-directory "$RUNTIME_DIR" -f "$COMPOSE_FILE" up -d
wait_for_database
test "$SYSTEM_ID" = "$(docker exec calagopus-panel-db-1 psql -At -U panel -d panel \
    -c 'SELECT system_identifier FROM pg_control_system();')"
test "$(docker exec calagopus-panel-db-1 psql -At -U panel -d panel \
    -c 'SELECT marker FROM atriox_persistence_test WHERE id = 1;')" = persistent-ok

cleanup_test_table
trap - EXIT HUP INT TERM
echo "Forced recreation and compose down/up persistence checks passed."
