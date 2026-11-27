"""Exercise production-built shared editors in Chromium against an in-memory Path database.

python collaboration/qa/browser-parity.py --desktop /path/to/packaged/app/index.html \
  [--chromium /path/to/chrome] [--mobile-assets /path/to/mobile/public/app]
Uses only synthetic accounts and records and blocks non-fixture network requests.
"""
import argparse
import base64
import json
import mimetypes
import os
import re
from pathlib import Path
import subprocess
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright


QA_DIR = Path(__file__).resolve().parent
PNG = 'data:image/png;base64,' + base64.b64encode((QA_DIR / 'fixtures/room-study.png').read_bytes()).decode('ascii')
FIXTURE = {
    'project': {
        'id':'p-source', 'name':'Scene production', 'type':'game', 'status':'active', 'description':'A short film study of light, space and the last hour of the day.',
        'tasks':[{'id':'t-scene','title':'Draw the scene','status':'planned','description':'Paint the bedroom',
                  'start':'2026-11-27','end':'2026-12-03','deadline':'2026-12-06','dependencies':[]},
                 {'id':'t-light','title':'Light the scene','status':'progress','start':'2026-12-07','end':'2026-12-10','dependencies':['t-scene']},
                 {'id':'t-cut','title':'Assemble the first cut','status':'planned','start':'2026-12-11','end':'2026-12-15','dependencies':['t-light']},
                 {'id':'t-reference','title':'Collect visual references','status':'done','start':'2026-11-23','end':'2026-11-25'}],
        'milestones':[{'id':'m-prototype','title':'First scene review','date':'2026-12-04'}],
    },
    'canvas': {
        'id':'c-source', 'name':'Scene sketches',
        'nodes':[{'id':'n-scene','kind':'text','title':'Concept','body':'A quiet room','x':64,'y':74,'width':240,'height':128},
                 {'id':'n-light','kind':'text','title':'Lighting','body':'Late afternoon','x':440,'y':150,'width':210,'height':135},
                 {'id':'n-photo','image':PNG,'x':440,'y':380,'width':180,'height':128},
                 {'id':'n-private','kind':'note','noteId':'private-source','body':'REMEMBER_PRIVATE_TEST','x':30,'y':360,'width':220,'height':120}],
        'edges':[{'id':'e-study','from':'n-light','to':'n-photo','label':'Reference'}],
    }
}


class Database:
    def __init__(self):
        self.pipe = subprocess.Popen(['node', str(QA_DIR / 'browser-db.mjs')], stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, text=True, encoding='utf-8')
        line = self.pipe.stdout.readline()
        if not line:
            raise RuntimeError('Could not start the local PGlite fixture')
        self.users = json.loads(line)['users']
        self.tickets={}

    def reply(self, actor, action, args):
        if os.environ.get('PATH_QA_TRACE'): print('DB >', actor, action, flush=True)
        self.pipe.stdin.write(json.dumps(dict(actor=actor, action=action, args=args)) + '\n')
        self.pipe.stdin.flush()
        reply=json.loads(self.pipe.stdout.readline())
        if action=='cursor-ticket' and 'data' in reply:
            self.tickets[(actor,args['id'])]=reply['data']['ticket']
        if os.environ.get('PATH_QA_TRACE'): print('DB <', actor, action, reply.get('error','ok'), flush=True)
        return reply

    def rpc(self, actor, action, args):
        answer = self.reply(actor, action, {'detailVersion':3, **args})
        if 'error' in answer:
            raise AssertionError(f"{action}: {answer['error']}")
        return answer['data']

    def grant(self, resource, actor, role):
        self.rpc(0,'invite',{'id':resource['id'],'email':self.users[actor]['email'],'role':role})
        inbox=self.rpc(actor,'list',{})['inbox']
        inv=next(x for x in inbox if x['name']==resource['document']['name'])
        self.rpc(actor,'accept',{'invitation':inv['id']})

    def close(self):
        self.pipe.stdin.close()
        self.pipe.wait(timeout=10)


class Client:
    def __init__(self, browser, db, actor, desktop, mobile_assets=None, narrow=False):
        self.db, self.actor = db, actor
        self.mobile = mobile_assets is not None
        self.context = browser.new_context(viewport=dict(width=390 if narrow else 1280,height=844 if narrow else 920),
                                           has_touch=narrow, locale='en-US', reduced_motion='reduce', service_workers='block')
        self.page = self.context.new_page()
        self.page.set_default_timeout(11000)
        self.errors = []
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.cursor_socket=None
        self.cursor_messages=[]
        def cursor_socket(socket):
            self.cursor_socket=socket
            socket.on_message(lambda message:self.cursor_messages.append(message))
        self.page.route_web_socket('**/*',cursor_socket)
        if self.mobile:
            assets=Path(mobile_assets).resolve()
            def route(req):
                address=urlparse(req.request.url)
                if address.hostname!='path-fixture.test':
                    return req.abort()
                if address.path=='/api/session':
                    return req.fulfill(json={'profile':str(actor + 1)*64,'email':db.users[actor]['email']})
                if address.path=='/api/read':
                    return req.fulfill(json={'active':False})
                if address.path=='/api/path-sharing':
                    request=req.request.post_data_json
                    reply=db.reply(actor,request['action'],request['args'])
                    return req.fulfill(status=403 if 'error' in reply else 200,json=reply.get('data',reply))
                if address.path.startswith('/open/'):
                    path=(assets / (address.path[len('/open/'):] or 'index.html')).resolve()
                    if assets in path.parents and path.is_file():
                        return req.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
                req.fulfill(status=404,body='')
            self.page.route('https://**/*',route)
            self.page.goto('https://path-fixture.test/open/',wait_until='domcontentloaded')
        else:
            self.page.expose_function('qaShare',lambda action,args:db.reply(actor,action,args))
            self.page.add_init_script("""window.pathDesktop={sharing:async(action,args)=>{
              const result=await qaShare(action,args);if(result.error)throw Error(result.error);return result.data;
            }}""")
            self.page.route('https://**/*',lambda route:route.abort())
            self.page.goto(Path(desktop).resolve().as_uri(),wait_until='domcontentloaded')
            if actor==0:
                self.page.evaluate('(f)=>{data.projects.push(f.project);data.canvases.push(f.canvas);}', FIXTURE)
        self.workspace=self.page.locator('[data-path-shared-workspace]')

    def navigate(self, kind):
        if not self.mobile:
            self.page.locator('button[data-nav="'+('projects' if kind=='project' else 'canvas')+'"][aria-label]').first.click()
        return self.page.locator('path-shared-library[kind="'+kind+'"]')

    def create(self, kind):
        lib=self.navigate(kind)
        lib.locator('select').select_option(FIXTURE[kind]['id'])
        lib.get_by_role('button',name='Create shared version').click()
        lib.get_by_role('dialog').get_by_role('button',name='Share',exact=True).click()
        expect(self.workspace.get_by_role('heading',name=FIXTURE[kind]['name'],exact=True)).to_be_visible()
        resource=self.db.rpc(0,'get',{'id':self.workspace.get_attribute('data-path-shared-workspace')})
        return resource

    def open(self,kind):
        lib=self.navigate(kind)
        if self.actor==0:
            self.page.locator('[data-'+kind+'-open="'+FIXTURE[kind]['id']+'"]').click()
        elif self.mobile:
            lib.get_by_role('button',name=FIXTURE[kind]['name'],exact=False).first.click()
        else:
            self.page.locator('[data-shared-card] button').filter(has_text=FIXTURE[kind]['name']).click()
        expect(self.workspace.get_by_role('heading',name=FIXTURE[kind]['name'],exact=True)).to_be_visible()
        return self.workspace

    def back(self):
        self.workspace.locator('.workspace-back').click()
        expect(self.workspace).to_have_count(0)

    def check_geometry(self):
        metrics=self.workspace.evaluate("""host=>({width:host.getBoundingClientRect().width,
           maxWidth:document.documentElement.clientWidth,full:document.documentElement.scrollWidth,
           covered:[...document.querySelectorAll('[data-path-shared-covered]')].every(el=>getComputedStyle(el).display==='none')})""")
        if not self.mobile:
            portrait=self.page.locator('#path-particle-layer')
            if portrait.count(): expect(portrait).to_be_hidden()
        assert metrics['covered'], metrics
        assert metrics['width']>=300 and metrics['full']<=metrics['maxWidth']+2, metrics


def server_task(db, project, id='t-scene'):
    return next(t for t in db.rpc(0,'get',{'id':project['id']})['document']['tasks'] if t['id']==id)


def task_form(client):
    button=client.workspace.locator('.shared-task').filter(has_text='Draw the scene')
    if client.mobile: button.tap()
    else: button.click()
    return client.workspace.locator('form').filter(has=client.page.locator('[name="title"]'))


def project_checks(db, owner, editor, viewer, screenshot_dir):
    project=owner.create('project')
    for actor,role in ((1,'editor'),(2,'viewer')): db.grant(project,actor,role)
    assert server_task(db,project)['description']=='Paint the bedroom'
    assert server_task(db,project)['end']=='2026-12-03'
    editor.open('project'); viewer.open('project')
    for c in (owner,editor,viewer): c.check_geometry()
    if screenshot_dir:
        owner.page.screenshot(path=str(screenshot_dir/'project-desktop.png'))
        viewer.page.screenshot(path=str(screenshot_dir/'project-narrow.png'))
    vf=task_form(viewer)
    assert vf.locator('[type="submit"]:visible:enabled').count()==0
    viewer.page.keyboard.press('Escape')

    # Independent edits in simultaneously opened forms merge at field granularity.
    af,bf=task_form(owner),task_form(editor)
    af.locator('[name="description"]').fill('New palette from owner')
    bf.locator('[name="deadline"]').fill('2026-12-19')
    bf.locator('[type="submit"]').click()
    expect(bf).to_have_count(0)
    owner.page.wait_for_timeout(3700)
    expect(af.locator('[name="description"]')).to_have_value('New palette from owner')
    af.locator('[type="submit"]').click()
    expect(af).to_have_count(0)
    task=server_task(db,project)
    assert task['deadline']=='2026-12-19' and task['description']=='New palette from owner',task

    # Same-field conflicts keep the remote value and the second writer's draft.
    af,bf=task_form(owner),task_form(editor)
    af.locator('[name="description"]').fill('First writer')
    bf.locator('[name="description"]').fill('Unsaved second draft')
    af.locator('[type="submit"]').click();expect(af).to_have_count(0)
    bf.locator('[type="submit"]').click()
    expect(bf.locator('[name="description"]')).to_have_value('Unsaved second draft')
    assert server_task(db,project)['description']=='First writer'
    editor.page.keyboard.press('Escape')

    board=owner.workspace
    board.locator('[data-project-task="t-scene"]').drag_to(board.locator('[data-project-column="done"]'))
    expect(board.locator('[data-project-column="done"] [data-project-task="t-scene"]')).to_be_visible()
    assert server_task(db,project)['status']=='done'
    expect(editor.workspace.locator('[data-project-column="done"] [data-project-task="t-scene"]')).to_be_visible()
    timeline=board.locator('[data-project-timeline]')
    expect(timeline).to_be_visible()
    expect(timeline.locator('[data-project-bar="t-scene"]')).to_be_visible()
    bar=timeline.locator('[data-project-bar="t-scene"]')
    track_width=bar.evaluate("el=>el.closest('.sp-track').getBoundingClientRect().width")
    day_width=track_width/30
    rect=bar.bounding_box()
    spot=(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
    owner.page.mouse.move(*spot);owner.page.mouse.down()
    owner.page.mouse.move(spot[0]+day_width,spot[1],steps=6);owner.page.mouse.up()
    expect(bar).to_have_attribute('aria-label', re.compile('Nov 28'))
    moved_task=server_task(db,project)
    assert moved_task['start']=='2026-11-28' and moved_task['end']=='2026-12-04',moved_task
    # Keyboard behaves like the draggable start/end handles, including after polling and repaint.
    timeline.locator('[data-project-resize="end"]').first.press('ArrowRight')
    expect(bar).to_have_attribute('aria-label', re.compile('Dec 5'))
    board.locator('[data-project-add-milestone]').click()
    milestone_form=board.locator('dialog[open] form')
    milestone_form.locator('[name="title"]').fill('Art lock')
    milestone_form.locator('[name="date"]').fill('2026-12-08')
    milestone_form.locator('[type="submit"]').click()
    expect(milestone_form).to_have_count(0)
    latest=db.rpc(0,'get',{'id':project['id']})['document']
    milestone=next(m for m in latest['milestones'] if m['title']=='Art lock')
    expect(editor.workspace.locator('[data-project-milestone="'+milestone['id']+'"]').first).to_be_visible()
    assert latest['tasks'][0]['start']=='2026-11-28'
    assert latest['tasks'][0]['end']=='2026-12-05'
    assert owner.page.evaluate("data.projects.find(x=>x.id==='p-source').tasks[0].status")=='planned'
    for c in (owner,editor,viewer): c.back()
    owner.open('project')
    expect(owner.workspace.locator('[data-project-column="done"] [data-project-task="t-scene"]')).to_be_visible()
    owner.back()
    print('PASS project sharing, detail fields, concurrent edits, remote refresh, conflicts, Kanban, timeline and reopen',flush=True)


def canvas_checks(db, owner, editor, viewer, screenshot_dir):
    board=owner.create('canvas')
    assert 'REMEMBER_PRIVATE_TEST' not in json.dumps(board['document'])
    for actor,role in ((1,'editor'),(2,'viewer')): db.grant(board,actor,role)
    editor.open('canvas');viewer.open('canvas')
    for c in (owner,editor,viewer): c.check_geometry()
    if screenshot_dir:
        owner.page.screenshot(path=str(screenshot_dir/'canvas-desktop.png'))
        viewer.page.screenshot(path=str(screenshot_dir/'canvas-narrow.png'))
    canvas=owner.workspace.locator('svg.shared-board')
    expect(canvas.locator('image')).to_have_count(1)
    expect(canvas.locator('[data-node-id="n-scene"]')).to_be_visible()
    # Drive the real outgoing pointer, process it in Path's cursor room, and deliver the frames
    # to the other real renderers. Only the socket transport itself stays in memory.
    for client in (owner,editor,viewer): assert client.cursor_socket
    owner.cursor_messages.clear()
    bounds=canvas.bounding_box()
    owner.page.mouse.move(bounds['x']+bounds['width']*.43,bounds['y']+bounds['height']*.65)
    owner.page.wait_for_timeout(160)
    emitted=next(data for data in reversed(owner.cursor_messages) if json.loads(data).get('type')=='move')
    result=db.rpc(0,'qa-cursor-frame',{'id':board['id'],'frame':emitted,
        'tickets':{str(c.actor):db.tickets[(c.actor,board['id'])] for c in (owner,editor,viewer)}})
    assert not result['0']
    for client in (editor,viewer):
        [message]=result[str(client.actor)];client.cursor_socket.send(json.dumps(message))
        expect(client.workspace.locator('.remote-pointer .cursor-name')).to_have_text(db.users[0]['name'])
        expect(client.workspace.locator('.remote-pointer')).to_have_attribute('visibility','visible')
    if viewer.mobile:
        remote_canvas=viewer.workspace.locator('.shared-board')
        original=remote_canvas.get_attribute('viewBox')
        viewer.workspace.get_by_role('button',name='Zoom in',exact=True).tap()
        assert remote_canvas.get_attribute('viewBox')!=original
        old_width=float(remote_canvas.get_attribute('viewBox').split()[2])
        bounds=remote_canvas.bounding_box(); cx=bounds['x']+bounds['width']/2;cy=bounds['y']+bounds['height']/2
        touch=viewer.context.new_cdp_session(viewer.page)
        def pinch_event(kind,delta):
            touch.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[] if kind=='touchEnd' else [
                {'x':cx-delta,'y':cy,'id':1},{'x':cx+delta,'y':cy,'id':2}]})
        pinch_event('touchStart',30);pinch_event('touchMove',58);pinch_event('touchEnd',0)
        assert float(remote_canvas.get_attribute('viewBox').split()[2])<old_width
        touch.detach()
        assert viewer.workspace.locator('[data-be-action="note"]:visible:enabled').count()==0
    camera=canvas.get_attribute('viewBox')
    owner.workspace.get_by_role('button',name='Zoom in',exact=True).click()
    assert canvas.get_attribute('viewBox')!=camera
    owner.workspace.get_by_role('button',name='Fit board',exact=True).click()
    owner.workspace.get_by_role('button',name='Add note',exact=True).click()
    form=owner.workspace.locator('form[data-board-draft]')
    form.locator('[name="body"]').fill('A new shared note')
    form.locator('[type="submit"]').click()
    expect(form).to_have_count(0)
    expect(editor.workspace.locator('.shared-board').get_by_role('button',name='A new shared note',exact=True)).to_be_visible()
    doc=db.rpc(0,'get',{'id':board['id']})['document']
    assert len(doc['nodes'])==5
    assert any(n.get('body')=='A new shared note' for n in doc['nodes'])
    # Edit in place and keep typing while a remote participant receives the autosave.
    # The viewer can open the card details but cannot write through either editor.
    light_selector='[data-node-id="n-light"]'
    light=canvas.locator(light_selector)
    light.focus()
    owner.page.keyboard.press('Enter')
    inline=owner.workspace.locator('.be-inline-editor form[data-board-draft]')
    body=inline.locator('[name="body"]')
    body.fill('Afternoon light from the west')
    expect(editor.workspace.locator(light_selector+' .be-copy')).to_contain_text('Afternoon light from the west',timeout=11000)
    expect(body).to_be_focused()
    body.press('End')
    body.press_sequentially(' window')
    body.press('Control+Enter')
    expect(inline).to_have_count(0)
    expect(viewer.workspace.locator(light_selector+' .be-copy')).to_contain_text('Afternoon light from the west window',timeout=11000)
    view_light=viewer.workspace.locator(light_selector)
    view_light.focus()
    viewer.page.keyboard.press('Enter')
    expect(viewer.workspace.locator('.be-inline-editor')).to_have_count(0)
    expect(viewer.workspace.locator('form[data-board-draft] [type="submit"]:enabled')).to_have_count(0)
    viewer.page.keyboard.press('Escape')
    first=canvas.locator('[data-node-id="n-scene"]').first
    previous=next(n for n in doc['nodes'] if n['id']=='n-scene')
    old_transform=first.get_attribute('transform')
    area=first.bounding_box(); x=area['x']+area['width']*.48; y=area['y']+area['height']*.48
    owner.page.mouse.move(x,y); owner.page.mouse.down(); owner.page.mouse.move(x+52,y+31,steps=8); owner.page.mouse.up()
    expect(editor.workspace.locator('[data-node-id="n-scene"]').first).not_to_have_attribute('transform',old_transform,timeout=11000)
    moved=next(n for n in db.rpc(0,'get',{'id':board['id']})['document']['nodes'] if n['id']=='n-scene')
    assert (previous['x'],previous['y'])!=(moved['x'],moved['y'])
    assert owner.page.evaluate("data.canvases.find(x=>x.id==='c-source').nodes[0].x")==64

    # Use the Canvas handles and toolbar, and verify the second browser sees the same document.
    first.click()
    handle=canvas.locator('[data-resize-node="n-scene"]')
    box=handle.bounding_box();hx=box['x']+box['width']/2;hy=box['y']+box['height']/2
    owner.page.mouse.move(hx,hy);owner.page.mouse.down();owner.page.mouse.move(hx+38,hy+20,steps=7);owner.page.mouse.up()
    expect(owner.workspace.locator('[data-be-action="undo"]').first).to_be_enabled()
    owner.page.wait_for_function('''() => {
      const h=document.querySelector('[data-path-shared-workspace]').shadowRoot;
      return Number(h.querySelector('[data-node-id="n-scene"] rect').getAttribute('width')) > 240;
    }''')
    grown=next(n for n in db.rpc(0,'get',{'id':board['id']})['document']['nodes'] if n['id']=='n-scene')
    assert grown['width']>previous['width'] and grown['height']>previous['height'],grown
    first.click()
    owner.workspace.locator('[data-be-action="connect"]').last.click()
    canvas.locator('[data-node-id="n-light"]').click()
    edge='[data-edge-from="n-scene"][data-edge-to="n-light"]'
    expect(editor.workspace.locator(edge)).to_have_count(1,timeout=11000)
    edges=db.rpc(0,'get',{'id':board['id']})['document']['edges']
    assert {(e['from'],e['to']) for e in edges}=={('n-light','n-photo'),('n-scene','n-light')}
    first.click()
    owner.workspace.locator('[data-be-action="delete"]').click()
    expect(editor.workspace.locator('[data-node-id="n-scene"]')).to_have_count(0,timeout=11000)
    expect(editor.workspace.locator(edge)).to_have_count(0)
    owner.workspace.locator('[data-be-action="undo"]').first.click()
    expect(editor.workspace.locator(edge)).to_have_count(1,timeout=11000)
    expect(editor.workspace.locator('[data-node-id="n-scene"]')).to_be_visible()
    db.rpc(0,'remove',{'id':board['id'],'account':db.users[1]['id']})
    expect(editor.workspace.locator('.shared-board')).to_have_count(0,timeout=12000)
    denied=db.reply(1,'get',{'id':board['id'],'detailVersion':3})
    assert denied['error']=='SHARE_DENIED'
    owner.back();owner.open('canvas')
    expect(owner.workspace.locator('.shared-board').get_by_role('button',name='A new shared note',exact=True)).to_be_visible()
    print('PASS Canvas projection, inline autosave, peer updates, read-only details, viewport, drag, resize, edge, delete, undo, remote revoke and reopen',flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--desktop',type=Path,required=True)
    parser.add_argument('--mobile-assets',type=Path)
    parser.add_argument('--kind', choices=['all','project','canvas'], default='all')
    parser.add_argument('--chromium')
    parser.add_argument('--screenshots',type=Path)
    args=parser.parse_args()
    if args.screenshots:args.screenshots.mkdir(parents=True,exist_ok=True)
    db=Database()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=args.chromium,args=['--allow-file-access-from-files'])
            clients=[Client(browser,db,i,args.desktop,args.mobile_assets if i==2 else None,narrow=i==2) for i in range(3)]
            if args.kind in ('all','project'): project_checks(db,*clients,args.screenshots)
            if args.kind in ('all','canvas'): canvas_checks(db,*clients,args.screenshots)
            for client in clients: assert not client.errors,client.errors
            browser.close()
    finally: db.close()


if __name__=='__main__': main()
