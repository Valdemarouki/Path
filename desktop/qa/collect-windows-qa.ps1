# Read-only diagnostics. Does not launch/install/uninstall Path or read user content.
param([string]$Installer,[string]$OutputFile)
$ErrorActionPreference='Stop'
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'review-manifest.json') -Raw | ConvertFrom-Json
if(!$Installer){$Installer=Join-Path $PSScriptRoot $manifest.installer}
if(!$OutputFile){$OutputFile=Join-Path $PSScriptRoot 'Path-Windows-QA-result.json'}
$result=[ordered]@{
 format='path-windows-qa';version=1;collectedUtc=[DateTime]::UtcNow.ToString('o')
 osVersion=[Environment]::OSVersion.Version.ToString();os64Bit=[Environment]::Is64BitOperatingSystem
 expectedBuild=$manifest.version;installer=@{status='NOT_CHECKED'};installed=@{status='NOT_CHECKED'}
 manualTests=@{installation='NOT_RUN';update='NOT_RUN';uninstallDataRetention='NOT_RUN';windowControls='NOT_RUN';clipboardImages='NOT_RUN';backupRestore='NOT_RUN';visualMotion='NOT_RUN'}
}
try{
 if(Test-Path -LiteralPath $Installer -PathType Leaf){
  $file=Get-Item -LiteralPath $Installer;$hash=(Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
  $sig=Get-AuthenticodeSignature -LiteralPath $Installer
  $result.installer=@{status=$(if($hash -eq $manifest.sha256){'HASH_MATCH'}else{'HASH_MISMATCH'});sha256=$hash;bytes=$file.Length;fileVersion=$file.VersionInfo.FileVersion;signatureStatus=$sig.Status.ToString()}
 }else{$result.installer=@{status='NOT_FOUND'}}
 $entries=@(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName -eq 'Path 2.0'})
 if($entries.Count -eq 1 -and $entries[0].InstallLocation){
  $appFile=Join-Path $entries[0].InstallLocation 'Path 2.0.exe'
  $exists=Test-Path -LiteralPath $appFile -PathType Leaf
  $result.installed=@{status=$(if($exists){'FOUND'}else{'EXECUTABLE_MISSING'});registeredVersion=$entries[0].DisplayVersion;profileExists=(Test-Path -LiteralPath (Join-Path $env:APPDATA 'Path-Paperclip-Test'));running=(@(Get-Process -Name 'Path 2.0' -ErrorAction SilentlyContinue).Count -gt 0)}
  if($exists){$result.installed.fileVersion=(Get-Item -LiteralPath $appFile).VersionInfo.FileVersion;$result.installed.signatureStatus=(Get-AuthenticodeSignature -LiteralPath $appFile).Status.ToString()}
 }elseif($entries.Count -gt 1){$result.installed=@{status='MULTIPLE_ENTRIES';count=$entries.Count}}else{$result.installed=@{status='NOT_INSTALLED'}}
}catch{
 # Avoid recording exception text: it can contain user names or private filesystem paths.
 $result.error=@{type=$_.Exception.GetType().Name;stage='diagnostics'}
}
$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputFile -Encoding UTF8
Write-Host 'Diagnostic report written. No installation or application content was accessed.'
Write-Host 'Manual tests are NOT_RUN until you perform them. An unsigned test build is not a trusted release.'
