const assert=require('node:assert/strict');
const {dialogText,validLanguage,acceptLanguage}=require('./native-language.cjs');
const frame={url:'path2://app/'},contents={mainFrame:frame},window={webContents:contents},event={sender:contents,senderFrame:frame};
for(const lang of ['en','ru','pl','es']){assert(validLanguage(lang));assert(acceptLanguage(event,window,lang));assert.equal(dialogText(lang).length,4);assert(dialogText(lang).every(x=>typeof x==='string'&&x.length));}
for(const v of ['system','ru-RU','__proto__',null,{},42])assert(!validLanguage(v));
assert(!acceptLanguage({...event,sender:{}},window,'ru'));assert(!acceptLanguage({...event,senderFrame:{url:'path2://app/'}},window,'ru'));
frame.url='https://other.test/';assert(!acceptLanguage(event,window,'ru'));assert(!acceptLanguage(event,null,'ru'));
assert.deepEqual(dialogText('invalid'),dialogText('en'));
console.log('PASS native language whitelist, four dialogs, sender/frame/origin validation and English fallback.');
