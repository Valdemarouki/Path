// Picker arithmetic only. These helpers never touch repository data or dates.
export const pad = n => String(n).padStart(2,'0');
export function timeValue(raw){
 const match=/^(\d{2}):(\d{2})$/.exec(String(raw));
 if(!match||Number(match[1])>23||Number(match[2])>59)throw Error('invalid');
 return Number(match[1])*60+Number(match[2]);
}
export const timeString = value => pad(Math.floor(value/60))+':'+pad(value%60);
export function parseNumber(raw){
 const value=String(raw).trim();
 if(!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(value))throw Error('invalid');
 const number=Number(value.replace(',','.'));if(!Number.isFinite(number)||number<0)throw Error('invalid');return number;
}
export function validValue(value,spec,original){
 if(value===null)return !!spec.optional;
 if(!Number.isFinite(value)||value<spec.min||value>spec.max)return false;
 if(value===original)return true; // An exact legacy value is never normalized on open/Done.
 return !spec.step||Math.abs(value/spec.step-Math.round(value/spec.step))<1e-8;
}
function decimalParts(value){
 const [mantissa,exponent='0']=String(value).split('e'),fraction=(mantissa.split('.')[1]||'').length;
 const scale=Math.max(0,fraction-Number(exponent));
 return {coefficient:BigInt(mantissa.replace('.',''))*10n**BigInt(Math.max(0,Number(exponent)-fraction)),scale};
}
export function addExact(value,increment){
 const a=decimalParts(value),b=decimalParts(increment),scale=Math.max(a.scale,b.scale);
 const coefficient=a.coefficient*10n**BigInt(scale-a.scale)+b.coefficient*10n**BigInt(scale-b.scale);
 const sign=coefficient<0n?'-':'',digits=(coefficient<0n?-coefficient:coefficient).toString().padStart(scale+1,'0');
 return Number(sign+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits));
}
export function neighbor(value,direction,{min,max,step=1,continuous=false}){
 let next;
 if(continuous)next=addExact(value,direction*step);
 else next=(direction>0?Math.floor(value/step+1e-9)+direction:Math.ceil(value/step-1e-9)+direction)*step;
 const low=continuous?min:Math.ceil(min/step)*step,high=continuous?max:Math.floor(max/step)*step;
 return Math.min(high,Math.max(low,next));
}
