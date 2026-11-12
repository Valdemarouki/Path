FROM ghcr.io/paperclipai/paperclip-daytona-runner@sha256:b81a86d5242088f9d832666a411f09da7438d92e99f9962ccf88ebe439cd3b32

USER root

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      bubblewrap \
      uidmap \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/path-qa-tools \
 && cd /opt/path-qa-tools \
 && npm init -y >/dev/null 2>&1 \
 && npm install --save-exact playwright@1.65.0 \
 && chown -R daytona:daytona /opt/path-qa-tools \
 && chmod -R a+rX /opt/path-qa-tools

USER daytona

WORKDIR /home/daytona
