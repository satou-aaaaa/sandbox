/**
 * npm audit の結果を「この変更が持ち込んだもの」と「前からあるもの」に分ける（CI の npm audit の判定）。
 *
 * 【なぜ分けるか】
 * 2026-10-24、zod の高深刻度の脆弱性が新しく公表された日に、それと関係のない Dependabot の PR 5本
 * （jsdom・@playwright/test・docx・eslint・agent の SDK）が全部「npm audit（高深刻度以上）」で止まった。
 * 木全体を毎回調べると、PR の中身と関係なく、公表された時点で全 PR が赤になる。
 * GitHub の dependency review と同じく、PR では「その PR が持ち込んだ脆弱性」だけで止め、
 * 前からあるもの（main にもあるもの）は main の Test・Nightly で落として ci-failure の Issue にまとめる。
 *   https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review
 * main（push・schedule・手動）では基準を渡さないので、今までどおり木全体で判定する。
 */

/** @typedef {"info" | "low" | "moderate" | "high" | "critical"} Severity */

/**
 * @typedef {object} Advisory
 * @property {string} key 同じ脆弱性かを見分ける値（advisory の URL。無ければ パッケージ名+題）
 * @property {string} name パッケージ名
 * @property {Severity} severity
 * @property {string} title
 * @property {string} url
 * @property {string} range 影響を受ける版
 */

/** @type {Severity[]} */
export const SEVERITIES = ["info", "low", "moderate", "high", "critical"];

/**
 * @param {string} s
 * @returns {number} 知らない値は -1
 */
function rank(s) {
  return SEVERITIES.indexOf(/** @type {Severity} */ (s));
}

/**
 * `npm audit --json`（npm 7 以降の形）から、level 以上の advisory を取り出す。
 * via が文字列のもの（依存先経由で影響を受けるだけのもの）は、元の advisory 側で数えるので飛ばす。
 * @param {unknown} report `npm audit --json` を JSON.parse したもの
 * @param {Severity} level
 * @returns {Map<string, Advisory>}
 */
export function advisoriesAtOrAbove(report, level) {
  const min = rank(level);
  if (min < 0) throw new Error(`深刻度の指定が不正です: ${level}`);
  const vulns = /** @type {{ vulnerabilities?: unknown }} */ (report ?? {}).vulnerabilities;
  if (!vulns || typeof vulns !== "object") {
    throw new Error("npm audit の結果に vulnerabilities がありません（npm audit が失敗した可能性）");
  }
  /** @type {Map<string, Advisory>} */
  const out = new Map();
  for (const v of Object.values(vulns)) {
    const via = Array.isArray(v?.via) ? v.via : [];
    for (const a of via) {
      if (!a || typeof a !== "object") continue;
      if (rank(a.severity) < min) continue;
      const key = typeof a.url === "string" && a.url ? a.url : `${a.name}:${a.title}`;
      if (!out.has(key)) {
        out.set(key, {
          key,
          name: String(a.name ?? v.name ?? ""),
          severity: a.severity,
          title: String(a.title ?? ""),
          url: String(a.url ?? ""),
          range: String(a.range ?? ""),
        });
      }
    }
  }
  return out;
}

/**
 * head（この変更）と base（取り込み先）の advisory を比べる。
 * base が null（基準なし・main での実行）のときは、head の全部を「持ち込んだもの」として扱う。
 * @param {Map<string, Advisory>} head
 * @param {Map<string, Advisory> | null} base
 * @returns {{ introduced: Advisory[], existing: Advisory[] }}
 */
export function judge(head, base) {
  /** @type {Advisory[]} */
  const introduced = [];
  /** @type {Advisory[]} */
  const existing = [];
  for (const a of head.values()) {
    if (base && base.has(a.key)) existing.push(a);
    else introduced.push(a);
  }
  return { introduced, existing };
}

/**
 * @param {Advisory} a
 * @returns {string}
 */
export function formatAdvisory(a) {
  return `${a.name}（${a.severity}・${a.range}）${a.title} ${a.url}`.trim();
}
