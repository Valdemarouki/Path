"""Check the actual local variable font and requested scripts; does not install tools."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
import hashlib
import json

root = Path(__file__).resolve().parent
source = root / 'fonts/Manrope-Variable.ttf'
font = TTFont(source)
cmap = font.getBestCmap()
axis = next(a for a in font['fvar'].axes if a.axisTag == 'wght')
assert (axis.minValue, axis.defaultValue, axis.maxValue) == (200, 200, 800)
assert not font['head'].macStyle & 2
assert font['post'].italicAngle == 0
samples = {
    'russian': 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя',
    'spanish': 'ÁÉÍÓÚÜÑáéíóúüñ¿¡',
    'headings': 'TodayСегодняHoy',
}
for label, text in samples.items():
    missing = [c for c in text if ord(c) not in cmap]
    assert not missing, (label, missing)
outlines = {}
for weight in (200, 300, 400, 500):
    instance = instantiateVariableFont(font, {'wght': weight}, inplace=False)
    outlines[str(weight)] = hashlib.sha256(instance['glyf'].compile(instance)).hexdigest()
assert len(set(outlines.values())) == 4, 'Requested weights must have distinct real outlines.'
report = {
    'family': font['name'].getDebugName(16),
    'subfamily': font['name'].getDebugName(17),
    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'weight_axis': [axis.minValue, axis.defaultValue, axis.maxValue],
    'style': 'upright, not synthetic italic',
    'coverage': {key: 'complete' for key in samples},
    'outline_sha256_by_weight': outlines,
}
print(json.dumps(report, ensure_ascii=False, indent=2))
