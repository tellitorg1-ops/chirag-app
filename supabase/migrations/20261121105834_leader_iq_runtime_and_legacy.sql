begin;
-- Server configuration is private, RLS protected, and never returned to browsers.
create table command_private.runtime_settings (
  id boolean primary key default true check(id), settings jsonb not null default '{}'
);
alter table command_private.runtime_settings enable row level security;
revoke all on command_private.runtime_settings from public,anon,authenticated;
grant select on command_private.runtime_settings to service_role;
create function public.cmd_runtime_settings() returns jsonb language sql security invoker set search_path='' as $$
  select settings from command_private.runtime_settings where id=true
$$;
revoke all on function public.cmd_runtime_settings() from public,anon,authenticated;
grant execute on function public.cmd_runtime_settings() to service_role;

-- Preserve legacy membership in one explicitly identified workspace. No Aadhaar,
-- access tokens, unverified historical scores or AI suggestions are imported.
do $$ declare o uuid; root_user uuid; rec record; begin
  if to_regclass('public.profiles') is null then return; end if;
  select p.id into root_user from public.profiles p join auth.users u on u.id=p.id where p.role='super_admin' order by p.created_at limit 1;
  if root_user is null then return; end if;
  insert into public.cmd_platform_admins(user_id) select p.id from public.profiles p join auth.users u on u.id=p.id where p.role='super_admin' on conflict do nothing;
  insert into public.cmd_orgs(name,mode) values('Political Workspace','political') returning id into o;
  insert into public.cmd_members(org_id,user_id,name,district,area,stage,can_manage)
    select o,p.id,case when length(trim(coalesce(p.name,'')))>=2 then left(trim(p.name),100) else 'Member' end,
      coalesce(p.district,''),coalesce(p.block,''),case p.role when 'super_admin' then 1 when 'admin' then 2 when 'author' then 4 else 5 end,
      p.role in ('super_admin','admin') from public.profiles p join auth.users u on u.id=p.id;
  update public.cmd_members set manager_id=root_user where org_id=o and user_id<>root_user and stage>1;
  insert into public.cmd_tasks(id,org_id,title,instructions,points,created_by,due_at,target_district,active,created_at)
    select t.id,o,case when length(trim(coalesce(t.title,'')))>=2 then left(t.title,150) else 'Imported task' end,
      coalesce(t.description,''),greatest(1,least(coalesce(t.points,25),1000)),
      case when exists(select 1 from public.cmd_members m where m.org_id=o and m.user_id=t.created_by) then t.created_by else root_user end,
      t.expires_at,nullif(t.target_district,''),coalesce(t.active,true),coalesce(t.created_at,now()) from public.tasks t;
  if to_regclass('public.content_posts') is not null then
    insert into public.cmd_campaigns(id,org_id,title,body,asset_url,created_by,created_at)
      select c.id,o,case when length(trim(coalesce(c.title,'')))>=2 then left(c.title,150) else 'Imported campaign' end,coalesce(c.body,''),
      case when c.media_url ~ '^https://' then c.media_url else null end,
      case when exists(select 1 from public.cmd_members m where m.org_id=o and m.user_id=c.created_by) then c.created_by else root_user end,
      coalesce(c.created_at,now()) from public.content_posts c;
  end if;
  for rec in select a.volunteer_id,links.platform,links.url from public.social_accounts a cross join lateral (values
    ('youtube',coalesce(nullif(a.youtube_channel_url,''),a.yt_channel_url)),('facebook',coalesce(nullif(a.facebook_page_url,''),a.fb_page_url)),
    ('instagram',case when a.ig_username ~ '^https://' then a.ig_username when nullif(a.ig_username,'') is not null then 'https://www.instagram.com/'||ltrim(a.ig_username,'@') else null end),('x',a.twitter_url)
  ) links(platform,url) where exists(select 1 from public.cmd_members m where m.org_id=o and m.user_id=a.volunteer_id) and nullif(links.url,'') is not null loop
    if rec.url !~ '^https?://' then rec.url:='https://'||rec.url; end if;
    if rec.url ~ '^https://' then insert into public.cmd_social(org_id,user_id,platform,url) values(o,rec.volunteer_id,rec.platform,rec.url) on conflict do nothing; end if;
  end loop;
  insert into public.cmd_notifications(id,org_id,user_id,title,body,read_at,created_at)
    select n.id,o,n.volunteer_id,coalesce(n.title,'Organization update'),coalesce(n.body,''),n.read_at,coalesce(n.created_at,now()) from public.notifications n
    where exists(select 1 from public.cmd_members m where m.org_id=o and m.user_id=n.volunteer_id);
  insert into public.cmd_audit(org_id,actor_id,action,details) values(o,root_user,'legacy_workspace_import',jsonb_build_object('members',(select count(*) from public.cmd_members where org_id=o),'tasks',(select count(*) from public.cmd_tasks where org_id=o),'historical_scores','Retained in legacy tables; not awarded as verified points'));
end $$;

-- Enable realtime notifications when the standard Supabase publication exists.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.cmd_notifications;
  end if;
end $$;
commit;
