// Canvas helpers used on desktops and in the mobile and account-only clients.
(() => {
  const IMAGE_URL_LIMIT = 1800000;
  const MAX_IMAGE_SIDE = 2048;
  const MIME_BY_EXTENSION = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp' };
  const VECTORS = new Map([['left',[-1,0]], ['right',[1,0]], ['top',[0,-1]], ['bottom',[0,1]]]);

  function finite(value, fallback) {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return fallback;
    const result = Number(value);
    return Number.isFinite(result) ? Math.min(100000, Math.max(-100000, result)) : fallback;
  }

  function geometry(node, index=0) {
    const ink = node.kind === 'drawing' ? node.ink : null;
    const width = finite(node.w ?? node.width ?? ink?.width, 280);
    const height = finite(node.h ?? node.height ?? ink?.height, 180);
    return {
      x:finite(node.x, 40+(index%4)*300), y:finite(node.y, 40+Math.floor(index/4)*200),
      w:Math.max(1, width), h:Math.max(1, height)
    };
  }

  function anchor(box, side) {
    return { x:box.x + (side==='left' ? 0 : side==='right' ? box.w : box.w/2),
             y:box.y + (side==='top' ? 0 : side==='bottom' ? box.h : box.h/2) };
  }

  function curve(a, b, edge={}) {
    a=geometry(a); b=geometry(b);
    const dx=b.x+b.w/2-a.x-a.w/2, dy=b.y+b.h/2-a.y-a.h/2;
    const sides = Math.abs(dx)>=Math.abs(dy)
      ? (dx>=0 ? ['right','left'] : ['left','right'])
      : (dy>=0 ? ['bottom','top'] : ['top','bottom']);
    const from = VECTORS.has(edge.fromSide) ? edge.fromSide : sides[0];
    const to = VECTORS.has(edge.toSide) ? edge.toSide : sides[1];
    const start=anchor(a,from), end=anchor(b,to);
    const reach=Math.max(40,Math.min(220,Math.hypot(end.x-start.x,end.y-start.y)*.45));
    const [ux,uy]=VECTORS.get(from), [vx,vy]=VECTORS.get(to);
    const d='M'+start.x+' '+start.y+' C'+(start.x+reach*ux)+' '+(start.y+reach*uy)+','+
      (end.x+reach*vx)+' '+(end.y+reach*vy)+','+end.x+' '+end.y;
    return {
      d, labelX:(start.x+end.x)/2, labelY:(start.y+end.y)/2-8, directed:edge.directed!==false,
      lineWidth:[1,1.5,2.5].includes(edge.lineWidth) ? edge.lineWidth : 1.5,
      lineStyle:edge.lineStyle==='dashed' ? 'dashed' : 'solid'
    };
  }

  function validInk(ink) {
    return ink && Number.isFinite(ink.width) && ink.width>0 && Number.isFinite(ink.height) && ink.height>0 &&
      [2,4,8,12].includes(ink.size) && typeof ink.color==='string' && /^#[0-9a-f]{6}$/i.test(ink.color) &&
      Array.isArray(ink.points) && ink.points.length>=2 &&
      ink.points.every(p=>Array.isArray(p) && p.length===2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
        p[0]>=0 && p[0]<=ink.width && p[1]>=0 && p[1]<=ink.height);
  }

  function cleanInk(ink) {
    if (!validInk(ink)) return null;
    return { width:ink.width, height:ink.height, size:ink.size, color:ink.color, points:ink.points.map(([x,y])=>[x,y]) };
  }

  function inkPath(ink) {
    if (!validInk(ink)) return '';
    // Use the desktop stroke smoothing when present. The mobile fallback follows the same knots.
    if (typeof canvasInkPath === 'function') return canvasInkPath(ink.points);
    const points=ink.points, format=p=>Math.round(p[0]*100)/100+','+Math.round(p[1]*100)/100;
    const knot=i=>{
      const p=points[i];
      if (i===0 || i===points.length-1) return p;
      const dx=(points[i-1][0]+points[i+1][0]-2*p[0])/4, dy=(points[i-1][1]+points[i+1][1]-2*p[1])/4;
      const weight=1/Math.max(1,Math.hypot(dx,dy)/1.5);
      return [p[0]+dx*weight,p[1]+dy*weight];
    };
    let p=knot(0), d='M'+format(p);
    if(points.length===2) return d+'L'+format(points[1]);
    for(let i=0;i<points.length;i++){
      const next=i+1<points.length ? knot(i+1) : p;
      d+='Q'+format(p)+' '+format([(p[0]+next[0])/2,(p[1]+next[1])/2]);
      p=next;
    }
    return d;
  }

  // Verify the file actually contains one of the raster formats the Canvas accepts.
  function rasterType(bytes) {
    if (bytes.length>=8 && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)) return 'image/png';
    if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
    if (String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return 'image/webp';
    return '';
  }

  async function readImage(file, remainingBytes=IMAGE_URL_LIMIT) {
    if (!file?.size) throw Error('IMAGE_EMPTY');
    if (file.size>25*1024*1024) throw Error('IMAGE_SIZE');
    const declared=file.type || MIME_BY_EXTENSION[String(file.name||'').split('.').pop().toLowerCase()];
    const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
    if (!declared || rasterType(bytes)!==declared) throw Error('IMAGE_TYPE');
    const budget=Math.min(IMAGE_URL_LIMIT, Math.floor(remainingBytes));
    if (!(budget>0)) throw Error('IMAGE_BUDGET');

    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);reader.onerror=reader.onabort=()=>reject(Error('IMAGE_DECODE'));
      reader.readAsDataURL(file.type===declared ? file : file.slice(0,file.size,declared));
    });
    const picture=await new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);img.onerror=()=>reject(Error('IMAGE_DECODE'));img.src=data;
    });
    const w=picture.naturalWidth,h=picture.naturalHeight;
    if (!w || !h) throw Error('IMAGE_DECODE');
    const displayScale=Math.min(420/w,320/h,1);
    const width=Math.max(1,Math.round(w*displayScale)),height=Math.max(1,Math.round(h*displayScale));
    if (data.length<=budget && Math.max(w,h)<=MAX_IMAGE_SIDE) return {image:data,width,height};

    const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    if (!context) throw Error('IMAGE_DECODE');
    let limit=Math.min(MAX_IMAGE_SIDE, Math.max(w,h));
    while (limit>=1) {
      const scale=Math.min(limit/Math.max(w,h),1);
      canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
      context.drawImage(picture,0,0,canvas.width,canvas.height);
      // Some WebViews fall back to PNG when WebP encoding is unavailable.
      const image=canvas.toDataURL('image/webp',.86);
      if (/^data:image\/(webp|png);base64,/.test(image) && image.length<=budget) return {image,width,height};
      limit=Math.floor(limit*.7);
    }
    throw Error('IMAGE_BUDGET');
  }

  globalThis.PathSharedBoardGeometry=Object.freeze({geometry,curve,cleanInk,inkPath,readImage});
})();
