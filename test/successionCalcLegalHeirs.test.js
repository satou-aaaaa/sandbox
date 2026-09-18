import { test } from "node:test";
import assert from "node:assert/strict";
import { calcLegalHeirs } from "../src/succession/heirs/calcLegalHeirs.js";

/**
 * 【ミューテーションテストで判明した拡充（2026年9月）】
 * `npm run test:mutation`をこのファイルと`fraction.js`に絞って実行したところ、
 * 当初84.13%だったスコアが本ファイルのテスト拡充後に93.97%まで改善した
 * （生存50件中31件を新規テストで検出できるようにした）。残る19件は、
 * 以下のいずれかの理由により、どのような入力を与えても出力が変わらない
 * 「等価ミュータント」であることを確認済み（再実行のたびに生存件数が
 * 18〜19件の間でわずかに変動したが、いずれもここに記載する等価ミュータント
 * の範囲内であり、実際の検知漏れではないことを個別に確認済み）。
 * - `distributeEqually`・`distributeSiblingLines`内の
 *   `if (lines.length === 0) return []`系のガード節: 呼び出し元
 *   （`calcLegalHeirs`本体）が事前に非空であることを保証してから
 *   呼び出しているため、この分岐は現在の呼び出しパターンでは
 *   到達不能（`distributeEqually`・`distributeSiblingLines`は
 *   モジュール内部専用でexportされていないため、直接呼び出すテストも書けない）
 * - `?? []`のフォールバック用配列に無関係な文字列1件を追加しても、
 *   その要素は`resolveLine`内の`!candidate.isAlive`判定で常にfalsy
 *   （死亡扱い）になり、かつ`substitutes`も持たないため必ず空配列に
 *   帰着し、後続処理に一切影響しない
 * - `resolveLine(s, {})`（`allowReRepresentation`未指定）は`undefined`が
 *   falsyとして扱われ、意図している`false`と同じ挙動になる
 * - 兄弟姉妹の`some(...)`系ガード（150行目）: 直後の`distributeSiblingLines`
 *   内部の`validLines`フィルタ（98行目。未変異）が同じ条件で再度絞り込むため、
 *   外側のガードが誤って通過しても最終的な結果は変わらない（二重チェックに
 *   よる保険が意図せず等価ミュータントを生んでいる）
 * - `bloodRank`の初期値`"なし"`は「"子"にも"直系尊属"にも一致しない」
 *   ことだけが意味を持つ内部変数であり、空文字列に変わっても比較結果は
 *   変わらない
 * - `resolveLine`の`if (substitutes.length === 0) return []`: 条件を`false`に
 *   変えても、後続の`substitutes.flatMap(...)`が空配列に対して呼ばれ
 *   結果的に同じ空配列を返すため観測不能（`kisokoujogaku.js`の同型の
 *   ミュータントと同じ理由）
 * - `fraction.js`の`gcd()`末尾`return a === 0n ? 1n : a;`: `frac()`側で
 *   分母0を事前に`throw`で弾いているため、`gcd`の最終結果が0になる
 *   （両方の引数が0の場合のみ発生）ケース自体が到達不能
 * - `allSharesSumToOne`の`total.n === total.d`部分: 分数計算が正しい限り
 *   常に真になる自己検算のため、実装を意図的に壊さない限り偽になる
 *   入力を作れない
 * - `gcd()`内の符号正規化（`a < 0n`等）を`<=`に変えても、BigIntには
 *   符号付きゼロが無く`-0n === 0n`のため、境界値（0）でも同じ結果になる
 * 無理にテストで検出しようとするのではなく、ここに理由を記録するに留める。
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

function shareOf(result, personId) {
  return result.heirs.find((h) => h.personId === personId)?.shareFraction;
}

function relationOf(result, personId) {
  return result.heirs.find((h) => h.personId === personId)?.relation;
}

/**
 * 警告文言は複数のリテラルセグメントを連結して組み立てられているため、
 * 部分一致のみのテストでは一部のセグメントが空文字列に変わっても
 * 検知できない（ミューテーションテストで判明）。実装と同じ全文を
 * 定数として持ち、完全一致で検証する。
 */
const GENERAL_DISCLAIMER =
  "この計算結果は入力された家族構成情報に基づく機械的な試算です。" +
  "戸籍謄本等の収集・確認により、養子縁組・認知・重複する代襲関係等が" +
  "判明した場合、結果が変わる可能性があります。最終的な相続人の確定には、" +
  "必ず戸籍謄本等一式による裏付け確認を行ってください。";

const NO_HEIRS_WARNING =
  "法定相続人が1人も見つかりませんでした。相続財産清算人の選任等、" +
  "家庭裁判所での手続きが必要になる可能性が高いため、弁護士への相談を" +
  "強く推奨します（本モジュールの対応範囲外です）。";

const MISSING_BLOOD_TYPE_WARNING =
  "兄弟姉妹の一部で全血・半血の別（siblingBloodType）が未入力です。" +
  "半血の場合は相続分が半分になるため、戸籍で必ず確認してください。";

// --- 配偶者と子（民法900条1号） ---

test("配偶者と子1人: 各1/2ずつ", () => {
  const result = calcLegalHeirs(
    baseFamily({ hasSpouse: true, spouseIsAlive: true, children: [{ personId: "c1", isAlive: true }] })
  );
  assert.equal(result.pattern, "配偶者と子");
  assert.equal(shareOf(result, "spouse"), "1/2");
  assert.equal(shareOf(result, "c1"), "1/2");
  assert.equal(relationOf(result, "spouse"), "spouse");
  assert.equal(relationOf(result, "c1"), "child-line");
  assert.equal(result.allSharesSumToOne, true);
});

test("配偶者と子2人: 配偶者1/2、子は1/4ずつ", () => {
  const result = calcLegalHeirs(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      children: [
        { personId: "c1", isAlive: true },
        { personId: "c2", isAlive: true },
      ],
    })
  );
  assert.equal(shareOf(result, "spouse"), "1/2");
  assert.equal(shareOf(result, "c1"), "1/4");
  assert.equal(shareOf(result, "c2"), "1/4");
  assert.equal(result.allSharesSumToOne, true);
});

// --- 配偶者と直系尊属（民法900条2号） ---

test("配偶者と直系尊属（父母双方生存）: 配偶者2/3、父母は各1/6", () => {
  const result = calcLegalHeirs(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      ascendants: [
        { personId: "father", isAlive: true, ascendantDegree: 1 },
        { personId: "mother", isAlive: true, ascendantDegree: 1 },
      ],
    })
  );
  assert.equal(result.pattern, "配偶者と直系尊属");
  assert.equal(shareOf(result, "spouse"), "2/3");
  assert.equal(shareOf(result, "father"), "1/6");
  assert.equal(shareOf(result, "mother"), "1/6");
  assert.equal(relationOf(result, "father"), "ascendant");
  assert.equal(result.allSharesSumToOne, true);
});

test("配偶者と直系尊属（親等1が2人・親等2が1人）: 親等最小の者の人数分がカウントされる（Math.minの境界値）", () => {
  const result = calcLegalHeirs(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      ascendants: [
        { personId: "father", isAlive: true, ascendantDegree: 1 },
        { personId: "mother", isAlive: true, ascendantDegree: 1 },
        { personId: "grandfather", isAlive: true, ascendantDegree: 2 },
      ],
    })
  );
  // 血族側の総取り分1/3を、親等1の父母2人で均等配分 → 各1/6。
  // 親等2の祖父は親等最小ではないため対象外。
  assert.equal(shareOf(result, "father"), "1/6");
  assert.equal(shareOf(result, "mother"), "1/6");
  assert.ok(!result.heirs.some((h) => h.personId === "grandfather"));
});

test("配偶者と直系尊属（父のみ生存）: 配偶者2/3、父1/3", () => {
  const result = calcLegalHeirs(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      ascendants: [
        { personId: "father", isAlive: true, ascendantDegree: 1 },
        { personId: "mother", isAlive: false, ascendantDegree: 1 },
      ],
    })
  );
  assert.equal(shareOf(result, "father"), "1/3");
  assert.equal(result.heirs.some((h) => h.personId === "mother"), false);
});

test("配偶者と直系尊属（父母死亡・祖父母のみ生存）: 親等の近い者を優先する", () => {
  const result = calcLegalHeirs(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      ascendants: [
        { personId: "father", isAlive: false, ascendantDegree: 1 },
        { personId: "mother", isAlive: false, ascendantDegree: 1 },
        { personId: "grandfather", isAlive: true, ascendantDegree: 2 },
      ],
    })
  );
  assert.equal(shareOf(result, "grandfather"), "1/3");
});

// --- 配偶者と兄弟姉妹（民法900条3号・4号ただし書） ---

test("配偶者と兄弟姉妹（全血のみ2人）: 配偶者3/4、兄弟姉妹は各1/8", () => {
  const result = calcLegalHeirs(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      siblings: [
        { personId: "s1", isAlive: true, siblingBloodType: "full" },
        { personId: "s2", isAlive: true, siblingBloodType: "full" },
      ],
    })
  );
  assert.equal(result.pattern, "配偶者と兄弟姉妹");
  assert.equal(shareOf(result, "spouse"), "3/4");
  assert.equal(shareOf(result, "s1"), "1/8");
  assert.equal(shareOf(result, "s2"), "1/8");
  assert.equal(relationOf(result, "s1"), "sibling-line");
  assert.equal(result.allSharesSumToOne, true);
  // 全員がsiblingBloodTypeを入力済みのため、未入力警告は出ない。
  assert.equal(
    result.warnings.some((w) => w.includes(MISSING_BLOOD_TYPE_WARNING)),
    false
  );
});

test("兄弟姉妹に死亡し代襲相続人もいない（絶えた）系統が混ざっていても、有効な系統は希釈されず全額を受け取る", () => {
  const result = calcLegalHeirs(
    baseFamily({
      siblings: [
        { personId: "s_extinct", isAlive: false, siblingBloodType: "full" },
        { personId: "s_valid", isAlive: true, siblingBloodType: "full" },
      ],
    })
  );
  // s_extinctは代襲相続人がおらず系統が消滅するため、有効な系統はs_validのみ。
  // s_validが血族側の総取り分をすべて受け取るはず（希釈されて半分になってはならない）。
  assert.equal(result.pattern, "兄弟姉妹のみ");
  assert.equal(shareOf(result, "s_valid"), "1");
  assert.ok(!result.heirs.some((h) => h.personId === "s_extinct"));
});

test("兄弟姉妹が全員死亡し代襲相続人もいない場合は相続人不存在になる（誤って「兄弟姉妹」パターンにならない）", () => {
  const result = calcLegalHeirs(
    baseFamily({
      siblings: [
        { personId: "s1", isAlive: false, siblingBloodType: "full" },
        { personId: "s2", isAlive: false, siblingBloodType: "full" },
      ],
    })
  );
  assert.equal(result.pattern, "相続人不存在");
  assert.equal(result.heirs.length, 0);
});

test("配偶者と兄弟姉妹（全血1人・半血1人）: 半血は全血の1/2の相続分になる（900条4号ただし書）", () => {
  const result = calcLegalHeirs(
    baseFamily({
      hasSpouse: true,
      spouseIsAlive: true,
      siblings: [
        { personId: "full1", isAlive: true, siblingBloodType: "full" },
        { personId: "half1", isAlive: true, siblingBloodType: "half" },
      ],
    })
  );
  // 血族側の総取り分1/4を、全血:半血 = 2:1で配分 → 全血1/6、半血1/12
  assert.equal(shareOf(result, "full1"), "1/6");
  assert.equal(shareOf(result, "half1"), "1/12");
  assert.equal(result.allSharesSumToOne, true);
});

test("兄弟姉妹の血統未入力（siblingBloodType省略）: 警告が全文一致で出る", () => {
  const result = calcLegalHeirs(
    baseFamily({
      siblings: [{ personId: "s1", isAlive: true }],
    })
  );
  assert.ok(result.warnings.includes(MISSING_BLOOD_TYPE_WARNING));
});

test("有効な兄弟姉妹が複数いて一部だけsiblingBloodType未入力の場合も未入力警告が出る（一部のみ該当でも警告する。someとeveryを区別する境界値）", () => {
  const result = calcLegalHeirs(
    baseFamily({
      siblings: [
        { personId: "s1", isAlive: true, siblingBloodType: "full" },
        { personId: "s2", isAlive: true }, // siblingBloodType未入力
      ],
    })
  );
  assert.equal(result.pattern, "兄弟姉妹のみ");
  assert.ok(result.warnings.includes(MISSING_BLOOD_TYPE_WARNING));
});

test("有効な兄弟姉妹の系統がすべてsiblingBloodType入力済みなら、他に絶えた系統があっても未入力警告は出ない", () => {
  const result = calcLegalHeirs(
    baseFamily({
      siblings: [
        { personId: "s_extinct", isAlive: false }, // siblingBloodType未入力だが系統が絶えるため対象外
        { personId: "s_valid", isAlive: true, siblingBloodType: "full" },
      ],
    })
  );
  assert.equal(result.pattern, "兄弟姉妹のみ");
  assert.equal(
    result.warnings.some((w) => w.includes(MISSING_BLOOD_TYPE_WARNING)),
    false
  );
});

// --- 血族のみ（配偶者なし） ---

test("子のみ（配偶者なし）: 子が全部を相続する", () => {
  const result = calcLegalHeirs(baseFamily({ children: [{ personId: "c1", isAlive: true }] }));
  assert.equal(result.pattern, "子のみ");
  assert.equal(shareOf(result, "c1"), "1");
  assert.equal(relationOf(result, "c1"), "child-line");
  assert.equal(result.allSharesSumToOne, true);
});

test("直系尊属のみ（配偶者なし・子なし）", () => {
  const result = calcLegalHeirs(baseFamily({ ascendants: [{ personId: "mother", isAlive: true, ascendantDegree: 1 }] }));
  assert.equal(result.pattern, "直系尊属のみ");
  assert.equal(shareOf(result, "mother"), "1");
});

test("兄弟姉妹のみ（配偶者なし・子なし・直系尊属なし）", () => {
  const result = calcLegalHeirs(baseFamily({ siblings: [{ personId: "s1", isAlive: true, siblingBloodType: "full" }] }));
  assert.equal(result.pattern, "兄弟姉妹のみ");
  assert.equal(shareOf(result, "s1"), "1");
});

// --- 配偶者のみ ---

test("配偶者のみ（血族相続人なし）: 配偶者が全部を相続し、警告はGENERAL_DISCLAIMERのみになる", () => {
  const result = calcLegalHeirs(baseFamily({ hasSpouse: true, spouseIsAlive: true }));
  assert.equal(result.pattern, "配偶者のみ");
  assert.equal(shareOf(result, "spouse"), "1");
  assert.equal(relationOf(result, "spouse"), "spouse");
  assert.equal(result.allSharesSumToOne, true);
  // 他に警告事由が無い最小構成のため、warningsは定型注記1件のみのはず。
  assert.deepEqual(result.warnings, [GENERAL_DISCLAIMER]);
});

// --- 相続人不存在 ---

test("相続人不存在: 配偶者も血族相続人もいない場合、専門家相談の警告が全文一致で出る", () => {
  const result = calcLegalHeirs(baseFamily());
  assert.equal(result.pattern, "相続人不存在");
  assert.equal(result.heirs.length, 0);
  assert.equal(result.allSharesSumToOne, true);
  assert.ok(result.warnings.includes(NO_HEIRS_WARNING));
});

// --- 代襲相続（子。887条2項・3項） ---

test("代襲相続: 子が死亡し孫が代襲する", () => {
  const result = calcLegalHeirs(
    baseFamily({
      children: [{ personId: "c1", isAlive: false, substitutes: [{ personId: "grandchild1", isAlive: true }] }],
    })
  );
  assert.equal(shareOf(result, "grandchild1"), "1");
});

test("再代襲: 子が死亡し孫も死亡している場合、ひ孫へ再代襲する（887条3項）", () => {
  const result = calcLegalHeirs(
    baseFamily({
      children: [
        {
          personId: "c1",
          isAlive: false,
          substitutes: [
            {
              personId: "grandchild1",
              isAlive: false,
              substitutes: [{ personId: "greatgrandchild1", isAlive: true }],
            },
          ],
        },
      ],
    })
  );
  assert.equal(shareOf(result, "greatgrandchild1"), "1");
});

test("代襲相続人の1系統が絶えている（さらに死亡し代襲相続人もいない）場合、有効な系統が希釈されず全額を受け取る", () => {
  const result = calcLegalHeirs(
    baseFamily({
      children: [
        {
          personId: "c1",
          isAlive: false,
          substitutes: [
            { personId: "gc_extinct", isAlive: false }, // さらに死亡し代襲相続人もいないため系統が絶える
            { personId: "gc_valid", isAlive: true },
          ],
        },
      ],
    })
  );
  // gc_extinctの系統は消滅するため、有効な系統はgc_validのみ。
  // gc_validがc1の系統の取り分をすべて受け取るはず（希釈されて半分になってはならない）。
  assert.equal(shareOf(result, "gc_valid"), "1");
  assert.ok(!result.heirs.some((h) => h.personId === "gc_extinct"));
});

test("代襲相続人が複数人いる場合は均等に配分する", () => {
  const result = calcLegalHeirs(
    baseFamily({
      children: [
        {
          personId: "c1",
          isAlive: false,
          substitutes: [
            { personId: "gc1", isAlive: true },
            { personId: "gc2", isAlive: true },
          ],
        },
      ],
    })
  );
  assert.equal(shareOf(result, "gc1"), "1/2");
  assert.equal(shareOf(result, "gc2"), "1/2");
});

// --- 兄弟姉妹の代襲（甥姪。889条2項は887条3項を準用しない） ---

test("兄弟姉妹の代襲: 兄弟姉妹が死亡し甥姪が代襲する", () => {
  const result = calcLegalHeirs(
    baseFamily({
      siblings: [
        { personId: "s1", isAlive: false, siblingBloodType: "full", substitutes: [{ personId: "nephew1", isAlive: true }] },
      ],
    })
  );
  assert.equal(shareOf(result, "nephew1"), "1");
});

test("兄弟姉妹の代襲: 甥姪がさらに死亡している場合、再代襲は発生しない（該当系統が消滅する）", () => {
  const result = calcLegalHeirs(
    baseFamily({
      siblings: [
        {
          personId: "s1",
          isAlive: false,
          siblingBloodType: "full",
          substitutes: [{ personId: "nephew1", isAlive: false, substitutes: [{ personId: "grandnephew1", isAlive: true }] }],
        },
      ],
    })
  );
  // 甥姪(nephew1)が死亡しており、その子(grandnephew1)への再代襲は生じないため、
  // この系統は消滅し、相続人不存在になる。
  assert.equal(result.pattern, "相続人不存在");
  assert.ok(!result.heirs.some((h) => h.personId === "grandnephew1"));
});

test("兄弟姉妹の代襲: 甥姪本人が相続放棄していれば代襲相続人から除外される", () => {
  const result = calcLegalHeirs(
    baseFamily({
      siblings: [
        {
          personId: "s1",
          isAlive: false,
          siblingBloodType: "full",
          substitutes: [{ personId: "nephew1", isAlive: true, hasRenounced: true }],
        },
      ],
    })
  );
  assert.equal(result.pattern, "相続人不存在");
  assert.ok(!result.heirs.some((h) => h.personId === "nephew1"));
});

// --- 相続放棄（939条。代襲の原因にならない） ---

test("相続放棄: 放棄した子に代襲相続人がいても代襲は発生しない（939条）", () => {
  const result = calcLegalHeirs(
    baseFamily({
      children: [{ personId: "c1", isAlive: true, hasRenounced: true, substitutes: [{ personId: "gc1", isAlive: true }] }],
    })
  );
  assert.ok(!result.heirs.some((h) => h.personId === "gc1"));
  assert.equal(result.pattern, "相続人不存在");
});

test("相続放棄: 子全員が放棄すると直系尊属に順位が移る", () => {
  const result = calcLegalHeirs(
    baseFamily({
      children: [{ personId: "c1", isAlive: true, hasRenounced: true }],
      ascendants: [{ personId: "mother", isAlive: true, ascendantDegree: 1 }],
    })
  );
  assert.equal(result.pattern, "直系尊属のみ");
  assert.equal(shareOf(result, "mother"), "1");
});

// --- 相続欠格・廃除（891条・892条・893条。死亡と同様に代襲原因になる） ---

test("相続欠格: 欠格した子に代襲相続人がいれば代襲が発生する（死亡と同じ扱い）", () => {
  const result = calcLegalHeirs(
    baseFamily({
      children: [
        { personId: "c1", isAlive: true, isDisqualifiedOrDisinherited: true, substitutes: [{ personId: "gc1", isAlive: true }] },
      ],
    })
  );
  assert.equal(shareOf(result, "gc1"), "1");
});

test("直系尊属が欠格・廃除に該当する場合は除外される（放棄・死亡と同様の扱い）", () => {
  const result = calcLegalHeirs(
    baseFamily({
      ascendants: [
        { personId: "father", isAlive: true, isDisqualifiedOrDisinherited: true, ascendantDegree: 1 },
        { personId: "mother", isAlive: true, ascendantDegree: 1 },
      ],
    })
  );
  assert.ok(!result.heirs.some((h) => h.personId === "father"));
  assert.equal(shareOf(result, "mother"), "1");
});

// --- 同時死亡の推定（民法32条の2） ---

test("同時死亡の推定: isAlive=trueでもisSimultaneousDeath=trueなら死亡扱いになる", () => {
  const result = calcLegalHeirs(
    baseFamily({
      children: [
        { personId: "c1", isAlive: true, isSimultaneousDeath: true, substitutes: [{ personId: "gc1", isAlive: true }] },
      ],
    })
  );
  assert.equal(shareOf(result, "gc1"), "1");
});

// --- 全パターン共通の自己検算・注記 ---

test("warningsには常にGENERAL_DISCLAIMERに相当する定型注記が末尾に含まれる（FR-S1.9）", () => {
  const patterns = [
    baseFamily({ hasSpouse: true, spouseIsAlive: true, children: [{ personId: "c1", isAlive: true }] }),
    baseFamily(),
    baseFamily({ siblings: [{ personId: "s1", isAlive: true, siblingBloodType: "full" }] }),
  ];
  for (const family of patterns) {
    const result = calcLegalHeirs(family);
    assert.ok(result.warnings.length >= 1);
    assert.ok(result.warnings[result.warnings.length - 1].includes("戸籍謄本等一式による裏付け確認"));
  }
});
