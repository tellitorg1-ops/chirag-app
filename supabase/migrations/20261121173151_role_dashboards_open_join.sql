begin;
create table public.cmd_profiles (
 user_id uuid primary key references auth.users, name text not null check(length(trim(name)) between 2 and 100),
 district text not null default '', area text not null default '', photo_path text,
 completed boolean not null default false, created_at timestamptz not null default now()
);
create table public.cmd_admins (user_id uuid primary key references auth.users, created_at timestamptz not null default now());
alter table public.cmd_profiles enable row level security;
alter table public.cmd_admins enable row level security;
revoke all on public.cmd_profiles,public.cmd_admins from public,anon,authenticated;
grant select on public.cmd_profiles,public.cmd_admins to authenticated;
grant all on public.cmd_profiles,public.cmd_admins to service_role;
insert into public.cmd_profiles(user_id,name,district,area)
 select distinct on(user_id) user_id,name,district,area from public.cmd_members order by user_id,joined_at;
insert into public.cmd_admins(user_id) select distinct user_id from public.cmd_members where can_manage
 and user_id not in(select user_id from public.cmd_platform_admins);
alter table public.cmd_members alter column stage drop not null;
update public.cmd_members set stage=null,manager_id=null where can_manage or user_id in(select user_id from public.cmd_platform_admins);
update public.cmd_members set manager_id=null where manager_id in(select user_id from public.cmd_admins union select user_id from public.cmd_platform_admins);
update public.cmd_members set wing='ground' where wing='ground_digital';
create function command_private.administrator() returns boolean language sql stable security definer set search_path='' as $$
 select command_private.platform_admin() or exists(select 1 from public.cmd_admins where user_id=auth.uid())
$$;
create or replace function command_private.manager(o uuid) returns boolean language sql stable security definer set search_path='' as $$
 select command_private.platform_admin() or (command_private.administrator() and command_private.member(o) and exists(select 1 from public.cmd_members where org_id=o and user_id=auth.uid() and can_manage))
$$;
create policy profile_self on public.cmd_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy admin_self on public.cmd_admins for select to authenticated using(user_id=(select auth.uid()));

-- These two initial grants are consumed once, only after verified phone ownership.
create table command_private.initial_roles(phone text primary key,role text not null,claimed_by uuid references auth.users);
alter table command_private.initial_roles enable row level security;
create policy initial_roles_server_only on command_private.initial_roles as restrictive for all to anon,authenticated using(false) with check(false);
create index initial_roles_claimed on command_private.initial_roles(claimed_by);
insert into command_private.initial_roles(phone,role) values('919643693090','super_admin'),('919315937048','admin');
create function command_private.claim_initial_role() returns void language plpgsql security definer set search_path='' as $$
declare r record; uid uuid:=auth.uid();
begin
 if uid is null then return; end if;
 for r in select b.* from command_private.initial_roles b join auth.users u on regexp_replace(u.phone,'[^0-9]','','g')=b.phone
  where u.id=uid and u.phone_confirmed_at is not null and b.claimed_by is null for update of b loop
  if r.role='super_admin' then insert into public.cmd_platform_admins(user_id) values(uid) on conflict do nothing;
  else insert into public.cmd_admins(user_id) values(uid) on conflict do nothing; end if;
  update command_private.initial_roles set claimed_by=uid where phone=r.phone;
  update public.cmd_members set stage=null,manager_id=null,can_manage=true where user_id=uid;
  update public.cmd_members set manager_id=null where manager_id=uid;
  insert into public.cmd_audit(actor_id,action,target_id,details) values(uid,'initial_role',uid,jsonb_build_object('role',r.role));
 end loop;
end $$;

insert into public.cmd_platform_admins(user_id)
 select u.id from auth.users u join command_private.initial_roles b on b.phone=regexp_replace(u.phone,'[^0-9]','','g')
 where b.role='super_admin' and u.phone_confirmed_at is not null on conflict do nothing;
insert into public.cmd_admins(user_id)
 select u.id from auth.users u join command_private.initial_roles b on b.phone=regexp_replace(u.phone,'[^0-9]','','g')
 where b.role='admin' and u.phone_confirmed_at is not null on conflict do nothing;
update command_private.initial_roles b set claimed_by=u.id from auth.users u
 where b.phone=regexp_replace(u.phone,'[^0-9]','','g') and u.phone_confirmed_at is not null;
insert into public.cmd_audit(actor_id,action,target_id,details)
 select claimed_by,'initial_role',claimed_by,jsonb_build_object('role',role,'source','role migration') from command_private.initial_roles where claimed_by is not null;
update public.cmd_members set stage=null,manager_id=null,can_manage=true
 where user_id in(select user_id from public.cmd_admins union select user_id from public.cmd_platform_admins);
update public.cmd_members set manager_id=null
 where manager_id in(select user_id from public.cmd_admins union select user_id from public.cmd_platform_admins);

alter function command_private.execute_command(text,uuid,jsonb) rename to execute_legacy;
revoke all on function command_private.execute_legacy(text,uuid,jsonb) from public,anon,authenticated;
create function command_private.execute_command(action text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); target uuid; parent uuid; team uuid; dest integer; wing_name text; role_name text;
 profile public.cmd_profiles; org public.cmd_orgs; result jsonb; old public.cmd_members;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if action='account' then
  perform command_private.claim_initial_role();
  return jsonb_build_object('isPlatform',command_private.platform_admin(),'isAdmin',command_private.administrator(),
   'profile',(select to_jsonb(x) from public.cmd_profiles x where user_id=u));
 elsif action in ('register','basic_profile') then
  if command_private.administrator() then return jsonb_build_object('ok',true); end if;
  if length(trim(coalesce(p->>'name',''))) not between 2 and 100 or length(trim(coalesce(p->>'district',''))) not between 2 and 100 or length(trim(coalesce(p->>'area',''))) not between 2 and 100 then raise exception 'Name, district and area are required (2–100 characters)'; end if;
  if nullif(p->>'photo_path','') is not null and (split_part(p->>'photo_path','/',1)<>u::text or not exists(select 1 from storage.objects where bucket_id='command-avatars' and name=p->>'photo_path')) then raise exception 'Upload your own profile photo'; end if;
  insert into public.cmd_profiles(user_id,name,district,area,photo_path,completed) values(u,trim(p->>'name'),trim(p->>'district'),trim(p->>'area'),nullif(p->>'photo_path',''),true)
   on conflict(user_id) do update set name=excluded.name,district=excluded.district,area=excluded.area,photo_path=coalesce(excluded.photo_path,cmd_profiles.photo_path),completed=true;
  update public.cmd_members set name=trim(p->>'name'),district=trim(p->>'district'),area=trim(p->>'area') where user_id=u;
  return jsonb_build_object('ok',true);
 elsif action='directory' then
  if not command_private.administrator() then raise exception 'Admin required'; end if;
  return coalesce((select jsonb_agg(to_jsonb(d)) from (
   select a.id user_id,coalesce(pr.name,case when sa.user_id is not null then 'Super Admin' when ad.user_id is not null then 'Admin' else 'New member' end) name,
    a.phone,coalesce(pr.completed,false) completed,coalesce(pr.district,'') district,coalesce(pr.area,'') area,
    case when sa.user_id is not null then 'super_admin' when ad.user_id is not null then 'admin' else 'member' end role,
    coalesce((select jsonb_agg(to_jsonb(m)) from public.cmd_members m where m.user_id=a.id and (command_private.platform_admin() or command_private.manager(m.org_id))),'[]') memberships
   from auth.users a left join public.cmd_profiles pr on pr.user_id=a.id left join public.cmd_platform_admins sa on sa.user_id=a.id left join public.cmd_admins ad on ad.user_id=a.id
   where command_private.platform_admin() or (sa.user_id is null and ad.user_id is null and (pr.completed or exists(select 1 from public.cmd_members m where m.user_id=a.id)) and
    (not exists(select 1 from public.cmd_members m where m.user_id=a.id) or exists(select 1 from public.cmd_members m where m.user_id=a.id and command_private.manager(m.org_id))))
   order by pr.created_at desc nulls last
  )d),'[]'::jsonb);
 elsif action='set_global_role' then
  if not command_private.platform_admin() then raise exception 'Super Admin required'; end if;
  perform pg_advisory_xact_lock(68209412);
  if not command_private.platform_admin() then raise exception 'Super Admin required'; end if;
  target:=(p->>'user_id')::uuid; role_name:=p->>'role';
  perform 1 from auth.users where id=target for update;
  if role_name not in ('member','admin','super_admin') or role_name is null then raise exception 'Invalid role'; end if;
  if not exists(select 1 from auth.users where id=target) then raise exception 'User not found'; end if;
  if role_name<>'super_admin' and exists(select 1 from public.cmd_platform_admins where user_id=target) and (select count(*) from public.cmd_platform_admins)=1 then raise exception 'Cannot remove the last Super Admin'; end if;
  delete from public.cmd_platform_admins where user_id=target;
  delete from public.cmd_admins where user_id=target;
  if role_name='super_admin' then insert into public.cmd_platform_admins(user_id) values(target);
  elsif role_name='admin' then insert into public.cmd_admins(user_id) values(target); end if;
  update public.cmd_members set stage=case when role_name='member' then 5 else null end,manager_id=null,can_manage=(role_name<>'member') where user_id=target;
  update public.cmd_members set manager_id=null where manager_id=target;
  insert into public.cmd_audit(actor_id,action,target_id,details) values(u,action,target,jsonb_build_object('role',role_name));
  return jsonb_build_object('ok',true);
 elsif action='org_settings' then
  if not command_private.manager(o) then raise exception 'Organization admin required'; end if;
  update public.cmd_orgs set name=coalesce(nullif(trim(p->>'name'),''),name),
   active=coalesce((p->>'active')::boolean,active),monthly_reward=coalesce(p->>'monthly_reward',monthly_reward),grand_reward=coalesce(p->>'grand_reward',grand_reward) where id=o;
  insert into public.cmd_audit(org_id,actor_id,action,details) values(o,u,action,p);
  return jsonb_build_object('ok',true);
 elsif action='create_org' then
  if not command_private.administrator() then raise exception 'Platform admin or Admin required'; end if;
  insert into public.cmd_orgs(name,mode,reward_anchor,monthly_reward,grand_reward) values(trim(p->>'name'),coalesce(p->>'mode','political'),coalesce((p->>'reward_anchor')::date,date_trunc('month',now() at time zone 'Asia/Kolkata')::date),coalesce(p->>'monthly_reward','Monthly recognition'),coalesce(p->>'grand_reward','4-Month Big Reward')) returning * into org;
  insert into public.cmd_members(org_id,user_id,name,stage,can_manage) values(org.id,u,case when command_private.platform_admin() then 'Super Admin' else 'Admin' end,null,true);
  insert into public.cmd_audit(org_id,actor_id,action,details) values(org.id,u,action,jsonb_build_object('name',org.name));
  return to_jsonb(org);
 elsif action='assign_member' then
  if not command_private.manager(o) then raise exception 'Organization admin required'; end if;
  perform 1 from public.cmd_orgs where id=o and active for update;
  if not found then raise exception 'Active organization required'; end if;
  target:=(p->>'user_id')::uuid;
  perform 1 from auth.users where id=target for update;
  if not found then raise exception 'User not found'; end if;
  select * into profile from public.cmd_profiles where user_id=target;
  if exists(select 1 from public.cmd_platform_admins where user_id=target) or exists(select 1 from public.cmd_admins where user_id=target) then
   if not command_private.platform_admin() then raise exception 'Super Admin assigns administrators'; end if;
   dest:=null; parent:=null; team:=null;
  else
   if not coalesce(profile.completed,false) then raise exception 'Member must complete basic profile first'; end if;
   if not command_private.platform_admin() and exists(select 1 from public.cmd_members where user_id=target) and not exists(select 1 from public.cmd_members where user_id=target and command_private.manager(org_id)) then raise exception 'Member is outside your organization scope'; end if;
   dest:=(p->>'stage')::integer; parent:=nullif(p->>'manager_id','')::uuid; team:=nullif(p->>'team_id','')::uuid;
   if dest is null or dest not between 1 and 5 then raise exception 'Choose a valid hierarchy stage'; end if;
   if parent is not null and not exists(select 1 from public.cmd_members where org_id=o and user_id=parent and active and stage<dest and user_id<>target) then raise exception 'Reporting leader must be at a higher stage in this party'; end if;
   if exists(select 1 from public.cmd_members where org_id=o and manager_id=target and active and stage<=dest) then raise exception 'Reassign existing reports before this move'; end if;
   if team is not null and not exists(select 1 from public.cmd_teams where org_id=o and id=team) then raise exception 'Team belongs to another party'; end if;
  end if;
  wing_name:=coalesce(p->>'wing','ground');
  if wing_name not in('ground','social') then raise exception 'Choose Ground or Social Media'; end if;
  select * into old from public.cmd_members where org_id=o and user_id=target;
  insert into public.cmd_members(org_id,user_id,name,district,area,stage,wing,manager_id,team_id,can_manage)
   values(o,target,case when dest is null then 'Admin' else profile.name end,coalesce(profile.district,''),coalesce(profile.area,''),dest,wing_name,parent,team,dest is null)
   on conflict(org_id,user_id) do update set stage=excluded.stage,wing=excluded.wing,manager_id=excluded.manager_id,team_id=excluded.team_id,can_manage=excluded.can_manage,active=true;
  insert into public.cmd_audit(org_id,actor_id,action,target_id,details) values(o,u,action,target,jsonb_build_object('before',to_jsonb(old),'stage',dest,'wing',wing_name,'manager_id',parent));
  perform command_private.notify(o,target,'Your assignment is ready','Your party, role and dashboard have been updated. Open Leader IQ to continue.');
  return jsonb_build_object('ok',true);
 elsif action='join' then raise exception 'Join directly by completing your basic profile. An Admin assigns your party.';
 elsif action='access' then raise exception 'Use Super Admin role controls and party assignment';
 elsif action='profile' then raise exception 'Use basic profile to update your identity';
 end if;
 if not command_private.administrator() and not exists(select 1 from public.cmd_profiles where user_id=u and completed) then raise exception 'Complete your basic profile first'; end if;
 if action in ('move','move_team') and exists(select 1 from public.cmd_members where org_id=o and stage is null and ((action='move' and user_id=(p->>'user_id')::uuid) or (action='move_team' and team_id=nullif(p->>'team_id','')::uuid))) then raise exception 'Administrators are outside the hierarchy'; end if;
 result:=command_private.execute_legacy(action,o,p);
 return result;
end $$;
revoke all on function command_private.execute_command(text,uuid,jsonb),command_private.claim_initial_role(),command_private.administrator() from public,anon;
grant execute on function command_private.execute_command(text,uuid,jsonb),command_private.administrator() to authenticated;
create or replace function public.cmd_execute(action text,org_id uuid default null,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select command_private.execute_command(action,org_id,payload)
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('command-avatars','command-avatars',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy avatar_upload on storage.objects for insert to authenticated with check(bucket_id='command-avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy avatar_read on storage.objects for select to authenticated using(bucket_id='command-avatars' and split_part(name,'/',1)=(select auth.uid())::text);
-- Administrative accounts have no competition rank or hierarchy level.
do $$ declare definition text; begin
 select pg_get_functiondef('command_private.ranking(uuid,text,date)'::regprocedure) into definition;
 execute replace(definition,'where m.org_id=o and m.active group by','where m.org_id=o and m.active and m.stage is not null group by');
end $$;
commit;
