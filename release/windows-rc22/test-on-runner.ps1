$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or -not $env:RUNNER_TEMP) {
    throw 'This installation test runs on a disposable Windows runner.'
}
$setup = (Resolve-Path -LiteralPath $env:PATH_PREVIEW_SETUP).Path
$probe = Join-Path $env:RUNNER_TEMP ('path-setup-qa-' + [guid]::NewGuid().ToString('N'))
$programs = [Environment]::GetFolderPath('Programs')
$localPrograms = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs'
$oldDir = Join-Path $localPrograms 'Path Preview'
$installDir = Join-Path $localPrograms 'PathYourDay\Path'
$desktopDir = [Environment]::GetFolderPath('DesktopDirectory')
$desktopLink = Join-Path $desktopDir 'Path.lnk'
$shortcut = Join-Path $programs 'Path\Path.lnk'
$oldDesktopLink = Join-Path $desktopDir 'Path Preview.lnk'
$oldMenuLink = Join-Path $programs 'Path Preview.lnk'
$classicMenu = Join-Path $programs 'Path.lnk'
$markerDir = Join-Path $env:APPDATA 'Path-Paperclip-Test'
if (Test-Path -LiteralPath $markerDir) { throw 'A Path profile already exists on this machine.' }
New-Item -ItemType Directory -Path $probe, $markerDir | Out-Null
$marker = Join-Path $markerDir 'synthetic-profile-check.txt'
[IO.File]::WriteAllText($marker, 'synthetic Path installation test')
$msi = Join-Path $probe 'PathPreview.msi'
$extract = Start-Process -FilePath $setup -ArgumentList @('--extract-msi', ('"'+$msi+'"')) -Wait -PassThru -WindowStyle Hidden
if ($extract.ExitCode -ne 0) { throw 'Installer could not extract the embedded package.' }
$engine = Join-Path $env:WINDIR 'system32/msiexec.exe'
# Keep enough MSI activity on the disposable runner to diagnose a failed upgrade.
$loggingKey='HKLM:\Software\Policies\Microsoft\Windows\Installer'
New-Item -Path $loggingKey -Force | Out-Null
New-ItemProperty -Path $loggingKey -Name Logging -PropertyType String -Value 'voicewarmup' -Force | Out-Null
function Show-InstallActions {
    $recent=Get-ChildItem -Path $env:TEMP,(Join-Path $env:WINDIR 'Temp') -Filter 'MSI*.log' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 3
    foreach($log in $recent){
        Select-String -LiteralPath $log.FullName -Pattern 'Component: (MainMenuLink|UserRegistration|DesktopLink)|Feature: Planner;|ShortcutCreate\(|ShortcutRemove\(|Return value 3|^Product: Path|PROPERTY CHANGE: Adding PREVIOUSPATH' |
            Select-Object -Last 16 | ForEach-Object { $_.Line }
    }
}
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
    if ($LASTEXITCODE -ne 0) { Show-InstallActions; throw 'UI installation failed.' }
}
function Check-Link([string]$Link, [string]$Directory) {
    if (-not (Test-Path -LiteralPath $Link)) { Show-InstallActions;throw "Missing shortcut $Link" }
    $item = (New-Object -ComObject WScript.Shell).CreateShortcut($Link)
    if ($item.TargetPath -ne (Join-Path $Directory 'Path.exe')) { throw "Unexpected target $($item.TargetPath)" }
    $ico = ($item.IconLocation -replace ',\s*-?\d+$','').Trim('"')
    if ((Get-FileHash -LiteralPath $ico).Hash -ne '5E4F85994A7D9B387C92D61FA109B3A67DB29B6B16D5D7A7383FB9AAD94646A2') {
        throw "Shortcut uses different artwork: $ico"
    }
}
if ([string]::IsNullOrEmpty($desktopDir) -or $desktopDir -eq [IO.Path]::GetPathRoot($desktopDir)) { throw 'Missing runner Desktop.' }
$expected = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'files.json') | ConvertFrom-Json
foreach($entry in $expected.PSObject.Properties){
    if(Test-Path -LiteralPath (Join-Path $desktopDir $entry.Name)){throw "Runner Desktop is occupied: $($entry.Name)"}
}
if((Test-Path -LiteralPath $shortcut) -or (Test-Path -LiteralPath $desktopLink) -or (Test-Path -LiteralPath $installDir)) {throw 'Runner already has Path.'}
function PersonalLink($file){
    if(Test-Path -LiteralPath $file){throw "Test link already exists: $file"}
    $item=(New-Object -ComObject WScript.Shell).CreateShortcut($file)
    $item.TargetPath=$marker
    $item.Save()
    (Get-FileHash -LiteralPath $file).Hash
}
$classicHash=PersonalLink $classicMenu
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

# Upgrade the published RC21 default installation and both of its old-named shortcuts.
$rc21Setup=Join-Path $probe 'rc21-setup.exe'
Invoke-WebRequest -Uri 'https://github.com/Valdemarouki/Path/releases/download/path-windows-2.0.0-rc.21/Path-2.0.0-rc.21-Windows-x64-Setup.exe' -OutFile $rc21Setup
if((Get-FileHash -LiteralPath $rc21Setup).Hash -ne '3F63BF8941813CDE64450DA6ADF4A6707D44CBFA5A52B3EAAC6638D0CE9022D0'){throw 'Wrong published RC21 installer.'}
$rc21Msi=Join-Path $probe 'rc21.msi'
$rc21Extract=Start-Process $rc21Setup -ArgumentList @('--extract-msi',('"'+$rc21Msi+'"')) -Wait -PassThru -WindowStyle Hidden
if($rc21Extract.ExitCode -ne 0){throw 'RC21 extraction failed.'}
Invoke-Installer @('/i',('"'+$rc21Msi+'"'),'ADDLOCAL=Planner,DesktopShortcut') (Join-Path $probe 'rc21-install.log')
foreach($item in @($oldDesktopLink,$oldMenuLink,(Join-Path $oldDir 'Path.exe'))){
    if(-not (Test-Path -LiteralPath $item)){throw "RC21 fixture incomplete: $item"}
}
Invoke-Wizard 'On' 'On' '' $installDir
foreach($item in @($oldDesktopLink,$oldMenuLink,(Join-Path $oldDir 'Path.exe'))){
    if(Test-Path -LiteralPath $item){throw "Old name remains after RC21 upgrade: $item"}
}
Check-Link $desktopLink $installDir
Check-Link $shortcut $installDir
$registration=New-Object -ComObject WindowsInstaller.Installer
$name=$registration.GetType().InvokeMember('ProductInfo','GetProperty',$null,$registration,@('{7D593BA1-BC0C-5302-B5AE-1BF189129FCF}','ProductName'))
if($name -cne 'Path'){throw "Installed product name is '$name'."}
$native=(Get-Item -LiteralPath (Join-Path $installDir 'Path.exe')).VersionInfo
if($native.ProductName -cne 'Path' -or $native.FileDescription -cne 'Path' -or $native.OriginalFilename -cne 'Path.exe'){throw 'Incorrect executable branding.'}
Invoke-Installer @('/x',('"'+$msi+'"')) (Join-Path $probe 'rc21-upgrade-uninstall.log')
Invoke-Installer @('/i',('"'+$rc21Msi+'"'),('INSTALLDIR="'+$customDir+'"'),'ADDLOCAL=Planner','REMOVE=DesktopShortcut') (Join-Path $probe 'rc21-custom.log')
Invoke-Wizard 'Off' 'Off' '' $customDir
Check-Link $shortcut $customDir
if((Test-Path -LiteralPath $desktopLink) -or (Test-Path -LiteralPath $oldDesktopLink)){throw 'RC21 opted-out desktop shortcut reappeared.'}
Invoke-Installer @('/x',('"'+$msi+'"')) (Join-Path $probe 'custom-upgrade-uninstall.log')

# Preserve a different desktop shortcut with the same visible name, including after removal.
$foreign=PersonalLink $desktopLink
$alternateLink=Join-Path $desktopDir 'Path\Path.lnk'
Invoke-Wizard 'On' 'On' '' $installDir
Check-Link $alternateLink $installDir
Invoke-Installer @('/x',('"'+$msi+'"')) (Join-Path $probe 'shared-name-uninstall.log')
if((Get-FileHash -LiteralPath $desktopLink).Hash -ne $foreign -or (Test-Path -LiteralPath $alternateLink)){
    throw 'An existing desktop shortcut was disturbed.'
}
Remove-Item -LiteralPath $desktopLink
'PASS: RC21 upgraded into Path; old shortcuts removed; desktop and Start menu name collisions preserved.'
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
    if ((Get-FileHash -LiteralPath $asar).Hash -ne '5B9FDD2F32A1B9FCAFBAAC002B3D558141BCB9A07F53065D7ECC0D3438F1C04A') { throw 'Installed planner differs.' }
    foreach ($entry in $expected.PSObject.Properties) {
        if(Test-Path -LiteralPath (Join-Path $desktopDir $entry.Name)){throw "RC20 file remains on Desktop: $($entry.Name)"}
        $actual = Get-FileHash -LiteralPath (Join-Path $installDir $entry.Name)
        if ($actual.Hash -ne $entry.Value) { throw "Unexpected installed file: $($entry.Name)" }
    }
    Check-Link $desktopLink $installDir
    Check-Link $shortcut $installDir
    & python (Join-Path $PSScriptRoot 'check-icon.py') (Join-Path $installDir 'Path.exe') (Join-Path $env:RUNNER_TEMP 'rc22-input/assets/path.ico')
    if($LASTEXITCODE -ne 0){throw 'Installed executable icon differs from the rounded Path mark.'}
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
    [IO.File]::WriteAllText($check, "const fs=require('node:fs'),p=require('node:path'),a=process.argv[2]; if(require(p.join(a,'package.json')).version!=='2.0.0-rc.22'||typeof require(p.join(a,'sync-v3-host.cjs')).validators().resolve!=='function')process.exit(1); fs.writeFileSync(process.argv[3],fs.readFileSync(p.join(a,'app/index.html')));")
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
if ((Get-FileHash -LiteralPath $classicMenu).Hash -ne $classicHash){throw 'The independent Start menu shortcut changed.'}
'PASS: clean setup, optional branded shortcut, desktop migration from RC20, preference changes, all 74 files, Sport and Calendar, uninstall, and preservation of user files.'
