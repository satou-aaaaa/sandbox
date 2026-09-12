# 0008. クライアントが複数の許可を保有できるデータモデルへ変更する

Status: Accepted
Date: 2026-09-12

## Context（背景）

競合サービス（クリックス社の建設業向け製品、許認可更新期限管理ツール系記事）を
調査した結果、「顧客×許認可の紐付け（1顧客が複数の許認可を保有する）」への
対応が業界標準の必須機能とされていることが判明した（`docs/PROPOSAL.md` M7参照）。

実態として、建設業者は以下のように複数の許可を同時に保有することが珍しくない。

- 一般建設業と特定建設業の両方を保有（業種によって区分が異なる）
- 業種追加により、同じクライアントが複数の業種の許可を、異なる許可年月日で保有

現行の `ClientLicenseRecord`（`src/reminders/reminderDigest.js`）は
「1クライアント＝1許可（1つの`grantDateIso`）」を前提としており、この実態に
対応できていない。`clientStore.js` も `clientName` をキーに1件だけ保持する
設計になっている。

## Decision（決定）

「クライアント（会社単位）」と「許可（1件単位）」を分離した2階層のデータモデルへ変更する。

```js
/**
 * @typedef {Object} LicenseEntry 許可1件分の情報
 * @property {string} licenseId クライアント内で一意なラベル（例: "般-建築工事業"）
 * @property {"一般" | "特定"} [licenseType]
 * @property {string} grantDateIso
 */

/**
 * @typedef {Object} ClientRecord クライアント（会社）1件分の情報
 * @property {string} clientName
 * @property {string} [fiscalYearEndIso] 決算日は会社単位（複数許可でも1つ）
 * @property {string} [contactEmail] 連絡先も会社単位
 * @property {LicenseEntry[]} licenses 保有する許可の一覧（1件以上）
 */
```

`fiscalYearEndIso` と `contactEmail` は会社単位の属性であり、許可ごとに
重複させない（決算変更届のリマインドが許可の数だけ重複して出るのを防ぐため）。

**既存データの移行方針**: 専用のマイグレーションスクリプトは用意せず、
`clientStore.js` の `loadClients()` が読み込み時に旧形式（トップレベルに
`grantDateIso` を持つ要素）を検出したら、その場で
`{ ...client, licenses: [{ licenseId: "既定", grantDateIso: client.grantDateIso }] }`
の新形式へ変換してから返す（lazy migration）。保存時は常に新形式で書き出す。
本ツールはまだ試験運用前で `data/clients.json` に実データが入っていない
想定だが、念のため既存形式のファイルを壊さない設計とする。

CSVフォーマット（`clientCsv.js`）も「1行＝1許可」に変更する（列:
`clientName, licenseId, licenseType, grantDateIso, fiscalYearEndIso, contactEmail`。
会社単位の列は同一クライアントの全行で同じ値を繰り返す、単純な非正規化形式）。
`licenseId` 列が無い旧形式CSVは、`licenseId` を "既定" として1許可分に
変換して読み込む。

## Consequences（影響）

- **メリット**: 一般・特定の両方保有、業種追加による複数許可保有という実態に
  対応でき、競合サービスと同等の機能を提供できる
- **デメリット**: `reminderDigest.js` のループが「クライアント→許可」の
  二重ループになり、`ReminderAlert` に `licenseId`（任意）を追加する必要がある。
  `scripts/add-client.js` 等のCLIも「既存クライアントへの許可追加」操作に
  対応させる改修が必要
- **意図的にやらないこと**: 経営事項審査（経審）の点数計算・業種コードの
  正規化などは対象外（別途「M7より大きい話」として競合調査の際に
  切り分け済み。`docs/PROPOSAL.md` 参照）
- **見直しのトリガー**: 実運用で「1クライアント1許可」以外のケースが
  想定より少ないと判明した場合、`licenses` を単一要素前提で扱うUIの
  簡略化を再検討する
