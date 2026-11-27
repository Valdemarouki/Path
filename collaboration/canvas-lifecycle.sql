-- Keep a converted Canvas available privately to its owner even if a client
-- disconnects after the shared resource is removed but before it saves locally.
begin;
create table path_collab.canvas_changes (
  resource uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  private_id text not null,
  source text,
  action text not null check (action in ('make-private','delete-canvas')),
  revision bigint not null,
  name text,
  document jsonb,
  superseded boolean not null default false,
  unique(owner_id,private_id),
  check (document is null or (action='make-private' and not superseded))
);
alter table path_collab.canvas_changes enable row level security;
revoke all on path_collab.canvas_changes from public, anon, authenticated;

create function path_collab.canvas_lifecycle(action text,args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  who uuid:=auth.uid();
  board_id uuid;
  native_id text;
  expected bigint;
  board path_collab.resources%rowtype;
  receipt path_collab.canvas_changes%rowtype;
  reply jsonb;
  changes jsonb;
begin
  if not exists(select from auth.users u where u.id=who and u.email_confirmed_at is not null)
    then raise exception 'SHARE_DENIED'; end if;
  if jsonb_typeof(args) is distinct from 'object' then raise exception 'SHARE_INVALID'; end if;

  if action='list' then
    reply:=path_collab.request(action,args);
    select coalesce(jsonb_agg(jsonb_build_object('id',c.resource,'account',who,'action',c.action,
      'privateId',c.private_id,'source',c.source,'revision',c.revision,'name',c.name)
      order by c.resource),'[]'::jsonb) into changes
    from path_collab.canvas_changes c where c.owner_id=who and not c.superseded;
    return reply||jsonb_build_object('canvasChanges',changes);
  end if;
  if action='create' then
    native_id:=args->>'source';
    if args->>'kind' is distinct from 'canvas' or length(coalesce(native_id,'')) not between 1 and 160
      then raise exception 'SHARE_INVALID'; end if;
  elsif action in ('make-private','delete-canvas','get-private-canvas') then
    begin board_id:=(args->>'id')::uuid;
    exception when invalid_text_representation then raise exception 'SHARE_INVALID'; end;
    select case when r.source_owner=who then r.source else r.id::text end into native_id
    from path_collab.resources r where r.id=board_id and r.owner_id=who and r.kind='canvas';
    if not found then
      select c.private_id into native_id from path_collab.canvas_changes c
      where c.resource=board_id and c.owner_id=who and not c.superseded;
      if not found then raise exception 'SHARE_DENIED'; end if;
    end if;
    if action<>'get-private-canvas' then
      if jsonb_typeof(args->'revision') is distinct from 'number' or
        coalesce(args->>'revision','') !~ '^[1-9][0-9]{0,15}$' then raise exception 'SHARE_INVALID'; end if;
      expected:=(args->>'revision')::bigint;
    end if;
  else raise exception 'SHARE_INVALID';
  end if;

  -- A delayed Create from before deletion must never resurrect the old share.
  perform pg_advisory_xact_lock(hashtextextended(who::text||':'||native_id,332));
  select * into receipt from path_collab.canvas_changes c where c.owner_id=who and c.private_id=native_id;
  if action='create' then
    if found and not receipt.superseded and args->>'afterCanvasChange' is distinct from receipt.resource::text
      then raise exception 'SHARE_CONFLICT'; end if;
    reply:=path_collab.request(action,args);
    if receipt.resource is not null then
      update path_collab.canvas_changes set name=null,document=null,superseded=true where resource=receipt.resource;
    end if;
    return reply;
  end if;

  if receipt.resource=board_id and not receipt.superseded then
    if action='get-private-canvas' then
      if receipt.action<>'make-private' then raise exception 'SHARE_DENIED'; end if;
    elsif receipt.action is distinct from action or receipt.revision is distinct from expected then
      raise exception 'SHARE_CONFLICT';
    end if;
  else
    if action='get-private-canvas' then raise exception 'SHARE_DENIED'; end if;
    select * into board from path_collab.resources r
      where r.id=board_id and r.kind='canvas' and r.owner_id=who for update;
    if not found then raise exception 'SHARE_DENIED'; end if;
    if board.revision<>expected then raise exception 'SHARE_CONFLICT'; end if;
    -- Read the locked server document, never a supplied snapshot. Private-linked
    -- representations stay redacted and are resolved only against the owner's local source.
    insert into path_collab.canvas_changes(resource,owner_id,private_id,source,action,revision,name,document)
    values(board.id,who,native_id,case when board.source_owner=who then board.source end,
      action,board.revision,case when action='make-private' then board.document->>'name' end,
      case when action='make-private' then board.document end)
    on conflict(owner_id,private_id) do update set resource=excluded.resource,source=excluded.source,
      action=excluded.action,revision=excluded.revision,name=excluded.name,document=excluded.document,superseded=false
    returning * into receipt;
    delete from path_collab.resources where id=board.id;
  end if;
  reply:=jsonb_build_object('ok',true,'id',receipt.resource,'account',who,'action',receipt.action,
    'privateId',receipt.private_id,'source',receipt.source,'name',receipt.name,'revision',receipt.revision);
  if receipt.document is not null then reply:=reply||jsonb_build_object('document',receipt.document); end if;
  return reply;
end $$;
revoke all on function path_collab.canvas_lifecycle(text,jsonb) from public,anon,authenticated;
grant execute on function path_collab.canvas_lifecycle(text,jsonb) to authenticated;

create or replace function public.path_share_v2(action text,args jsonb) returns jsonb
language sql security invoker set search_path='' as $$
  select case when action in ('list','delete-canvas','make-private','get-private-canvas')
         or (action='create' and args->>'kind'='canvas')
    then path_collab.canvas_lifecycle(action,args) else path_collab.request(action,args) end
$$;
commit;
