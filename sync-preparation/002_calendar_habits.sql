-- REVIEW / TEST ONLY. Requires 001_personal_tasks_projects.sql.
-- No users are opted in; no existing snapshot is upgraded by this migration.
BEGIN;
CREATE TABLE IF NOT EXISTS path_sync_private.v2_testers (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS path_sync_private.v2_heads (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL CHECK(revision>0), payload jsonb NOT NULL,
 legacy_revision bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS path_sync_private.v2_revisions (
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL CHECK(revision>0), operation_id uuid NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,revision), UNIQUE(owner_id,operation_id)
);
ALTER TABLE path_sync_private.v2_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_sync_private.v2_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_sync_private.v2_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA path_sync_private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION path_sync_private.v2_date(s text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 RETURN s IS NOT NULL AND s ~ '^\d{4}-\d{2}-\d{2}$' AND to_char(s::date,'YYYY-MM-DD')=s;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
CREATE OR REPLACE FUNCTION path_sync_private.v2_tree(j jsonb,d integer DEFAULT 0) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE k text; v jsonb;
BEGIN
 IF d>40 THEN RAISE EXCEPTION 'Snapshot too deep'; END IF;
 IF jsonb_typeof(j)='object' THEN
  FOR k,v IN SELECT * FROM jsonb_each(j) LOOP
   IF k IN ('__proto__','constructor','prototype') THEN RAISE EXCEPTION 'Unsafe snapshot key';END IF;
   PERFORM path_sync_private.v2_tree(v,d+1);
  END LOOP;
 ELSIF jsonb_typeof(j)='array' THEN
  FOR v IN SELECT * FROM jsonb_array_elements(j) LOOP PERFORM path_sync_private.v2_tree(v,d+1);END LOOP;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION path_sync_private.v2_validate(j jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE collection text; item jsonb; t jsonb; e jsonb; h jsonb; s jsonb; rule jsonb; pair record;
 ids text[]; task_ids text[]:='{}'; project_ids text[]:='{}'; task_projects jsonb:='{}';
 occurrences text[]:='{}'; occurrence text; delta integer; step integer; stamp timestamp;
BEGIN
 IF j IS NULL OR jsonb_typeof(j) IS DISTINCT FROM 'object' OR octet_length(j::text)>2097152
 OR j->'schema' IS DISTINCT FROM '2'::jsonb OR (j-ARRAY['schema','homeTasks','projects','events','eventSeries','habits'])<>'{}'::jsonb THEN RAISE EXCEPTION 'Invalid v2 snapshot';END IF;
 PERFORM path_sync_private.v2_tree(j);
 FOREACH collection IN ARRAY ARRAY['homeTasks','projects','events','eventSeries','habits'] LOOP
  IF jsonb_typeof(j->collection) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid collection';END IF;
  ids:='{}';
  FOR item IN SELECT * FROM jsonb_array_elements(j->collection) LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR item->>'id'='' OR (item->>'id')=ANY(ids) THEN RAISE EXCEPTION 'Invalid or duplicate ID';END IF;
   ids:=array_append(ids,item->>'id');
  END LOOP;
 END LOOP;
 FOR item IN SELECT * FROM jsonb_array_elements(j->'projects') LOOP
  IF jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'tasks') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid project';END IF;
  project_ids:=array_append(project_ids,item->>'id');
  ids:='{}';
  FOR t IN SELECT * FROM jsonb_array_elements(item->'tasks') LOOP
   IF jsonb_typeof(t->'id') IS DISTINCT FROM 'string' OR t->>'id'='' OR (t->>'id')=ANY(ids) OR coalesce(t->>'status','') NOT IN ('planned','progress','done') THEN RAISE EXCEPTION 'Invalid project task';END IF;
   ids:=array_append(ids,t->>'id');task_projects:=task_projects||jsonb_build_object(t->>'id',item->>'id');
  END LOOP;
  FOR t IN SELECT * FROM jsonb_array_elements(item->'tasks') LOOP
   IF t ? 'dependencies' THEN
    IF jsonb_typeof(t->'dependencies') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid dependencies';END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(t->'dependencies') dep WHERE jsonb_typeof(dep)<>'string' OR NOT (dep#>>'{}')=ANY(ids) OR dep#>>'{}'=t->>'id') THEN RAISE EXCEPTION 'Invalid dependency';END IF;
   END IF;
  END LOOP;
  IF EXISTS(WITH RECURSIVE edges AS(SELECT x->>'id' src,dep#>>'{}' dst FROM jsonb_array_elements(item->'tasks') x CROSS JOIN LATERAL jsonb_array_elements(coalesce(x->'dependencies','[]'::jsonb)) dep),
   walks AS(SELECT src,dst FROM edges UNION SELECT w.src,e.dst FROM walks w JOIN edges e ON e.src=w.dst)
   SELECT 1 FROM walks WHERE src=dst) THEN RAISE EXCEPTION 'Cyclic dependency';END IF;
 END LOOP;
 FOR t IN SELECT * FROM jsonb_array_elements(j->'homeTasks') UNION ALL SELECT pt.value FROM jsonb_array_elements(j->'projects') p CROSS JOIN LATERAL jsonb_array_elements(p->'tasks') pt(value) LOOP
  IF jsonb_typeof(t->'id') IS DISTINCT FROM 'string' OR coalesce(t->>'id','')='' OR jsonb_typeof(t->'title') IS DISTINCT FROM 'string' OR (t->>'id')=ANY(task_ids) THEN RAISE EXCEPTION 'Invalid or duplicate task';END IF;
  task_ids:=array_append(task_ids,t->>'id');
 END LOOP;
 FOR s IN SELECT * FROM jsonb_array_elements(j->'eventSeries') LOOP
  IF coalesce(s->>'frequency','') NOT IN ('daily','weekly') OR jsonb_typeof(s->'count') IS DISTINCT FROM 'number' OR (s->>'count')::numeric<>trunc((s->>'count')::numeric) OR (s->>'count')::numeric NOT BETWEEN 2 AND 52 OR NOT path_sync_private.v2_date(s->>'startDate') OR jsonb_typeof(s->'cancelledDates') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid series';END IF;
  ids:='{}';step:=CASE WHEN s->>'frequency'='weekly' THEN 7 ELSE 1 END;
  FOR item IN SELECT * FROM jsonb_array_elements(s->'cancelledDates') LOOP
   IF jsonb_typeof(item)<>'string' OR NOT path_sync_private.v2_date(item#>>'{}') OR (item#>>'{}')=ANY(ids) THEN RAISE EXCEPTION 'Invalid cancellation';END IF;
   delta:=(item#>>'{}')::date-(s->>'startDate')::date;
   IF delta<0 OR delta%step<>0 OR delta/step>=(s->>'count')::integer THEN RAISE EXCEPTION 'Cancellation out of range';END IF;
   ids:=array_append(ids,item#>>'{}');
  END LOOP;
 END LOOP;
 FOR e IN SELECT * FROM jsonb_array_elements(j->'events') LOOP
  IF e->>'type'='workout' OR e ?| ARRAY['workoutTemplateId','plannedSnapshot','fullWorkoutSnapshot','workoutId','workoutRecordId','programId'] THEN RAISE EXCEPTION 'SPORT_DEPENDENCY';END IF;
  IF e ? 'importance' AND coalesce(e->>'importance','') NOT IN ('none','low','medium','high') OR e ? 'fold' AND coalesce(e->>'fold','') NOT IN ('earlier','later') THEN RAISE EXCEPTION 'Invalid event metadata';END IF;
  IF jsonb_typeof(e->'title') IS DISTINCT FROM 'string' OR NOT path_sync_private.v2_date(e->>'date') OR jsonb_typeof(e->'hour') IS DISTINCT FROM 'number' OR jsonb_typeof(e->'duration') IS DISTINCT FROM 'number' OR (e->>'hour')::numeric<0 OR (e->>'hour')::numeric>=24 OR e->>'id' LIKE 'task-deadline:%' THEN RAISE EXCEPTION 'Invalid event';END IF;
  IF e ? 'taskId' AND (jsonb_typeof(e->'taskId')<>'string' OR NOT (e->>'taskId')=ANY(task_ids)) THEN RAISE EXCEPTION 'Missing task';END IF;
  IF e ? 'projectId' AND (jsonb_typeof(e->'projectId')<>'string' OR NOT (e->>'projectId')=ANY(project_ids) OR e ? 'taskId' AND (task_projects->> (e->>'taskId')) IS DISTINCT FROM e->>'projectId') THEN RAISE EXCEPTION 'Invalid project link';END IF;
  IF e->>'type'='deadline' THEN
   IF (e->>'hour')::numeric<>0 OR (e->>'duration')::numeric<>0 OR e->'done'='true'::jsonb THEN RAISE EXCEPTION 'Invalid deadline';END IF;
  ELSE
   IF (e->>'duration')::numeric<=0 OR jsonb_typeof(e->'tzid') IS DISTINCT FROM 'string' OR jsonb_typeof(e->'start_at') IS DISTINCT FROM 'string' OR jsonb_typeof(e->'end_at') IS DISTINCT FROM 'string' OR e->>'start_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' OR e->>'end_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN RAISE EXCEPTION 'Explicit event time required';END IF;
   stamp:=timezone(e->>'tzid',(e->>'start_at')::timestamptz);
   IF stamp::date<>(e->>'date')::date OR extract(hour FROM stamp)+extract(minute FROM stamp)/60<>(e->>'hour')::numeric OR extract(epoch FROM (e->>'end_at')::timestamptz-(e->>'start_at')::timestamptz)<>(e->>'duration')::numeric*60 THEN RAISE EXCEPTION 'Event time mismatch';END IF;
  END IF;
  IF e ? 'seriesId' THEN
   SELECT x INTO s FROM jsonb_array_elements(j->'eventSeries') x WHERE x->>'id'=e->>'seriesId';
   IF NOT FOUND OR NOT path_sync_private.v2_date(e->>'occurrenceDate') THEN RAISE EXCEPTION 'Missing series';END IF;
   delta:=(e->>'occurrenceDate')::date-(s->>'startDate')::date;step:=CASE WHEN s->>'frequency'='weekly' THEN 7 ELSE 1 END;
   occurrence:=(e->>'seriesId')||':'||(e->>'occurrenceDate');
   IF delta<0 OR delta%step<>0 OR delta/step>=(s->>'count')::integer OR (s->'cancelledDates') ? (e->>'occurrenceDate') OR occurrence=ANY(occurrences) THEN RAISE EXCEPTION 'Invalid occurrence';END IF;
   occurrences:=array_append(occurrences,occurrence);
  END IF;
 END LOOP;
 FOR h IN SELECT * FROM jsonb_array_elements(j->'habits') LOOP
  IF jsonb_typeof(h->'name') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid habit';END IF;
  IF h->>'source'='sport' THEN RAISE EXCEPTION 'SPORT_DEPENDENCY';END IF;
  FOREACH collection IN ARRAY ARRAY['values','checkIns','exceptions'] LOOP
   IF h ? collection THEN
    IF jsonb_typeof(h->collection) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid habit map';END IF;
    FOR pair IN SELECT * FROM jsonb_each(h->collection) LOOP
     IF NOT path_sync_private.v2_date(pair.key) OR collection='values' AND (jsonb_typeof(pair.value)<>'number' OR (pair.value#>>'{}')::numeric<0) OR collection='checkIns' AND jsonb_typeof(pair.value)<>'boolean' OR collection='exceptions' AND pair.value<>'"skipped"'::jsonb THEN RAISE EXCEPTION 'Invalid habit log';END IF;
    END LOOP;
   END IF;
  END LOOP;
  IF h ? 'schedules' THEN
   IF jsonb_typeof(h->'schedules') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid schedules';END IF;
   FOR rule IN SELECT * FROM jsonb_array_elements(h->'schedules') LOOP
    IF rule->>'source'='sport' THEN RAISE EXCEPTION 'SPORT_DEPENDENCY';END IF;
    IF NOT path_sync_private.v2_date(rule->>'from') OR coalesce(rule->>'kind','') NOT IN ('completion','count','duration') OR coalesce(rule->>'frequency','') NOT IN ('daily','days','weekly') OR jsonb_typeof(rule->'goal') IS DISTINCT FROM 'number' OR (rule->>'goal')::numeric<=0 OR coalesce(rule->>'days','') !~ '^[0-6](,[0-6])*$' OR rule ? 'source' AND (rule->>'source') IS DISTINCT FROM 'manual' THEN RAISE EXCEPTION 'Invalid schedule';END IF;
    IF rule->>'frequency'='weekly' AND (jsonb_typeof(rule->'weekTarget') IS DISTINCT FROM 'number' OR (rule->>'weekTarget')::numeric NOT BETWEEN 1 AND 7 OR (rule->>'weekTarget')::numeric<>trunc((rule->>'weekTarget')::numeric)) THEN RAISE EXCEPTION 'Invalid weekly target';END IF;
   END LOOP;
  END IF;
  IF h ? 'availability' THEN
   IF jsonb_typeof(h->'availability') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid availability';END IF;ids:='{}';
   FOR rule IN SELECT * FROM jsonb_array_elements(h->'availability') LOOP
    IF NOT path_sync_private.v2_date(rule->>'from') OR coalesce(rule->>'state','') NOT IN ('active','paused','archived') OR (rule->>'from')=ANY(ids) THEN RAISE EXCEPTION 'Invalid history';END IF;ids:=array_append(ids,rule->>'from');
   END LOOP;
  END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION path_sync_private.v2_owner() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL OR auth.jwt()->>'client_id' IS DISTINCT FROM '00000000-0000-4000-8000-000000000000' OR NOT EXISTS(SELECT 1 FROM path_sync_private.testers WHERE owner_id=u) OR NOT EXISTS(SELECT 1 FROM path_sync_private.v2_testers WHERE owner_id=u) THEN RAISE EXCEPTION 'Sync access denied' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 RETURN u;
END $$;
CREATE OR REPLACE FUNCTION public.path_sync_read_v2() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=path_sync_private.v2_owner(); h path_sync_private.v2_heads%ROWTYPE; old path_sync_private.heads%ROWTYPE;
BEGIN
 SELECT * INTO h FROM path_sync_private.v2_heads WHERE owner_id=u;
 IF FOUND THEN RETURN jsonb_build_object('active',true,'revision',h.revision,'payload',h.payload);END IF;
 SELECT * INTO old FROM path_sync_private.heads WHERE owner_id=u;
 RETURN jsonb_build_object('active',false,'revision',0,'legacyRevision',coalesce(old.revision,0),'payload',coalesce(old.payload,'{"schema":1,"homeTasks":[],"projects":[]}'::jsonb)||'{"schema":2,"events":[],"eventSeries":[],"habits":[]}'::jsonb);
END $$;
CREATE OR REPLACE FUNCTION public.path_sync_push_v2(p_operation uuid,p_expected bigint,p_payload jsonb,p_legacy_revision bigint DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=path_sync_private.v2_owner(); h path_sync_private.v2_heads%ROWTYPE; r path_sync_private.v2_revisions%ROWTYPE; old path_sync_private.heads%ROWTYPE; active boolean;
BEGIN
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
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA path_sync_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.path_sync_read_v2() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.path_sync_push_v2(uuid,bigint,jsonb,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.path_sync_read_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.path_sync_push_v2(uuid,bigint,jsonb,bigint) TO authenticated;
-- v1 function bodies below preserve the existing behavior with an upgrade guard.

-- Preserve v1 behavior for all accounts not activated on v2.
CREATE OR REPLACE FUNCTION public.path_sync_read_v1() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := auth.uid(); h path_sync_private.heads%ROWTYPE;
BEGIN
 IF u IS NULL OR (auth.jwt()->>'client_id') IS DISTINCT FROM '00000000-0000-4000-8000-000000000000'
 OR NOT EXISTS(SELECT 1 FROM path_sync_private.testers WHERE owner_id=u) THEN
  RAISE EXCEPTION 'Sync access denied' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 IF EXISTS(SELECT 1 FROM path_sync_private.v2_heads WHERE owner_id=u) THEN RAISE EXCEPTION 'SYNC_CLIENT_UPGRADE_REQUIRED' USING ERRCODE='55000';END IF;
 SELECT * INTO h FROM path_sync_private.heads WHERE owner_id=u;
 IF NOT FOUND THEN RETURN jsonb_build_object('revision',0,'payload','{"schema":1,"homeTasks":[],"projects":[]}'::jsonb);END IF;
 RETURN jsonb_build_object('revision',h.revision,'payload',h.payload);
END $$;
CREATE OR REPLACE FUNCTION public.path_sync_push_v1(p_operation uuid,p_expected bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := auth.uid(); h path_sync_private.heads%ROWTYPE; r path_sync_private.revisions%ROWTYPE;
BEGIN
 IF u IS NULL OR (auth.jwt()->>'client_id') IS DISTINCT FROM '00000000-0000-4000-8000-000000000000'
 OR NOT EXISTS(SELECT 1 FROM path_sync_private.testers WHERE owner_id=u) THEN
  RAISE EXCEPTION 'Sync access denied' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 IF EXISTS(SELECT 1 FROM path_sync_private.v2_heads WHERE owner_id=u) THEN RAISE EXCEPTION 'SYNC_CLIENT_UPGRADE_REQUIRED' USING ERRCODE='55000';END IF;
 IF p_operation IS NULL OR p_expected IS NULL OR p_expected<0 OR p_expected>=9007199254740991 OR p_payload IS NULL THEN RAISE EXCEPTION 'Invalid operation';END IF;
 IF octet_length(p_payload::text)>2097152 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid snapshot';END IF;
 IF p_payload->'schema' IS DISTINCT FROM '1'::jsonb OR jsonb_typeof(p_payload->'homeTasks') IS DISTINCT FROM 'array'
 OR jsonb_typeof(p_payload->'projects') IS DISTINCT FROM 'array' OR (p_payload - ARRAY['schema','homeTasks','projects']) <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid snapshot schema';END IF;
 -- Stable nonempty IDs are required; uniqueness is checked across both task collections.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'projects') p WHERE jsonb_typeof(p->'tasks') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'id') IS DISTINCT FROM 'string' OR coalesce(p->>'id','')='' OR jsonb_typeof(p->'name') IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'Invalid project';END IF;
 IF EXISTS(SELECT p->>'id' FROM jsonb_array_elements(p_payload->'projects') p GROUP BY p->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate project';END IF;
 IF EXISTS(WITH tasks AS(SELECT t FROM jsonb_array_elements(p_payload->'homeTasks') t UNION ALL SELECT t FROM jsonb_array_elements(p_payload->'projects') p CROSS JOIN LATERAL jsonb_array_elements(p->'tasks') t)
 SELECT 1 FROM tasks WHERE jsonb_typeof(t->'id') IS DISTINCT FROM 'string' OR coalesce(t->>'id','')='' OR jsonb_typeof(t->'title') IS DISTINCT FROM 'string') THEN RAISE EXCEPTION 'Invalid task';END IF;
 IF EXISTS(WITH tasks AS(SELECT t FROM jsonb_array_elements(p_payload->'homeTasks') t UNION ALL SELECT t FROM jsonb_array_elements(p_payload->'projects') p CROSS JOIN LATERAL jsonb_array_elements(p->'tasks') t)
 SELECT t->>'id' FROM tasks GROUP BY t->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate task';END IF;
 INSERT INTO path_sync_private.heads(owner_id) VALUES(u) ON CONFLICT DO NOTHING;
 SELECT * INTO h FROM path_sync_private.heads WHERE owner_id=u FOR UPDATE;
 SELECT * INTO r FROM path_sync_private.revisions WHERE owner_id=u AND operation_id=p_operation;
 IF FOUND THEN
  IF r.payload IS DISTINCT FROM p_payload OR r.revision<>p_expected+1 THEN RAISE EXCEPTION 'Operation ID reused';END IF;
  RETURN jsonb_build_object('ok',true,'revision',r.revision,'payload',r.payload);
 END IF;
 IF h.revision<>p_expected THEN RETURN jsonb_build_object('ok',false,'revision',h.revision,'payload',h.payload);END IF;
 INSERT INTO path_sync_private.revisions(owner_id,revision,operation_id,payload) VALUES(u,h.revision+1,p_operation,p_payload);
 UPDATE path_sync_private.heads SET revision=h.revision+1,payload=p_payload,updated_at=now() WHERE owner_id=u;
 RETURN jsonb_build_object('ok',true,'revision',h.revision+1,'payload',p_payload);
END $$;
COMMIT;
