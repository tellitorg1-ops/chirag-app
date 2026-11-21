begin;
-- Explicit deny policies document server-only data and survive future grants.
create policy runtime_server_only on command_private.runtime_settings as restrictive for all to anon,authenticated using(false) with check(false);
create policy push_queue_server_only on public.cmd_push_outbox as restrictive for all to anon,authenticated using(false) with check(false);
create policy push_devices_server_only on public.cmd_push_subscriptions as restrictive for all to anon,authenticated using(false) with check(false);
revoke create on schema public from public,anon,authenticated;
do $$ declare fn record; begin
  for fn in select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('generate_team_id','calculate_score','calculate_grade','update_rankings','create_broadcast_notifications','create_task_from_broadcast','get_my_role','auto_assign_tick') loop
    execute format('alter function %s set search_path = public, pg_temp',fn.signature);
  end loop;
end $$;
create index cmd_campaigns_creator on public.cmd_campaigns(org_id,created_by);
create index cmd_tasks_creator on public.cmd_tasks(org_id,created_by);
create index cmd_tasks_assignee on public.cmd_tasks(org_id,assigned_to);
create index cmd_tasks_campaign on public.cmd_tasks(org_id,campaign_id);
create index cmd_hazri_owner on public.cmd_hazri(org_id,user_id,checked_in desc);
create index cmd_proofs_owner on public.cmd_proofs(org_id,user_id,submitted_at desc);
create index cmd_proofs_task on public.cmd_proofs(org_id,task_id);
create index cmd_proofs_hazri on public.cmd_proofs(org_id,hazri_id);
create index cmd_ledger_owner on public.cmd_ledger(org_id,user_id,earned_at desc);
create index cmd_invites_manager on public.cmd_invites(org_id,manager_id);
create index cmd_invites_team on public.cmd_invites(org_id,team_id);
create index cmd_rewards_owner on public.cmd_rewards(org_id,user_id,awarded_at desc);
create index cmd_push_pending on public.cmd_push_outbox(available_at) where delivered_at is null;
create index cmd_broadcasts_org on public.cmd_broadcasts(org_id,created_at desc);
comment on table command_private.runtime_settings is 'Private server configuration. Only service_role can read; never log settings or expose them through client RPCs.';
comment on table public.cmd_ledger is 'Append-only verified points. Clients have no write privileges. Only proof review and server analytics ingestion create entries.';
commit;
