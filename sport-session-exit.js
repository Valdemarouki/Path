let sportDraftHidden=false;
function retainWorkoutDraft(){const a=data.activeWorkout;if(!a)return false;if(!Number.isFinite(a.pausedAt))setWorkoutPaused(a,true);if(!save())return false;sportDraftHidden=true;render();return true;}
function discardWorkoutDraft(){if(!data.activeWorkout)return false;delete data.activeWorkout;if(!save())return false;sportDraftHidden=false;render();return true;}
const sportPageBeforeSessionExit=sportPage;
sportPage=function(){const a=data.activeWorkout;if(!a){sportDraftHidden=false;return sportPageBeforeSessionExit();}if(sportDraftHidden)return `<section class="panel"><h2>Saved workout draft</h2><p>${esc(a.snapshot.name)} · ${a.sets.filter(s=>s.done).length} marked sets · ${workoutTimeLabel(a)} active time</p><p class="muted">Paused. This draft is not a completed workout.</p><button class="btn primary" data-workout-draft-open>Open saved workout</button></section>${sportOverviewPage()}`;return sportPageBeforeSessionExit();};
const activeWorkoutBeforeExit=activeWorkoutPage;
activeWorkoutPage=function(a){return activeWorkoutBeforeExit(a)+`<section class="panel row"><button class="btn" data-workout-save-draft>Save draft & exit</button><button class="btn ghost" data-workout-discard>Discard this workout</button><span class="muted">A draft does not count as a completed workout.</span></section>`;};
const startWorkoutBeforeExit=startWorkout;
startWorkout=function(...args){sportDraftHidden=false;return startWorkoutBeforeExit(...args);};
document.addEventListener('click',async e=>{const b=e.target.closest('[data-workout-save-draft],[data-workout-draft-open],[data-workout-discard]');if(!b)return;if(b.hasAttribute('data-workout-save-draft'))retainWorkoutDraft();else if(b.hasAttribute('data-workout-draft-open')){sportDraftHidden=false;render();}else if(await pathConfirm('Discard this unfinished workout and its entered sets? Its template and calendar plan will stay unchanged. No completed workout will be created.'))discardWorkoutDraft();});
