# ベストプラクティス監査（2026年9月）

このプロジェクトのソフトウェア開発体制について、一般的なNode.jsプロジェクト・
GitHubリポジトリ運用のベストプラクティスと照らし合わせた棚卸し結果。
`docs/DEVELOPMENT_GUIDE.md` 6章（セキュリティ・情報管理）を補完する位置づけ。

**前提**: 本プロジェクトは個人の副業運用（DEVELOPMENT_GUIDE.md 6章）であり、
組織向けの大掛かりな体制は意図的に採用していない。以下の判定も
「シンプルな構成を維持する」という設計原則（DESIGN.md 1章）を踏まえて行った。

凡例: ✅ 実施済み / 🟡 検討の余地あり（未実施・任意） / ⛔ 意図的に見送り

## 1. セキュリティ

| 項目 | 状態 | 補足 |
|---|---|---|
| 依存パッケージの脆弱性チェック（`npm audit`） | ✅ | CIで `npm audit --audit-level=high` を自動実行。監査時点（2026年9月）で0件 |
| 依存パッケージの自動更新（Dependabot） | ✅ | `.github/dependabot.yml`（npm・GitHub Actions双方、週次） |
| 秘密情報の管理（APIキー等） | ✅ | 現状は秘密情報を持たない。将来必要になった場合は `.env`（`.gitignore`済み）で管理する方針が既に明記されている（DEVELOPMENT_GUIDE.md 6章） |
| 顧客個人情報の外部送信防止 | ✅ | NFR-4として設計原則に明記済み。Webフォーム・リマインド機能とも127.0.0.1限定・mailtoのみ |
| 入力バリデーション（スキーマ検証） | ⛔ | Zod等のスキーマバリデータは未導入。設計原則上「エラーで止めるのではなくwarningで継続」方針（DESIGN.md 6章）を優先しており、意図的に厳密な入力検証を持たせていない。顧客対応はブラウザ経由でも最終的に行政書士本人が内容確認する前提のため、現状は妥当と判断 |
| 依存パッケージ数の最小化 | ✅ | 本番依存は `docx` 1件のみ |

## 2. テスト・CI

| 項目 | 状態 | 補足 |
|---|---|---|
| ユニットテスト | ✅ | `node --test`（Node.js標準機能）。56件全通過 |
| CI（push/PR時の自動テスト） | ✅ | `.github/workflows/test.yml`。Node.js 20.x/22.x の2バージョンで実行 |
| テストカバレッジ計測 | ✅ | `npm run test:coverage`（`--experimental-test-coverage`）。CIでは22.xのジョブでのみ表示（Node 20系に既知の不具合があるため）。現在ライン網羅率 約98% |
| カバレッジの閾値強制 | ⛔ | `--test-coverage-lines` 等で閾値未達を失敗にする設定は未導入。個人開発でカバレッジ数値そのものを目的化しないため、情報表示に留めている |
| ブランチ保護ルール（必須レビュー等） | 🟡 | GitHub側のリポジトリ設定（Settings > Branches）で有効化可能。単独開発のためレビュー必須は現実的でないが、「CIが通るまでマージ不可」の設定は検討の余地あり。コードからは変更できないため、必要なら発注者（あなた）がGitHub UIで設定すること |
| 型チェック（JSDoc + `tsconfig.json` の `checkJs`） | 🟡 | ARCHITECTURE.md で「プロジェクトが育ってきたら検討する」とされていた項目。M1〜M4が完了し規模が育ってきたため、次の一手として現実的な選択肢になった。ただし導入するとJSDocの不備が一括で顕在化し、既存コードの手直しが発生する可能性があるため、今回の監査では見送り、独立したタスクとして着手することを推奨 |

## 3. コード品質・スタイル

| 項目 | 状態 | 補足 |
|---|---|---|
| 改行コードの正規化 | ✅ | `.gitattributes`（`* text=auto eol=lf`）を追加。Windows環境で `git add` のたびにCRLF警告が出ていた問題を解消 |
| Node.jsバージョン固定（開発環境） | ✅ | `.nvmrc`（`20`）を追加。`nvm use` で `engines` の最小バージョンに揃えられる |
| Linter（ESLint等） | 🟡 | 未導入。`docx`以外に依存パッケージが無い現状の規模では費用対効果が薄いと判断し見送ったが、コーディング規約（DEVELOPMENT_GUIDE.md 2章）の逸脱を自動検知したい場合は `eslint` の導入を推奨（ビルドステップは増えない。あくまで静的チェック） |
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

## 5. 今回のセッションで実施した対応

- `.gitattributes` の追加（改行コード正規化）
- `.nvmrc` の追加
- `package.json` に `license` / `repository` フィールド、`test:coverage` スクリプトを追加
- CIワークフローに `npm run test:coverage`（22.xのみ）と `npm audit --audit-level=high` を追加
- `.github/dependabot.yml` の追加（npm・GitHub Actions、週次）
- `.github/pull_request_template.md` の追加
- `CHANGELOG.md` の新設

## 6. 次に検討する価値がある項目（優先度順の目安）

1. **型チェック（`checkJs`）の導入**: プロジェクトが一定規模に育った今が導入の好機。
   ただし既存コードの手直しが発生しうるため、独立したタスクとして着手すること
2. **ブランチ保護ルール**: GitHub Settings上で「CI成功をマージ条件にする」設定を
   有効化すると、テストが壊れた状態で誤って `master` にマージすることを防げる
3. **ESLint導入**: コーディング規約の自動チェックが欲しくなった場合に検討

## 参考情報（Web調査）

- [nodebestpractices（Node.js best practices list）](https://github.com/goldbergyoni/nodebestpractices)
- [Node.js Security Best Practices 2026 | Corgea](https://corgea.com/learn/nodejs-security-best-practices-2026)
- [Node.js Test Runner Documentation](https://nodejs.org/api/test.html)
- [GitHub Docs: Configuring Git to handle line endings](https://docs.github.com/en/get-started/git-basics/configuring-git-to-handle-line-endings)
- [.gitattributes Best Practices](https://rehansaeed.com/gitattributes-best-practices/)
