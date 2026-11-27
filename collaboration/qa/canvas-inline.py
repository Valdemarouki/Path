"""Run the shared card editor in a real browser with delayed and conflicting writes."""
import argparse
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


def run(browser):
    page = browser.new_page(viewport={'width': 960, 'height': 720})
    root = Path(__file__).resolve().parents[1]
    page.route('https://canvas.test/', lambda route: route.fulfill(content_type='text/html', body='<div id="host"></div>'))
    page.goto('https://canvas.test/')
    for script in ('board-geometry.js', 'board-editor.js'):
        page.add_script_tag(path=str(root / script))
    page.evaluate("""css => {
      const shadow = host.attachShadow({mode:'open'}), style = document.createElement('style');
      style.textContent = css;
      shadow.append(style);
      window.board = {nodes:[{id:'a', kind:'text', title:'First', body:'Original text', x:80,y:60,width:260,height:180},
                             {id:'b',kind:'checklist',title:'List',body:'[x] One',x:410,y:140,width:245,height:200}],
                      edges:[], name:'Shared'};
      window.cam = {};
      window.writes = 0;
      window.mount = writable => {
        const view=PathSharedBoardEditor.mount({doc:structuredClone(board),writable,camera:cam,
          bindCursors:svg=>svg,readLatest:()=>structuredClone(board),commit:async transform=>{
            if(window.hold)await new Promise(resolve=>window.resume=resolve);
            window.writes++;
            board=transform(structuredClone(board));
            return structuredClone(board);
          }});
        shadow.querySelector('section')?.remove();shadow.append(view);
      };
      mount(true);
    }""", (root / 'board-editor.css').read_text())
    node = page.locator('[data-node-id="a"]')
    form = page.locator('.be-inline-editor form')
    body = form.locator('textarea')
    node.focus()
    start = node.bounding_box()
    node.press('Enter')
    expect(body).to_be_focused()
    anchor = form.bounding_box()
    assert abs(start['x'] - anchor['x']) < 4 and abs(start['y'] - anchor['y']) < 4, (start, anchor)
    page.evaluate("board.nodes[0].title='Changed elsewhere';window.hold=true")
    body.fill('Still typing')
    page.wait_for_function('typeof resume === "function"')
    body.fill('Typed during write')
    page.evaluate('window.hold=false;resume()')
    page.wait_for_function("board.nodes[0].body==='Typed during write'")
    expect(body).to_be_focused()
    expect(form.locator('[name=title]')).to_have_value('Changed elsewhere')
    body.press('Escape')
    expect(form).to_have_count(0)

    # Clicking a visible glyph places the insertion point within its actual text.
    glyph = node.locator('[data-be-field=body]')
    point = glyph.evaluate("""el=>{
      const range=document.createRange();
      range.setStart(el.firstChild,2);range.setEnd(el.firstChild,3);
      const box=range.getBoundingClientRect();return [box.x+box.width*.15,box.y+box.height/2];
    }""")
    page.mouse.click(*point)
    expect(body).to_be_focused()
    assert body.evaluate('el=>el.selectionStart') in (2, 3)
    body.fill('Leaving immediately')
    page.evaluate('window.hold=true;window.resume=null')
    body.press('Control+Enter')
    page.wait_for_function('typeof resume==="function"')
    page.evaluate('window.flushed=cam.boardUI.finishInline();window.hold=false;resume()')
    assert page.evaluate('flushed')
    assert page.evaluate('board.nodes[0].body') == 'Leaving immediately'
    expect(form).to_have_count(0)

    # A background click completes editing while preserving the board viewport.
    node.press('Enter')
    original_camera = page.locator('svg.be-world').get_attribute('viewBox')
    body.fill('Background commit')
    stage = page.locator('.be-stage').bounding_box()
    page.mouse.click(stage['x']+8,stage['y']+stage['height']*.72)
    expect(form).to_have_count(0)
    assert page.evaluate('board.nodes[0].body') == 'Background commit'
    assert page.locator('svg.be-world').get_attribute('viewBox') == original_camera

    # Conflict should keep all the text, including selection for copying.
    node.press('Enter')
    page.evaluate("board.nodes[0].body='Another editor'")
    body.fill('My draft')
    body.press('Control+Enter')
    expect(form.locator('[data-be-action=reload]')).to_be_visible()
    expect(body).to_have_value('My draft')
    form.locator('[data-be-action=reload]').click()
    expect(body).to_have_value('Another editor')
    body.press('Escape')

    # An empty new note produces no record. Composition cannot be interrupted by autosave or Escape.
    original_writes = page.evaluate('writes')
    page.locator('svg.be-world').press('n')
    body.press('Escape')
    assert page.evaluate('writes') == original_writes
    page.locator('svg.be-world').press('n')
    body.dispatch_event('compositionstart')
    body.fill('日本語')
    body.press('Escape')
    page.wait_for_timeout(700)
    assert page.evaluate('writes') == original_writes
    body.dispatch_event('compositionend')
    page.wait_for_function("board.nodes.some(n => n.body==='日本語')")
    body.press('Escape')
    assert page.evaluate('board.nodes.length') == 3

    # Touch/keyboard accessible add-item button opens at the new row; Enter creates another.
    add = page.locator('[data-be-add-item="b"]')
    add.focus()
    add.press('Enter')
    expect(body).to_have_value('[x] One\n[ ] ')
    body.press('End')
    body.press('T')
    body.press('Enter')
    body.press('Z')
    body.press('Control+Enter')
    expect(form).to_have_count(0)
    assert page.evaluate("board.nodes.find(n=>n.id==='b').body") == '[x] One\n[ ] T\n[ ] Z'

    # A role downgrade cancels pending debounce and the unsaved draft is copyable.
    node.press('Enter')
    body.fill('Keep this text')
    original_writes = page.evaluate('writes')
    page.evaluate('mount(false)')
    expect(body).to_have_value('Keep this text')
    assert body.evaluate('el=>el.readOnly')
    page.wait_for_timeout(700)
    assert page.evaluate('writes') == original_writes
    form.locator('[data-be-action=close]').click()
    node.press('Enter')
    assert page.locator('form [name=body]').evaluate('el=>el.readOnly')
    expect(form).to_have_count(0)
    page.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(__doc__)
    parser.add_argument('--chromium')
    args = parser.parse_args()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=args.chromium, args=['--no-sandbox'])
        run(browser)
        browser.close()
    print('Inline card editing passed')
