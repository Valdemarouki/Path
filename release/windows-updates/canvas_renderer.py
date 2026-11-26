"""Port Canvas into the pinned desktop HTML, retaining its newer calendar, shell and sync."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Review desktop integration point: ' + old[:90])
    return text.replace(old, new, 1)


def section(text, start, end):
    begin = text.index(start)
    return text[begin:text.index(end, begin + len(start))]


def apply_canvas(html):
    def source(name):
        return (ROOT / name).read_text(encoding='utf8')

    def port(file, start, end):
        nonlocal html
        html = replace_once(html, section(html, start, end), section(source(file), start, end))

    def port_line(file, start):
        port(file, start, '\n')

    for file, end in [
        ('canvas-camera.js', '/* Decode before mutation.'),
        ('canvas-collapse.js', 'let canvasLibraryQuery='),
        ('canvas-groups.js', 'function updateCanvasConnection('),
        ('canvas-interactions.js', '/* Content sizing runs only'),
    ]:
        module = source(file).strip()
        old = section(html, module.splitlines()[0], end)
        html = replace_once(html, old, module + '\n\n')

    workspace = 'canvas-workspace.js'
    anchor = 'let canvasGesture=null,canvasSpaceHeld=false'
    html = replace_once(html, anchor, source('canvas-ink.js') + '\n' + anchor)
    port_line(workspace, 'function canvasDimensions(')
    port_line(workspace, 'modalNode=function(){const c=data.canvases.find(c=>c.id===canvasId),n=c?.nodes.find(n=>n.id===canvasSelected);if(!n')
    port(workspace, "document.addEventListener('pointerup',e=>{const op=canvasGesture;", 'function cancelCanvasGesture(')
    port_line(workspace, "document.addEventListener('click',e=>{const b=e.target.closest('[data-canvas-kind]")
    # Keep the production card/image markup; change only the drawing branches.
    for start, end in [('const n=canvasNodeView(original);', 'return `<div class="canvas-node'),
                       ("${canvasSelected", "'<button class=\"btn small\" data-canvas-edit>")]:
        production = section(html, 'canvasDetail=function(c){const vp=', '\n')
        current = section(source(workspace), 'canvasDetail=function(c){const vp=', '\n')
        if start == '${canvasSelected':
            start = '</button>${canvasSelected'
        updated = replace_once(production, section(production,start,end), section(current,start,end))
        html = replace_once(html, production, updated)
    port_line('canvas-library.js', 'function canvasThumbnail(')
    css = source('canvas-design.css')
    html = replace_once(html, '</head>', '<style>' + css[css.index('.canvas-ink-options{'):] + '</style></head>')

    storage = source('storage.js')
    for first, anchor in [('function pathValidCanvasInk(', 'function pathValidate(state){'),
                          ('// Viewports are saved with the board', 'class PathRepository{')]:
        html = replace_once(html, anchor, section(storage, first, anchor) + anchor)
    port_line('storage.js', '  for(const n of c.nodes){if(')
    # Existing sync acknowledgement migration must run before filtering old camera steps.
    anchor = '   }else{\n    const legacy=this.storage.getItem(this.legacyKey);'
    html = replace_once(html, anchor,
        '    this.undo=pathLoadHistory(this.undo,pathUndoState(this.state));\n'
        '    this.redo=pathLoadHistory(this.redo,pathUndoState(this.state));\n' + anchor)
    html = replace_once(html, 'else if(!same){undo.push(pathClone(previous))',
        'else if(!same&&!pathJsonEqual(pathHistoryContent(next),pathHistoryContent(this.state))){undo.push(pathClone(previous))')
    html = replace_once(html, " history(direction){const list=direction==='undo'", " history(direction,liveBoards=this.state.canvases){const list=direction==='undo'")
    html = replace_once(html, 'return this.commit(snapshot,direction);', 'return this.commit(pathWithCanvasViews(snapshot,liveBoards),direction);')
    ui = source('storage-ui.js')
    anchor = ' if(pathRepository.history(direction))'
    html = replace_once(html, anchor, section(ui, ' // A keyboard shortcut can precede', '){pathRestore(data,pathRepository.state);') + ')')
    anchor = " if(e.key.toLowerCase()==='z')"
    html = replace_once(html, section(html,anchor,'\n});'), section(ui,' const key=e.key.toLowerCase();','\n});'))

    labels = {'Freehand pen','Drawing tools','Pen color','Stroke width','Erase stroke','Freehand drawing','Delete stroke'}
    translations = {key:values for key,*values in (row.split('\t') for row in source('i18n/messages.tsv').splitlines()) if key in labels}
    assert translations.keys() == labels
    anchor = 'const PATH_TRANSLATIONS='
    html = replace_once(html, anchor + '{', anchor + json.dumps(translations, ensure_ascii=False)[:-1] + ',')
    return html
