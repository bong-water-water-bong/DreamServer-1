#!/bin/sh
set -eu

if [ "$(id -u)" = "0" ]; then
    mkdir -p /data /data/auth /data/user-extensions /data/extension-progress
    touch /data/.extensions-lock
    [ -e /data/token_counter.json ] || printf '{"lifetime":0,"last_server_counter":0}\n' > /data/token_counter.json
    [ -e /data/model_performance.json ] || printf '{}\n' > /data/model_performance.json

    # Docker Desktop bind mounts can present Windows-owned data as root:root
    # 0755 inside Linux containers. Repair that mounted tree before uvicorn
    # starts so dashboard-api can persist auth, extension, and usage state
    # while still running as the unprivileged dreamer user.
    chown dreamer:dreamer /data \
        /data/auth \
        /data/user-extensions \
        /data/extension-progress \
        /data/.extensions-lock \
        /data/token_counter.json \
        /data/model_performance.json 2>/dev/null || true
    chmod u+rwx /data /data/auth /data/user-extensions /data/extension-progress 2>/dev/null || true

    exec gosu dreamer "$@"
fi

exec "$@"
