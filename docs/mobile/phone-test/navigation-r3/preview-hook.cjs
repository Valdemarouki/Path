// Local static-file request interception; no listener or outbound requests.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path');
const root=process.env.NAV_PREVIEW_ROOT||'/workspace/Path/mobile/dist';
const launch=chromium.launch.bind(chromium);
chromium.launch=async function(options){
 const browser=await launch(options),create=browser.newContext.bind(browser);
 browser.newContext=async function(options){
  const context=await create(options),register=context.route.bind(context),setOffline=context.setOffline.bind(context);let offline=false;
  context.setOffline=async value=>{offline=value;return setOffline(value);};
  context.route=(pattern,handler,opts)=>register(pattern,async(route,request)=>{
   const resume=route.continue.bind(route);
   route.continue=async function(options){
    const u=new URL(route.request().url());
    if(offline||u.origin!=='http://127.0.0.1:8010')return resume(options);
    const target=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
    if(!target.startsWith(root+'/'))return route.abort();
    const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.json':'application/json'};
    try{return route.fulfill({status:200,contentType:types[path.extname(target)]||'application/octet-stream',body:await fs.readFile(target)});}
    catch{return route.fulfill({status:404,body:'Not found'});}
   };
   return handler(route,request);
  },opts);
  return context;
 };
 return browser;
};
