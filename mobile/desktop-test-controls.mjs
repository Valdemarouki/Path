import {parseDesktopInput} from './desktop-adapter.mjs';
import {TEST_STORAGE_KEY} from './desktop-test-repository.mjs';

const rows={
 test:['Test data','Тестовые данные','Datos de prueba'],
 open:['Desktop test mode','Тестовый режим desktop','Modo de prueba desktop'],
 exit:['Return to local mode','Вернуться в локальный режим','Volver al modo local'],
 scope:['Synthetic desktop copies only. Separate storage; no accounts or sync.','Только синтетические desktop-копии. Отдельное хранилище; без аккаунтов и синхронизации.','Solo copias desktop sintéticas. Almacenamiento separado; sin cuentas ni sincronización.'],
 plain:['New plain test copy','Новая обычная тестовая копия','Nueva copia simple'],
 pooled:['New copy with history','Новая копия с историей','Nueva copia con historial'],
 copies:['Saved test copies','Сохранённые тестовые копии','Copias de prueba guardadas'],
 download:['Export desktop copy','Выгрузить desktop-копию','Exportar copia desktop'],
 report:['Download change report','Скачать отчёт об изменениях','Descargar informe de cambios'],
 recovery:['Save recovery copy and drafts','Сохранить копию и черновики для восстановления','Guardar copia y borradores de recuperación'],
 empty:['Load a prepared synthetic set above. Existing mobile data will remain unchanged.','Загрузите подготовленный синтетический набор выше. Существующие мобильные данные останутся без изменений.','Carga un conjunto sintético preparado. Los datos móviles existentes permanecerán intactos.'],
 readonly:['Only adapter-confirmed edits are available. Other data is preserved for viewing.','Доступны только подтверждённые адаптером изменения. Остальные данные сохранены для просмотра.','Solo se permiten cambios confirmados por el adaptador. El resto se conserva para consulta.'],
 close:['Save or close the open editor before switching test copies.','Сохраните или закройте редактор перед сменой тестовой копии.','Guarda o cierra el editor antes de cambiar de copia.'],
 failed:['Operation failed. The previous test copy has been retained.','Операция не выполнена. Предыдущая тестовая копия сохранена.','Operación fallida. Se conserva la copia de prueba anterior.'],
 conflict:['Newer changes exist in another tab. Save your recovery copy/drafts, then explicitly refresh. No changes were overwritten.','В другой вкладке есть более новые изменения. Сохраните копию и черновики для восстановления, затем явно обновите данные. Изменения не перезаписаны.','Hay cambios más recientes en otra pestaña. Guarda la copia y los borradores y luego actualiza los datos. No se sobrescribió ningún cambio.'],
 main:['Main task for this copy only','Главная задача только для этой копии','Tarea principal solo para esta copia'],
 none:['No main task','Без главной задачи','Sin tarea principal'],
 zone:['Source event zones; unzoned legacy times remain uninterpreted.','Часовые пояса исходных событий; legacy-время без зоны не интерпретируется.','Zonas de los eventos de origen; las horas antiguas sin zona no se reinterpretan.'],
 legacy:['Original wall time; zone unknown, timing edits unavailable','Исходное местное время; зона неизвестна, изменение времени недоступно','Hora local original; zona desconocida, cambio de hora no disponible'],
 task:['Task fields are read-only. Completion and main selection are separate actions; exact original duration is retained.','Поля задачи доступны для просмотра. Выполнение и выбор главной — отдельные действия; точная исходная длительность сохранена.','Los campos de la tarea son de consulta. Completar y elegir la principal son acciones separadas; se conserva la duración exacta.'],
 language:['Language','Язык','Idioma'],
 updated:['Saved in the separate test storage.','Сохранено в отдельном тестовом хранилище.','Guardado en el almacenamiento de prueba separado.']
};
export const testModeText=(key,lang='en')=>rows[key]?.[{en:0,ru:1,es:2}[lang]??0]??key;
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function downloadTestJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function createDesktopTestControls({repo,getLanguage,onState,onFailure,beforeChange}){
 const host=document.createElement('aside');host.id='desktop-test-banner';host.className='desktop-test-banner';document.querySelector('.topbar').after(host);
 const text=key=>testModeText(key,getLanguage());let loading=false,preparing=false,message='';
 async function operation(change){
  if(loading||preparing)return;if(document.documentElement.hasAttribute('data-saving')){message=text('close');render();return;}if(document.querySelector('dialog[open]')){message=text('close');render();return;}
  preparing=true;try{if(beforeChange&&!await beforeChange()){message=text('close');render();return;}}finally{preparing=false;}
  loading=true;render();try{if(!navigator.locks)throw Error('lockUnavailable');await navigator.locks.request(TEST_STORAGE_KEY,change);message=text('updated');onState();}catch(e){message=text(e.message==='conflict'?'conflict':'failed')+' ('+e.message+')';onFailure?.(e);}finally{loading=false;render();}
 }
 function render(){
  const active=repo?.activeDataset,datasets=repo?.datasets??[];
  host.innerHTML=`<div class="desktop-test-heading"><strong>${text('test')}</strong><a class="action-button action-button--secondary" data-test-exit href="${escape(location.pathname)}">${text('exit')}</a></div><details><summary>${text('open')}${active?' · '+escape(active.label):''}</summary><p>${text('scope')}</p><div class="row-actions"><button class="action-button action-button--secondary" data-test-load="plain" ${loading?'disabled':''}>${text('plain')}</button><button class="action-button action-button--secondary" data-test-load="pooled" ${loading?'disabled':''}>${text('pooled')}</button></div><label for="desktop-test-dataset">${text('copies')}</label><select id="desktop-test-dataset" ${loading||!datasets.length?'disabled':''}>${datasets.map(d=>`<option value="${escape(d.id)}" ${d.active?'selected':''}>${escape(d.label)}${d.changed?' *':''}</option>`).join('')}</select><label for="desktop-test-language">${text('language')}</label><select id="desktop-test-language">${['en','ru','es'].map(l=>`<option value="${l}" ${getLanguage()===l?'selected':''}>${{en:'English',ru:'Русский',es:'Español'}[l]}</option>`).join('')}</select><div class="row-actions"><button class="action-button action-button--secondary" data-test-export ${!active||loading?'disabled':''}>${text('download')}</button><button class="action-button action-button--secondary" data-test-report ${!active||loading?'disabled':''}>${text('report')}</button><button class="action-button action-button--secondary" data-test-recover>${text('recovery')}</button></div><p class="muted">${text('readonly')}</p></details><p id="desktop-test-message" role="status" ${message?'':'hidden'}>${escape(message)}</p>`;
 }
 host.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.testLoad){
   const fixtureId=b.dataset.testLoad;if(!['plain','pooled'].includes(fixtureId))return;
   return operation(async()=>{const file=fixtureId==='plain'?'desktop-v2.json':'desktop-pooled-v2.json';const response=await fetch('compatibility-preview/fixtures/'+file,{cache:'no-store'});if(!response.ok)throw Error('fixtureLoad');const source=parseDesktopInput(await response.text());repo.loadFixture(fixtureId,source);});
  }
  if(b.hasAttribute('data-test-export'))downloadTestJSON(repo.exportDesktop(),'path-desktop-synthetic-copy.json');
  if(b.hasAttribute('data-test-report'))downloadTestJSON(repo.reportChanges(),'path-desktop-synthetic-changes.json');
  if(b.hasAttribute('data-test-recover')){const forms=[...document.querySelectorAll('dialog[open]')].map(d=>({id:d.id,fields:[...d.querySelectorAll('input,textarea,select')].map(f=>({id:f.id,value:f.type==='checkbox'?f.checked:f.value}))}));let source,stored;try{source=repo?.exportDesktop();}catch{}try{stored=localStorage.getItem(TEST_STORAGE_KEY);}catch{}downloadTestJSON({format:'path-mobile-desktop-test-recovery',version:1,source,stored,forms},'path-desktop-test-recovery.json');}
 });
 host.addEventListener('change',e=>{if(e.target.id==='desktop-test-dataset')operation(()=>repo.selectDataset(e.target.value));if(e.target.id==='desktop-test-language'){const value=e.target.value;if(!repo?.state){document.documentElement.lang=value;onState(value);render();}else operation(()=>repo.commit(s=>{s.language=value;}));}});
 render();return {render,isBusy:()=>loading,setMessage:key=>{message=text(key);render();}};
}
