#!/usr/bin/env bash

# Signed release updater for Auto Rejoin Pro.

UPDATE_CHANNEL="${AUTO_REJOIN_UPDATE_CHANNEL:-stable}"
UPDATE_MANIFEST_URL="${AUTO_REJOIN_UPDATE_MANIFEST_URL:-}"
UPDATE_SIGNATURE_URL="${AUTO_REJOIN_UPDATE_SIGNATURE_URL:-}"
UPDATE_ALLOW_HTTP_DEV="${AUTO_REJOIN_UPDATE_ALLOW_HTTP_DEV:-false}"
UPDATE_PUBLIC_KEY_FILE="${AUTO_REJOIN_UPDATE_PUBLIC_KEY_FILE:-}"
UPDATE_MAX_SIZE_MB="${AUTO_REJOIN_MAX_UPDATE_SIZE_MB:-50}"
UPDATE_KEEP_BACKUPS="${AUTO_REJOIN_UPDATE_KEEP_BACKUPS:-2}"

UPDATE_PROJECT_DIR=""
UPDATE_WORK_DIR=""
UPDATE_STAGING_DIR=""
UPDATE_BACKUP_DIR=""
UPDATE_ARTIFACT_FILE=""
UPDATE_MANIFEST_FILE=""
UPDATE_SIGNATURE_FILE=""
UPDATE_LATEST_VERSION=""
UPDATE_CURRENT_VERSION=""
UPDATE_AVAILABLE="false"
UPDATE_MANDATORY="false"
UPDATE_MINIMUM_VERSION=""
UPDATE_NOTES_URL=""
UPDATE_ARTIFACT_URL=""
UPDATE_ARTIFACT_SHA256=""
UPDATE_ARTIFACT_SIZE=""
UPDATE_LOCK_PATH=""
UPDATE_LOCK_METHOD=""
UPDATE_LOCK_FD=""

updater_log() {
    local level="$1"
    local event="$2"
    local log_file="${LOG_FILE:-}"
    shift 2 || true
    if declare -F log_event >/dev/null 2>&1; then
        log_event "$level" "$event" "$log_file" "$@"
    fi
}

updater_error() {
    printf 'Error: %s\n' "$1" >&2
    updater_log ERROR update_failed reason "$1"
}

updater_read_version() {
    local project_dir="$1"
    local version_file="${project_dir}/VERSION"
    [ -f "$version_file" ] || return 1
    tr -d '\r\n' < "$version_file"
}

updater_normalize_version() {
    local version="$1"
    local base pre
    case "$version" in
        *-*) base="${version%%-*}"; pre="${version#*-}" ;;
        *) base="$version"; pre="" ;;
    esac
    IFS=. read -r major minor patch extra <<EOF
$base
EOF
    [ -z "${extra:-}" ] || return 1
    [[ "${major:-}" =~ ^[0-9]+$ ]] || return 1
    [[ "${minor:-0}" =~ ^[0-9]+$ ]] || return 1
    [[ "${patch:-0}" =~ ^[0-9]+$ ]] || return 1
    case "$pre" in
        ""|dev|alpha|beta|rc|alpha.*|beta.*|rc.*) ;;
        *) return 1 ;;
    esac
    printf '%s %s %s %s\n' "$major" "${minor:-0}" "${patch:-0}" "$pre"
}

updater_compare_versions() {
    local left="$1"
    local right="$2"
    local lmajor lminor lpatch lpre rmajor rminor rpatch rpre

    read -r lmajor lminor lpatch lpre <<EOF
$(updater_normalize_version "$left")
EOF
    read -r rmajor rminor rpatch rpre <<EOF
$(updater_normalize_version "$right")
EOF

    if [ "$lmajor" -gt "$rmajor" ]; then printf '1\n'; return 0; fi
    if [ "$lmajor" -lt "$rmajor" ]; then printf -- '-1\n'; return 0; fi
    if [ "$lminor" -gt "$rminor" ]; then printf '1\n'; return 0; fi
    if [ "$lminor" -lt "$rminor" ]; then printf -- '-1\n'; return 0; fi
    if [ "$lpatch" -gt "$rpatch" ]; then printf '1\n'; return 0; fi
    if [ "$lpatch" -lt "$rpatch" ]; then printf -- '-1\n'; return 0; fi
    if [ "$lpre" = "$rpre" ]; then printf '0\n'; return 0; fi
    [ -z "$lpre" ] && { printf '1\n'; return 0; }
    [ -z "$rpre" ] && { printf -- '-1\n'; return 0; }
    case "$lpre:$rpre" in
        dev:*) printf -- '-1\n' ;;
        *:dev) printf '1\n' ;;
        alpha*) case "$rpre" in alpha*) printf '0\n' ;; *) printf -- '-1\n' ;; esac ;;
        beta*) case "$rpre" in dev*|alpha*) printf '1\n' ;; beta*) printf '0\n' ;; *) printf -- '-1\n' ;; esac ;;
        rc*) case "$rpre" in rc*) printf '0\n' ;; *) printf '1\n' ;; esac ;;
        *) printf '0\n' ;;
    esac
}

updater_validate_url() {
    local url="$1"
    local purpose="${2:-URL}"
    [ -n "$url" ] || { updater_error "$purpose is required"; return 2; }
    case "$url" in
        https://*) ;;
        http://*)
            if [ "$UPDATE_ALLOW_HTTP_DEV" = "true" ]; then
                return 0
            fi
            updater_error "$purpose must use HTTPS"
            return 2
            ;;
        file://*)
            updater_error "$purpose must not use file://"
            return 2
            ;;
        *://*)
            updater_error "$purpose uses an unsupported scheme"
            return 2
            ;;
        *)
            updater_error "$purpose must use HTTPS"
            return 2
            ;;
    esac
    case "$url" in
        *$'\n'*|*$'\r'*|*' '*|*';'*|*'`'*|*'$('*|*'|'*|*'&'*)
            updater_error "$purpose contains unsupported characters"
            return 2
            ;;
    esac
}

updater_sha256() {
    local file="$1"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | awk '{print $1}'
    else
        updater_error "sha256sum or shasum is required"
        return 1
    fi
}

updater_file_size_bytes() {
    local file="$1"
    stat -c %s "$file" 2>/dev/null || wc -c < "$file" | tr -d ' '
}

updater_public_key_file() {
    local project_dir="$1"
    if [ -n "$UPDATE_PUBLIC_KEY_FILE" ]; then
        printf '%s\n' "$UPDATE_PUBLIC_KEY_FILE"
    else
        printf '%s\n' "${project_dir}/keys/update-public.pem"
    fi
}

updater_require_tools() {
    command -v jq >/dev/null 2>&1 || { updater_error "jq is required for update manifest parsing"; return 1; }
    command -v openssl >/dev/null 2>&1 || { updater_error "openssl is required for manifest signature verification"; return 1; }
    command -v tar >/dev/null 2>&1 || { updater_error "tar is required for release archives"; return 1; }
    command -v curl >/dev/null 2>&1 || { updater_error "curl is required for updates"; return 1; }
    command -v bash >/dev/null 2>&1 || { updater_error "bash is required for self-test"; return 1; }
}

updater_create_workspace() {
    local project_dir="$1"
    local parent="${project_dir}/tmp/update"
    mkdir -p "$parent" || return 1
    UPDATE_WORK_DIR="$(mktemp -d "${parent}/job.XXXXXX")" || return 1
    UPDATE_MANIFEST_FILE="${UPDATE_WORK_DIR}/release-manifest.json"
    UPDATE_SIGNATURE_FILE="${UPDATE_WORK_DIR}/release-manifest.sig"
    UPDATE_ARTIFACT_FILE="${UPDATE_WORK_DIR}/release.tar.gz"
    UPDATE_STAGING_DIR="${UPDATE_WORK_DIR}/staging"
    mkdir -p "$UPDATE_STAGING_DIR" || return 1
}

updater_cleanup() {
    if [ -n "$UPDATE_WORK_DIR" ]; then
        case "$UPDATE_WORK_DIR" in
            */tmp/update/job.*) rm -rf "$UPDATE_WORK_DIR" 2>/dev/null || true ;;
        esac
    fi
}

updater_lock_acquire() {
    local project_dir="$1"
    local locks_dir="${project_dir}/tmp/locks"
    mkdir -p "$locks_dir" || return 1
    if command -v flock >/dev/null 2>&1 && [ "${UPDATE_LOCK_USE_FLOCK:-true}" != "false" ]; then
        UPDATE_LOCK_PATH="${locks_dir}/update.lock"
        exec {UPDATE_LOCK_FD}>"$UPDATE_LOCK_PATH"
        if flock -n "$UPDATE_LOCK_FD" 2>/dev/null; then
            UPDATE_LOCK_METHOD="flock"
            printf 'pid=%s\nstarted_at=%s\n' "$$" "$(date +%s)" > "$UPDATE_LOCK_PATH"
            updater_log INFO update_lock_acquired path "$UPDATE_LOCK_PATH" method "$UPDATE_LOCK_METHOD"
            return 0
        fi
        updater_error "another update is already running"
        return 1
    fi

    UPDATE_LOCK_PATH="${locks_dir}/update.lockdir"
    if mkdir "$UPDATE_LOCK_PATH" 2>/dev/null; then
        UPDATE_LOCK_METHOD="mkdir"
        printf '%s\n' "$$" > "${UPDATE_LOCK_PATH}/pid"
        updater_log INFO update_lock_acquired path "$UPDATE_LOCK_PATH" method "$UPDATE_LOCK_METHOD"
        return 0
    fi
    updater_error "another update is already running"
    return 1
}

updater_lock_release() {
    [ -n "$UPDATE_LOCK_PATH" ] || return 0
    case "$UPDATE_LOCK_METHOD" in
        flock)
            if [ -n "$UPDATE_LOCK_FD" ]; then
                flock -u "$UPDATE_LOCK_FD" 2>/dev/null || true
                exec {UPDATE_LOCK_FD}>&-
            fi
            ;;
        mkdir)
            case "$UPDATE_LOCK_PATH" in */tmp/locks/update.lockdir) rm -rf "$UPDATE_LOCK_PATH" 2>/dev/null || true ;; esac
            ;;
    esac
    UPDATE_LOCK_PATH=""
    UPDATE_LOCK_METHOD=""
    UPDATE_LOCK_FD=""
}

updater_lock_pid_alive() {
    local pid="$1"
    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    [ "$pid" -gt 0 ] || return 1
    kill -0 "$pid" 2>/dev/null
}

updater_active_monitor_detected() {
    local project_dir="$1"
    local locks_dir="${project_dir}/tmp/locks"
    local path pid
    [ -d "$locks_dir" ] || return 1
    for path in "${locks_dir}"/*.lock "${locks_dir}"/*.lockdir; do
        [ -e "$path" ] || continue
        case "${path##*/}" in
            update.lock|update.lockdir|license-instance-admission.lock|license-instance-admission.lockdir) continue ;;
        esac
        pid=""
        if [ -d "$path" ] && [ -f "${path}/pid" ]; then
            pid="$(tr -cd '0-9' < "${path}/pid" 2>/dev/null)"
        elif [ -f "$path" ]; then
            pid="$(grep '^pid=' "$path" 2>/dev/null | head -1 | cut -d= -f2 | tr -cd '0-9')"
        fi
        if [ -n "$pid" ] && updater_lock_pid_alive "$pid"; then
            printf '%s\n' "$path"
            return 0
        fi
    done
    return 1
}

updater_get_manifest() {
    local project_dir="$1"
    local manifest_url="${2:-$UPDATE_MANIFEST_URL}"
    local signature_url="${3:-$UPDATE_SIGNATURE_URL}"

    updater_validate_url "$manifest_url" "Manifest URL" || return $?
    signature_url="${signature_url:-${manifest_url}.sig}"
    updater_validate_url "$signature_url" "Signature URL" || return $?
    updater_create_workspace "$project_dir" || return 1

    updater_log INFO update_check url "$manifest_url" channel "$UPDATE_CHANNEL"
    if declare -F network_download_secure_https >/dev/null 2>&1; then
        if [ "$UPDATE_ALLOW_HTTP_DEV" = "true" ] && [[ "$manifest_url" == http://* ]]; then
            network_download "$manifest_url" "$UPDATE_MANIFEST_FILE" 30 3 || return 1
            network_download "$signature_url" "$UPDATE_SIGNATURE_FILE" 30 3 || return 1
        else
            network_download_secure_https "$manifest_url" "$UPDATE_MANIFEST_FILE" 30 3 1048576 || return 1
            network_download_secure_https "$signature_url" "$UPDATE_SIGNATURE_FILE" 30 3 1048576 || {
                updater_error "manifest signature is missing"
                return 1
            }
        fi
    else
        network_download "$manifest_url" "$UPDATE_MANIFEST_FILE" 30 3 || return 1
        network_download "$signature_url" "$UPDATE_SIGNATURE_FILE" 30 3 || return 1
    fi
    [ -s "$UPDATE_MANIFEST_FILE" ] || { updater_error "manifest download was empty"; return 1; }
    [ -s "$UPDATE_SIGNATURE_FILE" ] || { updater_error "manifest signature is missing"; return 1; }
}

updater_verify_manifest() {
    local project_dir="$1"
    local public_key
    public_key="$(updater_public_key_file "$project_dir")"
    [ -f "$public_key" ] || { updater_error "update public key is missing: $public_key"; return 1; }
    openssl pkeyutl -verify -pubin -inkey "$public_key" -rawin -in "$UPDATE_MANIFEST_FILE" -sigfile "$UPDATE_SIGNATURE_FILE" >/dev/null 2>&1 || {
        updater_error "manifest signature verification failed"
        return 1
    }
    updater_log INFO update_signature_verified key "$public_key"
}

updater_validate_manifest_schema() {
    local manifest="$UPDATE_MANIFEST_FILE"
    local schema channel url sha size version mandatory minimum notes

    schema="$(jq -r '.schemaVersion // empty' "$manifest")" || return 1
    [ "$schema" = "1" ] || { updater_error "unsupported manifest schemaVersion"; return 1; }
    version="$(jq -r '.version // empty' "$manifest")"
    channel="$(jq -r '.channel // empty' "$manifest")"
    url="$(jq -r '.artifact.url // empty' "$manifest")"
    sha="$(jq -r '.artifact.sha256 // empty' "$manifest")"
    size="$(jq -r '.artifact.size // empty' "$manifest")"
    mandatory="$(jq -r '.mandatory // false' "$manifest")"
    minimum="$(jq -r '.minimumVersion // empty' "$manifest")"
    notes="$(jq -r '.notesUrl // empty' "$manifest")"

    updater_normalize_version "$version" >/dev/null || { updater_error "manifest version is invalid"; return 1; }
    [ "$channel" = "$UPDATE_CHANNEL" ] || { updater_error "manifest channel mismatch: expected $UPDATE_CHANNEL got $channel"; return 1; }
    [[ "$sha" =~ ^[A-Fa-f0-9]{64}$ ]] || { updater_error "artifact sha256 is invalid"; return 1; }
    [[ "$size" =~ ^[0-9]+$ ]] || { updater_error "artifact size is invalid"; return 1; }
    [ "$size" -gt 0 ] || { updater_error "artifact size must be greater than zero"; return 1; }
    case "$mandatory" in true|false) ;; *) updater_error "mandatory must be boolean"; return 1 ;; esac
    [ -z "$minimum" ] || updater_normalize_version "$minimum" >/dev/null || { updater_error "minimumVersion is invalid"; return 1; }
    [ -z "$notes" ] || updater_validate_url "$notes" "Notes URL" || return $?
    updater_validate_url "$url" "Artifact URL" || return $?

    UPDATE_LATEST_VERSION="$version"
    UPDATE_ARTIFACT_URL="$url"
    UPDATE_ARTIFACT_SHA256="$(printf '%s' "$sha" | tr 'A-F' 'a-f')"
    UPDATE_ARTIFACT_SIZE="$size"
    UPDATE_MANDATORY="$mandatory"
    UPDATE_MINIMUM_VERSION="$minimum"
    UPDATE_NOTES_URL="$notes"
}

updater_check() {
    local project_dir="${1:-$(pwd)}"
    local current compare min_compare

    UPDATE_PROJECT_DIR="$project_dir"
    updater_require_tools || return 1
    current="$(updater_read_version "$project_dir")" || { updater_error "VERSION is missing"; return 1; }
    UPDATE_CURRENT_VERSION="$current"
    updater_get_manifest "$project_dir" || return $?
    updater_verify_manifest "$project_dir" || return $?
    updater_validate_manifest_schema || return $?

    compare="$(updater_compare_versions "$UPDATE_LATEST_VERSION" "$current")" || return 1
    if [ "$compare" -gt 0 ]; then
        UPDATE_AVAILABLE="true"
        updater_log INFO update_available current "$current" latest "$UPDATE_LATEST_VERSION" channel "$UPDATE_CHANNEL" mandatory "$UPDATE_MANDATORY"
    else
        UPDATE_AVAILABLE="false"
    fi

    if [ -n "$UPDATE_MINIMUM_VERSION" ]; then
        min_compare="$(updater_compare_versions "$current" "$UPDATE_MINIMUM_VERSION")" || min_compare=0
        if [ "$min_compare" -lt 0 ]; then
            printf 'This client version is no longer supported. Update required.\n'
        fi
    fi
}

updater_download_release() {
    local max_bytes actual_size part_file
    max_bytes=$((UPDATE_MAX_SIZE_MB * 1024 * 1024))
    [ "$UPDATE_ARTIFACT_SIZE" -le "$max_bytes" ] || { updater_error "artifact exceeds max update size"; return 1; }
    part_file="${UPDATE_ARTIFACT_FILE}.part"
    updater_log INFO update_download url "$UPDATE_ARTIFACT_URL" size "$UPDATE_ARTIFACT_SIZE"
    rm -f "$part_file" "$UPDATE_ARTIFACT_FILE"
    if declare -F network_download_secure_https >/dev/null 2>&1; then
        if [ "$UPDATE_ALLOW_HTTP_DEV" = "true" ] && [[ "$UPDATE_ARTIFACT_URL" == http://* ]]; then
            network_download "$UPDATE_ARTIFACT_URL" "$part_file" 300 3 || return 1
        else
            network_download_secure_https "$UPDATE_ARTIFACT_URL" "$part_file" 300 3 "$max_bytes" || return 1
        fi
    else
        network_download "$UPDATE_ARTIFACT_URL" "$part_file" 300 3 || return 1
    fi
    [ -s "$part_file" ] || { updater_error "release artifact download was empty"; return 1; }
    actual_size="$(updater_file_size_bytes "$part_file")"
    [ "$actual_size" = "$UPDATE_ARTIFACT_SIZE" ] || { updater_error "artifact size mismatch"; return 1; }
    mv "$part_file" "$UPDATE_ARTIFACT_FILE"
}

updater_verify_release() {
    local actual_sha
    actual_sha="$(updater_sha256 "$UPDATE_ARTIFACT_FILE")" || return 1
    actual_sha="$(printf '%s' "$actual_sha" | tr 'A-F' 'a-f')"
    [ "$actual_sha" = "$UPDATE_ARTIFACT_SHA256" ] || { updater_error "artifact SHA256 mismatch"; return 1; }
    updater_log INFO update_hash_verified sha256 "$actual_sha"
}

updater_validate_archive_paths() {
    local archive="$1"
    local line mode path
    tar -tzf "$archive" >/dev/null 2>&1 || { updater_error "release archive is invalid"; return 1; }
    while IFS= read -r path || [ -n "$path" ]; do
        [ -n "$path" ] || continue
        while [[ "$path" == ./* ]]; do
            path="${path#./}"
        done
        [ -n "$path" ] || continue
        case "$path" in
            /*|*'/../'*|../*|*'/..'|..|*\\*) updater_error "release archive contains unsafe path: $path"; return 1 ;;
            .git|.git/*|tmp|tmp/*|logs|logs/*|node_modules|node_modules/*|server/node_modules|server/node_modules/*|.env|*/.env|license.cache|*/license.cache|config.env|config_*.cfg|config|config/*)
                updater_error "release archive contains user/private data path: $path"
                return 1
                ;;
        esac
    done <<EOF
$(tar -tzf "$archive")
EOF
    while IFS= read -r line || [ -n "$line" ]; do
        mode="${line%% *}"
        case "$mode" in
            l*|h*) updater_error "release archive contains symlink/hardlink"; return 1 ;;
        esac
    done <<EOF
$(tar -tvzf "$archive")
EOF
}

updater_extract_staging() {
    updater_validate_archive_paths "$UPDATE_ARTIFACT_FILE" || return 1
    tar -xzf "$UPDATE_ARTIFACT_FILE" -C "$UPDATE_STAGING_DIR" || return 1
}

updater_self_test() {
    local root="${1:-$UPDATE_STAGING_DIR}"
    local file
    [ -f "${root}/VERSION" ] || { updater_error "self-test failed: VERSION missing"; return 1; }
    [ -s "${root}/VERSION" ] || { updater_error "self-test failed: VERSION empty"; return 1; }
    for file in "${root}/auto_rejoin.sh" "${root}/setup.sh" "${root}/bin/roblox-manager" "${root}"/lib/*.sh; do
        [ -f "$file" ] || continue
        bash -n "$file" || { updater_error "self-test failed: syntax error in ${file#$root/}"; return 1; }
    done
    if [ -f "${root}/bin/roblox-manager" ]; then
        grep -q 'manager_version' "${root}/bin/roblox-manager" || { updater_error "self-test failed: roblox-manager missing version command"; return 1; }
    fi
}

updater_backup_current() {
    local project_dir="$1"
    local current timestamp item
    current="$(updater_read_version "$project_dir" 2>/dev/null || printf 'unknown')"
    timestamp="$(date '+%Y%m%d%H%M%S')"
    UPDATE_BACKUP_DIR="${project_dir}/tmp/update/backups/${current}-${timestamp}"
    mkdir -p "$UPDATE_BACKUP_DIR" || return 1
    for item in VERSION auto_rejoin.sh setup.sh bin lib scripts README.md CHANGELOG.md UPDATE_ARCHITECTURE.md RELEASE_PROCESS.md; do
        if [ -e "${project_dir}/${item}" ]; then
            mkdir -p "${UPDATE_BACKUP_DIR}/$(dirname "$item")" 2>/dev/null || true
            cp -Rp "${project_dir}/${item}" "${UPDATE_BACKUP_DIR}/${item}" || return 1
        fi
    done
}

updater_apply_release() {
    local project_dir="$1"
    updater_log INFO update_apply version "$UPDATE_LATEST_VERSION"
    cp -Rp "${UPDATE_STAGING_DIR}/." "$project_dir/" || return 1
}

updater_rollback() {
    local project_dir="$1"
    [ -n "$UPDATE_BACKUP_DIR" ] && [ -d "$UPDATE_BACKUP_DIR" ] || { updater_error "rollback backup is unavailable"; return 1; }
    if [ "${UPDATE_TEST_ROLLBACK_FAIL:-false}" = "true" ]; then
        updater_error "rollback failed by test override"
        return 1
    fi
    cp -Rp "${UPDATE_BACKUP_DIR}/." "$project_dir/" || return 1
    updater_log WARN update_rollback backup "$UPDATE_BACKUP_DIR"
}

updater_prune_backups() {
    local project_dir="$1"
    local backups_dir="${project_dir}/tmp/update/backups"
    local keep="$UPDATE_KEEP_BACKUPS"
    [ -d "$backups_dir" ] || return 0
    [[ "$keep" =~ ^[0-9]+$ ]] || keep=2
    if find "$backups_dir" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' >/dev/null 2>&1; then
        find "$backups_dir" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null |
            sort -rn |
            awk -v keep="$keep" 'NR > keep { sub(/^[^ ]+ /, ""); print }' |
            while IFS= read -r old_backup; do
                case "$old_backup" in
                    "$backups_dir"/*) rm -rf "$old_backup" 2>/dev/null || true ;;
                esac
            done
    fi
}

updater_print_status() {
    printf 'Auto Rejoin Pro Update\n\n'
    printf 'Current : %s\n' "${UPDATE_CURRENT_VERSION:-unknown}"
    printf 'Latest  : %s\n' "${UPDATE_LATEST_VERSION:-unknown}"
    printf 'Channel : %s\n' "$UPDATE_CHANNEL"
    printf 'Update  : %s\n' "$UPDATE_AVAILABLE"
    printf 'Mandatory: %s\n' "$UPDATE_MANDATORY"
    [ -n "$UPDATE_NOTES_URL" ] && printf 'Notes   : %s\n' "$UPDATE_NOTES_URL"
}

updater_update() {
    local project_dir="${1:-$(pwd)}"
    local yes="${2:-false}"
    local active_lock post_version

    updater_lock_acquire "$project_dir" || return 1
    trap 'updater_cleanup; updater_lock_release' RETURN
    trap 'updater_cleanup; updater_lock_release; exit 130' INT TERM

    active_lock="$(updater_active_monitor_detected "$project_dir" || true)"
    if [ -n "$active_lock" ]; then
        updater_error "active monitor detected; stop monitor sessions before updating"
        return 1
    fi

    updater_check "$project_dir" || return $?
    updater_print_status
    if [ "$UPDATE_AVAILABLE" != "true" ]; then
        printf 'No update available.\n'
        return 0
    fi
    if [ "$yes" != "true" ]; then
        printf '\nInstall update? [y/N] '
        read -r answer
        case "$answer" in y|Y|yes|YES) ;; *) printf 'Update cancelled.\n'; return 0 ;; esac
    fi

    updater_download_release || return 1
    updater_verify_release || return 1
    updater_extract_staging || return 1
    updater_self_test "$UPDATE_STAGING_DIR" || return 1
    updater_backup_current "$project_dir" || return 1
    if ! updater_apply_release "$project_dir"; then
        updater_error "update apply failed"
        if ! updater_rollback "$project_dir"; then
            printf 'CRITICAL: update failed and automatic rollback could not complete.\nBackup location: %s\n' "$UPDATE_BACKUP_DIR" >&2
            return 1
        fi
        return 1
    fi
    if ! updater_self_test "$project_dir"; then
        updater_error "post-update self-test failed"
        if ! updater_rollback "$project_dir"; then
            printf 'CRITICAL: update failed and automatic rollback could not complete.\nBackup location: %s\n' "$UPDATE_BACKUP_DIR" >&2
            return 1
        fi
        return 1
    fi
    post_version="$(updater_read_version "$project_dir" 2>/dev/null || true)"
    if [ "$post_version" != "$UPDATE_LATEST_VERSION" ]; then
        updater_error "post-update VERSION mismatch"
        if ! updater_rollback "$project_dir"; then
            printf 'CRITICAL: update failed and automatic rollback could not complete.\nBackup location: %s\n' "$UPDATE_BACKUP_DIR" >&2
            return 1
        fi
        return 1
    fi
    updater_prune_backups "$project_dir"
    updater_log INFO update_success version "$UPDATE_LATEST_VERSION" backup "$UPDATE_BACKUP_DIR"
    printf 'Update installed successfully: %s\n' "$UPDATE_LATEST_VERSION"
}
