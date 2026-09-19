#!/bin/bash
# ==============================================================================
# Auto Rejoin Pro V2 — Roblox Incremental Session Log Parser & Lifecycle Tracker
# ==============================================================================
# Provides robust, byte-offset-based log parsing per package instance without
# stale log pollution across session restarts. Tracks discrete session events.
# ==============================================================================

# Session lifecycle states / events
SESSION_EVT_NONE="NONE"
SESSION_EVT_LAUNCH_STARTED="LAUNCH_STARTED"
SESSION_EVT_JOIN_STARTED="JOIN_STARTED"
SESSION_EVT_SERVER_CONNECTING="SERVER_CONNECTING"
SESSION_EVT_SERVER_CONNECTED="SERVER_CONNECTED"
SESSION_EVT_GAME_READY="GAME_READY"
SESSION_EVT_TELEPORT_STARTED="TELEPORT_STARTED"
SESSION_EVT_TELEPORT_SUCCEEDED="TELEPORT_SUCCEEDED"
SESSION_EVT_TELEPORT_FAILED="TELEPORT_FAILED"
SESSION_EVT_DISCONNECTED="DISCONNECTED"
SESSION_EVT_KICKED="KICKED"
SESSION_EVT_SERVER_SHUTDOWN="SERVER_SHUTDOWN"
SESSION_EVT_CRASH_HINT="CRASH_HINT"

# Default runtime directory for session tracking
SESSION_RUNTIME_BASE="${SESSION_RUNTIME_BASE:-tmp/runtime}"

session_runtime_dir() {
    local package="$1"
    [ -z "$package" ] && package="default"
    printf '%s/%s' "$SESSION_RUNTIME_BASE" "$package"
}

session_init_dir() {
    local package="$1"
    local dir
    dir="$(session_runtime_dir "$package")"
    mkdir -p "$dir" 2>/dev/null || true
}

session_begin() {
    local package="$1"
    local expected_place="${2:-}"
    local now; now=$(date +%s)
    local dir; dir="$(session_runtime_dir "$package")"
    session_init_dir "$package"

    local gen=1
    if [ -f "$dir/session_gen" ]; then
        local old_gen
        old_gen="$(cat "$dir/session_gen" 2>/dev/null || echo 0)"
        if [[ "$old_gen" =~ ^[0-9]+$ ]]; then
            gen=$((old_gen + 1))
        fi
    fi
    printf '%d' "$gen" > "$dir/session_gen" 2>/dev/null || true

    local session_id="${package}_${now}_${gen}"
    printf '%s' "$session_id" > "$dir/session_id" 2>/dev/null || true
    printf '%d' "$now" > "$dir/session_started_at" 2>/dev/null || true
    printf '%s' "$SESSION_EVT_LAUNCH_STARTED" > "$dir/last_event" 2>/dev/null || true
    printf '%d' "$now" > "$dir/last_event_at" 2>/dev/null || true
    printf '%s' "$expected_place" > "$dir/expected_place" 2>/dev/null || true

    # Reset cursor state
    printf '0' > "$dir/log_offset" 2>/dev/null || true
    printf '' > "$dir/log_inode" 2>/dev/null || true
    printf '' > "$dir/log_file" 2>/dev/null || true
    printf '' > "$dir/observed_place" 2>/dev/null || true
    printf '' > "$dir/observed_job" 2>/dev/null || true
    printf '' > "$dir/observed_universe" 2>/dev/null || true
    printf 'false' > "$dir/game_ready" 2>/dev/null || true
    printf 'false' > "$dir/disconnected" 2>/dev/null || true
    printf '' > "$dir/disconnect_reason" 2>/dev/null || true

    printf '%s\n' "$session_id"
}

session_find_log_file() {
    local package="$1"
    local log_dir=""

    if [ -d "/sdcard/Android/data/$package/files/logs" ]; then
        log_dir="/sdcard/Android/data/$package/files/logs"
    elif [ -d "/data/data/$package/files/logs" ]; then
        log_dir="/data/data/$package/files/logs"
    fi

    # Fallback to test mock log directory if defined
    if [ -z "$log_dir" ] && [ -n "${ROBLOX_LOG_MOCK_DIR:-}" ] && [ -d "$ROBLOX_LOG_MOCK_DIR" ]; then
        log_dir="$ROBLOX_LOG_MOCK_DIR"
    fi

    [ -z "$log_dir" ] && return 1

    local latest_log
    latest_log=$(ls -1t "$log_dir" 2>/dev/null | grep -E '\.(log|txt)$' | head -n 1)
    [ -z "$latest_log" ] && return 1

    printf '%s/%s\n' "$log_dir" "$latest_log"
}

session_get_file_inode() {
    local file="$1"
    stat -c %i "$file" 2>/dev/null || stat -f %i "$file" 2>/dev/null || ls -i "$file" 2>/dev/null | awk '{print $1}'
}

session_get_file_size() {
    local file="$1"
    stat -c %s "$file" 2>/dev/null || stat -f %z "$file" 2>/dev/null || wc -c < "$file" 2>/dev/null | tr -d ' '
}

session_poll_incremental() {
    local package="$1"
    local custom_log_file="${2:-}"
    local dir; dir="$(session_runtime_dir "$package")"
    session_init_dir "$package"

    local log_file="$custom_log_file"
    if [ -z "$log_file" ]; then
        log_file="$(session_find_log_file "$package")"
    fi
    [ -z "$log_file" ] || [ ! -f "$log_file" ] && return 1

    local current_inode
    current_inode="$(session_get_file_inode "$log_file")"
    local current_size
    current_size="$(session_get_file_size "$log_file")"
    [[ "$current_size" =~ ^[0-9]+$ ]] || current_size=0

    local last_inode
    last_inode="$(cat "$dir/log_inode" 2>/dev/null || echo "")"
    local last_offset
    last_offset="$(cat "$dir/log_offset" 2>/dev/null || echo 0)"
    [[ "$last_offset" =~ ^[0-9]+$ ]] || last_offset=0

    # If inode changed or file truncated, reset offset to 0
    if [ "$current_inode" != "$last_inode" ] || [ "$current_size" -lt "$last_offset" ]; then
        last_offset=0
    fi

    # Read incremental content from last_offset
    local new_content=""
    if [ "$current_size" -gt "$last_offset" ]; then
        local bytes_to_read=$((current_size - last_offset))
        # tail -c +N is 1-indexed (byte 1 is start)
        local start_pos=$((last_offset + 1))
        new_content=$(tail -c +"$start_pos" "$log_file" 2>/dev/null | head -c "$bytes_to_read" 2>/dev/null || true)
    fi

    # Update cursor state
    printf '%s' "$log_file" > "$dir/log_file" 2>/dev/null || true
    printf '%s' "$current_inode" > "$dir/log_inode" 2>/dev/null || true
    printf '%d' "$current_size" > "$dir/log_offset" 2>/dev/null || true

    if [ -n "$new_content" ]; then
        session_parse_chunk "$package" "$new_content"
        printf '%s\n' "$new_content"
    fi

    return 0
}

session_parse_chunk() {
    local package="$1"
    local chunk="$2"
    [ -z "$chunk" ] && return 0
    local dir; dir="$(session_runtime_dir "$package")"
    local now; now=$(date +%s)

    # 1. Place ID Observation
    local place_match
    place_match=$( (echo "$chunk" | grep -oE "placeId[^0-9]{0,10}[0-9]+" | grep -oE "[0-9]+" | head -n 1) 2>/dev/null || true )
    if [ -z "$place_match" ]; then
        place_match=$( (echo "$chunk" | grep -oE "Joining game '[0-9]+'" | grep -oE "[0-9]+" | head -n 1) 2>/dev/null || true )
    fi
    if [ -n "$place_match" ]; then
        printf '%s' "$place_match" > "$dir/observed_place" 2>/dev/null || true
    fi

    # 2. Universe ID Observation
    local universe_match
    universe_match=$( (echo "$chunk" | grep -oE "UniverseId:[[:space:]]*[0-9]+" | grep -oE "[0-9]+" | head -n 1) 2>/dev/null || true )
    if [ -n "$universe_match" ]; then
        printf '%s' "$universe_match" > "$dir/observed_universe" 2>/dev/null || true
    fi

    # 3. Job ID Observation
    local job_match
    job_match=$( (echo "$chunk" | grep -oE "gameId:[[:space:]]*[a-fA-F0-9-]{36}" | grep -oE "[a-fA-F0-9-]{36}" | head -n 1) 2>/dev/null || true )
    if [ -z "$job_match" ]; then
        job_match=$( (echo "$chunk" | grep -oE "JobId:[[:space:]]*[a-fA-F0-9-]{36}" | grep -oE "[a-fA-F0-9-]{36}" | head -n 1) 2>/dev/null || true )
    fi
    if [ -n "$job_match" ]; then
        printf '%s' "$job_match" > "$dir/observed_job" 2>/dev/null || true
    fi

    # 4. Discrete Lifecycle Event Transitions
    # Check disconnect / kick first with full error codes coverage
    if echo "$chunk" | grep -E -i -q "lost connection to the game|connection lost: error code|disconnected from server|you have been kicked|error code[:= ]*(260|261|262|264|266|267|268|272|273|274|277|279|280|282|284|286|288|524|529|773)|unexpected client behavior|same account launched|server was shut down|server has shut down"; then
        printf 'true' > "$dir/disconnected" 2>/dev/null || true
        printf 'false' > "$dir/game_ready" 2>/dev/null || true
        if echo "$chunk" | grep -E -i -q "you have been kicked|kicked from this game|error code[:= ]*267"; then
            printf '%s' "$SESSION_EVT_KICKED" > "$dir/last_event" 2>/dev/null || true
            printf 'kicked' > "$dir/disconnect_reason" 2>/dev/null || true
        elif echo "$chunk" | grep -E -i -q "server shutdown|game was closed|server was shut down|server has shut down"; then
            printf '%s' "$SESSION_EVT_SERVER_SHUTDOWN" > "$dir/last_event" 2>/dev/null || true
            printf 'shutdown' > "$dir/disconnect_reason" 2>/dev/null || true
        elif echo "$chunk" | grep -E -i -q "unexpected client behavior|error code[:= ]*268"; then
            printf '%s' "$SESSION_EVT_DISCONNECTED" > "$dir/last_event" 2>/dev/null || true
            printf 'unexpected_client' > "$dir/disconnect_reason" 2>/dev/null || true
        elif echo "$chunk" | grep -E -i -q "same account launched|error code[:= ]*(273|264)"; then
            printf '%s' "$SESSION_EVT_DISCONNECTED" > "$dir/last_event" 2>/dev/null || true
            printf 'duplicate_login' > "$dir/disconnect_reason" 2>/dev/null || true
        else
            printf '%s' "$SESSION_EVT_DISCONNECTED" > "$dir/last_event" 2>/dev/null || true
            printf 'disconnected' > "$dir/disconnect_reason" 2>/dev/null || true
        fi
        printf '%d' "$now" > "$dir/last_event_at" 2>/dev/null || true
        return 0
    fi

    # Check Game Ready
    if echo "$chunk" | grep -E -q "Game joined successfully|Character loaded into workspace|Replication stream connected"; then
        printf 'true' > "$dir/game_ready" 2>/dev/null || true
        printf 'false' > "$dir/disconnected" 2>/dev/null || true
        printf '%s' "$SESSION_EVT_GAME_READY" > "$dir/last_event" 2>/dev/null || true
        printf '%d' "$now" > "$dir/last_event_at" 2>/dev/null || true
        return 0
    fi

    # Check Teleport
    if echo "$chunk" | grep -E -q "Teleport started|Initiating teleport"; then
        printf '%s' "$SESSION_EVT_TELEPORT_STARTED" > "$dir/last_event" 2>/dev/null || true
        printf '%d' "$now" > "$dir/last_event_at" 2>/dev/null || true
        return 0
    fi

    # Check Server Connected
    if echo "$chunk" | grep -E -q "Connected to game server|Server connection established"; then
        printf '%s' "$SESSION_EVT_SERVER_CONNECTED" > "$dir/last_event" 2>/dev/null || true
        printf '%d' "$now" > "$dir/last_event_at" 2>/dev/null || true
        return 0
    fi

    # Check Join Started
    if echo "$chunk" | grep -E -q "Joining game|placeId:"; then
        printf '%s' "$SESSION_EVT_JOIN_STARTED" > "$dir/last_event" 2>/dev/null || true
        printf '%d' "$now" > "$dir/last_event_at" 2>/dev/null || true
        return 0
    fi
}

session_get_latest_event() {
    local package="$1"
    local dir; dir="$(session_runtime_dir "$package")"
    cat "$dir/last_event" 2>/dev/null || echo "$SESSION_EVT_NONE"
}

session_get_observed_place() {
    local package="$1"
    local dir; dir="$(session_runtime_dir "$package")"
    cat "$dir/observed_place" 2>/dev/null || echo ""
}

session_get_observed_job() {
    local package="$1"
    local dir; dir="$(session_runtime_dir "$package")"
    cat "$dir/observed_job" 2>/dev/null || echo ""
}

session_get_observed_universe() {
    local package="$1"
    local dir; dir="$(session_runtime_dir "$package")"
    cat "$dir/observed_universe" 2>/dev/null || echo ""
}

session_is_game_ready() {
    local package="$1"
    local dir; dir="$(session_runtime_dir "$package")"
    [ "$(cat "$dir/game_ready" 2>/dev/null)" = "true" ]
}

session_is_disconnected() {
    local package="$1"
    local dir; dir="$(session_runtime_dir "$package")"
    [ "$(cat "$dir/disconnected" 2>/dev/null)" = "true" ]
}

session_reset() {
    local package="$1"
    local dir; dir="$(session_runtime_dir "$package")"
    rm -rf "$dir" 2>/dev/null || true
}
