# Updates Git-tracked project files without touching local runtime data.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PROJECT_ROOT = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$LOG_DIR = Join-Path $PROJECT_ROOT "runtime\logs"
$UPDATE_LOG = Join-Path $LOG_DIR "update.log"

function Write-UpdateLog {
    param([string] $Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"
    Write-Host $line
    Add-Content -Path $UPDATE_LOG -Value $line
}

function Invoke-Git {
    param([string[]] $Arguments)

    Push-Location $PROJECT_ROOT
    try {
        & git @Arguments 2>&1 | Tee-Object -FilePath $UPDATE_LOG -Append
        if ($LASTEXITCODE -ne 0) {
            throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
}

New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null
Write-UpdateLog "Starting safe update."

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "Git is required but was not found on PATH."
    }

    Push-Location $PROJECT_ROOT
    try {
        $repoRoot = (& git rev-parse --show-toplevel 2>$null)
        if ($LASTEXITCODE -ne 0) {
            throw "This folder is not inside a Git repository."
        }

        $changes = @(& git status --porcelain --untracked-files=all)
        if ($changes.Count -gt 0) {
            Write-UpdateLog "Uncommitted changes are present. Update stopped before fetching or pulling."
            Write-Host ""
            Write-Host "Close the app if it is running, then commit, discard, or explicitly approve handling these files:"
            $changes | ForEach-Object { Write-Host "  $_" }
            exit 1
        }

        $branch = (& git branch --show-current).Trim()
        if ([string]::IsNullOrWhiteSpace($branch)) {
            throw "The repository is in a detached HEAD state. Update stopped."
        }

        $upstream = (& git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($upstream)) {
            throw "Branch '$branch' does not have an upstream. Update stopped."
        }
    } finally {
        Pop-Location
    }

    Write-UpdateLog "Fetching remote changes."
    Invoke-Git -Arguments @("fetch", "--prune")

    Write-UpdateLog "Applying fast-forward update for Git-tracked files only."
    Invoke-Git -Arguments @("pull", "--ff-only")

    Write-Host ""
    Write-UpdateLog "Update complete. Close the app if it is running, then restart with setup_and_run.bat."
} catch {
    Write-UpdateLog "ERROR: $($_.Exception.Message)"
    exit 1
}
