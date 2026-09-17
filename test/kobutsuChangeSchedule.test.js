import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcShokanShinseiDeadline,
  calcEigyoshoHenkoJizenTodokedeDeadline,
  calcHenoukiDeadline,
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

test("calcEigyoshoHenkoJizenTodokedeDeadline: 変更予定日の3日前を返す（古物営業法第7条第1項・施行規則第5条2〜3項）", () => {
  assert.equal(calcEigyoshoHenkoJizenTodokedeDeadline("2026-09-10"), "2026-09-07");
});

test("calcEigyoshoHenkoJizenTodokedeDeadline: 月をまたぐ場合も正しく計算する（境界値）", () => {
  assert.equal(calcEigyoshoHenkoJizenTodokedeDeadline("2026-09-01"), "2026-08-29");
});

test("calcEigyoshoHenkoJizenTodokedeDeadline: 年をまたぐ場合も正しく計算する（境界値）", () => {
  assert.equal(calcEigyoshoHenkoJizenTodokedeDeadline("2027-01-01"), "2026-12-29");
});
