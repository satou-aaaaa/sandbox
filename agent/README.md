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

- Docker隔離（既定）: **`powershell -ExecutionPolicy Bypass -File agent\setup-auth.ps1`** が手順を補助する。先に別のターミナルで `claude setup-token` を実行してブラウザで承認し、表示されたトークンをコピー→スクリプトに非表示で貼り付けると、形式を検証してユーザー環境変数 `CLAUDE_CODE_OAUTH_TOKEN` に保存し、認証確認まで行う（APIキーは拒否する）。手動で行う場合は、表示されたトークンを、環境変数 `CLAUDE_CODE_OAUTH_TOKEN` に設定する（PowerShell: `[Environment]::SetEnvironmentVariable("CLAUDE_CODE_OAUTH_TOKEN", "<トークン>", "User")` のあとターミナルを再起動）。コンテナにはこのトークンだけを渡し、ホストのログイン情報は渡さない。
- 隔離なし（`AGENT_SANDBOX=none`）: この端末のClaude Codeログインをそのまま使うためトークン不要（隔離は無くなる）。
- 環境に `ANTHROPIC_API_KEY` があっても既定では**使わない**（従量課金の防止）。APIキーを使う場合だけ `AGENT_AUTH=api-key` を明示する。
- サブスクリプションの利用枠は対話利用と共有される。日次上限（5件）と1件あたりの上限は、この枠を使い切らないための歯止めでもある。

## 1サイクルの実行（定期実行のエントリポイント）

```bash
node cycle.mjs --dry-run   # 判定・対象の確認のみ（書き込みなし）
node cycle.mjs             # 回復 → スカウト → トリアージ → 実装/PR作成 → 要約 を1回
```

- **排他制御**: 実行が重なった場合、後発は何もせずスキップ（`agent/.state/cycle.lock`。残骸は自動で奪取）
- **異常終了からの回復**: `agent-working` のまま90分以上放置されたIssueを `agent-needs-human` に戻し、古い一時worktreeを片付ける
- **要約**: 結果を1行にまとめ、`agent/logs/cycle-latest.txt` に保存（1サイクルの全出力は `agent/logs/cycle-*.log`）

## 作業の自動起票（スカウト）

```bash
node scout.mjs --dry-run   # 提案を表示するのみ（起票しない）
node scout.mjs             # 起票する（1回最大2件。未完了のスカウトIssueが5件以上なら起票しない）
```

読み取り専用のエージェントが、テストの追加やREADME/CHANGELOGの食い違い修正といった**自動マージできる低リスクな作業**だけを、
`agent-scouted` ラベル付きで起票する。起票されたIssueはトリアージ→実装→PR→自動マージへ進む（`cycle.mjs` が順に実行する）。
法令判定・期限計算・src/の実装変更・保護パスに関わる提案は対象外。

## Issue の自動トリアージ（`agent-ready` を自動で付けるか判断する）

```bash
node triage.mjs --dry-run   # 判定結果を表示するのみ（ラベル・コメントは変更しない）
node triage.mjs             # 判定してラベルとコメントを付ける（既定で最大5件）
node cycle.mjs             # 判定 → 実装 → PR作成までを1回で（排他制御・回復つき）
```

- 対象: **所有者本人が起票**した未判定のIssue（第三者のIssueは一切対象にしない）
- 判定は読み取り専用のエージェントが行い、`agent-ready`（実行してよい）か `agent-needs-human`（人手が必要）を付ける。理由はIssueのコメントに残る
- ready にするのは「低リスク・法令判定/期限計算ロジックに触れない・人間の判断が不要・変更5ファイル以下」のみ。判定を解釈できない場合は必ず人手側に倒す
- 上書き: `agent-skip` を付けると永久に対象外。`agent-triaged` を外すと再判定される

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

### PRの自動マージ（原則は人が介入しない）

`agent-pr-automerge` workflowが、エージェントのPRをリスクで振り分ける（ADR-0017 Amendment 10）。

- **自動マージ（既定）**: README/CHANGELOG、docs直下の文書（設計文書・ADRを除く）、テスト（追加≧削除）、法令ロジックを含まないコード（src/web・src/core/documents・src/portal・scripts・e2e・load）。12ファイル以下。必須チェック成功後にマージされる
- **承認が必要**: 法令判定・期限計算・様式生成の領域、設定・スキーマ・設計文書・ADR。理由がPRにコメントされ `agent-needs-review` が付く。`agent-approved` ラベル（所有者、またはAIレビュアー）で自動マージ。リポジトリ変数 `AGENT_AUTOMERGE_LEGAL=true` にすると法令領域も自動マージ
- **常に人手**: 保護パス（.github・agent・hooks・data・package*.json・CLAUDE.md・.env*）

### Issueのクローズ

- PRがマージされると、PR本文の `Closes #N` によりGitHubがIssueを**自動でクローズ**する。
- PRがマージされずに閉じられた場合は、`agent-issue-sync` workflowがIssueを `agent-needs-human` に戻し、理由をコメントする（`agent-done` のまま放置しない）。

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
