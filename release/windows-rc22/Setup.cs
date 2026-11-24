using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Path Setup")]
[assembly: AssemblyCompany("Path")]
[assembly: AssemblyProduct("Path")]
[assembly: AssemblyFileVersion("2.0.0.22")]
[assembly: AssemblyVersion("2.0.0.22")]

static class Theme {
    public static readonly Color Ink = Color.FromArgb(17,18,20), Surface = Color.FromArgb(24,25,28),
        Hover = Color.FromArgb(39,40,43), Line = Color.FromArgb(64,65,68), Divider = Color.FromArgb(45,46,49),
        Paper = Color.FromArgb(242,241,236), Muted = Color.FromArgb(175,175,174);
    public static GraphicsPath Rounded(RectangleF b, float radius) {
        var path = new GraphicsPath(); float d = radius * 2;
        path.AddArc(b.X,b.Y,d,d,180,90); path.AddArc(b.Right-d,b.Y,d,d,270,90);
        path.AddArc(b.Right-d,b.Bottom-d,d,d,0,90); path.AddArc(b.X,b.Bottom-d,d,d,90,90);
        path.CloseFigure(); return path;
    }
    public static void Box(Graphics g, RectangleF r, float radius, Color fill, Color edge, float weight) {
        using(var shape=Rounded(r,radius)) using(var brush=new SolidBrush(fill)) using(var pen=new Pen(edge,weight)) {
            g.FillPath(brush,shape); g.DrawPath(pen,shape);
        }
    }
}

sealed class ActionButton : Button {
    readonly bool primary;
    public ActionButton(bool isPrimary) {
        primary=isPrimary; FlatStyle=FlatStyle.Flat; FlatAppearance.BorderSize=0; Cursor=Cursors.Hand;
        UseVisualStyleBackColor=false; ForeColor=primary?Theme.Ink:Theme.Paper;
        BackColor=primary?Theme.Paper:Theme.Surface; Font=new Font("Segoe UI Semibold",10);
        SetStyle(ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true);
    }
    protected override void OnPaint(PaintEventArgs e) {
        var g=e.Graphics; float s=g.DpiX/96f;
        g.Clear(Parent.BackColor); g.SmoothingMode=SmoothingMode.AntiAlias;
        bool over=Enabled && ClientRectangle.Contains(PointToClient(MousePosition));
        Color fill=!Enabled?Theme.Hover:(over?(primary?Color.White:Theme.Hover):BackColor);
        var edge=Focused&&ShowFocusCues?Color.FromArgb(160,173,195):(primary?fill:Theme.Line);
        Theme.Box(g,new RectangleF(s,s,Width-2*s-1,Height-2*s-1),9*s,fill,edge,Focused&&ShowFocusCues?2*s:s);
        var r=ClientRectangle; if(primary)r.Width-=(int)(17*s);
        Color text=Enabled?ForeColor:Theme.Muted;
        TextRenderer.DrawText(g,Text,Font,r,text,TextFormatFlags.HorizontalCenter|TextFormatFlags.VerticalCenter|TextFormatFlags.NoPrefix);
        if(primary && Enabled)using(var pen=new Pen(text,1.55f*s)) {
            float x=Width-23*s,y=Height/2f;
            g.DrawLine(pen,x-6*s,y,x+4*s,y);g.DrawLines(pen,new[]{new PointF(x,y-4*s),new PointF(x+4*s,y),new PointF(x,y+4*s)});
        }
    }
    protected override void OnMouseEnter(EventArgs e){base.OnMouseEnter(e);Invalidate();}
    protected override void OnMouseLeave(EventArgs e){base.OnMouseLeave(e);Invalidate();}
}

sealed class Choice : CheckBox {
    public Choice(){
        AutoSize=false; Cursor=Cursors.Hand; DoubleBuffered=true; ForeColor=Theme.Paper; BackColor=Theme.Surface;
        Font=new Font("Segoe UI",10.5f);
    }
    protected override void OnPaint(PaintEventArgs e) {
        var g=e.Graphics;float s=g.DpiX/96f;g.SmoothingMode=SmoothingMode.AntiAlias;
        bool over=Enabled && ClientRectangle.Contains(PointToClient(MousePosition));
        g.Clear(over?Theme.Hover:BackColor);
        float x=15*s, y=(Height-19*s)/2;
        Color edge=Checked?(Enabled?Theme.Paper:Theme.Muted):Color.FromArgb(135,137,141);
        Theme.Box(g,new RectangleF(x,y,19*s,19*s),5*s,Checked?edge:Theme.Surface,edge,s);
        if(Checked)using(var pen=new Pen(Theme.Ink,1.9f*s)){
            pen.StartCap=pen.EndCap=LineCap.Round;pen.LineJoin=LineJoin.Round;
            g.DrawLines(pen,new[]{new PointF(x+4.5f*s,y+9.7f*s),new PointF(x+8*s,y+13*s),new PointF(x+14.6f*s,y+6.1f*s)});
        }
        var r=new Rectangle((int)(47*s),0,Width-(int)(54*s),Height);
        TextRenderer.DrawText(g,Text,Font,r,Enabled?ForeColor:Theme.Muted,TextFormatFlags.Left|TextFormatFlags.VerticalCenter|TextFormatFlags.NoPrefix);
        if(Focused && ShowFocusCues)ControlPaint.DrawFocusRectangle(g,Rectangle.Inflate(r,-2,-4),Theme.Paper,BackColor);
    }
    protected override void OnMouseEnter(EventArgs e){base.OnMouseEnter(e);Invalidate();}
    protected override void OnMouseLeave(EventArgs e){base.OnMouseLeave(e);Invalidate();}
}

sealed class Frame : Panel {
    public bool Split, Editing;
    public Frame(){DoubleBuffered=true;BackColor=Theme.Surface;TabStop=false;}
    protected override void OnPaint(PaintEventArgs e){
        var g=e.Graphics;float s=g.DpiX/96f;g.Clear(Parent.BackColor);g.SmoothingMode=SmoothingMode.AntiAlias;
        Theme.Box(g,new RectangleF(s/2,s/2,Width-s-1,Height-s-1),9*s,BackColor,Editing&&ContainsFocus?Theme.Muted:Theme.Divider,s);
        if(Split)using(var p=new Pen(Theme.Divider,s))g.DrawLine(p,15*s,Height/2,Width-15*s,Height/2);
    }
}

sealed class Cover : Panel {
    readonly Image mark;
    public Cover(){
        BackColor=Theme.Ink;DoubleBuffered=true;TabStop=false;
        using(var stream=typeof(Cover).Assembly.GetManifestResourceStream("PathMark.png"))
        using(var original=Image.FromStream(stream))mark=new Bitmap(original);
    }
    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e);var g=e.Graphics;float s=g.DpiX/96f;
        g.ScaleTransform(s,s);float right=Width/s;
        g.SmoothingMode=SmoothingMode.AntiAlias;
        // Cropped right angles echo the turns in the supplied Path mark.
        var clip=g.Save();g.SetClip(new RectangleF(right-197,0,197,Height/s-1));
        for(int i=0;i<7;i++){
            float x=right-148+i*16,y=20+i*16;
            using(var pen=new Pen(Color.FromArgb(38+i*3,39+i*3,42+i*3),1.2f))
                g.DrawLines(pen,new[]{new PointF(x-38,151),new PointF(x-38,y+40),new PointF(x+22,y+40),new PointF(x+22,y),new PointF(right+4,y)});
        }
        g.Restore(clip);
        g.InterpolationMode=InterpolationMode.HighQualityBicubic;
        g.DrawImage(mark,26,21,84,84);
        using(var p=new Pen(Theme.Divider))g.DrawLine(p,0,Height/s-1,right,Height/s-1);
    }
    protected override void Dispose(bool disposing){if(disposing)mark.Dispose();base.Dispose(disposing);}
}

partial class Setup : Form {
    const string Expected="MSI_SHA256_PLACEHOLDER", RegistryPath=@"Software\PathYourDay\Preview";
    readonly TextBox folder=new TextBox();
    readonly ActionButton browse=new ActionButton(false), install=new ActionButton(true);
    readonly Choice desktop=new Choice(), launch=new Choice();
    readonly Label status=new Label();
    readonly ProgressBar progress=new ProgressBar();
    readonly bool ru=CultureInfo.CurrentUICulture.TwoLetterISOLanguageName=="ru";
    [DllImport("msi.dll",CharSet=CharSet.Unicode)] static extern int MsiQueryProductState(string productCode);
    readonly bool installed=MsiQueryProductState("{7D593BA1-BC0C-5302-B5AE-1BF189129FCF}")==5;
    bool running;
    string T(string english,string russian){return ru?russian:english;}
    static string ProgramsFolder(){return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs");}
    static string StandardFolder(){return Path.Combine(ProgramsFolder(),"PathYourDay","Path");}
    static string Normalize(string value){
        value=(value??"").Trim();
        if(value.Length<3||value[1]!=':'||!Char.IsLetter(value[0])||(value[2]!='\\'&&value[2]!='/')||value.IndexOfAny(Path.GetInvalidPathChars())>=0||value.IndexOfAny(new[]{'*','?','"'})>=0)
            throw new ArgumentException();
        string full=Path.GetFullPath(value);
        if(String.Equals(full,Path.GetPathRoot(full),StringComparison.OrdinalIgnoreCase))throw new ArgumentException();
        return full.TrimEnd('\\','/');
    }
    static bool IsDesktop(string location){
        foreach(var known in new[]{Environment.SpecialFolder.DesktopDirectory,Environment.SpecialFolder.CommonDesktopDirectory}){
            string path=Environment.GetFolderPath(known,Environment.SpecialFolderOption.DoNotVerify);
            if(!String.IsNullOrEmpty(path) && String.Equals(location,path.TrimEnd('\\','/'),StringComparison.OrdinalIgnoreCase))return true;
        }
        return false;
    }
    static object Setting(string name){
        try {using(var key=Registry.CurrentUser.OpenSubKey(RegistryPath))return key==null?null:key.GetValue(name);}
        catch(System.Security.SecurityException){return null;}catch(UnauthorizedAccessException){return null;}
    }
    static string SavedFolder(){return Setting("InstallDir") as string;}
    static bool DefaultShortcut(){
        return Setting("ShortcutOptions")==null||Setting("DesktopLink")!=null;
    }
    static string DefaultFolder(){
        try{
            var path=Normalize(SavedFolder());
            if(!IsDesktop(path) && !String.Equals(path,Path.Combine(ProgramsFolder(),"Path Preview"),StringComparison.OrdinalIgnoreCase))return path;
        }catch(ArgumentException){}catch(NotSupportedException){}catch(IOException){}
        return StandardFolder();
    }
    static string ShortcutFolder(){
        string saved=Setting("BrandedDesktopFolder") as string;
        if(!String.IsNullOrEmpty(saved))return Normalize(saved);
        string desktop=Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        string dest=desktop;
        int index=1;
        while(File.Exists(Path.Combine(dest,"Path.lnk"))||File.Exists(dest)){
            dest=Path.Combine(desktop,index==1?"Path":"Path ("+index+")");
            index++;
        }
        return dest;
    }
    Label Caption(Control parent,string text,int x,int y,int w,int h,float size,Color color,bool strong){
        var label=new Label {Text=text,ForeColor=color,BackColor=parent.BackColor,AutoSize=false,
            Font=new Font(strong?"Segoe UI Semibold":"Segoe UI",size),TextAlign=ContentAlignment.MiddleLeft,UseMnemonic=false};
        label.SetBounds(x,y,w,h);parent.Controls.Add(label);return label;
    }
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr handle,int attribute,ref int value,int length);
    protected override void OnHandleCreated(EventArgs e){
        base.OnHandleCreated(e);
        if(Environment.OSVersion.Platform==PlatformID.Win32NT){
            int dark=1; DwmSetWindowAttribute(Handle,20,ref dark,4);
        }
    }
    Setup(){
        SuspendLayout();
        AutoScaleDimensions=new SizeF(96,96); AutoScaleMode=AutoScaleMode.Dpi;
        Text=T("Path Setup","Установка Path");
        Icon=Icon.ExtractAssociatedIcon(typeof(Setup).Assembly.Location);
        Font=new Font("Segoe UI",10);BackColor=Theme.Ink;ForeColor=Theme.Paper;
        ClientSize=new Size(632,438);FormBorderStyle=FormBorderStyle.FixedSingle;
        MaximizeBox=false;StartPosition=FormStartPosition.CenterScreen;
        var hero=new Cover();hero.SetBounds(0,0,632,121);Controls.Add(hero);
        Caption(hero,T("Install Path","Установка Path"),115,24,325,49,25,Theme.Paper,true);
        Caption(hero,"2.0.0-rc.22   ·   Windows x64",118,73,311,23,10,Theme.Muted,false);
        Caption(this,T("Installation folder","Папка установки"),32,138,565,23,10.5f,Theme.Paper,true);
        var pathFrame=new Frame {Editing=true};pathFrame.SetBounds(32,169,456,43);Controls.Add(pathFrame);
        folder.BorderStyle=BorderStyle.None;folder.BackColor=Theme.Surface;folder.ForeColor=Theme.Paper;
        folder.SetBounds(13,11,430,23);folder.Text=DefaultFolder();folder.Select(0,0);folder.ReadOnly=installed;
        folder.AccessibleName=T("Installation folder","Папка установки");folder.TabIndex=0;
        folder.Enter+=(s,e)=>pathFrame.Invalidate();folder.Leave+=(s,e)=>pathFrame.Invalidate();pathFrame.Controls.Add(folder);pathFrame.TabIndex=0;
        browse.Text=T("Browse…","Обзор…");browse.SetBounds(497,168,104,45);browse.TabIndex=1;browse.Enabled=!installed;Controls.Add(browse);
        browse.Click+=(s,e)=>{using(var pick=new FolderBrowserDialog()){
            pick.SelectedPath=Directory.Exists(folder.Text)?folder.Text:StandardFolder();
            pick.Description=T("Choose the installation folder","Выбери папку установки");
            if(pick.ShowDialog(this)==DialogResult.OK)ApplyLocation(pick.SelectedPath);
        }};
        Caption(this,T("After installation","После установки"),32,229,565,23,10.5f,Theme.Paper,true);
        var choices=new Frame {Split=true};choices.SetBounds(32,259,568,84);choices.TabIndex=2;Controls.Add(choices);
        desktop.Text=T("Create a desktop shortcut","Создать ярлык на рабочем столе");desktop.Checked=DefaultShortcut();desktop.TabIndex=0;
        launch.Text=T("Open Path after installation","Открыть Path после установки");launch.Checked=true;launch.TabIndex=1;
        desktop.SetBounds(2,3,564,38);launch.SetBounds(2,43,564,38);choices.Controls.AddRange(new Control[]{desktop,launch});
        var foot=new Panel{BackColor=Theme.Divider};foot.SetBounds(0,366,632,1);Controls.Add(foot);
        status.SetBounds(32,375,374,51);status.Font=new Font("Segoe UI",9.5f);status.ForeColor=Theme.Muted;
        status.TextAlign=ContentAlignment.MiddleLeft;status.UseMnemonic=false;status.AccessibleRole=AccessibleRole.StaticText;Controls.Add(status);
        try{if(IsDesktop(Normalize(SavedFolder())))ShowDesktopNotice();}catch(ArgumentException){}catch(NotSupportedException){}catch(IOException){}
        progress.SetBounds(33,422,302,3);progress.Style=ProgressBarStyle.Marquee;progress.MarqueeAnimationSpeed=28;progress.Visible=false;Controls.Add(progress);
        install.Text=installed?T("Apply","Применить"):T("Install","Установить");install.SetBounds(429,381,172,44);install.TabIndex=3;Controls.Add(install);AcceptButton=install;
        install.Click+=(s,e)=>BeginInstall();FormClosing+=(s,e)=>{if(running)e.Cancel=true;};
        Shown+=(s,e)=>install.Focus();
        ResumeLayout(true);
    }
    void ShowDesktopNotice(){
        status.Text=T("Path will use its own folder. Your desktop is for the shortcut.","Path установится в отдельную папку. На рабочем столе можно оставить ярлык.");
    }
    bool ApplyLocation(string value){
        try{
            string path=Normalize(value);
            if(IsDesktop(path)){folder.Text=StandardFolder();ShowDesktopNotice();}
            else {folder.Text=path;status.Text="";}
            return true;
        }catch(Exception err){
            if(!(err is ArgumentException||err is IOException||err is NotSupportedException))throw;
            status.Text=T("Choose a local folder, such as the suggested installation folder.","Выбери папку на локальном диске, например предложенную папку установки.");return false;
        }
    }
    static void Extract(string target){
        using(var output=new FileStream(target,FileMode.CreateNew,FileAccess.Write,FileShare.None))
        using(var input=typeof(Setup).Assembly.GetManifestResourceStream("PathPreview.msi"))input.CopyTo(output);
        using(var h=SHA256.Create())using(var f=File.OpenRead(target))
            if(BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant()!=Expected)throw new InvalidDataException("MSI checksum mismatch.");
    }
    static int InstallPackage(string location, bool makeLink, string linkFolder, bool repair){
        string temp=Path.Combine(Path.GetTempPath(),"PathPreview-"+Guid.NewGuid().ToString("N"));
        string msi=Path.Combine(temp,"PathPreview.msi");
        try{
            Directory.CreateDirectory(temp);Extract(msi);
            string features="ADDLOCAL=Planner";
            if(makeLink)features+=",DesktopShortcut PATHLINKDIR=\""+linkFolder+"\"";
            else if(repair)features+=" REMOVE=DesktopShortcut";
            var start=new ProcessStartInfo(Path.Combine(Environment.SystemDirectory,"msiexec.exe"),
                "/i \""+msi+"\" /qn /norestart "+features+" INSTALLDIR=\""+location+"\""){UseShellExecute=false};
            using(var p=Process.Start(start)){p.WaitForExit();return p.ExitCode;}
        }
        finally{try{if(File.Exists(msi))File.Delete(msi);if(Directory.Exists(temp))Directory.Delete(temp,false);}catch(IOException){}catch(UnauthorizedAccessException){}}
    }
    void BeginInstall(){
        if(running||!ApplyLocation(folder.Text))return;
        string location=folder.Text;bool makeLink=desktop.Checked,open=launch.Checked;
        string linkFolder=makeLink?ShortcutFolder():null;
        running=true;folder.Enabled=browse.Enabled=desktop.Enabled=launch.Enabled=install.Enabled=false;
        progress.Visible=true;status.Text=T("Installing Path…","Идёт установка Path…");
        var worker=new Thread(()=>{
            int code=-1;string problem=null;
            try{code=InstallPackage(location,makeLink,linkFolder,installed);}
            catch(Exception err){problem=err.Message;}
            BeginInvoke((MethodInvoker)delegate{
                running=false;progress.Visible=false;
                if(code==0||code==3010){
                    string exe=Path.Combine(DefaultFolder(),"Path.exe");
                    if(open)try{Process.Start(new ProcessStartInfo(exe){WorkingDirectory=Path.GetDirectoryName(exe),UseShellExecute=true});}
                    catch(Exception err){MessageBox.Show(this,err.Message,Text,MessageBoxButtons.OK,MessageBoxIcon.Information);}
                    Close();
                }else{
                    status.Text=problem??(T("Installation could not finish. Windows Installer code ","Не удалось завершить установку. Код Windows Installer ")+code+".");
                    folder.Enabled=desktop.Enabled=launch.Enabled=install.Enabled=true;browse.Enabled=!installed;
                }
            });
        });worker.IsBackground=true;worker.Start();
    }
    [STAThread]static int Main(string[] args){
        if(args.Length==2 && args[0]=="--extract-msi"){try{Extract(Path.GetFullPath(args[1]));return 0;}catch{return 1;}}
#if PATH_APP_UPDATE
        if(args.Length>0 && args[0]=="--apply-path-update")return ApplyInAppUpdate(args);
#endif
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Application.Run(new Setup());return 0;
    }
}
