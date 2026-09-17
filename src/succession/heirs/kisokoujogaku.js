/**
 * 相続税の基礎控除額の目安を計算する。
 *
 * 【e-Gov法令検索で確認済み・2026年9月】相続税法第15条:
 * 1項 基礎控除額 = 3,000万円 + 600万円 × 「相続人の数」
 * 2項 この「相続人の数」は、民法第五編第二章（相続人）の規定による
 *     相続人の数だが、次の2点で `calcLegalHeirs` の実際の法定相続人数
 *     と異なりうる。
 *     - 相続の放棄があった場合、その放棄がなかったものとした場合における
 *       相続人の数とする（放棄者もカウントに含める。939条の効力を
 *       この計算に限り無視する）
 *     - 被相続人に養子がある場合、その養子の数のうち相続人の数に
 *       算入できるのは、実子がいる場合は1人まで、実子がおらず養子が
 *       2人以上の場合は2人までに制限される
 * 3項 特別養子縁組による養子・被相続人の配偶者の連れ子で養子となった者等は
 *     2項の養子の数の制限の対象外（実子とみなす）。本実装ではこれを
 *     `HeirCandidateInput.isAdopted` を true にしないことで表現する
 *     設計とし、専用のフラグは追加しない（types.js参照）。
 *
 * 【本実装が対応しない・近似する部分】
 * - 死亡した養子を代襲相続人（孫等）が代襲する場合、その代襲相続人が
 *   「養子の子」として上限算定上どう扱われるかは条文上明確でないため、
 *   本実装では「元の子（養子）のスロットを引き継ぐ」という解釈で
 *   一貫させている（代襲が絡む場合は必ずwarningsで人手確認を促す）。
 * - 相続税額そのものの計算（累進税率・各種控除の適用）は対象外。
 *   あくまで基礎控除額（課税価格からの控除額）の目安のみを算出する。
 */

/**
 * calcLegalHeirsのresolveLineと異なり、相続放棄（hasRenounced）を
 * 無視して人数を数える（相続税法15条2項）。死亡・同時死亡・欠格・廃除は
 * 通常どおり代襲の原因として扱う。
 * @param {import('../types.js').HeirCandidateInput} candidate
 * @param {{ allowReRepresentation: boolean }} opts
 * @returns {import('../types.js').HeirCandidateInput[]} この系統でカウント対象になる人物（代襲相続人を含む）の配列
 */
function countLine(candidate, opts) {
  const isEffectivelyDead = !candidate.isAlive || !!candidate.isSimultaneousDeath || !!candidate.isDisqualifiedOrDisinherited;
  if (!isEffectivelyDead) {
    return [candidate];
  }
  const substitutes = candidate.substitutes ?? [];
  if (substitutes.length === 0) return [];
  return substitutes.flatMap((s) => (opts.allowReRepresentation ? countLine(s, opts) : countTerminalSubstitute(s)));
}

/** @param {import('../types.js').HeirCandidateInput} nephewOrNiece */
function countTerminalSubstitute(nephewOrNiece) {
  if (!nephewOrNiece.isAlive || nephewOrNiece.isSimultaneousDeath || nephewOrNiece.isDisqualifiedOrDisinherited) return [];
  return [nephewOrNiece];
}

/**
 * @param {import('../types.js').FamilyStructureInput} family
 * @returns {import('../types.js').SouzokuzeiKisokoujogakuResult}
 */
export function calcSouzokuzeiKisokoujogaku(family) {
  const warnings = [];
  const spouseAlive = !!family.hasSpouse && !!family.spouseIsAlive;
  const hasAnyRenounced = [...(family.children ?? []), ...(family.ascendants ?? []), ...(family.siblings ?? [])].some(
    (c) => c.hasRenounced
  );

  // 第1順位: 子。放棄は無視するため、直系の子候補ごとに「本人 or 代襲相続人」を数える。
  // 養子の上限は「被相続人の子」単位（トップレベルのchildren要素）の
  // isAdoptedで判定し、代襲相続人が引き継ぐ扱いとする（上記コメント参照）。
  const childLineCounts = (family.children ?? []).map((c) => ({
    isAdopted: !!c.isAdopted,
    members: countLine(c, { allowReRepresentation: true }),
  }));
  const hasAnyChildLine = childLineCounts.some((l) => l.members.length > 0);

  let bloodRank = "なし";
  let bloodHeadcount = 0;

  if (hasAnyChildLine) {
    bloodRank = "子";
    const bioMembers = childLineCounts.filter((l) => !l.isAdopted).flatMap((l) => l.members);
    const adoptedLines = childLineCounts.filter((l) => l.isAdopted && l.members.length > 0);
    const adoptedHeadcountRaw = adoptedLines.reduce((sum, l) => sum + l.members.length, 0);

    if (adoptedLines.length > 0) {
      const adoptedSlotCap = bioMembers.length > 0 || adoptedLines.length === 1 ? 1 : 2;
      const cappedSlots = Math.min(adoptedLines.length, adoptedSlotCap);
      // 上限に達したスロットのみ、そのスロットの代襲相続人数をそのまま算入する
      // （代襲していないスロットは1人としてカウントされる）。
      const includedAdoptedMembers = adoptedLines.slice(0, cappedSlots).flatMap((l) => l.members);
      bloodHeadcount = bioMembers.length + includedAdoptedMembers.length;
      if (cappedSlots < adoptedLines.length) {
        warnings.push(
          `被相続人の養子が${adoptedLines.length}人（うち代襲を含め計${adoptedHeadcountRaw}人分）入力されていますが、` +
            `基礎控除額の計算に算入できる養子の数は${bioMembers.length > 0 ? "実子がいるため1人" : "実子がおらず2人"}までです` +
            "（相続税法15条2項）。特別養子縁組・配偶者の連れ子養子等、実子とみなされる者が含まれていないか確認してください。"
        );
      }
      if (adoptedLines.some((l) => l.members.length > 1)) {
        warnings.push(
          "養子が死亡・欠格・廃除により代襲相続人（孫等）に引き継がれているケースが含まれています。" +
            "この場合の養子の数の算入方法は法令上明確でないため、本計算は簡易な近似です。税理士へ確認してください。"
        );
      }
    } else {
      bloodHeadcount = bioMembers.length;
    }
  } else {
    // 第2順位: 直系尊属。放棄は無視するため「生存かつ欠格・廃除に該当しない」全員のうち
    // 親等最小の者を数える（calcLegalHeirsと異なりhasRenouncedで除外しない）。
    const countableAscendants = (family.ascendants ?? []).filter(
      (a) => a.isAlive && !a.isSimultaneousDeath && !a.isDisqualifiedOrDisinherited
    );
    if (countableAscendants.length > 0) {
      const minDegree = Math.min(...countableAscendants.map((a) => a.ascendantDegree ?? 1));
      bloodRank = "直系尊属";
      bloodHeadcount = countableAscendants.filter((a) => (a.ascendantDegree ?? 1) === minDegree).length;
    } else {
      // 第3順位: 兄弟姉妹（代襲は甥姪の1代限り。889条2項）。放棄は無視する。
      const siblingCounts = (family.siblings ?? []).map((s) => countLine(s, { allowReRepresentation: false }));
      const totalSiblingCount = siblingCounts.reduce((sum, l) => sum + l.length, 0);
      if (totalSiblingCount > 0) {
        bloodRank = "兄弟姉妹";
        bloodHeadcount = totalSiblingCount;
      }
    }
  }

  const houteiSouzokuninCount = (spouseAlive ? 1 : 0) + bloodHeadcount;

  if (hasAnyRenounced) {
    warnings.push(
      "入力に相続放棄をした方が含まれていますが、相続税の基礎控除額の計算では" +
        "相続放棄はなかったものとして人数を数えます（相続税法15条2項）。" +
        "そのため、この人数は実際の法定相続人（calcLegalHeirsの結果）と一致しない場合があります。"
    );
  }
  if (houteiSouzokuninCount === 0) {
    warnings.push("相続人の数が0人と算出されました。入力内容を確認してください。");
  }
  warnings.push("相続税額そのものの計算・申告は税理士の職域であり、本モジュールの対応範囲外です。この基礎控除額はあくまで目安として扱ってください。");

  return {
    houteiSouzokuninCount,
    bloodRank: /** @type {import('../types.js').SouzokuzeiKisokoujogakuResult["bloodRank"]} */ (bloodRank),
    kisokoujogakuYen: 30_000_000 + 6_000_000 * houteiSouzokuninCount,
    warnings,
  };
}
