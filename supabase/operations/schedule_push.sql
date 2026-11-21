-- Run once after deploying command-push and setting private runtime settings.
-- The job contains no literal credentials; it reads its dispatcher secret at runtime.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('leader-iq-push-dispatch','* * * * *', $job$
  select net.http_post(
    url := (select settings->>'PROJECT_URL' from command_private.runtime_settings where id=true)||'/functions/v1/command-push',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select settings->>'PUSH_DISPATCH_SECRET' from command_private.runtime_settings where id=true)),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
$job$);
