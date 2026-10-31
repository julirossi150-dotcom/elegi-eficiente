# Actualiza los datos desde esta PC y los sube a GitHub. Sirve si alguna tienda bloquea a los servidores de
# GitHub Actions: desde una conexión hogareña suelen responder bien.
# GitHub conserva 3 días las ofertas de una tienda que falla allá, así que alcanza con correrlo
# la mayoría de los días. El push dispara la compilación y publicación del sitio.
#
#   powershell -ExecutionPolicy Bypass -File scripts\actualizar-desde-pc.ps1            # actualiza y sube
#   powershell -ExecutionPolicy Bypass -File scripts\actualizar-desde-pc.ps1 -SinSubir  # prueba sin push
param([switch]$SinSubir)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$logDir = Join-Path $root 'pipeline\.cache'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'actualizar-desde-pc.log'

function Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Write-Output $line
  Add-Content -Path $log -Value $line -Encoding utf8
}

function Run($exe, [string[]]$params) {
  $out = & $exe @params 2>&1 | ForEach-Object { "$_" }
  $out | ForEach-Object { Add-Content -Path $log -Value "  $_" -Encoding utf8 }
  if ($LASTEXITCODE -ne 0) { throw "$exe $($params -join ' ') salio con codigo $LASTEXITCODE" }
  return $out
}

try {
  Log '--- inicio'
  # traer lo que haya commiteado la corrida de GitHub, para no pisarla. Con rebase, porque puede haber
  # commits de código locales todavía sin subir; si choca, se deja el repo como estaba.
  try {
    Run git @('pull', '--rebase', '--autostash', '--quiet', 'origin', 'main') | Out-Null
  } catch {
    git rebase --abort 2>$null
    throw
  }
  Run npm.cmd @('run', 'data:update') | Out-Null
  Run npm.cmd @('run', 'data:validate') | Out-Null

  $meta = Get-Content (Join-Path $root 'public\data\meta.json') -Raw -Encoding utf8 | ConvertFrom-Json
  $fallaron = @($meta.stores | Where-Object { -not $_.ok } | ForEach-Object { $_.id })
  Log "tiendas con error: $(if ($fallaron.Count) { $fallaron -join ', ' } else { 'ninguna' })"

  Run git @('add', 'public/data', 'pipeline/history') | Out-Null
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) { Log 'sin cambios en los datos'; exit 0 }
  Run git @('commit', '--quiet', '-m', "datos: actualizacion desde PC $(Get-Date -Format 'yyyy-MM-dd')") | Out-Null

  if ($SinSubir) { Log 'commit hecho, sin subir (-SinSubir)'; exit 0 }
  Run git @('push', '--quiet', 'origin', 'main') | Out-Null
  Log 'datos subidos'
} catch {
  Log "ERROR: $_"
  exit 1
}
