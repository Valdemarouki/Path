// Reproducible synthetic native-only data for device-readiness measurements.
// Not loaded into the product by default and never reads an existing profile.
import {seed,migrate,validate} from '../model.mjs';
export const PHONE_PERFORMANCE_SIZES=Object.freeze({normal:{events:24,notes:32},large:{events:400,notes:400}});
export function phonePerformanceFixture(size='normal'){
 const counts=PHONE_PERFORMANCE_SIZES[size];if(!counts)throw Error('Unknown synthetic size');
 const date='2026-11-11',state=migrate(seed(new Date('2026-11-11T10:00:00.000Z')));
 state.events=Array.from({length:counts.events},(_,i)=>{const minute=360+i*(size==='normal'?30:2),start=Date.parse(date+'T00:00:00Z')+minute*60000;return {id:'phone-event-'+i,title:'Synthetic calendar event '+String(i+1).padStart(3,'0')+' · review and reflect',date,hour:minute/60,duration:15,type:'focus',importance:i%5===0?'high':'low',done:false,tzid:'UTC',fold:'earlier',start_at:new Date(start).toISOString(),end_at:new Date(start+900000).toISOString(),eventIcon:'focus',notes:'Synthetic performance record only',location:''};});
 state.notes=Array.from({length:counts.notes},(_,i)=>({id:'phone-note-'+i,kind:'note',visibility:'private',title:'Synthetic note '+String(i+1).padStart(3,'0')+' · planning',body:('# A synthetic note\n\nReadable text. Русский. Español.\n').repeat(size==='normal'?8:20),updatedAt:new Date(Date.parse('2026-11-11T10:00:00Z')-i*1000).toISOString()}));
 validate(state);return state;
}
