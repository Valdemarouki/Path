"""Apply the collaboration client and authenticated route to existing mobile sources."""
from pathlib import Path
import argparse
import json
from client_assets import bundle, board_marker

HERE = Path(__file__).resolve().parent
WEB_STYLESHEET = "cssUrl:new URL('sharing.css',import.meta.url).href"

# The mobile shell loads alpha.css after styles.css. Scope the surface to the personal board.
PRIVATE_CANVAS_SURFACE = '''.shell:has(.canvas-reader) {background:#0b0c0e;}
.canvas-reader > .canvas-viewport {border:0;border-radius:16px;}'''

def mobile_board_styles(styles):
    if PRIVATE_CANVAS_SURFACE not in styles:
        styles += '\n' + PRIVATE_CANVAS_SURFACE + '\n'
    return styles

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f'Unexpected mobile baseline at {old[:75]}')
    return text.replace(old, new)

def workspace_cache(sw):
    versions = [
        ('-shell-v10-free-sharing', 'freeSharingCache'),
        ('-shell-v11-shared-workspaces', 'workspaceCache'),
        ('-shell-v12-shared-editors', 'editorCache'),
        ('-shell-v13-canvas-camera', 'cameraCache'),
        ('-shell-v14-canvas-parity', 'parityCache'),
        ('-shell-v15-canvas-surface', None),
    ]
    declarations = [f"const cacheName = originalCache + '{tag}';" for tag, _ in versions]
    start = next((i for i, declaration in enumerate(declarations) if declaration in sw), None)
    if start is None:
        raise ValueError('Unrecognized mobile service-worker cache version')
    for i in range(start, len(versions) - 1):
        old_name = versions[i][1]
        newer = declarations[i].replace('cacheName', old_name) + '\n' + declarations[i + 1]
        sw = replace_once(sw, declarations[i], newer)
        previous = versions[i - 1][1] if i else 'cursorPrevious'
        sw = replace_once(sw, f'[{previous},', f'[{old_name}, {previous},')
    # The sync module now acknowledges restored/deleted personal boards. Upgrade it with the model.
    old = "'styles.css','sharing.css','alpha-ui.mjs']"
    fresh = "'styles.css','sharing.css','alpha-ui.mjs','personal-client.mjs']"
    if fresh not in sw:
        sw = replace_once(sw,old,fresh)
    return sw

def apply_mobile_canvas_checkpoints(root):
    """Use the mobile account repository for receipts and sync only explicitly changed boards."""
    app_path, model_path, sync_path = [root/name for name in ('app.mjs','personal-model.mjs','personal-client.mjs')]
    app = app_path.read_text(encoding='utf-8')
    model = model_path.read_text(encoding='utf-8')
    sync = sync_path.read_text(encoding='utf-8')
    if 'applyCanvasChange:mobileCanvasChange' not in app:
        marker = "globalThis.PathSharedLibrary?.mount({rpc:webSharing,mobile:true,language:()=>lang,"
        replacement = """import {applyCanvasReceipt} from './personal-model.mjs';
let canvasAccount;
const mobileSharing=webSharing&&async function(action,args){
  const reply=await webSharing(action,args);
  if((action==='list'||action==='get')&&reply?.account)canvasAccount=reply.account;
  return reply;
};
const mobileCanvasChange=desktopMode||!webSharing?undefined:async(change,account)=>{
  if(!account||account!==canvasAccount||change.account!==account||state?.personalSync?.owner!==pathPersonal.profile)throw Error('PROFILE_CHANGED');
  if(state.appliedCanvasReceipts?.includes(change.id))return;
  if(blocked)refreshData();
  if(!await commit(next=>applyCanvasReceipt(next,change,pathPersonal.profile)))throw Error('LOCAL_WRITE');
};
globalThis.PathSharedLibrary?.mount({rpc:mobileSharing,applyCanvasChange:mobileCanvasChange,mobile:true,language:()=>lang,"""
        app_path.write_bytes(replace_once(app,marker,replacement).encode('utf-8'))
    if 'export function applyCanvasReceipt' not in model:
        model = replace_once(model,'result.canvases=base.canvases;', 'result.canvases=projectCanvasChanges(state,base.canvases);')
        model_path.write_bytes((model+'\n'+(HERE/'mobile-canvas-checkpoint.mjs').read_text(encoding='utf-8')).encode('utf-8'))
    if 'finishCanvasSync(s,head.payload.canvases,equal)' not in sync:
        sync = replace_once(sync,'import {apply,projection,reconcile,equal}', 'import {apply,projection,reconcile,equal,finishCanvasSync}')
        sync = replace_once(sync,'apply(s,content);s.personalSync=', 'apply(s,content);finishCanvasSync(s,head.payload.canvases,equal);s.personalSync=')
        sync_path.write_bytes(sync.encode('utf-8'))

def refresh_web(root):
    """Update the existing shared workspace assets from an RC28 or later web shell."""
    apply_mobile_canvas_checkpoints(root)
    old_css = (root/'sharing.css').read_text(encoding='utf-8')
    new_css = bundle('styles')
    boot = (root/'boot.mjs').read_text(encoding='utf-8')
    if WEB_STYLESHEET not in boot:
        boot = replace_once(boot, 'css:' + json.dumps(old_css), WEB_STYLESHEET)
    styles = replace_once((root/'styles.css').read_text(encoding='utf-8'), board_marker(old_css), board_marker(new_css))
    sw = workspace_cache((root/'sw.js').read_text(encoding='utf-8'))
    for name, value in [('boot.mjs', boot), ('styles.css', mobile_board_styles(styles)), ('sw.js', sw),
                        ('sharing.css', new_css), ('shared-library.js', bundle('scripts'))]:
        (root/name).write_bytes(value.encode('utf-8'))

def prepare_web(root):
    index = root / 'index.html'
    index.write_text(replace_once(index.read_text(), "connect-src 'self';", "connect-src 'self' wss://path-mobile-stfqgdvl.waldek-path.workers.dev;"))
    css = bundle('styles')
    marker = board_marker(css)
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
  PathSharedLibrary.mount({rpc:(action,args)=>request('/api/path-sharing',{action,args}),local:()=>[],mobile:true,language:lang,SHARING_STYLESHEET});
  text.textContent='';shell.open=true;
  for(const kind of ['project','canvas']){
   const section=document.createElement('section'),title=document.createElement('h2'),library=document.createElement('path-shared-library');
   title.textContent=kind==='canvas'?'Canvas':({ru:'Проекты',es:'Proyectos',pl:'Projekty'}[lang()]||'Projects');
   library.setAttribute('kind',kind);section.append(title,library);shell.append(section);
  }
  return;
 }
 document.body.dataset.account='ready';await import('./app.mjs');""".replace('SHARING_STYLESHEET',WEB_STYLESHEET))
    sw=(root/'sw.js').read_text()
    original="const cacheName = originalCache + '-shell-v7';"
    sw=replace_once(sw,original,"const sharingPrevious = originalCache + '-shell-v8-sharing';\nconst preSharing = originalCache + '-shell-v7';\nconst cursorPrevious = originalCache + '-shell-v9-cursors';\nconst cacheName = originalCache + '-shell-v10-free-sharing';")
    sw=replace_once(sw,'[iconsCache, canvasCache','[cursorPrevious, sharingPrevious, preSharing, iconsCache, canvasCache')
    sw=replace_once(sw,'if (!freshPaths.has(url.pathname))',"""if (!freshPaths.has(url.pathname) && !['boot.mjs','app.mjs','shared-library.js','styles.css','sharing.css','alpha-ui.mjs'].includes(url.pathname.split('/').pop()))""")
    (root/'sw.js').write_text(workspace_cache(sw))
    (root/'boot.mjs').write_text(boot)
    for name,text in [('app.mjs',app),('styles.css',mobile_board_styles((root/'styles.css').read_text()+'\n'+marker)),
                      ('shared-library.js',bundle('scripts')),('sharing.css',css)]:
        (root/name).write_text(text)

    apply_mobile_canvas_checkpoints(root)

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
    web=parser.add_mutually_exclusive_group()
    web.add_argument('--web',type=Path)
    web.add_argument('--refresh-web',type=Path,help='Update the shared editors in an existing mobile shell.')
    parser.add_argument('--worker',type=Path)
    parser.add_argument('--config',type=Path)
    args=parser.parse_args()
    if args.config:prepare_config(args.config)
    if args.web:prepare_web(args.web)
    if args.refresh_web:refresh_web(args.refresh_web)
    if args.worker:prepare_worker(args.worker)
