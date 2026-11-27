"""Check board-local copy/paste and linked object creation in the packaged editor.
Pass --desktop app/index.html and optionally --chromium /path/to/chrome.
"""
import argparse
import importlib.util
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

spec = importlib.util.spec_from_file_location('parity', Path(__file__).with_name('browser-parity.py'))
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


def center(element):
    box = element.bounding_box()
    return box['x'] + box['width']/2, box['y'] + box['height']/2


def exercise(browser, db, desktop):
    owner = parity.Client(browser, db, 0, desktop)
    viewer = parity.Client(browser, db, 2, desktop)
    board = owner.create('canvas')
    db.grant(board, 2, 'viewer')
    viewer.open('canvas')
    p, work = owner.page, owner.workspace
    world = work.locator('.be-world')
    cards = world.locator('[data-node-id]')
    read = lambda: db.rpc(0, 'get', {'id':board['id']})['document']
    original = read()
    assert len(original['nodes']) == 4
    expect(viewer.workspace.locator('[data-be-action="pasteCards"]')).to_have_count(0)
    world.press('Control+a')
    p.keyboard.press('Control+c')
    p.keyboard.press('Control+v')
    expect(cards).to_have_count(7)
    copied = read()
    originals = {n['id'] for n in original['nodes']}
    pasted = [n for n in copied['nodes'] if n['id'] not in originals]
    assert all(n['kind'] != 'restricted' for n in pasted)
    pasted_ids = {n['id'] for n in pasted}
    assert len(copied['edges']) == 2
    assert any(e['from'] in pasted_ids and e['to'] in pasted_ids for e in copied['edges'])
    assert sorted((n['x'], n['y']) for n in pasted) == sorted(
        (n['x'] + 32, n['y'] + 32) for n in original['nodes'] if n['kind'] != 'restricted')
    world.press('Control+z')
    expect(cards).to_have_count(4)
    assert read() == original

    # Copying a frame alone includes its contained cards and their internal connections.
    world.press('Control+a')
    work.locator('[data-be-action="groupSelection"]').click()
    expect(cards).to_have_count(5)
    work.locator('.be-more > summary').click()
    work.locator('[data-be-action="copyCards"]').click()
    work.locator('.be-more > summary').click()
    work.locator('[data-be-action="pasteCards"]').click()
    expect(cards).to_have_count(9)
    framed = read()
    assert sum(n['kind'] == 'group' for n in framed['nodes']) == 2
    assert len(framed['edges']) == 2
    world.press('Control+z')
    expect(cards).to_have_count(5)
    world.press('Control+z')
    expect(cards).to_have_count(4)
    assert read() == original

    # The native paste event gives an externally copied image priority over the internal snapshot.
    world.focus()
    p.keyboard.down('Control')
    p.keyboard.down('v')
    world.evaluate('''(svg, url) => {
      const bytes = Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], 'study.png', {type:'image/png'}));
      svg.dispatchEvent(new ClipboardEvent('paste', {bubbles:true, cancelable:true, clipboardData:data}));
    }''', parity.PNG)
    p.keyboard.up('v')
    p.keyboard.up('Control')
    expect(cards).to_have_count(5)
    assert sum(n['kind'] == 'image' for n in read()['nodes']) == 2
    world.press('Control+z')
    expect(cards).to_have_count(4)
    assert read() == original

    source = world.locator('[data-node-id="n-scene"]')
    target = world.locator('[data-node-id="n-light"]')
    # Click the outer card instead of its directly editable body.
    def draw_wire(to_target=False):
        source.locator('.be-node-outline').click(position={'x':60, 'y':4})
        handle = world.locator('[data-source="n-scene"][data-port="right"]')
        start = center(handle)
        p.mouse.move(*start)
        p.mouse.down()
        if to_target:
            end = center(target)
        else:
            rect = world.bounding_box()
            end = (rect['x']+rect['width']*.83, rect['y']+rect['height']*.73)
        p.mouse.move(*end, steps=9)
        assert 'C' in world.locator('.be-wire-preview').get_attribute('d')
        if to_target:
            expect(target).to_have_class(re.compile('be-connect-target'))
        p.mouse.up()

    chooser = work.get_by_role('dialog', name='Add connected card')
    draw_wire()
    expect(chooser.get_by_role('button')).to_have_count(4)
    p.keyboard.press('Escape')
    expect(chooser).to_have_count(0)
    assert read() == original
    draw_wire(to_target=True)
    expect(world.locator('[data-edge-from="n-scene"][data-edge-to="n-light"]')).to_have_count(1)
    world.press('Control+z')
    expect(world.locator('[data-edge-from="n-scene"][data-edge-to="n-light"]')).to_have_count(0)
    draw_wire()
    with p.expect_file_chooser() as selected:
        chooser.get_by_role('button', name='Add image').click()
    selected.value.set_files(Path(__file__).with_name('fixtures')/'room-study.png')
    expect(cards).to_have_count(5)
    after = read()
    photo = next(n for n in after['nodes'] if n['id'] not in originals)
    assert photo['kind'] == 'image' and photo['image'].startswith('data:image/')
    assert any(e['from'] == 'n-scene' and e['to'] == photo['id'] and e['fromSide'] == 'right' for e in after['edges'])
    world.press('Control+z')
    expect(cards).to_have_count(4)
    assert read() == original

    owner.back()
    owner.open('canvas')
    work.locator('.be-more > summary').click()
    expect(work.locator('[data-be-action="pasteCards"]')).to_be_disabled()
    assert not owner.errors and not viewer.errors, (owner.errors, viewer.errors)
    owner.context.close()
    viewer.context.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--desktop', required=True)
    parser.add_argument('--chromium')
    args = parser.parse_args()
    with sync_playwright() as driver:
        browser = driver.chromium.launch(executable_path=args.chromium, args=['--no-sandbox'])
        db = parity.Database()
        try:
            exercise(browser, db, args.desktop)
            print('Canvas copy/paste, connected-card creation, undo, privacy and scope passed.')
        finally:
            db.close()
            browser.close()
