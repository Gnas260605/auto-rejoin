#!/usr/bin/env bash

# Profile management for reusable Roblox monitor settings.

profile_validate_name() {
    local name="$1"
    [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$ ]] || return 1
}

profile_dir() {
    local project_dir="$1"
    printf '%s/config/profiles\n' "$project_dir"
}

profile_file() {
    local project_dir="$1"
    local name="$2"
    profile_validate_name "$name" || return 1
    printf '%s/%s.conf\n' "$(profile_dir "$project_dir")" "$name"
}

profile_target_file() {
    local project_dir="$1"
    local target="$2"
    profile_validate_name "$target" || return 1
    printf '%s/config_%s.cfg\n' "$project_dir" "$target"
}

profile_list() {
    local project_dir="$1"
    local dir

    dir="$(profile_dir "$project_dir")"
    [ -d "$dir" ] || return 0
    find "$dir" -maxdepth 1 -type f -name '*.conf' -print 2>/dev/null |
        sed 's#^.*/##; s#\.conf$##' |
        sort
}

profile_create() {
    local project_dir="$1"
    local name="$2"
    local link="$3"
    local package="${4:-com.roblox.client}"
    local config_path

    profile_validate_name "$name" || {
        echo "Error: invalid profile name" >&2
        return 2
    }
    [ -n "$link" ] || {
        echo "Error: profile create requires a Roblox link or Place ID" >&2
        return 2
    }

    config_path="$(profile_file "$project_dir" "$name")" || return 2
    mkdir -p "$(dirname "$config_path")" || return 1

    ui_setup_save "$config_path" "$link" "$package" "${DISCORD_WEBHOOK:-}" "${ANTI_AFK:-true}" || return 1
    config_load "$config_path" || true
    PROFILE="$name"
    config_save "$config_path"
}

profile_show() {
    local project_dir="$1"
    local name="$2"
    local config_path line

    config_path="$(profile_file "$project_dir" "$name")" || {
        echo "Error: invalid profile name" >&2
        return 2
    }
    [ -f "$config_path" ] || {
        echo "Error: profile not found: $name" >&2
        return 1
    }

    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            DISCORD_WEBHOOK=*) printf 'DISCORD_WEBHOOK="***"\n' ;;
            *ROBLOSECURITY*|*PASSWORD*|*COOKIE*) ;;
            *) printf '%s\n' "$line" ;;
        esac
    done < "$config_path"
}

profile_apply() {
    local project_dir="$1"
    local name="$2"
    local target="$3"
    local package="${4:-}"
    local profile_path target_path

    profile_path="$(profile_file "$project_dir" "$name")" || {
        echo "Error: invalid profile name" >&2
        return 2
    }
    [ -f "$profile_path" ] || {
        echo "Error: profile not found: $name" >&2
        return 1
    }
    profile_validate_name "$target" || {
        echo "Error: invalid target name" >&2
        return 2
    }

    target_path="$(profile_target_file "$project_dir" "$target")" || return 2
    config_load "$profile_path" || true
    PROFILE="$name"
    if [ -n "$package" ]; then
        ROBLOX_PACKAGE="$package"
    elif [[ "$target" == *.* ]]; then
        ROBLOX_PACKAGE="$target"
    fi

    if [ -f "$target_path" ]; then
        config_backup "$target_path" || return 1
    fi
    config_save "$target_path"
}
