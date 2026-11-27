"""Owner and member workflows for shared Canvas in the packaged desktop and account portal.

Pass --desktop app/index.html, --portal-dist dist, and optionally --chromium.
Every board, account, email and action is confined to the local test database.
"""
import argparse
import importlib.util
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


portal = load_module('canvas_viewport', 'canvas-viewport.py').portal
parity = load_module('canvas_parity', 'browser-parity.py')


def action(scope, key):
    return scope.locator(f'[data-canvas-action="{key}"]')


def cloud_canvas(db, name):
    return db.rpc(0, 'create', {
        'kind':'canvas', 'source':name,
        'document':{'name':name, 'nodes':[{'id':'cloud-text','kind':'text','body':'Cloud original',
                                           'x':80,'y':100,'width':240,'height':120}], 'edges':[]}})


def activate_card_action(card, key):
    button = action(card, key)
    if not button.is_visible():
        card.locator('details:has([data-canvas-action]) > summary').click()
    button.click()


def confirm(page, label, cancel=False):
    dialog = page.get_by_role('dialog')
    expect(dialog).to_be_visible()
    dialog.get_by_role('button',name='Cancel' if cancel else label,exact=True).click()
    expect(dialog).to_have_count(0)


def assert_revoked(db, record):
    for actor in (0,1,2):
        head=db.rpc(actor, 'list', {})
        assert record['id'] not in {r['id'] for r in head['resources']}
        assert record['document']['name'] not in {i['name'] for i in head['inbox']}
        assert 'error' in db.reply(actor, 'get', {'id':record['id']})


def desktop(browser, db, filename):
    owner=parity.Client(browser, db, 0, filename)
    editor=parity.Client(browser, db, 1, filename)
    # Actual cloud-only owner card. No corresponding source exists on this machine.
    orphan=cloud_canvas(db, 'asd')
    db.grant(orphan,1,'editor')
    db.rpc(0,'invite',{'id':orphan['id'],'email':db.users[2]['email'],'role':'viewer'})
    owner.navigate('canvas');editor.navigate('canvas')
    selector=f'[data-shared-card="{orphan["id"]}"]'
    card=owner.page.locator(selector)
    member_card=editor.page.locator(selector)
    expect(card).to_be_visible();expect(member_card).to_be_visible()
    expect(action(member_card,'delete-canvas')).to_have_count(0)
    member_card.get_by_role('button',name='asd',exact=False).first.click()
    editor.workspace.locator('.board-options > summary').click()
    expect(action(editor.workspace,'delete-canvas')).to_have_count(0)
    expect(action(editor.workspace,'make-private')).to_have_count(0)
    for command in ('delete-canvas','make-private'):
        assert 'error' in db.reply(1,command,{'id':orphan['id'],'revision':orphan['revision']})
    activate_card_action(card,'delete-canvas')
    confirm(owner.page,'Delete canvas',cancel=True)
    assert db.rpc(0,'get',{'id':orphan['id']})['document']==orphan['document']
    expect(card).to_be_visible()
    activate_card_action(card,'delete-canvas')
    confirm(owner.page,'Delete canvas')
    expect(card).to_have_count(0)
    assert_revoked(db,orphan)
    owner.page.reload()
    owner.navigate('canvas')
    expect(owner.page.locator(selector)).to_have_count(0)

    # Restore the synthetic checkpoint after the deliberate reload. This board contains
    # an image and an owner-only local note reference which projects as a restricted card.
    owner.page.evaluate("""f=>{
      if(!data.canvases.some(n=>n.id===f.id)){data.canvases.push(f);save();render();}
    }""",parity.FIXTURE['canvas'])
    resource=owner.create('canvas')
    db.grant(resource,1,'editor')
    db.rpc(0,'invite',{'id':resource['id'],'email':db.users[2]['email'],'role':'viewer'})
    server=db.rpc(1,'get',{'id':resource['id']})
    assert next(n for n in server['document']['nodes'] if n['id']=='n-private')['kind']=='restricted'
    next(n for n in server['document']['nodes'] if n['id']=='n-scene')['body']='Latest edit from participant'
    db.rpc(1,'save',{'id':resource['id'],'revision':server['revision'],'document':server['document']})
    owner.back();owner.open('canvas')
    owner.workspace.locator('.board-options > summary').click()
    action(owner.workspace,'make-private').click()
    confirm(owner.page,'Make private')
    expect(owner.workspace).to_have_count(0)
    assert_revoked(db,resource)
    personal=owner.page.locator('[data-canvas-open="c-source"]')
    expect(personal).to_be_visible()
    expect(personal.locator('.path-shared-mark')).to_have_count(0)
    personal.click()
    expect(owner.page.locator('#canvas-space')).to_be_visible()
    expect(owner.page.locator('[data-node="n-scene"]')).to_contain_text('Latest edit from participant')
    local_board=owner.page.evaluate("data.canvases.find(b=>b.id==='c-source')")
    protected=next(n for n in local_board['nodes'] if n['id']=='n-private')
    assert protected['noteId']=='private-source' and protected['body']=='REMEMBER_PRIVATE_TEST',protected
    assert next(n for n in local_board['nodes'] if n['id']=='n-photo')['image']==parity.PNG
    owner.page.reload()
    owner.navigate('canvas')
    if owner.page.locator('#canvas-space').is_visible():
        expect(owner.page.locator('[data-node="n-scene"]')).to_contain_text('Latest edit from participant')
        owner.page.locator('[data-canvas-back]').first.click()
    expect(personal).to_be_visible()
    expect(personal.locator('.path-shared-mark')).to_have_count(0)
    assert owner.page.evaluate("data.canvases.filter(b=>b.id==='c-source').length")==1
    # New personal edits must survive reapplying the same server change on the next startup.
    owner.page.evaluate("""()=>{
      data.canvases.find(b=>b.id==='c-source').name='My private edit';
      save();render();
    }""")
    owner.page.reload();owner.navigate('canvas')
    assert owner.page.evaluate("data.canvases.find(b=>b.id==='c-source').name")=='My private edit'
    assert not owner.errors and not editor.errors,(owner.errors,editor.errors)
    owner.context.close();editor.context.close()


def account_portal(browser, db, dist):
    resource=cloud_canvas(db,'Portal board')
    db.grant(resource,1,'editor')
    ctx,page,work=portal(browser,db,dist.resolve(),1280,920,'Portal board')
    work.locator('.board-options > summary').click()
    action(work,'make-private').click()
    confirm(page,'Make private')
    expect(work).to_have_count(0)
    assert_revoked(db,resource)
    snapshot=db.rpc(0,'get-private-canvas',{'id':resource['id']})
    assert snapshot['document']['nodes'][0]['body']=='Cloud original'
    assert 'error' in db.reply(1,'get-private-canvas',{'id':resource['id']})
    page.reload()
    expect(page.locator('section[data-kind="canvas"] form')).to_be_visible()
    private=page.locator('[data-private-canvases]')
    expect(private).to_contain_text('Portal board')
    # There can be multiple converted boards for this synthetic owner. Select the one by its label.
    download_button=private.get_by_text('Portal board',exact=True).locator('..').locator('[data-download-private-canvas]')
    with page.expect_download() as download:
        download_button.click()
    saved=json.loads(download.value.path().read_text())
    assert saved['format']=='path-canvas' and saved['version']==1,saved
    ordinary=saved['board']
    assert ordinary['name']=='Portal board' and ordinary['nodes'][0]['body']=='Cloud original',ordinary
    assert 'pathPrivateFrom' not in ordinary
    ctx.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--desktop',type=Path,required=True)
    parser.add_argument('--portal-dist',type=Path,required=True)
    parser.add_argument('--chromium')
    options=parser.parse_args()
    db=parity.Database()
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=options.chromium,args=['--allow-file-access-from-files'])
            desktop(browser,db,options.desktop)
            account_portal(browser,db,options.portal_dist)
            browser.close()
            print('PASS cloud-only owner deletion, cancel, permissions and revocation, normal private board recovery and portal handoff')
    finally:
        db.close()
