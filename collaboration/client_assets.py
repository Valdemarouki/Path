"""Bundle the same collaboration editor scripts and styles for every Path client."""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = json.loads((HERE / 'client-assets.json').read_text(encoding='utf-8'))


def bundle(kind):
    return '\n'.join((HERE / name).read_text(encoding='utf-8') for name in ASSETS[kind])


def board_marker(css):
    return css[css.index('.path-shared-mark{'):css.index('.item .path-shared-mark')]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--script', type=Path, required=True)
    parser.add_argument('--style', type=Path, required=True)
    args = parser.parse_args()
    script, style = bundle('scripts'), bundle('styles')
    args.script.write_bytes(script.encode('utf-8'))
    args.style.write_bytes(style.encode('utf-8'))
