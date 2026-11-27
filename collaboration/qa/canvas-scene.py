"""Compare the same board in the packaged personal and shared editors at 100% zoom.

Run with --desktop pointing to the extracted app/index.html, optionally --chromium
and --screenshots. Uses isolated synthetic accounts and the production renderer.
"""
import argparse
import importlib.util
from pathlib import Path

from playwright.sync_api import sync_playwright

spec = importlib.util.spec_from_file_location('parity', Path(__file__).with_name('browser-parity.py'))
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


def board():
    return {'id':'c-source', 'name':'Room study', 'nodes':[
        {'id':'reference','kind':'image','title':'Light study','body':'Afternoon light',
         'image':parity.PNG,'x':108,'y':210,'width':238,'height':185},
        {'id':'idea','kind':'note','title':'Lighting direction',
         'body':'A single window. Long shadows across the floor. Keep the room quiet.',
         'x':445,'y':110,'width':246,'height':130},
        {'id':'type','kind':'text','body':'A quiet afternoon','x':75,'y':65,'width':240,'height':108},
        {'id':'details','kind':'checklist','title':'Next pass',
         'body':'[x] Block in the window\n[ ] Deepen the shadows\n[ ] Add the dust in the light',
         'x':505,'y':341,'width':255,'height':166}],
        'edges':[{'id':'e1','from':'reference','to':'idea','label':'Palette','directed':True},
                 {'id':'e2','from':'idea','to':'details','directed':True}]}


def inspect_scene(page, shared):
    return page.evaluate("""shared => {
      const root=shared ? document.querySelector('[data-path-shared-workspace]').shadowRoot : document;
      const node=id=>root.querySelector('['+(shared?'data-node-id':'data-node')+'="'+id+'"]');
      function bounds(rect){return [rect.x,rect.y,rect.width,rect.height];}
      function content(id,selector){
        const el=node(id).querySelector(selector), range=document.createRange();
        range.selectNodeContents(el);
        return {lines:[...range.getClientRects()].map(bounds),size:getComputedStyle(el).fontSize,
                lineHeight:getComputedStyle(el).lineHeight};
      }
      const title=node('idea').querySelector(shared?'.be-copy strong':'.nodetitle');
      const photo=node('reference').querySelector(shared?'image':'img');
      return {
        cards:Object.fromEntries(['reference','idea','type','details'].map(id=>[id,bounds(node(id).getBoundingClientRect())])),
        photo:bounds(photo.getBoundingClientRect()),
        note:content('idea',shared?'.be-copy p':'.nodetext'),
        text:content('type',shared?'.be-copy p':'.nodetext'),
        checklist:content('details',shared?'.be-copy strong':'.nodetitle'),
        showsNoteTitle:!!title?.getBoundingClientRect().height
      };
    }""",shared)


def close_enough(label, first, second):
    assert len(first)==len(second) and max(abs(a-b) for a,b in zip(first,second))<=1.1,(label,first,second)


def same_scene(personal, shared):
    assert not personal['showsNoteTitle'] and not shared['showsNoteTitle']
    for key,rect in personal['cards'].items():
        close_enough(key,rect,shared['cards'][key])
    close_enough('image content',personal['photo'],shared['photo'])
    for key in ('note','text','checklist'):
        x,y=personal[key],shared[key]
        assert (x['size'],x['lineHeight'])==(y['size'],y['lineHeight']),(key,x,y)
        assert len(x['lines'])==len(y['lines']),(key,x,y)
        for i,(a,b) in enumerate(zip(x['lines'],y['lines'])):
            close_enough(f'{key} line {i}',a,b)


def capture(client, folder, name):
    page=client.page
    page.mouse.move(2,2)
    page.evaluate("document.querySelector('[data-path-shared-workspace]')?.shadowRoot.activeElement?.blur();document.activeElement?.blur()")
    page.evaluate("document.fonts.ready")
    if folder: page.screenshot(path=folder/(name+'.png'))
    return inspect_scene(page,name=='shared')


def run(browser,db,desktop,folder):
    original=parity.Client(browser,db,0,desktop)
    original.navigate('canvas')
    original.page.locator('[data-canvas-open="c-source"]').click()
    original.page.locator('#canvas-space').evaluate('el=>{el.scrollLeft=16384;el.scrollTop=16384}')
    assert original.page.locator('[data-canvas-zoom-value]').inner_text()=='100%'
    personal=capture(original,folder,'personal')
    original.context.close()

    owner=parity.Client(browser,db,0,desktop)
    resource=owner.create('canvas')
    world=owner.workspace.locator('.be-world')
    view=world.bounding_box()
    note=next(node for node in board()['nodes'] if node['id']=='idea')
    x,y,*_=personal['cards']['idea']
    center=[view['x']+view['width']/2-(x-note['x']),view['y']+view['height']/2-(y-note['y']),1]
    owner.back()
    key='path.canvas.viewport.1.'+db.users[0]['id']+'.'+resource['id']
    owner.page.evaluate('([key,center])=>localStorage.setItem(key,JSON.stringify(center))',[key,center])
    owner.open('canvas')
    assert abs(float(world.get_attribute('data-zoom'))-1)<.001
    shared=capture(owner,folder,'shared')
    same_scene(personal,shared)
    print('PASS identical 100% scene positions, note and text wrapping, checklist heading and photo dimensions')
    owner.context.close()


def main():
    args=argparse.ArgumentParser(description=__doc__)
    args.add_argument('--desktop',type=Path,required=True)
    args.add_argument('--chromium')
    args.add_argument('--screenshots',type=Path)
    options=args.parse_args()
    if options.screenshots: options.screenshots.mkdir(exist_ok=True,parents=True)
    parity.FIXTURE['canvas']=board()
    db=parity.Database()
    try:
        with sync_playwright() as playwright:
            browser=playwright.chromium.launch(executable_path=options.chromium,args=['--allow-file-access-from-files'])
            run(browser,db,options.desktop,options.screenshots)
            browser.close()
    finally:
        db.close()


if __name__=='__main__': main()
