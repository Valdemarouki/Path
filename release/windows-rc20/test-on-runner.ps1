$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or -not $env:RUNNER_TEMP) {
    throw 'This installation test runs on a disposable Windows runner.'
}
$setup = (Resolve-Path -LiteralPath $env:PATH_PREVIEW_SETUP).Path
$probe = Join-Path $env:RUNNER_TEMP ('path-setup-qa-' + [guid]::NewGuid().ToString('N'))
$installDir = Join-Path $probe 'application'
$markerDir = Join-Path $env:APPDATA 'Path-Paperclip-Test'
if (Test-Path -LiteralPath $markerDir) { throw 'A Path profile already exists on this machine.' }
New-Item -ItemType Directory -Path $probe, $markerDir | Out-Null
$marker = Join-Path $markerDir 'synthetic-profile-check.txt'
[IO.File]::WriteAllText($marker, 'synthetic Path installation test')
$msi = Join-Path $probe 'PathPreview.msi'
$extract = Start-Process -FilePath $setup -ArgumentList @('--extract-msi', ('"'+$msi+'"')) -Wait -PassThru -WindowStyle Hidden
if ($extract.ExitCode -ne 0) { throw 'Installer could not extract the embedded package.' }
$engine = Join-Path $env:WINDIR 'system32/msiexec.exe'
function Invoke-Installer([string[]]$Arguments, [string]$Log) {
    $result = Start-Process -FilePath $engine -ArgumentList ($Arguments + @('/qn', '/norestart', '/l*v', ('"'+$Log+'"'))) -Wait -PassThru -WindowStyle Hidden
    if ($result.ExitCode -ne 0) {
        Get-Content -LiteralPath $Log -Tail 24
        throw "Windows Installer returned $($result.ExitCode)."
    }
}
$installed = $false
try {
    Invoke-Installer -Arguments @('/i', ('"'+$msi+'"'), ('INSTALLDIR="'+$installDir+'"')) -Log (Join-Path $probe 'install.log')
    $installed = $true
    $files = @(Get-ChildItem -LiteralPath $installDir -Recurse -File)
    if ($files.Count -ne 74) { throw "Expected 74 installed files, got $($files.Count)." }
    $asar = Join-Path $installDir 'resources/app.asar'
    if ((Get-FileHash -LiteralPath $asar).Hash -ne 'CBF21C582F5B051D85E588631BECB8F1069B44B154DBA39EECCE590F4868E47A') { throw 'Installed planner differs.' }
    $expected = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'files.json') | ConvertFrom-Json
    foreach ($entry in $expected.PSObject.Properties) {
        $actual = Get-FileHash -LiteralPath (Join-Path $installDir $entry.Name)
        if ($actual.Hash -ne $entry.Value) { throw "Unexpected installed file: $($entry.Name)" }
    }
    $shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Path Preview.lnk'
    if (-not (Test-Path -LiteralPath $shortcut)) { throw 'Start-menu shortcut missing.' }
    $target = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut).TargetPath
    if ((Resolve-Path -LiteralPath $target).Path -ne (Join-Path $installDir 'Path.exe')) { throw 'Shortcut points to a different executable.' }
    $env:ELECTRON_RUN_AS_NODE = '1'
    $check=Join-Path $probe 'verify-run.cjs'
    $html = Join-Path $probe 'index.html'
    [IO.File]::WriteAllText($check, "const fs=require('node:fs'),p=require('node:path'),a=process.argv[2]; if(require(p.join(a,'package.json')).version!=='2.0.0-rc.20'||typeof require(p.join(a,'sync-v3-host.cjs')).validators().resolve!=='function')process.exit(1); fs.writeFileSync(process.argv[3],fs.readFileSync(p.join(a,'app/index.html')));")
    $runtime = Start-Process -FilePath $target -ArgumentList @(('"'+$check+'"'), ('"'+$asar+'"'), ('"'+$html+'"')) -Wait -PassThru -WindowStyle Hidden
    if ($runtime.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $html)) { throw 'Installed planner could not start.' }
    Remove-Item Env:ELECTRON_RUN_AS_NODE
    & node (Join-Path $PSScriptRoot 'sport.cjs') $html
    if ($LASTEXITCODE -ne 0) { throw 'Sport regression test on installed planner failed.' }
    & node (Join-Path $PSScriptRoot 'calendar-close.cjs') $html
    if ($LASTEXITCODE -ne 0) { throw 'Calendar closing regression failed.' }
} finally {
    if ($installed) { Invoke-Installer -Arguments @('/x', ('"'+$msi+'"')) -Log (Join-Path $probe 'uninstall.log') }
}
if (Test-Path -LiteralPath (Join-Path $installDir 'Path.exe')) { throw 'Program files remain after uninstall.' }
if (Test-Path -LiteralPath $shortcut) { throw 'Start-menu shortcut remains after uninstall.' }
if ([IO.File]::ReadAllText($marker) -ne 'synthetic Path installation test') { throw 'The profile marker changed.' }
'PASS: installed, verified the runtime and shortcut, uninstalled, and preserved the synthetic profile.'
