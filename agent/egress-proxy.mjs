#!/usr/bin/env node
/**
 * 許可リスト方式の外向きプロキシ（HTTPS CONNECT のみ）。#115・ADR-0017 Amendment 28。
 *
 * 隔離コンテナ（内部ネットワーク）は外への直接の経路を持たず、このプロキシ経由でだけ外へ出る。
 * 通すのは policy.js の EGRESS_ALLOWED_HOSTS（npmレジストリ・Anthropic API）の 443 だけ。それ以外は 403。
 * 中身の検査はしない（TLSのまま中継）。宛先の制限により、コンテナ内のコードが任意の外部へデータを送る経路を塞ぐ。
 */
import http from "node:http";
import net from "node:net";
import { EGRESS_PROXY_PORT, isAllowedEgress } from "./policy.js";

const server = http.createServer((req, res) => {
  // HTTPS（CONNECT）以外は許可しない
  console.error(`DENY http ${req.method} ${req.headers.host ?? ""}`);
  res.writeHead(403).end("forbidden");
});

server.on("connect", (req, clientSocket, head) => {
  const [host, port] = String(req.url ?? "").split(":");
  if (!isAllowedEgress(host, port)) {
    console.error(`DENY ${req.url}`);
    clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  const upstream = net.connect(Number(port), host, () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  const close = () => {
    upstream.destroy();
    clientSocket.destroy();
  };
  upstream.on("error", close);
  clientSocket.on("error", close);
  upstream.setTimeout(10 * 60 * 1000, close);
});

server.listen(EGRESS_PROXY_PORT, "0.0.0.0", () => console.error(`許可リストのプロキシを起動しました（:${EGRESS_PROXY_PORT}）`));
