/* Keep the existing importance field and linked task as the source of truth. */
function calendarImportance(event){if(event.type==='free_time')return 'none';const linked=event.taskId?findTask(event.taskId)?.task:null;const level=linked?(linked.importance||'none'):(event.importance||'none');return ['high','medium','low','none'].includes(level)?level:'none';}
const calendarButtonBeforeImportance=calendarEventButton;
calendarEventButton=function(event,style=''){
 const html=calendarButtonBeforeImportance(event,style);if(event.type==='free_time')return html;
 const level=calendarImportance(event);
 return html.replace('class="cal-entry ',`data-importance="${level}" class="cal-entry calendar-importance-${level} `);
};
