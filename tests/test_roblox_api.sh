#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURES_DIR="${REPO_DIR}/tests/fixtures/api"

# shellcheck source=../lib/roblox_api.sh
source "${REPO_DIR}/lib/roblox_api.sh"

TEST_TMP="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() {
    rm -rf "$TEST_TMP"
}
trap cleanup EXIT

pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    printf 'PASS %s\n' "$1"
}

fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf 'FAIL %s\n' "$1"
}

assert_eq() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" = "$actual" ]; then
        pass "$name"
    else
        fail "$name: expected [$expected], got [$actual]"
    fi
}

assert_status() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" -eq "$actual" ]; then
        pass "$name"
    else
        fail "$name: expected status $expected, got $actual"
    fi
}

# --- Mock Handler for Offline API Testing ---
mock_api_dispatcher() {
    local method="$1"
    local url="$2"
    local provider="${3:-default}"
    local data="${4:-}"

    case "$url" in
        *"apis.roblox.com/universes/v1/places/97598239454123/universe"*)
            cat "${FIXTURES_DIR}/place_universe_ok.json"
            return 0
            ;;
        *"apis.roblox.com/universes/v1/places/999999999/universe"*)
            cat "${FIXTURES_DIR}/place_universe_invalid.json"
            return 0
            ;;
        *"games.roblox.com/v1/games?universeIds=1234567890"*)
            cat "${FIXTURES_DIR}/game_info_ok.json"
            return 0
            ;;
        *"games.roblox.com/v1/games?universeIds=9999999999"*)
            cat "${FIXTURES_DIR}/game_info_empty.json"
            return 0
            ;;
        *"games.roblox.com/v1/games/97598239454123/servers/Public"*"cursor_page_2_abc123"*)
            cat "${FIXTURES_DIR}/servers_page_2.json"
            return 0
            ;;
        *"games.roblox.com/v1/games/97598239454123/servers/Public"*)
            cat "${FIXTURES_DIR}/servers_page_1.json"
            return 0
            ;;
        *"users.roblox.com/v1/usernames/users"*)
            if [[ "$data" =~ "builderman" ]]; then
                cat "${FIXTURES_DIR}/username_resolve_ok.json"
                return 0
            else
                cat "${FIXTURES_DIR}/username_not_found.json"
                return 0
            fi
            ;;
        *"presence.roblox.com/v1/presence/users"*)
            if [[ "$data" =~ "1122334455" ]]; then
                cat "${FIXTURES_DIR}/presence_ingame.json"
                return 0
            elif [[ "$data" =~ "222222222" ]]; then
                cat "${FIXTURES_DIR}/presence_online.json"
                return 0
            elif [[ "$data" =~ "333333333" ]]; then
                cat "${FIXTURES_DIR}/presence_offline.json"
                return 0
            elif [[ "$data" =~ "444444444" ]]; then
                cat "${FIXTURES_DIR}/presence_hidden.json"
                return 0
            fi
            cat "${FIXTURES_DIR}/presence_offline.json"
            return 0
            ;;
        *"rate-limit-test"*)
            cat "${FIXTURES_DIR}/rate_limit_429.json"
            return "$API_ERR_RATE_LIMIT"
            ;;
        *"network-fail-test"*)
            return "$API_ERR_TIMEOUT"
            ;;
        *)
            return "$API_ERR_GENERIC"
            ;;
    esac
}

export ROBLOX_API_MOCK_HANDLER="mock_api_dispatcher"
export ROBLOX_API_CACHE_DIR="${TEST_TMP}/cache"
export TMP_DIR="${TEST_TMP}"
mkdir -p "$ROBLOX_API_CACHE_DIR"

test_json_extract() {
    local json='{"universeId": 1234567890, "name": "Blox Fruits", "nested": {"count": 42}}'
    local val
    val="$(roblox_api_json_extract "$json" ".universeId")"
    assert_eq "json_extract top level number" "1234567890" "$val"

    val="$(roblox_api_json_extract "$json" ".name")"
    assert_eq "json_extract top level string" "Blox Fruits" "$val"

    val="$(roblox_api_json_extract "$json" ".nested.count")"
    assert_eq "json_extract nested" "42" "$val"
}

test_place_to_universe() {
    local universe_id status=0
    universe_id="$(roblox_api_place_to_universe "97598239454123")" || status=$?
    assert_status "place_to_universe ok status" 0 "$status"
    assert_eq "place_to_universe id" "1234567890" "$universe_id"

    # Cached call should return the same without error
    universe_id="$(roblox_api_place_to_universe "97598239454123")"
    assert_eq "place_to_universe cache hit" "1234567890" "$universe_id"

    # Invalid place ID
    status=0
    universe_id="$(roblox_api_place_to_universe "999999999")" || status=$?
    assert_status "place_to_universe invalid place error" "$API_ERR_SCHEMA" "$status"
}

test_get_game_details() {
    local out status=0
    out="$(roblox_api_get_game "1234567890")" || status=$?
    assert_status "get_game status" 0 "$status"

    local name root_id playing visits
    name="$(roblox_api_json_extract "$out" ".name")"
    root_id="$(roblox_api_json_extract "$out" ".rootPlaceId")"
    playing="$(roblox_api_json_extract "$out" ".playing")"
    visits="$(roblox_api_json_extract "$out" ".visits")"

    assert_eq "game name" "Blox Fruits" "$name"
    assert_eq "game root place" "97598239454123" "$root_id"
    assert_eq "game playing count" "543210" "$playing"
    assert_eq "game visits" "35000000000" "$visits"
}

test_servers_and_picker() {
    local out status=0
    out="$(roblox_api_get_public_servers "97598239454123" "" 100)" || status=$?
    assert_status "get_public_servers status" 0 "$status"

    local total_servers next_token
    total_servers="$(roblox_api_json_extract "$out" ".data | length")"
    next_token="$(roblox_api_json_extract "$out" ".nextPageCursor")"

    assert_eq "servers count page 1" "3" "$total_servers"
    assert_eq "next cursor" "cursor_page_2_abc123" "$next_token"

    # Test server picking: slot=0, min=1, max=5 players (should pick 33333333-3333-3333-3333-333333333333 with 1 player)
    local picked_line picked_job
    picked_line="$(roblox_api_pick_server "97598239454123" 0 1 5 "")" || status=$?
    assert_status "pick_server status" 0 "$status"
    picked_job="$(printf '%s' "$picked_line" | cut -d'|' -f1)"
    assert_eq "pick_server selected lowest matching" "33333333-3333-3333-3333-333333333333" "$picked_job"

    # Blacklist 33333333; next lowest is 22222222 (2 players)
    picked_line="$(roblox_api_pick_server "97598239454123" 0 1 5 "33333333-3333-3333-3333-333333333333")"
    picked_job="$(printf '%s' "$picked_line" | cut -d'|' -f1)"
    assert_eq "pick_server skips blacklisted job" "22222222-2222-2222-2222-222222222222" "$picked_job"

    # Blacklist both page 1 matches; pagination should load page 2 and pick 55555555 (1 player, ping 40)
    picked_line="$(roblox_api_pick_server "97598239454123" 0 1 5 "33333333-3333-3333-3333-333333333333,22222222-2222-2222-2222-222222222222" 5)"
    picked_job="$(printf '%s' "$picked_line" | cut -d'|' -f1)"
    assert_eq "pick_server paginates to page 2" "55555555-5555-5555-5555-555555555555" "$picked_job"
}

test_username_resolve() {
    local out status=0
    out="$(roblox_api_resolve_username "builderman")" || status=$?
    assert_status "resolve_username success status" 0 "$status"
    assert_eq "resolved user info" "156|Builderman" "$out"

    # Not found
    status=0
    out="$(roblox_api_resolve_username "NonExistentUserXYZ999")" || status=$?
    assert_status "resolve_username not found error" "$API_ERR_INVALID_ARG" "$status"
}

test_presence() {
    local pres status=0
    pres="$(roblox_api_get_presence "1122334455")" || status=$?
    assert_status "presence in-game status" 0 "$status"
    assert_eq "presence line parsed" "2|97598239454123|22222222-2222-2222-2222-222222222222|1234567890|Blox Fruits" "$pres"

    # Online presence (userPresenceType: 1)
    pres="$(roblox_api_get_presence "222222222")"
    assert_eq "presence online type" "1" "$(printf '%s' "$pres" | cut -d'|' -f1)"

    # Offline presence (userPresenceType: 0)
    pres="$(roblox_api_get_presence "333333333")"
    assert_eq "presence offline type" "0" "$(printf '%s' "$pres" | cut -d'|' -f1)"

    # Hidden presence (userPresenceType: 2, empty placeId/gameId)
    pres="$(roblox_api_get_presence "444444444")"
    assert_eq "presence hidden type" "2" "$(printf '%s' "$pres" | cut -d'|' -f1)"
    assert_eq "presence hidden place id empty" "" "$(printf '%s' "$pres" | cut -d'|' -f2)"
}

test_cache_manager() {
    local test_key="test_cache_entry"
    local test_data='{"foo": "bar", "val": 123}'
    
    # Store with TTL = 2s
    roblox_api_cache_set "$test_key" "$test_data" 2
    local cached
    cached="$(roblox_api_cache_get "$test_key")"
    local val
    val="$(roblox_api_json_extract "$cached" ".foo")"
    assert_eq "cache get content parsed field" "bar" "$val"

    # Invalidate
    roblox_api_cache_invalidate "$test_key"
    cached="$(roblox_api_cache_get "$test_key" || true)"
    assert_eq "cache invalidated content" "" "$cached"
}

test_circuit_breaker() {
    roblox_api_reset_breaker "roblox_api"
    
    local avail status=0
    roblox_api_is_available "roblox_api" || status=$?
    assert_status "breaker initial available" 0 "$status"

    # Record 3 failures (BREAKER_LIMIT = 3)
    roblox_api_record_failure "roblox_api" 500
    roblox_api_record_failure "roblox_api" 500
    roblox_api_record_failure "roblox_api" 500

    # Breaker should now trip
    status=0
    roblox_api_is_available "roblox_api" || status=$?
    assert_status "breaker tripped status" 1 "$status"

    # Reset breaker
    roblox_api_reset_breaker "roblox_api"
    status=0
    roblox_api_is_available "roblox_api" || status=$?
    assert_status "breaker reset available" 0 "$status"
}

test_json_extract
test_place_to_universe
test_get_game_details
test_servers_and_picker
test_username_resolve
test_presence
test_cache_manager
test_circuit_breaker

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
