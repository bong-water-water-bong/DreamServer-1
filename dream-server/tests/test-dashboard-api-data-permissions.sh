#!/usr/bin/env bash
# ============================================================================
# Dream Server dashboard-api data permission contract tests
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DOCKERFILE="$ROOT_DIR/extensions/services/dashboard-api/Dockerfile"
ENTRYPOINT="$ROOT_DIR/extensions/services/dashboard-api/docker-entrypoint.sh"
WINDOWS_PHASE_06="$ROOT_DIR/installers/windows/phases/06-directories.ps1"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
PASS=0
FAIL=0

pass() { echo -e "  ${GREEN}PASS${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL + 1)); }

check() {
    local pattern="$1" file="$2" label="$3"
    if grep -Fq -- "$pattern" "$file"; then
        pass "$label"
    else
        fail "$label"
    fi
}

reject() {
    local pattern="$1" file="$2" label="$3"
    if grep -Fq -- "$pattern" "$file"; then
        fail "$label"
    else
        pass "$label"
    fi
}

echo ""
echo "=== dashboard-api data permission contract tests ==="
echo ""

[[ -f "$DOCKERFILE" ]] && pass "dashboard-api Dockerfile exists" || fail "dashboard-api Dockerfile missing"
[[ -f "$ENTRYPOINT" ]] && pass "dashboard-api entrypoint exists" || fail "dashboard-api entrypoint missing"
[[ -f "$WINDOWS_PHASE_06" ]] && pass "Windows phase 06 exists" || fail "Windows phase 06 missing"

check 'gosu' "$DOCKERFILE" "Dockerfile installs gosu for privilege drop"
check 'COPY docker-entrypoint.sh /usr/local/bin/dashboard-api-entrypoint' "$DOCKERFILE" "Dockerfile copies data-permission entrypoint"
check 'ENTRYPOINT ["dashboard-api-entrypoint"]' "$DOCKERFILE" "Dockerfile starts through entrypoint"
reject 'USER dreamer' "$DOCKERFILE" "Dockerfile does not bypass entrypoint by starting as dreamer"

check 'mkdir -p /data /data/auth /data/user-extensions /data/extension-progress' "$ENTRYPOINT" "entrypoint creates dashboard-api writable state dirs"
check 'touch /data/.extensions-lock' "$ENTRYPOINT" "entrypoint pre-creates extension lock"
check 'printf '\''{"lifetime":0,"last_server_counter":0}\n'\'' > /data/token_counter.json' "$ENTRYPOINT" "entrypoint initializes token counter JSON"
check 'printf '\''{}\n'\'' > /data/model_performance.json' "$ENTRYPOINT" "entrypoint initializes performance JSON"
check 'chown dreamer:dreamer /data' "$ENTRYPOINT" "entrypoint repairs /data ownership for Docker Desktop bind mounts"
check 'exec gosu dreamer "$@"' "$ENTRYPOINT" "entrypoint drops privileges before uvicorn"

check '(Join-Path $_dataDir "auth")' "$WINDOWS_PHASE_06" "Windows installer creates data/auth"
check '(Join-Path $_dataDir "user-extensions")' "$WINDOWS_PHASE_06" "Windows installer creates data/user-extensions"
check '(Join-Path $_dataDir "extension-progress")' "$WINDOWS_PHASE_06" "Windows installer creates data/extension-progress"

echo ""
echo "Result: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
