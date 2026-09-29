# agent/ — Issue 自律処理ループ

`agent-ready` ラベル付きのIssueを、Claude Agent SDKで実装し、検証に通ればPRを作成する。
**マージは行わない**（人手レビュー必須）。設計の根拠は
[`docs/adr/0017-agent-sdk-issue-loop.md`](../docs/adr/0017-agent-sdk-issue-loop.md)。

本体アプリとは依存関係を分離している（`agent/package.json`）。

## 準備（初回のみ）

Docker Desktop を起動しておく（既定でコンテナ隔離。ADR-0017 Amendment 2）。隔離なしで動かす場合のみ `AGENT_SANDBOX=none` を明示する。

```bash
cd agent && npm ci
```

**認証は既定でClaudeサブスクリプション（Pro/Max。追加課金なし）**。APIキーは不要。

- Docker隔離（既定）: `claude setup-token` を実行して表示されるトークンを、環境変数 `CLAUDE_CODE_OAUTH_TOKEN` に設定する（PowerShell: `[Environment]::SetEnvironmentVariable("CLAUDE_CODE_OAUTH_TOKEN", "<トークン>", "User")` のあとターミナルを再起動）。コンテナにはこのトークンだけを渡し、ホストのログイン情報は渡さない。
- 隔離なし（`AGENT_SANDBOX=none`）: この端末のClaude Codeログインをそのまま使うためトークン不要（隔離は無くなる）。
- 環境に `ANTHROPIC_API_KEY` があっても既定では**使わない**（従量課金の防止）。APIキーを使う場合だけ `AGENT_AUTH=api-key` を明示する。
- サブスクリプションの利用枠は対話利用と共有される。日次上限（5件）と1件あたりの上限は、この枠を使い切らないための歯止めでもある。

## 使い方

```bash
node run.mjs --dry-run      # 対象Issueと権限設定の確認（API呼び出しなし）
node run.mjs                # 対象Issueを1件処理
node run.mjs --issue 81     # 指定Issueのみ
node run.mjs --max 3        # 1実行で最大3件
```

## 処理対象になる条件

- **所有者本人（`satou-aaaaa`）が起票**したIssueである（第三者のIssueは無視。
  公開リポジトリでのプロンプトインジェクション対策）
- `agent-ready` ラベルが付いている
- `agent-working` / `agent-done` が付いていない

Issueに `agent-ready` を付けるのが「実行してよい」という人間の承認になる。

## 処理の流れ

1. `origin/main` から隔離した `git worktree` を作り、`npm ci`
2. エージェントが実装（許可ツール: ファイル編集・テスト実行のみ。40ターン/$3まで）
3. 保護パス（`.github/` `agent/` `hooks/` `data/` `package*.json` `CLAUDE.md` `.env*`）に
   変更があれば中止しIssueへ差し戻す
4. `npm test` / `typecheck` / `lint` が通らなければ中止しIssueへ差し戻す
5. commit → push → PR作成（`agent-authored` ラベル）→ Issueを `agent-done` に

中止時はIssueにコメントが付き、`agent-ready` に戻る。

## 注意

- ソースコードとIssue本文がAnthropic APIへ送信される。Issueに実データを書かない。
- ローカル実行が前提。`GITHUB_TOKEN` で作ったPRは必須CIを起動しないため、
  Actionsで動かす場合は別途GitHub App等のトークンが必要（ADR-0017）。
- 安全側の判断は `policy.js` に集約し `test/agent-policy.test.js` で検証している。
  権限を緩める変更は必ずテストとADRを更新すること。

## 安全機構（多層防御）

| 層 | 内容 |
|---|---|
| 許可リスト/拒否リスト | `dontAsk` で列挙外を拒否。push・`gh`・ネットワーク・保護パス編集を明示禁止 |
| PreToolUseフック | 全ツール呼び出しを `decideToolUse` で再判定（作業ディレクトリ外・`.env`・鍵・危険コマンドを拒否）。**全呼び出しを `agent/logs/*.jsonl` に監査記録** |
| 保護パス検査 | 変更に保護対象が含まれれば中止 |
| 検証ゲート | `npm test` / `typecheck` / `lint` / `check-secrets`。失敗時は1回だけ自己修正させ、再失敗で差し戻し |
| 上限 | 1件あたり40ターン・$3・20分。日次で5件・$10（`agent/.state/daily.json`） |
| コンテナ隔離 | 既定で `npm ci`・エージェント・検証をDockerコンテナ内で実行（作業ツリーのみマウント・`--cap-drop ALL`・読み取り専用FS・非root・認証情報なし）。Docker不可なら実行しない |
| キルスイッチ | `agent/.disabled` ファイルを作る、または `AGENT_DISABLED=1` で即停止 |

### 緊急停止・確認

```bash
touch agent/.disabled      # 停止（rm agent/.disabled で再開）
ls agent/logs              # 監査ログ（1行1JSON: ツール名・入力・判定・結果）
```

### 既知の制約

コンテナのネットワークegressは無制限（API・npmレジストリ到達のため）。API宛のみ許可するプロキシへの移行が次の一手（ADR-0017 Amendment 2）。
