/* Small single-flight scheduler; injected only into desktop. */
class PathAutoSync {
 constructor({request,notify=()=>{},setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){Object.assign(this,{request,notify,setTimer,clearTimer});this.enabled=false;this.running=false;this.blocked=false;this.generation=0;this.failures=0;this.timer=null;this.state='off';}
 emit(state,result){this.state=state;this.notify(state,result);}
 schedule(ms){this.clearTimer(this.timer);this.timer=null;if(this.enabled&&!this.blocked)this.timer=this.setTimer(()=>{this.timer=null;this.tick();},ms);}
 enable(value){if(this.enabled===value)return;this.enabled=value;this.clearTimer(this.timer);this.timer=null;this.blocked=false;this.emit(value?'waiting':'off');if(value)this.schedule(2000);}
 changed(){this.generation++;if(this.enabled&&!this.blocked){this.emit('pending');this.schedule(2500);}}
 wake(){if(this.enabled&&!this.blocked){this.failures=0;this.schedule(500);}}
 manual(result){if(result.ok&&!result.conflict&&!result.recovery){this.blocked=false;this.failures=0;this.emit(result.dirty?'pending':'saved',result);this.schedule(result.dirty?2500:15000);}else if(result.conflict||result.recovery){this.blocked=true;this.clearTimer(this.timer);this.emit('attention',result);}}
 async tick(){if(!this.enabled||this.blocked)return;if(this.running){this.schedule(2500);return;}this.running=true;const generation=this.generation;this.emit('syncing');
  try{const result=await this.request();if(!this.enabled)return;
   if(result.disabled){this.enable(false);return;}
   if(result.conflict||result.recovery||['HTTP_401','HTTP_403','LINKED_DELETE','SYNC_CLIENT_UPGRADE_REQUIRED','SPORT_DEPENDENCY','TEST_ACCESS_REQUIRED','SERVER_NOT_READY','LOCAL_SAVE_FAILED','STAMP_REQUIRED','FULL_SNAPSHOT_TOO_LARGE','COMMON_SNAPSHOT_TOO_LARGE','ACTIVE_WORKOUT'].includes(result.code)){this.blocked=true;this.clearTimer(this.timer);this.emit('attention',result);return;}
   if(result.deferred){this.emit('waiting');this.schedule(4000);return;}
   if(!result.ok)throw Error('Retry');
   this.failures=0;const dirty=result.dirty||result.pending||generation!==this.generation;this.emit(dirty?'pending':'saved',result);this.schedule(dirty?2500:15000);
  }catch{if(this.enabled){this.failures++;this.emit('retry');this.schedule(Math.min(120000,5000*2**Math.min(this.failures-1,5)));}}
  finally{this.running=false;}
 }
}
if(typeof module!=='undefined'&&module.exports)module.exports={PathAutoSync};
