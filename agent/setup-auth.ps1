<#
.SYNOPSIS
  エージェント用の認証トークン（CLAUDE_CODE_OAUTH_TOKEN）を、安全にユーザー環境変数へ保存する。

.DESCRIPTION
  事前に別のターミナルで `claude setup-token` を実行し、ブラウザで承認して表示されたトークンをコピーしておく。
  このスクリプトはそのトークンを「非表示入力」で受け取り、形式を確認して、ユーザー環境変数
  CLAUDE_CODE_OAUTH_TOKEN に保存する。トークンは画面・ログ・チャットに出さない。
  保存後、実際に認証が通るかを最小のクエリで確認する（-SkipVerify で省略可）。

  APIキー（従量課金）ではなく、Claudeサブスクリプション用のトークンを使う（ADR-0017 Amendment 3）。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File agent\setup-auth.ps1
#>
param(
  [switch]$SkipVerify
)

$ErrorActionPreference = "Stop"

Write-Host "先に別のターミナルで 'claude setup-token' を実行し、表示されたトークンをコピーしてください。"
$secure = Read-Host "トークンを貼り付けてEnter（入力は表示されません）" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
$token = $token.Trim()

# 貼り付け時の混入（前後の引用符・改行・空白）を除去して形式を検証する
$token = $token.Trim('"', "'")
if ($token -like 'sk-ant-api*') {
  Write-Host "これはAPIキー（従量課金）です。保存しませんでした。'claude setup-token' で発行したサブスクリプション用トークンを使ってください。" -ForegroundColor Red
  exit 1
}
if ($token -notmatch '^sk-ant-[A-Za-z0-9_\-]{20,}$') {
  Write-Host "トークンの形式が想定と異なります（'sk-ant-' で始まる1行の文字列）。保存しませんでした。" -ForegroundColor Red
  Write-Host "  - 途中で改行や空白が入っていないか確認してください。" -ForegroundColor Red
  Write-Host "  - APIキー（従量課金）ではなく、'claude setup-token' で発行したトークンを使ってください。" -ForegroundColor Red
  exit 1
}

[Environment]::SetEnvironmentVariable("CLAUDE_CODE_OAUTH_TOKEN", $token, "User")
[Environment]::SetEnvironmentVariable("AGENT_TOKEN_ISSUED_AT", (Get-Date -Format "yyyy-MM-dd"), "User")  # 期限（1年）の警告用。運用レポートが参照する
Write-Host "保存しました（ユーザー環境変数 CLAUDE_CODE_OAUTH_TOKEN。長さ $($token.Length) 文字）。" -ForegroundColor Green
Write-Host "ターミナルとClaudeアプリを再起動すると、新しいプロセスに反映されます。"

if (-not $SkipVerify) {
  Write-Host "認証を確認しています（最小のクエリを1回だけ実行）..."
  $previous = $env:CLAUDE_CODE_OAUTH_TOKEN
  $previousKey = $env:ANTHROPIC_API_KEY
  try {
    $env:CLAUDE_CODE_OAUTH_TOKEN = $token
    # APIキーが環境にあると優先されて従量課金になるため、確認中は除外する
    Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
    $out = & claude -p "OKとだけ返信してください。" --max-turns 1 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -and $out -match 'OK') {
      Write-Host "認証OK: サブスクリプションのトークンで応答を確認しました。" -ForegroundColor Green
    } else {
      Write-Host "認証の確認に失敗しました。トークンが正しいか、'claude setup-token' をやり直してください。" -ForegroundColor Yellow
      exit 2
    }
  } finally {
    $env:CLAUDE_CODE_OAUTH_TOKEN = $previous
    if ($previousKey) { $env:ANTHROPIC_API_KEY = $previousKey }
    $token = $null
  }
}
