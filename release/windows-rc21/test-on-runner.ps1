$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or -not $env:RUNNER_TEMP) {
    throw 'This installation test runs on a disposable Windows runner.'
}
$setup = (Resolve-Path -LiteralPath $env:PATH_PREVIEW_SETUP).Path
$probe = Join-Path $env:RUNNER_TEMP ('path-setup-qa-' + [guid]::NewGuid().ToString('N'))
$installDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\Path Preview'
$desktopDir = [Environment]::GetFolderPath('DesktopDirectory')
$desktopLink = Join-Path $desktopDir 'Path Preview.lnk'
$shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Path Preview.lnk'
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
function Invoke-Wizard([string]$Choice, [string]$Initial, [string]$Location, [string]$Expected) {
    $switches = @('-NoProfile','-NonInteractive','-STA','-File',(Join-Path $PSScriptRoot 'wizard-qa.ps1'),
        '-SetupFile',$setup,'-Mode','Install','-Shortcut',$Choice,'-ExpectedInitial',$Initial,'-ExpectedFolder',$Expected)
    if ($Location) { $switches += @('-Folder',$Location) }
    & powershell.exe @switches
    if ($LASTEXITCODE -ne 0) { throw 'UI installation failed.' }
}
function Check-Link([string]$Link, [string]$Directory) {
    if (-not (Test-Path -LiteralPath $Link)) { throw "Missing shortcut $Link" }
    $item = (New-Object -ComObject WScript.Shell).CreateShortcut($Link)
    if ($item.TargetPath -ne (Join-Path $Directory 'Path.exe')) { throw "Unexpected target $($item.TargetPath)" }
    $ico = ($item.IconLocation -replace ',\s*-?\d+$','').Trim('"')
    if ((Get-FileHash -LiteralPath $ico).Hash -ne 'F5BE5F35A389A911F9B545A7F7AD385320F77A5B604E352E3689C2A438AD3321') {
        throw "Shortcut uses different artwork: $ico"
    }
}
if ([string]::IsNullOrEmpty($desktopDir) -or $desktopDir -eq [IO.Path]::GetPathRoot($desktopDir)) { throw 'Missing runner Desktop.' }
$expected = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'files.json') | ConvertFrom-Json
foreach($entry in $expected.PSObject.Properties){
    if(Test-Path -LiteralPath (Join-Path $desktopDir $entry.Name)){throw "Runner Desktop is occupied: $($entry.Name)"}
}
if((Test-Path -LiteralPath $shortcut) -or (Test-Path -LiteralPath $desktopLink) -or (Test-Path -LiteralPath $installDir)) {throw 'Runner already has Path.'}
$oldSetup=Join-Path $probe 'previous-setup.exe'
Invoke-WebRequest -Uri 'https://github.com/Valdemarouki/Path/releases/download/path-windows-2.0.0-rc.20/Path-2.0.0-rc.20-Windows-x64-Setup.exe' -OutFile $oldSetup
if((Get-FileHash -LiteralPath $oldSetup).Hash -ne '3B69445592076F36CDAC9CD9EE2DF9F4039B58FA90666723913A10A33F53252F'){throw 'Wrong RC20 installer.'}
$oldMsi=Join-Path $probe 'previous.msi'
$extractOld=Start-Process -FilePath $oldSetup -ArgumentList @('--extract-msi',('"'+$oldMsi+'"')) -WindowStyle Hidden -Wait -PassThru
if($extractOld.ExitCode -ne 0){throw 'Could not extract RC20.'}
$customDir=Join-Path $probe 'custom application folder'
Invoke-Wizard 'Off' 'On' $customDir $installDir
if((Test-Path -LiteralPath $desktopLink) -or -not (Test-Path -LiteralPath (Join-Path $customDir 'Path.exe'))){throw 'Clean installation without desktop shortcut failed.'}
Check-Link $shortcut $customDir
Invoke-Installer -Arguments @('/x',('"'+$msi+'"')) -Log (Join-Path $probe 'clean-uninstall.log')
if((Test-Path -LiteralPath $shortcut) -or (Test-Path -LiteralPath (Join-Path $customDir 'Path.exe'))){throw 'Clean uninstall left program files.'}
$invalid=Start-Process -FilePath $engine -ArgumentList @('/i',('"'+$msi+'"'),('INSTALLDIR="'+$desktopDir+'"'),'/qn','/norestart') -WindowStyle Hidden -Wait -PassThru
if($invalid.ExitCode -ne 1603 -or (Test-Path -LiteralPath (Join-Path $desktopDir 'Path.exe'))){throw 'Raw MSI did not protect the Desktop.'}
Invoke-Installer -Arguments @('/i',('"'+$oldMsi+'"'),('INSTALLDIR="'+$desktopDir+'"')) -Log (Join-Path $probe 'previous-install.log')
if(-not (Test-Path -LiteralPath (Join-Path $desktopDir 'Path.exe'))){throw 'Failed to reproduce the old desktop install.'}
$sentinels=@((Join-Path $desktopDir 'untouched-personal-test.txt'),(Join-Path $desktopDir 'resources\untouched-personal-test.txt'))
foreach($f in $sentinels){[IO.File]::WriteAllText($f,'Unrelated file')}
$installed = $false
try {
    Invoke-Wizard 'On' 'On' $desktopDir $installDir
    $installed = $true
    $files = @(Get-ChildItem -LiteralPath $installDir -Recurse -File)
    if ($files.Count -ne 74) { throw "Expected 74 installed files, got $($files.Count)." }
    $asar = Join-Path $installDir 'resources/app.asar'
    if ((Get-FileHash -LiteralPath $asar).Hash -ne 'C7703DB0F59CEE524C4569AE9772CEC1B60795D6A7F086E271957D65E1036125') { throw 'Installed planner differs.' }
    foreach ($entry in $expected.PSObject.Properties) {
        if(Test-Path -LiteralPath (Join-Path $desktopDir $entry.Name)){throw "RC20 file remains on Desktop: $($entry.Name)"}
        $actual = Get-FileHash -LiteralPath (Join-Path $installDir $entry.Name)
        if ($actual.Hash -ne $entry.Value) { throw "Unexpected installed file: $($entry.Name)" }
    }
    Check-Link $desktopLink $installDir
    Check-Link $shortcut $installDir
    Invoke-Wizard 'Off' 'On' '' $installDir
    if(Test-Path -LiteralPath $desktopLink){throw 'Unchecking the box did not remove the registered shortcut.'}
    Invoke-Wizard 'On' 'Off' '' $installDir
    Check-Link $desktopLink $installDir
    foreach($f in $sentinels){if([IO.File]::ReadAllText($f) -ne 'Unrelated file'){throw 'Upgrade disturbed unrelated files.'}}
    if (-not (Test-Path -LiteralPath $shortcut)) { throw 'Start-menu shortcut missing.' }
    $target = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcut).TargetPath
    if ((Resolve-Path -LiteralPath $target).Path -ne (Join-Path $installDir 'Path.exe')) { throw 'Shortcut points to a different executable.' }
    $env:ELECTRON_RUN_AS_NODE = '1'
    $check=Join-Path $probe 'verify-run.cjs'
    $html = Join-Path $probe 'index.html'
    [IO.File]::WriteAllText($check, "const fs=require('node:fs'),p=require('node:path'),a=process.argv[2]; if(require(p.join(a,'package.json')).version!=='2.0.0-rc.21'||typeof require(p.join(a,'sync-v3-host.cjs')).validators().resolve!=='function')process.exit(1); fs.writeFileSync(process.argv[3],fs.readFileSync(p.join(a,'app/index.html')));")
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
if (Test-Path -LiteralPath $desktopLink) { throw 'Desktop shortcut remains after uninstall.' }
foreach($f in $sentinels){if([IO.File]::ReadAllText($f) -ne 'Unrelated file'){throw 'Uninstall disturbed unrelated files.'}}
if ([IO.File]::ReadAllText($marker) -ne 'synthetic Path installation test') { throw 'The profile marker changed.' }
'PASS: clean setup, optional branded shortcut, desktop migration from RC20, preference changes, all 74 files, Sport and Calendar, uninstall, and preservation of user files.'
