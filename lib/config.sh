#!/usr/bin/env bash

# Safe legacy config parser for Auto Rejoin.
# Reads KEY=value files without executing their contents.

CONFIG_WARNINGS=""

config_warn() {
    local message="$1"
    if [ -n "$CONFIG_WARNINGS" ]; then
        CONFIG_WARNINGS="${CONFIG_WARNINGS}
${message}"
    else
        CONFIG_WARNINGS="$message"
    fi
}

config_init_defaults() {
    PLACE_ID="${PLACE_ID:-97598239454123}"
    PRIVATE_CODE="${PRIVATE_CODE:-}"
    ROBLOX_PACKAGE="${ROBLOX_PACKAGE:-com.roblox.client}"
    CHECK_INTERVAL="${CHECK_INTERVAL:-30}"
    AUTO_RESTART_PERIOD="${AUTO_RESTART_PERIOD:-7200}"
    ANTI_AFK="${ANTI_AFK:-true}"
    AFK_TAP_INTERVAL="${AFK_TAP_INTERVAL:-180}"
    TAP_X="${TAP_X:-540}"
    TAP_Y="${TAP_Y:-960}"
    DISCORD_WEBHOOK="${DISCORD_WEBHOOK:-}"
    ROBLOX_USERNAME="${ROBLOX_USERNAME:-}"
    PROFILE="${PROFILE:-default}"
    FREEFORM_LAYOUT="${FREEFORM_LAYOUT:-false}"
    FREEFORM_WIDTH="${FREEFORM_WIDTH:-auto}"
    FREEFORM_HEIGHT="${FREEFORM_HEIGHT:-auto}"
    FREEFORM_OFFSET_X="${FREEFORM_OFFSET_X:-auto}"
    FREEFORM_OFFSET_Y="${FREEFORM_OFFSET_Y:-auto}"
    LICENSE_MODE="${AUTO_REJOIN_LICENSE_MODE:-${LICENSE_MODE:-optional}}"
    JOIN_LOW_SERVER="${JOIN_LOW_SERVER:-false}"
    LOW_SERVER_MIN_PLAYERS="${LOW_SERVER_MIN_PLAYERS:-1}"
    LOW_SERVER_MAX_PLAYERS="${LOW_SERVER_MAX_PLAYERS:-0}"
}

config_is_allowed_key() {
    case "$1" in
        PLACE_ID|PRIVATE_CODE|ROBLOX_PACKAGE|CHECK_INTERVAL|AUTO_RESTART_PERIOD|ANTI_AFK|AFK_TAP_INTERVAL|TAP_X|TAP_Y|DISCORD_WEBHOOK|ROBLOX_USERNAME|PROFILE|FREEFORM_LAYOUT|FREEFORM_WIDTH|FREEFORM_HEIGHT|FREEFORM_OFFSET_X|FREEFORM_OFFSET_Y|LICENSE_MODE|JOIN_LOW_SERVER|LOW_SERVER_MIN_PLAYERS|LOW_SERVER_MAX_PLAYERS)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

config_trim() {
    local value="$1"
    value="${value#"${value%%[!$' \t']*}"}"
    value="${value%"${value##*[!$' \t']}"}"
    printf '%s' "$value"
}

config_unquote() {
    local value="$1"
    local first last
    first="${value:0:1}"
    last="${value: -1}"
    if { [ "$first" = '"' ] && [ "$last" = '"' ]; } || { [ "$first" = "'" ] && [ "$last" = "'" ]; }; then
        value="${value:1:${#value}-2}"
    fi
    printf '%s' "$value"
}

config_set_value() {
    local key="$1"
    local value="$2"
    printf -v "$key" '%s' "$value"
}

config_parse_line() {
    local line="$1"
    local key value

    line="${line%$'\r'}"
    line="$(config_trim "$line")"
    [ -z "$line" ] && return 0
    case "$line" in
        \#*) return 0 ;;
    esac
    case "$line" in
        *=*) ;;
        *)
            config_warn "Ignoring malformed config line"
            return 0
            ;;
    esac

    key="$(config_trim "${line%%=*}")"
    value="$(config_trim "${line#*=}")"

    if ! config_is_allowed_key "$key"; then
        config_warn "Ignoring unknown config key: $key"
        return 0
    fi

    value="$(config_unquote "$value")"
    config_set_value "$key" "$value"
}

config_normalize_bool() {
    local key="$1"
    local value="${!key}"
    case "$value" in
        true|TRUE|True|1|yes|YES|Yes|y|Y|on|ON|On)
            config_set_value "$key" "true"
            return 0
            ;;
        false|FALSE|False|0|no|NO|No|n|N|off|OFF|Off)
            config_set_value "$key" "false"
            return 0
            ;;
        *)
            config_warn "Invalid boolean for $key; using default"
            return 1
            ;;
    esac
}

config_validate_uint() {
    local key="$1"
    local default="$2"
    local min="$3"
    local max="$4"
    local value="${!key}"

    if ! [[ "$value" =~ ^[0-9]+$ ]]; then
        config_warn "Invalid numeric value for $key; using default"
        config_set_value "$key" "$default"
        return 1
    fi
    if [ "$value" -lt "$min" ] || [ "$value" -gt "$max" ]; then
        config_warn "Out-of-range value for $key; using default"
        config_set_value "$key" "$default"
        return 1
    fi
    return 0
}

config_validate_auto_or_uint() {
    local key="$1"
    local default="$2"
    local min="$3"
    local max="$4"
    local value="${!key}"

    if [ "$value" = "auto" ]; then
        return 0
    fi
    if ! [[ "$value" =~ ^[0-9]+$ ]]; then
        config_warn "Invalid numeric/auto value for $key; using default"
        config_set_value "$key" "$default"
        return 1
    fi
    if [ "$value" -lt "$min" ] || [ "$value" -gt "$max" ]; then
        config_warn "Out-of-range value for $key; using default"
        config_set_value "$key" "$default"
        return 1
    fi
    return 0
}

config_validate_package() {
    if [[ "$ROBLOX_PACKAGE" =~ ^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$ ]]; then
        return 0
    fi
    config_warn "Invalid ROBLOX_PACKAGE; using default"
    ROBLOX_PACKAGE="com.roblox.client"
    return 1
}

config_validate_license_mode() {
    case "$LICENSE_MODE" in
        disabled|optional|required)
            return 0
            ;;
        DISABLED|Disabled)
            LICENSE_MODE="disabled"
            return 0
            ;;
        OPTIONAL|Optional)
            LICENSE_MODE="optional"
            return 0
            ;;
        REQUIRED|Required)
            LICENSE_MODE="required"
            return 0
            ;;
        *)
            config_warn "Invalid LICENSE_MODE; using optional"
            LICENSE_MODE="optional"
            return 1
            ;;
    esac
}

config_validate() {
    local status=0

    config_validate_uint PLACE_ID 97598239454123 1 999999999999999999 || status=1
    config_validate_package || status=1
    config_validate_uint CHECK_INTERVAL 30 1 86400 || status=1
    config_validate_uint AUTO_RESTART_PERIOD 7200 0 31536000 || status=1
    config_normalize_bool ANTI_AFK || { ANTI_AFK="true"; status=1; }
    config_validate_uint AFK_TAP_INTERVAL 180 1 86400 || status=1
    config_validate_uint TAP_X 540 0 100000 || status=1
    config_validate_uint TAP_Y 960 0 100000 || status=1
    config_normalize_bool FREEFORM_LAYOUT || { FREEFORM_LAYOUT="false"; status=1; }
    config_validate_auto_or_uint FREEFORM_WIDTH auto 1 100000 || status=1
    config_validate_auto_or_uint FREEFORM_HEIGHT auto 1 100000 || status=1
    config_validate_auto_or_uint FREEFORM_OFFSET_X auto 0 100000 || status=1
    config_validate_auto_or_uint FREEFORM_OFFSET_Y auto 0 100000 || status=1
    config_validate_license_mode || status=1
    config_normalize_bool JOIN_LOW_SERVER || { JOIN_LOW_SERVER="false"; status=1; }
    config_validate_uint LOW_SERVER_MIN_PLAYERS 1 0 1000 || status=1
    config_validate_uint LOW_SERVER_MAX_PLAYERS 0 0 1000 || status=1

    return "$status"
}

config_load() {
    local file="$1"
    local line status=0

    CONFIG_WARNINGS=""
    config_init_defaults

    if [ ! -f "$file" ]; then
        return 0
    fi

    while IFS= read -r line || [ -n "$line" ]; do
        config_parse_line "$line"
    done < "$file"

    config_validate || status=1
    return "$status"
}

config_backup() {
    local file="$1"
    local backup
    [ -f "$file" ] || return 0
    backup="${file}.backup.$(date '+%Y%m%d%H%M%S')"
    cp -p "$file" "$backup"
}

config_escape_value() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//\$/\\\$}"
    value="${value//\`/\\\`}"
    printf '%s' "$value"
}

config_write_quoted() {
    local key="$1"
    local value="${!key}"
    printf '%s="%s"\n' "$key" "$(config_escape_value "$value")"
}

config_write_raw() {
    local key="$1"
    local value="${!key}"
    printf '%s=%s\n' "$key" "$value"
}

config_save() {
    local file="$1"
    local dir tmp

    dir="$(dirname "$file")"
    [ -d "$dir" ] || mkdir -p "$dir"
    tmp="${file}.tmp.$$"

    config_validate || return 1

    {
        config_write_quoted PLACE_ID
        config_write_quoted PRIVATE_CODE
        config_write_quoted ROBLOX_PACKAGE
        config_write_raw CHECK_INTERVAL
        config_write_raw AUTO_RESTART_PERIOD
        config_write_raw ANTI_AFK
        config_write_raw AFK_TAP_INTERVAL
        config_write_raw TAP_X
        config_write_raw TAP_Y
        config_write_quoted DISCORD_WEBHOOK
        config_write_quoted ROBLOX_USERNAME
        config_write_quoted PROFILE
        config_write_quoted FREEFORM_LAYOUT
        config_write_raw FREEFORM_WIDTH
        config_write_raw FREEFORM_HEIGHT
        config_write_raw FREEFORM_OFFSET_X
        config_write_raw FREEFORM_OFFSET_Y
        config_write_raw LICENSE_MODE
        config_write_raw JOIN_LOW_SERVER
        config_write_raw LOW_SERVER_MIN_PLAYERS
        config_write_raw LOW_SERVER_MAX_PLAYERS
    } > "$tmp" || {
        rm -f "$tmp"
        return 1
    }

    mv "$tmp" "$file"
}

config_migrate() {
    local file="$1"
    local before after

    [ -f "$file" ] || return 0
    before="$(mktemp 2>/dev/null || printf '%s' "${file}.before.$$")"
    after="$(mktemp 2>/dev/null || printf '%s' "${file}.after.$$")"

    config_load "$file" || true
    config_save "$after" || {
        rm -f "$before" "$after"
        return 1
    }
    cp "$file" "$before" || {
        rm -f "$before" "$after"
        return 1
    }
    if cmp -s "$before" "$after"; then
        rm -f "$before" "$after"
        return 0
    fi

    config_backup "$file" || {
        rm -f "$before" "$after"
        return 1
    }
    mv "$after" "$file" || {
        rm -f "$before" "$after"
        return 1
    }
    rm -f "$before"
}
