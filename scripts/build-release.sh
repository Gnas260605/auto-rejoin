#!/usr/bin/env bash
set -eu

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-${ROOT_DIR}/release}"
CHANNEL="${AUTO_REJOIN_UPDATE_CHANNEL:-stable}"
ARTIFACT_BASE_URL="${AUTO_REJOIN_RELEASE_BASE_URL:-}"
VERSION="$(tr -d '\r\n' < "${ROOT_DIR}/VERSION")"
mkdir -p "${ROOT_DIR}/tmp"
WORK_DIR="$(mktemp -d "${ROOT_DIR}/tmp/release-build.XXXXXX")"

cleanup() {
    case "$WORK_DIR" in
        "${ROOT_DIR}/tmp/release-build."*) rm -rf "$WORK_DIR" ;;
    esac
}
trap cleanup EXIT

mkdir -p "$OUTPUT_DIR" "${WORK_DIR}/auto-rejoin-${VERSION}"

for item in VERSION auto_rejoin.sh setup.sh bin lib keys README.md CHANGELOG.md LICENSE_ARCHITECTURE.md SERVER_ARCHITECTURE.md UPDATE_ARCHITECTURE.md RELEASE_PROCESS.md; do
    if [ -e "${ROOT_DIR}/${item}" ]; then
        cp -Rp "${ROOT_DIR}/${item}" "${WORK_DIR}/auto-rejoin-${VERSION}/${item}"
    fi
done

tar -czf "${OUTPUT_DIR}/auto-rejoin-${VERSION}.tar.gz" -C "${WORK_DIR}/auto-rejoin-${VERSION}" .
sha="$(sha256sum "${OUTPUT_DIR}/auto-rejoin-${VERSION}.tar.gz" | awk '{print $1}')"
size="$(stat -c %s "${OUTPUT_DIR}/auto-rejoin-${VERSION}.tar.gz" 2>/dev/null || wc -c < "${OUTPUT_DIR}/auto-rejoin-${VERSION}.tar.gz" | tr -d ' ')"

if [ -n "$ARTIFACT_BASE_URL" ]; then
    artifact_url="${ARTIFACT_BASE_URL%/}/auto-rejoin-${VERSION}.tar.gz"
else
    artifact_url="https://downloads.example.invalid/auto-rejoin/${VERSION}/auto-rejoin-${VERSION}.tar.gz"
fi

VERSION="$VERSION" \
CHANNEL="$CHANNEL" \
RELEASED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
ARTIFACT_URL="$artifact_url" \
ARTIFACT_SHA="$sha" \
ARTIFACT_SIZE="$size" \
MANIFEST_OUT="${OUTPUT_DIR}/release-manifest.json" \
node -e '
const fs = require("fs");
const manifest = {
  schemaVersion: 1,
  version: process.env.VERSION,
  channel: process.env.CHANNEL,
  releasedAt: process.env.RELEASED_AT,
  minimumVersion: "4.0.0",
  mandatory: false,
  artifact: {
    url: process.env.ARTIFACT_URL,
    sha256: process.env.ARTIFACT_SHA,
    size: Number(process.env.ARTIFACT_SIZE),
  },
  notesUrl: "",
};
fs.writeFileSync(process.env.MANIFEST_OUT, `${JSON.stringify(manifest, null, 2)}\n`);
'

printf 'Artifact: %s\n' "${OUTPUT_DIR}/auto-rejoin-${VERSION}.tar.gz"
printf 'Manifest: %s\n' "${OUTPUT_DIR}/release-manifest.json"
printf 'SHA256: %s\n' "$sha"
