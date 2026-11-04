const {build,Platform,Arch}=require('electron-builder');
/* Non-Windows review build: use the upstream offline uninstaller reader instead
   of executing a Windows factory EXE. Production uses normal Windows signing. */
const fs=require('node:fs/promises'),path=require('node:path');
if(process.platform==='win32')throw Error('On Windows use dist:win or dist:signed');
if(require('app-builder-lib/package.json').version!=='26.18.0')throw Error('Review adapter requires audit after builder upgrade');
// Review staging can acquire temporary dotfiles while external tooling inspects it.
// Exclude them at archive time; final payload verification checks every remaining file.
const reviewArchive=require('app-builder-lib/out/targets/archive'),originalArchive=reviewArchive.archive;
reviewArchive.archive=async(format,file,directory,options={})=>{await fs.rm(file,{force:true});return originalArchive(format,file,directory,{...options,excluded:[...(options.excluded||[]),'.*']});};
const {NsisTarget}=require('app-builder-lib/out/targets/nsis/NsisTarget');
const {UninstallerReader,nsisTemplatesDir}=require('app-builder-lib/out/targets/nsis/nsisUtil');
NsisTarget.prototype.computeScriptAndSignUninstaller=async function(defines,commands,installerPath,header,archs){
 if(this.options.script)throw Error('Only upstream NSIS script is supported');
 const script=await fs.readFile(path.join(nsisTemplatesDir,'installer.nsi'),'utf8');
 const output=path.join(this.outDir,path.basename(installerPath,'exe')+'__uninstaller.exe');
 defines.BUILD_UNINSTALLER=null;defines.UNINSTALLER_OUT_FILE=path.win32.join('Z:',output);
 await this.executeMakensis(defines,commands,header+await this.computeFinalScript(script,false,archs));
 await UninstallerReader.exec(installerPath,output);
 const bytes=await fs.readFile(output);if(bytes.subarray(0,2).toString()!=='MZ')throw Error('Invalid extracted uninstaller');
 await fs.copyFile(output,path.join(this.outDir,'review-uninstaller.exe'));
 delete defines.BUILD_UNINSTALLER;defines.UNINSTALLER_OUT_FILE=output;
 return {script,isCustomScript:false};
};
build({targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),prepackaged:path.join(__dirname,'release/win-unpacked'),publish:'never',config:{forceCodeSigning:false}}).then(files=>console.log('Unsigned review artifacts:',files)).catch(e=>{console.error(e);process.exitCode=1;});
