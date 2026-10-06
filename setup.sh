#!/bin/bash
# ╔══════════════════════════════════════════════════════╗
# ║      ROBLOX AUTO REJOIN - SETUP SCRIPT v3.1         ║
# ║      Cách dùng: bash setup.sh [PlaceID] [Code]      ║
# ╚══════════════════════════════════════════════════════╝

stty sane 2>/dev/null || true
stty onlcr 2>/dev/null || true
export TERM="${TERM:-xterm-256color}"
export PATH="${PATH:-}:/system/bin:/system/xbin:/sbin:/vendor/bin:/data/local/tmp"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TMP_DIR="${SCRIPT_DIR}/tmp"
mkdir -p "$TMP_DIR"

BGRN='\033[1;32m'
GRN='\033[0;32m'
RED='\033[0;31m'
YLW='\033[0;33m'
CYN='\033[0;36m'
WHT='\033[1;37m'
NC='\033[0m'

# ── Chạy lệnh với timeout để tránh treo vĩnh viễn ───────
run_with_timeout() {
    local secs="$1"; shift
    if command -v timeout > /dev/null 2>&1; then
        timeout "$secs" "$@"
    else
        "$@" &
        local pid=$!
        local i=0
        while kill -0 "$pid" 2>/dev/null && [ $i -lt "$secs" ]; do
            sleep 1; i=$((i+1))
        done
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null; return 124
        fi
        wait "$pid" 2>/dev/null
    fi
}

bootstrap_download() {
    local url="$1"
    local output="$2"
    curl --fail --location --silent --show-error \
        --connect-timeout 10 \
        --max-time 120 \
        --retry 3 \
        --retry-delay 2 \
        -o "$output" \
        "$url"
}

# Nguồn cài đặt. AUTO_REJOIN_REF nhận tên nhánh, tag (vd v4.5.0) hoặc commit SHA.
# Production: ghim về tag cố định, ví dụ AUTO_REJOIN_REF=v4.5.0 bash setup.sh <PLACE_ID>.
AUTO_REJOIN_REPO="${AUTO_REJOIN_REPO:-Gnas260605/auto-rejoin}"
AUTO_REJOIN_REF="${AUTO_REJOIN_REF:-main}"
SETUP_LIB_FILES=(config.sh android.sh network.sh logger.sh runtime.sh roblox_session.sh session_evidence.sh roblox_api.sh notification.sh monitor.sh roblox.sh doctor.sh ui.sh profile.sh installer.sh license.sh entitlement.sh updater.sh cookie.sh delta.sh worker.sh)

setup_install_files() {
    local f
    printf '%s\n' auto_rejoin.sh bin/roblox-manager VERSION
    for f in "${SETUP_LIB_FILES[@]}"; do printf 'lib/%s\n' "$f"; done
}

# Chốt ref về 1 commit SHA để mọi file tải về cùng một phiên bản (tránh dính push giữa chừng).
# GitHub API lỗi/rate-limit -> dùng nguyên ref.
resolve_install_ref() {
    local ref="$1" sha=""
    if printf '%s' "$ref" | grep -Eq '^[0-9a-f]{40}$'; then
        printf '%s\n' "$ref"
        return 0
    fi
    sha="$(curl --fail --location --silent --connect-timeout 10 --max-time 20 \
        -H 'Accept: application/vnd.github.sha' \
        "https://api.github.com/repos/${AUTO_REJOIN_REPO}/commits/${ref}" 2>/dev/null | tr -d '\r\n')"
    if printf '%s' "$sha" | grep -Eq '^[0-9a-f]{40}$'; then
        printf '%s\n' "$sha"
    else
        printf '%s\n' "$ref"
    fi
}

local_install_complete() {
    local rel
    while IFS= read -r rel; do
        [ "$rel" = "VERSION" ] && continue
        [ -s "$rel" ] || return 1
    done < <(setup_install_files)
}

# Tất cả hoặc không gì cả: tải toàn bộ vào thư mục tạm, kiểm tra cú pháp, đủ file mới thay bản đang chạy.
install_snapshot() {
    local ref="$1"
    local base="https://raw.githubusercontent.com/${AUTO_REJOIN_REPO}/${ref}"
    local stage="${TMP_DIR}/setup-stage.$$"
    local rel

    rm -rf "$stage"
    mkdir -p "$stage/lib" "$stage/bin" || return 1
    while IFS= read -r rel; do
        if ! bootstrap_download "${base}/${rel}" "${stage}/${rel}" 2>/dev/null || [ ! -s "${stage}/${rel}" ]; then
            echo -e "  ${YLW}⚠ Không tải được ${rel}${NC}"
            rm -rf "$stage"
            return 1
        fi
        # Chặn file CRLF và file hỏng (vd trang lỗi HTML) trước khi chạm vào bản đang chạy.
        sed -i 's/\r$//' "${stage}/${rel}" 2>/dev/null || true
        if [ "$rel" != "VERSION" ] && ! bash -n "${stage}/${rel}" 2>/dev/null; then
            echo -e "  ${RED}✗ ${rel} tải về bị lỗi cú pháp, huỷ cập nhật${NC}"
            rm -rf "$stage"
            return 1
        fi
    done < <(setup_install_files)

    mkdir -p lib bin
    while IFS= read -r rel; do
        mv -f "${stage}/${rel}" "$rel" || { rm -rf "$stage"; return 1; }
    done < <(setup_install_files)
    rm -rf "$stage"
}

# ── Progress bar ─────────────────────────────────────────
progress_bar() {
    local current=$1 total=$2 label="${3:-}"
    local width=30
    local filled=$(( current * width / total ))
    local empty=$(( width - filled ))
    local bar=""
    local i
    for (( i=0; i<filled; i++ )); do bar+="█"; done
    for (( i=0; i<empty; i++ )); do bar+="░"; done
    printf "\r\033[K  ${BGRN}[${bar}]${NC} ${YLW}%3d%%${NC} %s\n" $(( current * 100 / total )) "$label"
}

clear
echo -e "${BGRN}"
echo "  ████████╗ ██████╗  ██████╗ ██╗        "
echo "  ╚══██╔══╝██╔═══██╗██╔═══██╗██║        "
echo "     ██║   ██║   ██║██║   ██║██║        "
echo "     ██║   ██║   ██║██║   ██║██║        "
echo "     ██║   ╚██████╔╝╚██████╔╝███████╗   "
echo "     ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝   "
echo -e "${NC}"
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║      ROBLOX AUTO REJOIN - TRÌNH CÀI ĐẶT        ║${NC}"
echo -e "${BGRN}╠══════════════════════════════════════════════════╣${NC}"

PLACE_ID="${1:-}"
PRIVATE_CODE="${2:-}"
SETUP_LICENSE_KEY="${AUTO_REJOIN_LICENSE_KEY:-${LICENSE_KEY:-${3:-}}}"
SETUP_LICENSE_MODE="${AUTO_REJOIN_LICENSE_MODE:-${LICENSE_MODE:-optional}}"
SETUP_LICENSE_API="${AUTO_REJOIN_LICENSE_API:-${LICENSE_API:-}}"
SETUP_JOIN_LOW_SERVER="${AUTO_REJOIN_JOIN_LOW_SERVER:-${JOIN_LOW_SERVER:-}}"
SETUP_LOW_SERVER_MIN_PLAYERS="${AUTO_REJOIN_LOW_SERVER_MIN_PLAYERS:-${LOW_SERVER_MIN_PLAYERS:-}}"
SETUP_LOW_SERVER_MAX_PLAYERS="${AUTO_REJOIN_LOW_SERVER_MAX_PLAYERS:-${LOW_SERVER_MAX_PLAYERS:-}}"
SETUP_LOW_SERVER_STRICT="${AUTO_REJOIN_LOW_SERVER_STRICT:-${LOW_SERVER_STRICT:-}}"
SETUP_ALLOW_UNSCOPED_DEEPLINK="${AUTO_REJOIN_ALLOW_UNSCOPED_DEEPLINK:-${ALLOW_UNSCOPED_DEEPLINK:-}}"
SETUP_ALLOW_HOME_FALLBACK="${AUTO_REJOIN_ALLOW_HOME_FALLBACK:-${ALLOW_HOME_FALLBACK:-}}"

if [ -z "$PLACE_ID" ] && [ -f "${SCRIPT_DIR}/config.env" ]; then
    CFG_PLACE="$(grep -E '^PLACE_ID=' "${SCRIPT_DIR}/config.env" 2>/dev/null | head -n1 | cut -d'=' -f2 | tr -d '"\r')"
    CFG_CODE="$(grep -E '^PRIVATE_CODE=' "${SCRIPT_DIR}/config.env" 2>/dev/null | head -n1 | cut -d'=' -f2 | tr -d '"\r')"
    [ -n "$CFG_PLACE" ] && PLACE_ID="$CFG_PLACE"
    [ -n "$CFG_CODE" ] && PRIVATE_CODE="$CFG_CODE"
fi
PLACE_ID="${PLACE_ID:-97598239454123}"
PRIVATE_CODE="${PRIVATE_CODE:-}"

printf "${BGRN}║${NC}  Place ID    : ${YLW}%-36s${NC}${BGRN}║${NC}\n" "$PLACE_ID"
if [ -n "$PRIVATE_CODE" ]; then
    printf "${BGRN}║${NC}  Private Code: ${YLW}%-36s${NC}${BGRN}║${NC}\n" "$PRIVATE_CODE"
elif [ "${SETUP_JOIN_LOW_SERVER}" = "true" ]; then
    printf "${BGRN}║${NC}  Chế độ      : ${YLW}%-36s${NC}${BGRN}║${NC}\n" "Low Server (Ít người)"
else
    printf "${BGRN}║${NC}  Chế độ      : ${YLW}%-36s${NC}${BGRN}║${NC}\n" "Public Server (Mặc định)"
fi
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── BƯỚC 1 & 2: Kiểm tra và cài đặt gói thông minh ────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 1/4] Kiểm tra & Cài đặt gói cần thiết   ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"

PKGS=("tmux" "curl" "jq" "tsu" "procps" "android-tools")
MISSING_PKGS=()

for p in "${PKGS[@]}"; do
    if dpkg -s "$p" > /dev/null 2>&1; then
        printf "  ${GRN}✓${NC} %-20s ${GRN}[Đã cài]${NC}\n" "$p"
    else
        printf "  ${YLW}✗${NC} %-20s ${YLW}[Cần cài]${NC}\n" "$p"
        MISSING_PKGS+=("$p")
    fi
done
echo ""

if [ ${#MISSING_PKGS[@]} -eq 0 ]; then
    echo -e "  ${BGRN}✓ Tất cả gói đã sẵn sàng — bỏ qua bước cài đặt${NC}"
else
    echo -e "  ${YLW}Đang cập nhật danh sách repo...${NC}"
    pkg update -y -o Dpkg::Options::="--force-confold" 2>&1 | tail -3
    mp_total=${#MISSING_PKGS[@]}
    mp_idx=0
    for p in "${MISSING_PKGS[@]}"; do
        mp_idx=$((mp_idx+1))
        echo -ne "  ${CYN}[$mp_idx/$mp_total]${NC} Đang cài ${YLW}$p${NC}... "
        if pkg install -y "$p" > /dev/null 2>&1; then
            echo -e "${BGRN}✓ OK${NC}"
        else
            echo -e "${RED}✗ Lỗi! (thử thủ công: pkg install $p)${NC}"
        fi
    done
    echo -e "  ${BGRN}✓ Hoàn tất cài đặt gói${NC}"
fi
echo ""

echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 2/4] Tải script auto_rejoin.sh           ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
progress_bar 1 4 "Đang kết nối GitHub..."
SETUP_REF="$(resolve_install_ref "$AUTO_REJOIN_REF")"
progress_bar 2 4 "Đang tải bản ${SETUP_REF:0:12}..."
if install_snapshot "$SETUP_REF"; then
    progress_bar 4 4 "Hoàn tất!"
    echo -e "  ${BGRN}✓ Đã cài đồng bộ $(tr -d '\r\n' < VERSION 2>/dev/null) (ref ${SETUP_REF:0:12})${NC}"
elif local_install_complete; then
    echo -e "  ${YLW}⚠ Không tải được bản mới; giữ nguyên bản local đang có (không trộn file cũ/mới)${NC}"
else
    echo -e "  ${RED}✗ Không tải được tool và máy chưa có bản cài đầy đủ. Kiểm tra mạng rồi chạy lại setup.sh${NC}"
    exit 1
fi
[ -f VERSION ] || printf '4.0.0-dev\n' > VERSION
chmod +x auto_rejoin.sh setup.sh lib/*.sh bin/roblox-manager 2>/dev/null
echo ""

if [ -f "${SCRIPT_DIR}/lib/android.sh" ]; then
    # shellcheck source=lib/android.sh
    source "${SCRIPT_DIR}/lib/android.sh"
fi

if [ -f "${SCRIPT_DIR}/lib/network.sh" ]; then
    # shellcheck source=lib/network.sh
    source "${SCRIPT_DIR}/lib/network.sh"
fi
if [ -f "${SCRIPT_DIR}/lib/license.sh" ]; then
    # shellcheck source=lib/license.sh
    source "${SCRIPT_DIR}/lib/license.sh"
fi

if [ -n "$SETUP_LICENSE_KEY" ]; then
    LICENSE_MODE="$SETUP_LICENSE_MODE"
    LICENSE_API="$SETUP_LICENSE_API"
    AUTO_REJOIN_LICENSE_MODE="$SETUP_LICENSE_MODE"
    AUTO_REJOIN_LICENSE_API="$SETUP_LICENSE_API"
    export LICENSE_MODE LICENSE_API AUTO_REJOIN_LICENSE_MODE AUTO_REJOIN_LICENSE_API
    if [ -z "$LICENSE_API" ]; then
        echo -e "  ${RED}x AUTO_REJOIN_LICENSE_API/LICENSE_API is required when LICENSE_KEY is provided${NC}"
        if [ "$AUTO_REJOIN_LICENSE_MODE" = "required" ]; then
            exit 1
        fi
    else
        echo -e "  ${CYN}[LICENSE]${NC} Activating license key..."
        if ! license_activate "$SETUP_LICENSE_KEY" "$SCRIPT_DIR"; then
            if [ "$AUTO_REJOIN_LICENSE_MODE" = "required" ]; then
                echo -e "  ${RED}x License activation failed. Setup stopped.${NC}"
                exit 1
            else
                echo -e "  ${YLW}⚠ Không thể kích hoạt license; tiếp tục chạy chế độ miễn phí / local.${NC}"
            fi
        else
            echo -e "  ${BGRN}License activated; raw key was not saved to config${NC}"
        fi
    fi
fi

# Kết nối ShopRoblox (Tab cày thuê) trong cùng lệnh cài: SHOP_API_URL + SHOP_WORKER_TOKEN [+ WORKER_ID]
# → ghi shop_worker.cfg (600), dùng chung cho mọi tab. Không truyền thì giữ nguyên file cũ (nếu có).
SETUP_SHOP_API_URL="${AUTO_REJOIN_SHOP_API_URL:-${SHOP_API_URL:-}}"
SETUP_SHOP_WORKER_TOKEN="${AUTO_REJOIN_SHOP_WORKER_TOKEN:-${SHOP_WORKER_TOKEN:-}}"
SETUP_WORKER_ID="${AUTO_REJOIN_WORKER_ID:-${WORKER_ID:-}}"
if [ -n "$SETUP_SHOP_API_URL" ] || [ -n "$SETUP_SHOP_WORKER_TOKEN" ]; then
    SETUP_SHOP_API_URL="${SETUP_SHOP_API_URL%/}"
    if [[ ! "$SETUP_SHOP_API_URL" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
        echo -e "  ${RED}x SHOP_API_URL phải dạng https://ten-mien (vd. https://taphoasandg.com). Bỏ qua kết nối Shop.${NC}"
    elif [[ ! "$SETUP_SHOP_WORKER_TOKEN" =~ ^[A-Za-z0-9._~-]{16,200}$ ]]; then
        echo -e "  ${RED}x SHOP_WORKER_TOKEN không hợp lệ (lấy ở Admin › Tab cày thuê). Bỏ qua kết nối Shop.${NC}"
    else
        if [ -n "$SETUP_WORKER_ID" ] && [[ ! "$SETUP_WORKER_ID" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$ ]]; then
            echo -e "  ${YLW}⚠ WORKER_ID không hợp lệ, dùng tên máy mặc định${NC}"
            SETUP_WORKER_ID=""
        fi
        (
            umask 077
            {
                printf '# Tạo bởi setup.sh — kết nối ShopRoblox (Tab cày thuê). Chứa token: không chia sẻ file này.\n'
                printf 'SHOP_API_URL="%s"\n' "$SETUP_SHOP_API_URL"
                printf 'SHOP_WORKER_TOKEN="%s"\n' "$SETUP_SHOP_WORKER_TOKEN"
                [ -n "$SETUP_WORKER_ID" ] && printf 'WORKER_ID="%s"\n' "$SETUP_WORKER_ID"
            } > "${SCRIPT_DIR}/shop_worker.cfg"
        )
        chmod 600 "${SCRIPT_DIR}/shop_worker.cfg" 2>/dev/null
        echo -e "  ${BGRN}✓ Đã kết nối Shop (${SETUP_SHOP_API_URL}) — máy: ${SETUP_WORKER_ID:-tự đặt}${NC}"
    fi
fi

# ── BƯỚC 3/4: Phát hiện executor ──────────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 3/4] Phát hiện phương thức hệ thống      ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
progress_bar 1 3 "Kiểm tra Root (su)..."
export PATH="${PATH:-}:/system/bin:/system/xbin:/sbin:/vendor/bin:/data/local/tmp"
EXECUTOR_TYPE="direct"

if [ -n "${FORCE_EXECUTOR:-}" ]; then
    EXECUTOR_TYPE="$FORCE_EXECUTOR"
elif command -v su >/dev/null 2>&1 || [ -x /system/xbin/su ] || [ -x /system/bin/su ] || [ -x /sbin/su ] || command -v tsu >/dev/null 2>&1; then
    EXECUTOR_TYPE="su"
elif declare -F android_detect_executor >/dev/null 2>&1; then
    EXECUTOR_TYPE="$(android_detect_executor)"
fi

if [ "$EXECUTOR_TYPE" = "su" ]; then
    progress_bar 3 3 "Đã phát hiện!"
    echo -e "  ${BGRN}✓ Đã phát hiện quyền Root (su)${NC}"
    export ANDROID_EXECUTOR="su"
elif [ "$EXECUTOR_TYPE" = "adb" ] || command -v adb >/dev/null 2>&1; then
    EXECUTOR_TYPE="adb"
    progress_bar 3 3 "Đã phát hiện!"
    echo -e "  ${BGRN}✓ Đã phát hiện ADB shell${NC}"
    export ANDROID_EXECUTOR="adb"
else
    progress_bar 3 3 "Che do direct"
    echo -e "  ${YLW}⚠ Không có root/adb, chạy chế độ direct (hạn chế)${NC}"
    export ANDROID_EXECUTOR="direct"
fi
echo ""

# ── BƯỚC 4/4: Quét clone & Khởi động ──────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 4/4] Quét Roblox clone & Khởi động       ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
progress_bar 1 3 "Đang quét gói Roblox..."
sleep 0.5

PACKAGES=""
CLONE_PATTERN="roblox|aya\.|clone|delta|fluxus|arceus|hydrogen|codex|rbx"
if declare -F android_list_packages >/dev/null 2>&1; then
    android_set_executor "$EXECUTOR_TYPE"
    PACKAGES=$(android_list_packages -3 2>/dev/null | grep -iE "$CLONE_PATTERN" | cut -d: -f2 | tr -d '\r')
    [ -z "$PACKAGES" ] && PACKAGES=$(android_list_packages 2>/dev/null | grep -iE "$CLONE_PATTERN" | cut -d: -f2 | tr -d '\r')
else
    case "$EXECUTOR_TYPE" in
        su)     PACKAGES=$(su -c "pm list packages -3" 2>/dev/null | grep -iE "$CLONE_PATTERN" | cut -d: -f2 | tr -d '\r') ;;
        adb)    PACKAGES=$(adb shell "pm list packages -3" 2>/dev/null | grep -iE "$CLONE_PATTERN" | cut -d: -f2 | tr -d '\r') ;;
        *)      PACKAGES=$(pm list packages -3 2>/dev/null | grep -iE "$CLONE_PATTERN" | cut -d: -f2 | tr -d '\r') ;;
    esac
    if [ -z "$PACKAGES" ]; then
        case "$EXECUTOR_TYPE" in
            su)     PACKAGES=$(su -c "pm list packages" 2>/dev/null | grep -iE "$CLONE_PATTERN" | cut -d: -f2 | tr -d '\r') ;;
            adb)    PACKAGES=$(adb shell "pm list packages" 2>/dev/null | grep -iE "$CLONE_PATTERN" | cut -d: -f2 | tr -d '\r') ;;
            *)      PACKAGES=$(pm list packages 2>/dev/null | grep -iE "$CLONE_PATTERN" | cut -d: -f2 | tr -d '\r') ;;
        esac
    fi
fi

progress_bar 2 3 "Phân tích danh sách..."
sleep 0.3

if [ -z "$PACKAGES" ]; then
    PACKAGES="com.roblox.client"
    echo -e "  ${YLW}⚠ Không quét được bản clone, dùng gói mặc định${NC}"
else
    echo -e "  ${BGRN}✓ Tìm thấy các gói Roblox / Clone:${NC}"
    for p in $PACKAGES; do
        echo -e "    ${CYN}→${NC} $p"
    done
fi

progress_bar 3 3 "Hoàn tất!"
echo ""

# Dừng phiên tmux cũ
tmux kill-session -t roblox-multi 2>/dev/null

if [ -f "config.cfg" ]; then
    DEFAULT_PLACE_ID=$(grep '^PLACE_ID=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    DEFAULT_PRIVATE_CODE=$(grep '^PRIVATE_CODE=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    DEFAULT_WEBHOOK=$(grep '^DISCORD_WEBHOOK=' config.cfg | cut -d'"' -f2 2>/dev/null)
    DEFAULT_CHECK_INTERVAL=$(grep '^CHECK_INTERVAL=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_AUTO_RESTART=$(grep '^AUTO_RESTART_PERIOD=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_ANTI_AFK=$(grep '^ANTI_AFK=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_TAP_INTERVAL=$(grep '^AFK_TAP_INTERVAL=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_TAP_X=$(grep '^TAP_X=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_TAP_Y=$(grep '^TAP_Y=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_FREEFORM_LAYOUT=$(grep '^FREEFORM_LAYOUT=' config.cfg | cut -d'"' -f2 2>/dev/null)
    DEFAULT_FREEFORM_WIDTH=$(grep '^FREEFORM_WIDTH=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_FREEFORM_HEIGHT=$(grep '^FREEFORM_HEIGHT=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_FREEFORM_OFFSET_X=$(grep '^FREEFORM_OFFSET_X=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_FREEFORM_OFFSET_Y=$(grep '^FREEFORM_OFFSET_Y=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_LOW_SERVER=$(grep '^JOIN_LOW_SERVER=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    DEFAULT_LOW_MIN=$(grep '^LOW_SERVER_MIN_PLAYERS=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    DEFAULT_LOW_MAX=$(grep '^LOW_SERVER_MAX_PLAYERS=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    DEFAULT_LOW_STRICT=$(grep '^LOW_SERVER_STRICT=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    DEFAULT_LOW_PICK_RETRIES=$(grep '^LOW_SERVER_PICK_RETRIES=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    DEFAULT_LOW_PICK_RETRY_DELAY=$(grep '^LOW_SERVER_PICK_RETRY_DELAY=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    DEFAULT_ALLOW_UNSCOPED=$(grep '^ALLOW_UNSCOPED_DEEPLINK=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    DEFAULT_ALLOW_HOME=$(grep '^ALLOW_HOME_FALLBACK=' config.cfg | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
fi

echo -e "${BGRN}+------------------------------------------------------+${NC}"
echo -e "${BGRN}|       KHOI DONG BOT CHO TUNG TAI KHOAN               |${NC}"
echo -e "${BGRN}+------------------------------------------------------+${NC}"

COUNT=1
TOTAL=$(echo "$PACKAGES" | wc -w)
SETUP_LAUNCH_DELAY="${AUTO_REJOIN_SETUP_LAUNCH_DELAY:-${SETUP_LAUNCH_DELAY:-3}}"
case "$SETUP_LAUNCH_DELAY" in
    ''|*[!0-9]*) SETUP_LAUNCH_DELAY=3 ;;
esac
MULTI_PUBLIC_LOW_SERVER_DEFAULT=false
if [ "$TOTAL" -gt 1 ] && [ -z "$PRIVATE_CODE" ]; then
    MULTI_PUBLIC_LOW_SERVER_DEFAULT=true
fi

for PKG in $PACKAGES; do
    CFG="config_${PKG}.cfg"
    LOG="roblox_${PKG}.log"
    WIN="${PKG//./_}"
    SAVED_USERNAME=""

    EXISTING_PLACE_ID=""
    EXISTING_PRIVATE_CODE=""
    EXISTING_USERNAME=""
    EXISTING_WEBHOOK=""
    EXISTING_CHECK_INTERVAL=""
    EXISTING_AUTO_RESTART=""
    EXISTING_ANTI_AFK=""
    EXISTING_TAP_INTERVAL=""
    EXISTING_TAP_X=""
    EXISTING_TAP_Y=""
    EXISTING_FREEFORM_LAYOUT=""
    EXISTING_FREEFORM_WIDTH=""
    EXISTING_FREEFORM_HEIGHT=""
    EXISTING_FREEFORM_OFFSET_X=""
    EXISTING_FREEFORM_OFFSET_Y=""
    EXISTING_LOW_SERVER=""
    EXISTING_LOW_MIN=""
    EXISTING_LOW_MAX=""
    EXISTING_LOW_STRICT=""
    EXISTING_LOW_PICK_RETRIES=""
    EXISTING_LOW_PICK_RETRY_DELAY=""
    EXISTING_ALLOW_UNSCOPED=""
    EXISTING_ALLOW_HOME=""
    # Khoá kết nối ShopRoblox riêng của tab (ORDER_ID, ghi đè token...): giữ nguyên khi ghi lại config.
    EXISTING_SHOP_LINES=""

    if [ -f "$CFG" ]; then
        EXISTING_SHOP_LINES=$(grep -E '^(SHOP_API_URL|SHOP_WORKER_TOKEN|WORKER_ID|ORDER_ID|WORKER_HEARTBEAT_INTERVAL|ORDER_DONE_ACTION)=' "$CFG" 2>/dev/null | tr -d '\r')
        EXISTING_PLACE_ID=$(grep '^PLACE_ID=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
        EXISTING_PRIVATE_CODE=$(grep '^PRIVATE_CODE=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
        EXISTING_USERNAME=$(grep '^ROBLOX_USERNAME=' "$CFG" | cut -d'"' -f2 2>/dev/null)
        EXISTING_WEBHOOK=$(grep '^DISCORD_WEBHOOK=' "$CFG" | cut -d'"' -f2 2>/dev/null)
        EXISTING_CHECK_INTERVAL=$(grep '^CHECK_INTERVAL=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_AUTO_RESTART=$(grep '^AUTO_RESTART_PERIOD=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_ANTI_AFK=$(grep '^ANTI_AFK=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_TAP_INTERVAL=$(grep '^AFK_TAP_INTERVAL=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_TAP_X=$(grep '^TAP_X=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_TAP_Y=$(grep '^TAP_Y=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_FREEFORM_LAYOUT=$(grep '^FREEFORM_LAYOUT=' "$CFG" | cut -d'"' -f2 2>/dev/null)
        EXISTING_FREEFORM_WIDTH=$(grep '^FREEFORM_WIDTH=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_FREEFORM_HEIGHT=$(grep '^FREEFORM_HEIGHT=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_FREEFORM_OFFSET_X=$(grep '^FREEFORM_OFFSET_X=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_FREEFORM_OFFSET_Y=$(grep '^FREEFORM_OFFSET_Y=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_LOW_SERVER=$(grep '^JOIN_LOW_SERVER=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
        EXISTING_LOW_MIN=$(grep '^LOW_SERVER_MIN_PLAYERS=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
        EXISTING_LOW_MAX=$(grep '^LOW_SERVER_MAX_PLAYERS=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
        EXISTING_LOW_STRICT=$(grep '^LOW_SERVER_STRICT=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
        EXISTING_LOW_PICK_RETRIES=$(grep '^LOW_SERVER_PICK_RETRIES=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
        EXISTING_LOW_PICK_RETRY_DELAY=$(grep '^LOW_SERVER_PICK_RETRY_DELAY=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
        EXISTING_ALLOW_UNSCOPED=$(grep '^ALLOW_UNSCOPED_DEEPLINK=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
        EXISTING_ALLOW_HOME=$(grep '^ALLOW_HOME_FALLBACK=' "$CFG" | cut -d'=' -f2 | tr -d '"\r' 2>/dev/null)
    fi

    SAVED_USERNAME="${EXISTING_USERNAME:-}"

    # Lấy giá trị hiện tại (ưu tiên của account -> mặc định chung -> mặc định mặc định)
    DISCORD_WEBHOOK="${EXISTING_WEBHOOK:-$DEFAULT_WEBHOOK}"
    CHECK_INTERVAL="${EXISTING_CHECK_INTERVAL:-${DEFAULT_CHECK_INTERVAL:-30}}"
    if [ "$MULTI_PUBLIC_LOW_SERVER_DEFAULT" = "true" ] && { [ -z "$EXISTING_CHECK_INTERVAL" ] || [ "$EXISTING_CHECK_INTERVAL" = "30" ]; }; then
        CHECK_INTERVAL="${SETUP_CHECK_INTERVAL:-5}"
    fi
    AUTO_RESTART_PERIOD="${EXISTING_AUTO_RESTART:-${DEFAULT_AUTO_RESTART:-0}}"
    ANTI_AFK="${EXISTING_ANTI_AFK:-${DEFAULT_ANTI_AFK:-true}}"
    AFK_TAP_INTERVAL="${EXISTING_TAP_INTERVAL:-${DEFAULT_TAP_INTERVAL:-180}}"
    TAP_X="${EXISTING_TAP_X:-${DEFAULT_TAP_X:-540}}"
    TAP_Y="${EXISTING_TAP_Y:-${DEFAULT_TAP_Y:-960}}"
    FREEFORM_LAYOUT="${EXISTING_FREEFORM_LAYOUT:-${DEFAULT_FREEFORM_LAYOUT:-false}}"
    FREEFORM_WIDTH="${EXISTING_FREEFORM_WIDTH:-${DEFAULT_FREEFORM_WIDTH:-540}}"
    FREEFORM_HEIGHT="${EXISTING_FREEFORM_HEIGHT:-${DEFAULT_FREEFORM_HEIGHT:-960}}"
    FREEFORM_OFFSET_X="${EXISTING_FREEFORM_OFFSET_X:-${DEFAULT_FREEFORM_OFFSET_X:-60}}"
    FREEFORM_OFFSET_Y="${EXISTING_FREEFORM_OFFSET_Y:-${DEFAULT_FREEFORM_OFFSET_Y:-80}}"
    LICENSE_MODE="$SETUP_LICENSE_MODE"
    LICENSE_API="$SETUP_LICENSE_API"
    if [ -n "$SETUP_JOIN_LOW_SERVER" ]; then
        JOIN_LOW_SERVER="$SETUP_JOIN_LOW_SERVER"
    elif [ "$MULTI_PUBLIC_LOW_SERVER_DEFAULT" = "true" ]; then
        JOIN_LOW_SERVER=true
    else
        JOIN_LOW_SERVER="${EXISTING_LOW_SERVER:-${DEFAULT_LOW_SERVER:-false}}"
    fi
    LOW_SERVER_MIN_PLAYERS="${SETUP_LOW_SERVER_MIN_PLAYERS:-${EXISTING_LOW_MIN:-${DEFAULT_LOW_MIN:-1}}}"
    LOW_SERVER_MAX_PLAYERS="${SETUP_LOW_SERVER_MAX_PLAYERS:-${EXISTING_LOW_MAX:-${DEFAULT_LOW_MAX:-0}}}"
    LOW_SERVER_PICK_RETRIES="${SETUP_LOW_SERVER_PICK_RETRIES:-${EXISTING_LOW_PICK_RETRIES:-${DEFAULT_LOW_PICK_RETRIES:-4}}}"
    LOW_SERVER_PICK_RETRY_DELAY="${SETUP_LOW_SERVER_PICK_RETRY_DELAY:-${EXISTING_LOW_PICK_RETRY_DELAY:-${DEFAULT_LOW_PICK_RETRY_DELAY:-2}}}"
    if [ -n "$SETUP_LOW_SERVER_STRICT" ]; then
        LOW_SERVER_STRICT="$SETUP_LOW_SERVER_STRICT"
    elif [ "$JOIN_LOW_SERVER" = "true" ] && [ "$MULTI_PUBLIC_LOW_SERVER_DEFAULT" = "true" ]; then
        LOW_SERVER_STRICT=true
    else
        LOW_SERVER_STRICT="${EXISTING_LOW_STRICT:-${DEFAULT_LOW_STRICT:-false}}"
    fi
    ALLOW_UNSCOPED_DEEPLINK="${SETUP_ALLOW_UNSCOPED_DEEPLINK:-${EXISTING_ALLOW_UNSCOPED:-${DEFAULT_ALLOW_UNSCOPED:-false}}}"
    ALLOW_HOME_FALLBACK="${SETUP_ALLOW_HOME_FALLBACK:-${EXISTING_ALLOW_HOME:-${DEFAULT_ALLOW_HOME:-false}}}"

    cat > "$CFG" <<EOF
PLACE_ID="$PLACE_ID"
PRIVATE_CODE="$PRIVATE_CODE"
ROBLOX_PACKAGE="$PKG"
CHECK_INTERVAL=$CHECK_INTERVAL
AUTO_RESTART_PERIOD=$AUTO_RESTART_PERIOD
ANTI_AFK=$ANTI_AFK
AFK_TAP_INTERVAL=$AFK_TAP_INTERVAL
TAP_X=$TAP_X
TAP_Y=$TAP_Y
DISCORD_WEBHOOK="$DISCORD_WEBHOOK"
ROBLOX_USERNAME="${SAVED_USERNAME}"
FREEFORM_LAYOUT="$FREEFORM_LAYOUT"
FREEFORM_WIDTH=$FREEFORM_WIDTH
FREEFORM_HEIGHT=$FREEFORM_HEIGHT
FREEFORM_OFFSET_X=$FREEFORM_OFFSET_X
FREEFORM_OFFSET_Y=$FREEFORM_OFFSET_Y
LICENSE_MODE=$LICENSE_MODE
LICENSE_API="$LICENSE_API"
JOIN_LOW_SERVER=$JOIN_LOW_SERVER
LOW_SERVER_MIN_PLAYERS=$LOW_SERVER_MIN_PLAYERS
LOW_SERVER_MAX_PLAYERS=$LOW_SERVER_MAX_PLAYERS
LOW_SERVER_STRICT=$LOW_SERVER_STRICT
LOW_SERVER_PICK_RETRIES=$LOW_SERVER_PICK_RETRIES
LOW_SERVER_PICK_RETRY_DELAY=$LOW_SERVER_PICK_RETRY_DELAY
ALLOW_UNSCOPED_DEEPLINK=$ALLOW_UNSCOPED_DEEPLINK
ALLOW_HOME_FALLBACK=$ALLOW_HOME_FALLBACK
EXECUTOR="$EXECUTOR_TYPE"
EOF
    if [ -n "$EXISTING_SHOP_LINES" ]; then
        printf '%s\n' "$EXISTING_SHOP_LINES" >> "$CFG"
        chmod 600 "$CFG" 2>/dev/null
    fi

    progress_bar $COUNT $TOTAL "Khởi động acc $COUNT/$TOTAL..."

    if [ $COUNT -eq 1 ]; then
        tmux new-session -d -s roblox-multi -n "$WIN" 2>/dev/null
    else
        tmux new-window -t roblox-multi -n "$WIN" 2>/dev/null
    fi
    tmux set-window-option -t "roblox-multi:${WIN}" automatic-rename off 2>/dev/null
    tmux set-window-option -t "roblox-multi:${WIN}" remain-on-exit on 2>/dev/null
    tmux respawn-pane -k -t "roblox-multi:${WIN}" -c "$PWD" \
	    "CONFIG_FILE=\"$CFG\" LOG_FILE=\"$LOG\" STATS_FILE=\"roblox_stats_${PKG}.dat\" bash auto_rejoin.sh --run" 2>/dev/null

    UNAME_DISPLAY="${SAVED_USERNAME:-N/A}"
    printf "  ${BGRN}✓${NC} Acc ${YLW}%2d${NC}: ${CYN}%-26s${NC} ${GRN}%-10s${NC}\n" \
        "$COUNT" "$PKG" "[$UNAME_DISPLAY]"
    COUNT=$((COUNT+1))

    # Delay ngan truoc khi mo acc tiep theo; co the override bang AUTO_REJOIN_SETUP_LAUNCH_DELAY.
    if [ $COUNT -le $TOTAL ]; then
        i="$SETUP_LAUNCH_DELAY"
        while [ "$i" -gt 0 ]; do
            printf "\r\033[K  ${YLW}⏳ Chờ %ds trước khi mở acc tiếp theo...${NC}" "$i"
            sleep 1
            i=$((i - 1))
        done
        printf "\r\033[K"
    fi
done



# ── WATCHDOG: Tab riêng giám sát TẤT CẢ các bot ────────
# Nếu bản thân script bot bị crash trong tmux → watchdog restart nó
tmux new-window -t roblox-multi -n "WATCHDOG" 2>/dev/null

# Tạo danh sách tất cả package để watchdog theo dõi
ALL_PKGS_LINE="$PACKAGES"
ALL_CFGS_LINE=""
for PKG in $PACKAGES; do
    CFG="config_${PKG}.cfg"
    LOG="roblox_${PKG}.log"
    ALL_CFGS_LINE="$ALL_CFGS_LINE $CFG:$PKG:$LOG"
done

# Ghi script watchdog vào file tạm rồi chạy
cat > "${TMP_DIR}/watchdog_roblox.sh" << 'WDEOF'
#!/bin/bash
BGRN='\033[1;32m'; GRN='\033[0;32m'; RED='\033[0;31m'; YLW='\033[0;33m'; CYN='\033[0;36m'; NC='\033[0m'
ALL_CFGS="$1"   # Danh sách "cfg:pkg:log" cách nhau bằng space
EXECUTOR="$2"   # Kiểu thực thi (su, adb, direct)
PROJECT_DIR="$3" # Thư mục dự án
TMP_DIR="${PROJECT_DIR}/tmp"
mkdir -p "$TMP_DIR"

if [ -f "${PROJECT_DIR}/lib/android.sh" ]; then
    # shellcheck source=lib/android.sh
    source "${PROJECT_DIR}/lib/android.sh"
    android_set_executor "$EXECUTOR"
else
    echo "[WATCHDOG] Missing ${PROJECT_DIR}/lib/android.sh; cannot run Android status cache safely." >&2
    exit 1
fi

echo -e "${BGRN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║       WATCHDOG - GIÁM SÁT TẤT CẢ BOT        ║${NC}"
echo -e "${BGRN}║   Kiểm tra mỗi 15s, tự restart bot chết     ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════╝${NC}"
echo ""

while true; do
    TS=$(date '+%H:%M:%S')
    echo -e "${CYN}[$TS]${NC} Đang cập nhật status cache & kiểm tra ${YLW}$(echo $ALL_CFGS | wc -w)${NC} bot..."

    # 1. Cập nhật dumpsys dùng chung cho các bot (giảm tải tối đa cho CPU)
    android_dumpsys activity activities > "${TMP_DIR}/roblox_activities.tmp" 2>/dev/null
    if [ -s "${TMP_DIR}/roblox_activities.tmp" ]; then
        mv "${TMP_DIR}/roblox_activities.tmp" "${TMP_DIR}/roblox_activities.txt"
    fi

    android_dumpsys window windows > "${TMP_DIR}/roblox_windows.tmp" 2>/dev/null
    if [ -s "${TMP_DIR}/roblox_windows.tmp" ]; then
        mv "${TMP_DIR}/roblox_windows.tmp" "${TMP_DIR}/roblox_windows.txt"
    fi

    # 2. Kiểm tra sống chết của từng bot
    for ENTRY in $ALL_CFGS; do
        CFG=$(echo "$ENTRY" | cut -d: -f1)
        PKG=$(echo "$ENTRY" | cut -d: -f2)
        LOG=$(echo "$ENTRY" | cut -d: -f3)
        WIN="${PKG//./_}"

        # Kiểm tra tmux window của acc này có còn chạy bot không
        # Dấu hiệu: pane của window không có tiến trình bash/auto_rejoin
        WIN_PANE=$(tmux list-panes -t "roblox-multi:${WIN}" -F "#{pane_current_command}" 2>/dev/null)

        bot_running=false
        if [ -n "$WIN_PANE" ]; then
            pid=""
            [ -f "${TMP_DIR}/roblox_bot_${WIN}.pid" ] && pid=$(cat "${TMP_DIR}/roblox_bot_${WIN}.pid" 2>/dev/null)
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                bot_running=true
            fi
        fi

	        heartbeat_file="${TMP_DIR}/heartbeat_${PKG}.dat"
	        heartbeat_stale=false
	        if [ "$bot_running" = "true" ]; then
	            now=$(date +%s)
	            check_interval=$(grep '^CHECK_INTERVAL=' "${PROJECT_DIR}/${CFG}" 2>/dev/null | cut -d= -f2 | tr -dc '0-9')
	            stale_limit=$(grep '^HEARTBEAT_STALE_SECONDS=' "${PROJECT_DIR}/${CFG}" 2>/dev/null | cut -d= -f2 | tr -dc '0-9')
	            [ -n "$check_interval" ] || check_interval=30
	            [ -n "$stale_limit" ] || stale_limit=0
	            if [ "$stale_limit" -le 0 ]; then
	                stale_limit=$((check_interval * 3))
	                [ "$stale_limit" -lt 45 ] && stale_limit=45
	            fi
	            hb_ts=$(grep '^timestamp=' "$heartbeat_file" 2>/dev/null | tail -n 1 | cut -d= -f2 | tr -dc '0-9')
	            if [ -n "$hb_ts" ] && [ "$((now - hb_ts))" -gt "$stale_limit" ]; then
	                heartbeat_stale=true
	                echo -e "  ${RED}[WATCHDOG]${NC} Bot '${WIN}' heartbeat stale $((now - hb_ts))s > ${stale_limit}s; restart monitor only..."
	            elif [ -z "$hb_ts" ]; then
	                pane_age_ok=true
	            fi
	        fi

	        if [ "$bot_running" = "false" ] || [ "$heartbeat_stale" = "true" ]; then
	            if [ "$bot_running" = "false" ]; then
	                echo -e "  ${RED}[WATCHDOG]${NC} Bot '${WIN}' không chạy! Đang khởi động lại..."
	            fi
	            if [ -z "$WIN_PANE" ]; then
	                tmux new-window -t roblox-multi -n "$WIN" 2>/dev/null
	                tmux set-window-option -t "roblox-multi:${WIN}" automatic-rename off 2>/dev/null
	                tmux set-window-option -t "roblox-multi:${WIN}" remain-on-exit on 2>/dev/null
	            fi
	            tmux respawn-pane -k -t "roblox-multi:${WIN}" -c "$PROJECT_DIR" \
	                "CONFIG_FILE=\"$CFG\" LOG_FILE=\"$LOG\" STATS_FILE=\"roblox_stats_${PKG}.dat\" bash auto_rejoin.sh --run" 2>/dev/null
	            echo -e "  ${GRN}[WATCHDOG]${NC} Đã restart monitor cho: ${CYN}$PKG${NC} (không force-stop Roblox)"
	        else
	            echo -e "  ${GRN}  ✓${NC} $PKG → ${GRN}OK${NC}"
	        fi
    done

    echo ""
    sleep 15
done
WDEOF
chmod +x "${TMP_DIR}/watchdog_roblox.sh"

tmux send-keys -t "roblox-multi:WATCHDOG" \
    "bash \"${TMP_DIR}/watchdog_roblox.sh\" '${ALL_CFGS_LINE}' '${EXECUTOR_TYPE}' '${PWD}'" C-m 2>/dev/null

printf "${BGRN}║${NC}  ${BGRN}✓${NC} ${YLW}WATCHDOG${NC}: Giám sát toàn bộ ${YLW}$((COUNT-1))${NC} acc          ${BGRN}║${NC}\n"


echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Beep thành công
printf '\a'

echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║   ✅  THIẾT LẬP HOÀN TẤT THÀNH CÔNG!            ║${NC}"
echo -e "${BGRN}╠══════════════════════════════════════════════════╣${NC}"
printf  "${BGRN}║${NC}  ${BGRN}✓${NC} Đã khởi động ${YLW}%-3s${NC} tài khoản đang chạy ngầm  ${BGRN}║${NC}\n" "$((COUNT-1))"
echo -e "${BGRN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${BGRN}║${NC}  ${WHT}Xem tab tmux:${NC}  ${YLW}tmux attach -t roblox-multi${NC}      ${BGRN}║${NC}"
echo -e "${BGRN}║${NC}  ${WHT}Mở menu:${NC}       ${YLW}bash auto_rejoin.sh${NC}               ${BGRN}║${NC}"
echo -e "${BGRN}║${NC}  ${WHT}Thoát tmux:${NC}    ${YLW}Ctrl+B rồi D${NC}                      ${BGRN}║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$AUTO_REJOIN_PARENT" != "true" ]; then
    MENU_PROMPT_TIMEOUT="${AUTO_REJOIN_MENU_PROMPT_TIMEOUT:-${MENU_PROMPT_TIMEOUT:-8}}"
    case "$MENU_PROMPT_TIMEOUT" in
        ''|*[!0-9]*) MENU_PROMPT_TIMEOUT=8 ;;
    esac

    echo -ne "${WHT}Mở Menu điều khiển ngay? (y/N, tự bỏ qua sau ${MENU_PROMPT_TIMEOUT}s): ${NC}"
    if ! read -r -t "$MENU_PROMPT_TIMEOUT" run_now; then
        run_now=""
        printf "\n"
    fi
    if [ "$run_now" = "y" ] || [ "$run_now" = "Y" ]; then
        bash auto_rejoin.sh
    fi
fi
