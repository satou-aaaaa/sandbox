import { test } from "node:test";
import assert from "node:assert/strict";
import { calcSouzokuzeiKisokoujogaku } from "../src/succession/heirs/kisokoujogaku.js";

/**
 * 【ミューテーションテストで判明した拡充（2026年9月）】
 * `npm run test:mutation`をこのファイルに絞って実行したところ、当初69.40%
 * だったスコアが本ファイルのテスト拡充後に93.99%まで改善した（生存55件中
 * 44件を新規テストで検出できるようにした）。残る11件（例:
 * `substitutes.length === 0`の条件を`false`に変えても、後続の
 * `substitutes.flatMap(...)`が空配列に対して呼ばれ結果的に同じ空配列を
 * 返すため観測不能、や`?? []`のフォールバック用配列に無関係な文字列1件を
 * 追加しても`.some(c => c.hasRenounced)`等の後続処理では常にfalsy判定される
 * ため影響しない、等）は、コードの実際の分岐条件やコレクションが常に
 * 空の場合にのみ発火するミューテーションであり、どのような入力を与えても
 * 出力が変わらない「等価ミュータント」であることを確認済み。無理に
 * テストで検出しようとするのではなく、ここに理由を記録するに留める。
 */

/** @returns {import('../src/succession/types.js').FamilyStructureInput} */
function baseFamily(overrides = {}) {
  return {
    caseId: "case-1",
    decedentDeathDateIso: "2026-01-01",
    hasSpouse: false,
    children: [],
    ascendants: [],
    siblings: [],
    ...overrides,
  };
}

/**
 * 相続放棄の警告文言はkisokoujogaku.js内で複数のリテラルセグメントを連結して
 * 組み立てられているため、部分一致のみのテストでは一部のセグメントが
 * 空文字列に変わってもテストが検知できない（ミューテーションテストで判明）。
 * ここでは完全一致で検証できるよう、実装と同じ全文を定数として持つ。
 */
const RENUNCIATION_WARNING =
  "入力に相続放棄をした方が含まれていますが、相続税の基礎控除額の計算では" +
  "相続放棄はなかったものとして人数を数えます（相続税法15条2項）。" +
  "そのため、この人数は実際の法定相続人（calcLegalHeirsの結果）と一致しない場合があります。";

/** 養子が代襲相続人に引き継がれているケースの警告文言（全文。理由はRENUNCIATION_WARNINGと同じ） */
const ADOPTED_REPRESENTATION_WARNING =
  "養子が死亡・欠格・廃除により代襲相続人（孫等）に引き継がれているケースが含まれています。" +
  "この場合の養子の数の算入方法は法令上明確でないため、本計算は簡易な近似です。税理士へ確認してください。";

/** 養子の算入上限を超えた場合の警告文言（全文）を組み立てる。 */
function buildAdoptedCapWarning(adoptedLinesCount, adoptedHeadcountRaw, hasBioChild) {
  return (
    `被相続人の養子が${adoptedLinesCount}人（うち代襲を含め計${adoptedHeadcountRaw}人分）入力されていますが、` +
    `基礎控除額の計算に算入できる養子の数は${hasBioChild ? "実子がいるため1人" : "実子がおらず2人"}までです` +
    "（相続税法15条2項）。特別養子縁組・配偶者の連れ子養子等、実子とみなされる者が含まれていないか確認してください。"
  );
}

test("配偶者と子2人: 相続人の数3人、基礎控除額4,800万円", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      children: [
        { personId: "c1", isAlive: true },
        { personId: "c2", isAlive: true },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 3);
  assert.equal(result.kisokoujogakuYen, 30_000_000 + 6_000_000 * 3);
  // 相続人の数が0人でないため、「0人と算出されました」の注意書きは出ない。
  assert.equal(
    result.warnings.some((w) => w.includes("0人と算出されました")),
    false
  );
});

test("配偶者のみ（子・直系尊属・兄弟姉妹なし）: 相続人の数1人", () => {
  const result = calcSouzokuzeiKisokoujogaku(baseFamily({ hasSpouse: true, spouseIsAlive: true }));
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.kisokoujogakuYen, 30_000_000 + 6_000_000);
  // 他に警告事由が無い最小構成のため、末尾の税理士職域の定型文のみが含まれるはず。
  assert.deepEqual(result.warnings, [
    "相続税額そのものの計算・申告は税理士の職域であり、本モジュールの対応範囲外です。この基礎控除額はあくまで目安として扱ってください。",
  ]);
});

test("配偶者は届出上は婚姻関係にあるが死亡している場合、相続人の数に算入しない", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({ hasSpouse: true, spouseIsAlive: false, children: [{ personId: "c1", isAlive: true }] })
  );
  // 配偶者は算入されず、子1人のみ（配偶者ありの誤算入なら2人になってしまう）
  assert.equal(result.houteiSouzokuninCount, 1);
});

test("相続人不存在: 相続人の数0人、bloodRankは「なし」のまま、警告が出る", () => {
  const result = calcSouzokuzeiKisokoujogaku(baseFamily());
  assert.equal(result.houteiSouzokuninCount, 0);
  assert.equal(result.bloodRank, "なし");
  assert.ok(result.warnings.some((w) => w.includes("0人と算出されました")));
});

test("相続放棄があっても、基礎控除の計算では放棄がなかったものとして数える（相続税法15条2項）", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      children: [
        { personId: "c1", isAlive: true, hasRenounced: true },
        { personId: "c2", isAlive: true },
      ],
    })
  );
  // 放棄していなければ子2人がそのままカウントされる（配偶者+子2人=3人）
  assert.equal(result.houteiSouzokuninCount, 3);
  // 警告文言は複数セグメントの連結のため、全文一致で検証する（部分一致だと
  // 一部セグメントが欠落しても検知できない）。
  assert.ok(result.warnings.includes(RENUNCIATION_WARNING));
});

test("相続放棄をした人が誰もいない場合、相続放棄に関する警告は出ない", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      children: [{ personId: "c1", isAlive: true }],
    })
  );
  assert.equal(
    result.warnings.some((w) => w.includes("放棄はなかったものとして")),
    false
  );
});

test("直系尊属に相続放棄をした方がいても、その系統内で放棄はなかったものとして数える（兄弟姉妹には移らない）", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      ascendants: [{ personId: "a1", isAlive: true, ascendantDegree: 1, hasRenounced: true }],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.bloodRank, "直系尊属");
  assert.ok(result.warnings.some((w) => w.includes("放棄はなかったものとして")));
});

test("兄弟姉妹に相続放棄をした方がいても、放棄はなかったものとして数える", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      siblings: [{ personId: "s1", isAlive: true, hasRenounced: true }],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.bloodRank, "兄弟姉妹");
  assert.ok(result.warnings.some((w) => w.includes("放棄はなかったものとして")));
});

test("全員が相続放棄しても、基礎控除の計算では放棄がなかったものとして子が数えられ、直系尊属・兄弟姉妹には移らない", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      children: [
        { personId: "c1", isAlive: true, hasRenounced: true },
        { personId: "c2", isAlive: true, hasRenounced: true },
      ],
      ascendants: [{ personId: "a1", isAlive: true, ascendantDegree: 1 }],
    })
  );
  // 子2人が数えられ、直系尊属a1はカウントされない（配偶者+子2人=3人）
  assert.equal(result.houteiSouzokuninCount, 3);
  assert.equal(result.bloodRank, "子");
});

test("子が死亡し代襲相続人もいない場合、その系統は0人として扱われ、順位は直系尊属に移る", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [{ personId: "c1", isAlive: false }],
      ascendants: [{ personId: "a1", isAlive: true, ascendantDegree: 1 }],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.bloodRank, "直系尊属");
});

test("養子1人・実子なし: 上限内なのでそのままカウントされる", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [{ personId: "c1", isAlive: true, isAdopted: true }],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.warnings.some((w) => w.includes("算入できる養子の数")), false);
});

test("養子2人・実子なし: 上限2人のためそのままカウントされる", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [
        { personId: "c1", isAlive: true, isAdopted: true },
        { personId: "c2", isAlive: true, isAdopted: true },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 2);
});

test("養子3人・実子なし: 上限2人までしか算入されず、警告文言が全文一致で出る", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [
        { personId: "c1", isAlive: true, isAdopted: true },
        { personId: "c2", isAlive: true, isAdopted: true },
        { personId: "c3", isAlive: true, isAdopted: true },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 2);
  // 養子3人（代襲なし＝各1人分）のうち実子がいないため2人まで、の警告全文を検証する。
  assert.ok(result.warnings.includes(buildAdoptedCapWarning(3, 3, false)));
  // 代襲が絡んでいないため、代襲相続人への引き継ぎに関する警告は出ない。
  assert.equal(
    result.warnings.some((w) => w.includes("代襲相続人（孫等）に引き継がれている")),
    false
  );
});

test("養子のうち死亡し代襲相続人もいない（絶えた）系統は、養子の算入上限のカウントに含めない", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [
        { personId: "c0", isAlive: false, isAdopted: true }, // 代襲相続人なし＝この系統は絶える
        { personId: "c1", isAlive: true, isAdopted: true },
        { personId: "c2", isAlive: true, isAdopted: true },
      ],
    })
  );
  // 実際に人数を持つ養子系統は2つ（c1・c2）のみで上限2人ちょうどのため、超過しない。
  assert.equal(result.houteiSouzokuninCount, 2);
  assert.equal(result.bloodRank, "子");
  assert.equal(
    result.warnings.some((w) => w.includes("入力されていますが")),
    false
  );
});

test("実子1人・養子2人: 実子がいる場合は養子1人までしか算入されず警告が出る", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [
        { personId: "c1", isAlive: true },
        { personId: "c2", isAlive: true, isAdopted: true },
        { personId: "c3", isAlive: true, isAdopted: true },
      ],
    })
  );
  // 実子1人 + 養子1人（上限）= 2人
  assert.equal(result.houteiSouzokuninCount, 2);
  assert.ok(result.warnings.some((w) => w.includes("実子がいるため1人")));
});

test("実子1人・養子1人: 上限内なので2人ともカウントされ警告は出ない", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [
        { personId: "c1", isAlive: true },
        { personId: "c2", isAlive: true, isAdopted: true },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 2);
  assert.equal(result.warnings.some((w) => w.includes("算入できる養子の数")), false);
});

test("死亡した子を孫2人が代襲: 直系の代襲相続人はそのまま人数分カウントされる", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [
        {
          personId: "c1",
          isAlive: false,
          substitutes: [
            { personId: "g1", isAlive: true },
            { personId: "g2", isAlive: true },
          ],
        },
        { personId: "c2", isAlive: true },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 3);
});

test("子の代襲に世代の制限はない: 孫も死亡しているが曾孫が生存していれば曾孫まで数える", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [
        {
          personId: "c1",
          isAlive: false,
          substitutes: [
            {
              personId: "g1",
              isAlive: false,
              substitutes: [{ personId: "gg1", isAlive: true }],
            },
          ],
        },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.bloodRank, "子");
});

test("死亡した養子を孫2人が代襲: 上限内ならその人数分そのままカウントされ、警告が全文一致で出る", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [
        {
          personId: "c1",
          isAlive: false,
          isAdopted: true,
          substitutes: [
            { personId: "g1", isAlive: true },
            { personId: "g2", isAlive: true },
          ],
        },
      ],
    })
  );
  // 養子の系統は1つのみのため上限（この場合1系統まで）に収まり、孫2人とも算入される。
  assert.equal(result.houteiSouzokuninCount, 2);
  assert.ok(result.warnings.includes(ADOPTED_REPRESENTATION_WARNING));
});

test("養子の代襲系統（複数人）と非代襲系統（1人）が混在する場合も、代襲についての警告が出る", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      children: [
        {
          personId: "c1",
          isAlive: false,
          isAdopted: true,
          substitutes: [
            { personId: "g1", isAlive: true },
            { personId: "g2", isAlive: true },
          ],
        },
        { personId: "c2", isAlive: true, isAdopted: true },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 3);
  assert.ok(result.warnings.includes(ADOPTED_REPRESENTATION_WARNING));
});

test("直系尊属のみ・親等最小が複数人: 親等最小の者の人数分がカウントされる（Math.minの境界値）", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      ascendants: [
        { personId: "father", isAlive: true, ascendantDegree: 1 },
        { personId: "mother", isAlive: true, ascendantDegree: 1 },
        { personId: "grandfather", isAlive: true, ascendantDegree: 2 },
      ],
    })
  );
  // 親等1（父母）が2人いるため、親等2（祖父）ではなく2人がカウントされる。
  assert.equal(result.houteiSouzokuninCount, 2);
  assert.equal(result.bloodRank, "直系尊属");
});

test("直系尊属のみ・親等1の者がいない: 親等2の者がカウントされる（親等3の者は含まれない）", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      ascendants: [
        { personId: "grandfather", isAlive: true, ascendantDegree: 2 },
        { personId: "greatgrandfather", isAlive: true, ascendantDegree: 3 },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.bloodRank, "直系尊属");
});

test("直系尊属が死亡している場合は算入されず、他に該当者もいなければ相続人0人のまま", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      ascendants: [{ personId: "a1", isAlive: false, ascendantDegree: 1 }],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.bloodRank, "なし");
});

test("兄弟姉妹のみ・代襲あり: 甥姪も人数に含まれる", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      siblings: [
        { personId: "s1", isAlive: true },
        {
          personId: "s2",
          isAlive: false,
          substitutes: [{ personId: "nephew1", isAlive: true }],
        },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 2);
  assert.equal(result.bloodRank, "兄弟姉妹");
});

test("唯一の推定相続人となる兄弟姉妹の代襲者（甥）も死亡している場合、相続人は0人のまま（打ち切り）", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      siblings: [{ personId: "s1", isAlive: false, substitutes: [{ personId: "n1", isAlive: false }] }],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 0);
  assert.equal(result.bloodRank, "なし");
});

test("兄弟姉妹の代襲は甥姪の1代限り: 死亡した甥に生存する子（甥の子）がいても再代襲されない（889条2項）", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      siblings: [
        {
          personId: "s1",
          isAlive: false,
          substitutes: [
            {
              personId: "n1",
              isAlive: false,
              substitutes: [{ personId: "g1", isAlive: true }],
            },
          ],
        },
      ],
    })
  );
  // 甥n1が死亡している時点で打ち切られ、その子g1（甥の子）は数えられない。
  // 配偶者のみが相続人となる。
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.bloodRank, "なし");
});

test("warnings: 末尾に税理士職域の定型文が必ず含まれる", () => {
  const result = calcSouzokuzeiKisokoujogaku(baseFamily({ hasSpouse: true, spouseIsAlive: true }));
  assert.ok(result.warnings.at(-1).includes("税理士の職域"));
});
