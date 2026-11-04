// Validate configuration before preparing or building any signed artifact.
const config=require('../signing.config.cjs');
if(process.platform!=='win32')throw Error('The supported signed release workflow requires Windows; no build was started.');
if(!config.forceCodeSigning||config.publish!==null)throw Error('Signed release must require signing and disable publication.');
console.log('PASS signing configuration. Certificate/provider access and actual signatures still require verification during and after the build.');
