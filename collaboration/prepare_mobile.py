"""Apply the collaboration client and authenticated route to existing mobile sources."""
from pathlib import Path
import argparse
import json

HERE = Path(__file__).resolve().parent

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f'Unexpected mobile baseline at {old[:75]}')
    return text.replace(old, new)

def prepare_web(root):
    index = root / 'index.html'
    index.write_text(replace_once(index.read_text(), "connect-src 'self';", "connect-src 'self' wss://path-mobile-stfqgdvl.waldek-path.workers.dev;"))
    css = (HERE / 'sharing.css').read_text()
    marker = css[css.index('.path-shared-mark{'):css.index('.item .path-shared-mark')]
    app = (root / 'app.mjs').read_text()
    start = app.index("const sharingEndpoint=")
    end = app.index("globalThis.PathSharedLibrary?.mount", start)
    app = app[:start] + """const webSharing = window.pathPersonal?.request
  ? (action,args)=>window.pathPersonal.request('/api/path-sharing',{action,args}) : null;
""" + app[end:]
    alpha=(root/'alpha-ui.mjs').read_text()
    alpha=replace_once(alpha,"if(p)return intro('projects')+action('back','project-list')+", """if(p)return intro('projects')+action('back','project-list')+`<path-share-entry kind="project" data-source="${esc(p.id)}"></path-share-entry>`+""")
    alpha=replace_once(alpha,'return `<section class="canvas-reader">${boardHeader(board)}','return `<section class="canvas-reader">${boardHeader(board)}<path-share-entry kind="canvas" data-source="${esc(board.id)}"></path-share-entry>')
    (root/'alpha-ui.mjs').write_text(alpha)
    boot=(root/'boot.mjs').read_text()
    call="const head=await request('/api/read',{p_known:null});if(!head.active||!head.payload)throw Error('INVALID_SNAPSHOT');"
    boot=replace_once(boot,call,"""let head;
  try{head=await request('/api/read',{p_known:null});}catch(e){if(e.message!=='ACCOUNT_NOT_ENABLED')throw e;}
  if(!head||head.active===false){sharedOnly=true;return;}
  if(!head.payload)throw Error('INVALID_SNAPSHOT');""")
    boot=replace_once(boot,'await navigator.locks.request(STORAGE_KEY','let sharedOnly=false;\n await navigator.locks.request(STORAGE_KEY')
    boot=replace_once(boot,"document.body.dataset.account='ready';await import('./app.mjs');","""if(sharedOnly){
  const lang=()=>navigator.language.slice(0,2);
  PathSharedLibrary.mount({rpc:(action,args)=>request('/api/path-sharing',{action,args}),local:()=>[],mobile:true,language:lang,css:SHARING_CSS_LITERAL});
  text.textContent='';shell.open=true;
  for(const kind of ['project','canvas']){
   const section=document.createElement('section'),title=document.createElement('h2'),library=document.createElement('path-shared-library');
   title.textContent=kind==='canvas'?'Canvas':({ru:'Проекты',es:'Proyectos',pl:'Projekty'}[lang()]||'Projects');
   library.setAttribute('kind',kind);section.append(title,library);shell.append(section);
  }
  return;
 }
 document.body.dataset.account='ready';await import('./app.mjs');""".replace('SHARING_CSS_LITERAL',json.dumps(css)))
    sw=(root/'sw.js').read_text()
    original="const cacheName = originalCache + '-shell-v7';"
    sw=replace_once(sw,original,"const sharingPrevious = originalCache + '-shell-v8-sharing';\nconst preSharing = originalCache + '-shell-v7';\nconst cursorPrevious = originalCache + '-shell-v9-cursors';\nconst cacheName = originalCache + '-shell-v10-free-sharing';")
    sw=replace_once(sw,'[iconsCache, canvasCache','[cursorPrevious, sharingPrevious, preSharing, iconsCache, canvasCache')
    sw=replace_once(sw,'if (!freshPaths.has(url.pathname))',"""if (!freshPaths.has(url.pathname) && !['boot.mjs','app.mjs','shared-library.js','styles.css','sharing.css','alpha-ui.mjs'].includes(url.pathname.split('/').pop()))""")
    (root/'sw.js').write_text(sw)
    (root/'boot.mjs').write_text(boot)
    for name,text in [('app.mjs',app),('styles.css',(root/'styles.css').read_text()+'\n'+marker),
                      ('shared-library.js',(HERE/'canvas-cursors.js').read_text()+'\n'+(HERE/'shared-library.js').read_text()),('sharing.css',css)]:
        (root/name).write_text(text)

def prepare_worker(path):
    worker=path.read_text()
    worker=replace_once(worker,"['/api/push','POST']", "['/api/push','POST'], ['/api/path-sharing','POST']")
    # Runs only after the worker's method/origin, live session cookie and profile checks.
    old='const response = await relay(req,{'
    worker=replace_once(worker,old,"""let response;
    if(path==='/api/path-sharing'){
      response=await shareRequest(req,{issuer,publishableKey,adapter,subject:session.credentials.identity.subject,until:session.until});
    }else response = await relay(req,{""")
    guard="    if (!allowedOrigin(url,env)) return json(403,{error:'DENIED'});"
    worker=replace_once(worker,guard,guard+r"""
    const board = /^\/api\/canvas-cursors\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.exec(url.pathname);
    if(board)return routeCanvasCursor(req,env,board[1].toLowerCase());""")
    worker += '\n' + (HERE/'mobile-route.mjs').read_text() + '\n' + (HERE/'cursor-room.mjs').read_text()
    path.write_text(worker)

def prepare_config(path):
    config=json.loads(path.read_text())
    config['durable_objects']['bindings'].append({'name':'CANVAS_ROOMS','class_name':'CanvasCursorRoom'})
    config['migrations'].append({'tag':'v2-canvas-cursors','new_sqlite_classes':['CanvasCursorRoom']})
    path.write_text(json.dumps(config,indent=2)+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--web',type=Path)
    parser.add_argument('--worker',type=Path)
    parser.add_argument('--config',type=Path)
    args=parser.parse_args()
    if args.config:prepare_config(args.config)
    if args.web:prepare_web(args.web)
    if args.worker:prepare_worker(args.worker)
