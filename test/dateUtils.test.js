import { test } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { daysUntil } from "../src/core/reminders/dateUtils.js";

test("daysUntil: 基準日からの残り日数を返す", () => {
  assert.equal(daysUntil("2026-10-01", "2026-09-01"), 30);
  assert.equal(daysUntil("2026-09-01", "2026-09-11"), -10);
});

test("daysUntil: 月ごとの日数が異なる場合でも正しく計算する（月インデックスの符号ミス検出用）", () => {
  // 2026年は平年（うるう年でない）。1/1→3/1は31(1月)+28(2月)=59日、
  // 3/1→5/1は31(3月)+30(4月)=61日と、同じ「2ヶ月後」でも日数が異なる。
  // 内部のparseIsoDateで月インデックスの計算を誤る（符号反転等）と、
  // 双方の日付に同じ誤りが適用されて誤差が相殺され、隣接月同士の単純な
  // テストケースだけでは検出できないため、月ごとの日数差を利用して検出する。
  assert.equal(daysUntil("2026-03-01", "2026-01-01"), 59);
  assert.equal(daysUntil("2026-05-01", "2026-03-01"), 61);
});

test("daysUntil: 同じ日付なら0を返す", () => {
  assert.equal(daysUntil("2026-09-15", "2026-09-15"), 0);
});

test("daysUntil: fromDateIso省略時は本日0時(UTC)を基準日として扱う", () => {
  // 実際の本番コード（scripts/reminder-digest.js・src/web/server.jsの/reminders）は
  // 常にtodayIsoを省略してbuildReminderDigest→daysUntilを呼ぶため、この「本日を
  // 基準にする」分岐こそが実運用で使われる既定動作である。実時刻に依存すると
  // 実行タイミングでテストがflakyになるため、グローバルなDateを一時的に
  // 差し替えて「本日」を固定した状態で検証する。
  const fixedNow = new Date("2026-09-15T15:30:00.000Z"); // 0時ちょうどだと時刻切り捨てバグを検出できないため、あえて午後の時刻にする
  const OriginalDate = global.Date;
  class FixedDate extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) return new OriginalDate(fixedNow.getTime());
      return new OriginalDate(...args);
    }
    static now() {
      return fixedNow.getTime();
    }
  }
  global.Date = FixedDate;
  try {
    // 「本日」が2026-09-15 15:30 UTCに固定されている前提で、
    // 基準日を省略した場合は2026-09-15の0時(UTC)扱いになるはず。
    assert.equal(daysUntil("2026-09-25"), 10);
    assert.equal(daysUntil("2026-09-15"), 0);
  } finally {
    global.Date = OriginalDate;
  }
});

/**
 * ここからProperty-based testing（fast-check）。
 * 日付計算は「うるう年」「月ごとの日数の違い」「年またぎ」等の境界条件が
 * 無数にあり、手で書いた具体例だけでは網羅しきれない。ここでは実装を
 * 再実装するのではなく、実カレンダーが満たすべき数学的な性質
 * （反対称性・反射性・n日後との整合性）を検証することで、
 * 特定の日付の組み合わせに依存しない形で正しさを担保する。
 */
const isoDateArb = fc
  .date({ min: new Date("1970-01-01T00:00:00Z"), max: new Date("2100-12-31T00:00:00Z"), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));

test("daysUntil [property]: 基準日からn日後の日付までの残り日数は常にnになる（実カレンダーとの整合性）", () => {
  fc.assert(
    fc.property(isoDateArb, fc.integer({ min: -36500, max: 36500 }), (fromIso, offsetDays) => {
      const [y, m, d] = fromIso.split("-").map(Number);
      const targetIso = new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
      assert.equal(daysUntil(targetIso, fromIso), offsetDays);
    }),
    { numRuns: 500 }
  );
});

test("daysUntil [property]: 基準日と対象日を入れ替えると符号が反転する（反対称性）", () => {
  // a===bの場合、daysUntil(a,b)は+0、-daysUntil(b,a)は-0になり、
  // 数学的には等しいがObject.is（assert.strict.equalの比較方法）では
  // +0と-0が区別されるため、+0に正規化してから比較する（実装のバグではなく
  // 符号付きゼロというJavaScript特有の性質に起因するテスト側の配慮）。
  const normalizeZero = (n) => n + 0;
  fc.assert(
    fc.property(isoDateArb, isoDateArb, (a, b) => {
      assert.equal(normalizeZero(daysUntil(a, b)), normalizeZero(-daysUntil(b, a)));
    }),
    { numRuns: 300 }
  );
});

test("daysUntil [property]: 同じ日付同士なら常に0になる（反射性）", () => {
  fc.assert(
    fc.property(isoDateArb, (a) => {
      assert.equal(daysUntil(a, a), 0);
    })
  );
});
