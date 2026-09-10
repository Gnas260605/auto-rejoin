#!/usr/bin/env bash
set -eu

if [ "$#" -ne 2 ]; then
    printf 'Usage: scripts/sign-release.sh release-manifest.json /secure/path/update-private.pem\n' >&2
    exit 2
fi

MANIFEST="$1"
PRIVATE_KEY="$2"
SIGNATURE="${MANIFEST}.sig"

[ -f "$MANIFEST" ] || { printf 'Error: manifest not found: %s\n' "$MANIFEST" >&2; exit 1; }
[ -f "$PRIVATE_KEY" ] || { printf 'Error: private key not found: %s\n' "$PRIVATE_KEY" >&2; exit 1; }

case "$PRIVATE_KEY" in
    */keys/private/*|*/release/private/*|*.private.pem) ;;
    *)
        printf 'Warning: private key path does not match the recommended ignored private-key locations.\n' >&2
        ;;
esac

openssl pkeyutl -sign -rawin -inkey "$PRIVATE_KEY" -in "$MANIFEST" -out "$SIGNATURE"
printf 'Signature: %s\n' "$SIGNATURE"
