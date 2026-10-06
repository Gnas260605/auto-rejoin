#!/usr/bin/env bash
# Kiểm tra tĩnh chống tái phát: hàm bị định nghĩa trùng, force-stop nằm ngoài recovery gate.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_DIR" || exit 1

PASS_COUNT=0
FAIL_COUNT=0
pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

defined_functions() {
    grep -oE '^[a-zA-Z_][a-zA-Z0-9_]*\(\)' "$@" | sed 's/^.*://; s/()$//'
}

dups="$(defined_functions auto_rejoin.sh | sort | uniq -d | tr '\n' ' ')"
if [ -z "$dups" ]; then pass "auto_rejoin.sh khong co ham trung"; else fail "auto_rejoin.sh ham trung: $dups"; fi

for f in lib/*.sh; do
    dups="$(defined_functions "$f" | sort | uniq -d | tr '\n' ' ')"
    [ -z "$dups" ] || fail "$f ham trung: $dups"
done
pass "lib/*.sh khong co ham trung trong cung file"

# auto_rejoin.sh source toan bo lib/ truoc; dinh nghia lai ham cua lib se am tham ghi de ban da test.
overrides="$(comm -12 <(defined_functions lib/*.sh | sort -u) <(defined_functions auto_rejoin.sh | sort -u) | tr '\n' ' ')"
if [ -z "$overrides" ]; then pass "auto_rejoin.sh khong ghi de ham lib"; else fail "auto_rejoin.sh ghi de ham lib: $overrides"; fi

# Chi lib/android.sh (dinh nghia) va lib/monitor.sh (gate) duoc goi force-stop.
leaks="$(grep -rnE 'android_force_stop|am force-stop|android_am force-stop' lib auto_rejoin.sh bin setup.sh 2>/dev/null \
    | grep -vE '^\s*[^:]+:[0-9]+:\s*#' \
    | grep -vE '^lib/android\.sh:|^lib/monitor\.sh:' \
    | grep -v 'không force-stop' || true)"
if [ -z "$leaks" ]; then pass "force-stop chi di qua recovery gate"; else fail "force-stop ngoai gate: $leaks"; fi

for f in auto_rejoin.sh setup.sh bin/roblox-manager lib/*.sh; do
    bash -n "$f" 2>/dev/null || fail "bash -n $f"
done
pass "bash -n toan bo script"

# Dem \r bang tr: grep tren Git Bash/Windows bo qua \r nen khong tin duoc.
crlf=""
for f in auto_rejoin.sh setup.sh bin/roblox-manager lib/*.sh scripts/*.sh scripts/*.lua; do
    [ "$(tr -cd '\r' < "$f" | wc -c)" -eq 0 ] || crlf="${crlf}${f} "
done
if [ -z "$crlf" ]; then pass "script dung LF"; else fail "script dung CRLF (Termux se loi): $crlf"; fi

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
