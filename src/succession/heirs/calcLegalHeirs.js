/**
 * 法定相続人・法定相続分の計算（本モジュールの中核）。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】民法887条（子及びその代襲者等の
 * 相続権）・889条（直系尊属及び兄弟姉妹の相続権）・891条（相続人の欠格
 * 事由）・892条・893条（推定相続人の廃除）・900条（法定相続分）・901条
 * （代襲相続人の相続分）・939条（相続の放棄の効力）の条文を確認し、
 * 以下の実装が条文と一致することを検証した。
 *
 * 計算は次の3段階で行う。
 * 1. **系統の解決（`resolveLine`）**: children・siblingsの各候補1人ずつ
 *    について、本人が有効な相続人かどうか、無効なら代襲相続人をたどって
 *    有効な相続人を探す（再帰）。系統内に有効な相続人が1人もいなければ
 *    空配列を返す。この「空配列を返す」という単純な仕組みだけで、
 *    相続放棄（代襲なし）・代襲相続人も全員無効（系統ごと消滅）の
 *    両方を、上位の配分ロジック側で自然に扱える設計にしている
 * 2. **順位の判定**: 子（代襲含む）が1人でもいれば第1順位で確定。
 *    いなければ直系尊属（親等最小の生存者）、それもいなければ兄弟姉妹
 *    （代襲含む）の順で判定する（民法887条〜890条の順位構造）
 * 3. **配偶者との組み合わせ**: 配偶者の生存有無と、上記で確定した血族側の
 *    区分（子／直系尊属／兄弟姉妹／なし）の組み合わせで、最終的な
 *    相続分（民法900条1〜4号）を確定する
 */
import { frac, mulFrac, sumFrac, formatFrac } from "./fraction.js";

const GENERAL_DISCLAIMER =
  "この計算結果は入力された家族構成情報に基づく機械的な試算です。" +
  "戸籍謄本等の収集・確認により、養子縁組・認知・重複する代襲関係等が" +
  "判明した場合、結果が変わる可能性があります。最終的な相続人の確定には、" +
  "必ず戸籍謄本等一式による裏付け確認を行ってください。";

/**
 * ある1人の相続人候補（子・兄弟姉妹の配列の要素）を、本人＋代襲相続人まで
 * 再帰的にたどり、「その人の系統に割り当てられる全体1のうちの取り分」を
 * 返す。系統内に有効な相続人が1人もいなければ空配列を返す（＝この系統は
 * 除外＝分母から外れる、という効果を上位の distributeEqually 側で
 * 自然に実現できる）。
 *
 * @param {import('../types.js').HeirCandidateInput} candidate
 * @param {{ allowReRepresentation: boolean }} opts
 *   allowReRepresentation: 子の代襲は孫→ひ孫と再帰的に続く（再代襲。
 *   887条3項）。兄弟姉妹の代襲は甥姪の1階層限り（889条2項は887条3項を
 *   準用しない）のため、兄弟姉妹側の呼び出しではfalseを渡す
 * @returns {{ personId: string, label?: string, share: import('./fraction.js').Fraction }[]}
 */
function resolveLine(candidate, opts) {
  if (candidate.hasRenounced) {
    // 相続放棄をした者は「初めから相続人でなかった」ものとみなされ
    // （民法939条）、代襲相続は発生しない（887条2項は死亡・891条該当・
    // 廃除のみを代襲原因とし、放棄を含まない）。
    return [];
  }
  const isEffectivelyDead = !candidate.isAlive || !!candidate.isSimultaneousDeath || !!candidate.isDisqualifiedOrDisinherited;
  if (!isEffectivelyDead) {
    return [{ personId: candidate.personId, label: candidate.label, share: frac(1, 1) }];
  }
  const substitutes = candidate.substitutes ?? [];
  if (substitutes.length === 0) return [];

  const resolvedSubLines = substitutes
    .map((s) => (opts.allowReRepresentation ? resolveLine(s, opts) : resolveTerminalSubstitute(s)))
    .filter((r) => r.length > 0);
  if (resolvedSubLines.length === 0) return []; // 代襲相続人も全員無効。この系統は分母から外れる

  const perLine = frac(1, resolvedSubLines.length);
  return resolvedSubLines.flatMap((line) => line.map((h) => ({ ...h, share: mulFrac(h.share, perLine) })));
}

/**
 * 兄弟姉妹の代襲相続人（甥・姪）は、本人がさらに死亡していてもその子への
 * 再代襲は生じない（889条2項は887条3項を準用しないため1階層限り）。
 * @param {import('../types.js').HeirCandidateInput} nephewOrNiece
 */
function resolveTerminalSubstitute(nephewOrNiece) {
  if (nephewOrNiece.hasRenounced) return [];
  if (!nephewOrNiece.isAlive || nephewOrNiece.isSimultaneousDeath || nephewOrNiece.isDisqualifiedOrDisinherited) return [];
  return [{ personId: nephewOrNiece.personId, label: nephewOrNiece.label, share: frac(1, 1) }];
}

/**
 * 複数の系統に、総取り分totalShareを均等配分する（子・直系尊属用）。
 * @param {ReturnType<typeof resolveLine>[]} lines
 * @param {import('./fraction.js').Fraction} totalShare
 */
function distributeEqually(lines, totalShare) {
  if (lines.length === 0) return [];
  const perLine = mulFrac(totalShare, frac(1, lines.length));
  return lines.flatMap((line) => line.map((h) => ({ ...h, share: mulFrac(h.share, perLine) })));
}

/**
 * 兄弟姉妹用: 全血=weight2、半血=weight1の比率で総取り分を配分する
 * （民法900条4号ただし書）。
 * @param {{ candidate: import('../types.js').HeirCandidateInput, resolved: ReturnType<typeof resolveLine> }[]} weightedLines
 * @param {import('./fraction.js').Fraction} totalShare
 */
function distributeSiblingLines(weightedLines, totalShare) {
  const validLines = weightedLines.filter((w) => w.resolved.length > 0);
  if (validLines.length === 0) return [];
  const totalWeight = validLines.reduce((sum, w) => sum + (w.candidate.siblingBloodType === "half" ? 1 : 2), 0);
  return validLines.flatMap((w) => {
    const weight = w.candidate.siblingBloodType === "half" ? 1 : 2;
    const lineShare = mulFrac(totalShare, frac(weight, totalWeight));
    return w.resolved.map((h) => ({ ...h, share: mulFrac(h.share, lineShare) }));
  });
}

/**
 * @param {import('../types.js').FamilyStructureInput} family
 * @returns {import('../types.js').LegalHeirsResult}
 */
export function calcLegalHeirs(family) {
  const warnings = [];
  const spouseAlive = !!family.hasSpouse && !!family.spouseIsAlive;

  // 第1順位: 子（代襲は孫→ひ孫と再帰的、887条2・3項）
  const childLines = (family.children ?? []).map((c) => resolveLine(c, { allowReRepresentation: true }));
  const validChildLines = childLines.filter((l) => l.length > 0);

  /** @type {ReturnType<typeof resolveLine>} */
  let bloodHeirs = [];
  let bloodRank = "なし";

  if (validChildLines.length > 0) {
    bloodRank = "子";
    bloodHeirs = distributeEqually(validChildLines, frac(1, 1));
  } else {
    // 第2順位: 直系尊属。親等が最も近い、生存かつ未放棄・欠格廃除に
    // 該当しない者のみが対象（直系尊属に代襲相続の概念はなく、単に
    // 近親者が優先するだけ。891条・892条・893条は続柄を問わず適用される
    // ため、子・兄弟姉妹と同様にisDisqualifiedOrDisinheritedも除外条件に
    // 含める）。
    const aliveAscendants = (family.ascendants ?? []).filter(
      (a) => a.isAlive && !a.hasRenounced && !a.isSimultaneousDeath && !a.isDisqualifiedOrDisinherited
    );
    if (aliveAscendants.length > 0) {
      const minDegree = Math.min(...aliveAscendants.map((a) => a.ascendantDegree ?? 1));
      const nearest = aliveAscendants.filter((a) => (a.ascendantDegree ?? 1) === minDegree);
      bloodRank = "直系尊属";
      bloodHeirs = distributeEqually(
        nearest.map((a) => [{ personId: a.personId, label: a.label, share: frac(1, 1) }]),
        frac(1, 1)
      );
    } else {
      // 第3順位: 兄弟姉妹（代襲は甥姪の1代限り。889条2項）
      const siblingLines = (family.siblings ?? []).map((s) => ({
        candidate: s,
        resolved: resolveLine(s, { allowReRepresentation: false }),
      }));
      if (siblingLines.some((w) => w.resolved.length > 0)) {
        bloodRank = "兄弟姉妹";
        bloodHeirs = distributeSiblingLines(siblingLines, frac(1, 1));
        if (siblingLines.some((w) => w.resolved.length > 0 && !w.candidate.siblingBloodType)) {
          warnings.push(
            "兄弟姉妹の一部で全血・半血の別（siblingBloodType）が未入力です。" +
              "半血の場合は相続分が半分になるため、戸籍で必ず確認してください。"
          );
        }
      }
    }
  }

  // 配偶者との組み合わせで最終的な相続分を確定する（民法900条1〜3号）
  /** @type {{ personId: string, label?: string, relation: import('../types.js').HeirResultRelation, share: import('./fraction.js').Fraction }[]} */
  const heirsInternal = [];
  /** @type {import('../types.js').LegalHeirsResult["pattern"]} */
  let pattern;

  if (spouseAlive && bloodHeirs.length > 0) {
    const spouseShare = bloodRank === "子" ? frac(1, 2) : bloodRank === "直系尊属" ? frac(2, 3) : frac(3, 4);
    const bloodTotalShare = bloodRank === "子" ? frac(1, 2) : bloodRank === "直系尊属" ? frac(1, 3) : frac(1, 4);
    heirsInternal.push({ personId: "spouse", relation: "spouse", share: spouseShare });
    for (const h of bloodHeirs) {
      heirsInternal.push({
        personId: h.personId,
        label: h.label,
        relation: bloodRank === "子" ? "child-line" : bloodRank === "直系尊属" ? "ascendant" : "sibling-line",
        share: mulFrac(h.share, bloodTotalShare),
      });
    }
    pattern = /** @type {import('../types.js').LegalHeirsResult["pattern"]} */ (`配偶者と${bloodRank}`);
  } else if (spouseAlive) {
    heirsInternal.push({ personId: "spouse", relation: "spouse", share: frac(1, 1) });
    pattern = "配偶者のみ";
  } else if (bloodHeirs.length > 0) {
    for (const h of bloodHeirs) {
      heirsInternal.push({
        personId: h.personId,
        label: h.label,
        relation: bloodRank === "子" ? "child-line" : bloodRank === "直系尊属" ? "ascendant" : "sibling-line",
        share: h.share,
      });
    }
    pattern = /** @type {import('../types.js').LegalHeirsResult["pattern"]} */ (`${bloodRank}のみ`);
  } else {
    pattern = "相続人不存在";
    warnings.push(
      "法定相続人が1人も見つかりませんでした。相続財産清算人の選任等、" +
        "家庭裁判所での手続きが必要になる可能性が高いため、弁護士への相談を" +
        "強く推奨します（本モジュールの対応範囲外です）。"
    );
  }

  warnings.push(GENERAL_DISCLAIMER);

  const total = sumFrac(heirsInternal.map((h) => h.share));
  return {
    pattern,
    heirs: heirsInternal.map((h) => ({
      personId: h.personId,
      label: h.label,
      relation: h.relation,
      shareFraction: formatFrac(h.share),
    })),
    warnings,
    allSharesSumToOne: heirsInternal.length === 0 ? pattern === "相続人不存在" : total.n === total.d,
  };
}
