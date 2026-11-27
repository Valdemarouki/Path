-- Additive migration; apply after collaboration/schema.sql.
begin;
create table path_collab.cursor_pass (
 secret text primary key, board uuid not null references path_collab.resources on delete cascade,
 account uuid not null references auth.users on delete cascade,
 expires timestamptz not null, claimed boolean not null default false
);
create index cursor_pass_expiry on path_collab.cursor_pass(expires);
create index cursor_pass_account on path_collab.cursor_pass(account);
alter table path_collab.cursor_pass enable row level security;
revoke all on path_collab.cursor_pass from public,anon,authenticated;

create function path_collab.cursor_ticket(board_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ticket text;
begin
 if actor is null or not exists(select from path_collab.resources r
  where r.id=board_id and r.kind='canvas' and (r.owner_id=actor or exists
   (select from path_collab.members m where m.resource=r.id and m.account=actor))) then raise exception 'SHARE_DENIED'; end if;
 delete from path_collab.cursor_pass where expires<=now();
 perform pg_advisory_xact_lock(hashtextextended(actor::text,219));
 if (select count(*) from path_collab.cursor_pass where account=actor)>=32 then raise exception 'SHARE_RATE'; end if;
 ticket=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into path_collab.cursor_pass values(ticket,board_id,actor,now()+interval '25 seconds',false);
 return jsonb_build_object('ticket',ticket);
end $$;

create function path_collab.cursor_claim(board_id uuid,ticket text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; lease text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
begin
 update path_collab.cursor_pass p set secret=lease,claimed=true,expires=now()+interval '5 minutes'
 from path_collab.resources r where p.secret=ticket and not p.claimed and p.expires>now()
 and p.board=board_id and r.id=p.board and r.kind='canvas' and (r.owner_id=p.account or exists
 (select from path_collab.members m where m.resource=r.id and m.account=p.account)) returning p.account into actor;
 if actor is null then raise exception 'SHARE_DENIED'; end if;
 return jsonb_build_object('lease',lease,'account',actor);
end $$;

create function path_collab.cursor_check(board_id uuid,leases text[]) returns jsonb
language sql security definer set search_path='' as $$
 with granted as (
 select p.secret,p.account,u.raw_user_meta_data from path_collab.cursor_pass p
 join path_collab.resources r on r.id=p.board join auth.users u on u.id=p.account
 where cardinality(leases) between 1 and 96
 and p.board=board_id and p.secret=any(leases) and p.claimed and p.expires>now()
 and r.kind='canvas' and (r.owner_id=p.account or exists
 (select from path_collab.members m where m.resource=r.id and m.account=p.account))
)
 select coalesce(jsonb_agg(jsonb_build_object('lease',secret,'account',account,'name',left(coalesce(
 nullif(btrim(raw_user_meta_data->>'nickname'),''),nullif(btrim(raw_user_meta_data->>'display_name'),''),
 nullif(btrim(raw_user_meta_data->>'full_name'),''),nullif(btrim(raw_user_meta_data->>'name'),''),
 'Path · '||right(account::text,4)),32))),'[]'::jsonb) from granted
$$;
revoke all on function path_collab.cursor_ticket(uuid),path_collab.cursor_claim(uuid,text),path_collab.cursor_check(uuid,text[]) from public,anon,authenticated;
grant execute on function path_collab.cursor_ticket(uuid) to authenticated;
grant usage on schema path_collab to anon;
grant execute on function path_collab.cursor_claim(uuid,text),path_collab.cursor_check(uuid,text[]) to anon;
create function public.path_canvas_ticket(board_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select path_collab.cursor_ticket(board_id) $$;
create function public.path_canvas_claim(board_id uuid,ticket text) returns jsonb language sql security invoker set search_path='' as $$ select path_collab.cursor_claim(board_id,ticket) $$;
create function public.path_canvas_check(board_id uuid,leases text[]) returns jsonb language sql security invoker set search_path='' as $$ select path_collab.cursor_check(board_id,leases) $$;
revoke all on function public.path_canvas_ticket(uuid),public.path_canvas_claim(uuid,text),public.path_canvas_check(uuid,text[]) from public,anon,authenticated;
grant execute on function public.path_canvas_ticket(uuid) to authenticated;
grant execute on function public.path_canvas_claim(uuid,text),public.path_canvas_check(uuid,text[]) to anon;
commit;
