# Run ONLY inside a disposable Windows Sandbox/VM. Never runs against an existing profile.
param([Parameter(Mandatory=$true)][string]$PreviousInstaller,[Parameter(Mandatory=$true)][string]$NewInstaller,[switch]$DisposableVM)
$ErrorActionPreference='Stop'
if($env:USERNAME -ne 'WDAGUtilityAccount' -and !$DisposableVM){throw 'Use Windows Sandbox or explicitly confirm a disposable VM with -DisposableVM.'}
$profile=Join-Path $env:APPDATA 'Path-Paperclip-Test'
if(Test-Path -LiteralPath $profile){throw 'Existing Path 2.0 data found. Use a fresh disposable Windows account; nothing was changed.'}
$existing=@(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName -eq 'Path 2.0'})
if($existing.Count -gt 0){throw 'An installed Path 2.0 was found. Use a fresh disposable Windows account; nothing was changed.'}
if(Get-Process -Name 'Path 2.0' -ErrorAction SilentlyContinue){throw 'Path is running. Use a fresh disposable VM.'}
if(!(Test-Path -LiteralPath $PreviousInstaller -PathType Leaf) -or !(Test-Path -LiteralPath $NewInstaller -PathType Leaf)){throw 'Both installer files are required.'}
if((Get-FileHash -LiteralPath $PreviousInstaller).Hash -eq (Get-FileHash -LiteralPath $NewInstaller).Hash){throw 'Choose two different installer versions for the upgrade test.'}
$results=[System.Collections.Generic.List[object]]::new()
function Install([string]$file){$p=Start-Process -FilePath (Resolve-Path -LiteralPath $file) -ArgumentList '/S','/currentuser' -Wait -PassThru;if($p.ExitCode -ne 0){throw "Installer exit code $($p.ExitCode)"}}
function InstalledPath{
 $entry=Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object {$_.DisplayName -eq 'Path 2.0'}
 if(@($entry).Count -ne 1){throw 'Expected one Path 2.0 uninstall entry'}
 return $entry.InstallLocation
}
function HashProfile{
 if(!(Test-Path -LiteralPath $profile)){throw 'Profile missing'}
 $rows=Get-ChildItem -LiteralPath $profile -Recurse -File | Sort-Object FullName | ForEach-Object { $_.FullName.Substring($profile.Length)+':'+(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
 return ($rows -join "`n")
}
try{
 Install $PreviousInstaller
 $directory=InstalledPath
 if(!(Test-Path -LiteralPath (Join-Path $directory 'Path 2.0.exe'))){throw 'Application executable missing'}
 $results.Add(@{scenario='clean installation';status='PASS'})
 New-Item -Path $profile -ItemType Directory | Out-Null
 # Canary verifies installer ownership boundaries, not Chromium's runtime writes.
 Set-Content -LiteralPath (Join-Path $profile 'installer-canary.json') -Encoding utf8 -Value '{"title":"Тест España Polska","language":"ru","keep":true}'
 $before=HashProfile
 Install $PreviousInstaller
 if((HashProfile) -ne $before){throw 'Reinstall changed profile'}
 $results.Add(@{scenario='same-version reinstall + data canary';status='PASS'})
 Install $NewInstaller
 if((HashProfile) -ne $before){throw 'Upgrade changed profile'}
 $directory=InstalledPath
 $results.Add(@{scenario='upgrade + data canary';status='PASS'})
 $uninstall=Join-Path $directory 'Uninstall Path 2.0.exe'
 # _?= disables NSIS's temporary-process handoff so -Wait observes actual completion.
 $p=Start-Process -FilePath $uninstall -ArgumentList "/S _?=$directory" -Wait -PassThru
 if($p.ExitCode -ne 0){throw "Uninstaller exit code $($p.ExitCode)"}
 if(Test-Path -LiteralPath (Join-Path $directory 'Path 2.0.exe')){throw 'App remains after uninstall'}
 if((HashProfile) -ne $before){throw 'Uninstall changed profile'}
 $results.Add(@{scenario='uninstall + retained data canary';status='PASS'})
 Install $NewInstaller
 if((HashProfile) -ne $before){throw 'Install after uninstall changed profile'}
 $results.Add(@{scenario='install after uninstall';status='PASS'})
}catch{$results.Add(@{scenario='failure';status='FAIL';reason=$_.Exception.Message});throw}
finally{$results | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 -LiteralPath (Join-Path $env:TEMP 'Path-installer-QA.json');$results | Format-Table}
