param(
    [Parameter(Mandatory)][string]$SetupFile,
    [ValidateSet('Preview','Install')][string]$Mode='Preview',
    [string]$OutputImage, [string]$Folder, [string]$ExpectedFolder,
    [ValidateSet('On','Off')][string]$Shortcut='On',
    [ValidateSet('On','Off')][string]$ExpectedInitial='On',
    [ValidateSet('en-US','ru-RU')][string]$Language='en-US'
)
$ErrorActionPreference='Stop'
if ($Mode -eq 'Install' -and ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows')) {
    throw 'Live installation QA requires the disposable Windows runner.'
}
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
[Threading.Thread]::CurrentThread.CurrentUICulture=[Globalization.CultureInfo]::GetCultureInfo($Language)
[Windows.Forms.Application]::EnableVisualStyles()
$type=[Reflection.Assembly]::LoadFrom((Resolve-Path -LiteralPath $SetupFile).Path).GetType('Setup',$true)
$form=[Activator]::CreateInstance($type,$true)
$flags=[Reflection.BindingFlags]'Instance,NonPublic'
function Control([string]$name){ $type.GetField($name,$flags).GetValue($form) }
try{
    $form.ShowInTaskbar=$false
    $form.Opacity=0
    $form.Show()
    [Windows.Forms.Application]::DoEvents()
    $pathBox=Control 'folder'
    $choice=Control 'desktop'
    $open=Control 'launch'
    if ($ExpectedFolder -and $pathBox.Text.TrimEnd('\') -ne $ExpectedFolder.TrimEnd('\')) {
        throw "Wrong initial folder: $($pathBox.Text)"
    }
    if ($choice.Checked -ne ($ExpectedInitial -eq 'On')) {throw 'Incorrect initial desktop shortcut preference.'}
    if (-not $open.Checked) {throw 'The launch option is unavailable.'}
    if ($Mode -eq 'Preview'){
        if($OutputImage) {
            $rect=$form.RectangleToScreen($form.ClientRectangle)
            $bmp=[Drawing.Bitmap]::new($form.Width,$form.Height)
            try {
                $form.DrawToBitmap($bmp,[Drawing.Rectangle]::new(0,0,$form.Width,$form.Height))
                $bounds=[Drawing.Rectangle]::new($rect.X-$form.Left,$rect.Y-$form.Top,$rect.Width,$rect.Height)
                $client=$bmp.Clone($bounds,$bmp.PixelFormat)
                try{$client.Save([IO.Path]::GetFullPath($OutputImage),[Drawing.Imaging.ImageFormat]::Png)}finally{$client.Dispose()}
            }finally{$bmp.Dispose()}
        }
        return
    }
    if ($Folder) {$pathBox.Text=$Folder}
    $open.Checked=$false
    $choice.Checked=($Shortcut -eq 'On')
    $button=Control 'install'
    $button.PerformClick()
    $timer=[Diagnostics.Stopwatch]::StartNew()
    while(-not $form.IsDisposed -and $timer.Elapsed.TotalSeconds -lt 180){
        [Windows.Forms.Application]::DoEvents()
        if(-not $form.IsDisposed -and $button.Enabled){throw ("Wizard failed: "+(Control 'status').Text)}
        Start-Sleep -Milliseconds 40
    }
    if(-not $form.IsDisposed){throw 'Wizard installation timeout.'}
    "PASS: installation via the actual wizard, desktop shortcut $Shortcut"
}finally{if(-not $form.IsDisposed){$form.Dispose()}}
