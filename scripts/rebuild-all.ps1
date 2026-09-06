<#
.SYNOPSIS
  전체 콘텐츠를 Purge하고 등록된 모든 키워드로 프리미엄 칼럼을 재생성합니다.

.DESCRIPTION
  /api/admin/purge-and-rebuild 는 한 번의 호출에서 일정 개수만 처리하고
  다음 시작 위치를 nextOffset 으로 돌려줍니다. 이 스크립트는 done 이 될 때까지
  그 값을 따라가며 반복 호출합니다. Purge 는 첫 호출(offset 0)에서만 수행됩니다.

.EXAMPLE
  ./scripts/rebuild-all.ps1
  ./scripts/rebuild-all.ps1 -BaseUrl "https://kindexlab.com" -CronSecret $env:CRON_SECRET
  ./scripts/rebuild-all.ps1 -Channel economy      # 특정 채널만
  ./scripts/rebuild-all.ps1 -Resume 200           # 중단된 지점부터 (Purge 없음)
#>
param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$CronSecret = "",
  [ValidateSet("", "economy", "entertainment", "politics", "culture")]
  [string]$Channel = "",
  [int]$Limit = 25,
  [int]$Batch = 5,
  [int]$DelayMs = 2000,
  [int]$Resume = -1
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$headers = @{}
if ($CronSecret) { $headers["Authorization"] = "Bearer $CronSecret" }

# Resume 이 지정되면 그 지점부터 이어받고 기존 데이터는 건드리지 않습니다.
$offset = if ($Resume -ge 0) { $Resume } else { 0 }
$purgeFirst = $Resume -lt 0

$startedAt = Get-Date
$totalGenerated = 0
$totalFailed = 0
$reasons = @{}

Write-Host "전체 재생성 시작 · $BaseUrl" -ForegroundColor Cyan
if ($purgeFirst) { Write-Host "첫 호출에서 기존 DB를 Purge합니다." -ForegroundColor Yellow }

while ($true) {
  $query = "limit=$Limit&offset=$offset&batch=$Batch&delay=$DelayMs"
  if ($Channel) { $query += "&channel=$Channel" }
  if (-not ($purgeFirst -and $offset -eq 0)) { $query += "&purge=0" }

  $url = "$BaseUrl/api/admin/purge-and-rebuild?$query"
  $callStarted = Get-Date

  # 한 구간이 실패해도 전체 실행을 버리지 않습니다. 재시도가 모두 소진된
  # 뒤에야 중단하고, 그때는 이어받을 offset을 알려 줍니다.
  $res = $null
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      $res = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -TimeoutSec 900
      break
    } catch {
      Write-Host "요청 실패 (offset=$offset, 시도 $attempt/3): $($_.Exception.Message)" -ForegroundColor DarkYellow
      if ($attempt -lt 3) { Start-Sleep -Seconds (10 * $attempt) }
    }
  }

  if ($null -eq $res) {
    Write-Host "3회 재시도 후에도 실패했습니다 (offset=$offset)." -ForegroundColor Red
    Write-Host "이어받기: ./scripts/rebuild-all.ps1 -Resume $offset" -ForegroundColor Yellow
    exit 1
  }

  $elapsed = [math]::Round(((Get-Date) - $callStarted).TotalSeconds)
  $totalGenerated += $res.generated
  $totalFailed += $res.failed
  foreach ($item in $res.items) {
    if (-not $item.ok) {
      $prior = if ($reasons.ContainsKey($item.reason)) { $reasons[$item.reason] } else { 0 }
      $reasons[$item.reason] = $prior + 1
    }
  }

  $done = [int]$offset + [int]$res.processed
  Write-Host ("[{0,4}/{1}] 생성 {2} · 실패 {3} · {4}초" -f $done, $res.registered, $res.generated, $res.failed, $elapsed)

  if ($res.done -or -not $res.nextOffset) { break }
  $offset = $res.nextOffset
}

$mins = [math]::Round(((Get-Date) - $startedAt).TotalMinutes, 1)
Write-Host ""
# 한글이 변수명에 쓰일 수 있어 ${} 로 경계를 명시합니다.
Write-Host "완료 · 생성 ${totalGenerated}건 · 건너뜀 ${totalFailed}건 · ${mins}분" -ForegroundColor Green
if ($reasons.Count) {
  Write-Host "건너뛴 사유:" -ForegroundColor DarkGray
  foreach ($key in ($reasons.Keys | Sort-Object)) { Write-Host "  $key : $($reasons[$key])" -ForegroundColor DarkGray }
}
