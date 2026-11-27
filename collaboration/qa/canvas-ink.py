"""Compare live/freehand paths and exercise reversible stroke erasure on a synthetic shared Canvas."""
import argparse
import importlib.util
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

spec = importlib.util.spec_from_file_location('parity', Path(__file__).with_name('browser-parity.py'))
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


def exercise(browser, db, desktop):
    client = parity.Client(browser, db, 0, desktop)
    record = client.create('canvas')
    p, work = client.page, client.workspace
    world = work.locator('.be-world')
    ink = world.locator('[data-kind="drawing"]')
    read = lambda: db.rpc(0, 'get', {'id': record['id']})['document']
    original = read()

    # Compare the account/mobile fallback to the private desktop algorithm, including sealed chunks.
    assert p.evaluate("""() => {
      const mobile = window.PathSharedBoardGeometry.inkSegment;
      const points=Array.from({length:225},(_,i)=>[i*1.2,Math.round(Math.sin(i/7)*30)]);
      const native=canvasInkPath;
      window.canvasInkPath=undefined;
      try {
        return [[0,1,1],[0,2,2],[0,96,100],[96,192,222],[192,225,225]].every(([a,b,count])=>{
          const sample=points.slice(0,count);
          return mobile(sample,a,b)===native(sample,a,b);
        });
      } finally { window.canvasInkPath=native; }
    }""")

    work.locator('.be-toolbar [data-be-action="pen"]').first.click()
    box = world.bounding_box()
    x, y = box['x']+box['width']*.61, box['y']+box['height']*.62
    for offset in (0, 32):
        p.mouse.move(x, y+offset)
        p.mouse.down()
        p.mouse.move(x+110, y+offset+4, steps=30)
        path = world.locator('g[pointer-events="none"] .be-ink').last
        assert 'Q' in path.get_attribute('d')
        p.mouse.up()
        expect(ink).to_have_count(1 if offset == 0 else 2)

    drawn = read()
    assert len(drawn['nodes']) == len(original['nodes']) + 2
    assert all(n['ink']['color']=='#f2f2f0' and n['ink']['size']==4 for n in drawn['nodes'] if n['kind']=='drawing')
    work.locator('[data-be-action="eraser"]').click()
    p.mouse.move(x+50,y-12)
    p.mouse.down()
    p.mouse.move(x+50,y+50,steps=5)
    expect(world.locator('.be-erasing')).to_have_count(2)
    # A cancelled eraser gesture must restore all previews without writing.
    world.dispatch_event('pointercancel',{'pointerId':1})
    p.mouse.up()
    expect(world.locator('.be-erasing')).to_have_count(0)
    assert read()==drawn

    p.mouse.move(x+50,y-12)
    p.mouse.down()
    p.mouse.move(x+50,y+50,steps=2)
    p.mouse.up()
    expect(ink).to_have_count(0)
    assert read()==original
    work.locator('[data-be-action="done"]').click()
    world.press('Control+z')
    expect(ink).to_have_count(2)
    assert read()==drawn
    assert not client.errors, client.errors
    client.context.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--desktop',required=True)
    parser.add_argument('--chromium')
    args = parser.parse_args()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=args.chromium,args=['--no-sandbox'])
        db = parity.Database()
        try:
            exercise(browser,db,Path(args.desktop))
            print('Personal/shared stroke curves, live preview, cancellation, erasure and undo passed.')
        finally:
            db.close()
            browser.close()
