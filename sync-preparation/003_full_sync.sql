-- REVIEW / TEST ONLY. Requires 002_calendar_habits.sql.
-- No users are opted in; no existing snapshot is upgraded by this migration.
BEGIN;
CREATE TABLE IF NOT EXISTS path_sync_private.v3_testers (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS path_sync_private.v3_heads (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL CHECK(revision>0), payload jsonb NOT NULL,
 legacy_revision bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS path_sync_private.v3_revisions (
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL CHECK(revision>0), operation_id uuid NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,revision), UNIQUE(owner_id,operation_id)
);
ALTER TABLE path_sync_private.v3_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_sync_private.v3_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_sync_private.v3_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA path_sync_private FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION path_sync_private.v3_string(j jsonb,k text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$SELECT jsonb_typeof(j->k)='string'$$;
CREATE OR REPLACE FUNCTION path_sync_private.v3_ids(j jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF jsonb_typeof(j) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid collection';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(j) x WHERE jsonb_typeof(x->'id') IS DISTINCT FROM 'string' OR x->>'id'='') OR EXISTS(SELECT x->>'id' FROM jsonb_array_elements(j) x GROUP BY x->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Invalid or duplicate ID';END IF;
END $$;
CREATE OR REPLACE FUNCTION path_sync_private.v3_template(j jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE x jsonb;
BEGIN
 IF NOT coalesce(path_sync_private.v3_string(j,'name'),false) OR jsonb_typeof(j->'duration') IS DISTINCT FROM 'number' OR (j->>'duration')::numeric<=0 THEN RAISE EXCEPTION 'Invalid workout snapshot';END IF;
 IF j ? 'exercises' THEN
  PERFORM path_sync_private.v3_ids(j->'exercises');
  FOR x IN SELECT * FROM jsonb_array_elements(j->'exercises') LOOP
   IF NOT coalesce(path_sync_private.v3_string(x,'name') AND path_sync_private.v3_string(x,'target'),false) OR jsonb_typeof(x->'sets') IS DISTINCT FROM 'number' OR (x->>'sets')::numeric NOT BETWEEN 1 AND 50 OR (x->>'sets')::numeric<>trunc((x->>'sets')::numeric) OR jsonb_typeof(x->'rest') IS DISTINCT FROM 'number' OR (x->>'rest')::numeric<0 THEN RAISE EXCEPTION 'Invalid exercise';END IF;
  END LOOP;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION path_sync_private.v3_media(j jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NOT coalesce(path_sync_private.v3_string(j,'name') AND path_sync_private.v3_string(j,'data'),false) OR coalesce(j->>'type','') NOT IN ('image/png','image/jpeg','image/webp','application/pdf','text/plain') OR jsonb_typeof(j->'size') IS DISTINCT FROM 'number' OR (j->>'size')::numeric NOT BETWEEN 0 AND 2097152 OR length(j->>'data')>2900000 OR j->>'data' !~ '^data:(image/(png|jpeg|webp)|application/pdf|text/plain);base64,[A-Za-z0-9+/]*={0,2}$' THEN RAISE EXCEPTION 'Invalid attachment';END IF;
END $$;
CREATE OR REPLACE FUNCTION path_sync_private.v3_validate(j jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
#variable_conflict use_column
DECLARE common jsonb; k text; x jsonb; n jsonb; e jsonb; v jsonb; ids text[]; refs text[]; task_ids text[]; project_ids text[]; note_ids text[]; program_ids text[]; workout_ids text[];
BEGIN
 IF j IS NULL OR jsonb_typeof(j) IS DISTINCT FROM 'object' OR j->'schema' IS DISTINCT FROM '3'::jsonb OR octet_length(j::text)>16777216 OR j-ARRAY['schema','homeTasks','projects','events','eventSeries','habits','programs','workouts','workoutRecords','skillTests','notes','canvases','exercisePreferences']<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid full snapshot';END IF;
 PERFORM path_sync_private.v2_tree(j);
 FOREACH k IN ARRAY ARRAY['homeTasks','projects','events','eventSeries','habits','programs','workouts','workoutRecords','skillTests','notes','canvases'] LOOP PERFORM path_sync_private.v3_ids(j->k);END LOOP;
 common:=jsonb_build_object('schema',2,'homeTasks',j->'homeTasks','projects',j->'projects','eventSeries',j->'eventSeries','events','[]'::jsonb,'habits','[]'::jsonb);
 FOR x IN SELECT * FROM jsonb_array_elements(j->'events') LOOP
  e:=x-ARRAY['workoutTemplateId','plannedSnapshot','fullWorkoutSnapshot','workoutId','workoutRecordId','programId'];IF e->>'type'='workout' THEN e:=e||'{"type":"event"}'::jsonb;END IF;
  common:=jsonb_set(common,'{events}',common->'events'||jsonb_build_array(e));
  IF x ? 'plannedSnapshot' THEN PERFORM path_sync_private.v3_template(x->'plannedSnapshot');END IF;
  IF x ? 'fullWorkoutSnapshot' THEN PERFORM path_sync_private.v3_template(x->'fullWorkoutSnapshot');END IF;
 END LOOP;
 FOR x IN SELECT * FROM jsonb_array_elements(j->'habits') LOOP
  IF x ? 'source' AND coalesce(x->>'source','') NOT IN ('sport','manual') THEN RAISE EXCEPTION 'Invalid habit source';END IF;
  IF x->>'source'='sport' THEN x:=x||'{"source":"manual"}'::jsonb;END IF;
  IF x ? 'schedules' THEN
   v:='[]'::jsonb;FOR e IN SELECT * FROM jsonb_array_elements(x->'schedules') LOOP
    IF e->>'source'='sport' THEN e:=e||'{"source":"manual"}'::jsonb;END IF;v:=v||jsonb_build_array(e);
   END LOOP;x:=jsonb_set(x,'{schedules}',v);
  END IF;common:=jsonb_set(common,'{habits}',common->'habits'||jsonb_build_array(x));
 END LOOP;
 PERFORM path_sync_private.v2_validate(common);
 SELECT coalesce(array_agg(x->>'id'),'{}') INTO note_ids FROM jsonb_array_elements(j->'notes') x;
 SELECT coalesce(array_agg(x->>'id'),'{}') INTO project_ids FROM jsonb_array_elements(j->'projects') x;
 SELECT coalesce(array_agg(x->>'id'),'{}') INTO program_ids FROM jsonb_array_elements(j->'programs') x;
 SELECT coalesce(array_agg(x->>'id'),'{}') INTO workout_ids FROM jsonb_array_elements(j->'workouts') x;
 SELECT coalesce(array_agg(x->>'id'),'{}') INTO task_ids FROM (SELECT x FROM jsonb_array_elements(j->'homeTasks') x UNION ALL SELECT t FROM jsonb_array_elements(j->'projects') p CROSS JOIN LATERAL jsonb_array_elements(p->'tasks') t) t(x);
 FOR x IN SELECT * FROM jsonb_array_elements(j->'notes') LOOP
  IF coalesce(x->>'kind','') NOT IN ('note','journal') OR NOT coalesce(path_sync_private.v3_string(x,'title') AND path_sync_private.v3_string(x,'body') AND path_sync_private.v3_string(x,'updatedAt'),false) OR NOT isfinite((x->>'updatedAt')::timestamptz) OR x->>'kind'='journal' AND (NOT path_sync_private.v2_date(x->>'date') OR x->>'visibility' IS DISTINCT FROM 'private') THEN RAISE EXCEPTION 'Invalid note';END IF;
  IF x ? 'journalDate' AND NOT path_sync_private.v2_date(x->>'journalDate') OR x ? 'deletedAt' AND NOT isfinite((x->>'deletedAt')::timestamptz) THEN RAISE EXCEPTION 'Invalid note date';END IF;
  IF x ? 'tags' THEN IF jsonb_typeof(x->'tags')<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(x->'tags') t WHERE jsonb_typeof(t)<>'string') THEN RAISE EXCEPTION 'Invalid tags';END IF;END IF;
  IF x ? 'attachments' THEN PERFORM path_sync_private.v3_ids(x->'attachments');FOR e IN SELECT * FROM jsonb_array_elements(x->'attachments') LOOP PERFORM path_sync_private.v3_media(e);END LOOP;END IF;
 END LOOP;
 FOR x IN SELECT * FROM jsonb_array_elements(j->'projects') LOOP
  IF x ? 'noteIds' THEN IF jsonb_typeof(x->'noteIds')<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(x->'noteIds') t WHERE jsonb_typeof(t)<>'string' OR NOT (t#>>'{}')=ANY(note_ids)) THEN RAISE EXCEPTION 'Missing project note';END IF;END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(x->'tasks') LOOP IF e ? 'sourceNoteId' AND NOT coalesce((e->>'sourceNoteId')=ANY(note_ids),false) THEN RAISE EXCEPTION 'Missing task note';END IF;END LOOP;
 END LOOP;
 FOR x IN SELECT * FROM jsonb_array_elements(j->'programs') LOOP IF NOT coalesce(path_sync_private.v3_string(x,'name'),false) THEN RAISE EXCEPTION 'Invalid program';END IF;END LOOP;
 FOR x IN SELECT * FROM jsonb_array_elements(j->'workouts') LOOP
  IF NOT coalesce(path_sync_private.v3_string(x,'name'),false) OR coalesce(x->>'programId','')<>'' AND NOT coalesce((x->>'programId')=ANY(program_ids),false) THEN RAISE EXCEPTION 'Invalid workout';END IF;
  IF x ? 'exercises' THEN PERFORM path_sync_private.v3_template(x);END IF;
 END LOOP;
 FOR x IN SELECT * FROM jsonb_array_elements(j->'events') LOOP IF x ? 'workoutTemplateId' AND NOT coalesce((x->>'workoutTemplateId')=ANY(workout_ids),false) AND NOT x ?| ARRAY['plannedSnapshot','fullWorkoutSnapshot'] THEN RAISE EXCEPTION 'Missing workout template';END IF;END LOOP;
 ids:='{}';
 FOR x IN SELECT * FROM jsonb_array_elements(j->'workoutRecords') LOOP
  IF NOT coalesce(path_sync_private.v3_string(x,'startedAt') AND path_sync_private.v3_string(x,'endedAt'),false) OR NOT isfinite((x->>'startedAt')::timestamptz) OR NOT isfinite((x->>'endedAt')::timestamptz) OR (x->>'endedAt')::timestamptz<(x->>'startedAt')::timestamptz THEN RAISE EXCEPTION 'Invalid workout time';END IF;
  IF x ? 'completedDate' AND NOT path_sync_private.v2_date(x->>'completedDate') THEN RAISE EXCEPTION 'Invalid completion day';END IF;
  IF coalesce(x->>'sessionId','')<>'' THEN IF (x->>'sessionId')=ANY(ids) THEN RAISE EXCEPTION 'Duplicate workout session';END IF;ids:=array_append(ids,x->>'sessionId');END IF;
  IF x ? 'durationMs' AND (jsonb_typeof(x->'durationMs')<>'number' OR (x->>'durationMs')::numeric<0 OR (x->>'durationMs')::numeric>extract(epoch FROM (x->>'endedAt')::timestamptz-(x->>'startedAt')::timestamptz)*1000) THEN RAISE EXCEPTION 'Invalid duration';END IF;
  PERFORM path_sync_private.v3_template(x->'snapshot');PERFORM path_sync_private.v3_ids(x->'sets');
  FOR e IN SELECT * FROM jsonb_array_elements(x->'sets') LOOP
   IF NOT coalesce(path_sync_private.v3_string(e,'name') AND path_sync_private.v3_string(e,'result') AND path_sync_private.v3_string(e,'target'),false) OR jsonb_typeof(e->'done') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid set';END IF;
   IF x->'sportVersion'='3'::jsonb THEN
    IF coalesce(e->>'definitionId','')='' OR coalesce(e->>'unit','') NOT IN ('reps','seconds','kg') OR coalesce(e->>'kind','') NOT IN ('warmup','working','heavy') OR e->>'sessionRef' IS DISTINCT FROM x->>'id' THEN RAISE EXCEPTION 'Invalid set identity';END IF;
    IF e->'done'='true'::jsonb AND (jsonb_typeof(e->'actualValue') IS DISTINCT FROM 'number' OR (e->>'actualValue')::numeric<0 OR NOT coalesce(isfinite((e->>'loggedAt')::timestamptz),false) OR e->>'unit'='reps' AND (e->>'actualValue')::numeric<>trunc((e->>'actualValue')::numeric)) THEN RAISE EXCEPTION 'Invalid set result';END IF;
   END IF;
  END LOOP;
 END LOOP;
 FOR x IN SELECT * FROM jsonb_array_elements(j->'canvases') LOOP
  IF NOT coalesce(path_sync_private.v3_string(x,'name'),false) OR x ? 'viewport' OR jsonb_typeof(x->'edges') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid canvas';END IF;
  PERFORM path_sync_private.v3_ids(x->'nodes');SELECT coalesce(array_agg(t->>'id'),'{}') INTO ids FROM jsonb_array_elements(x->'nodes') t;
  FOR n IN SELECT * FROM jsonb_array_elements(x->'nodes') LOOP
   IF jsonb_typeof(n->'x') IS DISTINCT FROM 'number' OR jsonb_typeof(n->'y') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid position';END IF;
   IF n ? 'attachment' THEN PERFORM path_sync_private.v3_media(n->'attachment');END IF;
   IF n ? 'image' AND (NOT coalesce(path_sync_private.v3_string(n,'image'),false) OR length(n->>'image')>2900000 OR n->>'image' !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$') THEN RAISE EXCEPTION 'Invalid image';END IF;
   IF n ? 'entityRef' THEN refs:=CASE n->'entityRef'->>'type' WHEN 'note' THEN note_ids WHEN 'task' THEN task_ids WHEN 'project' THEN project_ids ELSE '{}'::text[] END;IF NOT coalesce((n->'entityRef'->>'id')=ANY(refs),false) THEN RAISE EXCEPTION 'Missing canvas source';END IF;END IF;
  END LOOP;
  FOR e IN SELECT * FROM jsonb_array_elements(x->'edges') LOOP IF NOT coalesce((e->>'from')=ANY(ids) AND (e->>'to')=ANY(ids),false) THEN RAISE EXCEPTION 'Broken canvas connection';END IF;END LOOP;
 END LOOP;
 IF jsonb_typeof(j->'exercisePreferences') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid exercise preferences';END IF;
 FOR x IN SELECT value FROM jsonb_each(j->'exercisePreferences') LOOP
  IF NOT coalesce(path_sync_private.v3_string(x,'techniqueNote'),false) THEN RAISE EXCEPTION 'Invalid technique note';END IF;
  FOREACH k IN ARRAY ARRAY['warmup','working','heavy'] LOOP v:=x->'restPresets'->k;IF jsonb_typeof(v) IS DISTINCT FROM 'number' OR (v#>>'{}')::numeric NOT BETWEEN 0 AND 1200 OR (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric) THEN RAISE EXCEPTION 'Invalid rest preference';END IF;END LOOP;
 END LOOP;
 FOR x IN SELECT * FROM jsonb_array_elements(j->'skillTests') LOOP
  IF NOT coalesce((x->>'skillType'='frontLever' AND x->>'stage' IN ('Tuck','Advanced tuck','Straddle','Full') OR x->>'skillType'='planche' AND x->>'stage' IN ('Lean','Tuck','Advanced tuck','Full')),false) OR jsonb_typeof(x->'holdSeconds') IS DISTINCT FROM 'number' OR (x->>'holdSeconds')::numeric<0 OR NOT coalesce(isfinite((x->>'occurredAt')::timestamptz),false) THEN RAISE EXCEPTION 'Invalid skill test';END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION path_sync_private.v3_owner() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL OR auth.jwt()->>'client_id' IS DISTINCT FROM '00000000-0000-4000-8000-000000000000' OR NOT EXISTS(SELECT 1 FROM path_sync_private.testers WHERE owner_id=u) OR NOT EXISTS(SELECT 1 FROM path_sync_private.v3_testers WHERE owner_id=u) THEN RAISE EXCEPTION 'Sync access denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 RETURN u;
END $$;
CREATE OR REPLACE FUNCTION public.path_sync_read_v3() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=path_sync_private.v3_owner(); h path_sync_private.v3_heads%ROWTYPE; old path_sync_private.v2_heads%ROWTYPE;
BEGIN
 SELECT * INTO h FROM path_sync_private.v3_heads WHERE owner_id=u;
 IF FOUND THEN RETURN jsonb_build_object('active',true,'revision',h.revision,'payload',h.payload);END IF;
 SELECT * INTO old FROM path_sync_private.v2_heads WHERE owner_id=u;
 RETURN jsonb_build_object('active',false,'revision',0,'legacyRevision',coalesce(old.revision,0),'payload',coalesce(old.payload,'{"schema":2,"homeTasks":[],"projects":[],"events":[],"eventSeries":[],"habits":[]}'::jsonb)||'{"schema":3,"programs":[],"workouts":[],"workoutRecords":[],"skillTests":[],"notes":[],"canvases":[],"exercisePreferences":{}}'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.path_sync_push_v3(p_operation uuid,p_expected bigint,p_payload jsonb,p_legacy_revision bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=path_sync_private.v3_owner(); h path_sync_private.v3_heads%ROWTYPE; r path_sync_private.v3_revisions%ROWTYPE; old path_sync_private.v2_heads%ROWTYPE; active boolean;
BEGIN
 IF p_operation IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=9007199254740991 THEN RAISE EXCEPTION 'Invalid operation';END IF;
 PERFORM path_sync_private.v3_validate(p_payload);
 SELECT * INTO r FROM path_sync_private.v3_revisions WHERE owner_id=u AND operation_id=p_operation;
 IF FOUND THEN
  IF r.payload IS DISTINCT FROM p_payload OR r.revision<>p_expected+1 THEN RAISE EXCEPTION 'Operation ID reused';END IF;
  RETURN jsonb_build_object('ok',true,'active',true,'revision',r.revision,'payload',r.payload);
 END IF;
 SELECT * INTO h FROM path_sync_private.v3_heads WHERE owner_id=u;active:=FOUND;
 IF NOT active THEN
  SELECT * INTO old FROM path_sync_private.v2_heads WHERE owner_id=u;
  IF p_expected<>0 OR p_legacy_revision IS NULL OR p_legacy_revision<>coalesce(old.revision,0) OR old.owner_id IS NULL THEN RAISE EXCEPTION 'LEGACY_BASE_CHANGED';END IF;
 ELSE
  IF h.revision<>p_expected THEN RETURN jsonb_build_object('ok',false,'active',true,'revision',h.revision,'payload',h.payload);END IF;
 END IF;
 INSERT INTO path_sync_private.v3_revisions(owner_id,revision,operation_id,payload) VALUES(u,p_expected+1,p_operation,p_payload);
 INSERT INTO path_sync_private.v3_heads(owner_id,revision,payload,legacy_revision) VALUES(u,p_expected+1,p_payload,coalesce(old.revision,h.legacy_revision,0))
 ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=now();
 RETURN jsonb_build_object('ok',true,'active',true,'revision',p_expected+1,'payload',p_payload);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA path_sync_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.path_sync_read_v3() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.path_sync_push_v3(uuid,bigint,jsonb,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.path_sync_read_v3() TO authenticated;
GRANT EXECUTE ON FUNCTION public.path_sync_push_v3(uuid,bigint,jsonb,bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.path_sync_read_v2() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=path_sync_private.v2_owner(); h path_sync_private.v2_heads%ROWTYPE; old path_sync_private.heads%ROWTYPE;
BEGIN
 IF EXISTS(SELECT 1 FROM path_sync_private.v3_heads WHERE owner_id=u) THEN RAISE EXCEPTION 'SYNC_CLIENT_UPGRADE_REQUIRED' USING ERRCODE='55000';END IF;
 SELECT * INTO h FROM path_sync_private.v2_heads WHERE owner_id=u;
 IF FOUND THEN RETURN jsonb_build_object('active',true,'revision',h.revision,'payload',h.payload);END IF;
 SELECT * INTO old FROM path_sync_private.heads WHERE owner_id=u;
 RETURN jsonb_build_object('active',false,'revision',0,'legacyRevision',coalesce(old.revision,0),'payload',coalesce(old.payload,'{"schema":1,"homeTasks":[],"projects":[]}'::jsonb)||'{"schema":2,"events":[],"eventSeries":[],"habits":[]}'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.path_sync_push_v2(p_operation uuid,p_expected bigint,p_payload jsonb,p_legacy_revision bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=path_sync_private.v2_owner(); h path_sync_private.v2_heads%ROWTYPE; r path_sync_private.v2_revisions%ROWTYPE; old path_sync_private.heads%ROWTYPE; active boolean;
BEGIN
 IF EXISTS(SELECT 1 FROM path_sync_private.v3_heads WHERE owner_id=u) THEN RAISE EXCEPTION 'SYNC_CLIENT_UPGRADE_REQUIRED' USING ERRCODE='55000';END IF;
 IF p_operation IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=9007199254740991 THEN RAISE EXCEPTION 'Invalid operation';END IF;
 PERFORM path_sync_private.v2_validate(p_payload);
 SELECT * INTO r FROM path_sync_private.v2_revisions WHERE owner_id=u AND operation_id=p_operation;
 IF FOUND THEN
  IF r.payload IS DISTINCT FROM p_payload OR r.revision<>p_expected+1 THEN RAISE EXCEPTION 'Operation ID reused';END IF;
  RETURN jsonb_build_object('ok',true,'active',true,'revision',r.revision,'payload',r.payload);
 END IF;
 SELECT * INTO h FROM path_sync_private.v2_heads WHERE owner_id=u;active:=FOUND;
 IF NOT active THEN
  SELECT * INTO old FROM path_sync_private.heads WHERE owner_id=u;
  IF p_expected<>0 OR p_legacy_revision IS NULL OR p_legacy_revision<>coalesce(old.revision,0) OR (p_payload-ARRAY['events','eventSeries','habits'])||'{"schema":1}'::jsonb IS DISTINCT FROM coalesce(old.payload,'{"schema":1,"homeTasks":[],"projects":[]}'::jsonb) THEN RAISE EXCEPTION 'LEGACY_BASE_CHANGED';END IF;
 ELSE
  IF h.revision<>p_expected THEN RETURN jsonb_build_object('ok',false,'active',true,'revision',h.revision,'payload',h.payload);END IF;
 END IF;
 INSERT INTO path_sync_private.v2_revisions(owner_id,revision,operation_id,payload) VALUES(u,p_expected+1,p_operation,p_payload);
 INSERT INTO path_sync_private.v2_heads(owner_id,revision,payload,legacy_revision) VALUES(u,p_expected+1,p_payload,coalesce(old.revision,h.legacy_revision,0))
 ON CONFLICT(owner_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=now();
 RETURN jsonb_build_object('ok',true,'active',true,'revision',p_expected+1,'payload',p_payload);
END $$;
COMMIT;
