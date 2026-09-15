import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcShokanShinseiDeadline,
  calcHenoukiDeadline,
  buildHenkoTodokedeWarning,
} from "../src/licenses/kobutsu/reminders/changeSchedule.js";

test("calcShokanShinseiDeadline: 変更日から14日後を返す", () => {
  assert.equal(calcShokanShinseiDeadline("2026-09-01"), "2026-09-15");
});

test("calcShokanShinseiDeadline: 月をまたぐ場合も正しく計算する（境界値）", () => {
  assert.equal(calcShokanShinseiDeadline("2026-09-20"), "2026-10-04");
});

test("calcShokanShinseiDeadline: 年をまたぐ場合も正しく計算する（境界値）", () => {
  assert.equal(calcShokanShinseiDeadline("2026-12-25"), "2027-01-08");
});

test("calcHenoukiDeadline: 廃業日から10日後を返す", () => {
  assert.equal(calcHenoukiDeadline("2026-09-01"), "2026-09-11");
});

test("calcHenoukiDeadline: 月をまたぐ場合も正しく計算する（境界値）", () => {
  assert.equal(calcHenoukiDeadline("2026-09-25"), "2026-10-05");
});

test("buildHenkoTodokedeWarning: 3日以内に変更届が必要である旨のメッセージを返す", () => {
  const warning = buildHenkoTodokedeWarning();
  assert.match(warning, /3日以内/);
  assert.match(warning, /変更届出/);
});
