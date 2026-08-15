$InstallCodexSkill = $args -contains "-InstallCodexSkill"
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
npm install

if ($InstallCodexSkill -or $env:INSTALL_CODEX_SKILL -eq "true") {
  $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
  $skillsDir = Join-Path $codexHome "skills"
  $sourceSkill = Join-Path $ProjectRoot "skills\dify-workflow-generation"
  $targetSkill = Join-Path $skillsDir "dify-workflow-generation"

  if (Test-Path -LiteralPath $sourceSkill) {
    New-Item -ItemType Directory -Path $skillsDir -Force | Out-Null
    Copy-Item -LiteralPath $sourceSkill -Destination $skillsDir -Recurse -Force
    Write-Host "Installed Codex skill: $targetSkill"
  }
} else {
  Write-Host "Skipped Codex skill install. Use .\install.ps1 -InstallCodexSkill only for Codex setup."
}

Write-Host "Installed dependencies. Start with: .\scripts\start-mcp.ps1"
