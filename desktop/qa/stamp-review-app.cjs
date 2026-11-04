const fs=require('fs'),PE=require('pe-library'),R=require('resedit');
const file='release/win-unpacked/Path 2.0.exe';
const exe=PE.NtExecutable.from(fs.readFileSync(file)),res=PE.NtExecutableResource.from(exe);
const ico=R.Data.IconFile.from(fs.readFileSync('build/path.ico'));
const groups=res.entries.filter(e=>e.type===14);
for(const g of groups)R.Resource.IconGroupEntry.replaceIconsForResource(res.entries,g.id,g.lang,ico.icons.map(i=>i.data));
for(const vi of R.Resource.VersionInfo.fromEntries(res.entries)){
 vi.setFileVersion(2,0,0,18,1033);vi.setProductVersion(2,0,0,18,1033);
 vi.setStringValues({lang:1033,codepage:1200},{CompanyName:'Path',FileDescription:'Path 2.0',ProductName:'Path 2.0',InternalName:'Path 2.0',OriginalFilename:'Path 2.0.exe',FileVersion:'2.0.0-rc.18',ProductVersion:'2.0.0-rc.18'});vi.outputToResourceEntries(res.entries);
}
res.outputResource(exe);fs.writeFileSync(file,Buffer.from(exe.generate()));
console.log('Updated Path icon and RC18 version resources; retained other resources.');
