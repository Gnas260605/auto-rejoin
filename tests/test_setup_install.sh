#!/usr/bin/env bash
# setup.sh phải cài "tất cả hoặc không gì cả", ghim mọi file về cùng 1 commit SHA,
# và không bao giờ để lại bộ file trộn cũ/mới.
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="${ROOT_DIR}/tmp/test_setup_install"
FAKE_SHA="0123456789abcdef0123456789abcdef01234567"

PASS_COUNT=0
FAIL_COUNT=0
pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }
assert_eq() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 expected=[$2] actual=[$3]"; fi; }

LIBS="config.sh android.sh network.sh logger.sh runtime.sh roblox_session.sh session_evidence.sh roblox_api.sh notification.sh monitor.sh roblox.sh doctor.sh ui.sh profile.sh installer.sh license.sh entitlement.sh updater.sh cookie.sh delta.sh worker.sh"

# Ghi 1 bộ cài hoàn chỉnh vào $1, đánh dấu bằng $2 (OLD/NEW).
write_install() {
    local dir="$1" mark="$2" f
    mkdir -p "$dir/lib" "$dir/bin"
    printf '#!/usr/bin/env bash\n# %s\nexit 0\n' "$mark" > "$dir/auto_rejoin.sh"
    printf '#!/usr/bin/env bash\n# %s\nexit 0\n' "$mark" > "$dir/bin/roblox-manager"
    for f in $LIBS; do printf '#!/usr/bin/env bash\n# %s\n' "$mark" > "$dir/lib/$f"; done
    cat >> "$dir/lib/android.sh" <<'EOF'
android_detect_executor() { printf 'direct\n'; }
android_set_executor() { :; }
android_list_packages() { printf 'package:com.roblox.client\n'; }
EOF
}

setup_case() {
    rm -rf "$TEST_TMP"
    mkdir -p "$TEST_TMP/app" "$TEST_TMP/remote" "$TEST_TMP/app/fakebin"
    cp "${ROOT_DIR}/setup.sh" "$TEST_TMP/app/setup.sh"
    write_install "$TEST_TMP/remote" NEW
    printf '9.9.9\n' > "$TEST_TMP/remote/VERSION"

    local b
    for b in dpkg tmux sleep clear; do printf '#!/usr/bin/env bash\nexit 0\n' > "$TEST_TMP/app/fakebin/$b"; done
    # curl giả: API commits -> SHA; raw.githubusercontent.com/<repo>/<ref>/<path> -> file trong remote/.
    cat > "$TEST_TMP/app/fakebin/curl" <<EOF
#!/usr/bin/env bash
out=""; url=""
while [ "\$#" -gt 0 ]; do
    case "\$1" in
        -o) out="\$2"; shift 2 ;;
        -H|--connect-timeout|--max-time|--retry|--retry-delay) shift 2 ;;
        -*) shift ;;
        *) url="\$1"; shift ;;
    esac
done
printf '%s\n' "\$url" >> "$TEST_TMP/curl.log"
case "\$url" in
    https://api.github.com/*/commits/*) [ "\${FAKE_API_DOWN:-false}" = true ] && exit 22; printf '%s' "$FAKE_SHA"; exit 0 ;;
    https://raw.githubusercontent.com/*)
        rel="\${url#https://raw.githubusercontent.com/Gnas260605/auto-rejoin/}"
        rel="\${rel#*/}"
        [ -f "$TEST_TMP/remote/\$rel" ] || exit 22
        cp "$TEST_TMP/remote/\$rel" "\$out"; exit 0 ;;
esac
exit 22
EOF
    chmod +x "$TEST_TMP/app/fakebin/"*
}

run_setup() {
    (cd "$TEST_TMP/app" && PATH="./fakebin:${PATH}" AUTO_REJOIN_PARENT=true "$@" bash setup.sh 123456 >/dev/null 2>&1)
}

marks() {
    grep -h -E '^# (OLD|NEW)$' "$TEST_TMP/app/auto_rejoin.sh" "$TEST_TMP/app/bin/roblox-manager" "$TEST_TMP/app"/lib/*.sh 2>/dev/null \
        | sort | uniq -c | awk '{printf "%s=%s ", $3, $1}'
}

# A. Cài mới thành công: mọi file là NEW, VERSION mới, mọi URL raw ghim cùng SHA.
setup_case
write_install "$TEST_TMP/app" OLD
run_setup env
assert_eq "A tat ca file duoc cap nhat" "NEW=23 " "$(marks)"
assert_eq "A VERSION theo snapshot" "9.9.9" "$(tr -d '\r\n' < "$TEST_TMP/app/VERSION")"
unpinned="$(grep raw.githubusercontent "$TEST_TMP/curl.log" | grep -vc "/${FAKE_SHA}/")"
assert_eq "A moi URL ghim ve commit SHA" "0" "$unpinned"
[ ! -d "$TEST_TMP/app/tmp" ] || [ -z "$(ls -d "$TEST_TMP/app/tmp/setup-stage."* 2>/dev/null)" ] && pass "A don thu muc stage" || fail "A con thu muc stage"

# B. Thiếu 1 file trên remote: không file nào bị thay (không trộn cũ/mới), setup vẫn chạy bằng bản local.
setup_case
write_install "$TEST_TMP/app" OLD
rm -f "$TEST_TMP/remote/lib/monitor.sh"
run_setup env; status=$?
assert_eq "B giu nguyen toan bo ban cu" "OLD=23 " "$(marks)"
assert_eq "B setup van thanh cong voi ban local" "0" "$status"

# C. File tải về hỏng (vd trang lỗi HTML): huỷ cập nhật.
setup_case
write_install "$TEST_TMP/app" OLD
printf '<html><body>rate limited (</body></html>\n' > "$TEST_TMP/remote/lib/runtime.sh"
run_setup env
assert_eq "C file hong -> giu ban cu" "OLD=23 " "$(marks)"

# D. Chưa có bản cài + không tải được: dừng với mã lỗi.
setup_case
rm -rf "$TEST_TMP/remote/lib"
run_setup env; status=$?
[ "$status" -ne 0 ] && pass "D khong co ban cai -> exit loi" || fail "D khong co ban cai -> exit loi"

# E. GitHub API lỗi: vẫn cài được bằng ref gốc.
setup_case
write_install "$TEST_TMP/app" OLD
run_setup env FAKE_API_DOWN=true AUTO_REJOIN_REF=v1.2.3
assert_eq "E API loi van cai duoc" "NEW=23 " "$(marks)"
assert_eq "E dung ref goc" "0" "$(grep raw.githubusercontent "$TEST_TMP/curl.log" | grep -vc '/v1.2.3/')"

# F. Remote trả CRLF: được chuẩn hoá về LF trước khi cài.
setup_case
write_install "$TEST_TMP/app" OLD
sed -i 's/$/\r/' "$TEST_TMP/remote/lib/monitor.sh"
run_setup env
assert_eq "F file CRLF duoc chuan hoa LF" "0" "$(tr -cd '\r' < "$TEST_TMP/app/lib/monitor.sh" | wc -c | tr -d ' ')"

rm -rf "$TEST_TMP"
printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
