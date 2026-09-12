# 変更履歴

このファイルはマイルストーン単位での主要な変更を記録する。
[Keep a Changelog](https://keepachangelog.com/) の考え方を参考にしつつ、
本プロジェクトの開発体制（副業・個人運用）に合わせて簡略化している。
日付単位のリリースではなく `docs/PROPOSAL.md` のマイルストーン（M1〜）を
単位として記録する。

## M4: 通知連携（一部完了）

- クライアントの許可情報をローカルJSONファイル（`data/clients.json`）に
  保存・読込する `src/reminders/clientStore.js` を追加
- 更新準備・更新申請の最終締切・決算変更届のリマインドを集計・整形する
  `src/reminders/reminderDigest.js` を追加（`buildReminderDigest` /
  `filterDueAlerts` / `formatReminderDigest`）
- 連絡先メールアドレス（任意）を登録したクライアントについて、
  メール下書きを開く `mailto:` URLを生成する `buildReminderMailtoUrl` を追加
  （実際の自動送信は行わない）
- クライアントの登録・削除・確認用CLI（`scripts/add-client.js` /
  `remove-client.js` / `reminder-digest.js`）を追加
- Webフォームに `GET /reminders`（表示専用）を追加
- 実際のメール等の自動送信（SMTP・API連携）は未実装。送信チャネルの選定は
  発注者の意思決定事項として保留（`docs/DESIGN.md` §5.11参照）

## M3: インテイク簡易フォーム（完了）

- `node:http` のみで実装したローカルWebフォーム（`src/web/`）を追加。
  ブラウザからApplicantProfileを入力し、要件判定＋書類生成をワンストップで実行
- `127.0.0.1` のみで待受し、外部ネットワークには公開しない
- フォーム値はブラウザ側JavaScriptでApplicantProfile型のJSONに組み立ててから
  通常のフォームPOSTで送信する方式を採用（サーバー側の受け口を単純化）
- `/download` にパストラバーサル対策を実装

## M2: 主要様式フル対応（完了）

- 様式第六号（役員等の一覧表）・第七号（経営業務管理責任者証明書）・
  第八号（専任技術者証明書）・第二十号の二（誓約書）のdocx生成を追加
- 既存の様式第一号（`youshiki1.js`）を含む全様式生成モジュールが
  要件判定エンジンと同じ `ApplicantProfile` 型を入力とするようリファクタリング
  （FR-2.7対応。様式ごとのデータ二重定義を排除）
- 様式生成の共通ヘルパー（見出し・赤字注記・表・箇条書き）を
  `src/documents/common.js` に集約
- Node.js v24環境で `node --test <ディレクトリ>` が失敗する問題を確認し、
  `package.json` の `test` スクリプトを `node --test`（自動探索）に変更

## M1: 要件判定エンジンMVP（完了）

- 建設業許可の法定5要件（経営業務管理体制・専任技術者・財産的基礎・
  欠格要件・誠実性）の判定エンジンを実装
- 許可の有効期間満了日（5年）・決算変更届の提出期限（事業年度終了後4ヶ月）の
  計算ロジックを実装
- 様式第一号のdocxサマリー生成の試作を実装

## 開発基盤（継続的に追加）

- GitHub Actions（`.github/workflows/test.yml`）でpush・PR時に
  Node.js 20.x/22.xの2バージョンで `npm test` を自動実行
- Dependabot（`.github/dependabot.yml`）でnpm依存パッケージ・GitHub Actionsの
  更新PRを週次で自動作成
- `.gitattributes` で改行コードをLFに正規化し、開発環境間の差分揺れを防止
- `docs/BEST_PRACTICES_AUDIT.md` でセキュリティ・依存関係管理・テスト/CI・
  リポジトリ運用の観点から定期的に棚卸しする運用を開始
