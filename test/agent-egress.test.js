import { test } from "node:test";
import assert from "node:assert/strict";
import { EGRESS_NETWORK, EGRESS_PROXY_NAME, PROXIED_PHASES, buildDockerArgs, isAllowedEgress } from "../agent/policy.js";

const args = (phase, opts = {}) => buildDockerArgs({ phase, workDir: "/w", logDir: "/l", taskDir: "/t", auditName: "a.jsonl", ...opts });

test("isAllowedEgress: npmレジストリとAnthropic APIの443だけを許可し、他のホスト・ポートは拒否する", () => {
  assert.equal(isAllowedEgress("registry.npmjs.org", 443), true);
  assert.equal(isAllowedEgress("api.anthropic.com", "443"), true);
  assert.equal(isAllowedEgress("API.Anthropic.com.", 443), true);
  for (const [h, p] of [["example.com", 443], ["registry.npmjs.org", 80], ["evil-registry.npmjs.org.example.com", 443], ["registry.npmjs.org.evil.com", 443], ["", 443], ["api.anthropic.com", undefined]]) {
    assert.equal(isAllowedEgress(h, /** @type {any} */ (p)), false, `${h}:${p}`);
  }
});

test("buildDockerArgs: 通信が要るフェーズは内部ネットワーク＋プロキシ経由、通信が不要なフェーズは遮断（直接の外部経路を持たない）", () => {
  for (const phase of PROXIED_PHASES) {
    const a = args(phase).join(" ");
    assert.ok(a.includes(`--network ${EGRESS_NETWORK}`), phase);
    assert.ok(a.includes(`HTTPS_PROXY=http://${EGRESS_PROXY_NAME}:`), phase);
    assert.ok(a.includes("npm_config_https_proxy="), phase);
    assert.ok(!a.includes("--network bridge") && !a.includes("--network host"), phase);
  }
  for (const phase of ["verify", "mutation"]) assert.ok(args(phase).join(" ").includes("--network none"), phase);
});

test("buildDockerArgs: egressProxy=false（AGENT_EGRESS=open）なら、従来どおり既定のネットワーク（プロキシ設定なし）", () => {
  const a = args("install", { egressProxy: false }).join(" ");
  assert.ok(!a.includes("--network") && !a.includes("PROXY"));
});
