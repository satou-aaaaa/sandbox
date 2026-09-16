# ベストプラクティス監査（2026年9月）

このプロジェクトのソフトウェア開発体制について、一般的なNode.jsプロジェクト・
GitHubリポジトリ運用のベストプラクティスと照らし合わせた棚卸し結果。
`docs/DEVELOPMENT_GUIDE.md` 6章（セキュリティ・情報管理）を補完する位置づけ。
第2回監査（開発プロセス・コードレビュー・DevOps観点）では、社内資料
「ソフトウェア開発におけるベストプラクティス」（開発プロセス全般／コード品質・
レビュー／テスト・品質保証／DevOps・CI/CD・運用の4分野。Google・Atlassian・
Martin Fowler・OWASP・Google Cloud DORAチーム等の公開資料を出典とする）を
参照した。

**前提**: 本プロジェクトは個人の副業運用（DEVELOPMENT_GUIDE.md 6章）であり、
組織向けの大掛かりな体制は意図的に採用していない。以下の判定も
「シンプルな構成を維持する」という設計原則（DESIGN.md 1章）を踏まえて行った。
多くのプラクティス（スプリント運用、DORAメトリクス、Infrastructure as Code、
フィーチャーフラグ等）はチーム開発・本番デプロイを前提としており、
単独開発でローカル実行が中心の本プロジェクトには当てはまらない
（該当なしとして扱った項目は各表に明記）。

凡例: ✅ 実施済み / 🟡 検討の余地あり（未実施・任意） / ⛔ 意図的に見送り・該当なし

## 0. 開発プロセス全般

| 項目 | 状態 | 補足 |
|---|---|---|
| 要件の明文化・受け入れ条件の合意 | ✅ | `docs/REQUIREMENTS.md` 7章の受け入れ基準として既に運用中 |
| 変更を小さいバッチに分割する | ✅ | マイルストーン単位・機能単位でPRを分割（M2〜M4を計7件のPRに分割してマージ済み） |
| セキュリティ・バイ・デザイン（シフトレフト） | ✅ | NFR-2/NFR-4を要件定義段階から明記済み。今回さらにpre-commitでのシークレットチェック（`hooks/check-secrets.mjs`）を追加し、コミット前の段階に検知ポイントを増やした |
| 生きたドキュメント（Docs as Code） | ✅ | 全ドキュメントをリポジトリ内でバージョン管理し、実装と同じPRで更新する運用を継続中。今回 `docs/adr/` を新設し、「なぜその設計を選んだか」という意思決定の背景を残す仕組みを追加した |
| アジャイル運用（スプリント・ベロシティ計測） | ⛔ | 単独開発・副業運用のため、チーム運用を前提としたスプリント計測は該当なし。マイルストーン単位の進捗管理（`docs/PROPOSAL.md`）で代替している |
| 継続的な振り返り（レトロスペクティブ） | 🟡 | チームでの実施は該当なしだが、`CHANGELOG.md` にマイルストーンごとの実装内容を記録する運用が簡易的な振り返り記録を兼ねている |

## 1. セキュリティ

| 項目 | 状態 | 補足 |
|---|---|---|
| 依存パッケージの脆弱性チェック（`npm audit`） | ✅ | CIで `npm audit --audit-level=high` を自動実行。監査時点（2026年9月）で0件 |
| 依存パッケージの自動更新（Dependabot） | ✅ | `.github/dependabot.yml`（npm・GitHub Actions双方、週次） |
| 秘密情報の管理（APIキー等） | ✅ | 現状は秘密情報を持たない。将来必要になった場合は `.env`（`.gitignore`済み）で管理する方針が既に明記されている（DEVELOPMENT_GUIDE.md 6章） |
| 顧客個人情報の外部送信防止 | ✅ | NFR-4として設計原則に明記済み。Webフォーム・リマインド機能とも127.0.0.1限定・mailtoのみ |
| 入力バリデーション（スキーマ検証） | ⛔ | Zod等のスキーマバリデータは未導入。設計原則上「エラーで止めるのではなくwarningで継続」方針（DESIGN.md 6章）を優先しており、意図的に厳密な入力検証を持たせていない。顧客対応はブラウザ経由でも最終的に行政書士本人が内容確認する前提のため、現状は妥当と判断 |
| 依存パッケージ数の最小化 | ✅ | 本番依存は `docx` 1件のみ |
| コミット前のシークレット混入防止 | ✅ | `hooks/check-secrets.mjs`（pre-commitフック）。AWSキー・Google APIキー・Slackトークン・秘密鍵・汎用的な`api_key=`等のパターンを検知する簡易チェック。導入コストを抑えるため外部ツール（gitleaks等）は使わず、`git`コマンドのみで実装 |
| CI側でのシークレット混入チェック（二重の安全網） | ✅ | 2026年9月追加。`hooks/check-secrets.mjs --all`（`npm run check-secrets`）をCIでも実行し、リポジトリ全体を対象に再チェックする。ローカルのpre-commitフックは`--no-verify`でバイパスできる・`git config core.hooksPath hooks`を設定していない環境からのpushには効かないため、その穴を埋める目的 |
| GitHub純正のシークレットスキャン・CodeQL（コードスキャン） | ⛔ | 2026年9月にGitHub APIで確認したところ、本リポジトリ（非公開・GitHub Freeプラン）では利用不可（`secret-scanning/alerts`→404、`code-scanning/alerts`→403。いずれもGitHub Advanced Security機能のため）。上記の自作チェックで代替している |
| 依存パッケージのレジストリ署名検証 | ✅ | 2026年9月追加。CIで`npm audit signatures`を実行し、npmレジストリ上のパッケージ署名を検証する（サプライチェーン改ざん対策） |
| 静的解析（SAST） | ✅ | 2026年9月追加（§2参照）。`eslint-plugin-security`を導入済み。旧版では本行を🟡（未導入）としていたが、§2の記述と矛盾していたため訂正（第7回監査で判明） |
| プライバシー・バイ・デザイン | ✅ | `ApplicantProfile`・`ClientRecord`（M7以前は`ClientLicenseRecord`）とも設計当初から「外部送信しない」ことを前提に設計済み（NFR-4、ADR-0004） |
| GitHub Actionsワークフローの権限最小化 | ✅ | 2026年9月追加。`.github/workflows/test.yml`に`permissions: contents: read`を明記し、`GITHUB_TOKEN`の権限をデフォルトの広い権限ではなく必要最小限に絞った |

## 2. テスト・CI

| 項目 | 状態 | 補足 |
|---|---|---|
| ユニットテスト | ✅ | `node --test`（Node.js標準機能）。全件通過を維持中（正確な件数はモジュール追加のたびに変わるため`npm test`の実行結果を確認すること。件数のハードコードは第7回監査で撤廃） |
| CI（push/PR時の自動テスト） | ✅ | `.github/workflows/test.yml`。Node.js 20.x/22.x × ubuntu-latest/windows-latest の計4通りで実行（2026年9月にWindows環境を追加。開発機がWindowsであり、過去に改行コード関連の問題が実際に発生した経緯を踏まえた対応） |
| CIの実行効率・堅牢性 | ✅ | 2026年9月追加。`concurrency`設定で同一ブランチ・PRへの連続pushの古い実行を自動キャンセル、`timeout-minutes: 10`でハング時のActions利用時間浪費を防止、`fail-fast: false`でOS/Node.jsバージョンの組み合わせごとの結果を最後まで確認できるようにした |
| CI実行結果のサマリー表示 | ✅ | 2026年9月追加。テスト件数・カバレッジ数値を`$GITHUB_STEP_SUMMARY`に出力し、ログを展開しなくてもActionsの実行画面で概要を確認できるようにした |
| テストカバレッジ計測 | ✅ | `npm run test:coverage`（`--experimental-test-coverage`）。CIでは22.xのジョブでのみ表示（Node 20系に既知の不具合があるため）。継続してライン・分岐とも99%超を維持中（直近確認: 2026年9月、ライン約99.8%・分岐約99.1%。新規モジュール追加のたびに変動するため、正確な数値は`npm run test:coverage`の実行結果を確認すること）。`npm run test:coverage:html`（c8）でドリルダウン可能なHTMLレポートも生成できる（`coverage/index.html`） |
| カバレッジの閾値強制 | ⛔ | `--test-coverage-lines` 等で閾値未達を失敗にする設定は未導入。個人開発でカバレッジ数値そのものを目的化しないため、情報表示に留めている |
| ミューテーションテスト | ✅ | 2026年9月追加。Stryker Mutatorで要件判定・欠格事由判定・日付/金額計算・CSV相互変換に対象を絞って導入（`npm run test:mutation`）。カバレッジでは検出できないアサーション不足の実バグを複数発見・修正した。詳細は[ADR-0011](adr/0011-mutation-and-property-based-testing.md) |
| Property-based testing | ✅ | 2026年9月追加。fast-checkで日付計算・CSV往復変換・HTMLエスケープにランダム入力での性質検証を追加。[ADR-0011](adr/0011-mutation-and-property-based-testing.md) |
| アクセシビリティテスト | ✅ | 2026年9月追加。axe-core + jsdomで`src/web/*Page.js`の4画面を検証（`test/accessibility.test.js`）。導入初回でラベル欠落（critical）等の実際の不具合を発見・修正した。[ADR-0012](adr/0012-accessibility-e2e-sast-coverage-tooling.md) |
| 静的セキュリティ解析（SAST） | ✅ | 2026年9月追加。`eslint-plugin-security`を`npm run lint`に追加。検出精度の限界（ベンチマークで27.5%程度）を認識した上での「無いよりはまし」という位置づけ。[ADR-0012](adr/0012-accessibility-e2e-sast-coverage-tooling.md) |
| カオスエンジニアリング（障害注入テスト） | ✅ | 2026年9月追加。`test/chaos.test.js`でファイルシステムの障害・同時実行の競合を注入。**作成過程で実際の競合状態バグ（同時書き込みによるクライアント登録のlost update）を発見し、`src/core/reminders/fileLock.js`で修正した**。[ADR-0013](adr/0013-load-chaos-contract-testing.md) |
| 負荷テスト | ✅ | 2026年9月追加。autocannonで`GET /`・`POST /submit`への同時アクセスを検証（`npm run test:load`）。具体的な性能閾値ではなくエラー・タイムアウトの有無のみ判定。[ADR-0013](adr/0013-load-chaos-contract-testing.md) |
| 契約テスト | ✅ | 2026年9月追加。`schemas/client-record.schema.json`（JSON Schema）+ ajvで`ClientRecord`/`LicenseEntry`の形を検証（`test/contract.test.js`）。外部API消費者がまだ無いため、将来のAPI公開に備えた土台という位置づけ。[ADR-0013](adr/0013-load-chaos-contract-testing.md) |
| ブランチ保護ルール（必須レビュー等） | 🟡 | GitHub側のリポジトリ設定（Settings > Branches）で有効化可能。単独開発のためレビュー必須は現実的でないが、「CIが通るまでマージ不可」の設定は検討の余地あり。コードからは変更できないため、必要なら発注者（あなた）がGitHub UIで設定すること |
| 型チェック（JSDoc + `tsconfig.json` の `checkJs`） | ✅ | 独立したタスクとして着手し導入済み。`npm run typecheck`（`tsc --noEmit`）をCIに追加。対象は`src/`・`scripts/`のみ（`test/`は対象外。ダミーデータ主体でstrictモードとの相性が悪いため）。導入時に判明した既存コードの型不備（暗黙のany、`err.code`アクセス時のunknown型、`req.url`のundefined未考慮等）は修正済み。詳細は[ADR-0007](adr/0007-checkjs-type-checking.md) |
| テストピラミッド構成の明文化 | ✅ | DESIGN.md 7章に追記。単体テストを主体とし、`web.test.js`のような結合テストは最小限。E2Eテスト（Playwright）は2026年9月に導入し、golden pathの疎通確認に限定（ubuntu・Node22.xの1系統のみCIで実行）。[ADR-0012](adr/0012-accessibility-e2e-sast-coverage-tooling.md) |
| テストが実装ではなく振る舞いを検証しているか | ✅ | 既存テストは公開関数（`checkKeieiGyomuKanri`、`buildYoushiki1Document`等）の入出力を検証しており、プライベートな内部実装には依存していない。新規踏襲すべきパターンとして継続する |

## コードレビュー（単独開発におけるセルフレビュー運用）

Googleのeng-practicesが挙げる12のレビュー観点（設計・機能性・複雑性・
テスト・命名・コメント・スタイル・一貫性・ドキュメント・全行・文脈・良い点）は、
他者レビューが存在しない単独開発でも「マージ前の自己チェックリスト」として有効。
また、レビューの合格ラインは「完璧」ではなく「確実に健全性が向上したか」であり、
他者レビューを依頼する場合は応答を営業日1日以内とする運用とする
（eng-practices原文と照合した結果、当初「8項目」「テスト観点＝カバレッジ」と
していたのは誤りだったため訂正。§5第3回参照）。

| 項目 | 状態 | 補足 |
|---|---|---|
| セルフレビューチェックリスト | ✅ | `.github/pull_request_template.md` にGoogle eng-practicesの12項目を追加。PR作成時に必ず目にする位置に配置 |
| レビューの合格ライン・応答SLAの明記 | ✅ | 「完璧ではなく健全性の確実な向上」「営業日1日以内に反応」をPRテンプレートに明記 |
| 変更を小さく保つ運用 | ✅ | 既に機能単位でPRを分割済み（§0参照） |
| 自動チェックを先に通す（CI→人手レビューの順） | ✅ | CI（`npm test`・`npm audit`）がPR作成時に自動実行され、セルフレビューはその後に行う運用 |
| ペアプログラミング・対面レビューの代替手段 | ⛔ | 単独開発のため該当なし |

## 3. コード品質・スタイル

| 項目 | 状態 | 補足 |
|---|---|---|
| 改行コードの正規化 | ✅ | `.gitattributes`（`* text=auto eol=lf`）を追加。Windows環境で `git add` のたびにCRLF警告が出ていた問題を解消 |
| Node.jsバージョン固定（開発環境） | ✅ | `.nvmrc`（`20`）を追加。`nvm use` で `engines` の最小バージョンに揃えられる |
| Linter（ESLint等） | ✅ | `eslint`（flat config、`eslint.config.js`）を導入。`npm run lint` としてCIに追加。ビルドステップは増やしていない（`js.configs.recommended` ベース。型チェックはtsconfig.json/checkJs側の役割のため型関連ルールは扱わない）。導入時点でエラー0件 |
| Formatter（Prettier等） | 🟡 | 同上。現状はコードスタイルが手作業で概ね統一されているため見送り |
| コミット規約（Conventional Commits等） | ⛔ | DEVELOPMENT_GUIDE.md 3.3節で「日本語で簡潔に」という既存方針があり、変更しない |

## 4. リポジトリ運用・ドキュメント

| 項目 | 状態 | 補足 |
|---|---|---|
| README（概要・セットアップ手順） | ✅ | 既存。CIバッジも追加済み |
| ライセンス表記 | ✅ | `package.json` に `"license": "UNLICENSED"` を追加（非公開・個人所有であることを明示し、誤ってnpm公開されることを防ぐ） |
| `repository` フィールド | ✅ | `package.json` に追加 |
| PRテンプレート | ✅ | `.github/pull_request_template.md`。DEVELOPMENT_GUIDE.md 5章の受け入れ・検収チェックをテンプレート化 |
| 変更履歴（CHANGELOG） | ✅ | `CHANGELOG.md` を新設。マイルストーン単位で記録 |
| CONTRIBUTING.md | ⛔ | 外部コントリビューターを募集する予定がなく、DEVELOPMENT_GUIDE.mdが実質的に同じ役割を果たしているため不要 |
| SECURITY.md（脆弱性報告手順） | ⛔ | 非公開の個人プロジェクトであり、外部からの脆弱性報告を受け付ける想定がないため不要 |
| CODEOWNERS | ⛔ | 単独開発のため不要 |
| Issueテンプレート | 🟡 | 自分用のバグ管理にIssueを使うなら検討の余地あり。現状は口頭・Obsidian Vaultで管理していると想定し見送り |
| GitHub Releases（マイルストーンごとのリリースノート） | 🟡 | `CHANGELOG.md` で代替できるため必須ではないが、区切りが欲しければ `git tag` + GitHub Releasesの活用を検討してもよい |
| アーキテクチャ決定記録（ADR） | ✅ | `docs/adr/` を新設・継続運用中。件数は増え続けるため本表には列挙しない（正確な一覧は`docs/adr/`を直接確認すること。過去に本行へ件数をハードコードしていたが、新規ADR追加のたびに更新漏れで陳腐化するため第7回監査で撤廃した） |

## DevOps・CI/CD・運用

| 項目 | 状態 | 補足 |
|---|---|---|
| CI/CDパイプラインのゲート（ビルド→静的解析→テスト→セキュリティスキャン） | ✅（該当範囲のみ） | `npm test` → `npm run test:coverage` → `npm audit` の順にCIを構成。「デプロイ」に相当する工程自体が存在しない（ローカル実行のツールであり、本番環境へのリリースを行わないため） |
| トランクベース開発（短命なブランチ） | ✅ | 各機能ブランチは実装完了後すぐPR化・マージしており、長期間残る機能ブランチは発生していない |
| フィーチャーフラグ | ⛔ | 段階的ロールアウトが必要な「本番環境の複数ユーザー」が存在しない（ローカル実行の単独ユーザー向けツール）ため該当なし |
| Infrastructure as Code | ⛔ | 管理対象のサーバー・クラウドインフラが存在しないため該当なし |
| オブザーバビリティ（ログ） | ✅ | `src/web/server.js` に最小限のアクセスログ（メソッド・パス・ステータス・所要時間）を追加。個人情報を含むPOSTボディは意図的にログ対象外とした |
| オブザーバビリティ（メトリクス・トレース） | ⛔ | 単一プロセス・ローカル実行のツールであり、分散システムのボトルネック特定という課題そのものが存在しないため該当なし |
| DORAメトリクス（デプロイ頻度・変更失敗率等） | ⛔ | 本番環境への継続的デプロイを行わないツールのため、指標自体が意味を持たない |

## 5. 実施履歴

### 第1回（2026年9月・一般的なNode.js/GitHubベストプラクティス）

- `.gitattributes` の追加（改行コード正規化）
- `.nvmrc` の追加
- `package.json` に `license` / `repository` フィールド、`test:coverage` スクリプトを追加
- CIワークフローに `npm run test:coverage`（22.xのみ）と `npm audit --audit-level=high` を追加
- `.github/dependabot.yml` の追加（npm・GitHub Actions、週次）
- `.github/pull_request_template.md` の追加
- `CHANGELOG.md` の新設

### 第2回（2026年9月・社内資料「ソフトウェア開発におけるベストプラクティス」参照）

- `docs/adr/` の新設（ADRテンプレート＋過去の主要決定を4件遡って記録）
- `.github/pull_request_template.md` にGoogle eng-practicesの8項目セルフレビューチェックリストを追加
- `hooks/check-secrets.mjs` + `hooks/pre-commit`（シークレット混入防止のpre-commitフック。`git config core.hooksPath hooks` で有効化）
- `src/web/server.js` に最小限のアクセスログを追加（個人情報を含むPOSTボディは対象外）
- `docs/DESIGN.md` にテストピラミッドの考え方を明記
- `docs/DEVELOPMENT_GUIDE.md` にADR運用・pre-commitフック有効化手順・セルフレビュー手順を追記

### 第3回（2026年9月・一次資料との照合により誤りを訂正）

第2回で参照した社内資料の出典であるGoogle eng-practices原文
（[How to do a code review](https://google.github.io/eng-practices/review/)）を
直接確認した結果、以下の誤りが判明したため訂正した。

- レビュー観点は実際には8項目ではなく**12項目**（一貫性・全行・文脈・良い点の
  4項目が欠落していた）
- テスト観点は「十分なカバレッジを持つか」ではなく、**「壊れたときに実際に
  失敗するか（偽陽性がないか）」**が原文の記述（原資料内でも他章の記述と
  矛盾していた）
- Google eng-practicesの中で最も実務インパクトが大きい2点が欠落していた：
  レビューの合格ライン（「完璧」ではなく「確実に健全性が向上したか」）と、
  **応答は営業日1日以内**というSLA
- `.github/pull_request_template.md` と本ドキュメント（§2「コードレビュー」）を
  訂正済み

### 第4回（2026年9月・型チェック（`checkJs`）の導入）

- `typescript` / `@types/node` を開発依存として追加
- `tsconfig.json`（`checkJs: true` / `noEmit: true` / `strict: true`、対象は
  `src/`・`scripts/`のみ）を追加し、`npm run typecheck` をCIに追加
- 導入時に判明した既存コードの型不備を修正（`src/documents/youshiki7.js` 等の
  ラベル・値の表データに対する型注釈追加、`src/eligibility/rules/senninGijutsusha.js`
  の暗黙any、`src/reminders/clientCsv.js` の`ClientLicenseRecord`型不足、
  `src/reminders/clientStore.js`・`src/web/draftStore.js` の`catch`節での
  unknown型対応、`src/web/server.js` の`req.url`未定義考慮など）
- 詳細は [ADR-0007](adr/0007-checkjs-type-checking.md) 参照

### 第5回（2026年9月・ESLint導入）

- `eslint` / `@eslint/js` / `globals` を開発依存として追加
- `eslint.config.js`（flat config。`js.configs.recommended` ベース）を追加し、
  `npm run lint` をCIに追加。ビルドステップは増やしていない
- 導入時点で既存コードのlintエラーは0件だった

### 第6回（2026年9月・CI強化）

「CIを強化しようと考えています」という依頼を受け、GitHub APIで
ブランチ保護・シークレットスキャン・コードスキャンの利用可否を確認した上で
（いずれもGitHub Freeプランの非公開リポジトリでは利用不可と確認済み）、
既存の仕組みを拡張する形で対応した。

- `.github/workflows/test.yml` のマトリクスに`windows-latest`を追加
  （ubuntu-latest/windows-latest × Node.js 20.x/22.xの計4通り）。開発機が
  Windowsであり、過去に改行コード関連の問題（`.gitattributes`で対処済み）が
  実際に発生した経緯を踏まえた対応。`fail-fast: false`も追加し、1つの
  組み合わせが失敗しても他の結果を確認できるようにした
- ワークフローに`permissions: contents: read`（`GITHUB_TOKEN`の権限最小化）、
  `concurrency`（連続pushでの古い実行の自動キャンセル）、
  `timeout-minutes: 10`（ハング時の利用時間浪費防止）を追加
- `hooks/check-secrets.mjs`に`--all`オプション（HEAD時点の全ファイルを
  対象にスキャン）を追加し、`npm run check-secrets`としてCIでも実行。
  ローカルのpre-commitフックが`--no-verify`でバイパスされた場合や
  `git config core.hooksPath hooks`未設定の環境からのpushにも対応する
  二重の安全網とした
- CIに`npm audit signatures`を追加（npmレジストリのパッケージ署名検証）
- テスト件数・カバレッジ数値を`$GITHUB_STEP_SUMMARY`に出力し、Actionsの
  実行画面でログを展開せずに概要を確認できるようにした

「CIに無駄がないか調査してください」という依頼を受け、実際のCI実行時間を
GitHub APIで計測し、確実な無駄を2件特定して解消した（テスト範囲を減らす
判断を伴う項目は対象外とし、別途確認の上で判断する）。

- `npm audit`・`npm audit signatures`が、結果がNode.jsバージョンに依存
  しない（`package-lock.json`のみに依存する）にもかかわらずubuntu上で
  20.x/22.xの両方で実行されていたため、22.xの1系統のみに絞った
- ubuntu・22.xのジョブで、`npm test`（通常実行）の直後に
  `npm run test:coverage`（同じ200件をカバレッジ計測付きで再実行）が
  実行されており、同一テストが1ジョブ内で2回実行されていたため、
  そのセルのみ`npm test`ステップを省略した（カバレッジ計測ステップ側の
  合否件数で代替できるため）
- 一方、Windows環境を20.x/22.xの両方でテストしている点（Windows runnerは
  Linuxの2倍の課金倍率）は、テスト対象の組み合わせを意図的に減らす判断を
  伴うため今回は対応せず、発注者の判断を仰ぐこととした

### 第7回（2026年9月・「ソフトウェア開発におけるベストプラクティスを導入したい」の依頼を受けた棚卸し）

前回までの6回の監査で標準的な項目はほぼ実施済みだったため、今回は
(a) 既存ドキュメント自体の陳腐化（本監査が掲げる「生きたドキュメント」原則
との矛盾）の点検、(b) 軽量で追加コストの低い項目の導入、(c) 保留中の
発注者判断事項の再提起、の3点に絞って実施した。

- **本監査ドキュメント自身の矛盾を修正**: §1「静的解析（SAST）」が🟡（未導入）
  のままだったが、§2には2026年9月に導入済みと記載されており矛盾していた
  ため訂正。あわせて、テスト件数・カバレッジ数値・ADR件数をハードコード
  していた箇所（モジュール追加のたびに更新漏れで陳腐化する）を、具体的な
  数値の列挙から「実行結果を確認すること」という参照方式に変更した
- **`docs/DESIGN.md` §3ディレクトリ構成図の刷新**: CLAUDE.mdが「M11のコア
  抽出前の記述が残り実体とずれている」と長らく注記していた既知の陳腐化を
  解消し、現在の`src/core/`＋`src/licenses/<種別>/`構成を反映した。あわせて
  §4以降に残る同種の古いパス表記（`src/eligibility/`・`src/reminders/`等）
  について、実装当時の経緯を記録した歴史的記述として意図的に残す旨を
  文書冒頭に明記し、現在の実際のパスとの対応が分かるようにした
- **`.editorconfig`の追加**: `.gitattributes`（改行コード）を補完する形で、
  インデント幅・文字コード・行末の改行を明記。追加コストがほぼゼロの
  標準的なプラクティスのため導入した
- **ADR-0014の追加**: 産廃・民泊・技人国ビザの3モジュール追加を通じて、
  `registerScheduleFn`のレジストリ契約（M11で導入）を変更せずに4種類の
  異なるリマインド計算パターン（満了日ベース固定/可変期間、変更トリガー型、
  暦日固定・反復型）に対応できることが実証された。この設計上の知見を
  将来のモジュール追加のために記録した
- **Prettier（コードフォーマッタ）の再検討**: モジュール数が5→9に増えた
  現時点でも改めて確認したが、ESLintにスタイル関連ルールは無く手動での
  統一に依存している状態は変わっていない。ただし追加コスト（設定ファイル・
  CIステップ・既存コード全体への一括適用によるレビュー困難な大差分）に
  見合うほどのスタイル不統一は現状確認できなかったため、引き続き🟡
  （見送り）のまま据え置いた
- **保留事項の再確認**: §6の2項目（ブランチ保護ルールのためのGitHub Pro
  アップグレード、Windows CI マトリクスの削減）は発注者の費用対効果判断が
  必要なため、今回もコードからは対応せず、あらためて確認を依頼した

## 6. 次に検討する価値がある項目（優先度順の目安）

1. **ブランチ保護ルール（保留・要発注者判断）**: GitHub Settings上で「CI成功を
   マージ条件にする」設定を有効化すると、テストが壊れた状態で誤って `master`
   にマージすることを防げる。ただし2026年9月時点で確認したところ、**GitHub
   Freeプランの非公開リポジトリでは、必須ステータスチェック（Required status
   checks）を含むブランチ保護ルール・Repository Rulesetsのいずれも使用できない**
   （API・GitHub UIとも「Upgrade to GitHub Pro or make this repository public」
   と表示される）。有効化するには (a) GitHub Proへのアップグレード（個人向け、
   月額数百円程度）、(b) リポジトリを公開にする、のいずれかが必要。本リポジトリは
   非公開運用を前提としているため(b)は推奨しない。(a)を選ぶかどうかは費用対効果の
   判断であり、発注者（あなた）の判断が必要
2. **CIのWindowsマトリクスの削減（保留・要発注者判断）**: Windows環境を
   `.github/workflows/test.yml`に追加した目的はOS依存のバグ（パス区切り文字・
   改行コード等）の検出であり、これはNode.jsのメジャーバージョンにはほぼ
   依存しない。一方でGitHub ActionsのWindows runnerはLinuxの2倍の課金倍率
   のため、現状の「Windows×20.x・22.xの両方」を「Windows×22.xのみ」に
   絞ることで、目的（OS差異の検出）を保ったままCIのジョブ数を4→3に減らせる。
   ただしテスト対象の組み合わせを意図的に減らす判断のため、発注者
   （あなた）の確認を得てから対応する

## 参考情報

### 社内資料

- 「ソフトウェア開発におけるベストプラクティス」調査資料（開発プロセス・
  コード品質/レビュー・テスト/QA・DevOps/CI/CDの4分野。Google eng-practices、
  Martin Fowlerのテストピラミッド、Atlassian、OWASP DevSecOps Guideline、
  Google Cloud DORAチームの公開資料を出典として整理したもの）

### Web調査

- [nodebestpractices（Node.js best practices list）](https://github.com/goldbergyoni/nodebestpractices)
- [Node.js Security Best Practices 2026 | Corgea](https://corgea.com/learn/nodejs-security-best-practices-2026)
- [Node.js Test Runner Documentation](https://nodejs.org/api/test.html)
- [GitHub Docs: Configuring Git to handle line endings](https://docs.github.com/en/get-started/git-basics/configuring-git-to-handle-line-endings)
- [.gitattributes Best Practices](https://rehansaeed.com/gitattributes-best-practices/)
- Google, "Engineering Practices Documentation - How to do a code review", https://google.github.io/eng-practices/review/
- Martin Fowler, "The Practical Test Pyramid", https://martinfowler.com/articles/practical-test-pyramid.html
- Atlassian, "Trunk-based Development", https://www.atlassian.com/continuous-delivery/continuous-integration/trunk-based-development
- OWASP, "DevSecOps Guideline", https://owasp.org/www-project-devsecops-guideline/
