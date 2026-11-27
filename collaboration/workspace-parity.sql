-- RC30 keeps the existing RPC, resource IDs, grants and revisions. Earlier clients
-- receive their original projection and can edit it without discarding new fields.
begin;
create or replace function path_collab.detail_fields(obj jsonb, strings text[], numbers text[] default '{}', booleans text[] default '{}')
returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
 from jsonb_each(obj)
 where (key=any(strings) and jsonb_typeof(value)='string')
    or (key=any(numbers) and jsonb_typeof(value)='number')
    or (key=any(booleans) and jsonb_typeof(value)='boolean')
$$;

-- Validate collection identity before making ID-indexed projections.
create or replace function path_collab.detail_rows(items jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(items) is distinct from 'array' then raise exception 'SHARE_INVALID'; end if;
 if exists(select from jsonb_array_elements(items) i where jsonb_typeof(i) is distinct from 'object'
       or jsonb_typeof(i->'id') is distinct from 'string' or length(i->>'id') not between 1 and 160)
    or exists(select from jsonb_array_elements(items) i group by i->>'id' having count(*)>1)
 then raise exception 'SHARE_INVALID'; end if;
 return items;
end $$;

create or replace function path_collab.detail_task(item jsonb, ids jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare outrow jsonb;
begin
 outrow=path_collab.detail_fields(item,array['id','title','description','status','start','end','deadline','importance'],
                                  array['progress','estimate'],array['archived']);
 if item ? 'subtasks' and item->'subtasks'<>'null' then
  outrow=outrow||jsonb_build_object('subtasks',(select coalesce(jsonb_agg(path_collab.detail_fields(s,array['id','title'],'{}',array['done']) order by n),'[]')
   from jsonb_array_elements(path_collab.detail_rows(item->'subtasks')) with ordinality as a(s,n)));
 end if;
 if jsonb_typeof(item->'dependencies')='array' then
  outrow=outrow||jsonb_build_object('dependencies',(select coalesce(jsonb_agg(d order by pos),'[]') from (
    select d,min(n) pos from jsonb_array_elements(item->'dependencies') with ordinality as a(d,n)
    where jsonb_typeof(d)='string' and ids ? (d#>>'{}') and d<>item->'id' group by d) dependencies));
 end if;
 return outrow;
end $$;

create or replace function path_collab.detail_ink(data jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare pairs jsonb;
begin
 if jsonb_typeof(data) is distinct from 'object'
 or jsonb_typeof(data->'width') is distinct from 'number' or jsonb_typeof(data->'height') is distinct from 'number'
 or not (data->'width'>'0'::jsonb and data->'height'>'0'::jsonb)
 or jsonb_typeof(data->'color') is distinct from 'string' or (data->>'color') !~ '^#[a-fA-F0-9]{6}$'
 or not ('[2,4,8,12]'::jsonb @> jsonb_build_array(data->'size')) then return null; end if;
 pairs=data->'points';
 if jsonb_typeof(pairs) is distinct from 'array' then return null; end if;
 if jsonb_array_length(pairs)<2 or exists(select from jsonb_array_elements(pairs) p where
   case when jsonb_typeof(p)<>'array' then true else
     jsonb_array_length(p)<>2 or jsonb_typeof(p->0) is distinct from 'number' or jsonb_typeof(p->1) is distinct from 'number'
     or (p->0)<'0'::jsonb or (p->1)<'0'::jsonb or (p->0)>data->'width' or (p->1)>data->'height' end)
 then return null; end if;
 return path_collab.detail_fields(data,array['color'],array['width','height','size'])||jsonb_build_object('points',pairs);
end $$;

create or replace function path_collab.detail_file(data jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare body text; prefix text; size_bytes integer;
begin
 if jsonb_typeof(data) is distinct from 'object' or jsonb_typeof(data->'type') is distinct from 'string'
    or data->>'type' not in ('application/pdf','text/plain') or jsonb_typeof(data->'name') is distinct from 'string'
    or length(btrim(data->>'name'))=0 or jsonb_typeof(data->'size') is distinct from 'number'
    or (data->>'size')::numeric not between 0 and 2097152 or trunc((data->>'size')::numeric)<>(data->>'size')::numeric
    or jsonb_typeof(data->'data') is distinct from 'string'
 then return null; end if;
 size_bytes=(data->>'size')::numeric::integer;
 prefix='data:'||(data->>'type')||';base64,';
 if left(data->>'data',length(prefix))<>prefix then return null; end if;
 body=substr(data->>'data',length(prefix)+1);
 if length(body)<>4*((size_bytes+2)/3) or body !~ '^[A-Za-z0-9+/]*={0,2}$'
    or length(body)-length(rtrim(body,'='))<>(3-size_bytes%3)%3 then return null; end if;
 return path_collab.detail_fields(data,array['name','type','data'],array['size']);
end $$;

create or replace function path_collab.detail_node(item jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare geometry jsonb:=path_collab.detail_fields(item,array['id'],array['x','y','width','height']);
 kind text:=coalesce(nullif(item->>'kind',''),case when item->>'image' is not null then 'image' else 'note' end);
 outrow jsonb; ink jsonb; field_name text;
begin
 foreach field_name in array array['x','y','width','height'] loop
  if jsonb_typeof(item->field_name)='string' and length(item->>field_name)<=24 and item->>field_name ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' then
   geometry=geometry||jsonb_build_object(field_name,(item->>field_name)::numeric);
  end if;
 end loop;
 if exists(select from unnest(array['entityRef','linkedResourceId','linked_resource_id','sourceNoteId','noteId','taskId','projectId','eventId','attachmentId']) ref
   where item->ref is not null and item->ref<>'null')
 or kind not in ('text','note','image','link','group','drawing','checklist','file')
 then return geometry||'{"kind":"restricted"}'; end if;
 outrow=geometry||jsonb_build_object('kind',kind)||path_collab.detail_fields(item,array['title','body']);
 if kind='link' then
  if jsonb_typeof(item->'url') is distinct from 'string' or (item->>'url') !~* '^https?://[^[:space:]/?#@\\]+([/?#][^[:space:]\\]*)?$'
  then return geometry||'{"kind":"restricted"}'; end if;
  outrow=outrow||jsonb_build_object('url',item->'url');
 elsif kind='image' and jsonb_typeof(item->'image')='string' and (item->>'image') ~* '^data:image/(png|jpeg|webp);base64,[a-z0-9+/]+=*$' then
  outrow=outrow||jsonb_build_object('image',item->'image');
 elsif kind='file' then
  ink=path_collab.detail_file(item->'attachment');
  if ink is null then return geometry||'{"kind":"restricted"}'; end if;
  outrow=outrow||jsonb_build_object('attachment',ink);
 elsif kind='drawing' then
  ink=path_collab.detail_ink(item->'ink');
  if ink is null then return geometry||'{"kind":"restricted"}'; end if;
  outrow=outrow||jsonb_build_object('ink',ink);
 elsif kind='group' then
  outrow=outrow||path_collab.detail_fields(item,'{}','{}',array['collapsed']);
 end if;
 return outrow;
end $$;

create or replace function path_collab.detail_edge(item jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare edge jsonb:=path_collab.detail_fields(item,array['from','to','label'],'{}',array['directed']); k text;
begin
 if jsonb_typeof(item->'id')='string' and length(item->>'id') between 1 and 160 then edge=edge||jsonb_build_object('id',item->'id'); end if;
 foreach k in array array['fromSide','toSide'] loop
  if item->>k in ('top','bottom','left','right') then edge=edge||jsonb_build_object(k,item->k); end if;
 end loop;
 if item->>'lineStyle' in ('solid','dashed') then edge=edge||jsonb_build_object('lineStyle',item->'lineStyle'); end if;
 if item->'lineWidth' in ('1'::jsonb,'1.5'::jsonb,'2.5'::jsonb) then edge=edge||jsonb_build_object('lineWidth',item->'lineWidth'); end if;
 return edge;
end $$;

create or replace function path_collab.detail_document(k text,j jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare key text:=case k when 'project' then 'tasks' else 'nodes' end; items jsonb; ids jsonb; result jsonb;
begin
 if k is null or k not in ('project','canvas') or jsonb_typeof(j) is distinct from 'object'
 or jsonb_typeof(j->'name') is distinct from 'string' or length(btrim(j->>'name')) not between 1 and 250 or octet_length(j::text)>8388608
 then raise exception 'SHARE_INVALID'; end if;
 items=path_collab.detail_rows(j->key);
 select coalesce(jsonb_object_agg(v->>'id',true),'{}') into ids from jsonb_array_elements(items) v;
 result=path_collab.detail_fields(j,array['name'],'{}',array['restoredDetails']);
 if k='project' then
  result=result||path_collab.detail_fields(j,array['description','type'])||jsonb_build_object('status',
   case when j->>'status' in ('paused','completed') then j->>'status' else 'active' end,'tasks',
   (select coalesce(jsonb_agg(path_collab.detail_task(v,ids) order by n),'[]') from jsonb_array_elements(items) with ordinality a(v,n)));
  if j ? 'milestones' and j->'milestones'<>'null' then
   result=result||jsonb_build_object('milestones',(select coalesce(jsonb_agg(path_collab.detail_fields(v,array['id','title','date','completedAt']) order by n),'[]')
    from jsonb_array_elements(path_collab.detail_rows(j->'milestones')) with ordinality a(v,n)));
  end if;
 else
  if jsonb_typeof(coalesce(j->'edges','[]'))<>'array' then raise exception 'SHARE_INVALID'; end if;
  result=result||jsonb_build_object('nodes',(select coalesce(jsonb_agg(path_collab.detail_node(v) order by n),'[]')
    from jsonb_array_elements(items) with ordinality a(v,n)),'edges',(select coalesce(jsonb_agg(path_collab.detail_edge(v) order by n),'[]')
    from jsonb_array_elements(coalesce(j->'edges','[]')) with ordinality a(v,n)
    where jsonb_typeof(v)='object' and jsonb_typeof(v->'from')='string' and jsonb_typeof(v->'to')='string' and ids ? (v->>'from') and ids ? (v->>'to')));
 end if;
 return result;
end $$;

-- RC30 can refer to unchanged media in this same resource at its exact base
-- revision. IDs alone never authorize access to another board or old revision.
create or replace function path_collab.restore_media_node(node jsonb, original jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
 if original is null or node->'kind' is distinct from original->'kind'
    or exists(select from unnest(array['entityRef','linkedResourceId','linked_resource_id','sourceNoteId','noteId','taskId','projectId','eventId','attachmentId']) ref
       where node->ref is not null and node->ref<>'null')
 then raise exception 'SHARE_INVALID'; end if;
 if node->>'kind'='image' and not node ? 'image' and jsonb_typeof(original->'image')='string' then
  return jsonb_set(node,'{image}',original->'image');
 elsif node->>'kind'='file' and jsonb_typeof(node->'attachment')='object' and not (node->'attachment') ? 'data'
   and jsonb_typeof(original#>'{attachment,data}')='string'
   and node#>'{attachment,type}'=original#>'{attachment,type}' and node#>'{attachment,size}'=original#>'{attachment,size}'
   and length(btrim(coalesce(node#>>'{attachment,name}','')))>0 then
  return jsonb_set(node,'{attachment,data}',original#>'{attachment,data}');
 end if;
 raise exception 'SHARE_INVALID';
end $$;

create or replace function path_collab.restore_media(candidate jsonb, original jsonb, refs jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare ref_map jsonb; originals jsonb; items jsonb; matched integer; nodes jsonb;
begin
 if jsonb_typeof(refs) is distinct from 'array' or jsonb_typeof(candidate) is distinct from 'object' or octet_length(candidate::text)>8388608 then raise exception 'SHARE_INVALID'; end if;
 if jsonb_array_length(refs)>jsonb_array_length(original->'nodes') or exists(select from jsonb_array_elements(refs) v
  where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 160) then raise exception 'SHARE_INVALID'; end if;
 select coalesce(jsonb_object_agg(id,true),'{}'),count(distinct id) into ref_map,matched from jsonb_array_elements_text(refs) id;
 if matched<>jsonb_array_length(refs) then raise exception 'SHARE_INVALID'; end if;
 nodes=path_collab.detail_rows(candidate->'nodes');
 select coalesce(jsonb_object_agg(v->>'id',v),'{}') into originals from jsonb_array_elements(original->'nodes') v where ref_map ? (v->>'id');
 select coalesce(jsonb_agg(case when ref_map ? (v->>'id') then path_collab.restore_media_node(v,originals->(v->>'id')) else v end order by n),'[]'),
        count(*) filter(where ref_map ? (v->>'id')) into items,matched from jsonb_array_elements(nodes) with ordinality a(v,n);
 if matched<>jsonb_array_length(refs) then raise exception 'SHARE_INVALID'; end if;
 return jsonb_set(candidate,'{nodes}',items);
end $$;

create or replace function path_collab.omit_media(doc jsonb, refs jsonb) returns jsonb
language sql immutable set search_path='' as $$
 with keys as (select coalesce(jsonb_object_agg(id,true),'{}') ids from jsonb_array_elements_text(refs) id)
 select jsonb_set(doc,'{nodes}',coalesce(jsonb_agg(case when keys.ids ? (v->>'id') then
  case v->>'kind' when 'image' then v-'image' when 'file' then v#-'{attachment,data}' else v end
  else v end order by n),'[]')) from keys,jsonb_array_elements(doc->'nodes') with ordinality a(v,n)
$$;

-- Old projects had no archive UI. Keep archived tasks out of the old active list.
create or replace function path_collab.legacy_document(kind text, document jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
 if kind='project' then
  document=jsonb_set(document,'{tasks}',(select coalesce(jsonb_agg(v order by n),'[]')
   from jsonb_array_elements(document->'tasks') with ordinality a(v,n)
   where v->'archived' is distinct from 'true'::jsonb));
 end if;
 return path_collab.project_document(kind,document);
end $$;

-- Apply changes from a projected RC27–29 document to the stored rich document.
-- Stable IDs keep descriptions, drawings, milestone data and connection styles.
create or replace function path_collab.merge_legacy(kind text, stored jsonb, submitted jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare k text:=case kind when 'project' then 'tasks' else 'nodes' end;
 oldview jsonb:=path_collab.legacy_document(kind,stored); proposal jsonb:=path_collab.project_document(kind,submitted);
 by_id jsonb; before_by_id jsonb; by_pair jsonb; merged jsonb:=stored; rows_out jsonb;
begin
 if proposal=oldview then return stored; end if;
 if proposal->'name' is distinct from oldview->'name' then merged=jsonb_set(merged,'{name}',proposal->'name'); end if;
 if kind='project' and proposal->'status' is distinct from oldview->'status' then merged=jsonb_set(merged,'{status}',proposal->'status'); end if;
 select coalesce(jsonb_object_agg(v->>'id',v),'{}') into by_id from jsonb_array_elements(stored->k) v;
 select coalesce(jsonb_object_agg(v->>'id',v),'{}') into before_by_id from jsonb_array_elements(oldview->k) v;
 select coalesce(jsonb_agg(case
  when not by_id ? (v->>'id') then v
  else by_id->(v->>'id')||coalesce((select jsonb_object_agg(p.key,p.value) from jsonb_each(v) p
   where p.value is distinct from (before_by_id->(v->>'id')->p.key)
     and (before_by_id->(v->>'id')->>'kind' is distinct from 'restricted' or p.key in ('x','y','width','height'))),'{}')
  end order by n),'[]') into rows_out from jsonb_array_elements(proposal->k) with ordinality a(v,n);
 if kind='project' then
  -- Old editors never delete or reorder tasks. Preserve the original order
  -- among active and archived rows, and append newly-created old-client tasks.
  select coalesce(jsonb_agg(v order by part,n),'[]') into rows_out from (
   select case when s.v->'archived'='true'::jsonb then s.v else u.v end v,0 part,s.n
    from jsonb_array_elements(stored->k) with ordinality s(v,n)
    left join jsonb_array_elements(rows_out) u(v) on u.v->'id'=s.v->'id'
    where s.v->'archived'='true'::jsonb or u.v is not null
   union all select u.v,1,u.n from jsonb_array_elements(rows_out) with ordinality u(v,n)
    where not by_id ? (u.v->>'id')) ordered;
 end if;
 merged=jsonb_set(merged,array[k],rows_out);
 if kind='canvas' and proposal->'edges' is distinct from oldview->'edges' then
  select coalesce(jsonb_object_agg(jsonb_build_array(e->'from',e->'to')::text,e),'{}') into by_pair from jsonb_array_elements(stored->'edges') e;
  merged=jsonb_set(merged,'{edges}',(select coalesce(jsonb_agg(coalesce(by_pair->(jsonb_build_array(v->'from',v->'to')::text),v) order by n),'[]')
   from jsonb_array_elements(proposal->'edges') with ordinality a(v,n)));
 end if;
 if octet_length(merged::text)>8388608 then raise exception 'SHARE_INVALID'; end if;
 return merged;
end $$;

revoke all on function path_collab.detail_fields(jsonb,text[],text[],text[]),path_collab.detail_rows(jsonb),
 path_collab.detail_task(jsonb,jsonb),path_collab.detail_ink(jsonb),path_collab.detail_node(jsonb),path_collab.detail_edge(jsonb),
 path_collab.restore_media_node(jsonb,jsonb),path_collab.restore_media(jsonb,jsonb,jsonb),path_collab.omit_media(jsonb,jsonb),
 path_collab.detail_file(jsonb),path_collab.legacy_document(text,jsonb),path_collab.detail_document(text,jsonb),path_collab.merge_legacy(text,jsonb,jsonb) from public,anon,authenticated;

create or replace function path_collab.request(action text,args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 who uuid:=auth.uid(); address text; r path_collab.resources%rowtype;
 invite path_collab.invites%rowtype; my_role text; target uuid; old_role text; next_role text;
 rich boolean:=args->'detailVersion'='3'::jsonb; compact_refs jsonb; candidate jsonb; manager boolean; doc jsonb; obj uuid;
 members_json jsonb; pending jsonb; result jsonb; resource_rows jsonb;
begin
 if who is null then raise exception 'SHARE_DENIED'; end if;
 select lower(btrim(email)) into address from auth.users where id=who and email_confirmed_at is not null;
 if address is null then raise exception 'SHARE_DENIED'; end if;
 if jsonb_typeof(args) is distinct from 'object' then raise exception 'SHARE_INVALID'; end if;
 if action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'name',x.document->>'name','owner',x.owner_id=who,
   'taskCount',case when x.kind='project' then (select count(*) from jsonb_array_elements(x.document->'tasks') item where item->'archived' is distinct from 'true'::jsonb) end,
   'doneCount',case when x.kind='project' then (select count(*) from jsonb_array_elements(x.document->'tasks') item where item->'archived' is distinct from 'true'::jsonb and item->>'status'='done') end,
   'nodeCount',case when x.kind='canvas' then jsonb_array_length(x.document->'nodes') end,
   'role',case when x.owner_id=who then 'owner' else m.role end,'status',x.document->>'status','source',case when x.source_owner=who then x.source end) order by x.document->>'name',x.id),'[]') into resource_rows
   from path_collab.resources x left join path_collab.members m on m.resource=x.id and m.account=who where x.owner_id=who or m.account is not null;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'kind',x.kind,'name',x.document->>'name','role',i.role) order by i.expires),'[]') into pending
   from path_collab.invites i join path_collab.resources x on x.id=i.resource
   where i.email=address and i.expires>now();
  -- RC27/28 read 'subscribed' as permission to share. This response is scoped to collaboration.
  return jsonb_build_object('detailVersion',3,'retainsMedia',true,'account',who,'resources',resource_rows,'canShare',true,'subscribed',true,'inbox',pending);
 end if;
 if action='create' then
  if length(coalesce(args->>'source','')) not between 1 and 160 then raise exception 'SHARE_INVALID'; end if;
  doc=case when rich then path_collab.detail_document(args->>'kind',args->'document')||'{"restoredDetails":true}'::jsonb
   else path_collab.project_document(args->>'kind',args->'document') end;
  insert into path_collab.resources(owner_id,source_owner,kind,source,document) values(who,who,args->>'kind',args->>'source',doc)
   on conflict(source_owner,kind,source) do nothing;
  select id into obj from path_collab.resources where source_owner=who and kind=args->>'kind' and source=args->>'source';
 elsif action in ('accept','decline') then
  select resource into obj from path_collab.invites where id=(args->>'invitation')::uuid and email=address;
  if obj is null and action='accept' then
   select resource into obj from path_collab.members where account=who and accepted_invite=(args->>'invitation')::uuid;
   if obj is not null then action='get'; end if;
  end if;
 else obj=(args->>'id')::uuid; end if;
 select * into r from path_collab.resources where id=obj for update;
 if not found then raise exception 'SHARE_DENIED'; end if;
 if who=r.owner_id then my_role='owner'; else select role into my_role from path_collab.members where resource=r.id and account=who; end if;
 manager=coalesce(my_role in ('owner','admin'),false);
 if action in ('accept','decline') then
  select * into invite from path_collab.invites where id=(args->>'invitation')::uuid and resource=r.id and email=address and expires>now();
  if not found then raise exception 'SHARE_DENIED'; end if;
  if action='accept' then
   insert into path_collab.members(resource,account,role,accepted_invite) values(r.id,who,invite.role,invite.id) on conflict do nothing;
   select role into my_role from path_collab.members where resource=r.id and account=who;
   manager=coalesce(my_role in ('owner','admin'),false);
  end if;
  delete from path_collab.invites where id=invite.id;
 elsif my_role is null then raise exception 'SHARE_DENIED';
 elsif action='save' then
  if my_role='viewer' then raise exception 'SHARE_DENIED'; end if;
  candidate=args->'document';
  if rich and args ? 'retainedMedia' then
   if r.kind<>'canvas' then raise exception 'SHARE_INVALID'; end if;
   if r.revision is distinct from (args->>'revision')::bigint then raise exception 'SHARE_CONFLICT'; end if;
   compact_refs=args->'retainedMedia';
   candidate=path_collab.restore_media(candidate,r.document,compact_refs);
  end if;
  doc=case when rich then path_collab.detail_document(r.kind,candidate)
   else path_collab.merge_legacy(r.kind,r.document,candidate) end;
  if r.document->'restoredDetails'='true'::jsonb then
   doc=doc||'{"restoredDetails":true}'::jsonb;
  elsif doc->'restoredDetails'='true'::jsonb and (my_role<>'owner' or who<>r.source_owner) then
   raise exception 'SHARE_DENIED';
  end if;
  if r.revision is distinct from (args->>'revision')::bigint then
   if doc<>r.document then raise exception 'SHARE_CONFLICT'; end if;
  elsif doc<>r.document then
   update path_collab.resources set document=doc,revision=revision+1 where id=r.id returning * into r;
  end if;
 elsif action='offer_transfer' then
  target=(args->>'account')::uuid;
  if my_role<>'owner' or target=who or not exists(select from path_collab.members where resource=r.id and account=target) then raise exception 'SHARE_DENIED'; end if;
  update path_collab.resources set transfer_to=target where id=r.id returning * into r;
 elsif action='cancel_transfer' then
  if my_role<>'owner' and who is distinct from r.transfer_to then raise exception 'SHARE_DENIED'; end if;
  update path_collab.resources set transfer_to=null where id=r.id returning * into r;
 elsif action='take_ownership' then
  if who is distinct from r.transfer_to then raise exception 'SHARE_DENIED'; end if;
  delete from path_collab.members where resource=r.id and account=who;
  insert into path_collab.members(resource,account,role) values(r.id,r.owner_id,'editor');
  update path_collab.resources set owner_id=who,transfer_to=null where id=r.id returning * into r;
  my_role='owner';manager=true;
 elsif action='invite' then
  next_role=args->>'role';
  if not manager or next_role is null or next_role not in ('viewer','editor','admin') or my_role='admin' and next_role='admin' then raise exception 'SHARE_DENIED'; end if;
  if length(coalesce(args->>'email',''))>254 or lower(btrim(coalesce(args->>'email',''))) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'SHARE_INVALID'; end if;
  if exists(select from auth.users u where lower(u.email)=lower(btrim(args->>'email')) and (u.id=r.owner_id or exists(select from path_collab.members m where m.resource=r.id and m.account=u.id))) then raise exception 'SHARE_INVALID'; end if;
  delete from path_collab.invites where resource=r.id and email=lower(btrim(args->>'email')) and expires<=now();
  if my_role='admin' and exists(select from path_collab.invites where resource=r.id and email=lower(btrim(args->>'email')) and role='admin' and expires>now()) then raise exception 'SHARE_DENIED'; end if;
  if (select count(*) from path_collab.audit a where a.actor=who and a.action='invite' and created_at>now()-interval '1 hour')>=50 then raise exception 'SHARE_RATE'; end if;
  insert into path_collab.invites(resource,email,role,expires) values(r.id,lower(btrim(args->>'email')),next_role,now()+interval '7 days')
  on conflict(resource,email) do update set role=excluded.role,expires=excluded.expires,id=case when path_collab.invites.expires>now() and path_collab.invites.role=excluded.role then path_collab.invites.id else gen_random_uuid() end returning * into invite;
  insert into path_collab.invite_mail(invitation) values(invite.id) on conflict do nothing;
 elsif action='revoke' then
  if not manager then raise exception 'SHARE_DENIED'; end if;
  delete from path_collab.invites where resource=r.id and id=(args->>'invitation')::uuid and (my_role='owner' or role<>'admin');
 elsif action in ('remove','role','leave') then
  target=case when action='leave' then who else (args->>'account')::uuid end;
  select role into old_role from path_collab.members where resource=r.id and account=target;
  if target=r.owner_id or old_role is null then raise exception 'SHARE_DENIED'; end if;
  if action<>'leave' and (not manager or target=who or my_role='admin' and old_role='admin') then raise exception 'SHARE_DENIED'; end if;
  if action='role' then
   next_role=args->>'role';
   if next_role is null or next_role not in ('admin','editor','viewer') or next_role='admin' and my_role<>'owner' then raise exception 'SHARE_DENIED'; end if;
   update path_collab.members set role=next_role where resource=r.id and account=target;
  else
   delete from path_collab.members where resource=r.id and account=target;
   if r.transfer_to=target then update path_collab.resources set transfer_to=null where id=r.id returning * into r; end if;
  end if;
 elsif action not in ('get','create') or action is null then raise exception 'SHARE_INVALID'; end if;
 if action not in ('get','create') then insert into path_collab.audit(resource,actor,action) values(r.id,who,action); end if;
 if action in ('decline','leave') then return jsonb_build_object('ok',true); end if;
 select coalesce(jsonb_agg(jsonb_build_object('account',m.account,'role',m.role,'name',coalesce(nullif(u.raw_user_meta_data->>'display_name',''),split_part(u.email,'@',1))) order by m.account),'[]') into members_json
  from path_collab.members m join auth.users u on u.id=m.account where m.resource=r.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expires',expires) order by email),'[]') into pending
  from path_collab.invites where resource=r.id and manager and expires>now() and (my_role='owner' or role<>'admin');
 result=jsonb_build_object('detailVersion',3,'retainsMedia',true,'id',r.id,'kind',r.kind,'revision',r.revision,'owner',who=r.owner_id,'role',my_role,'active',true,'writable',my_role<>'viewer','members',members_json,'pending',pending,'account',who,'transfer',case when r.owner_id=who or r.transfer_to=who then r.transfer_to end,'ownerName',(select coalesce(nullif(raw_user_meta_data->>'display_name',''),split_part(email,'@',1)) from auth.users where id=r.owner_id));
 if compact_refs is not null then
  result=result||jsonb_build_object('retainedMedia',compact_refs,'document',path_collab.omit_media(r.document,compact_refs));
 elsif action<>'get' or (args->>'revision')::bigint is distinct from r.revision then
  result=result||jsonb_build_object('document',case when rich then r.document else path_collab.legacy_document(r.kind,r.document) end);
 end if;
 return result;
end $$;

commit;
