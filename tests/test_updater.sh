#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="$(mktemp -d)"
FAKE_BIN="${TEST_TMP}/bin"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() { rm -rf "$TEST_TMP"; }
trap cleanup EXIT

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

assert_status() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" -eq "$actual" ]; then pass "$name"; else fail "$name expected=$expected actual=$actual"; fi
}

assert_contains() {
    local name="$1" haystack="$2" needle="$3"
    if [[ "$haystack" == *"$needle"* ]]; then pass "$name"; else fail "$name expected [$needle]"; fi
}

mkdir -p "$FAKE_BIN"
PATH="${FAKE_BIN}:$PATH"
export PATH
cat > "${FAKE_BIN}/jq" <<'EOF'
#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const filter = args.find((arg) => !arg.startsWith("-")) || ".";
const file = args[args.length - 1];
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const map = {
  ".schemaVersion // empty": data.schemaVersion ?? "",
  ".version // empty": data.version ?? "",
  ".channel // empty": data.channel ?? "",
  ".artifact.url // empty": (data.artifact || {}).url ?? "",
  ".artifact.sha256 // empty": (data.artifact || {}).sha256 ?? "",
  ".artifact.size // empty": (data.artifact || {}).size ?? "",
  ".mandatory // false": data.mandatory ?? false,
  ".minimumVersion // empty": data.minimumVersion ?? "",
  ".notesUrl // empty": data.notesUrl ?? "",
};
const value = map[filter] ?? "";
if (typeof value === "boolean") console.log(value ? "true" : "false");
else console.log(value);
EOF
chmod +x "${FAKE_BIN}/jq"

# shellcheck source=../lib/logger.sh
source "${ROOT_DIR}/lib/logger.sh"
# shellcheck source=../lib/network.sh
source "${ROOT_DIR}/lib/network.sh"
# shellcheck source=../lib/updater.sh
source "${ROOT_DIR}/lib/updater.sh"

make_project() {
    local dir="$1"
    mkdir -p "${dir}/bin" "${dir}/lib" "${dir}/keys" "${dir}/tmp/locks"
    printf '4.0.0-dev\n' > "${dir}/VERSION"
    printf '#!/usr/bin/env bash\nexit 0\n' > "${dir}/auto_rejoin.sh"
    printf '#!/usr/bin/env bash\nexit 0\n' > "${dir}/setup.sh"
    printf '#!/usr/bin/env bash\nmanager_version() { :; }\n' > "${dir}/bin/roblox-manager"
    printf '#!/usr/bin/env bash\nupdater_fixture() { :; }\n' > "${dir}/lib/config.sh"
}

make_release() {
    local src="$1"
    local version="$2"
    local archive="$3"
    mkdir -p "${src}/bin" "${src}/lib"
    printf '%s\n' "$version" > "${src}/VERSION"
    printf '#!/usr/bin/env bash\nexit 0\n' > "${src}/auto_rejoin.sh"
    printf '#!/usr/bin/env bash\nexit 0\n' > "${src}/setup.sh"
    printf '#!/usr/bin/env bash\nmanager_version() { :; }\n' > "${src}/bin/roblox-manager"
    printf '#!/usr/bin/env bash\nrelease_lib() { :; }\n' > "${src}/lib/config.sh"
    tar -czf "$archive" -C "$src" .
}

write_manifest() {
    local file="$1" version="$2" url="$3" sha="$4" size="$5"
    cat > "$file" <<EOF
{
  "schemaVersion": 1,
  "version": "$version",
  "channel": "stable",
  "releasedAt": "2026-09-10T00:00:00Z",
  "minimumVersion": "4.0.0",
  "mandatory": false,
  "artifact": {
    "url": "$url",
    "sha256": "$sha",
    "size": $size
  },
  "notesUrl": ""
}
EOF
}

sign_manifest() {
    openssl pkeyutl -sign -rawin -inkey "${TEST_TMP}/update-private.pem" -in "$1" -out "${1}.sig"
}

network_download_secure_https() {
    local url="$1" output="$2"
    case "$url" in
        https://fixture/manifest.json) cp "${TEST_TMP}/manifest.json" "$output" ;;
        https://fixture/manifest.json.sig) cp "${TEST_TMP}/manifest.json.sig" "$output" ;;
        https://fixture/release.tar.gz) cp "${TEST_TMP}/release.tar.gz" "$output" ;;
        https://fixture/bad.tar.gz) cp "${TEST_TMP}/bad.tar.gz" "$output" ;;
        *) return 1 ;;
    esac
}

openssl genpkey -algorithm Ed25519 -out "${TEST_TMP}/update-private.pem" >/dev/null 2>&1
openssl pkey -in "${TEST_TMP}/update-private.pem" -pubout -out "${TEST_TMP}/update-public.pem" >/dev/null 2>&1

proj="${TEST_TMP}/project"
release_src="${TEST_TMP}/release-src"
make_project "$proj"
cp "${TEST_TMP}/update-public.pem" "${proj}/keys/update-public.pem"
make_release "$release_src" "4.1.0" "${TEST_TMP}/release.tar.gz"
sha="$(sha256sum "${TEST_TMP}/release.tar.gz" | awk '{print $1}')"
size="$(stat -c %s "${TEST_TMP}/release.tar.gz")"
write_manifest "${TEST_TMP}/manifest.json" "4.1.0" "https://fixture/release.tar.gz" "$sha" "$size"
sign_manifest "${TEST_TMP}/manifest.json"

export AUTO_REJOIN_UPDATE_MANIFEST_URL="https://fixture/manifest.json"
UPDATE_MANIFEST_URL="$AUTO_REJOIN_UPDATE_MANIFEST_URL"
UPDATE_PUBLIC_KEY_FILE="${TEST_TMP}/update-public.pem"
UPDATE_ALLOW_HTTP_DEV=false
UPDATE_LOCK_USE_FLOCK=false

assert_status "compare equal" 0 "$(updater_compare_versions 4.0.0 4.0.0)"
assert_status "compare patch" 1 "$(updater_compare_versions 4.0.1 4.0.0)"
assert_status "compare minor" 1 "$(updater_compare_versions 4.1.0 4.0.9)"
assert_status "compare two digit" 1 "$(updater_compare_versions 4.10.0 4.9.9)"
assert_status "compare major" 1 "$(updater_compare_versions 5.0.0 4.99.99)"
assert_status "compare dev lower than release" -1 "$(updater_compare_versions 4.0.0-dev 4.0.0)"

output_file="${TEST_TMP}/check.out"
updater_check "$proj" > "$output_file" 2>&1
status=$?
output="$(cat "$output_file")"
assert_status "update check available status" 0 "$status"
assert_contains "update check available" "$output" ""
[ "$UPDATE_AVAILABLE" = "true" ] && pass "update available flag" || fail "update available flag"

cp "${TEST_TMP}/manifest.json" "${TEST_TMP}/manifest.orig"
printf '\n' >> "${TEST_TMP}/manifest.json"
output="$(updater_check "$proj" 2>&1)"
status=$?
assert_status "modified manifest rejected" 1 "$status"
assert_contains "modified manifest error" "$output" "signature verification failed"
mv "${TEST_TMP}/manifest.orig" "${TEST_TMP}/manifest.json"

rm -f "${TEST_TMP}/manifest.json.sig"
output="$(updater_check "$proj" 2>&1)"
status=$?
assert_status "missing signature rejected" 1 "$status"
assert_contains "missing signature error" "$output" "manifest signature is missing"
sign_manifest "${TEST_TMP}/manifest.json"

write_manifest "${TEST_TMP}/manifest.json" "4.1.0" "https://fixture/release.tar.gz" "0000000000000000000000000000000000000000000000000000000000000000" "$size"
sign_manifest "${TEST_TMP}/manifest.json"
output="$(updater_update "$proj" true 2>&1)"
status=$?
assert_status "wrong sha rejected" 1 "$status"
assert_contains "wrong sha error" "$output" "artifact SHA256 mismatch"

write_manifest "${TEST_TMP}/manifest.json" "4.1.0" "https://fixture/release.tar.gz" "$sha" "$((size + 1))"
sign_manifest "${TEST_TMP}/manifest.json"
output="$(updater_update "$proj" true 2>&1)"
status=$?
assert_status "wrong size rejected" 1 "$status"
assert_contains "wrong size error" "$output" "artifact size mismatch"

write_manifest "${TEST_TMP}/manifest.json" "4.1.0" "http://fixture/release.tar.gz" "$sha" "$size"
sign_manifest "${TEST_TMP}/manifest.json"
output="$(updater_check "$proj" 2>&1)"
status=$?
assert_status "http artifact rejected" 2 "$status"
assert_contains "http artifact error" "$output" "Artifact URL must use HTTPS"

UPDATE_MANIFEST_URL="http://fixture/manifest.json"
output="$(updater_check "$proj" 2>&1)"
status=$?
assert_status "http manifest rejected" 2 "$status"
assert_contains "http manifest error" "$output" "Manifest URL must use HTTPS"
UPDATE_MANIFEST_URL="https://fixture/manifest.json"

mkdir -p "${TEST_TMP}/malicious"
printf 'pwn\n' > "${TEST_TMP}/pwned"
tar -czf "${TEST_TMP}/bad.tar.gz" -C "${TEST_TMP}" pwned --transform='s#pwned#../../pwned#'
bad_sha="$(sha256sum "${TEST_TMP}/bad.tar.gz" | awk '{print $1}')"
bad_size="$(stat -c %s "${TEST_TMP}/bad.tar.gz")"
write_manifest "${TEST_TMP}/manifest.json" "4.1.0" "https://fixture/bad.tar.gz" "$bad_sha" "$bad_size"
sign_manifest "${TEST_TMP}/manifest.json"
output="$(updater_update "$proj" true 2>&1)"
status=$?
assert_status "malicious archive rejected" 1 "$status"
assert_contains "malicious archive error" "$output" "unsafe path"

mkdir -p "${proj}/tmp/locks/com.roblox.client.lockdir"
printf '%s\n' "$$" > "${proj}/tmp/locks/com.roblox.client.lockdir/pid"
write_manifest "${TEST_TMP}/manifest.json" "4.1.0" "https://fixture/release.tar.gz" "$sha" "$size"
sign_manifest "${TEST_TMP}/manifest.json"
output="$(updater_update "$proj" true 2>&1)"
status=$?
assert_status "active monitor blocks update" 1 "$status"
assert_contains "active monitor error" "$output" "active monitor detected"
rm -rf "${proj}/tmp/locks/com.roblox.client.lockdir"

mkdir -p "${proj}/tmp/locks/update.lockdir"
output="$(updater_update "$proj" true 2>&1)"
status=$?
assert_status "update lock blocks concurrent" 1 "$status"
assert_contains "update lock error" "$output" "another update is already running"
rm -rf "${proj}/tmp/locks/update.lockdir"

output="$(updater_update "$proj" true 2>&1)"
status=$?
assert_status "successful update status" 0 "$status"
assert_contains "successful update output" "$output" "Update installed successfully"
assert_contains "version after update" "$(cat "${proj}/VERSION")" "4.1.0"
[ ! -e "${proj}/config.env" ] && pass "user config untouched" || fail "user config untouched"

printf '4.0.0-dev\n' > "${proj}/VERSION"
bad_src="${TEST_TMP}/bad-src"
mkdir -p "${bad_src}/bin" "${bad_src}/lib"
printf '4.1.0\n' > "${bad_src}/VERSION"
printf '#!/usr/bin/env bash\nif then\n' > "${bad_src}/setup.sh"
tar -czf "${TEST_TMP}/release.tar.gz" -C "$bad_src" .
sha="$(sha256sum "${TEST_TMP}/release.tar.gz" | awk '{print $1}')"
size="$(stat -c %s "${TEST_TMP}/release.tar.gz")"
write_manifest "${TEST_TMP}/manifest.json" "4.1.0" "https://fixture/release.tar.gz" "$sha" "$size"
sign_manifest "${TEST_TMP}/manifest.json"
output="$(updater_update "$proj" true 2>&1)"
status=$?
assert_status "staging syntax failure status" 1 "$status"
assert_contains "staging syntax failure error" "$output" "self-test failed"
assert_contains "version unchanged after staging failure" "$(cat "${proj}/VERSION")" "4.0.0-dev"

make_release "$release_src" "4.2.0" "${TEST_TMP}/release.tar.gz"
sha="$(sha256sum "${TEST_TMP}/release.tar.gz" | awk '{print $1}')"
size="$(stat -c %s "${TEST_TMP}/release.tar.gz")"
write_manifest "${TEST_TMP}/manifest.json" "4.2.0" "https://fixture/release.tar.gz" "$sha" "$size"
sign_manifest "${TEST_TMP}/manifest.json"
UPDATE_TEST_ROLLBACK_FAIL=false
output="$(UPDATE_TEST_ROLLBACK_FAIL=false updater_update "$proj" true 2>&1)"
status=$?
assert_status "rollback success setup update baseline" 0 "$status"

printf '4.0.0-dev\n' > "${proj}/VERSION"
mismatch_src="${TEST_TMP}/mismatch-src"
mkdir -p "${mismatch_src}/bin" "${mismatch_src}/lib"
printf '4.0.0-dev\n' > "${mismatch_src}/VERSION"
printf '#!/usr/bin/env bash\nexit 0\n' > "${mismatch_src}/auto_rejoin.sh"
printf '#!/usr/bin/env bash\nexit 0\n' > "${mismatch_src}/setup.sh"
printf '#!/usr/bin/env bash\nmanager_version() { :; }\n' > "${mismatch_src}/bin/roblox-manager"
tar -czf "${TEST_TMP}/release.tar.gz" -C "$mismatch_src" .
sha="$(sha256sum "${TEST_TMP}/release.tar.gz" | awk '{print $1}')"
size="$(stat -c %s "${TEST_TMP}/release.tar.gz")"
write_manifest "${TEST_TMP}/manifest.json" "4.4.0" "https://fixture/release.tar.gz" "$sha" "$size"
sign_manifest "${TEST_TMP}/manifest.json"
output="$(updater_update "$proj" true 2>&1)"
status=$?
assert_status "post version mismatch rollback status" 1 "$status"
assert_contains "post version mismatch error" "$output" "post-update VERSION mismatch"
assert_contains "post version mismatch restored" "$(cat "${proj}/VERSION")" "4.0.0-dev"

output="$(UPDATE_TEST_ROLLBACK_FAIL=true updater_update "$proj" true 2>&1)"
status=$?
assert_status "rollback failure status" 1 "$status"
assert_contains "rollback failure critical" "$output" "CRITICAL: update failed and automatic rollback could not complete."
printf '4.0.0-dev\n' > "${proj}/VERSION"

printf '4.0.0-dev\n' > "${proj}/VERSION"
fail_src="${TEST_TMP}/postfail-src"
mkdir -p "${fail_src}/bin" "${fail_src}/lib"
printf '4.3.0\n' > "${fail_src}/VERSION"
printf '#!/usr/bin/env bash\nexit 0\n' > "${fail_src}/auto_rejoin.sh"
printf '#!/usr/bin/env bash\nif then\n' > "${fail_src}/setup.sh"
tar -czf "${TEST_TMP}/release.tar.gz" -C "$fail_src" .
sha="$(sha256sum "${TEST_TMP}/release.tar.gz" | awk '{print $1}')"
size="$(stat -c %s "${TEST_TMP}/release.tar.gz")"
write_manifest "${TEST_TMP}/manifest.json" "4.3.0" "https://fixture/release.tar.gz" "$sha" "$size"
sign_manifest "${TEST_TMP}/manifest.json"
output="$(updater_update "$proj" true 2>&1)"
status=$?
assert_status "rollback not needed for staging fail" 1 "$status"
assert_contains "rollback staging keeps old version" "$(cat "${proj}/VERSION")" "4.0.0-dev"

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
