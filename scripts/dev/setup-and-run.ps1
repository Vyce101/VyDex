# Sets up local dependencies when needed, then starts the current dev target.
[CmdletBinding()]
param(
    [switch] $ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PROJECT_ROOT = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$DOCS_ROOT = Join-Path $PROJECT_ROOT "docs\documentation"
$RUNTIME_ROOT = Join-Path $PROJECT_ROOT "runtime"
$LOG_DIR = Join-Path $RUNTIME_ROOT "logs"
$SETUP_DIR = Join-Path $RUNTIME_ROOT "setup"
$LAUNCHER_LOG = Join-Path $LOG_DIR "setup-and-run.log"
$APP_LOG = Join-Path $LOG_DIR "app-retype-docs.log"
$APP_ERROR_LOG = Join-Path $LOG_DIR "app-retype-docs-error.log"
$SETUP_MARKER = Join-Path $SETUP_DIR "docs-npm.sha256"
$PID_FILE = Join-Path $SETUP_DIR "retype-docs.pid"

$DOCS_HOST = "127.0.0.1"
$DOCS_PORT = 5000
$DOCS_URL = "http://${DOCS_HOST}:${DOCS_PORT}/"
$READINESS_TIMEOUT_SECONDS = 60
$READINESS_INTERVAL_SECONDS = 2
$APP_TARGET_NAME = "Retype documentation preview"

# TODO: When the VyDex app scaffold exists, replace the Retype docs target with
# the app package task, app port, app health endpoint, and browser URL.
# Keep those values as named constants near the top of this file.

function Write-LauncherLog {
    param([string] $Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"
    Write-Host $line
    Add-Content -Path $LAUNCHER_LOG -Value $line
}

function Test-PortOpen {
    param(
        [string] $HostName,
        [int] $Port
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connection = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $connection.AsyncWaitHandle.WaitOne(500)) {
            return $false
        }

        $client.EndConnect($connection)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Get-DependencyFingerprint {
    $hashInput = foreach ($fileName in @("package.json", "package-lock.json")) {
        $path = Join-Path $DOCS_ROOT $fileName
        if (-not (Test-Path $path)) {
            throw "Missing dependency file: $path"
        }

        Get-FileHash -Algorithm SHA256 -Path $path | Select-Object -ExpandProperty Hash
    }

    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($hashInput -join "`n"))
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return [System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace("-", "")
    } finally {
        $sha.Dispose()
    }
}

function Invoke-LoggedNative {
    param(
        [string] $FilePath,
        [string[]] $Arguments,
        [string] $WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments 2>&1 | Tee-Object -FilePath $LAUNCHER_LOG -Append
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
        }
    } finally {
        Pop-Location
    }
}

function Install-DependenciesIfNeeded {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is required but was not found on PATH."
    }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm is required but was not found on PATH."
    }

    $nodeModules = Join-Path $DOCS_ROOT "node_modules"
    $currentFingerprint = Get-DependencyFingerprint
    $previousFingerprint = if (Test-Path $SETUP_MARKER) {
        Get-Content -Raw $SETUP_MARKER
    } else {
        ""
    }

    if ((Test-Path $nodeModules) -and ($previousFingerprint.Trim() -eq $currentFingerprint)) {
        Write-LauncherLog "Dependencies are already installed for $APP_TARGET_NAME."
        return
    }

    Write-LauncherLog "Installing dependencies for $APP_TARGET_NAME with npm ci."
    Invoke-LoggedNative -FilePath "npm.cmd" -Arguments @("ci") -WorkingDirectory $DOCS_ROOT
    Set-Content -Path $SETUP_MARKER -Value $currentFingerprint
}

function Stop-TrackedProcessTree {
    if (-not (Test-Path $PID_FILE)) {
        return
    }

    $pidText = (Get-Content -Raw $PID_FILE).Trim()
    if (-not ($pidText -match "^\d+$")) {
        Remove-Item -LiteralPath $PID_FILE -Force
        return
    }

    $trackedProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $pidText" -ErrorAction SilentlyContinue
    if ($null -eq $trackedProcess) {
        Remove-Item -LiteralPath $PID_FILE -Force
        return
    }

    $commandLine = [string] $trackedProcess.CommandLine
    if ($commandLine -notlike "*docs\documentation*" -and $commandLine -notlike "*retype*" -and $commandLine -notlike "*npm*") {
        Write-LauncherLog "Tracked PID $pidText no longer looks app-owned; leaving it alone."
        Remove-Item -LiteralPath $PID_FILE -Force
        return
    }

    Write-LauncherLog "Stopping previously tracked $APP_TARGET_NAME process tree at PID $pidText."
    $processIds = New-Object System.Collections.Generic.List[int]
    $queue = New-Object System.Collections.Generic.Queue[int]
    $queue.Enqueue([int] $pidText)

    while ($queue.Count -gt 0) {
        $currentPid = $queue.Dequeue()
        $processIds.Add($currentPid)
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $currentPid" -ErrorAction SilentlyContinue
        foreach ($child in $children) {
            $queue.Enqueue([int] $child.ProcessId)
        }
    }

    foreach ($processId in ($processIds | Sort-Object -Descending)) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }

    Remove-Item -LiteralPath $PID_FILE -Force -ErrorAction SilentlyContinue
}

function Wait-ForReadiness {
    $deadline = (Get-Date).AddSeconds($READINESS_TIMEOUT_SECONDS)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $DOCS_URL -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return
            }
        } catch {
            Start-Sleep -Seconds $READINESS_INTERVAL_SECONDS
        }
    }

    $tail = if (Test-Path $APP_LOG) {
        Get-Content -Path $APP_LOG -Tail 80
    } else {
        @("No app log was written.")
    }

    throw "Timed out waiting for $APP_TARGET_NAME at $DOCS_URL.`nRecent app log:`n$($tail -join "`n")"
}

New-Item -ItemType Directory -Force -Path $LOG_DIR, $SETUP_DIR | Out-Null
Write-LauncherLog "Starting VyDex setup-and-run launcher."

try {
    if ($ValidateOnly) {
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
            throw "Node.js is required but was not found on PATH."
        }

        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
            throw "npm is required but was not found on PATH."
        }

        Get-DependencyFingerprint | Out-Null
        Write-LauncherLog "Launcher validation passed. No app process was started."
        exit 0
    }

    Install-DependenciesIfNeeded
    Stop-TrackedProcessTree

    if (Test-PortOpen -HostName $DOCS_HOST -Port $DOCS_PORT) {
        throw "Port $DOCS_PORT is already in use. Close the process using $DOCS_URL and run setup_and_run.bat again."
    }

    Write-LauncherLog "Starting $APP_TARGET_NAME on $DOCS_URL."
    $arguments = @("run", "start", "--", "--host", $DOCS_HOST, "--port", [string] $DOCS_PORT, "--no-open")
    $process = Start-Process -FilePath "npm.cmd" -ArgumentList $arguments -WorkingDirectory $DOCS_ROOT -RedirectStandardOutput $APP_LOG -RedirectStandardError $APP_ERROR_LOG -PassThru -WindowStyle Hidden
    Set-Content -Path $PID_FILE -Value $process.Id

    Wait-ForReadiness
    Write-LauncherLog "$APP_TARGET_NAME is ready. Opening $DOCS_URL."
    Start-Process $DOCS_URL

    Write-LauncherLog "Launcher will stay open while the app process runs. Close with Ctrl+C when finished."
    Wait-Process -Id $process.Id
    Write-LauncherLog "$APP_TARGET_NAME exited."
} catch {
    Write-LauncherLog "ERROR: $($_.Exception.Message)"
    exit 1
}
