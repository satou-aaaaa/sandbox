# エージェント実行用の隔離イメージ（agent/run.mjs が `docker run` で使う）。
# 作業ツリー（/workspace）だけをマウントし、GitHub認証情報・ホストのHOMEは含めない。
# 実行時の制限（--read-only / --cap-drop ALL 等）は policy.js の buildDockerArgs を参照。
FROM node:26-bookworm-slim@sha256:662933cf47f013bc8e4beb31a6116448427a82057ba7c42c97e4c5ba766504c2

# Stryker（ミューテーション検査。#116）が `ps` でプロセスを管理するため、procps が必要（slimイメージには無い）
RUN apt-get update && apt-get install -y --no-install-recommends procps && rm -rf /var/lib/apt/lists/*

# 非rootで実行する（node ユーザー = uid 1000）
WORKDIR /agent
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY policy.js runner.mjs worker.mjs ./
RUN chown -R node:node /agent

USER node
ENV HOME=/home/node
WORKDIR /workspace
ENTRYPOINT ["node", "/agent/worker.mjs"]
