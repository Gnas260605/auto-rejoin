#!/usr/bin/env bash

# Minimal setup wizard helpers for roblox-manager.

ui_default_config_file() {
    local project_dir="$1"
    printf '%s/config.env\n' "$project_dir"
}

ui_detect_roblox_packages() {
    if declare -F android_list_packages >/dev/null 2>&1; then
        android_list_packages 2>/dev/null | grep -i 'roblox' | cut -d: -f2 | tr -d '\r' | sort -u || true
    fi
}

ui_apply_link_to_config_values() {
    local link="$1"

    if ! roblox_parse_link "$link"; then
        echo "Error: invalid Roblox link: ${ROBLOX_PARSE_ERROR:-parse failed}" >&2
        return 1
    fi

    case "$ROBLOX_LINK_TYPE" in
        game)
            PLACE_ID="$ROBLOX_PARSED_PLACE_ID"
            PRIVATE_CODE=""
            ;;
        private_server)
            PRIVATE_CODE="$ROBLOX_PARSED_PRIVATE_CODE"
            ;;
        *)
            echo "Error: unsupported Roblox link type: $ROBLOX_LINK_TYPE" >&2
            return 1
            ;;
    esac
}

ui_setup_save() {
    local config_file="$1"
    local link="$2"
    local package="$3"
    local webhook="$4"
    local anti_afk="$5"
    local join_low_server="${6:-false}"

    config_init_defaults
    ui_apply_link_to_config_values "$link" || return 1

    if [ -n "$package" ]; then
        ROBLOX_PACKAGE="$package"
    fi
    DISCORD_WEBHOOK="$webhook"
    ANTI_AFK="$anti_afk"
    JOIN_LOW_SERVER="$join_low_server"

    if [ -f "$config_file" ]; then
        config_backup "$config_file" || return 1
    fi
    config_save "$config_file"
}

ui_prompt() {
    local prompt="$1"
    local default="${2:-}"
    local value

    if [ -n "$default" ]; then
        printf '%s [%s]: ' "$prompt" "$default" >&2
    else
        printf '%s: ' "$prompt" >&2
    fi
    IFS= read -r value
    if [ -z "$value" ]; then
        value="$default"
    fi
    printf '%s' "$value"
}

ui_setup_wizard() {
    local project_dir="$1"
    local config_file="${2:-$(ui_default_config_file "$project_dir")}"
    local link="${3:-}"
    local package="${4:-}"
    local webhook="${5:-}"
    local anti_afk="${6:-true}"
    local join_low_server="${7:-false}"
    local packages first_package

    if [ -z "$link" ]; then
        link="$(ui_prompt 'Paste Roblox game/private server link or Place ID')"
    fi

    packages="$(ui_detect_roblox_packages)"
    first_package="$(printf '%s\n' "$packages" | sed '/^$/d' | head -1)"
    if [ -z "$first_package" ] && declare -F installer_install_roblox >/dev/null 2>&1; then
        local apk_url
        printf 'Roblox package was not detected.\n' >&2
        apk_url="$(ui_prompt 'Paste HTTPS Roblox APK URL to install, or 0 to skip' '0')"
        if [ "$apk_url" != "0" ]; then
            installer_install_roblox "$apk_url" "com.roblox.client" "" "${UI_INSTALL_DRY_RUN:-false}" "${INSTALLER_MAX_APK_SIZE_MB:-500}" "$project_dir" false false true false || return 1
            first_package="com.roblox.client"
        fi
    fi
    if [ -z "$package" ]; then
        package="$(ui_prompt 'Roblox package' "${first_package:-com.roblox.client}")"
    fi
    if [ -z "$webhook" ]; then
        webhook="$(ui_prompt 'Discord webhook (optional)' '')"
    fi
    anti_afk="$(ui_prompt 'Enable anti-AFK? true/false' "$anti_afk")"
    join_low_server="$(ui_prompt 'Auto join low-player server? true/false' "$join_low_server")"

    ui_setup_save "$config_file" "$link" "$package" "$webhook" "$anti_afk" "$join_low_server" || return 1
    printf 'Config saved: %s\n' "$config_file"
}
