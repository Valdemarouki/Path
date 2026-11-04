(()=>{
 const api=window.pathDesktop?.updates;if(!api)return;
 let state={phase:'idle',supported:false},working=false;
 const ru=()=>typeof pathLanguage==='function'&&pathLanguage()==='ru';
 const t=(a,b)=>ru()?a:b;
 function paint(box){
  box.querySelector('[data-path-updates]')?.remove();
  const section=document.createElement('section');section.dataset.pathUpdates='';section.style.cssText='border-top:1px solid #343535;margin-top:16px;padding-top:16px';
  const title=document.createElement('strong');title.textContent=t('Обновления приложения','App updates');section.append(title);
  const version=document.createElement('p');version.className='muted';version.textContent='Path '+(state.currentVersion||'');section.append(version);
  const messages={idle:t('Проверить новую версию.','Check for a new version.'),checking:t('Проверяем обновления…','Checking for updates…'),current:t('Установлена актуальная версия.','You have the latest version.'),available:t('Доступна версия ','Version available: ')+state.version,downloading:t('Загрузка обновления: ','Downloading update: ')+(state.percent||0)+'%',downloaded:t('Обновление готово. Перезапустите Path, когда будет удобно.','Update ready. Restart Path when convenient.'),installing:t('Сохраняем данные и устанавливаем обновление…','Saving data and installing update…'),error:t('Не удалось проверить или загрузить обновление. Повторите позже.','Could not check or download the update. Try again later.')};
  const message=document.createElement('p');message.setAttribute('role','status');message.textContent=state.supported===false?t('Обновления доступны в установленной Windows-версии.','Updates are available in the installed Windows app.'):messages[state.phase];
  if(state.code)message.textContent+=({UPDATE_SIGNATURE:t(' Проверка подписи не пройдена. Файл не будет запущен.',' Signature verification failed. The file will not run.'),UPDATE_BUSY:t(' Завершите текущую операцию аккаунта.',' Finish the current account operation.'),UPDATE_SAVE_REQUIRED:t(' Завершите редактирование и повторите.',' Finish editing and retry.'),UPDATE_INSTALL_FAILED:t(' Не удалось запустить установщик; повторите.',' Could not start the installer; retry.')})[state.code]||'';
  section.append(message);
  if(state.supported){
   const actions=state.phase==='downloaded'?[['install',t('Перезапустить и обновить','Restart and update')]]:state.phase==='available'?[['download',t('Загрузить обновление','Download update')]]:[['check',t('Проверить обновления','Check for updates')]];
   for(const [action,label] of actions){const b=document.createElement('button');b.className='btn';b.dataset.updateAction=action;b.textContent=label;b.disabled=working||state.busy||['checking','downloading','installing'].includes(state.phase);section.append(b);}
   const label=document.createElement('label');label.style.cssText='display:flex;gap:10px;align-items:center;margin-top:12px;font-size:12px';const input=document.createElement('input');input.type='checkbox';input.checked=state.automatic;input.dataset.updateAutomatic='';label.append(input,document.createTextNode(t('Проверять и загружать автоматически','Check and download automatically')));section.append(label);
  }
  box.append(section);
 }
 const refresh=()=>{const box=document.querySelector('[data-path-account]');if(box)paint(box);};window.pathPaintUpdates=paint;
 api.onState(s=>{state=s;refresh();});api.status().then(s=>{state=s;refresh();}).catch(()=>{});
 document.addEventListener('change',async e=>{if(!e.target.matches('[data-update-automatic]'))return;try{state=await api.action('automatic',e.target.checked);}catch{}refresh();});
 document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-update-action]');if(!b||working)return;e.preventDefault();const action=b.dataset.updateAction;
  if(action==='install'&&!await pathConfirm(t('Сохранить данные, закрыть Path и установить обновление? Приложение откроется снова.','Save your data, close Path and install the update? The app will reopen.'),{yes:t('Обновить','Update'),no:t('Позже','Later')}))return;
  working=true;refresh();try{state=await api.action(action);}catch{state={...state,phase:'error'};}finally{working=false;refresh();}
 });
})();
