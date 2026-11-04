/* Small reversible actions across the existing Sport and Calendar workspaces. */
let sportRemovedExercise=null;
function sportRemoveExercise(id){if(!workoutDraft)return false;const index=workoutDraft.exercises.findIndex(x=>x.id===id);if(index<0)return false;sportRemovedExercise={workoutId:workoutDraft.id,index,exercise:pathClone(workoutDraft.exercises[index])};workoutDraft.exercises.splice(index,1);pathContextQueueWorkout();return true;}
function sportRestoreExercise(){const removed=sportRemovedExercise;if(!removed||workoutDraft?.id!==removed.workoutId)return false;if(workoutDraft.exercises.some(x=>x.id===removed.exercise.id))return false;workoutDraft.exercises.splice(Math.min(removed.index,workoutDraft.exercises.length),0,pathClone(removed.exercise));sportRemovedExercise=null;pathContextQueueWorkout();return true;}
const sportOpenBeforeUsability=openWorkoutBuilder;
openWorkoutBuilder=function(...args){sportRemovedExercise=null;return sportOpenBeforeUsability(...args);};modalWorkout=openWorkoutBuilder;
const sportBuilderBeforeUsability=workoutBuilderPage;
workoutBuilderPage=function(){let html=sportBuilderBeforeUsability();if(sportRemovedExercise?.workoutId===workoutDraft.id)html=html.replace('<div class="exercise-list">',`<div class="sport-undo-notice" role="status"><span>Exercise removed</span><button class="btn small" data-sport-restore-exercise>Undo</button></div><div class="exercise-list">`);return html;};
function sportUnlinkWorkout(id){const w=data.workouts.find(w=>w.id===id);if(!w)return false;const before=pathClone(data);w.programId='';if(!save()){pathRestore(data,before);return false;}return true;}
document.addEventListener('click',e=>{const b=e.target.closest('[data-exercise-remove],[data-sport-restore-exercise],[data-workout-discard]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(b.hasAttribute('data-workout-discard')){if(discardWorkoutDraft())toast('Draft discarded · Undo available');return;}const ok=b.hasAttribute('data-sport-restore-exercise')?sportRestoreExercise():sportRemoveExercise(b.dataset.exerciseRemove);if(ok)render();},true);
const sportEventBeforeUsability=modalEvent;
modalEvent=function(id,...args){const result=sportEventBeforeUsability(id,...args);if(result!==false&&editor){editor.sportCalendarEventId=id;renderEditor();}return result;};
const sportEditorBeforeUsability=renderEditor;
renderEditor=function(){sportEditorBeforeUsability();const e=data.events.find(e=>e.id===editor?.sportCalendarEventId);if(!e||e.done||e.type!=='workout'||!e.plannedSnapshot?.exercises?.length)return;const actions=document.querySelector('#editor-form .editor-actions');if(!actions||actions.querySelector('[data-session-start]'))return;const button=document.createElement('button');button.type='button';button.className='btn';button.dataset.sessionStart=e.id;button.textContent='Start workout';actions.prepend(button);pathContextPosition();};
render();
