begin;
alter table public.cmd_members alter column wing set default 'ground';
alter table public.cmd_tasks add column target_wing text not null default 'all' check(target_wing in('all','ground','social'));
alter table public.cmd_campaigns add column target_wing text not null default 'all' check(target_wing in('all','ground','social'));
create function command_private.worker(o uuid,w text default null) returns boolean language sql stable security definer set search_path='' as $$
 select not command_private.administrator() and command_private.member(o) and exists(select 1 from public.cmd_members where org_id=o and user_id=auth.uid() and stage=5 and (w is null or wing=w))
$$;
revoke all on function command_private.worker(uuid,text) from public,anon;
grant execute on function command_private.worker(uuid,text) to authenticated;
create policy task_wing on public.cmd_tasks as restrictive for select to authenticated using(command_private.leader(org_id) or target_wing='all' or command_private.worker(org_id,target_wing));
create policy campaign_wing on public.cmd_campaigns as restrictive for select to authenticated using(command_private.leader(org_id) or target_wing='all' or command_private.worker(org_id,target_wing));

alter function command_private.execute_command(text,uuid,jsonb) rename to execute_assignment;
revoke all on function command_private.execute_assignment(text,uuid,jsonb) from public,anon,authenticated;
create function command_private.execute_command(action text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; audience text:=coalesce(p->>'target_wing','all'); t public.cmd_tasks; c public.cmd_campaigns; uid uuid:=auth.uid(); new_id uuid; recipient record;
begin
 if uid is null then raise exception 'Sign in required'; end if;
 if action in('check_in','check_out') or (action='proof' and p->>'kind'='diary') then
  if not command_private.worker(o,'ground') then raise exception 'Ground Karyakarta action only'; end if;
 elsif action='social' then
  if not command_private.worker(o,'social') then raise exception 'Social Media Karyakarta action only'; end if;
 elsif action='proof' then
  if not command_private.worker(o) then raise exception 'Only Karyakartas submit work proofs'; end if;
  select * into t from public.cmd_tasks where org_id=o and id=nullif(p->>'task_id','')::uuid;
  if t.id is not null and t.target_wing<>'all' and not command_private.worker(o,t.target_wing) then raise exception 'Task belongs to the other work team'; end if;
  if command_private.worker(o,'social') and (nullif(p->>'hazri_id','') is not null or nullif(p->>'pulse','') is not null or coalesce(p->>'mood','neutral')<>'neutral') then raise exception 'Ground reporting fields are not available to the Social team'; end if;
 end if;
 if action in('task','campaign') then
  if not command_private.leader(o) then raise exception 'Leadership required'; end if;
  if not command_private.administrator() and not exists(select 1 from public.cmd_profiles where user_id=uid and completed) then raise exception 'Complete your basic profile first'; end if;
  if not exists(select 1 from public.cmd_orgs where id=o and active) then raise exception 'Active organization required'; end if;
  if audience not in('all','ground','social') then raise exception 'Choose a valid audience'; end if;
  if command_private.platform_admin() then
   insert into public.cmd_members(org_id,user_id,name,stage,can_manage)
    select id,uid,'Super Admin',null,true from public.cmd_orgs where id=o and active on conflict do nothing;
  end if;
  if action='task' then
   if nullif(p->>'assigned_to','') is not null and not exists(select 1 from public.cmd_members m where m.org_id=o and m.user_id=(p->>'assigned_to')::uuid and m.active and m.stage=5 and (audience='all' or m.wing=audience)) then raise exception 'Assign execution work to a Karyakarta in the selected work team'; end if;
   if nullif(p->>'campaign_id','') is not null then
    select * into c from public.cmd_campaigns where org_id=o and id=(p->>'campaign_id')::uuid;
    if c.id is null or (c.target_wing<>'all' and c.target_wing<>audience) then raise exception 'Task audience must match the campaign'; end if;
   end if;
  end if;
  if action='campaign' then
   insert into public.cmd_campaigns(org_id,title,body,asset_url,created_by,target_wing) values(o,trim(p->>'title'),coalesce(p->>'body',''),nullif(p->>'asset_url',''),uid,audience) returning id into new_id;
  else
   if nullif(p->>'assigned_to','') is not null and not command_private.visible(o,(p->>'assigned_to')::uuid) then raise exception 'Assign tasks to your reporting team'; end if;
   insert into public.cmd_tasks(org_id,campaign_id,title,instructions,points,assigned_to,created_by,due_at,target_wing)
    values(o,nullif(p->>'campaign_id','')::uuid,trim(p->>'title'),coalesce(p->>'instructions',''),coalesce((p->>'points')::integer,25),nullif(p->>'assigned_to','')::uuid,uid,nullif(p->>'due_at','')::timestamptz,audience) returning id into new_id;
   for recipient in select user_id from public.cmd_members where org_id=o and active and stage=5 and (audience='all' or wing=audience) and (nullif(p->>'assigned_to','') is null or user_id=(p->>'assigned_to')::uuid) and command_private.visible(o,user_id) loop
    perform command_private.notify(o,recipient.user_id,'New assignment',p->>'title');
   end loop;
  end if;
  insert into public.cmd_audit(org_id,actor_id,action,target_id,details) values(o,uid,action,new_id,p);
  return jsonb_build_object('id',new_id);
 end if;
 result:=command_private.execute_assignment(action,o,p);
 return result;
end $$;
revoke all on function command_private.execute_command(text,uuid,jsonb) from public,anon;
grant execute on function command_private.execute_command(text,uuid,jsonb) to authenticated;
create or replace function public.cmd_execute(action text,org_id uuid default null,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select command_private.execute_command(action,org_id,payload)$$;
-- Retain service-only ingestion and block analytics after a member changes roles.
do $$ declare definition text; begin
 select pg_get_functiondef('public.cmd_ingest_youtube(uuid,uuid,text,bigint,bigint,integer)'::regprocedure) into definition;
 execute replace(definition,'begin', 'begin
 if not exists(select 1 from public.cmd_members m join public.cmd_orgs g on g.id=m.org_id where m.org_id=o and m.user_id=u and m.active and g.active and m.stage=5 and m.wing=''social'') or exists(select 1 from public.cmd_admins where user_id=u) or exists(select 1 from public.cmd_platform_admins where user_id=u) then raise exception ''Social Media Karyakarta analytics only''; end if;');
end $$;
commit;
