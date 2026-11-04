"""Render the approved Path SVG as rounded Windows/installer artwork.
Requires cairosvg + Pillow; motion frames are decorative, never fake progress.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import io, math, cairosvg
base=Path(__file__).resolve().parent; root=base/'build';root.mkdir(exist_ok=True)
svg=(base.parent/'assets/path-logo.svg').read_text().replace('currentColor','#c8c8c8');(root/'path-logo.svg').write_text(svg)
logo=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=320,output_height=324))).convert('RGBA')
# Supersampled rounded tile: transparent corners in every ICO size.
scale=4; tile=Image.new('RGBA',(512*scale,512*scale));draw=ImageDraw.Draw(tile)
draw.rounded_rectangle((4,4,512*scale-5,512*scale-5),radius=104*scale,fill='#191a1d',outline='#383a3e',width=3*scale)
icon=tile.resize((512,512),Image.Resampling.LANCZOS);icon.alpha_composite(logo,((512-logo.width)//2,(512-logo.height)//2))
icon.save(root/'path.ico',sizes=[(16,16),(20,20),(24,24),(32,32),(40,40),(48,48),(64,64),(128,128),(256,256)]);icon.save(root/'path.png')
font=next((p for p in [Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),Path('C:/Windows/Fonts/segoeui.ttf')] if p.exists()),None)
if not font:raise RuntimeError('Install DejaVu Sans or Segoe UI to regenerate installer assets')
def artwork(frame=None):
 s=3;im=Image.new('RGB',(164*s,314*s),'#111214');d=ImageDraw.Draw(im)
 # Quiet monochrome particle field. One broad wave crosses the lower field.
 phase=0 if frame is None else frame/64
 for row in range(14):
  for col in range(9):
   x=22+15*col;y=178+9*row
   center=170+155*phase
   wave=0 if frame is None else math.exp(-((y-center)/34)**2)*math.sin(math.pi*phase)**2
   v=int(34+52*wave);r=(.6+.35*wave)*s
   d.ellipse((x*s-r,y*s-r,x*s+r,y*s+r),fill=(v,v,v))
 # Subtle architectural framing and an illuminated path, behind the logo.
 d.rounded_rectangle((14*s,14*s,150*s,300*s),radius=16*s,outline='#292b30',width=s)
 for i in range(4):
  x=(29+i*28)*s
  d.line((x,201*s,x,259*s),fill='#292b30',width=s)
 d.line((24*s,195*s,141*s,195*s),fill='#383a3f',width=s)
 d.line((24*s,264*s,141*s,264*s),fill='#383a3f',width=s)
 d.arc((17*s,170*s,146*s,296*s),185,340,fill='#55575d',width=s)
 mark=icon.resize((88*s,88*s),Image.Resampling.LANCZOS);im.paste(mark,(38*s,38*s),mark)
 d.text((37*s,142*s),'Path',font=ImageFont.truetype(str(font),32*s),fill='#dedede')
 d.text((53*s,282*s),'2.0',font=ImageFont.truetype(str(font),13*s),fill='#74767b')

 return im.resize((164,314),Image.Resampling.LANCZOS)
artwork().save(root/'installerSidebar.bmp')
frames=root/'motion';frames.mkdir(exist_ok=True)
for i in range(64):artwork(i).save(frames/f'wave-{i}.bmp')
header=Image.new('RGB',(150,57),'#111214');mark=icon.resize((40,40),Image.Resampling.LANCZOS);header.paste(mark,(9,8),mark);ImageDraw.Draw(header).text((60,12),'Path',font=ImageFont.truetype(str(font),22),fill='#dddddd');header.save(root/'installerHeader.bmp')
for name,size in [('Square44x44Logo',44),('Square150x150Logo',150),('StoreLogo',50)]:icon.resize((size,size),Image.Resampling.LANCZOS).save(root/(name+'.png'))
print('Rounded ICO/PNG, NSIS artwork and 64 decorative wave frames generated')
