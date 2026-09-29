# 0017. Agent SDK による Issue 自律処理ループの導入

Status: Accepted
Date: 2026-09-29

## Context（背景）

リポジトリ運用（Issue対応・依存更新の追随・軽微な改修）をAI agentに任せ、
発注者の作業を「PRの最終レビューとマージ」に絞りたい。選択肢は
GitHub Actions上の `claude-code-action`、定期実行agent、自前のAgent SDKループ
などがあり、発注者の指示で自前ループ（Agent SDK）を実装する。

関連する制約:

- `docs/DESIGN.md` 1章「外部送信をしない」。これは**アプリの実行時**に
  個人情報・財務情報を外部へ送らないという前提。本ループは開発運用ツールであり、
  リポジトリのソースコードとIssue本文をAnthropic APIへ送信する。
  「明示的な要件がない限り」の例外に当たる（本ADRと発注者の明示指示が要件）。
  **実データ（`data/`）は送信対象に含めない**（後述の防御で担保する）。
- `docs/DESIGN.md` 1章「ビルドレス構成」。SDKは実行時依存であり、
  TypeScriptのコンパイルは不要。素のESM＋JSDocを維持できる。
- `main` はRuleset `protect-main` で保護済み（PR必須・CI必須）。
  エージェントは `main` へ直接pushできない。

## Decision（決定）

`agent/` に本体アプリと**依存関係を分離した**サブパッケージ（`agent/package.json`、
`@anthropic-ai/claude-agent-sdk` を固定バージョンで依存）として実装する。
本体の `package.json`・`npm audit`・型チェック対象・ミューテーション対象に
SDKを持ち込まない。

責務は2層に分ける。

1. **エージェント（LLM）**: 隔離した `git worktree` 内でのファイル編集とテスト実行のみ。
   `permissionMode: "dontAsk"` と `allowedTools` の許可リストで、列挙外は拒否。
   `git push`・`gh`・ネットワーク・保護パスの編集は `disallowedTools` で明示禁止。
   GitHub認証情報の環境変数は渡さない。
2. **オーケストレーター（決定的コード, `run.mjs`）**: Issue選別・worktree作成・
   検証（test/typecheck/lint）・保護パスの検査・commit・push・PR作成。
   **マージは行わない**。

安全側の判断は `agent/policy.js` の純粋関数に集約し、`test/agent-policy.test.js` で
単体テストする。

主な防御:

- **起票者の限定**: 所有者本人が起票し `agent-ready` ラベルを付けたIssueのみ処理する
  （公開リポジトリのIssue経由のプロンプトインジェクション対策）。
- **保護パス**: `.github/` `agent/` `hooks/` `data/` `package*.json` `CLAUDE.md` `.env*` を
  変更した場合はPRを作らず、Issueへ差し戻す。
- **歯止め**: 1件あたり40ターン・$3、1実行あたり既定1件。
- **PRは常に人手レビュー**: `agent-authored` ラベルとレビュー観点を本文に付す。

## Consequences（影響）

- メリット: Issueにラベルを付けるだけで、検証済みのPRが上がる。
  自前ループなので権限・上限・検査を細かく制御できる。
- デメリット: 自前コードの保守が発生する。APIキー（`ANTHROPIC_API_KEY`）と
  従量課金が必要。ソースコードが外部APIへ送信される。
- 既知の制約: `GITHUB_TOKEN` で作ったPRは他のworkflowを起動しないため、
  Actions上で動かす場合は必須チェックが走らない。当面は**ローカル実行**
  （所有者の `gh` 認証でpush）とする。Actionsで運用する場合はGitHub App等の
  トークンが別途必要。
- 見直しのトリガー: PRの品質が安定しない／費用が想定を超える場合は、
  `claude-code-action`（選択肢A）への移行を検討する。
