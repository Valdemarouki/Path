-- Apply after the RC27/28 schema. Existing objects, invites and memberships are preserved.
begin;
create or replace function path_collab.request(action text,args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 who uuid:=auth.uid(); address text; r path_collab.resources%rowtype;
 invite path_collab.invites%rowtype; my_role text; target uuid; old_role text; next_role text;
 manager boolean; doc jsonb; obj uuid;
 members_json jsonb; pending jsonb; result jsonb; resource_rows jsonb;
begin
 if who is null then raise exception 'SHARE_DENIED'; end if;
 select lower(btrim(email)) into address from auth.users where id=who and email_confirmed_at is not null;
 if address is null then raise exception 'SHARE_DENIED'; end if;
 if jsonb_typeof(args) is distinct from 'object' then raise exception 'SHARE_INVALID'; end if;
 if action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'name',x.document->>'name','owner',x.owner_id=who,
   'role',case when x.owner_id=who then 'owner' else m.role end,'status',x.document->>'status','source',case when x.source_owner=who then x.source end) order by x.document->>'name',x.id),'[]') into resource_rows
   from path_collab.resources x left join path_collab.members m on m.resource=x.id and m.account=who where x.owner_id=who or m.account is not null;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'kind',x.kind,'name',x.document->>'name','role',i.role) order by i.expires),'[]') into pending
   from path_collab.invites i join path_collab.resources x on x.id=i.resource
   where i.email=address and i.expires>now();
  -- RC27/28 read 'subscribed' as permission to share. This response is scoped to collaboration.
  return jsonb_build_object('account',who,'resources',resource_rows,'canShare',true,'subscribed',true,'inbox',pending);
 end if;
 if action='create' then
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
  doc=path_collab.project_document(r.kind,args->'document');
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
 result=jsonb_build_object('id',r.id,'kind',r.kind,'revision',r.revision,'owner',who=r.owner_id,'role',my_role,'active',true,'writable',my_role<>'viewer','members',members_json,'pending',pending,'account',who,'transfer',case when r.owner_id=who or r.transfer_to=who then r.transfer_to end,'ownerName',(select coalesce(nullif(raw_user_meta_data->>'display_name',''),split_part(email,'@',1)) from auth.users where id=r.owner_id));
 if action<>'get' or (args->>'revision')::bigint is distinct from r.revision then result=result||jsonb_build_object('document',r.document); end if;
 return result;
end $$;

create or replace function path_collab.mail_batch() returns table(id uuid,claim_id uuid,email text)
language sql security definer set search_path='' as $$
 with batch as (select q.invitation from path_collab.invite_mail q join path_collab.invites i on i.id=q.invitation
  where not q.delivered and q.available_at<=now() and i.expires>now() order by q.available_at limit 10 for update of q skip locked),
 claims as (update path_collab.invite_mail q set claim=gen_random_uuid(), attempts=attempts+1,
  available_at=now()+least(interval '2 hours',interval '2 minutes'*(1+q.attempts))
  from batch where batch.invitation=q.invitation returning q.invitation,q.claim)
 select c.invitation,c.claim,i.email from claims c join path_collab.invites i on i.id=c.invitation
$$;
commit;
