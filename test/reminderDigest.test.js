import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReminderDigest,
  filterDueAlerts,
  formatReminderDigest,
  buildReminderMailtoUrl,
  bucketizeAlerts,
  REMINDER_RANGES,
} from "../src/core/reminders/digest.js";
import { registerConstructionLicense } from "../src/licenses/construction/index.js";
import { registerKobutsuLicense } from "../src/licenses/kobutsu/index.js";

// buildReminderDigest はlicenseCategory省略時に"construction"として扱い、
// scheduleTypes.jsのレジストリ経由でスケジュール計算関数を呼び出す
// （docs/DESIGN_kobutsu-core.md 5.3節）。このファイルの各テストはlicenseCategoryを
// 指定しないため、事前に建設業許可アドオンを登録しておく必要がある。
registerConstructionLicense();
registerKobutsuLicense();

test("buildReminderDigest: 許可日から早期検討・更新準備・最終締切の3件を計算する（決算変更届の指定なし）", () => {
  const alerts = buildReminderDigest(
    [{ clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] }],
    "2026-09-01"
  );
  assert.equal(alerts.length, 3);
  assert.ok(alerts.every((a) => a.clientName === "テスト建設"));
  assert.ok(alerts.every((a) => a.licenseId === "既定")); // 更新関連のアラートにはlicenseIdが付与される（FR-5.4）
  assert.ok(alerts.some((a) => a.type === "renewal-early-notice" && a.dueDateIso === "2028-10-02"));
  assert.ok(alerts.some((a) => a.type === "renewal-prepare" && a.dueDateIso === "2029-01-30"));
  assert.ok(alerts.some((a) => a.type === "renewal-deadline" && a.dueDateIso === "2029-03-01"));
});

test("buildReminderDigest: fiscalYearEndIsoを指定すると決算変更届のリマインドも含まれる（計4件）", () => {
  const alerts = buildReminderDigest(
    [
      {
        clientName: "テスト建設",
        fiscalYearEndIso: "2026-03-31",
        licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }],
      },
    ],
    "2026-09-01"
  );
  assert.equal(alerts.length, 4);
  const kessan = alerts.find((a) => a.type === "kessan-henko");
  assert.equal(kessan.dueDateIso, "2026-07-31");
  assert.equal(kessan.licenseId, undefined); // 決算変更届は会社単位のためlicenseIdは付与されない
});

test("buildReminderDigest: 期限超過はisOverdue=trueかつdaysUntilが負になる", () => {
  const alerts = buildReminderDigest(
    [{ clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2019-04-01" }] }],
    "2026-09-01"
  );
  const deadline = alerts.find((a) => a.type === "renewal-deadline");
  assert.equal(deadline.isOverdue, true);
  assert.ok(deadline.daysUntil < 0);
});

test("buildReminderDigest: 複数クライアントを期限が近い順（daysUntil昇順）にソートする", () => {
  const alerts = buildReminderDigest(
    [
      { clientName: "A社", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] }, // 満了2029-03-31
      { clientName: "B社", licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] }, // 満了2025-03-31（すでに期限超過）
    ],
    "2026-09-01"
  );
  for (let i = 1; i < alerts.length; i++) {
    assert.ok(alerts[i - 1].daysUntil <= alerts[i].daysUntil);
  }
  assert.equal(alerts[0].clientName, "B社"); // 最も期限が近い（超過している）のが先頭
});

test("buildReminderDigest: 1クライアントが複数許可を持つ場合、許可ごとに個別のlicenseIdでアラートを生成する（FR-5.4）", () => {
  const alerts = buildReminderDigest(
    [
      {
        clientName: "複数許可建設",
        licenses: [
          { licenseId: "般-建築工事業", grantDateIso: "2024-04-01" },
          { licenseId: "特-とび土工工事業", grantDateIso: "2020-04-01" },
        ],
      },
    ],
    "2026-09-01"
  );
  // 更新関連3種 × 許可2件 = 6件
  assert.equal(alerts.length, 6);
  const forLicenseA = alerts.filter((a) => a.licenseId === "般-建築工事業");
  const forLicenseB = alerts.filter((a) => a.licenseId === "特-とび土工工事業");
  assert.equal(forLicenseA.length, 3);
  assert.equal(forLicenseB.length, 3);
  // 許可日が異なるため、同じtypeでも期限日が異なるはず
  const deadlineA = forLicenseA.find((a) => a.type === "renewal-deadline");
  const deadlineB = forLicenseB.find((a) => a.type === "renewal-deadline");
  assert.notEqual(deadlineA.dueDateIso, deadlineB.dueDateIso);
});

test("buildReminderDigest: 2許可を持つクライアントでも決算変更届のアラートは1件のみ生成する（重複防止・FR-5.3）", () => {
  const alerts = buildReminderDigest(
    [
      {
        clientName: "複数許可建設",
        fiscalYearEndIso: "2026-03-31",
        licenses: [
          { licenseId: "般-建築工事業", grantDateIso: "2024-04-01" },
          { licenseId: "特-とび土工工事業", grantDateIso: "2020-04-01" },
        ],
      },
    ],
    "2026-09-01"
  );
  const kessanAlerts = alerts.filter((a) => a.type === "kessan-henko");
  assert.equal(kessanAlerts.length, 1); // 許可が2件あってもクライアントにつき1件のみ
  assert.equal(kessanAlerts[0].clientName, "複数許可建設");
});

test("filterDueAlerts: デフォルト30日以内（期限超過含む）に絞り込む", () => {
  const alerts = [
    { clientName: "X", type: "renewal-deadline", label: "l", dueDateIso: "d", daysUntil: -5, isOverdue: true },
    { clientName: "Y", type: "renewal-deadline", label: "l", dueDateIso: "d", daysUntil: 10, isOverdue: false },
    { clientName: "Z", type: "renewal-deadline", label: "l", dueDateIso: "d", daysUntil: 90, isOverdue: false },
  ];
  const due = filterDueAlerts(alerts);
  assert.deepEqual(
    due.map((a) => a.clientName),
    ["X", "Y"]
  );
});

test("filterDueAlerts: withinDaysを指定して閾値を変更できる", () => {
  const alerts = [{ clientName: "Z", type: "renewal-deadline", label: "l", dueDateIso: "d", daysUntil: 90, isOverdue: false }];
  assert.equal(filterDueAlerts(alerts, { withinDays: 90 }).length, 1);
  assert.equal(filterDueAlerts(alerts, { withinDays: 89 }).length, 0);
});

test("formatReminderDigest: 空配列の場合はその旨のメッセージを返す", () => {
  const report = formatReminderDigest([]);
  assert.match(report, /対象のリマインドはありません/);
});

test("formatReminderDigest: 期限超過・30日以内・今後の予定の3区分に分けて出力する", () => {
  const alerts = buildReminderDigest(
    [
      { clientName: "期限切れ社", licenses: [{ licenseId: "既定", grantDateIso: "2020-04-01" }] },
      { clientName: "まもなく社", licenses: [{ licenseId: "既定", grantDateIso: "2026-10-15" }] },
      { clientName: "余裕社", licenses: [{ licenseId: "既定", grantDateIso: "2030-01-01" }] },
    ],
    "2026-09-01"
  );
  const report = formatReminderDigest(alerts);
  assert.match(report, /期限超過（至急確認してください）/);
  assert.match(report, /期限切れ社/);
  assert.match(report, /今後の予定（31日以降）/);
  assert.match(report, /余裕社/);
});

test("formatReminderDigest: 30日以内に期限が到来する区分の見出しも出力する", () => {
  // 最終締切（満了30日前）が基準日の10日後に来るよう許可日を設定し、
  // 「30日以内に期限が到来」区分（期限超過でも31日以降でもない中間区分）を確実に踏む。
  const alerts = buildReminderDigest(
    [{ clientName: "まもなく社", licenses: [{ licenseId: "既定", grantDateIso: "2021-10-12" }] }],
    "2026-09-01"
  );
  const report = formatReminderDigest(alerts);
  assert.match(report, /30日以内に期限が到来/);
  assert.match(report, /まもなく社/);
});

test("formatReminderDigest: licenseIdが付与されたアラートは行にも許可IDを表示する（FR-5.4）", () => {
  const alerts = buildReminderDigest(
    [
      {
        clientName: "複数許可建設",
        licenses: [
          { licenseId: "般-建築工事業", grantDateIso: "2024-04-01" },
          { licenseId: "特-とび土工工事業", grantDateIso: "2020-04-01" },
        ],
      },
    ],
    "2026-09-01"
  );
  const report = formatReminderDigest(alerts);
  assert.match(report, /許可: 般-建築工事業/);
  assert.match(report, /許可: 特-とび土工工事業/);
});

test("buildReminderDigest: contactEmailを指定するとアラートにも引き継がれる", () => {
  const alerts = buildReminderDigest(
    [
      {
        clientName: "テスト建設",
        contactEmail: "info@example.com",
        licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }],
      },
    ],
    "2026-09-01"
  );
  assert.ok(alerts.every((a) => a.contactEmail === "info@example.com"));
});

test("buildReminderMailtoUrl: contactEmailが無ければnullを返す", () => {
  const [alert] = buildReminderDigest(
    [{ clientName: "テスト建設", licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }] }],
    "2026-09-01"
  );
  assert.equal(buildReminderMailtoUrl(alert), null);
});

test("buildReminderMailtoUrl: contactEmailがあればmailto:リンクを返す", () => {
  const [alert] = buildReminderDigest(
    [
      {
        clientName: "テスト建設",
        contactEmail: "info@example.com",
        licenses: [{ licenseId: "既定", grantDateIso: "2024-04-01" }],
      },
    ],
    "2026-09-01"
  );
  const url = buildReminderMailtoUrl(alert);
  assert.match(url, /^mailto:info@example\.com\?subject=/);
  assert.match(decodeURIComponent(url), /テスト建設/);
});

test("buildReminderMailtoUrl: licenseIdがあれば本文に対象の許可を明記する（FR-5.4）", () => {
  const [alert] = buildReminderDigest(
    [
      {
        clientName: "テスト建設",
        contactEmail: "info@example.com",
        licenses: [{ licenseId: "般-建築工事業", grantDateIso: "2024-04-01" }],
      },
    ],
    "2026-09-01"
  );
  const url = buildReminderMailtoUrl(alert);
  assert.match(decodeURIComponent(url), /対象の許可: 般-建築工事業/);
});

test("buildReminderMailtoUrl: 古物商許可のリマインドでも本文に「建設業許可」と固定表示しない（コアの許可種別非依存の原則）", () => {
  const [alert] = buildReminderDigest(
    [
      {
        clientName: "テスト古物商",
        contactEmail: "info@example.com",
        licenses: [
          {
            licenseId: "古物商-既定",
            licenseCategory: "kobutsu",
            kobutsuDetail: { lastRecordedChangeDateIso: "2026-08-01" },
          },
        ],
      },
    ],
    "2026-09-01"
  );
  const url = buildReminderMailtoUrl(alert);
  assert.doesNotMatch(decodeURIComponent(url), /建設業許可/);
});

/** @param {number} daysUntil @returns {import('../src/core/reminders/digest.js').ReminderAlert} */
function makeTestAlert(daysUntil) {
  return {
    clientName: `テスト社(${daysUntil})`,
    type: "renewal-prepare",
    label: "l",
    dueDateIso: "2026-09-01",
    daysUntil,
    isOverdue: daysUntil < 0,
  };
}

test("bucketizeAlerts: REMINDER_RANGESの各キーに対応する配列を持つオブジェクトを返す", () => {
  const buckets = bucketizeAlerts([]);
  for (const { key } of REMINDER_RANGES) {
    assert.ok(Array.isArray(buckets[key]), `${key} が配列でない`);
  }
});

test("bucketizeAlerts: 期限超過（daysUntilが負）はoverdueに分類される", () => {
  const buckets = bucketizeAlerts([makeTestAlert(-1), makeTestAlert(-100)]);
  assert.equal(buckets["overdue"].length, 2);
  assert.equal(buckets["within-1m"].length, 0);
});

test("bucketizeAlerts: daysUntil=0は期限超過ではなくwithin-1mに分類される", () => {
  const buckets = bucketizeAlerts([makeTestAlert(0)]);
  assert.equal(buckets["overdue"].length, 0);
  assert.equal(buckets["within-1m"].length, 1);
});

test("bucketizeAlerts: 境界値ちょうど30日はwithin-1mに含まれる（1-3mではない）", () => {
  const buckets = bucketizeAlerts([makeTestAlert(30)]);
  assert.equal(buckets["within-1m"].length, 1);
  assert.equal(buckets["1-3m"].length, 0);
});

test("bucketizeAlerts: 30日超91日未満は1-3mに分類される", () => {
  const buckets = bucketizeAlerts([makeTestAlert(31), makeTestAlert(89)]);
  assert.equal(buckets["1-3m"].length, 2);
});

test("bucketizeAlerts: 境界値ちょうど90日は1-3mに含まれる（3-6mではない）", () => {
  const buckets = bucketizeAlerts([makeTestAlert(90)]);
  assert.equal(buckets["1-3m"].length, 1);
  assert.equal(buckets["3-6m"].length, 0);
});

test("bucketizeAlerts: 境界値ちょうど180日は3-6mに含まれる（6m-plusではない）", () => {
  const buckets = bucketizeAlerts([makeTestAlert(180)]);
  assert.equal(buckets["3-6m"].length, 1);
  assert.equal(buckets["6m-plus"].length, 0);
});

test("bucketizeAlerts: 180日超は6m-plusに分類される", () => {
  const buckets = bucketizeAlerts([makeTestAlert(181), makeTestAlert(1000)]);
  assert.equal(buckets["6m-plus"].length, 2);
});
