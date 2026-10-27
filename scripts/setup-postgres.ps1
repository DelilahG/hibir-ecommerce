<#
  Creates a local PostgreSQL cluster for development (no admin rights or Windows service needed),
  starts it, creates the hibir and hibir_test databases and writes server/.env.
  Safe to run repeatedly: it never deletes data and only runs initdb when the data folder is empty.

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts\setup-postgres.ps1 -PgBin "C:\Program Files\PostgreSQL\17\bin"
  If the cluster exists but its postgres password is unknown, add -ResetPassword. This allows
  password-free login from 127.0.0.1 for a moment, sets a new password, and restores pg_hba.conf.
  Start the server again later with:
    & "<PgBin>\pg_ctl.exe" -D "<DataDir>" -l "<DataDir>\server.log" start
#>
param(
  [Parameter(Mandatory = $true)][string]$PgBin,
  [string]$DataDir = "$env:USERPROFILE\pgdata-hibir",
  [int]$Port = 5432,
  [switch]$ResetPassword
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root 'server\.env'
$pgCtl = Join-Path $PgBin 'pg_ctl.exe'
$logFile = Join-Path $DataDir 'server.log'

function New-Secret([int]$bytes = 18) {
  $buf = New-Object byte[] $bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  ([Convert]::ToBase64String($buf)) -replace '[+/=]', 'x'
}

# Runs pg_ctl without piping its output. The postgres process it launches inherits pipe
# handles, so `| Out-Null` would make PowerShell wait for the server to exit.
function Invoke-PgCtl([string[]]$arguments) {
  $p = Start-Process -FilePath $pgCtl -ArgumentList $arguments -NoNewWindow -PassThru
  [void]$p.Handle  # Windows PowerShell only reports ExitCode if the handle is read before exit.
  $p.WaitForExit()
  return $p.ExitCode
}

function Test-Port([int]$port) {
  $client = New-Object Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $client.Close() }
}

function Write-EnvFile([string]$pgPassword) {
  $content = (Get-Content (Join-Path $root 'server\.env.example') -Raw) `
    -replace 'postgres://postgres:CHANGE_ME@localhost:5432', "postgres://postgres:$pgPassword@localhost:$Port"
  if (Test-Path $envFile) {
    # Keep the existing file and only replace the connection strings.
    $content = (Get-Content $envFile -Raw) -replace 'postgres://postgres:[^@]*@', "postgres://postgres:$pgPassword@"
  } else {
    $content = $content -replace 'ADMIN_PASSWORD=.*', "ADMIN_PASSWORD=$(New-Secret 15)"
  }
  [IO.File]::WriteAllText($envFile, $content)
}

# psql is not required: some distributions (e.g. the embedded server-only builds) do not ship it.
foreach ($exe in 'initdb.exe', 'pg_ctl.exe') {
  if (-not (Test-Path (Join-Path $PgBin $exe))) { throw "$exe not found in $PgBin" }
}

$pgPassword = $null
if (Test-Path $envFile) {
  $line = Select-String -Path $envFile -Pattern '^DATABASE_URL=postgres://postgres:([^@]+)@' | Select-Object -First 1
  if ($line -and $line.Matches[0].Groups[1].Value -ne 'CHANGE_ME') { $pgPassword = $line.Matches[0].Groups[1].Value }
}

$needReset = $false
if (-not (Test-Path (Join-Path $DataDir 'PG_VERSION'))) {
  if (-not $pgPassword) {
    $pgPassword = New-Secret
    Write-EnvFile $pgPassword   # saved before initdb so the password can never be lost
  }
  $pwFile = New-TemporaryFile
  [IO.File]::WriteAllText($pwFile, $pgPassword)
  & (Join-Path $PgBin 'initdb.exe') -D $DataDir -U postgres -E UTF8 --auth=scram-sha-256 --pwfile=$pwFile | Out-Null
  Remove-Item $pwFile
  if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
  Write-Host "Initialised cluster in $DataDir"
} elseif ($ResetPassword -or -not $pgPassword) {
  if (-not $ResetPassword) { throw 'Cluster exists but its password is unknown. Rerun with -ResetPassword.' }
  $pgPassword = New-Secret
  $needReset = $true
}

if (Test-Port $Port) {
  Write-Host "PostgreSQL is already running on port $Port"
} elseif ((Invoke-PgCtl @('-D', "`"$DataDir`"", 'status')) -ne 0) {
  if ((Invoke-PgCtl @('-D', "`"$DataDir`"", '-l', "`"$logFile`"", '-o', "`"-p $Port`"", '-w', 'start')) -ne 0) {
    throw "PostgreSQL did not start; see $logFile"
  }
  Write-Host "Started PostgreSQL on port $Port"
} else {
  Write-Host 'PostgreSQL is already running'
}

$env:PGPASSWORD = $pgPassword
$env:PGPORT = "$Port"
Push-Location (Join-Path $root 'server')
try {
  if ($needReset) {
    $hba = Join-Path $DataDir 'pg_hba.conf'
    $original = [IO.File]::ReadAllText($hba)
    Copy-Item $hba "$hba.bak" -Force
    try {
      $trusted = $original -replace '(?m)^(host\s+all\s+all\s+127\.0\.0\.1/32\s+)scram-sha-256', '${1}trust'
      [IO.File]::WriteAllText($hba, $trusted)
      [void](Invoke-PgCtl @('-D', "`"$DataDir`"", 'reload'))
      Start-Sleep -Seconds 1
      @'
const { Client } = require('pg');
(async () => {
  // The reload is asynchronous, so retry briefly until trust authentication is active.
  for (let attempt = 1; ; attempt++) {
    const c = new Client({ host: '127.0.0.1', port: +process.env.PGPORT, user: 'postgres', database: 'postgres', password: 'unused' });
    try {
      await c.connect();
      await c.query(`ALTER USER postgres PASSWORD '${process.env.PGPASSWORD}'`);
      await c.end();
      return;
    } catch (e) {
      await c.end().catch(() => {});
      if (attempt === 10) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
'@ | node -
      if ($LASTEXITCODE -ne 0) { throw 'Setting the new password failed' }
    } finally {
      [IO.File]::WriteAllText($hba, $original)
      [void](Invoke-PgCtl @('-D', "`"$DataDir`"", 'reload'))
    }
    Write-EnvFile $pgPassword
    Write-Host 'Set a new postgres password and saved it to server/.env'
  }

  # Create the databases through the project's own `pg` driver (run `npm install` first).
  @'
const { Client } = require('pg');
(async () => {
  const c = new Client({ host: 'localhost', port: +process.env.PGPORT, user: 'postgres', password: process.env.PGPASSWORD, database: 'postgres' });
  await c.connect();
  for (const db of ['hibir', 'hibir_test']) {
    const r = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [db]);
    if (r.rowCount === 0) { await c.query(`CREATE DATABASE ${db}`); console.log(`Created database ${db}`); }
    else console.log(`Database ${db} already exists`);
  }
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
'@ | node -
  if ($LASTEXITCODE -ne 0) { throw 'Creating databases failed' }
} finally {
  Pop-Location
  Remove-Item Env:PGPASSWORD, Env:PGPORT
}

if (Test-Path $envFile) {
  $admin = (Select-String -Path $envFile -Pattern '^ADMIN_PASSWORD=(.*)$').Matches[0].Groups[1].Value
  Write-Host "server/.env is ready (admin login after seeding: admin@example.com / $admin)"
}
Write-Host 'Done.'
