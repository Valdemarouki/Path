-- Path Cloud Sync, private test only. Run once in Path Accounts Test / SQL Editor.
-- Additive: does not change auth users, existing application tables or local data.
BEGIN;
CREATE SCHEMA IF NOT EXISTS path_sync_private;
REVOKE ALL ON SCHEMA path_sync_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS path_sync_private.testers (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS path_sync_private.heads (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 payload jsonb NOT NULL DEFAULT '{"schema":1,"homeTasks":[],"projects":[]}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS path_sync_private.revisions (
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL CHECK(revision>0),
 operation_id uuid NOT NULL,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,revision), UNIQUE(owner_id,operation_id)
);
ALTER TABLE path_sync_private.testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_sync_private.heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE path_sync_private.revisions ENABLE ROW LEVEL SECURITY;
-- No direct client access, including through automatically exposed tables.
REVOKE ALL ON ALL TABLES IN SCHEMA path_sync_private FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.path_sync_read_v1() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE u uuid := auth.uid(); h path_sync_private.heads%ROWTYPE;
BEGIN
 IF u IS NULL OR (auth.jwt()->>'client_id') IS DISTINCT FROM '00000000-0000-4000-8000-000000000000'
 OR NOT EXISTS(SELECT 1 FROM path_sync_private.testers WHERE owner_id=u) THEN
  RAISE EXCEPTION 'Sync access denied' USING ERRCODE='42501';
 END IF;
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
REVOKE ALL ON FUNCTION public.path_sync_read_v1() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.path_sync_push_v1(uuid,bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.path_sync_read_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.path_sync_push_v1(uuid,bigint,jsonb) TO authenticated;
COMMIT;
-- No tester is enabled automatically. After checking the migration, separately add
-- your test user UUID (Authentication > Users) using the supplied enable-test-user.sql.
