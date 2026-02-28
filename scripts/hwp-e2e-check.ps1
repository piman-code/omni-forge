param(
  [Parameter(Mandatory = $false)]
  [string]$SampleHwp = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Find-Soffice {
  $candidates = @()

  try {
    $where = & where.exe soffice.exe 2>$null
    if ($where) {
      $candidates += ($where -split "`r?`n")
    }
  } catch {
  }

  $programFiles = $env:ProgramFiles
  $programFilesX86 = [System.Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
  if ($programFiles) {
    $candidates += (Join-Path $programFiles "LibreOffice\\program\\soffice.exe")
  }
  if ($programFilesX86) {
    $candidates += (Join-Path $programFilesX86 "LibreOffice\\program\\soffice.exe")
  }

  foreach ($candidate in $candidates | Where-Object { $_ -and $_.Trim().Length -gt 0 } | Select-Object -Unique) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  return $null
}

Write-Host "== Omni Forge HWP E2E Environment Check =="

$soffice = Find-Soffice
if ($soffice) {
  Write-Host "[OK] soffice found: $soffice"
} else {
  Write-Host "[WARN] soffice not found. HWP auto route will fallback to guide."
}

if ($SampleHwp -and $SampleHwp.Trim().Length -gt 0) {
  if (-not (Test-Path $SampleHwp)) {
    Write-Host "[FAIL] sample file not found: $SampleHwp"
    exit 1
  }
  $ext = [System.IO.Path]::GetExtension($SampleHwp).ToLowerInvariant()
  if ($ext -ne ".hwp" -and $ext -ne ".hwpx") {
    Write-Host "[WARN] sample extension is $ext (expected .hwp or .hwpx)"
  } else {
    Write-Host "[OK] sample file exists: $SampleHwp"
  }
} else {
  Write-Host "[INFO] no sample file provided. Use -SampleHwp <path> to validate file path."
}

Write-Host ""
Write-Host "Manual E2E checklist:"
Write-Host "1) Put sample .hwp/.hwpx into parser inbox folder."
Write-Host "2) Run 'Parser inbox: Scan now'."
Write-Host "3) Confirm .parser.md or .parser.xml output is created."
Write-Host "4) On failure, confirm guidance text for soffice/readBinary/parser chain."
