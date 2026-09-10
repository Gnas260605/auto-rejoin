#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/roblox.sh
source "${REPO_DIR}/lib/roblox.sh"

TEST_TMP="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0
MARKER="/tmp/roblox-parser-pwned"

cleanup() {
    rm -rf "$TEST_TMP"
    rm -f "$MARKER"
}
trap cleanup EXIT

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

assert_eq() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then pass "$name"; else fail "$name expected=[$expected] actual=[$actual]"; fi
}

assert_parse() {
    local name="$1" input="$2" type="$3" place="$4" code="$5" uri="$6"
    if roblox_parse_link "$input"; then
        assert_eq "$name type" "$type" "$ROBLOX_LINK_TYPE"
        assert_eq "$name place" "$place" "$ROBLOX_PARSED_PLACE_ID"
        assert_eq "$name code" "$code" "$ROBLOX_PARSED_PRIVATE_CODE"
        assert_eq "$name uri" "$uri" "$ROBLOX_PARSED_URI"
    else
        fail "$name parse failed: $ROBLOX_PARSE_ERROR"
    fi
}

assert_invalid() {
    local name="$1" input="$2"
    if roblox_parse_link "$input" >/dev/null 2>&1; then
        fail "$name invalid rejected"
    else
        pass "$name invalid rejected"
    fi
}

valid_inputs() {
    assert_parse "valid www game URL" \
        "https://www.roblox.com/games/2753915549/Game-Name" \
        "game" "2753915549" "" "roblox://experiences/start?placeId=2753915549"
    assert_parse "valid non-www game URL" \
        "https://roblox.com/games/2753915549/Game-Name" \
        "game" "2753915549" "" "roblox://experiences/start?placeId=2753915549"
    assert_parse "game URL without slug" \
        "https://www.roblox.com/games/2753915549" \
        "game" "2753915549" "" "roblox://experiences/start?placeId=2753915549"
    assert_parse "game URL with query" \
        "https://www.roblox.com/games/2753915549/Game-Name?something=value" \
        "game" "2753915549" "" "roblox://experiences/start?placeId=2753915549"
    assert_parse "raw Place ID" \
        "2753915549" \
        "game" "2753915549" "" "roblox://experiences/start?placeId=2753915549"
    assert_parse "valid share URL" \
        "https://www.roblox.com/share?code=ABC123&type=Server" \
        "private_server" "" "ABC123" "roblox://navigation/share_links?code=ABC123&type=Server"
    assert_parse "share URL params reversed" \
        "https://www.roblox.com/share?type=Server&code=ABC123" \
        "private_server" "" "ABC123" "roblox://navigation/share_links?code=ABC123&type=Server"
    assert_parse "encoded private code" \
        "https://www.roblox.com/share?type=Server&code=ABC%5F123" \
        "private_server" "" "ABC_123" "roblox://navigation/share_links?code=ABC_123&type=Server"
    assert_parse "valid roblox game URI" \
        "roblox://experiences/start?placeId=123" \
        "game" "123" "" "roblox://experiences/start?placeId=123"
    assert_parse "valid roblox private URI" \
        "roblox://navigation/share_links?code=ABC123&type=Server" \
        "private_server" "" "ABC123" "roblox://navigation/share_links?code=ABC123&type=Server"
}

invalid_inputs() {
    assert_invalid "fake domain" "https://evilroblox.com/games/123/Test"
    assert_invalid "domain suffix attack" "https://roblox.com.evil.example/games/123/Test"
    assert_invalid "missing Place ID" "https://www.roblox.com/games/"
    assert_invalid "non-numeric Place ID" "https://www.roblox.com/games/abc/Test"
    assert_invalid "negative Place ID" "-123"
    assert_invalid "missing private code" "https://www.roblox.com/share?type=Server"
    assert_invalid "wrong share type" "https://www.roblox.com/share?code=ABC123&type=NotServer"
    assert_invalid "empty" ""
    assert_invalid "spaces" "   "
    assert_invalid "ftp scheme" "ftp://www.roblox.com/games/123/Test"
    assert_invalid "file scheme" "file:///tmp/roblox"
    assert_invalid "javascript scheme" "javascript:alert(1)"
    assert_invalid "malformed percent encoding" "https://www.roblox.com/share?type=Server&code=ABC%ZZ"
    assert_invalid "malformed roblox URI" "roblox://bad/path?placeId=123"
}

security_inputs_do_not_execute() {
    rm -f "$MARKER"
    roblox_parse_link "\$(touch $MARKER)" >/dev/null 2>&1 || true
    roblox_parse_link "\`touch $MARKER\`" >/dev/null 2>&1 || true
    roblox_parse_link "https://www.roblox.com/games/123/x;touch $MARKER" >/dev/null 2>&1 || true
    [ ! -e "$MARKER" ] && pass "malicious inputs did not execute" || fail "malicious inputs did not execute"
}

uri_builders() {
    assert_eq "game URI exact" "roblox://experiences/start?placeId=123" "$(roblox_build_game_uri 123)"
    assert_eq "private URI exact" "roblox://navigation/share_links?code=ABC123&type=Server" "$(roblox_build_private_server_uri ABC123)"
}

valid_inputs
invalid_inputs
security_inputs_do_not_execute
uri_builders

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
