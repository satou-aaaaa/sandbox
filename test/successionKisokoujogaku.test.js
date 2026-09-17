import { test } from "node:test";
import assert from "node:assert/strict";
import { calcSouzokuzeiKisokoujogaku } from "../src/succession/heirs/kisokoujogaku.js";

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
});

test("配偶者のみ（子・直系尊属・兄弟姉妹なし）: 相続人の数1人", () => {
  const result = calcSouzokuzeiKisokoujogaku(baseFamily({ hasSpouse: true, spouseIsAlive: true }));
  assert.equal(result.houteiSouzokuninCount, 1);
  assert.equal(result.kisokoujogakuYen, 30_000_000 + 6_000_000);
});

test("相続人不存在: 相続人の数0人、警告が出る", () => {
  const result = calcSouzokuzeiKisokoujogaku(baseFamily());
  assert.equal(result.houteiSouzokuninCount, 0);
  assert.ok(result.warnings.some((w) => w.includes("0人と算出")));
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

test("養子3人・実子なし: 上限2人までしか算入されず警告が出る", () => {
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
  assert.ok(result.warnings.some((w) => w.includes("2人まで")));
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

test("死亡した養子を孫2人が代襲: 代襲が絡む場合は警告が出る", () => {
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
  assert.ok(result.warnings.some((w) => w.includes("代襲相続人（孫等）に引き継がれている")));
});

test("直系尊属のみ: 親等最小の者のみカウントされる", () => {
  const result = calcSouzokuzeiKisokoujogaku(
    baseFamily({
      ascendants: [
        { personId: "father", isAlive: true, ascendantDegree: 1 },
        { personId: "grandfather", isAlive: true, ascendantDegree: 2 },
      ],
    })
  );
  assert.equal(result.houteiSouzokuninCount, 1);
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
});

test("warnings: 末尾に税理士職域の定型文が必ず含まれる", () => {
  const result = calcSouzokuzeiKisokoujogaku(baseFamily({ hasSpouse: true, spouseIsAlive: true }));
  assert.ok(result.warnings.at(-1).includes("税理士の職域"));
});
