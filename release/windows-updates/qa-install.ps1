param([string]$InputDirectory, [string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') { throw 'Disposable Windows runner required.' }
$qa = New-Item -ItemType Directory -Path (Join-Path $env:RUNNER_TEMP 'windows-upgrade-test')
$location = Join-Path $qa.FullName 'My Path installation'
$profile = Join-Path $env:APPDATA 'Path-Paperclip-Test'
if (Test-Path -LiteralPath $profile) { throw 'Expected a fresh guest profile' }
$shortcut = Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Path.lnk'
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Path\Path.lnk'
$exe = Join-Path $location 'Path.exe'
$asar = Join-Path $location 'resources\app.asar'
$setup = Join-Path $OutputDirectory 'Path.Installer.exe'
if ((Get-Item -LiteralPath $setup).VersionInfo.ProductName -cne 'Path Installer') {throw 'Installer name differs from the published RC22 installer'}
$bundle = Join-Path $OutputDirectory 'windows-update.sigstore.json'
$version = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'version.txt') -Raw).Trim()
$expected = Get-Content -Raw -LiteralPath (Join-Path $InputDirectory 'update-build.json') | ConvertFrom-Json
$rc22 = Join-Path $qa.FullName 'RC22.exe'
Invoke-WebRequest 'https://github.com/Valdemarouki/Path/releases/download/path-installer-2.0.0-rc.22/Path.Installer.exe' -OutFile $rc22
if ((Get-FileHash $rc22).Hash -ne 'CA790AB92A6309039F0ACE05EB1E364C6EE75E323DB154256E7F41BDD95EEB2C') { throw 'Unexpected RC22 installer' }
function Run-Checked($file, [string[]]$switches) {
    $result = Start-Process -FilePath $file -ArgumentList $switches -PassThru -Wait -WindowStyle Hidden
    if ($result.ExitCode -notin @(0,3010)) { throw "$file failed ($($result.ExitCode))" }
}
$oldMsi = Join-Path $qa.FullName 'RC22.msi'
$newMsi = Join-Path $qa.FullName 'candidate.msi'
Run-Checked $rc22 @('--extract-msi',('"' + $oldMsi + '"'))
Run-Checked $setup @('--extract-msi',('"' + $newMsi + '"'))
$msiexec = Join-Path $env:WINDIR 'System32\msiexec.exe'
function Install-Old {
    Write-Host 'Installing the public RC22 fixture in a custom folder.'
    Run-Checked $msiexec @('/i',('"'+$oldMsi+'"'),'/qn','/norestart','ADDLOCAL=Planner',('INSTALLDIR="'+$location+'"'))
}
function Assert-Installed {
    if ((Get-FileHash $asar).Hash -ne $expected.files.'resources/app.asar') {throw 'Installed planner differs from the tested build'}
    if ((Get-Item -LiteralPath $exe).VersionInfo.FileVersion -ne $expected.windows) {throw 'Unexpected executable version'}
    if (Test-Path -LiteralPath $shortcut) {throw 'Shortcut preference was lost'}
    if ((New-Object -ComObject WScript.Shell).CreateShortcut($menu).TargetPath -ne $exe) {throw 'Custom installation folder was lost'}
}
Install-Old
$wizard = Join-Path $PSScriptRoot '..\windows-rc22\wizard-qa.ps1'
& powershell.exe -NoProfile -NonInteractive -STA -File $wizard -SetupFile $setup -Mode Install -Shortcut Off -ExpectedInitial Off -ExpectedFolder $location
if ($LASTEXITCODE -ne 0) {throw 'The one-time RC22 upgrade failed'}
Assert-Installed
Write-Host 'Public RC22 upgraded through the installer wizard, with its original folder and shortcut settings.'
Run-Checked $msiexec @('/x',('"'+$newMsi+'"'),'/qn','/norestart')
Install-Old
& python (Join-Path $PSScriptRoot 'qa-fixture.py') (Join-Path $InputDirectory 'runtime/resources/app.asar') $asar $bundle $setup
if ($LASTEXITCODE -ne 0) {throw 'Could not stage the older updater client'}
$appProcess = Start-Process -FilePath $exe -ArgumentList '--remote-debugging-port=9319' -PassThru -WindowStyle Hidden
& node (Join-Path $PSScriptRoot 'qa-browser.cjs') apply '2.0.0-rc.22'
if ($LASTEXITCODE -ne 0) {
    $trace = Join-Path $OutputDirectory 'qa-transport.log'
    if (Test-Path $trace) {Get-Content -LiteralPath $trace}
    throw 'In-app update failed'
}
if (!$appProcess.WaitForExit(90000)) {throw 'The prior process did not exit'}
$opened = $null
for ($i=0; $i -lt 120 -and !$opened; $i++) {
    Start-Sleep -Seconds 1
    $opened = Get-Process -Name Path -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $exe -and $_.MainWindowHandle -ne 0} | Select-Object -First 1
}
if (!$opened) {throw 'The updated Path did not reopen itself'}
Assert-Installed
$backup = Get-ChildItem -LiteralPath (Join-Path $profile 'updates/backups') -File | Select-Object -First 1
if (!$backup -or (Get-Content -LiteralPath $backup.FullName -Raw) -notmatch 'Synthetic in-app upgrade task') {throw 'Missing saved task in backup'}
[void]$opened.CloseMainWindow()
if (!$opened.WaitForExit(30000)) {throw 'Reopened Path did not close normally'}
$last = Start-Process -FilePath $exe -ArgumentList '--remote-debugging-port=9319' -PassThru -WindowStyle Hidden
& node (Join-Path $PSScriptRoot 'qa-browser.cjs') verify $version
if ($LASTEXITCODE -ne 0) {throw 'Failed to restore the updated profile'}
Write-Host 'PASS: one-time RC22 upgrade, real signed in-app update, automatic restart, profile, backup, custom folder and shortcuts.'
