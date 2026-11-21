begin;
create or replace function command_private.execute_command(action text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
    insert into public.cmd_audit(org_id,actor_id,action,details) values(o,u,'invitation_created',jsonb_build_object('manager_id',parent,'team_id',team));
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
  elsif action='task_status' then
    select * into task from public.cmd_tasks where org_id=o and id=(p->>'id')::uuid for update;
    if not found or not command_private.leader(o) or not (command_private.manager(o) or task.created_by=u) then raise exception 'Task management access required'; end if;
    update public.cmd_tasks set active=(p->>'active')::boolean where org_id=o and id=task.id;
    insert into public.cmd_audit(org_id,actor_id,action,target_id,details) values(o,u,action,task.id,p);
  elsif action='campaign_status' then
    if not command_private.leader(o) or not exists(select 1 from public.cmd_campaigns where org_id=o and id=(p->>'id')::uuid and (created_by=u or command_private.manager(o))) then raise exception 'Campaign management access required'; end if;
    update public.cmd_campaigns set active=(p->>'active')::boolean where org_id=o and id=(p->>'id')::uuid;
    insert into public.cmd_audit(org_id,actor_id,action,target_id,details) values(o,u,action,(p->>'id')::uuid,p);
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
    for rec in select user_id from public.cmd_members where org_id=o and active
      and (nullif(p->>'assigned_to','') is null or user_id=(p->>'assigned_to')::uuid) loop
      perform command_private.notify(o,rec.user_id,'New assignment',p->>'title');
    end loop;
  elsif action='check_in' then
    if not command_private.member(o) then raise exception 'Membership required'; end if;
    insert into public.cmd_hazri(org_id,user_id,slot) values(o,u,p->>'slot') returning id into v;
  elsif action='check_out' then
    update public.cmd_hazri set checked_out=now() where org_id=o and user_id=u and checked_out is null returning id into v;
    if v is null then raise exception 'No active shift'; end if;
    select * into sh from public.cmd_hazri where id=v;
    if sh.checked_out-sh.checked_in between interval '5 minutes' and interval '16 hours'
      and exists(select 1 from public.cmd_proofs where org_id=o and user_id=u and hazri_id=v and status='verified') then
      insert into public.cmd_ledger(org_id,user_id,category,source_key,points)
        values(o,u,'hazri',(sh.checked_in at time zone 'Asia/Kolkata')::date::text,5) on conflict do nothing;
    end if;
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

commit;
