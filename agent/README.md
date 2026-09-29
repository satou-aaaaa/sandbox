# agent/ — Issue 自律処理ループ

`agent-ready` ラベル付きのIssueを、Claude Agent SDKで実装し、検証に通ればPRを作成する。
**マージは行わない**（人手レビュー必須）。設計の根拠は
[`docs/adr/0017-agent-sdk-issue-loop.md`](../docs/adr/0017-agent-sdk-issue-loop.md)。

本体アプリとは依存関係を分離している（`agent/package.json`）。

## 準備（初回のみ）

```bash
cd agent && npm ci
```

環境変数 `ANTHROPIC_API_KEY` を設定する（キーはリポジトリ・チャットに書かない）。
`gh auth status` でログイン済みであること（push・PR作成に使う）。

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
