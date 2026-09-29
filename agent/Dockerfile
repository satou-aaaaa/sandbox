# エージェント実行用の隔離イメージ（agent/run.mjs が `docker run` で使う）。
# 作業ツリー（/workspace）だけをマウントし、GitHub認証情報・ホストのHOMEは含めない。
# 実行時の制限（--read-only / --cap-drop ALL 等）は policy.js の buildDockerArgs を参照。
FROM node:22-bookworm-slim

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
