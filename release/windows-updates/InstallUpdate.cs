using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Windows.Forms;

partial class Setup {
    static int ApplyInAppUpdate(string[] args) {
        int pid;
        if(args.Length!=2 || !Int32.TryParse(args[1],out pid) || pid<=0)return 87;
        string exe=null;
        bool stopped=false;
        try {
            // Use the installation registered by this per-user MSI, including a custom directory.
            string folder=Normalize(SavedFolder());
            exe=Path.Combine(folder,"Path.exe");
            if(IsDesktop(folder) || !File.Exists(exe))throw new InvalidOperationException("Path installation was not found.");
            Process previous=null;
            try{ previous=Process.GetProcessById(pid); }catch(ArgumentException){}
            if(previous!=null)using(previous){
                try {
                    if(!previous.HasExited && !String.Equals(Path.GetFullPath(previous.MainModule.FileName),exe,StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("The running application does not match the installation.");
                }catch(InvalidOperationException){if(!previous.HasExited)throw;}
                catch(System.ComponentModel.Win32Exception){if(!previous.HasExited)throw;}
                if(!previous.WaitForExit(90000))throw new TimeoutException("Path is still running.");
            }
            stopped=true;
            bool shortcut=DefaultShortcut();
            int result=InstallPackage(folder,shortcut,shortcut?ShortcutFolder():null,false);
            if(result!=0 && result!=3010)throw new InvalidOperationException("Windows Installer ("+result+").");
            return result;
        }catch(Exception error){
            string message=CultureInfo.CurrentUICulture.TwoLetterISOLanguageName=="ru"
                ?"Не удалось завершить обновление Path.":"Path could not finish updating.";
            MessageBox.Show(message+Environment.NewLine+error.Message,"Path",MessageBoxButtons.OK,MessageBoxIcon.Warning);
            return 1;
        }finally{
            if(stopped && File.Exists(exe)){
                try{Process.Start(new ProcessStartInfo(exe){WorkingDirectory=Path.GetDirectoryName(exe),UseShellExecute=false});}
                catch(Exception error){MessageBox.Show(error.Message,"Path",MessageBoxButtons.OK,MessageBoxIcon.Warning);}
            }
        }
    }
}
