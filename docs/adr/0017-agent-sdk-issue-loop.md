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

## Amendment 1（2026-09-29）: ベストプラクティスに基づく多層防御の追加

Anthropicの公式ガイド（Securely deploying AI agents／Hooks／Building effective agents）を
調査し、次を追加した。いずれも「PR作成まで・マージは人手」の前提は変えない。

| 原則（出典） | 実装 |
|---|---|
| 多層防御：許可リストとは独立した最終判定（Hooks） | `PreToolUse` フックで全ツール呼び出しを `decideToolUse` で判定。フックのdenyはbypassモードでも効く。作業ディレクトリ外・保護パス・`.env`/鍵・ネットワーク/push/依存追加/コマンド置換を拒否 |
| 監査可能性（Hooks: log and audit） | 全ツール呼び出しと結果を `agent/logs/*.jsonl` に記録（`.gitignore`済み） |
| 停止条件・暴走防止（Building effective agents） | 1件あたりターン/費用に加え、壁時計20分、日次上限（5件・$10。`agent/.state/`）を追加 |
| 人手のチェックポイント | 常時PR止まり。加えてキルスイッチ（`agent/.disabled` または `AGENT_DISABLED=1`） |
| 評価→最適化（Building effective agents） | 検証失敗時は失敗出力を渡して**1回だけ**修正を依頼。再失敗ならIssueへ差し戻し |
| シークレット混入対策 | 検証ゲートに `npm run check-secrets` を追加 |
| 最小権限・クレデンシャル分離（Secure deployment） | GitHub認証情報の環境変数をエージェントに渡さない（既存）。push/PRは決定的コードのみ |
| モデル固定 | `claude-sonnet-5-5` を明示（`AGENT_MODEL` で上書き可） |

### 未対応（既知の残リスクと次の一手）

- **OS/コンテナ隔離**: → Amendment 2 で対応。
- **Actions上での実行**: `GITHUB_TOKEN` 起点のPRは必須CIを起動しない。GitHub App導入後に検討。

## Amendment 2（2026-09-29）: Dockerコンテナ隔離の導入

推奨されるsandbox-runtimeがWindows非対応のため、公式ガイドの「Containers」構成を採用した。

- **ホスト（`run.mjs`）**: Issue選別・worktree作成・commit・push・PR作成。GitHub認証情報を持つのはここだけ。
- **コンテナ（`worker.mjs`, `agent/Dockerfile`）**: `npm ci`・エージェント実行・検証（test/typecheck/lint）。
  マウントは作業ツリー・ログ・依頼文（読み取り専用）のみ。`--cap-drop ALL` `--read-only`
  `no-new-privileges` 非root 資源制限。GitHub認証情報・ホストのHOME/SSH鍵は渡さない。
  APIキーは `agent` フェーズにのみ環境変数で渡す。
- **check-secrets** はgitを使うためホスト側で実行する（フックは保護パスでエージェントは変更不可）。
- **フェイルクローズ**: 既定は `AGENT_SANDBOX=docker`。Dockerに接続できなければ実行しない。
  隔離なしは `AGENT_SANDBOX=none` の明示が必要。
- `docker run` の引数は `policy.js` の `buildDockerArgs`（純粋関数）で組み立て、安全設定の欠落をテストで検出する。

残リスク: コンテナはネットワークegress無制限（API・npmレジストリ到達に必要）。
エージェントのBashはネットワーク系コマンドを拒否しているが、OSレベルでの宛先制限は無い。
次の一手は、API宛のみ許可するプロキシ経由（`--network none`＋Unixソケット、クレデンシャルはコンテナ外で注入）。

## Amendment 3（2026-09-29）: 認証は既定でClaudeサブスクリプション（APIキー不使用）

発注者の方針（追加の従量課金を避ける）により、認証方式を次のとおりとした。

- **既定は `AGENT_AUTH=subscription`**。Claude Code / Agent SDK は claude.ai のPro/Maxログインで認証でき、
  無人実行向けには `claude setup-token` で発行する `CLAUDE_CODE_OAUTH_TOKEN`（1年有効・モデル呼び出し専用）を使う。
  この端末で、APIキー無し・サブスクリプションのログインのみでSDKが動作することを実機で確認した。
- **Docker隔離時はトークンのみをコンテナへ渡す**。ホストの `~/.claude/.credentials.json`（リフレッシュトークンを含む）は
  マウントしない。トークンはモデル呼び出し専用で、GitHub操作やRemote Controlには使えない。
- **APIキーは既定で除外**する。環境に `ANTHROPIC_API_KEY` があっても渡さない（認証の優先順位でAPIキーが
  サブスクリプションより優先され、意図せず従量課金になるのを防ぐ）。使う場合は `AGENT_AUTH=api-key` を明示する。
- 費用の上限（`maxBudgetUsd`・日次$10）はサブスクリプションでは請求額ではなく推定値として働き、
  利用枠を使い切らないための歯止めとなる。利用枠は対話利用と共有されるため、日次件数（5件）も維持する。

見直しのトリガー: 利用枠の枯渇で対話利用に支障が出る場合は、件数上限を下げる、または実行時間帯を分ける。
