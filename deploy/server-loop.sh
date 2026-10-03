#!/bin/sh
# Runs as `node`: clone or update the repo on the volume, install/build when needed, run the server, and restart it
# when it exits. Exit code 75 means "new code was pulled" (cloudUpdateService.ts); anything else is a crash.
set -u

export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/deploy_key -o IdentitiesOnly=yes -o UserKnownHostsFile=/etc/ssh/github_known_hosts -o StrictHostKeyChecking=yes"
log() { echo "[server-loop] $*"; }

if [ ! -d "$REPOSITORY_DIRECTORY/.git" ]; then
  log "first boot: cloning $REPOSITORY_SSH_URL"
  git clone "$REPOSITORY_SSH_URL" "$REPOSITORY_DIRECTORY" || exit 1
fi
cd "$REPOSITORY_DIRECTORY" || exit 1
git config user.name "study server"
git config user.email "study-server@users.noreply.github.com"
git config core.sshCommand "$GIT_SSH_COMMAND"
git config pull.rebase true
git pull --rebase --autostash origin main || log "pull failed; starting with the copy on the volume"

stamp_directory=.runtime/deploy-stamps
mkdir -p "$stamp_directory"

install_dependencies_if_changed() {
  lock_hash=$(sha256sum package-lock.json | cut -d' ' -f1)
  if [ ! -d node_modules ] || [ "$(cat "$stamp_directory/package-lock" 2>/dev/null)" != "$lock_hash" ]; then
    log "installing dependencies"
    npm ci --no-audit --no-fund && echo "$lock_hash" > "$stamp_directory/package-lock"
  fi
}

build_web_if_changed() {
  web_hash=$(git rev-parse HEAD:app/web HEAD:app/shared HEAD:package-lock.json | tr -d '\n')
  if [ ! -f app/web/dist/index.html ] || [ "$(cat "$stamp_directory/web" 2>/dev/null)" != "$web_hash" ]; then
    log "building the web app"
    npm run build:web --silent && echo "$web_hash" > "$stamp_directory/web"
  fi
}

trap 'log "stopping"; exit 0' TERM INT
while true; do
  install_dependencies_if_changed
  build_web_if_changed
  log "starting server at $(git rev-parse --short HEAD)"
  node_modules/.bin/tsx app/server/main.ts &
  server_pid=$!
  wait "$server_pid"
  exit_code=$?
  if [ "$exit_code" -eq 75 ]; then
    log "restarting for new code"
  else
    log "server exited with $exit_code; restarting in 5s"
    sleep 5
  fi
done
