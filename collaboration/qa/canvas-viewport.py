"""Measure the packaged shared Canvas on desktop, mobile, and the account portal.

Run alongside browser-parity.py with --desktop, --mobile-assets, --portal-dist, and
optionally --chromium or --screenshots. All accounts, sessions and records are synthetic.
"""
import argparse
import base64
import importlib.util
import json
import mimetypes
from pathlib import Path
import time
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

spec = importlib.util.spec_from_file_location('parity', Path(__file__).with_name('browser-parity.py'))
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


def geometry(node):
    return node.evaluate("""el => {
      const r = el.getBoundingClientRect();
      return {x:r.x, y:r.y, w:r.width, h:r.height, vw:innerWidth, vh:innerHeight,
              scroll:scrollY, pageW:document.documentElement.scrollWidth, pageH:document.documentElement.scrollHeight};
    }""")


def private_mobile(client):
    """Use a disposable private workspace in this browser's isolated storage."""
    client.page.evaluate("""async board => {
      const model = await import('./model.mjs'), state = model.migrate(model.seed());
      state.canvases = [{...board,id:'private-board', name:'Private board'}];
      model.validate(state);
      personalStorage.setItem(model.STORAGE_KEY, JSON.stringify(state));
    }""", parity.FIXTURE['canvas'])
    client.page.goto('https://path-fixture.test/open/#canvas')
    client.page.reload()
    client.page.locator('[data-alpha="open-board"][data-id="private-board"]').click()
    return geometry(client.page.locator('.canvas-viewport'))


def portal(browser, db, dist, width, height, name):
    """Boot the compiled portal with its real CSP and an isolated account."""
    context = browser.new_context(viewport={'width':width,'height':height}, locale='en-US')
    user = {**db.users[0], 'email_confirmed_at':'2026-01-01T00:00:00Z', 'aud':'authenticated',
            'app_metadata':{}, 'user_metadata':{}}
    exp = int(time.time()) + 3600
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    token = '.'.join([encode({'alg':'HS256','typ':'JWT'}), encode({'sub':user['id'],'exp':exp}), 'AAAAAAAA'])
    session = dict(access_token=token, token_type='bearer', expires_in=3600, expires_at=exp,
                   refresh_token='local-test', user=user)
    context.add_init_script("if(location.hostname==='portal.test')localStorage.setItem('path-accounts-test-v1',"
                            + json.dumps(json.dumps(session)) + ");")
    page = context.new_page()
    page.set_default_timeout(9000)
    def serve(route):
        request = route.request
        url = urlparse(request.url)
        if url.hostname == 'portal.test':
            file = (dist / (url.path.lstrip('/') + ('index.html' if url.path.endswith('/') else ''))).resolve()
            if dist not in file.parents or not file.is_file():
                return route.fulfill(status=404)
            return route.fulfill(body=file.read_bytes(),content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
        if url.hostname != 'stfqgdvltwprzzcuocsv.supabase.co':
            return route.abort()
        cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'*'}
        if request.method == 'OPTIONS':
            return route.fulfill(status=204, headers=cors)
        if url.path == '/auth/v1/user':
            return route.fulfill(json=user, headers=cors)
        if url.path == '/rest/v1/rpc/path_share_v2':
            body = request.post_data_json
            response = db.reply(0,body['action'],body['args'])
            return route.fulfill(status=400 if 'error' in response else 200,json=response.get('data',response),headers=cors)
        return route.fulfill(status=400,json={'message':'local-test'},headers=cors)
    page.route('**/*',serve)
    page.route_web_socket('**/*',lambda s:None)
    page.goto('https://portal.test/shared/?lang=en')
    page.locator('path-shared-library[kind="canvas"]').get_by_role('button',name=name,exact=False).first.click()
    work = page.locator('[data-path-shared-workspace]')
    expect(work.locator('.be-world')).to_be_visible()
    return context,page,work


def zoom_trace(world, method='wheel', delta=-100):
    """Sample physical SVG transforms on animation frames and reproject the initial world anchor."""
    return world.evaluate("""async (svg, {method,delta})=>{
      const rect=svg.getBoundingClientRect(), x=rect.x+rect.width*(method==='button'?0.5:0.76),
        y=rect.y+rect.height*(method==='button'?0.5:0.38);
      const point=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM().inverse());
      const scale=()=>svg.getScreenCTM().a;
      const first=scale(),frames=[first],pageY=scrollY;
      await new Promise(requestAnimationFrame);
      if(method==='button')svg.getRootNode().querySelector('[data-be-action="zin"]').click();
      else svg.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,
        clientX:x,clientY:y,deltaY:delta}));
      const immediate=scale();let maxError=0;
      for(let i=0;i<50;i++){
        await new Promise(requestAnimationFrame);frames.push(scale());
        const p=point.matrixTransform(svg.getScreenCTM());
        maxError=Math.max(maxError,Math.hypot(p.x-x,p.y-y));
      }
      return {first,immediate,last:frames.at(-1),count:new Set(frames.map(n=>n.toFixed(5))).size,
        maxError,pageDelta:Math.abs(scrollY-pageY),monotonic:frames.every((n,i)=>!i||n>=frames[i-1]-0.00001)};
    }""",{'method':method,'delta':delta})


def check_zoom(page, work):
    world=work.locator('.be-world')
    page.emulate_media(reduced_motion='no-preference')
    for method in ('wheel','button'):
        result=zoom_trace(world,method)
        assert result['last'] > result['first']*1.05, result
        assert result['count'] >= 4 and result['monotonic'],result
        assert result['maxError'] < 1.5 and result['pageDelta'] < 1,result
        print(method, result,flush=True)
    page.emulate_media(reduced_motion='reduce')
    instant=zoom_trace(world)
    assert instant['immediate'] > instant['first']*1.05 and instant['count']==2,instant
    page.emulate_media(reduced_motion='no-preference')
    # A two-dimensional trackpad gesture should pan the board and leave the document still.
    pan=world.evaluate("""async svg=>{
      const r=svg.getBoundingClientRect(),x=r.x+r.width*.63,y=r.y+r.height*.63;
      const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM().inverse()), s=scrollY, a=svg.getScreenCTM().a;
      svg.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,clientX:x,clientY:y,deltaX:35,deltaY:54}));
      await new Promise(resolve=>setTimeout(resolve,700));const q=p.matrixTransform(svg.getScreenCTM());
      return {dx:q.x-x,dy:q.y-y,scrolled:scrollY-s,scale:svg.getScreenCTM().a-a};
    }""")
    assert abs(pan['dx']+35)<2 and abs(pan['dy']+54)<2 and abs(pan['scale'])<.001 and not pan['scrolled'],pan


def center_and_scale(world):
    return world.evaluate("""svg=>{
      const r=svg.getBoundingClientRect(),m=svg.getScreenCTM(),p=new DOMPoint(r.x+r.width/2,r.y+r.height/2).matrixTransform(m.inverse());
      return [p.x,p.y,m.a]
    }""")


def check_resize(page, work):
    world=work.locator('.be-world')
    before=center_and_scale(world)
    original=page.viewport_size
    page.set_viewport_size({'width':original['width']-180,'height':original['height']-125})
    page.wait_for_timeout(500)
    after=center_and_scale(world)
    assert abs(before[0]-after[0])*before[2]<2 and abs(before[1]-after[1])*before[2]<2,(before,after)
    assert abs(before[2]-after[2])/before[2]<.01,(before,after)
    page.set_viewport_size(original)
    page.wait_for_timeout(180)


def check_layout(page, work, label, private=None, screenshots=None):
    world=work.locator('.be-world')
    expect(world).to_be_visible()
    metrics=geometry(world)
    print(label,metrics,flush=True)
    if private:
        assert metrics['w']>=private['w']-5 and metrics['h']>=private['h']-8,(metrics,private)
    assert metrics['h']>=metrics['vh']*.78 and metrics['pageW']<=metrics['vw']+1,metrics
    assert metrics['y']>=-1 and metrics['y']+metrics['h']<=metrics['vh']+2,metrics
    if screenshots:
        page.screenshot(path=screenshots/(label+'.png'))


def check_menus(page,work,screenshots=None):
    world=work.locator('.be-world')
    before=geometry(world)
    def unchanged():
        actual=geometry(world)
        assert all(abs(actual[k]-before[k])<=1 for k in ('x','y','w','h','scroll')),(before,actual)
    options=work.locator('.board-options')
    options.locator(':scope > summary').click()
    for selector in ('.workspace-people', '.cursor-settings'):
        details=options.locator(selector)
        details.locator(':scope > summary').click()
        expect(details).to_have_attribute('open','')
        if screenshots and selector=='.workspace-people':
            page.screenshot(path=screenshots/'mobile-people.png')
        unchanged()
        details.locator(':scope > summary').click()
    page.keyboard.press('Escape')
    assert not options.evaluate('e=>e.open')
    cards=work.locator('.be-list')
    cards.locator(':scope > summary').click()
    expect(cards).to_have_attribute('open','')
    unchanged()
    cards.locator('.be-list-item').filter(has_text='Concept').first.click()
    form=work.locator('form[data-board-draft]')
    expect(form).to_be_visible()
    if screenshots:
        page.screenshot(path=screenshots/'mobile-inspector.png')
    assert not cards.evaluate('e=>e.open')
    unchanged()
    cancel=form.get_by_role('button',name='Cancel',exact=True)
    cancel.click()
    expect(form).to_have_count(0)
    unchanged()
    # The dropdown can be dismissed with a single click on an untouched area of the board.
    options.locator(':scope > summary').click()
    world.click(position=dict(x=38,y=world.bounding_box()['height']*.58))
    assert not options.evaluate('e=>e.open')
    unchanged()


def desktop_shortcut_isolation(owner):
    # A private Canvas selection may remain parked behind the shared workspace.
    page,work=owner.page,owner.workspace
    page.evaluate("""()=>{canvasId='c-source';canvasSelected='n-light';canvasMultiSelection=new Set(['n-light']);}""")
    cards=work.locator('.be-list')
    cards.locator(':scope > summary').click()
    cards.locator('.be-list-item').filter(has_text='Concept').first.click()
    form=work.locator('form[data-board-draft]')
    title=form.locator('[name=title]')
    title.focus()
    title.evaluate('el=>el.setSelectionRange(0,1)')
    page.keyboard.press('Delete')
    expect(title).to_have_value('oncept')
    assert page.evaluate("data.canvases.find(x=>x.id==='c-source').nodes.some(n=>n.id==='n-light')")
    form.get_by_role('button',name='Cancel',exact=True).click()
    page.evaluate("()=>{canvasId=null; canvasSelected=null; canvasMultiSelection.clear()}")


def check_mobile_landscape(mobile):
    page,work=mobile.page,mobile.workspace
    page.set_viewport_size({'width':844,'height':390})
    page.wait_for_timeout(220)
    canvas=work.locator('.be-world')
    bounds,nav=geometry(canvas),geometry(page.locator('#navigation'))
    visible_nav=min(nav['vh'],nav['y']+nav['h'])-max(0,nav['y'])
    assert abs(bounds['h']+bounds['y']-nav['y'])<=2 and 40<=visible_nav<=48,(bounds,nav)
    assert bounds['h']>=300 and bounds['pageH']<=bounds['vh']+1,bounds
    page.locator('#panel-toggle').click()
    expect(page.locator('#panel-toggle')).to_have_attribute('aria-expanded','true')
    expect(page.locator('#panel-extra')).to_be_visible()
    expect(work).to_be_attached()
    page.locator('#panel-toggle').click()
    expect(page.locator('#panel-toggle')).to_have_attribute('aria-expanded','false')
    expect(canvas).to_be_visible()
    print('mobile-landscape',bounds,'visible navigation',visible_nav,flush=True)


def check_touch(client):
    world=client.workspace.locator('.be-world')
    bounds=geometry(world)
    cx=bounds['x']+bounds['w']*.54
    cy=bounds['y']+bounds['h']*.53
    scale=world.evaluate('s=>s.getScreenCTM().a')
    anchor=world.evaluate('(s,[x,y])=>{const p=new DOMPoint(x,y).matrixTransform(s.getScreenCTM().inverse());return [p.x,p.y]}',[cx,cy])
    cdp=client.context.new_cdp_session(client.page)
    def touch(kind,positions):
        cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':x,'y':y,'id':i} for i,x,y in positions]})
    touch('touchStart',[(1,cx-25,cy),(2,cx+25,cy)])
    for i in range(1,7):
        touch('touchMove',[(1,cx-25-4*i+2*i,cy+i),(2,cx+25+4*i+2*i,cy+i)])
    client.page.wait_for_timeout(80)
    after=world.evaluate('(s,[x,y])=>{const m=s.getScreenCTM(),p=new DOMPoint(x,y).matrixTransform(m);return [m.a,p.x,p.y]}',anchor)
    assert after[0]>scale*1.6 and abs(after[1]-(cx+12))<2.5 and abs(after[2]-(cy+6))<2.5,(scale,after,cx,cy)
    touch('touchEnd',[])
    cdp.detach()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--desktop',required=True,type=Path)
    parser.add_argument('--mobile-assets',required=True,type=Path)
    parser.add_argument('--portal-dist',required=True,type=Path)
    parser.add_argument('--chromium')
    parser.add_argument('--screenshots',type=Path)
    args=parser.parse_args()
    if args.screenshots:args.screenshots.mkdir(parents=True,exist_ok=True)
    db=parity.Database()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=args.chromium,args=['--allow-file-access-from-files'])
            owner=parity.Client(browser,db,0,args.desktop)
            owner.navigate('canvas')
            owner.page.locator('[data-canvas-open="c-source"]').click()
            desk_private=geometry(owner.page.locator('#canvas-space'))
            owner.page.locator('[data-canvas-back]').first.click()
            shared=owner.create('canvas')
            check_layout(owner.page,owner.workspace,'desktop',desk_private,args.screenshots)
            check_menus(owner.page,owner.workspace)
            check_zoom(owner.page,owner.workspace)
            check_resize(owner.page,owner.workspace)
            desktop_shortcut_isolation(owner)
            owner.back()
            expect(owner.page.locator('[data-canvas-open="c-source"]')).to_be_visible()
            db.grant(shared,2,'editor')
            mobile=parity.Client(browser,db,2,None,args.mobile_assets,True)
            mobile.open('canvas')
            check_layout(mobile.page,mobile.workspace,'mobile-shared-only',screenshots=args.screenshots)
            check_menus(mobile.page,mobile.workspace,args.screenshots)
            check_touch(mobile)
            mobile.back()
            mob_private=private_mobile(mobile)
            mobile.page.locator('[data-alpha="board-list"]').click()
            mobile.open('canvas')
            mobile.workspace.get_by_role('button',name='Fit board',exact=True).tap()
            check_layout(mobile.page,mobile.workspace,'mobile',mob_private,args.screenshots)
            check_mobile_landscape(mobile)
            mobile.context.close()
            for w,h in [(1280,920),(390,844),(844,390)]:
                ctx,page,work=portal(browser,db,args.portal_dist.resolve(),w,h,shared['document']['name'])
                check_layout(page,work,'portal-'+str(w)+'x'+str(h),screenshots=args.screenshots)
                check_menus(page,work)
                work.locator('.workspace-back').click()
                expect(page.locator('section[data-kind="canvas"] form')).to_be_visible()
                ctx.close()
            assert not owner.errors and not mobile.errors,(owner.errors,mobile.errors)
            browser.close()
    finally: db.close()


if __name__=='__main__':main()
