# Cloud image for the learning server (see docs/plans/cloud-deployment.md).
# The image holds only the toolchain; the app runs from a git clone on the /data volume, so "deployed" == "main".
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git openssh-client curl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

# Pinned so a CLI update can't silently change grading/prep behavior; bump deliberately.
ARG CLAUDE_CODE_VERSION=2.1.288
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} && claude --version

# GitHub's published SSH host keys (from `gh api meta`), so the deploy key is only ever offered to GitHub.
COPY deploy/github_known_hosts /etc/ssh/github_known_hosts
COPY deploy/entrypoint.sh deploy/server-loop.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/entrypoint.sh /usr/local/bin/server-loop.sh

ENV REPOSITORY_DIRECTORY=/data/repo \
    REPOSITORY_SSH_URL=git@github.com:alexchao/self-learning.git \
    PORT=8080 \
    HOST=0.0.0.0 \
    GIT_SYNC=on \
    DISABLE_AUTOUPDATER=1

# tini reaps the detached prep processes and forwards stop signals to the whole process group.
ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]
