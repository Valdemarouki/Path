import argparse
import json
import ctypes as c
import hashlib
import os
import re
import shutil
import subprocess
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('runtime', type=Path)
parser.add_argument('assets', type=Path)
parser.add_argument('out', type=Path)
args = parser.parse_args()
APP, ASSETS, OUT = (p.resolve() for p in (args.runtime, args.assets, args.out))
OUT.mkdir(parents=True, exist_ok=True)
STAGE = OUT / "msi-build"
STAGE.mkdir(exist_ok=True)
EXPECTED = "5b9fdd2f32a1b9fcafbaac002b3d558141bcb9a07f53065d7ecc0d3438f1c04a"
PROD = "{7D593BA1-BC0C-5302-B5AE-1BF189129FCF}"
UPGRADE = "{7CC14C34-854D-4879-9BC2-8F1DBB05CC82}"
NS = uuid.UUID("ae05d365-042e-4951-87c6-78d139bdbe8a")
def guid(label): return "{"+str(uuid.uuid5(NS,label)).upper()+"}"
def digest(p):
    with p.open("rb") as f: return hashlib.file_digest(f,"sha256").hexdigest()
assert digest(APP/"resources/app.asar") == EXPECTED

basefiles = sorted(p for p in APP.rglob("*") if p.is_file())
names = {p:p.relative_to(APP).as_posix() for p in basefiles}
assert all(not p.is_symlink() and p.resolve().is_relative_to(APP.resolve()) for p in basefiles)
assert {rel:digest(p) for p,rel in names.items()} == json.loads((HERE/"files.json").read_text()), "Runtime differs from the release manifest"
dirs={"":"INSTALLDIR"}
for name in names.values():
    parent=Path(name).parent
    if parent!=Path("."): dirs[parent.as_posix()] = "D"+hashlib.sha1(parent.as_posix().encode()).hexdigest()[:14]
entries=[(f"F{i:03d}", f"C{i:03d}", p, names[p]) for i,p in enumerate(basefiles,1)]
ddf=STAGE/"payload.ddf"
ddf.write_text('\n'.join(['.OPTION EXPLICIT','.Set Cabinet=ON','.Set Compress=ON','.Set CompressionType=MSZIP',
                           '.Set CabinetNameTemplate=payload.cab','.Set MaxDiskSize=0','.Set MaxCabinetSize=0',
                           f'.Set DiskDirectoryTemplate="{STAGE}"']+[f'"{p}" {fid}' for fid,_,p,_ in entries]),encoding='ascii')
subprocess.run(['makecab.exe','/V0','/F',str(ddf)],cwd=STAGE,check=True,stdout=subprocess.DEVNULL)

msi=c.WinDLL('msi'); W=c.c_wchar_p; I=c.c_uint; H=c.c_uint; P=c.POINTER(H)
def api(name,signature):
    f=getattr(msi,name); f.argtypes=signature; f.restype=I; return f
def ok(code,what):
    if code: raise OSError(code,what)
open_db=api('MsiOpenDatabaseW',[W,c.c_void_p,P])
import_idt=api('MsiDatabaseImportW',[H,W,W])
view=api('MsiDatabaseOpenViewW',[H,W,P]);execute=api('MsiViewExecute',[H,H])
close=api('MsiCloseHandle',[H]); create=api('MsiCreateRecord',[I])
string=api('MsiRecordSetStringW',[H,I,W]);stream=api('MsiRecordSetStreamW',[H,I,W])
commit=api('MsiDatabaseCommit',[H])
summary=api('MsiGetSummaryInformationW',[H,W,I,P])
set_prop=api('MsiSummaryInfoSetPropertyW',[H,I,I,c.c_int,c.c_void_p,W])
persist=api('MsiSummaryInfoPersist',[H])
package=STAGE/'PathPreview.msi'
if package.exists(): package.unlink()
db=H();ok(open_db(str(package),3,c.byref(db)),'create MSI')
def table(name,columns,types,keys,rows):
    rows = [columns.split(),types.split(),[name]+keys.split()]+list(rows)
    (STAGE/(name+'.idt')).write_bytes(('\r\n'.join('\t'.join(str(cell) if cell is not None else '' for cell in r) for r in rows)+'\r\n').encode('ascii'))
    ok(import_idt(db,str(STAGE),name+'.idt'),name)
def attachment(table_name,key_column,key,data):
    v=H()
    ok(view(db,f"INSERT INTO `{table_name}` (`{key_column}`, `Data`) VALUES (?, ?)",c.byref(v)),table_name)
    rec=create(2); ok(string(rec,1,key),key); ok(stream(rec,2,str(data)),str(data)); ok(execute(v,rec),key);close(rec);close(v)
def shortname(name,number):
    if re.fullmatch(r'[a-zA-Z0-9_-]{1,8}(\.[a-zA-Z0-9_]{1,3})?',name): return name
    ext=Path(name).suffix.lstrip('.')[:3].upper()
    return f'P{number:06d}'+(('.'+ext) if ext else '')+'|'+name

table('Property','Property Value','s72 l0','Property',[
    ('ProductCode',PROD),('ProductName','Path'),('ProductLanguage','1033'),('ProductVersion','2.0.22'),
    ('Manufacturer','Path'),('UpgradeCode',UPGRADE),('ARPPRODUCTICON','Path.ico'),('ARPNOMODIFY','1'),
    ('MSIDISABLERMRESTART','1'),('MSPLATFORM','x64'),('SecureCustomProperties','PREVIOUSPATH;NEWERPATH')])
dirrows=[('TARGETDIR',None,'SourceDir'),('LocalAppDataFolder','TARGETDIR','.'),('PreviewPrograms','LocalAppDataFolder','Programs'),
         ('PublisherFolder','PreviewPrograms','PATHYO~1|PathYourDay'),('INSTALLDIR','PublisherFolder','Path'),
         ('ProgramMenuFolder','TARGETDIR','.'),('PathMenu','ProgramMenuFolder','Path'),
         ('DesktopFolder','TARGETDIR','.'),('PATHLINKDIR','DesktopFolder','.')]
for name,d in dirs.items():
    if name:
        parent=Path(name).parent
        dirrows.append((d,dirs['' if parent==Path('.') else parent.as_posix()],Path(name).name))
table('Directory','Directory Directory_Parent DefaultDir','s72 S72 l255','Directory',dirrows)
comps=[]; files=[]
for i,(fid,cid,p,name) in enumerate(entries,1):
    parent=Path(name).parent
    comps.append((cid,guid(name),dirs['' if parent==Path('.') else parent.as_posix()],256,None,fid))
    files.append((fid,cid,shortname(p.name,i),p.stat().st_size,None,None,16384,i))
comps.append(('UserRegistration',guid('preview-user-registry'),'INSTALLDIR',260,None,'InstallPath'))
comps.append(('DesktopLink',guid('path-named-desktop-link'),'PATHLINKDIR',260,None,'DesktopLinkFlag'))
table('Component','Component ComponentId Directory_ Attributes Condition KeyPath','s72 S38 s72 i2 S255 S72','Component',comps)
table('Feature','Feature Feature_Parent Title Description Display Level Directory_ Attributes','s38 S38 L64 L255 I2 i2 S72 i2','Feature',[
    ('Planner',None,'Path','Windows personal planner',1,1,'INSTALLDIR',0),
    ('DesktopShortcut',None,'Desktop shortcut','Create a Path desktop shortcut',2,2,None,0)])
table('FeatureComponents','Feature_ Component_','s38 s72','Feature_ Component_',[
    ('DesktopShortcut' if row[0]=='DesktopLink' else 'Planner',row[0]) for row in comps])
table('File','File Component_ FileName FileSize Version Language Attributes Sequence','s72 s72 l255 i4 S72 S20 I2 i2','File',files)
table('Media','DiskId LastSequence DiskPrompt Cabinet VolumeLabel Source','i2 i2 L64 S255 S32 S72','DiskId',[(1,len(files),None,'#payload.cab',None,None)])
registry = r'Software\PathYourDay\Preview'
table('RegLocator','Signature_ Root Key Name Type','s72 i2 s255 S255 I2','Signature_',[
    ('SavedDesktopDir',1,registry,'BrandedDesktopFolder',18)])
table('AppSearch','Property Signature_','s72 s72','Property Signature_',[('PATHLINKDIR','SavedDesktopDir')])
table('Registry','Registry Root Key Name Value Component_','s72 i2 l255 L255 L0 s72','Registry',[
    ('InstallPath',1,registry,'InstallDir','[INSTALLDIR]','UserRegistration'),
    ('ShortcutOptions',1,registry,'ShortcutOptions','#1','UserRegistration'),
    ('DesktopLinkFlag',1,registry,'DesktopLink','#1','DesktopLink'),
    ('DesktopLinkDirectory',1,registry,'BrandedDesktopFolder','[PATHLINKDIR]','DesktopLink')])
table('Shortcut','Shortcut Directory_ Name Component_ Target Arguments Description Hotkey Icon_ IconIndex ShowCmd WkDir','s72 s72 l128 s72 s255 S255 L255 I2 S72 I2 I2 S72','Shortcut',[
    (name,folder,'Path',component,'[#'+next(fid for fid,_,_,rel in entries if rel=='Path.exe')+']',None,'Path',None,'Path.ico',0,1,'INSTALLDIR')
    for name,folder,component in [('StartMenu','PathMenu','UserRegistration'),('Desktop','PATHLINKDIR','DesktopLink')]])
table('RemoveFile','FileKey Component_ FileName DirProperty InstallMode','s72 s72 L255 s72 i2','FileKey',[
    ('RemovePathMenu','UserRegistration',None,'PathMenu',2)])
table('Icon','Name Data','s72 v0','Name',[])
attachment('Icon','Name','Path.ico',ASSETS/'path.ico')
attachment('_Streams','Name','payload.cab',STAGE/'payload.cab')
table('Upgrade','UpgradeCode VersionMin VersionMax Language Attributes Remove ActionProperty','s38 S20 S20 S255 i4 S255 s72','UpgradeCode VersionMin VersionMax Language Attributes',[(UPGRADE,None,'2.0.22',None,512,None,'PREVIOUSPATH'),(UPGRADE,'2.0.22',None,None,2,None,'NEWERPATH')])
table('LaunchCondition','Condition Description','s255 l255','Condition',[('Installed OR VersionNT64','A 64-bit version of Windows is required.'),('NOT NEWERPATH','A newer version of Path is installed.'),
    ('Installed OR NOT (INSTALLDIR ~= DesktopFolder)','Choose an application folder. The desktop is reserved for shortcuts.')])
actions=[('FindRelatedProducts',25),('AppSearch',50),('LaunchConditions',1100),('CostInitialize',800),('FileCost',900),
         ('CostFinalize',1000),('InstallValidate',1400),('InstallInitialize',1500),('RemoveExistingProducts',1510),
         ('ProcessComponents',1600),('UnpublishFeatures',1800),('RemoveRegistryValues',2600),('RemoveShortcuts',3200),
         ('RemoveFiles',3500),('InstallFiles',4000),('CreateShortcuts',4500),('WriteRegistryValues',5000),
         ('RegisterUser',6000),('RegisterProduct',6100),('PublishFeatures',6300),('PublishProduct',6400),('InstallFinalize',6600)]
table('InstallExecuteSequence','Action Condition Sequence','s72 S255 I2','Action',[(a,None,n) for a,n in actions])
table('AdminExecuteSequence','Action Condition Sequence','s72 S255 I2','Action',[(a,None,n) for a,n in [('CostInitialize',800),('FileCost',900),('CostFinalize',1000),('InstallValidate',1400),('InstallInitialize',1500),('InstallAdminPackage',3900),('InstallFiles',4000),('InstallFinalize',6600)]])
info=H();ok(summary(db,None,12,c.byref(info)),'get summary')
for key,value in {2:'Installation Database',3:'Path for Windows',4:'Path',7:'x64;1033',9:guid('package-'+EXPECTED),14:500,15:2,19:4}.items():
    ok(set_prop(info,key,3 if isinstance(value,int) else 30,value if isinstance(value,int) else 0,None,value if isinstance(value,str) else None),'summary property')
ok(persist(info),'save summary');close(info);ok(commit(db),'commit MSI database');close(db)
print('MSI assembled with',len(entries),'files',flush=True)
setup=OUT/'Path-2.0.0-rc.22-Windows-x64-Setup.exe'
compiler=Path(os.environ['WINDIR'])/'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
source=(HERE/'Setup.cs').read_text(encoding='utf8').replace('MSI_SHA256_PLACEHOLDER',digest(package))
(STAGE/'Setup.cs').write_text(source,encoding='utf-8-sig')
subprocess.run([str(compiler),'/nologo','/target:winexe','/platform:x64','/optimize+','/r:System.Windows.Forms.dll','/r:System.Drawing.dll',
                '/win32manifest:'+str(HERE/'setup.manifest'),'/win32icon:'+str(ASSETS/'installer.ico'),'/out:'+str(setup),
                '/resource:'+str(HERE/'PathMark.png')+',PathMark.png','/resource:'+str(package)+',PathPreview.msi',str(STAGE/'Setup.cs')],check=True)
print(setup.name,setup.stat().st_size,digest(setup),flush=True)
