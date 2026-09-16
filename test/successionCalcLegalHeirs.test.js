import { test } from "node:test";
import assert from "node:assert/strict";
import { calcLegalHeirs } from "../src/succession/heirs/calcLegalHeirs.js";

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

// --- 配偶者と子（民法900条1号） ---

test("配偶者と子1人: 各1/2ずつ", () => {
  const result = calcLegalHeirs(
    baseFamily({ hasSpouse: true, spouseIsAlive: true, children: [{ personId: "c1", isAlive: true }] })
  );
  assert.equal(result.pattern, "配偶者と子");
  assert.equal(shareOf(result, "spouse"), "1/2");
  assert.equal(shareOf(result, "c1"), "1/2");
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
  assert.equal(result.allSharesSumToOne, true);
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
  assert.equal(result.allSharesSumToOne, true);
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

test("兄弟姉妹の血統未入力（siblingBloodType省略）: 警告が出る", () => {
  const result = calcLegalHeirs(
    baseFamily({
      siblings: [{ personId: "s1", isAlive: true }],
    })
  );
  assert.ok(result.warnings.some((w) => w.includes("全血・半血")));
});

// --- 血族のみ（配偶者なし） ---

test("子のみ（配偶者なし）: 子が全部を相続する", () => {
  const result = calcLegalHeirs(baseFamily({ children: [{ personId: "c1", isAlive: true }] }));
  assert.equal(result.pattern, "子のみ");
  assert.equal(shareOf(result, "c1"), "1");
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

test("配偶者のみ（血族相続人なし）: 配偶者が全部を相続する", () => {
  const result = calcLegalHeirs(baseFamily({ hasSpouse: true, spouseIsAlive: true }));
  assert.equal(result.pattern, "配偶者のみ");
  assert.equal(shareOf(result, "spouse"), "1");
  assert.equal(result.allSharesSumToOne, true);
});

// --- 相続人不存在 ---

test("相続人不存在: 配偶者も血族相続人もいない場合、専門家相談の警告が出る", () => {
  const result = calcLegalHeirs(baseFamily());
  assert.equal(result.pattern, "相続人不存在");
  assert.equal(result.heirs.length, 0);
  assert.equal(result.allSharesSumToOne, true);
  assert.ok(result.warnings.some((w) => w.includes("弁護士")));
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
