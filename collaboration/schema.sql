-- Path collaboration v2. Install together in one transaction after review.
begin;
create schema if not exists path_collab;
revoke all on schema path_collab from public, anon, authenticated;

-- Server-owned entitlement. A billing integration can maintain this later.
create table path_collab.entitlements (
  account uuid primary key references auth.users(id) on delete cascade,
  valid_until timestamptz not null
);
create table path_collab.resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  kind text not null check (kind in ('project','canvas')),
  source text not null,
  source_owner uuid not null,
  transfer_to uuid references auth.users(id) on delete set null,
  document jsonb not null,
  revision bigint not null default 1,
  unique(source_owner,kind,source)
);
create table path_collab.members (
  resource uuid references path_collab.resources on delete cascade,
  account uuid references auth.users(id) on delete cascade,
  role text not null check(role in ('admin','editor','viewer')),
  accepted_invite uuid unique,
  primary key(resource,account)
);
create index members_by_account on path_collab.members(account);
create table path_collab.invites (
  id uuid primary key default gen_random_uuid(),
  resource uuid not null references path_collab.resources on delete cascade,
  email text not null,
  role text not null check(role in ('viewer','editor','admin')),
  expires timestamptz not null,
  unique(resource,email)
);
create table path_collab.invite_mail (
  invitation uuid primary key references path_collab.invites on update cascade on delete cascade,
  available_at timestamptz not null default now(), delivered boolean not null default false,
  claim uuid, attempts integer not null default 0
);
alter table path_collab.invite_mail enable row level security;
create index invites_by_email on path_collab.invites(email);
create table path_collab.audit (
  id bigint generated always as identity primary key,
  resource uuid not null references path_collab.resources on delete cascade,
  actor uuid not null, action text not null, created_at timestamptz not null default now()
);
alter table path_collab.entitlements enable row level security;
alter table path_collab.resources enable row level security;
alter table path_collab.members enable row level security;
alter table path_collab.invites enable row level security;
alter table path_collab.audit enable row level security;
revoke all on all tables in schema path_collab from public,anon,authenticated;

-- Only the explicit collaboration projection enters storage. Linked personal
-- entities have no target identifier, cached title, thumbnail or body here.
create function path_collab.project_document(k text,j jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare item jsonb; items jsonb:='[]'; edges jsonb:='[]'; rowval jsonb;
 key text:=case when k='project' then 'tasks' else 'nodes' end; ids text[]:='{}';
begin
 if k not in ('project','canvas') or jsonb_typeof(j) is distinct from 'object'
   or length(btrim(coalesce(j->>'name',''))) not between 1 and 250
   or octet_length(j::text)>8388608 or jsonb_typeof(j->key) is distinct from 'array'
   then raise exception 'SHARE_INVALID'; end if;
 for item in select value from jsonb_array_elements(j->key) loop
  if length(coalesce(item->>'id','')) not between 1 and 160 or item->>'id'=any(ids) then raise exception 'SHARE_INVALID'; end if;
  ids:=array_append(ids,item->>'id');
  if k='project' then
   rowval=jsonb_strip_nulls(jsonb_build_object('id',item->>'id','title',item->>'title','status',item->>'status','deadline',item->>'deadline'));
  else
   rowval=jsonb_strip_nulls(jsonb_build_object('id',item->>'id','x',item->'x','y',item->'y','width',item->'width','height',item->'height'));
   if jsonb_typeof(item->'entityRef')='object' or item ?| array['linked_resource_id','linkedResourceId','sourceNoteId','noteId','taskId'] or item->>'kind'='restricted' then
    rowval=rowval||'{"kind":"restricted"}'::jsonb;
   elsif coalesce(item->>'kind','note') in ('note','text','image') then
    rowval=rowval||jsonb_strip_nulls(jsonb_build_object('kind',coalesce(item->>'kind','note'),'title',item->>'title','body',item->>'body'));
    if (item->>'image') ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$' then rowval=rowval||jsonb_build_object('image',item->>'image'); end if;
   else rowval=rowval||'{"kind":"restricted"}'::jsonb; end if;
  end if;
  items=items||jsonb_build_array(rowval);
 end loop;
 if k='canvas' then
  for item in select value from jsonb_array_elements(coalesce(j->'edges','[]')) loop
   if item->>'from'=any(ids) and item->>'to'=any(ids) then edges=edges||jsonb_build_array(jsonb_build_object('from',item->>'from','to',item->>'to')); end if;
  end loop;
 end if;
 return jsonb_build_object('name',j->>'name',key,items)||case when k='project' then jsonb_build_object('status',case when j->>'status'='completed' then 'completed' else 'active' end) else '{}' end||case when k='canvas' then jsonb_build_object('edges',edges) else '{}' end;
end $$;

create function path_collab.request(action text,args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 who uuid:=auth.uid(); address text; r path_collab.resources%rowtype;
 invite path_collab.invites%rowtype; my_role text; target uuid; old_role text; next_role text;
 paid_until timestamptz; active boolean; manager boolean; doc jsonb; obj uuid;
 members_json jsonb; pending jsonb; result jsonb; personal_pro boolean; resource_rows jsonb;
begin
 if who is null then raise exception 'SHARE_DENIED'; end if;
 select lower(btrim(email)) into address from auth.users where id=who and email_confirmed_at is not null;
 if address is null then raise exception 'SHARE_DENIED'; end if;
 if jsonb_typeof(args) is distinct from 'object' then raise exception 'SHARE_INVALID'; end if;
 select exists(select from path_collab.entitlements where account=who and valid_until>now()) into personal_pro;
 if action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'name',x.document->>'name','owner',x.owner_id=who,
   'role',case when x.owner_id=who then 'owner' else m.role end,'status',x.document->>'status','source',case when x.source_owner=who then x.source end) order by x.document->>'name',x.id),'[]') into resource_rows
   from path_collab.resources x left join path_collab.members m on m.resource=x.id and m.account=who where x.owner_id=who or m.account is not null;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'kind',x.kind,'name',x.document->>'name','role',i.role) order by i.expires),'[]') into pending
   from path_collab.invites i join path_collab.resources x on x.id=i.resource join path_collab.entitlements e on e.account=x.owner_id
   where i.email=address and i.expires>now() and e.valid_until>now();
  return jsonb_build_object('account',who,'resources',resource_rows,'subscribed',personal_pro,'inbox',pending);
 end if;
 if action='create' then
  if not personal_pro then raise exception 'SHARE_SUBSCRIPTION'; end if;
  if length(coalesce(args->>'source','')) not between 1 and 160 then raise exception 'SHARE_INVALID'; end if;
  doc=path_collab.project_document(args->>'kind',args->'document');
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
 select valid_until into paid_until from path_collab.entitlements where account=r.owner_id;
 active=coalesce(paid_until>now(),false);
 manager=coalesce(my_role in ('owner','admin'),false);
 if action in ('accept','decline') then
  select * into invite from path_collab.invites where id=(args->>'invitation')::uuid and resource=r.id and email=address and expires>now();
  if not found then raise exception 'SHARE_DENIED'; end if;
  if action='accept' then
   if not active then raise exception 'SHARE_SUBSCRIPTION'; end if;
   insert into path_collab.members(resource,account,role,accepted_invite) values(r.id,who,invite.role,invite.id) on conflict do nothing;
   select role into my_role from path_collab.members where resource=r.id and account=who;
   manager=coalesce(my_role in ('owner','admin'),false);
  end if;
  delete from path_collab.invites where id=invite.id;
 elsif my_role is null then raise exception 'SHARE_DENIED';
 elsif action='save' then
  if my_role='viewer' then raise exception 'SHARE_DENIED'; end if;
  if not active then raise exception 'SHARE_SUBSCRIPTION'; end if;
  doc=path_collab.project_document(r.kind,args->'document');
  if r.revision is distinct from (args->>'revision')::bigint then
   if doc<>r.document then raise exception 'SHARE_CONFLICT'; end if;
  elsif doc<>r.document then
   update path_collab.resources set document=doc,revision=revision+1 where id=r.id returning * into r;
  end if;
 elsif action='offer_transfer' then
  target=(args->>'account')::uuid;
  if my_role<>'owner' or target=who or not exists(select from path_collab.members where resource=r.id and account=target)
    or not exists(select from path_collab.entitlements where account=target and valid_until>now()) then raise exception 'SHARE_DENIED'; end if;
  update path_collab.resources set transfer_to=target where id=r.id returning * into r;
 elsif action='cancel_transfer' then
  if my_role<>'owner' and who is distinct from r.transfer_to then raise exception 'SHARE_DENIED'; end if;
  update path_collab.resources set transfer_to=null where id=r.id returning * into r;
 elsif action='take_ownership' then
  if who is distinct from r.transfer_to or not personal_pro then raise exception 'SHARE_DENIED'; end if;
  delete from path_collab.members where resource=r.id and account=who;
  insert into path_collab.members(resource,account,role) values(r.id,r.owner_id,'editor');
  update path_collab.resources set owner_id=who,transfer_to=null where id=r.id returning * into r;
  my_role='owner';manager=true;active=true;
 elsif action='invite' then
  next_role=args->>'role';
  if not manager or next_role is null or next_role not in ('viewer','editor','admin') or my_role='admin' and next_role='admin' then raise exception 'SHARE_DENIED'; end if;
  if not active then raise exception 'SHARE_SUBSCRIPTION'; end if;
  if length(coalesce(args->>'email',''))>254 or lower(btrim(coalesce(args->>'email',''))) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'SHARE_INVALID'; end if;
  if exists(select from auth.users u where lower(u.email)=lower(btrim(args->>'email')) and (u.id=r.owner_id or exists(select from path_collab.members m where m.resource=r.id and m.account=u.id))) then raise exception 'SHARE_INVALID'; end if;
  delete from path_collab.invites where resource=r.id and email=lower(btrim(args->>'email')) and expires<=now();
  if my_role='admin' and exists(select from path_collab.invites where resource=r.id and email=lower(btrim(args->>'email')) and role='admin' and expires>now()) then raise exception 'SHARE_DENIED'; end if;
  if (select count(*) from path_collab.audit a where a.actor=who and a.action='invite' and created_at>now()-interval '1 hour')>=50 then raise exception 'SHARE_RATE'; end if;
  insert into path_collab.invites(resource,email,role,expires) values(r.id,lower(btrim(args->>'email')),next_role,least(now()+interval '7 days',paid_until))
  on conflict(resource,email) do update set role=excluded.role,expires=excluded.expires,id=case when path_collab.invites.expires>now() and path_collab.invites.role=excluded.role then path_collab.invites.id else gen_random_uuid() end returning * into invite;
  insert into path_collab.invite_mail(invitation) values(invite.id) on conflict do nothing;
 elsif action='revoke' then
  if not manager or not active and my_role<>'owner' then raise exception 'SHARE_DENIED'; end if;
  delete from path_collab.invites where resource=r.id and id=(args->>'invitation')::uuid and (my_role='owner' or role<>'admin');
 elsif action in ('remove','role','leave') then
  target=case when action='leave' then who else (args->>'account')::uuid end;
  select role into old_role from path_collab.members where resource=r.id and account=target;
  if target=r.owner_id or old_role is null then raise exception 'SHARE_DENIED'; end if;
  if action<>'leave' and (not manager or target=who or my_role='admin' and (old_role='admin' or not active)) then raise exception 'SHARE_DENIED'; end if;
  if action='role' then
   next_role=args->>'role';
   if not active or next_role is null or next_role not in ('admin','editor','viewer') or next_role='admin' and my_role<>'owner' then raise exception 'SHARE_DENIED'; end if;
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
 result=jsonb_build_object('id',r.id,'kind',r.kind,'revision',r.revision,'owner',who=r.owner_id,'role',my_role,'active',active,'writable',active and my_role<>'viewer','members',members_json,'pending',pending,'account',who,'transfer',case when r.owner_id=who or r.transfer_to=who then r.transfer_to end,'ownerName',(select coalesce(nullif(raw_user_meta_data->>'display_name',''),split_part(email,'@',1)) from auth.users where id=r.owner_id));
 if action<>'get' or (args->>'revision')::bigint is distinct from r.revision then result=result||jsonb_build_object('document',r.document); end if;
 return result;
end $$;
revoke all on all functions in schema path_collab from public,anon,authenticated;
grant usage on schema path_collab to authenticated;
grant execute on function path_collab.request(text,jsonb) to authenticated;
create function public.path_share_v2(action text,args jsonb) returns jsonb
language sql security invoker set search_path='' as $$select path_collab.request(action,args)$$;
revoke all on function public.path_share_v2(text,jsonb) from public,anon;
grant execute on function public.path_share_v2(text,jsonb) to authenticated;
-- Worker-only notification lease. Public clients cannot read queue rows or addresses.
create function path_collab.mail_batch() returns table(id uuid,claim_id uuid,email text)
language sql security definer set search_path='' as $$
 with batch as (select q.invitation from path_collab.invite_mail q join path_collab.invites i on i.id=q.invitation
  join path_collab.resources r on r.id=i.resource join path_collab.entitlements e on e.account=r.owner_id
  where not q.delivered and q.available_at<=now() and i.expires>now() and e.valid_until>now() order by q.available_at limit 10 for update of q skip locked),
 claims as (update path_collab.invite_mail q set claim=gen_random_uuid(), attempts=attempts+1,
  available_at=now()+least(interval '2 hours',interval '2 minutes'*(1+q.attempts))
  from batch where batch.invitation=q.invitation returning q.invitation,q.claim)
 select c.invitation,c.claim,i.email from claims c join path_collab.invites i on i.id=c.invitation
$$;
create function path_collab.mail_done(id uuid,lease uuid) returns void language sql security definer set search_path='' as $$
 update path_collab.invite_mail set delivered=true where invitation=id and claim=lease
$$;
revoke all on function path_collab.mail_batch(),path_collab.mail_done(uuid,uuid) from public, anon, authenticated;
grant usage on schema path_collab to service_role;
grant execute on function path_collab.mail_batch(),path_collab.mail_done(uuid,uuid) to service_role;
create function public.path_share_mail_batch() returns table(id uuid,claim_id uuid,email text) language sql security invoker set search_path='' as $$select * from path_collab.mail_batch()$$;
create function public.path_share_mail_done(id uuid,lease uuid) returns void language sql security invoker set search_path='' as $$select path_collab.mail_done(id,lease)$$;
revoke all on function public.path_share_mail_batch(),public.path_share_mail_done(uuid,uuid) from public,anon,authenticated;
grant execute on function public.path_share_mail_batch(),public.path_share_mail_done(uuid,uuid) to service_role;
commit;
