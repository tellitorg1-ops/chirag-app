-- Command platform v2. Legacy data stays quarantined until explicitly mapped.
begin;
create schema if not exists command_private;
revoke all on schema command_private from public;
grant usage on schema command_private to authenticated, service_role;

create table public.cmd_platform_admins (
  user_id uuid primary key references auth.users(id), created_at timestamptz not null default now()
);
create table public.cmd_orgs (
  id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 100),
  mode text not null check(mode in ('political','business')), active boolean not null default true,
  reward_anchor date not null default date_trunc('month',now() at time zone 'Asia/Kolkata')::date,
  monthly_reward text not null default 'Monthly recognition', grand_reward text not null default '4-Month Big Reward',
  created_at timestamptz not null default now(), check(extract(day from reward_anchor)=1)
);
create table public.cmd_teams (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.cmd_orgs,
  name text not null check(length(trim(name)) between 2 and 100), unique(org_id,id)
);
create table public.cmd_members (
  org_id uuid not null references public.cmd_orgs, user_id uuid not null references auth.users,
  name text not null check(length(trim(name)) between 2 and 100), district text not null default '', area text not null default '',
  stage integer not null default 5 check(stage between 1 and 5), manager_id uuid,
  team_id uuid, wing text not null default 'ground_digital' check(wing in ('ground_digital','ground','social','business')),
  can_manage boolean not null default false, active boolean not null default true,
  joined_at timestamptz not null default now(), primary key(org_id,user_id),
  foreign key(org_id,manager_id) references public.cmd_members(org_id,user_id),
  foreign key(org_id,team_id) references public.cmd_teams(org_id,id), check(manager_id is distinct from user_id)
);
create index cmd_members_user on public.cmd_members(user_id,org_id);
create index cmd_members_manager on public.cmd_members(org_id,manager_id);
create index cmd_members_team on public.cmd_members(org_id,team_id);
create table public.cmd_invites (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.cmd_orgs,
  token_hash text not null unique, manager_id uuid, team_id uuid, expires_at timestamptz not null default now()+interval '7 days',
  max_uses integer not null default 50 check(max_uses between 1 and 1000), uses integer not null default 0,
  foreign key(org_id,manager_id) references public.cmd_members(org_id,user_id),
  foreign key(org_id,team_id) references public.cmd_teams(org_id,id)
);
create table public.cmd_campaigns (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.cmd_orgs,
  title text not null check(length(trim(title)) between 2 and 150), body text not null default '',
  asset_url text check(asset_url is null or asset_url ~ '^https://'), active boolean not null default true,
  created_by uuid not null, created_at timestamptz not null default now(), unique(org_id,id),
  foreign key(org_id,created_by) references public.cmd_members(org_id,user_id)
);
create table public.cmd_tasks (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.cmd_orgs,
  campaign_id uuid, title text not null check(length(trim(title)) between 2 and 150), instructions text not null default '',
  points integer not null default 25 check(points between 1 and 1000), assigned_to uuid, created_by uuid not null,
  due_at timestamptz, target_district text, active boolean not null default true, created_at timestamptz not null default now(), unique(org_id,id),
  foreign key(org_id,campaign_id) references public.cmd_campaigns(org_id,id),
  foreign key(org_id,assigned_to) references public.cmd_members(org_id,user_id),
  foreign key(org_id,created_by) references public.cmd_members(org_id,user_id)
);
create table public.cmd_hazri (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, user_id uuid not null,
  slot text not null check(slot in ('subah','daytime','shaam','active')),
  checked_in timestamptz not null default now(), checked_out timestamptz, unique(org_id,id),
  foreign key(org_id,user_id) references public.cmd_members(org_id,user_id),
  check(checked_out is null or checked_out >= checked_in)
);
create unique index cmd_one_active_shift on public.cmd_hazri(org_id,user_id) where checked_out is null;
create table public.cmd_proofs (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, user_id uuid not null,
  kind text not null check(kind in ('task','diary')), task_id uuid, hazri_id uuid,
  work text not null check(length(trim(work)) between 5 and 3000),
  note text not null default '', link text check(link is null or link ~ '^https://'), photo_path text,
  mood text not null default 'neutral' check(mood in ('positive','neutral','concern','urgent')),
  pulse text not null default '', status text not null default 'pending' check(status in ('pending','verified','rejected')),
  submitted_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid, review_note text,
  unique(org_id,id), foreign key(org_id,user_id) references public.cmd_members(org_id,user_id),
  foreign key(org_id,task_id) references public.cmd_tasks(org_id,id),
  foreign key(org_id,hazri_id) references public.cmd_hazri(org_id,id),
  check(length(trim(note)) >= 10 or link is not null or photo_path is not null),
  check((kind='task' and task_id is not null) or (kind='diary' and task_id is null and hazri_id is not null))
);
create unique index cmd_task_once on public.cmd_proofs(org_id,user_id,task_id) where status <> 'rejected';
create table public.cmd_ledger (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, user_id uuid not null,
  category text not null check(category in ('task','diary','hazri','social')), source_key text not null,
  points integer not null check(points > 0), earned_at timestamptz not null default now(),
  foreign key(org_id,user_id) references public.cmd_members(org_id,user_id), unique(org_id,user_id,category,source_key)
);
create index cmd_ledger_period on public.cmd_ledger(org_id,earned_at,user_id);
create table public.cmd_social (
  org_id uuid not null, user_id uuid not null, platform text not null check(platform in ('youtube','facebook','instagram','x')),
  url text not null check(url ~ '^https://'), verified boolean not null default false,
  verified_by uuid, verified_at timestamptz, channel_id text, primary key(org_id,user_id,platform),
  foreign key(org_id,user_id) references public.cmd_members(org_id,user_id)
);
create unique index cmd_one_channel_owner on public.cmd_social(org_id,channel_id) where platform='youtube' and channel_id is not null;
create table public.cmd_social_snapshots (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, user_id uuid not null,
  channel_id text not null, views bigint not null check(views>=0), subscribers bigint not null check(subscribers>=0),
  videos integer not null check(videos>=0), captured_at timestamptz not null default now(),
  foreign key(org_id,user_id) references public.cmd_members(org_id,user_id)
);
create index cmd_social_latest on public.cmd_social_snapshots(org_id,user_id,captured_at desc);
create table public.cmd_notifications (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, user_id uuid not null,
  title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now(),
  foreign key(org_id,user_id) references public.cmd_members(org_id,user_id)
);
create index cmd_notifications_inbox on public.cmd_notifications(org_id,user_id,created_at desc);
create table public.cmd_broadcasts (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.cmd_orgs,
  created_by uuid not null, title text not null, body text not null, district text, created_at timestamptz not null default now()
);
create table public.cmd_audit (
  id uuid primary key default gen_random_uuid(), org_id uuid references public.cmd_orgs,
  actor_id uuid not null, action text not null, target_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index cmd_audit_org on public.cmd_audit(org_id,created_at desc);
create table public.cmd_rewards (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, user_id uuid not null,
  period text not null check(period in ('monthly','grand')), period_start date not null, period_end date not null,
  points bigint not null, rank bigint not null, grade text not null, reward text not null,
  awarded_at timestamptz not null default now(), foreign key(org_id,user_id) references public.cmd_members(org_id,user_id),
  unique(org_id,user_id,period,period_start)
);
create table public.cmd_push_subscriptions (
  org_id uuid not null, user_id uuid not null, endpoint text not null check(endpoint ~ '^https://'),
  subscription jsonb not null, updated_at timestamptz not null default now(), primary key(org_id,user_id,endpoint),
  foreign key(org_id,user_id) references public.cmd_members(org_id,user_id)
);
create table public.cmd_push_outbox (
  id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.cmd_notifications,
  org_id uuid not null, user_id uuid not null, attempts integer not null default 0,
  available_at timestamptz not null default now(), locked_until timestamptz, delivered_at timestamptz, last_error text,
  unique(notification_id)
);

create function command_private.platform_admin() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.cmd_platform_admins where user_id=auth.uid())
$$;
create function command_private.member(o uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.cmd_members m join public.cmd_orgs g on g.id=m.org_id where m.org_id=o and m.user_id=auth.uid() and m.active and g.active)
$$;
create function command_private.manager(o uuid) returns boolean language sql stable security definer set search_path='' as $$
  select command_private.platform_admin() or (command_private.member(o) and exists(select 1 from public.cmd_members where org_id=o and user_id=auth.uid() and can_manage))
$$;
create function command_private.visible(o uuid,u uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (command_private.platform_admin() or (command_private.member(o) and (
    u=auth.uid() or command_private.manager(o) or exists (
      with recursive reports as (
        select user_id from public.cmd_members where org_id=o and manager_id=auth.uid() and active
        union select m.user_id from public.cmd_members m join reports r on m.manager_id=r.user_id where m.org_id=o and m.active
      ) select 1 from reports where user_id=u
    )
  )))
$$;
create function command_private.leader(o uuid) returns boolean language sql stable security definer set search_path='' as $$
  select command_private.manager(o) or (command_private.member(o) and exists(select 1 from public.cmd_members where org_id=o and user_id=auth.uid() and stage<5))
$$;

-- No direct browser mutations. All commands below authorize and validate atomically.
do $$ declare t text; begin
  foreach t in array array['cmd_platform_admins','cmd_orgs','cmd_teams','cmd_members','cmd_invites','cmd_campaigns','cmd_tasks','cmd_hazri','cmd_proofs','cmd_ledger','cmd_social','cmd_social_snapshots','cmd_notifications','cmd_broadcasts','cmd_audit','cmd_rewards','cmd_push_subscriptions','cmd_push_outbox'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
create policy admin_self on public.cmd_platform_admins for select to authenticated using(user_id=(select auth.uid()));
create policy org_read on public.cmd_orgs for select to authenticated using(command_private.platform_admin() or command_private.member(id));
create policy member_read on public.cmd_members for select to authenticated using(command_private.visible(org_id,user_id));
create policy team_read on public.cmd_teams for select to authenticated using(command_private.member(org_id) or command_private.platform_admin());
create policy invite_read on public.cmd_invites for select to authenticated using(command_private.manager(org_id));
-- Campaigns are organization-wide directives; tasks retain assignment/subtree visibility.
create policy campaign_read on public.cmd_campaigns for select to authenticated using(command_private.member(org_id) or command_private.platform_admin());
create policy task_read on public.cmd_tasks for select to authenticated using(command_private.platform_admin() or (command_private.member(org_id) and (assigned_to is null or command_private.visible(org_id,assigned_to) or created_by=(select auth.uid())) and (target_district is null or command_private.manager(org_id) or target_district=(select m.district from public.cmd_members m where m.org_id=cmd_tasks.org_id and m.user_id=(select auth.uid())))));
do $$ declare t text; begin
  foreach t in array array['cmd_hazri','cmd_proofs','cmd_ledger','cmd_social','cmd_social_snapshots','cmd_rewards'] loop
    execute format('create policy scoped_read on public.%I for select to authenticated using(command_private.visible(org_id,user_id))',t);
  end loop;
end $$;
create policy inbox_read on public.cmd_notifications for select to authenticated using(user_id=(select auth.uid()) and command_private.member(org_id));
create policy broadcast_read on public.cmd_broadcasts for select to authenticated using(command_private.visible(org_id,created_by));
create policy audit_read on public.cmd_audit for select to authenticated using(command_private.platform_admin() or command_private.manager(org_id));
-- Push subscriptions/outbox have no client SELECT policies: capability URLs stay server-side.

create function command_private.notify(o uuid,u uuid,t text,b text) returns void language plpgsql security definer set search_path='' as $$
declare n uuid;
begin
  insert into public.cmd_notifications(org_id,user_id,title,body) values(o,u,t,b) returning id into n;
  insert into public.cmd_push_outbox(notification_id,org_id,user_id) values(n,o,u);
end $$;

create function command_private.period_bounds(o uuid,p text,d date) returns table(start_date date,end_date date) language plpgsql stable set search_path='' as $$
declare a date; months integer;
begin
  if p='daily' then start_date:=d; end_date:=d+1;
  elsif p='weekly' then start_date:=date_trunc('week',d)::date; end_date:=start_date+7;
  elsif p='monthly' then start_date:=date_trunc('month',d)::date; end_date:=(start_date+interval '1 month')::date;
  elsif p='grand' then
    select reward_anchor into a from public.cmd_orgs where id=o;
    months:=(extract(year from d)::int-extract(year from a)::int)*12+extract(month from d)::int-extract(month from a)::int;
    start_date:=(a+(floor(months/4.0)*4)*interval '1 month')::date; end_date:=(start_date+interval '4 months')::date;
  else raise exception 'Invalid ranking period'; end if;
  return next;
end $$;
create function command_private.grade(p bigint) returns text language sql immutable set search_path='' as $$
  select case when p>=5000 then 'Tejas' when p>=2500 then 'Ojas' when p>=1000 then 'Uday' when p>=250 then 'Sankalp' else 'Sparsh' end
$$;
create function command_private.ranking(o uuid,p text,d date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s date; e date; result jsonb;
begin
  if not (command_private.member(o) or command_private.platform_admin()) then raise exception 'Organization access denied'; end if;
  select start_date,end_date into s,e from command_private.period_bounds(o,p,d);
  select coalesce(jsonb_agg(to_jsonb(r) order by r.rank,r.name),'[]'::jsonb) into result from (
    select m.user_id,m.name,m.district,m.stage,coalesce(sum(l.points),0)::bigint points,
      coalesce(sum(l.points) filter(where l.category<>'social'),0)::bigint ground_points,
      coalesce(sum(l.points) filter(where l.category='social'),0)::bigint social_points,
      dense_rank() over(order by coalesce(sum(l.points),0) desc) rank,
      command_private.grade(coalesce(sum(l.points),0)::bigint) grade
    from public.cmd_members m left join public.cmd_ledger l on l.org_id=m.org_id and l.user_id=m.user_id
      and l.earned_at >= (s::timestamp at time zone 'Asia/Kolkata') and l.earned_at < (e::timestamp at time zone 'Asia/Kolkata')
    where m.org_id=o and m.active group by m.user_id,m.name,m.district,m.stage
  ) r;
  return jsonb_build_object('start',s,'end',e,'rows',result);
end $$;

create function command_private.execute_command(action text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); me public.cmd_members; target public.cmd_members; inv public.cmd_invites; pr public.cmd_proofs;
  sh public.cmd_hazri; task public.cmd_tasks; org public.cmd_orgs; v uuid; parent uuid; team uuid;
  dest_stage integer; token text; pts integer; n integer; s date; e date; rec record; before_data jsonb;
begin
  if u is null then raise exception 'Sign in required'; end if;
  if action='create_org' then
    if not command_private.platform_admin() then raise exception 'Platform admin required'; end if;
    insert into public.cmd_orgs(name,mode,reward_anchor,monthly_reward,grand_reward)
      values(trim(p->>'name'),p->>'mode',coalesce((p->>'reward_anchor')::date,date_trunc('month',now() at time zone 'Asia/Kolkata')::date),coalesce(nullif(p->>'monthly_reward',''),'Monthly recognition'),coalesce(nullif(p->>'grand_reward',''),'4-Month Big Reward')) returning * into org;
    o:=org.id;
    insert into public.cmd_members(org_id,user_id,name,stage,can_manage) values(o,u,coalesce(nullif(p->>'admin_name',''),'Platform administrator'),1,true);
    insert into public.cmd_audit(org_id,actor_id,action,details) values(o,u,action,jsonb_build_object('name',org.name,'mode',org.mode));
    return to_jsonb(org);
  elsif action='join' then
    select * into inv from public.cmd_invites where token_hash=md5(p->>'code') for update;
    if not found or inv.expires_at<now() or inv.uses>=inv.max_uses then raise exception 'Invitation is invalid, expired, or full'; end if;
    select * into org from public.cmd_orgs where id=inv.org_id and active and mode=p->>'mode';
    if not found then raise exception 'Invitation does not match the selected mode'; end if;
    if inv.manager_id is not null and not exists(select 1 from public.cmd_members where org_id=org.id and user_id=inv.manager_id and active and stage<5) then raise exception 'Invitation manager is no longer available'; end if;
    insert into public.cmd_members(org_id,user_id,name,district,area,manager_id,team_id) values(org.id,u,trim(p->>'name'),coalesce(p->>'district',''),coalesce(p->>'area',''),inv.manager_id,inv.team_id);
    update public.cmd_invites set uses=uses+1 where id=inv.id;
    insert into public.cmd_audit(org_id,actor_id,action,target_id) values(org.id,u,'join',u);
    perform command_private.notify(org.id,u,'Welcome to '||org.name,'Your ground and digital workspace is ready. Open Campaigns and Tasks to begin.');
    return to_jsonb(org);
  end if;
  if not (command_private.member(o) or command_private.platform_admin()) then raise exception 'Organization access denied'; end if;
  select * into me from public.cmd_members where org_id=o and user_id=u;
  if action='rankings' then return command_private.ranking(o,p->>'period',coalesce((p->>'date')::date,(now() at time zone 'Asia/Kolkata')::date));
  elsif action='profile' then
    update public.cmd_members set name=trim(p->>'name'),district=coalesce(p->>'district',''),area=coalesce(p->>'area','') where org_id=o and user_id=u;
  elsif action='invite' then
    if not command_private.manager(o) then raise exception 'Organization admin required'; end if;
    parent:=nullif(p->>'manager_id','')::uuid; team:=nullif(p->>'team_id','')::uuid;
    if parent is not null and not exists(select 1 from public.cmd_members where org_id=o and user_id=parent and active and stage<5) then raise exception 'Invalid manager'; end if;
    token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
    insert into public.cmd_invites(org_id,token_hash,manager_id,team_id,max_uses) values(o,md5(token),parent,team,coalesce((p->>'max_uses')::int,50));
    return jsonb_build_object('code',token,'expires_in_days',7);
  elsif action='team' then
    if not command_private.manager(o) then raise exception 'Organization admin required'; end if;
    insert into public.cmd_teams(org_id,name) values(o,trim(p->>'name')) returning id into v;
  elsif action in ('move','move_team') then
    if not command_private.manager(o) then raise exception 'Organization admin required'; end if;
    -- Serialize organization structure changes to prevent concurrent cycle creation.
    perform 1 from public.cmd_orgs where id=o for update;
    dest_stage:=(p->>'stage')::int; parent:=nullif(p->>'manager_id','')::uuid; team:=nullif(p->>'team_id','')::uuid;
    if dest_stage is null or dest_stage not between 1 and 5 then raise exception 'Invalid stage'; end if;
    if length(trim(coalesce(p->>'reason',''))) < 5 then raise exception 'Movement reason is required'; end if;
    if parent is not null and not exists(select 1 from public.cmd_members where org_id=o and user_id=parent and active and cmd_members.stage<dest_stage) then raise exception 'Manager must be at a higher stage'; end if;
    if dest_stage=1 and parent is not null then raise exception 'Main leader has no manager'; end if;
    if action='move_team' and not exists(select 1 from public.cmd_members where org_id=o and team_id=team) then raise exception 'Team has no members'; end if;
    if action='move' and not exists(select 1 from public.cmd_members where org_id=o and user_id=(p->>'user_id')::uuid) then raise exception 'Member not found'; end if;
    for target in select * from public.cmd_members where org_id=o and ((action='move' and user_id=(p->>'user_id')::uuid) or (action='move_team' and team_id=team)) for update loop
      if target.user_id=parent then raise exception 'A member cannot report to themselves'; end if;
      if exists(select 1 from public.cmd_members where org_id=o and manager_id=target.user_id and cmd_members.stage<=dest_stage) then raise exception 'Reassign existing reports before moving to this stage'; end if;
      before_data:=to_jsonb(target);
      update public.cmd_members set stage=dest_stage,manager_id=parent,team_id=coalesce(team,target.team_id) where org_id=o and user_id=target.user_id;
      insert into public.cmd_audit(org_id,actor_id,action,target_id,details) values(o,u,'stage_move',target.user_id,jsonb_build_object('before',before_data,'stage',dest_stage,'manager_id',parent,'reason',p->>'reason'));
      perform command_private.notify(o,target.user_id,'Assignment updated','Your hierarchy stage is now '||dest_stage||'. Open your dashboard for your new responsibilities.');
    end loop;
  elsif action='access' then
    if not command_private.platform_admin() then raise exception 'Platform admin required'; end if;
    if (p->>'user_id')::uuid=u then raise exception 'Cannot change your own administrative access'; end if;
    update public.cmd_members set can_manage=(p->>'can_manage')::boolean,active=(p->>'active')::boolean where org_id=o and user_id=(p->>'user_id')::uuid;
  elsif action='org_settings' then
    if not command_private.platform_admin() then raise exception 'Platform admin required'; end if;
    update public.cmd_orgs set name=coalesce(nullif(trim(p->>'name'),''),name),active=coalesce((p->>'active')::boolean,active),monthly_reward=coalesce(p->>'monthly_reward',monthly_reward),grand_reward=coalesce(p->>'grand_reward',grand_reward) where id=o;
  elsif action='campaign' then
    if not command_private.leader(o) or me.user_id is null then raise exception 'Organization leadership required'; end if;
    insert into public.cmd_campaigns(org_id,title,body,asset_url,created_by) values(o,trim(p->>'title'),coalesce(p->>'body',''),nullif(p->>'asset_url',''),u) returning id into v;
  elsif action='task' then
    if not command_private.leader(o) or me.user_id is null then raise exception 'Organization leadership required'; end if;
    v:=nullif(p->>'assigned_to','')::uuid;
    if v=u or (v is not null and not command_private.visible(o,v)) then raise exception 'Assign tasks to your reporting team'; end if;
    if v is null and not (command_private.manager(o) or me.stage=1) then raise exception 'Only top command can create organization-wide tasks'; end if;
    insert into public.cmd_tasks(org_id,campaign_id,title,instructions,points,assigned_to,created_by,due_at) values(o,nullif(p->>'campaign_id','')::uuid,trim(p->>'title'),coalesce(p->>'instructions',''),coalesce((p->>'points')::int,25),v,u,nullif(p->>'due_at','')::timestamptz) returning id into v;
  elsif action='check_in' then
    if not command_private.member(o) then raise exception 'Membership required'; end if;
    insert into public.cmd_hazri(org_id,user_id,slot) values(o,u,p->>'slot') returning id into v;
  elsif action='check_out' then
    update public.cmd_hazri set checked_out=now() where org_id=o and user_id=u and checked_out is null returning id into v;
    if v is null then raise exception 'No active shift'; end if;
  elsif action='proof' then
    if not command_private.member(o) then raise exception 'Membership required'; end if;
    if nullif(p->>'task_id','') is not null then
      select * into task from public.cmd_tasks where org_id=o and id=(p->>'task_id')::uuid and active and (assigned_to is null or assigned_to=u) and (target_district is null or target_district=me.district);
      if not found then raise exception 'Task is not assigned to you'; end if;
      if task.due_at is not null and task.due_at<now() then raise exception 'Task deadline has passed'; end if;
    end if;
    if nullif(p->>'hazri_id','') is not null then
      select * into sh from public.cmd_hazri where org_id=o and id=(p->>'hazri_id')::uuid and user_id=u;
      if not found then raise exception 'Shift does not belong to you'; end if;
    end if;
    if nullif(p->>'photo_path','') is not null and not exists(select 1 from storage.objects where bucket_id='command-proofs' and name=p->>'photo_path' and split_part(name,'/',1)=o::text and split_part(name,'/',2)=u::text) then raise exception 'Upload your proof photo first'; end if;
    insert into public.cmd_proofs(org_id,user_id,kind,task_id,hazri_id,work,note,link,photo_path,mood,pulse) values(o,u,p->>'kind',nullif(p->>'task_id','')::uuid,nullif(p->>'hazri_id','')::uuid,trim(p->>'work'),coalesce(p->>'note',''),nullif(p->>'link',''),nullif(p->>'photo_path',''),coalesce(p->>'mood','neutral'),coalesce(p->>'pulse','')) returning id into v;
    for rec in select user_id from public.cmd_members where org_id=o and active and user_id<>u and (can_manage or user_id=me.manager_id) loop
      perform command_private.notify(o,rec.user_id,'Proof awaiting review',me.name||' submitted '||(p->>'kind')||' evidence.');
    end loop;
  elsif action='review' then
    select * into pr from public.cmd_proofs where org_id=o and id=(p->>'id')::uuid for update;
    if not found or not command_private.leader(o) or not command_private.visible(o,pr.user_id) or pr.user_id=u then raise exception 'You cannot review this proof'; end if;
    if pr.status<>'pending' then raise exception 'Proof has already been reviewed'; end if;
    if p->>'status' not in ('verified','rejected') then raise exception 'Invalid review status'; end if;
    if length(trim(coalesce(p->>'note','')))<3 then raise exception 'A review note is required'; end if;
    update public.cmd_proofs set status=p->>'status',reviewed_at=now(),reviewed_by=u,review_note=p->>'note' where id=pr.id;
    if p->>'status'='verified' then
      if pr.kind='task' then
        select points into pts from public.cmd_tasks where org_id=o and id=pr.task_id;
        token:=pr.task_id::text;
      else pts:=10; token:=(pr.submitted_at at time zone 'Asia/Kolkata')::date::text; end if;
      insert into public.cmd_ledger(org_id,user_id,category,source_key,points) values(o,pr.user_id,pr.kind,token,pts) on conflict do nothing;
      select * into sh from public.cmd_hazri where org_id=o and id=pr.hazri_id;
      if sh.checked_out is not null and sh.checked_out-sh.checked_in between interval '5 minutes' and interval '16 hours' then
        insert into public.cmd_ledger(org_id,user_id,category,source_key,points) values(o,pr.user_id,'hazri',(sh.checked_in at time zone 'Asia/Kolkata')::date::text,5) on conflict do nothing;
      end if;
    end if;
    perform command_private.notify(o,pr.user_id,'Proof '||(p->>'status'),p->>'note');
  elsif action='social' then
    if not command_private.member(o) then raise exception 'Membership required'; end if;
    insert into public.cmd_social(org_id,user_id,platform,url) values(o,u,p->>'platform',p->>'url') on conflict(org_id,user_id,platform) do update set url=excluded.url,verified=false,verified_by=null,verified_at=null;
  elsif action='verify_social' then
    v:=(p->>'user_id')::uuid;
    if not command_private.leader(o) or not command_private.visible(o,v) or v=u then raise exception 'Independent leadership verification required'; end if;
    if length(trim(coalesce(p->>'note','')))<10 then raise exception 'Describe the ownership evidence checked'; end if;
    update public.cmd_social set verified=true,verified_by=u,verified_at=now() where org_id=o and user_id=v and platform=p->>'platform';
  elsif action='read_notification' then
    update public.cmd_notifications set read_at=now() where org_id=o and user_id=u and (nullif(p->>'id','') is null or id=(p->>'id')::uuid) and read_at is null;
  elsif action='subscribe' then
    if not command_private.member(o) then raise exception 'Membership required'; end if;
    if length(p->'subscription'->>'endpoint')>2048 or p->'subscription'->'keys'->>'p256dh' is null or p->'subscription'->'keys'->>'auth' is null then raise exception 'Invalid push subscription'; end if;
    insert into public.cmd_push_subscriptions(org_id,user_id,endpoint,subscription) values(o,u,p->'subscription'->>'endpoint',p->'subscription') on conflict(org_id,user_id,endpoint) do update set subscription=excluded.subscription,updated_at=now();
  elsif action='unsubscribe_device' then
    delete from public.cmd_push_subscriptions where user_id=u and endpoint=p->>'endpoint';
  elsif action='broadcast' then
    if not command_private.leader(o) then raise exception 'Leadership required'; end if;
    if length(trim(coalesce(p->>'title','')))<2 or length(trim(coalesce(p->>'body','')))<3 then raise exception 'Title and message required'; end if;
    insert into public.cmd_broadcasts(org_id,created_by,title,body,district) values(o,u,p->>'title',p->>'body',nullif(p->>'district','')) returning id into v;
    for rec in select user_id from public.cmd_members where org_id=o and active and command_private.visible(o,user_id) and (nullif(p->>'district','') is null or district=p->>'district') loop
      perform command_private.notify(o,rec.user_id,p->>'title',p->>'body');
    end loop;
  elsif action='finalize_rewards' then
    if not command_private.manager(o) then raise exception 'Organization admin required'; end if;
    if p->>'period' not in ('monthly','grand') then raise exception 'Select a reward period'; end if;
    select start_date,end_date into s,e from command_private.period_bounds(o,p->>'period',(p->>'date')::date);
    if e>(now() at time zone 'Asia/Kolkata')::date then raise exception 'Reward cycle is still open'; end if;
    select * into org from public.cmd_orgs where id=o for update;
    if s<org.reward_anchor then raise exception 'Cycle predates organization reward program'; end if;
    for rec in select value from jsonb_array_elements(command_private.ranking(o,p->>'period',s)->'rows') loop
      if (rec.value->>'points')::bigint>0 and (rec.value->>'rank')::int<=3 then
        insert into public.cmd_rewards(org_id,user_id,period,period_start,period_end,points,rank,grade,reward)
        values(o,(rec.value->>'user_id')::uuid,p->>'period',s,e,(rec.value->>'points')::bigint,(rec.value->>'rank')::bigint,rec.value->>'grade',case when p->>'period'='monthly' then org.monthly_reward else org.grand_reward end) on conflict do nothing;
        get diagnostics n=row_count;
        if n=1 then perform command_private.notify(o,(rec.value->>'user_id')::uuid,'Reward earned','Your verified performance earned a '||(p->>'period')||' reward. Open Rankings.'); end if;
      end if;
    end loop;
  else raise exception 'Unknown command'; end if;
  if action in ('team','access','org_settings','campaign','task','review','verify_social','broadcast','finalize_rewards') then
    insert into public.cmd_audit(org_id,actor_id,action,target_id,details) values(o,u,action,coalesce(v,nullif(p->>'id','')::uuid),p);
  end if;
  return jsonb_build_object('ok',true,'id',v);
end $$;
create function public.cmd_execute(action text,org_id uuid default null,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
  select command_private.execute_command(action,org_id,payload)
$$;

-- Server-only analytics ingestion. A fresh channel starts with a baseline, not lifetime points.
create function public.cmd_ingest_youtube(o uuid,u uuid,channel text,views bigint,subscribers bigint,videos integer) returns void language plpgsql security invoker set search_path='' as $$
declare prev public.cmd_social_snapshots; amount integer; already integer; day_key text:=(now() at time zone 'Asia/Kolkata')::date::text;
begin
  perform 1 from public.cmd_members where org_id=o and user_id=u and active for update;
  if not found or not exists(select 1 from public.cmd_social where org_id=o and user_id=u and platform='youtube' and verified) then raise exception 'Verified social membership required'; end if;
  if exists(select 1 from public.cmd_social where org_id=o and platform='youtube' and channel_id=channel and user_id<>u) then raise exception 'This channel is already assigned to another member'; end if;
  update public.cmd_social set channel_id=channel where org_id=o and user_id=u and platform='youtube';
  select * into prev from public.cmd_social_snapshots where org_id=o and user_id=u and channel_id=channel order by captured_at desc limit 1;
  if prev.id is not null and prev.captured_at>now()-interval '5 minutes' then raise exception 'Wait five minutes between syncs'; end if;
  amount:=case when prev.id is null then 0 else least(100,(greatest(0,views-prev.views)/100+greatest(0,subscribers-prev.subscribers)))::int end;
  select coalesce(sum(points),0) into already from public.cmd_ledger where org_id=o and user_id=u and category='social' and earned_at>=(day_key::timestamp at time zone 'Asia/Kolkata');
  amount:=least(amount,greatest(0,100-already));
  insert into public.cmd_social_snapshots(org_id,user_id,channel_id,views,subscribers,videos) values(o,u,channel,greatest(views,coalesce(prev.views,0)),greatest(subscribers,coalesce(prev.subscribers,0)),videos);
  if amount>0 then insert into public.cmd_ledger(org_id,user_id,category,source_key,points) values(o,u,'social',gen_random_uuid()::text,amount); end if;
end $$;
create function public.cmd_claim_push() returns setof public.cmd_push_outbox language sql security invoker set search_path='' as $$
  update public.cmd_push_outbox set locked_until=now()+interval '2 minutes',attempts=attempts+1
  where id in (select id from public.cmd_push_outbox where delivered_at is null and available_at<=now() and (locked_until is null or locked_until<now()) and attempts<8 order by available_at for update skip locked limit 50) returning *
$$;
revoke all on all functions in schema command_private from public,anon,authenticated;
grant execute on function command_private.platform_admin(),command_private.member(uuid),command_private.manager(uuid),command_private.visible(uuid,uuid),command_private.leader(uuid),command_private.execute_command(text,uuid,jsonb) to authenticated;
revoke all on function public.cmd_execute(text,uuid,jsonb) from public,anon;
grant execute on function public.cmd_execute(text,uuid,jsonb) to authenticated;
revoke all on function public.cmd_ingest_youtube(uuid,uuid,text,bigint,bigint,integer),public.cmd_claim_push() from public,anon,authenticated;
grant execute on function public.cmd_ingest_youtube(uuid,uuid,text,bigint,bigint,integer),public.cmd_claim_push() to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('command-proofs','command-proofs',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy command_proof_upload on storage.objects for insert to authenticated with check(bucket_id='command-proofs' and split_part(name,'/',2)=(select auth.uid())::text and command_private.member(split_part(name,'/',1)::uuid));
create policy command_proof_read on storage.objects for select to authenticated using(bucket_id='command-proofs' and command_private.visible(split_part(name,'/',1)::uuid,split_part(name,'/',2)::uuid));

-- Legacy endpoints are not tenant-safe. Preserve rows but remove client access.
do $$ declare t text; pol record; fn record; begin
  foreach t in array array['profiles','social_accounts','weekly_scores','ranking_scores','analytics_snapshots','tasks','task_completions','notifications','messages','broadcasts','audit_logs','yt_videos','fb_posts','content_posts'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security',t);
      execute format('revoke all on public.%I from public,anon,authenticated',t);
    end if;
  end loop;
  -- Old storage policies reference revoked profiles and must not evaluate on new proofs.
  for pol in select policyname from pg_policies where schemaname='storage' and tablename='objects'
    and (coalesce(qual,'')||coalesce(with_check,'')) ~ '(profiles|aadhaar-docs|profile-photos)' loop
    execute format('drop policy %I on storage.objects',pol.policyname);
  end loop;
  update storage.buckets set public=false where id in ('aadhaar-docs','profile-photos');
  for fn in select p.oid::regprocedure::text signature from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    where ns.nspname='public' and p.proname in ('get_my_role','update_rankings','create_broadcast_notifications','create_task_from_broadcast') loop
    execute format('revoke execute on function %s from public,anon,authenticated',fn.signature);
  end loop;
end $$;
commit;
