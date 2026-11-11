// Local static-file request interception; no listener or outbound requests.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path');
const root=process.env.NAV_PREVIEW_ROOT||'/workspace/Path/mobile/dist';
const origin=process.env.MOBILE_PHONE_ORIGIN||process.env.MOBILE_TEST_ORIGIN||'http://127.0.0.1:8010';
const launch=chromium.launch.bind(chromium);
chromium.launch=async function(options){
 const browser=await launch(options),create=browser.newContext.bind(browser);
 browser.newContext=async function(options){
  const context=await create(options),register=context.route.bind(context),setOffline=context.setOffline.bind(context);let offline=false;
  context.setOffline=async value=>{offline=value;return setOffline(value);};
  context.route=(pattern,handler,opts)=>register(pattern,async(route,request)=>{
   // Old navigation fixtures fulfill their own files with a small MIME table.
   // Keep those test assertions unchanged while serving new domain JS modules
   // with the same JavaScript MIME type as the actual built app server.
   const fulfill=route.fulfill.bind(route);
   route.fulfill=options=>{
    if(options?.contentType==='application/octet-stream'&&new URL(route.request().url()).pathname.endsWith('.js'))options={...options,contentType:'text/javascript'};
    return fulfill(options);
   };
   const resume=route.continue.bind(route);
   route.continue=async function(options){
    const u=new URL(route.request().url());
    if(offline)return resume(options);if(u.origin!==origin)return route.abort('blockedbyclient');
    const target=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
    if(!target.startsWith(root+'/'))return route.abort();
    const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.otf':'font/otf','.txt':'text/plain','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.mp4':'video/mp4','.png':'image/png','.json':'application/json'};
    try{return route.fulfill({status:200,contentType:types[path.extname(target)]||'application/octet-stream',body:await fs.readFile(target)});}
    catch{return route.fulfill({status:404,body:'Not found'});}
   };
   return handler(route,request);
  },opts);
  return context;
 };
 return browser;
};
