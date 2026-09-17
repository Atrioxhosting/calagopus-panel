#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/versions.env"

if [ "$(id -u)" -ne 0 ]; then
    echo "run as root" >&2
    exit 1
fi

. /etc/os-release
if [ "${ID:-}" != debian ] || [ "${VERSION_CODENAME:-}" != trixie ]; then
    echo "expected Debian 13 (trixie)" >&2
    exit 1
fi

apt-get update
apt-get install -y \
    ca-certificates \
    curl \
    "unzip=$UNZIP_VERSION" \
    "nftables=$NFTABLES_VERSION"

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg \
    -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

install -m 0644 /dev/null /etc/apt/sources.list.d/docker.sources
printf '%s\n' \
    'Types: deb' \
    'URIs: https://download.docker.com/linux/debian' \
    'Suites: trixie' \
    'Components: stable' \
    'Architectures: amd64' \
    'Signed-By: /etc/apt/keyrings/docker.asc' \
    > /etc/apt/sources.list.d/docker.sources

LITESPEED_REPO_SCRIPT=$(mktemp /tmp/litespeed-repo.XXXXXX)
cleanup() {
    rm -f -- "$LITESPEED_REPO_SCRIPT"
}
trap cleanup EXIT HUP INT TERM
curl -fsSL https://repo.litespeed.sh -o "$LITESPEED_REPO_SCRIPT"
bash "$LITESPEED_REPO_SCRIPT"

apt-get update
apt-get install -y \
    "docker-ce=$DOCKER_CE_VERSION" \
    "docker-ce-cli=$DOCKER_CE_CLI_VERSION" \
    "containerd.io=$CONTAINERD_VERSION" \
    "docker-buildx-plugin=$DOCKER_BUILDX_VERSION" \
    "docker-compose-plugin=$DOCKER_COMPOSE_VERSION" \
    "openlitespeed=$OPENLITESPEED_VERSION"

systemctl is-active --quiet docker
systemctl is-enabled --quiet docker
systemctl is-active --quiet lsws
systemctl is-enabled --quiet lsws
