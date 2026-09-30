#!/usr/bin/env bash
# 定期workflowの結果を、ラベルで識別する常設Issueへ集約する（無ければ作り、あればコメントを追加する）。
# 使い方: scripts/gh-upsert-issue.sh <ラベル> <タイトル> <本文ファイル>
# 前提: gh が使え、GH_TOKEN（Issues: write）と GITHUB_REPOSITORY が設定されている（GitHub Actions上を想定）。
set -euo pipefail

label="${1:?ラベルを指定してください}"
title="${2:?タイトルを指定してください}"
body_file="${3:?本文ファイルを指定してください}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY が未設定です}"

gh label create "$label" --repo "$repo" --color "fbca04" --description "定期workflowの結果を集約する常設Issue" 2>/dev/null || true

number="$(gh issue list --repo "$repo" --state open --label "$label" --json number --jq '.[0].number // empty')"
if [ -z "$number" ]; then
  gh issue create --repo "$repo" --title "$title" --label "$label" --body-file "$body_file"
else
  gh issue comment "$number" --repo "$repo" --body-file "$body_file"
fi
