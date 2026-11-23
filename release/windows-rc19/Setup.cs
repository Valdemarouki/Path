using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;
[assembly: AssemblyTitle("Path Preview Setup")]
[assembly: AssemblyCompany("Path")]
[assembly: AssemblyProduct("Path Preview")]
[assembly: AssemblyFileVersion("2.0.0.19")]
[assembly: AssemblyVersion("2.0.0.19")]
class Setup : Form {
    const string Expected = "MSI_SHA256_PLACEHOLDER";
    readonly TextBox folder = new TextBox();
    readonly Button select = new Button(), install = new Button();
    readonly CheckBox launch = new CheckBox();
    readonly Label status = new Label();
    readonly bool ru = System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "ru";
    bool running;
    string T(string en, string russian) { return ru ? russian : en; }
    static string DefaultFolder() {
        string saved;
        using(var key=Registry.CurrentUser.OpenSubKey(@"Software\PathYourDay\Preview"))
            saved=key==null?null:key.GetValue("InstallDir") as string;
        return !String.IsNullOrEmpty(saved) && Path.IsPathRooted(saved) ? saved : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","Path Preview");
    }
    Setup() {
        Text="Path Preview"; Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        Font=new Font("Segoe UI",10); BackColor=Color.FromArgb(23,23,25); ForeColor=Color.WhiteSmoke;
        ClientSize=new Size(510,247); FormBorderStyle=FormBorderStyle.FixedDialog; MaximizeBox=false; StartPosition=FormStartPosition.CenterScreen;
        Label title=new Label {Text="Path Preview",Font=new Font("Segoe UI",23), AutoSize=true,Left=22,Top=15};
        Label desc=new Label {Text=T("Installation folder","Папка установки"),AutoSize=true,Left=25,Top=83};
        folder.SetBounds(25,107,372,30); folder.Text=DefaultFolder();
        select.SetBounds(404,105,82,32); select.Text=T("Browse…","Обзор…");
        select.Click+=(s,e)=>{ using(var pick=new FolderBrowserDialog()) {pick.SelectedPath=folder.Text; if(pick.ShowDialog(this)==DialogResult.OK)folder.Text=pick.SelectedPath;}};
        launch.SetBounds(25,146,460,24); launch.Text=T("Open Path after installation","Открыть Path после установки"); launch.Checked=true;
        status.SetBounds(25,188,297,44);
        install.SetBounds(330,184,155,40); install.Text=T("Install","Установить"); install.BackColor=Color.WhiteSmoke;install.ForeColor=Color.Black;install.FlatStyle=FlatStyle.Flat;
        select.ForeColor=Color.Black;select.BackColor=Color.WhiteSmoke;
        Controls.AddRange(new Control[]{title,desc,folder,select,launch,status,install});
        install.Click+=(s,e)=>BeginInstall(); FormClosing+=(s,e)=>{if(running)e.Cancel=true;};
    }
    static void Extract(string target) {
        using(var output=new FileStream(target,FileMode.CreateNew,FileAccess.Write,FileShare.None))
        using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream("PathPreview.msi")) {input.CopyTo(output);}
        using(var h=SHA256.Create()) using(var f=File.OpenRead(target)) {
            if(BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant()!=Expected)throw new InvalidDataException("Installer integrity check failed.");
        }
    }
    void BeginInstall() {
        string location;
        try {
            location=Path.GetFullPath(folder.Text.Trim()).TrimEnd(Path.DirectorySeparatorChar);
            if (!Path.IsPathRooted(folder.Text) || location.IndexOf('"')>=0 || location.Length<4 || Path.GetPathRoot(location)==location ||
                location.EndsWith(":") || location.StartsWith(@"\\"))throw new ArgumentException(T("Choose a local installation folder.","Выбери локальную папку установки."));
        } catch(Exception err){status.Text=err.Message;return;}
        running=true; folder.Enabled=select.Enabled=install.Enabled=launch.Enabled=false;
        status.Text=T("Installing Path…","Идёт установка Path…");
        var worker=new Thread(()=>{
            int code=-1; string problem=null; string temp=Path.Combine(Path.GetTempPath(),"PathPreview-"+Guid.NewGuid().ToString("N"));
            string msi=Path.Combine(temp,"PathPreview.msi");
            try {
                Directory.CreateDirectory(temp);Extract(msi);
                using(var p=Process.Start(new ProcessStartInfo(Path.Combine(Environment.SystemDirectory,"msiexec.exe"),
                    "/i \""+msi+"\" /passive /norestart INSTALLDIR=\""+location+"\"") {UseShellExecute=false})) {p.WaitForExit();code=p.ExitCode;}
            } catch(Exception err){ problem=err.Message; }
            finally {try{if(File.Exists(msi))File.Delete(msi);if(Directory.Exists(temp))Directory.Delete(temp,false);}catch(IOException){}}
            BeginInvoke((MethodInvoker)delegate {
                running=false;
                if(code==0 || code==3010) {
                    string exe=Path.Combine(location,"Path.exe");
                    if(!File.Exists(exe))exe=Path.Combine(DefaultFolder(),"Path.exe");
                    if(launch.Checked && File.Exists(exe)) {try{Process.Start(new ProcessStartInfo(exe){WorkingDirectory=Path.GetDirectoryName(exe),UseShellExecute=true});}catch(Exception err){MessageBox.Show(err.Message);}}
                    Close();
                } else {
                    status.Text=problem??(T("Windows Installer returned ","Код Windows Installer ")+code);
                    folder.Enabled=select.Enabled=install.Enabled=launch.Enabled=true;
                }
            });
        }); worker.IsBackground=true;worker.Start();
    }
    [STAThread] static int Main(string[] args) {
        if(args.Length==2 && args[0]=="--extract-msi") {try{Extract(Path.GetFullPath(args[1]));return 0;}catch{return 1;}}
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false); Application.Run(new Setup()); return 0;
    }
}
