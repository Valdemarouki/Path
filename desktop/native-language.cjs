const messages={
 en:['Keep Path open','Close anyway','Unsaved changes','Some changes could not be saved. Keep Path open to retry or export recovery.'],
 ru:['Оставить Path открытым','Всё равно закрыть','Несохранённые изменения','Некоторые изменения не удалось сохранить. Оставьте Path открытым для повторного сохранения или экспорта восстановления.'],
 pl:['Pozostaw Path otwarty','Zamknij mimo to','Niezapisane zmiany','Nie udało się zapisać niektórych zmian. Pozostaw Path otwarty, aby ponowić zapis lub wyeksportować odzyskiwanie.'],
 es:['Mantener Path abierto','Cerrar de todos modos','Cambios sin guardar','No se pudieron guardar algunos cambios. Mantén Path abierto para reintentar o exportar una copia de recuperación.']
};
function validLanguage(value){return typeof value==='string'&&Object.hasOwn(messages,value);}
function dialogText(language){return messages[language]||messages.en;}
function acceptLanguage(event,window,value){return validLanguage(value)&&!!window&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame?.url==='path2://app/';}
module.exports={dialogText,validLanguage,acceptLanguage};
