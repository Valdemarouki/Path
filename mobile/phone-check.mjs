import {BUILD_ID} from './build-info.mjs';
const $=id=>document.getElementById(id);
let probe='not run';
function snapshot(){return {build:BUILD_ID,secureContext:window.isSecureContext,webLocks:!!navigator.locks,visualViewport:!!window.visualViewport,viewport:[innerWidth,innerHeight],reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,browser:navigator.userAgent,syntheticStorageProbe:probe};}
function render(){const data=snapshot();$('phone-build').textContent='Сборка: '+BUILD_ID;$('phone-capabilities').replaceChildren();for(const [key,value]of Object.entries(data).filter(([key])=>key!=='browser')){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=typeof value==='object'?JSON.stringify(value):String(value);$('phone-capabilities').append(dt,dd);}$('phone-report').value=JSON.stringify(data,null,2);}
$('phone-probe').addEventListener('click',async()=>{
 if(!window.isSecureContext||!navigator.locks){probe='blocked: trusted HTTPS and Web Locks required';$('phone-probe-result').textContent='Для записи нужен доверенный HTTPS и браузер с Web Locks. Не обходите предупреждение сертификата.';render();return;}
 const key='path-mobile-phone-probe-'+crypto.randomUUID();$('phone-probe').disabled=true;
 try{await navigator.locks.request(key,()=>{try{localStorage.setItem(key,'synthetic');if(localStorage.getItem(key)!=='synthetic')throw Error('probeMismatch');}finally{localStorage.removeItem(key);}});probe='PASS: separate temporary key removed';$('phone-probe-result').textContent='Тестовая запись прошла. Временный ключ удалён; записи приложения не затрагивались.';}
 catch{probe='FAIL: synthetic storage write unavailable';$('phone-probe-result').textContent='Тестовая запись не удалась. Не используйте реальные данные; сохраните сведения ниже для отчёта.';}
 finally{$('phone-probe').disabled=false;render();}
});
render();window.addEventListener('resize',render);
