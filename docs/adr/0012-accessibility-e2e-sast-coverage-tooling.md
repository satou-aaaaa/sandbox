# 0012. アクセシビリティテスト・E2Eテスト・静的セキュリティ解析・カバレッジ可視化の導入

Status: Accepted
Date: 2026-09-16

## Context（背景）

ADR-0011（ミューテーションテスト・Property-based testing）に続き、発注者から
「他のタイプのテストがこの世にないのか調査し、あれば導入してほしい」
「テストカバレッジのレポートをすぐに見れる状態にしてほしい」という依頼を
受けた。ソフトウェアテストの一般的な分類（機能テスト・非機能テスト・
静的解析等）を調査した結果、本プロジェクトに実際に価値があると判断した
以下4件を導入した。負荷テスト・カオスエンジニアリング・A/Bテスト・
契約テスト等は、単一利用者のローカル実行ツールという性質上、価値が
薄いため対象外とした。

## Decision（決定）

### 1. アクセシビリティテスト（axe-core + jsdom）

`src/web/*Page.js`が生成するHTMLは発注者本人が実際にブラウザで操作する
画面であり、その画面自体の使いやすさを検証する仕組みが無かった。
[axe-core](https://github.com/dequelabs/axe-core)を`test/accessibility.test.js`に
導入し、既存の`test/formPageClient.test.js`と同じくjsdom上で動かす
（実ブラウザ不要で軽量）。`color-contrast`ルールはjsdomの既知の制約
（レンダリングエンジンを持たない）により無効化した。

導入時の初回実行で3件の実際の不具合（役員追加行のラベル欠落
[重要度critical]・4画面の`<main>`ランドマーク欠落[moderate]・
下書き一覧の操作列見出し欠落[minor]）を発見し、修正した。

### 2. E2Eテスト（Playwright。当初方針からの転換）

`docs/DESIGN.md` 7章は当初「本ツールには外部サービス連携やUI操作を伴う
画面遷移が無いためE2Eは導入しない」としていた。今回「他のテスト手法」の
調査で当然candidateとして挙がり、この既存方針を覆すか発注者に確認を
求めたところ、「導入する」との回答を得たため方針を転換した。

- [Playwright](https://playwright.dev/)を導入し、Chromiumのみを対象とする
  （複数ブラウザ差異の検証価値よりCI時間・ディスク使用量を優先）
- 配置は`e2e/`（プロジェクト直下の専用ディレクトリ）とし、`test/`配下には
  置かない。`node --test`は`test/`という名前のディレクトリ配下の`.js`
  ファイルを命名規則に関わらず自動検出するため、同じ場所に置くと
  `npm test`実行時に誤って拾われ実行エラーになることを確認したため
  （node:testとPlaywrightのAPI・実行モデルは非互換）
- スコープは「実際にブラウザで入力→送信→表示確認という一連の操作が
  壊れていないか」の疎通確認に限定し、個々の判定ロジックの正しさ
  （法定要件の分岐網羅等）は既存の単体テスト・ミューテーションテストに
  委ねる（E2Eは実行が遅く、失敗時の原因切り分けもしづらいため、
  疎通確認に留めるのが定石という一般的なテストピラミッドの考え方に沿う）
- `src/web/server.js`に環境変数（`OUT_DIR`/`CLIENTS_PATH`/`DRAFTS_PATH`）に
  よる起動時のパス上書きを追加し、E2Eテストが`.e2e-tmp/`配下の一時
  ファイルを使うようにした。`npm run web`（本番相当）の既定動作は変えていない
- CIでは他の「OS非依存」チェック（`npm audit`等）と同じくubuntu-latest・
  Node 22.xの1系統のみで実行する（ブラウザインストールを伴い実行時間が
  長くなるため、既に複数OSでのテストが行われているアプリ側にOS依存の
  分岐が無いことを踏まえ、全マトリクスセルでの重複実行は避けた）

### 3. 静的セキュリティ解析（eslint-plugin-security）

`npm run lint`（ESLint）に[eslint-plugin-security](https://github.com/eslint-community/eslint-plugin-security)の
推奨ルールセットを追加した。導入前に検出精度のベンチマーク記事
（DEV Community「I Benchmarked 17 ESLint Security Plugins」）を調査したところ、
`eslint-plugin-security`の検出率は27.5%程度と報告されており、より高い
検出率（100%）を謳う"Interlace Ecosystem"という10個のプラグイン群も
紹介されていた。しかし後者は聞き覚えのない小規模なパッケージ群であり、
出所・保守体制を確認できなかったため、サプライチェーンリスクの観点から
導入を見送った。`eslint-plugin-security`は`eslint-community`組織
（多数の主要ESLintプラグインを保守する信頼できる組織）が保守しており、
検出精度は完璧ではないものの、追加コストがほぼゼロ（既存の`npm run lint`に
ルールが増えるだけ）であることを踏まえ、実績のある方を選んだ。

導入直後、`detect-non-literal-fs-filename`ルールが本アプリのファイルI/O設計
（テスト容易性のため出力先パスを常に引数で受け取る）と相性が悪く、
15件以上が誤検知だったため無効化した。ただし、このルールが正しく検出した
唯一の重要な箇所（`src/web/server.js`のダウンロード配信。URLに由来する
パスを扱う）は、既にパストラバーサル対策を実装・テスト済み
（`test/web.test.js`「/download はディレクトリトラバーサルを拒否する」）
であることを導入時に確認した。`detect-object-injection`・
`detect-non-literal-regexp`は誤検知の頻度が許容範囲内のため有効のまま残した。

### 4. テストカバレッジのHTML可視化（c8）

`npm run test:coverage`はターミナルへのテキスト出力のみで、ファイル単位の
未カバー行をブラウザで一覧・ドリルダウンする手段が無かった。
[c8](https://github.com/bcoe/c8)を追加し、`npm run test:coverage:html`で
istanbul形式のHTMLレポート（`coverage/index.html`）を生成できるようにした。
`.gitignore`で除外し、生成物をリポジトリにコミットしないようにしている。

## Consequences（影響）

- **メリット**: 4つの異なる観点（画面の使いやすさ・実ブラウザでの動作・
  コードの安全性・カバレッジの可視性）でテスト・検査の抜けを埋められた。
  特にアクセシビリティテストは導入初回から実際の不具合を発見しており、
  費用対効果が高いことを確認できた
- **デメリット**:
  - Playwrightはブラウザバイナリ（Chromiumのみでも100MB超）という
    重量級の依存を追加する。`npm install`後に別途
    `npx playwright install chromium`が必要であり、既存の
    「ビルドレス・依存最小」という方針（ADR-0001）からは一部逸脱する
  - `eslint-plugin-security`の検出精度はベンチマーク上高くなく、
    「導入した」こと自体が過信につながらないよう注意が必要
    （SASTの限界を認識した上での「無いよりはまし」という位置づけ）
  - E2E・アクセシビリティ・SAST・カバレッジHTMLレポートと、テスト関連の
    ツール・設定ファイルが増え続けており（`stryker.config.mjs`・
    `playwright.config.js`・`eslint.config.js`等）、副業運用の中での
    保守負荷が今後の懸念点になりうる
- **見直しのトリガー**: E2Eテストの実行が不安定（flaky）になった場合、
  対象範囲をさらに絞るか、`reuseExistingServer`等の設定を見直す。
  `eslint-plugin-security`より検出精度の高い、出所の確かなツールが
  今後登場した場合は乗り換えを検討する。
