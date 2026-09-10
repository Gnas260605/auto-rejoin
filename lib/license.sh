#!/usr/bin/env bash

# License client foundation for Auto Rejoin Pro.
# Server is authoritative; this module stores only installation identity,
# opaque client token/cache, and entitlement metadata.

LICENSE_MODE="${AUTO_REJOIN_LICENSE_MODE:-${LICENSE_MODE:-optional}}"
LICENSE_API="${AUTO_REJOIN_LICENSE_API:-}"
LICENSE_ALLOW_HTTP_DEV="${AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV:-false}"
LICENSE_APP_DIR="${AUTO_REJOIN_APP_DIR:-${HOME:-.}/.auto-rejoin}"
LICENSE_INSTALLATION_ID_FILE="${LICENSE_INSTALLATION_ID_FILE:-${LICENSE_APP_DIR}/installation_id}"
LICENSE_CACHE_FILE="${LICENSE_CACHE_FILE:-${LICENSE_APP_DIR}/license_cache.json}"
LICENSE_OFFLINE_GRACE_SECONDS="${LICENSE_OFFLINE_GRACE_SECONDS:-86400}"

LICENSE_STATUS="NOT_ACTIVATED"
LICENSE_ID=""
LICENSE_PLAN="free"
LICENSE_EXPIRES_AT=""
LICENSE_MAX_INSTANCES="1"
LICENSE_FEATURES=""
LICENSE_TOKEN=""
LICENSE_LAST_VALIDATED_AT="0"
LICENSE_REVALIDATE_AFTER="3600"
LICENSE_SERVER_TIME=""
LICENSE_ERROR_CODE=""
LICENSE_ERROR_MESSAGE=""
LICENSE_MAINTENANCE_ENABLED="false"
LICENSE_MAINTENANCE_ALLOW_CACHE="false"
LICENSE_MAINTENANCE_MESSAGE=""

license_now_epoch() {
    date +%s
}

license_now_iso() {
    date -u '+%Y-%m-%dT%H:%M:%SZ'
}

license_ensure_app_dir() {
    mkdir -p "$LICENSE_APP_DIR" || return 1
    chmod 700 "$LICENSE_APP_DIR" 2>/dev/null || true
}

license_generate_uuid() {
    if command -v uuidgen >/dev/null 2>&1; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    elif [ -r /proc/sys/kernel/random/uuid ]; then
        tr '[:upper:]' '[:lower:]' < /proc/sys/kernel/random/uuid
    else
        local raw
        raw="$(od -An -N16 -tx1 /dev/urandom 2>/dev/null | tr -d ' \n')"
        printf '%s-%s-%s-%s-%s\n' "${raw:0:8}" "${raw:8:4}" "${raw:12:4}" "${raw:16:4}" "${raw:20:12}"
    fi
}

license_validate_installation_id() {
    [[ "$1" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]
}

license_create_installation_id() {
    local id
    license_ensure_app_dir || return 1
    id="$(license_generate_uuid)"
    license_validate_installation_id "$id" || return 1
    printf '%s\n' "$id" > "$LICENSE_INSTALLATION_ID_FILE" || return 1
    chmod 600 "$LICENSE_INSTALLATION_ID_FILE" 2>/dev/null || true
    printf '%s\n' "$id"
}

license_get_installation_id() {
    local id backup
    if [ -f "$LICENSE_INSTALLATION_ID_FILE" ]; then
        id="$(tr -d '\r\n' < "$LICENSE_INSTALLATION_ID_FILE")"
        if license_validate_installation_id "$id"; then
            printf '%s\n' "$id"
            return 0
        fi
        backup="${LICENSE_INSTALLATION_ID_FILE}.corrupt.$(date '+%Y%m%d%H%M%S')"
        mv "$LICENSE_INSTALLATION_ID_FILE" "$backup" 2>/dev/null || true
    fi
    license_create_installation_id
}

license_normalize_key() {
    local key="$1"
    key="${key#"${key%%[!$' \t\r\n']*}"}"
    key="${key%"${key##*[!$' \t\r\n']}"}"
    key="$(printf '%s' "$key" | tr '[:lower:]' '[:upper:]')"
    printf '%s\n' "$key"
}

license_validate_key_format() {
    local key="$1"
    [[ "$key" =~ ^AR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$|^VALID$|^EXPIRED$|^REVOKED$|^DEVICE_LIMIT$ ]]
}

license_mask_key() {
    local key="$1"
    key="$(license_normalize_key "$key")"
    if [ "${#key}" -le 10 ]; then
        printf '%s\n' "${key:0:2}-****"
    else
        printf '%s****%s\n' "${key:0:8}" "${key: -4}"
    fi
}

license_require_jq() {
    command -v jq >/dev/null 2>&1 || {
        LICENSE_ERROR_CODE="MISSING_JQ"
        LICENSE_ERROR_MESSAGE="jq is required for license JSON parsing"
        echo "Error: jq is required for license JSON parsing" >&2
        return 1
    }
}

license_validate_api_url() {
    local url="$1"
    [ -n "$url" ] || { echo "Error: AUTO_REJOIN_LICENSE_API is not configured" >&2; return 2; }
    case "$url" in
        https://*) return 0 ;;
        http://*)
            if [ "$LICENSE_ALLOW_HTTP_DEV" = "true" ]; then
                return 0
            fi
            echo "Error: license API must use HTTPS unless AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV=true" >&2
            return 2
            ;;
        *) echo "Error: unsupported license API URL scheme" >&2; return 2 ;;
    esac
}

license_api_endpoint() {
    local path="$1"
    printf '%s%s\n' "${LICENSE_API%/}" "$path"
}

license_client_version() {
    local project_dir="${1:-$(pwd)}"
    if [ -f "${project_dir}/VERSION" ]; then
        tr -d '\r\n' < "${project_dir}/VERSION"
    else
        printf '0.0.0-dev'
    fi
}

license_device_json() {
    local executor="${1:-unknown}"
    jq -n --arg platform "android" --arg executor "$executor" '{platform:$platform, executor:$executor}'
}

license_post_json() {
    local endpoint="$1"
    local payload="$2"
    local response

    response="$(network_post_json "$endpoint" "$payload" 20 1 2>&1)" || {
        LICENSE_ERROR_CODE="NETWORK_ERROR"
        LICENSE_ERROR_MESSAGE="network request failed"
        echo "Error: license network request failed" >&2
        return 3
    }
    printf '%s\n' "$response"
}

license_parse_error_response() {
    local response="$1"
    LICENSE_ERROR_CODE="$(printf '%s' "$response" | jq -r '.code // .error.code // "SERVER_ERROR"')"
    LICENSE_ERROR_MESSAGE="$(printf '%s' "$response" | jq -r '.message // .error.message // .error // "License request failed"')"
    case "$LICENSE_ERROR_CODE" in
        INVALID_KEY) echo "Error: license key is invalid" >&2 ;;
        EXPIRED) echo "Error: license is expired" >&2 ;;
        REVOKED) echo "Error: license is revoked" >&2 ;;
        DEVICE_LIMIT) echo "Error: license device limit reached" >&2 ;;
        *) echo "Error: $LICENSE_ERROR_MESSAGE" >&2 ;;
    esac
}

license_parse_success_response() {
    local response="$1"
    local valid parsed_token

    valid="$(printf '%s' "$response" | jq -r '.valid // false')" || return 1
    if [ "$valid" != "true" ]; then
        license_parse_error_response "$response"
        return 1
    fi

    LICENSE_STATUS="VALID"
    LICENSE_ID="$(printf '%s' "$response" | jq -r '.licenseId // ""')"
    LICENSE_PLAN="$(printf '%s' "$response" | jq -r '.plan // "free"')"
    LICENSE_EXPIRES_AT="$(printf '%s' "$response" | jq -r '.expiresAt // ""')"
    LICENSE_MAX_INSTANCES="$(printf '%s' "$response" | jq -r '.maxInstances // 1')"
    LICENSE_FEATURES="$(printf '%s' "$response" | jq -r '.features // [] | join(",")')"
    parsed_token="$(printf '%s' "$response" | jq -r '.token // ""')"
    [ -n "$parsed_token" ] && LICENSE_TOKEN="$parsed_token"
    LICENSE_REVALIDATE_AFTER="$(printf '%s' "$response" | jq -r '.revalidateAfter // 3600')"
    LICENSE_SERVER_TIME="$(printf '%s' "$response" | jq -r '.serverTime // ""')"
    LICENSE_MAINTENANCE_ENABLED="$(printf '%s' "$response" | jq -r '.maintenance.enabled // false')"
    LICENSE_MAINTENANCE_ALLOW_CACHE="$(printf '%s' "$response" | jq -r '.maintenance.allowCachedEntitlements // false')"
    LICENSE_MAINTENANCE_MESSAGE="$(printf '%s' "$response" | jq -r '.maintenance.message // ""')"
    LICENSE_LAST_VALIDATED_AT="$(license_now_epoch)"
}

license_save_cache() {
    license_require_jq || return 1
    license_ensure_app_dir || return 1
    jq -n \
        --arg status "$LICENSE_STATUS" \
        --arg licenseId "$LICENSE_ID" \
        --arg plan "$LICENSE_PLAN" \
        --arg expiresAt "$LICENSE_EXPIRES_AT" \
        --arg features "$LICENSE_FEATURES" \
        --arg token "$LICENSE_TOKEN" \
        --arg serverTime "$LICENSE_SERVER_TIME" \
        --arg maintenanceEnabled "$LICENSE_MAINTENANCE_ENABLED" \
        --arg maintenanceAllowCache "$LICENSE_MAINTENANCE_ALLOW_CACHE" \
        --arg maintenanceMessage "$LICENSE_MAINTENANCE_MESSAGE" \
        --arg lastValidatedAt "$LICENSE_LAST_VALIDATED_AT" \
        --arg revalidateAfter "$LICENSE_REVALIDATE_AFTER" \
        --arg maxInstances "$LICENSE_MAX_INSTANCES" \
        '{
            status:$status,
            licenseId:$licenseId,
            plan:$plan,
            expiresAt:$expiresAt,
            maxInstances:($maxInstances|tonumber? // 1),
            features:($features|split(",")|map(select(length > 0))),
            token:$token,
            serverTime:$serverTime,
            maintenance:{
                enabled:($maintenanceEnabled == "true"),
                allowCachedEntitlements:($maintenanceAllowCache == "true"),
                message:$maintenanceMessage
            },
            lastValidatedAt:($lastValidatedAt|tonumber? // 0),
            revalidateAfter:($revalidateAfter|tonumber? // 3600)
        }' > "$LICENSE_CACHE_FILE" || return 1
    chmod 600 "$LICENSE_CACHE_FILE" 2>/dev/null || true
}

license_load_cache() {
    [ -f "$LICENSE_CACHE_FILE" ] || return 1
    license_require_jq || return 1
    jq empty "$LICENSE_CACHE_FILE" >/dev/null 2>&1 || {
        LICENSE_STATUS="MALFORMED_CACHE"
        return 1
    }
    LICENSE_STATUS="$(jq -r '.status // "NOT_ACTIVATED"' "$LICENSE_CACHE_FILE")"
    LICENSE_ID="$(jq -r '.licenseId // ""' "$LICENSE_CACHE_FILE")"
    LICENSE_PLAN="$(jq -r '.plan // "free"' "$LICENSE_CACHE_FILE")"
    LICENSE_EXPIRES_AT="$(jq -r '.expiresAt // ""' "$LICENSE_CACHE_FILE")"
    LICENSE_MAX_INSTANCES="$(jq -r '.maxInstances // 1' "$LICENSE_CACHE_FILE")"
    LICENSE_FEATURES="$(jq -r '.features // [] | join(",")' "$LICENSE_CACHE_FILE")"
    LICENSE_TOKEN="$(jq -r '.token // ""' "$LICENSE_CACHE_FILE")"
    LICENSE_SERVER_TIME="$(jq -r '.serverTime // ""' "$LICENSE_CACHE_FILE")"
    LICENSE_MAINTENANCE_ENABLED="$(jq -r '.maintenance.enabled // false' "$LICENSE_CACHE_FILE")"
    LICENSE_MAINTENANCE_ALLOW_CACHE="$(jq -r '.maintenance.allowCachedEntitlements // false' "$LICENSE_CACHE_FILE")"
    LICENSE_MAINTENANCE_MESSAGE="$(jq -r '.maintenance.message // ""' "$LICENSE_CACHE_FILE")"
    LICENSE_LAST_VALIDATED_AT="$(jq -r '.lastValidatedAt // 0' "$LICENSE_CACHE_FILE")"
    LICENSE_REVALIDATE_AFTER="$(jq -r '.revalidateAfter // 3600' "$LICENSE_CACHE_FILE")"
}

license_clear_cache() {
    rm -f "$LICENSE_CACHE_FILE"
    LICENSE_STATUS="NOT_ACTIVATED"
    LICENSE_ID=""
    LICENSE_TOKEN=""
    LICENSE_PLAN="free"
    LICENSE_FEATURES=""
    LICENSE_MAX_INSTANCES="1"
    LICENSE_MAINTENANCE_ENABLED="false"
    LICENSE_MAINTENANCE_ALLOW_CACHE="false"
    LICENSE_MAINTENANCE_MESSAGE=""
}

license_activate() {
    local key="$1"
    local project_dir="${2:-$(pwd)}"
    local normalized masked installation_id version executor payload response

    license_require_jq || return 1
    license_validate_api_url "$LICENSE_API" || return $?
    normalized="$(license_normalize_key "$key")"
    license_validate_key_format "$normalized" || { echo "Error: license key format is invalid" >&2; return 2; }
    masked="$(license_mask_key "$normalized")"
    installation_id="$(license_get_installation_id)" || return 1
    version="$(license_client_version "$project_dir")"
    executor="unknown"
    declare -F android_detect_executor >/dev/null 2>&1 && executor="$(android_detect_executor)"
    payload="$(jq -n \
        --arg licenseKey "$normalized" \
        --arg installationId "$installation_id" \
        --arg clientVersion "$version" \
        --argjson device "$(license_device_json "$executor")" \
        '{licenseKey:$licenseKey, installationId:$installationId, clientVersion:$clientVersion, device:$device}')"
    response="$(license_post_json "$(license_api_endpoint /api/v1/licenses/activate)" "$payload")" || return $?
    license_parse_success_response "$response" || return 1
    license_save_cache || return 1
    printf 'License : %s\n' "$masked"
    printf 'Plan    : %s\n' "$LICENSE_PLAN"
    printf 'Expires : %s\n' "$LICENSE_EXPIRES_AT"
    printf 'Status  : Activation successful\n'
}

license_validate() {
    local project_dir="${1:-$(pwd)}"
    local installation_id version payload response

    license_require_jq || return 1
    license_validate_api_url "$LICENSE_API" || return $?
    license_load_cache || { echo "Error: no local license cache; activate first" >&2; return 1; }
    [ -n "$LICENSE_TOKEN" ] || { echo "Error: no client token in license cache; activate again" >&2; return 1; }
    installation_id="$(license_get_installation_id)" || return 1
    version="$(license_client_version "$project_dir")"
    payload="$(jq -n \
        --arg installationId "$installation_id" \
        --arg clientVersion "$version" \
        --arg token "$LICENSE_TOKEN" \
        '{installationId:$installationId, clientVersion:$clientVersion, token:$token}')"
    response="$(license_post_json "$(license_api_endpoint /api/v1/licenses/validate)" "$payload")" || return $?
    if ! license_parse_success_response "$response"; then
        case "$LICENSE_ERROR_CODE" in
            REVOKED|EXPIRED|SUSPENDED|INVALID_TOKEN|TOKEN_EXPIRED|INSTALLATION_MISMATCH)
                LICENSE_STATUS="$LICENSE_ERROR_CODE"
                LICENSE_TOKEN=""
                license_save_cache >/dev/null 2>&1 || true
                ;;
        esac
        return 1
    fi
    license_save_cache || return 1
    printf 'License validation successful\n'
}

license_deactivate() {
    local local_only="${1:-false}"
    local installation_id payload response

    license_require_jq || return 1
    if [ "$local_only" = "true" ]; then
        license_clear_cache
        printf 'Local license cache cleared. Server device slot was not released.\n'
        return 0
    fi
    license_validate_api_url "$LICENSE_API" || return $?
    license_load_cache || { echo "Error: no local license cache to deactivate" >&2; return 1; }
    [ -n "$LICENSE_TOKEN" ] || { echo "Error: no client token in license cache" >&2; return 1; }
    installation_id="$(license_get_installation_id)" || return 1
    payload="$(jq -n --arg installationId "$installation_id" --arg token "$LICENSE_TOKEN" '{installationId:$installationId, token:$token}')"
    response="$(license_post_json "$(license_api_endpoint /api/v1/licenses/deactivate)" "$payload")" || return $?
    if [ "$(printf '%s' "$response" | jq -r '.deactivated // .valid // false')" != "true" ]; then
        license_parse_error_response "$response"
        return 1
    fi
    license_clear_cache
    printf 'License deactivated and local cache cleared\n'
}

license_is_valid() {
    license_load_cache >/dev/null 2>&1 || return 1
    [ "$LICENSE_STATUS" = "VALID" ]
}

license_get_plan() {
    license_load_cache >/dev/null 2>&1 || true
    printf '%s\n' "${LICENSE_PLAN:-free}"
}

license_get_expiry() {
    license_load_cache >/dev/null 2>&1 || true
    printf '%s\n' "${LICENSE_EXPIRES_AT:-}"
}

license_get_max_instances() {
    license_load_cache >/dev/null 2>&1 || true
    printf '%s\n' "${LICENSE_MAX_INSTANCES:-1}"
}

license_has_feature() {
    local feature="$1"
    local item
    license_load_cache >/dev/null 2>&1 || return 1
    IFS=',' read -r -a LICENSE_FEATURE_ARRAY <<< "$LICENSE_FEATURES"
    for item in "${LICENSE_FEATURE_ARRAY[@]}"; do
        [ "$item" = "$feature" ] && return 0
    done
    return 1
}

license_should_revalidate() {
    local now elapsed
    license_load_cache >/dev/null 2>&1 || return 0
    now="$(license_now_epoch)"
    elapsed=$((now - LICENSE_LAST_VALIDATED_AT))
    [ "$elapsed" -lt 0 ] && return 0
    [ "$elapsed" -ge "${LICENSE_REVALIDATE_AFTER:-3600}" ]
}

license_offline_grace_valid() {
    local now elapsed
    license_load_cache >/dev/null 2>&1 || return 1
    [ "$LICENSE_STATUS" = "VALID" ] || return 1
    now="$(license_now_epoch)"
    elapsed=$((now - LICENSE_LAST_VALIDATED_AT))
    [ "$elapsed" -ge 0 ] || return 1
    [ "$elapsed" -le "$LICENSE_OFFLINE_GRACE_SECONDS" ]
}

license_status() {
    printf 'License Status: '
    if license_load_cache >/dev/null 2>&1; then
        printf '%s\n' "$LICENSE_STATUS"
        printf 'License Mode  : %s\n' "$LICENSE_MODE"
        printf 'Plan          : %s\n' "$LICENSE_PLAN"
        printf 'Expires       : %s\n' "${LICENSE_EXPIRES_AT:-unknown}"
        printf 'Max Instances : %s\n' "$LICENSE_MAX_INSTANCES"
        printf 'Features      : %s\n' "${LICENSE_FEATURES:-none}"
        printf 'Last Validate : %s\n' "${LICENSE_LAST_VALIDATED_AT:-0}"
        if [ "${LICENSE_MAINTENANCE_ENABLED:-false}" = "true" ]; then
            printf 'Maintenance   : enabled'
            [ -n "$LICENSE_MAINTENANCE_MESSAGE" ] && printf ' - %s' "$LICENSE_MAINTENANCE_MESSAGE"
            printf '\n'
        fi
        printf 'Offline Grace : '
        if license_offline_grace_valid; then
            printf 'available\n'
        else
            printf 'not available\n'
        fi
    else
        printf 'NOT_ACTIVATED\n'
        printf 'License Mode  : %s\n' "$LICENSE_MODE"
    fi
}
