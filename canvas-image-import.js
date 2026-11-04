/* Decode before mutation. Large photos are resized to fit the existing local store. */
async function canvasReadImage(file){
 if(!file||file.size===0)throw Error('The image is empty.');
 if(file.size>25*1024*1024)throw Error('Choose an image up to 25 MB.');
 const type=file.type||({'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp'}[file.name.split('.').pop().toLowerCase()]);
 if(!['image/png','image/jpeg','image/webp'].includes(type))throw Error('Choose PNG, JPEG or WebP. HEIC and SVG are not supported.');
 const raw=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read the image. Try selecting it again.'));reader.readAsDataURL(file);});
 const picture=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('This file could not be decoded as an image.'));img.src=raw;});
 if(!picture.naturalWidth||!picture.naturalHeight)throw Error('The image has no dimensions.');
 if(raw.length<=1800000&&Math.max(picture.naturalWidth,picture.naturalHeight)<=2048&&/^data:image\/(png|jpeg|webp);base64,/.test(raw))return raw;
 const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)throw Error('Image processing is unavailable in this browser.');
 let limit=2048;
 for(let attempt=0;attempt<6;attempt++){
  const scale=Math.min(1,limit/Math.max(picture.naturalWidth,picture.naturalHeight));canvas.width=Math.max(1,Math.round(picture.naturalWidth*scale));canvas.height=Math.max(1,Math.round(picture.naturalHeight*scale));context.drawImage(picture,0,0,canvas.width,canvas.height);
  const result=canvas.toDataURL('image/webp',.86);if(result.length<=1800000&&/^data:image\/(png|jpeg|webp);base64,/.test(result))return result;limit=Math.floor(limit*.7);
 }
 throw Error('The image could not be reduced enough for local storage.');
}
