#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ROBLOX_LIB="${ROOT_DIR}/lib/roblox.sh"
CONFIG_LIB="${ROOT_DIR}/lib/config.sh"

source "$ROBLOX_LIB"
source "$CONFIG_LIB"

PASS_COUNT=0
FAIL_COUNT=0

assert_eq() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" = "$actual" ]; then
        echo "PASS $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL $name - expected: '$expected', got: '$actual'"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

assert_status() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" -eq "$actual" ]; then
        echo "PASS $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL $name - expected exit: $expected, got: $actual"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# 1. Job ID validation
roblox_validate_job_id "c62b53b8-39c8-47bc-9b6f-8d76d4992955"
assert_status "validate standard uuid" 0 $?

roblox_validate_job_id "server_job_12345"
assert_status "validate custom string" 0 $?

roblox_validate_job_id "abc;rm -rf /" >/dev/null 2>&1
assert_status "reject injection chars in job id" 1 $?

roblox_validate_job_id "short" >/dev/null 2>&1
assert_status "reject too short job id" 1 $?

# 2. URI Building
assert_eq "build standard game uri" \
    "roblox://experiences/start?placeId=189707&launchData=placeId%3D189707" \
    "$(roblox_build_game_uri 189707)"

assert_eq "build game uri with gameInstanceId" \
    "roblox://experiences/start?placeId=189707&gameInstanceId=c62b53b8-39c8-47bc-9b6f-8d76d4992955&launchData=placeId%3D189707" \
    "$(roblox_build_game_uri 189707 "c62b53b8-39c8-47bc-9b6f-8d76d4992955")"

# 3. URI Parsing with gameInstanceId
roblox_parse_uri "roblox://experiences/start?placeId=189707&gameInstanceId=c62b53b8-39c8-47bc-9b6f-8d76d4992955"
assert_status "parse uri with gameInstanceId status" 0 $?
assert_eq "parsed placeId" "189707" "$ROBLOX_PARSED_PLACE_ID"
assert_eq "parsed uri preserves gameInstanceId" \
    "roblox://experiences/start?placeId=189707&gameInstanceId=c62b53b8-39c8-47bc-9b6f-8d76d4992955&launchData=placeId%3D189707" \
    "$ROBLOX_PARSED_URI"

# 4. Mocking roblox_fetch_public_servers for Multi-Clone Distribution Test
MOCK_JSON='{
  "data": [
    {"id": "job-server-full", "maxPlayers": 50, "playing": 50, "ping": 40},
    {"id": "job-server-medium", "maxPlayers": 50, "playing": 12, "ping": 60},
    {"id": "job-server-smallest-1", "maxPlayers": 50, "playing": 1, "ping": 50},
    {"id": "job-server-smallest-2", "maxPlayers": 50, "playing": 1, "ping": 80},
    {"id": "job-server-small-3", "maxPlayers": 50, "playing": 2, "ping": 45}
  ]
}'

roblox_fetch_public_servers() {
    printf '%s\n' "$MOCK_JSON"
}

# Clone 0 (First bot) should pick smallest-1 (playing: 1, lower ping)
server_slot_0="$(roblox_pick_low_server 189707 0 1 0)"
assert_eq "clone slot 0 gets 1st smallest server" "job-server-smallest-1|1|50" "$server_slot_0"

# Clone 1 (Second bot) should pick smallest-2 (playing: 1, next in sorted order)
server_slot_1="$(roblox_pick_low_server 189707 1 1 0)"
assert_eq "clone slot 1 gets 2nd smallest server" "job-server-smallest-2|1|50" "$server_slot_1"

# Clone 2 (Third bot) should pick small-3 (playing: 2)
server_slot_2="$(roblox_pick_low_server 189707 2 1 0)"
assert_eq "clone slot 2 gets 3rd smallest server" "job-server-small-3|2|50" "$server_slot_2"

# 5. Fallback test when API returns empty or invalid
roblox_fetch_public_servers() {
    printf '{"data":[]}\n'
}
assert_status "empty server list fails cleanly" 1 "$(roblox_pick_low_server 189707 0 >/dev/null 2>&1; echo $?)"

roblox_fetch_public_servers() {
    printf 'invalid json error\n'
}
assert_status "invalid json fails cleanly" 1 "$(roblox_pick_low_server 189707 0 >/dev/null 2>&1; echo $?)"

echo ""
echo "Low Server Selection Tests: PASS=$PASS_COUNT, FAIL=$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
