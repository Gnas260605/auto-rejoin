#!/bin/bash
# ==============================================================================
# Auto Rejoin Pro V2 — Session Evidence Engine & Multi-Signal Classifier
# ==============================================================================
# Combines local Android signals, incremental session log events, and Roblox
# public API evidence to classify client state with high confidence.
# ==============================================================================

# Discrete States
STATE_GAME_ACTIVE="GAME_ACTIVE"
STATE_APP_HOME="APP_HOME"
STATE_JOINING="JOINING"
STATE_LOADING="LOADING"
STATE_QUEUE="QUEUE"
STATE_LOBBY="LOBBY"
STATE_TRANSIT="TRANSIT"
STATE_TELEPORTING="TELEPORTING"
STATE_WRONG_PLACE="WRONG_PLACE"
STATE_WINDOW_CLOSED="WINDOW_CLOSED"
STATE_PROCESS_DEAD="PROCESS_DEAD"
STATE_DISCONNECTED="DISCONNECTED"
STATE_KICKED="KICKED"
STATE_SERVER_SHUTDOWN="SERVER_SHUTDOWN"
STATE_SESSION_STALLED="SESSION_STALLED"
STATE_OFFLINE="OFFLINE"
STATE_UNKNOWN="UNKNOWN"

session_collect_evidence() {
    local package="$1"
    local expected_place="${2:-}"
    local expected_universe="${3:-}"
    local transit_places="${4:-}"
    local allowed_places="${5:-}"

    # 1. Android Local Signals
    local process_alive="false"
    local task_present="false"
    local window_record="false"
    local window_visible="false"
    local window_focused="false"
    local resumed_activity=""

    if android_is_process_running "$package" 2>/dev/null; then
        process_alive="true"
    fi

    if android_is_task_present "$package" 2>/dev/null; then
        task_present="true"
    fi

    if android_has_window_record "$package" 2>/dev/null; then
        window_record="true"
    fi

    if android_is_window_visible "$package" 2>/dev/null; then
        window_visible="true"
    fi

    if android_is_window_focused "$package" 2>/dev/null; then
        window_focused="true"
    fi

    resumed_activity="$(android_get_resumed_activity "$package" 2>/dev/null || echo "")"

    # 2. Session Log Signals (Incremental)
    local last_event="NONE"
    local observed_place=""
    local observed_job=""
    local observed_universe=""
    local game_ready="false"
    local disconnected="false"
    local disconnect_reason=""

    # Poll new log bytes
    session_poll_incremental "$package" >/dev/null 2>&1 || true

    last_event="$(session_get_latest_event "$package")"
    observed_place="$(session_get_observed_place "$package")"
    observed_job="$(session_get_observed_job "$package")"
    observed_universe="$(session_get_observed_universe "$package")"
    if session_is_game_ready "$package"; then
        game_ready="true"
    fi
    if session_is_disconnected "$package"; then
        disconnected="true"
        local rdir; rdir="$(session_runtime_dir "$package")"
        disconnect_reason="$(cat "$rdir/disconnect_reason" 2>/dev/null || echo "disconnected")"
    fi

    # 3. Network Signal
    local network_online="true"
    if type network_is_online >/dev/null 2>&1; then
        if ! network_is_online; then
            network_online="false"
        fi
    fi

    # 4. Optional Roblox Presence API (Read cache if available)
    local presence_type=""
    local presence_place=""
    local presence_universe=""
    local presence_game=""
    if [ -n "${ROBLOX_USER_ID:-}" ] && type roblox_api_cache_get >/dev/null 2>&1; then
        local pcache
        pcache="$(roblox_api_cache_get "presence_${ROBLOX_USER_ID}" 2>/dev/null || echo "")"
        if [ -n "$pcache" ]; then
            presence_type="$(echo "$pcache" | grep -oE '"userPresenceType":[0-9]+' | grep -oE '[0-9]+' || true)"
            presence_place="$(echo "$pcache" | grep -oE '"placeId":[0-9]+' | grep -oE '[0-9]+' || true)"
            presence_universe="$(echo "$pcache" | grep -oE '"universeId":[0-9]+' | grep -oE '[0-9]+' || true)"
            presence_game="$(echo "$pcache" | grep -oE '"gameId":"[^"]+"' | cut -d'"' -f4 || true)"
        fi
    fi

    # Output normalized evidence format
    cat <<EOF
process_alive=${process_alive}
task_present=${task_present}
window_record=${window_record}
window_visible=${window_visible}
window_focused=${window_focused}
resumed_activity=${resumed_activity}
last_event=${last_event}
observed_place=${observed_place}
observed_job=${observed_job}
observed_universe=${observed_universe}
game_ready=${game_ready}
disconnected=${disconnected}
disconnect_reason=${disconnect_reason}
network_online=${network_online}
presence_type=${presence_type}
presence_place=${presence_place}
presence_universe=${presence_universe}
presence_game=${presence_game}
expected_place=${expected_place}
expected_universe=${expected_universe}
transit_places=${transit_places}
allowed_places=${allowed_places}
EOF
}

# Helper to read key from evidence string
_get_ev() {
    local key="$1"
    local evidence="$2"
    echo "$evidence" | grep -E "^${key}=" | head -n 1 | cut -d= -f2-
}

# Helper to check if item is in comma-separated list
_in_csv() {
    local item="$1"
    local csv="$2"
    [ -z "$item" ] || [ -z "$csv" ] && return 1
    local old_ifs="$IFS"
    IFS=','
    for entry in $csv; do
        entry="$(echo "$entry" | tr -d ' ')"
        if [ "$entry" = "$item" ]; then
            IFS="$old_ifs"
            return 0
        fi
    done
    IFS="$old_ifs"
    return 1
}

session_classify() {
    local evidence="$1"
    [ -z "$evidence" ] && { echo "UNKNOWN|0"; return 0; }

    local process_alive; process_alive="$(_get_ev "process_alive" "$evidence")"
    local task_present; task_present="$(_get_ev "task_present" "$evidence")"
    local window_visible; window_visible="$(_get_ev "window_visible" "$evidence")"
    local window_focused; window_focused="$(_get_ev "window_focused" "$evidence")"
    local resumed_activity; resumed_activity="$(_get_ev "resumed_activity" "$evidence")"
    local last_event; last_event="$(_get_ev "last_event" "$evidence")"
    local observed_place; observed_place="$(_get_ev "observed_place" "$evidence")"
    local observed_universe; observed_universe="$(_get_ev "observed_universe" "$evidence")"
    local game_ready; game_ready="$(_get_ev "game_ready" "$evidence")"
    local disconnected; disconnected="$(_get_ev "disconnected" "$evidence")"
    local disconnect_reason; disconnect_reason="$(_get_ev "disconnect_reason" "$evidence")"
    local network_online; network_online="$(_get_ev "network_online" "$evidence")"
    local presence_type; presence_type="$(_get_ev "presence_type" "$evidence")"
    local presence_place; presence_place="$(_get_ev "presence_place" "$evidence")"
    local expected_place; expected_place="$(_get_ev "expected_place" "$evidence")"
    local expected_universe; expected_universe="$(_get_ev "expected_universe" "$evidence")"
    local transit_places; transit_places="$(_get_ev "transit_places" "$evidence")"
    local allowed_places; allowed_places="$(_get_ev "allowed_places" "$evidence")"

    # 1. Network check
    if [ "$network_online" = "false" ]; then
        echo "${STATE_OFFLINE}|100"
        return 0
    fi

    # 2. Process check
    if [ "$process_alive" != "true" ]; then
        echo "${STATE_PROCESS_DEAD}|100"
        return 0
    fi

    # 3. Disconnect check
    if [ "$disconnected" = "true" ]; then
        if [ "$disconnect_reason" = "kicked" ]; then
            echo "${STATE_KICKED}|95"
        elif [ "$disconnect_reason" = "shutdown" ]; then
            echo "${STATE_SERVER_SHUTDOWN}|95"
        else
            echo "${STATE_DISCONNECTED}|90"
        fi
        return 0
    fi

    # 4. Home Screen Check (Roblox open at home screen without gameplay)
    if echo "$resumed_activity" | grep -E -i -q "RobloxMainActivity|HomeActivity|MainActivity"; then
        if [ "$game_ready" != "true" ] && [ "$last_event" = "NONE" -o "$last_event" = "LAUNCH_STARTED" ]; then
            echo "${STATE_APP_HOME}|90"
            return 0
        fi
    fi

    # Missing freeform/window evidence is UNKNOWN while the process is alive.
    # It must never be promoted to destructive recovery evidence.

    # 5. Place & Universe Validation
    if [ -n "$observed_place" ] && [ -n "$expected_place" ]; then
        if [ "$observed_place" != "$expected_place" ]; then
            # Check if transit place or allowed place
            if _in_csv "$observed_place" "$transit_places"; then
                echo "${STATE_LOBBY}|85"
                return 0
            elif _in_csv "$observed_place" "$allowed_places"; then
                # In allowed sub-place / gameplay
                :
            elif [ -n "$observed_universe" ] && [ -n "$expected_universe" ] && [ "$observed_universe" = "$expected_universe" ]; then
                # Same universe sub-place
                echo "${STATE_TRANSIT}|80"
                return 0
            else
                # Definitely wrong place
                echo "${STATE_WRONG_PLACE}|90"
                return 0
            fi
        fi
    fi

    # 6. Teleporting
    if [ "$last_event" = "TELEPORT_STARTED" ]; then
        echo "${STATE_TELEPORTING}|85"
        return 0
    fi

    # 7. Active Gameplay Verification
    if [ "$game_ready" = "true" ]; then
        local score=85
        if echo "$resumed_activity" | grep -E -i -q "ActivityProtocolLaunch|GameActivity|RobloxAppActivity"; then
            score=$((score + 10))
        fi
        if [ "$presence_type" = "2" ]; then
            score=$((score + 5))
        fi
        [ "$score" -gt 100 ] && score=100
        echo "${STATE_GAME_ACTIVE}|${score}"
        return 0
    fi

    # 8. Server Connected / Handshake
    if [ "$last_event" = "SERVER_CONNECTED" ]; then
        echo "${STATE_LOADING}|80"
        return 0
    fi

    # 9. Joining
    if [ "$last_event" = "JOIN_STARTED" ] || [ "$last_event" = "SERVER_CONNECTING" ]; then
        echo "${STATE_JOINING}|75"
        return 0
    fi

    # 10. Activity indicates Game is running
    if echo "$resumed_activity" | grep -E -i -q "ActivityProtocolLaunch|GameActivity"; then
        echo "${STATE_LOADING}|70"
        return 0
    fi

    echo "${STATE_UNKNOWN}|50"
}
