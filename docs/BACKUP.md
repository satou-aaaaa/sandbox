# バックアップと復元

## 取得（自動）

`.github/workflows/backup.yml` が、週1回（日曜 18:17 UTC）と手動実行（Actions → Backup → Run workflow）で、
リポジトリの全履歴（全ブランチ・タグ）を `git bundle` にして、アーティファクト `repo-bundle` に90日間保存する。
作成後に `git bundle verify` で整合性を確認している。

- 含まれる: コミット履歴・ブランチ・タグ（ワークフロー・エージェントのコード・ADRを含む）
- 含まれない: Issue・PRのコメント・ラベル・Actionsのシークレット/変数・ブランチ保護（Ruleset）の設定
  - Issueは `gh issue list --state all --limit 1000 --json number,title,body,labels,comments > issues.json` で書き出せる
  - `data/`（クライアントの実データ）は元々コミット対象外（NFR-5）のため、このバックアップには入らない。ローカルで別途保管すること

## 復元の手順

1. Actions → Backup → 最新の実行から `repo-bundle` をダウンロードして展開する。
2. 検証して、復元する。

   ```bash
   git bundle verify repo.bundle
   git clone repo.bundle restored-repo
   cd restored-repo
   git remote set-url origin <新しいリポジトリのURL>
   git push --all origin && git push --tags origin
   ```

3. 新しいリポジトリで、シークレット・変数・Ruleset・ラベル（`agent-*`）を設定し直す（`docs/adr/0017-agent-sdk-issue-loop.md` と `agent/README.md` 参照）。

## 確認の記録

- 2026-09-30: 手順1〜2の `git bundle create` / `verify` / `git clone repo.bundle` を、ローカルで実行して確認した（下記のとおり）。
