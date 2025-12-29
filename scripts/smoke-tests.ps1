# scripts/smoke-tests.ps1
# Smoke tests for ambiguity-pass CLI (calls OpenAI; requires OPENAI_API_KEY).
#
# Usage:
#   .\scripts\smoke-tests.ps1
#   .\scripts\smoke-tests.ps1 -Quick
#   .\scripts\smoke-tests.ps1 -Model gpt-4o-mini

param(
  [switch]$Quick,
  [string]$Model = "gpt-4o-mini"
)

$ErrorActionPreference = "Stop"

function Load-DotEnv {
  param([string]$Path = ".env")

  if (-not (Test-Path $Path)) { return }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0) { return }
    if ($line.StartsWith("#")) { return }

    $m = [regex]::Match($line, '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$')
    if (-not $m.Success) { return }

    $key = $m.Groups[1].Value
    $val = $m.Groups[2].Value

    # Strip surrounding quotes if present
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }

    Set-Item -Path ("Env:" + $key) -Value $val
  }
}

# If the key isn't set in the environment, try to load it from .env
if (-not $env:OPENAI_API_KEY -or $env:OPENAI_API_KEY.Trim().Length -eq 0) {
  Load-DotEnv ".env"
}

# Still missing? Then error
if (-not $env:OPENAI_API_KEY -or $env:OPENAI_API_KEY.Trim().Length -eq 0) {
  Write-Host "ERROR: OPENAI_API_KEY is not set in env or .env. Smoke tests require live API calls." -ForegroundColor Red
  exit 1
}

# Output dirs
$root = (Get-Location).Path
$outDir = Join-Path $root "outputs\smoke"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# Timestamped run folder
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $outDir $stamp
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

function Invoke-Case {
  param(
    [string]$Name,
    [string[]]$CliArgs,
    [string]$OutFile,
    [string]$StdinText = $null
  )

  $fullOut = Join-Path $runDir $OutFile

  try {
    if ($null -ne $StdinText) {
      $StdinText | & npx tsx src/index.ts @CliArgs --model $Model --out $fullOut --quiet
    } else {
      & npx tsx src/index.ts @CliArgs --model $Model --out $fullOut --quiet
    }

    if ($LASTEXITCODE -ne 0) {
      return @{ name = $Name; ok = $false; code = $LASTEXITCODE; out = $fullOut }
    }

    return @{ name = $Name; ok = $true; code = 0; out = $fullOut }
  }
  catch {
    return @{ name = $Name; ok = $false; code = 1; out = $fullOut; err = $_.Exception.Message }
  }
}

$cases = @()

# 1) Slogan / argument
$cases += @{
  name = "slogan_semantic_normative"
  out  = "01_slogan.txt"
  args = @(
    "We should prioritize safety over speed.",
    "--context", "Team deciding on launch criteria for a minor feature",
    "--stakes", "medium",
    "--reversibility", "high",
    "--detectability", "moderate",
    "--time-pressure", "low",
    "--alt", "Ask stakeholders to define 'safety' and 'speed' with examples"
  )
}

# 2) KPI / proxy metric
$cases += @{
  name = "kpi_mapping"
  out  = "02_kpi.txt"
  args = @(
    "KPI: Daily Active Users (DAU) increased 12% week-over-week.",
    "--context", "Leadership wants to use this as proof the redesign worked",
    "--use", "justification",
    "--stakes", "medium",
    "--reversibility", "medium",
    "--detectability", "moderate",
    "--time-pressure", "medium",
    "--alt", "Retention by cohort",
    "--alt", "Task success rate",
    "--alt", "Support tickets volume"
  )
}


# 3) Exploratory analysis reused for decision (scope creep)
$cases += @{
  name = "exploratory_to_decision_scope_creep"
  out  = "03_scope_creep.txt"
  args = @(
    "Exploratory regression (rough): price sensitivity seems higher in segment B; p-values not corrected.",
    "--context", "Finance wants to set final pricing based on this",
    "--stakes", "high",
    "--reversibility", "low",
    "--detectability", "hard",
    "--time-pressure", "high",
    "--alt", "Run proper experiment",
    "--alt", "Backtest on holdout set"
  )
}

# 4) High-stakes but directly verifiable
$cases += @{
  name = "high_stakes_verifiable"
  out  = "04_verifiable_high_stakes.txt"
  args = @(
    "Valve reading: 38 PSI (sensor S-17). Spec range: 35-40 PSI.",
    "--context", "Operator deciding whether system is within safe operating range right now",
    "--stakes", "high",
    "--reversibility", "high",
    "--detectability", "easy",
    "--time-pressure", "high",
    "--alt", "Verify with second gauge",
    "--alt", "Check last calibration timestamp"
  )
}

# 5) stdin path
$cases += @{
  name  = "stdin_input"
  out   = "05_stdin.txt"
  args  = @(
    "--context", "Deciding whether to roll out globally today",
    "--stakes", "high",
    "--reversibility", "medium",
    "--detectability", "moderate",
    "--time-pressure", "high",
    "--alt", "Canary rollout metrics",
    "--alt", "Synthetic checks"
  )
  stdin = "Postmortem TL;DR: latency spike caused timeouts; fix is to increase cache TTL."
}

if (-not $Quick) {
  # 6) file input
  $tmpFile = Join-Path $runDir "tmp-rep.txt"
  @"
Dashboard shows "Customer Satisfaction: 4.8/5".
No methodology listed.
"@ | Set-Content -Encoding UTF8 $tmpFile

  $cases += @{
    name = "file_input"
    out  = "06_file.txt"
    args = @(
      "--file", $tmpFile,
      "--context", "Using this to justify cutting support headcount",
      "--stakes", "high",
      "--reversibility", "low",
      "--detectability", "hard",
      "--time-pressure", "medium",
      "--alt", "Survey instrument + sampling info",
      "--alt", "Ticket backlog + response time"
    )
  }

  # 7) JSON output
  $cases += @{
    name = "json_output"
    out  = "07_json.txt"
    args = @(
      "DAU up 12% WoW so redesign is a success.",
      "--context", "Exec update; decide whether to accelerate rollout",
      "--stakes", "medium",
      "--reversibility", "medium",
      "--detectability", "moderate",
      "--time-pressure", "high",
      "--json"
    )
  }

  # 8) self-audit
  $cases += @{
    name = "self_audit"
    out  = "08_self_audit.txt"
    args = @(
      "DAU up 12% WoW so redesign is a success.",
      "--context", "Exec update; decide whether to accelerate rollout",
      "--stakes", "medium",
      "--reversibility", "medium",
      "--detectability", "moderate",
      "--time-pressure", "high",
      "--self",
      "--technical"
    )
  }
}

Write-Host ""
Write-Host ("Running smoke tests (Model: " + $Model + ") ...") -ForegroundColor Cyan
Write-Host ("Output folder: " + $runDir) -ForegroundColor DarkGray
Write-Host ""

$results = @()

foreach ($c in $cases) {
  $name = $c.name
  Write-Host ("- " + $name) -NoNewline

  $stdin = $null
  if ($c.ContainsKey("stdin")) { $stdin = $c.stdin }

  $r = Invoke-Case -Name $name -CliArgs $c.args -OutFile $c.out -StdinText $stdin
  $results += $r

  if ($r.ok) {
    Write-Host "  OK" -ForegroundColor Green
  } else {
    Write-Host "  FAIL" -ForegroundColor Red
    if ($r.ContainsKey("err")) {
      Write-Host ("    " + $r.err) -ForegroundColor Red
    }
    Write-Host ("    output: " + $r.out) -ForegroundColor DarkGray
  }
}

Write-Host ""
$passed = ($results | Where-Object { $_.ok }).Count
$failed = ($results | Where-Object { -not $_.ok }).Count

if ($failed -eq 0) {
  Write-Host ("Summary: " + $passed + " passed, " + $failed + " failed") -ForegroundColor Green
} else {
  Write-Host ("Summary: " + $passed + " passed, " + $failed + " failed") -ForegroundColor Red
}

Write-Host ""
Write-Host "Artifacts written to:" -ForegroundColor DarkGray
Write-Host ("  " + $runDir) -ForegroundColor DarkGray
Write-Host ""

if ($failed -ne 0) { exit 1 }
exit 0
