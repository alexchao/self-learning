#!/bin/sh
# Runs as root at boot: installs the deploy key for the unprivileged `node` user, then drops privileges.
set -eu

if [ -z "${GIT_DEPLOY_KEY_BASE64:-}" ]; then
  echo "[entrypoint] GIT_DEPLOY_KEY_BASE64 is not set (fly secrets); can't clone the repo." >&2
  exit 1
fi

install -d -m 700 -o node -g node /home/node/.ssh
echo "$GIT_DEPLOY_KEY_BASE64" | base64 -d > /home/node/.ssh/deploy_key
chmod 600 /home/node/.ssh/deploy_key
chown node:node /home/node/.ssh/deploy_key /data

# The key now lives in a file; keep it out of the server's environment (and everything it spawns).
exec setpriv --reuid=node --regid=node --init-groups \
  env -u GIT_DEPLOY_KEY_BASE64 HOME=/home/node \
  /usr/local/bin/server-loop.sh
