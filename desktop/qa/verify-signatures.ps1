param([Parameter(Mandatory=$true)][string]$Installer,[Parameter(Mandatory=$true)][string]$InstalledDirectory,[Parameter(Mandatory=$true)][string]$ExpectedPublisher)
$ErrorActionPreference='Stop'
if(!(Test-Path -LiteralPath $Installer -PathType Leaf)){throw 'Installer file is missing'}
if(!(Test-Path -LiteralPath $InstalledDirectory -PathType Container)){throw 'Installed application directory is missing'}
if([string]::IsNullOrWhiteSpace($ExpectedPublisher)){throw 'Expected publisher is required'}
foreach($name in @('Path 2.0.exe','Uninstall Path 2.0.exe')){
 if(!(Test-Path -LiteralPath (Join-Path $InstalledDirectory $name) -PathType Leaf)){throw "Required installed executable is missing: $name"}
}
$files=@(Get-Item -LiteralPath $Installer)+@(Get-ChildItem -LiteralPath $InstalledDirectory -Recurse -File | Where-Object {$_.Extension -in '.exe','.dll','.node'})
foreach($file in $files){
 $sig=Get-AuthenticodeSignature -LiteralPath $file.FullName
 if($sig.Status -ne 'Valid'){throw "Invalid signature: $($file.FullName): $($sig.Status)"}
 if($file.Name -in 'Path 2.0.exe','Uninstall Path 2.0.exe' -or $file.FullName -eq (Get-Item -LiteralPath $Installer).FullName){
  if($sig.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -ne $ExpectedPublisher){throw "Unexpected publisher: $($file.FullName)"}
  if(!$sig.TimeStamperCertificate){throw "Missing timestamp: $($file.FullName)"}
 }
}
'PASS Authenticode signatures, Path publisher and timestamps'
