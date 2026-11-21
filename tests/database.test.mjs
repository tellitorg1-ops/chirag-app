import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

let db
const ids = Object.fromEntries(['admin','lead','district','teamlead','worker','peer','outsider','newcomer'].map((n,i)=>[n,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]))
let orgA, orgB, taskId, shiftId, proofId, invite
async function sql(text,params=[]) { return (await db.query(text,params)).rows }
async function as(user,fn) {
  await db.exec('set role authenticated')
  await sql("select set_config('request.jwt.claim.sub',$1,false)",[ids[user]||user])
  try{return await fn()}finally{await db.exec('reset role')}
}
async function cmd(user,action,org,payload={}) { return as(user,async()=> (await sql('select public.cmd_execute($1,$2,$3::jsonb) as result',[action,org,JSON.stringify(payload)]))[0].result) }
before(async()=>{
  db=new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to public;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
    grant usage on schema public,storage to authenticated,service_role; grant select,insert on storage.objects to authenticated;
    grant all on all tables in schema storage to service_role;`)
  const migrationDir=new URL('../supabase/migrations/',import.meta.url)
  for(const file of readdirSync(migrationDir).filter(f=>f.endsWith('.sql')).sort()) await db.exec(readFileSync(new URL(file,migrationDir),'utf8'))
  for(const id of Object.values(ids))await sql('insert into auth.users(id) values($1)',[id])
  await sql('insert into public.cmd_platform_admins(user_id) values($1)',[ids.admin])
  for(const [key,id] of Object.entries(ids)) await sql("insert into public.cmd_profiles(user_id,name,district,area,completed) values($1,$2,'Patna','North',true)",[id,key])
  orgA=await cmd('admin','create_org',null,{name:'Party A',mode:'political',admin_name:'Platform Admin',reward_anchor:'2026-01-01'})
  orgB=await cmd('admin','create_org',null,{name:'Business B',mode:'business',admin_name:'Platform Admin',reward_anchor:'2026-01-01'})
  for(const [key,stage,manager] of [['lead',1,null],['district',3,'lead'],['teamlead',4,'district'],['worker',5,'teamlead'],['peer',5,'lead']]){
    await sql('insert into public.cmd_members(org_id,user_id,name,stage,manager_id) values($1,$2,$3,$4,$5)',[orgA.id,ids[key],key,stage,manager?ids[manager]:null])
  }
  await sql('insert into public.cmd_members(org_id,user_id,name) values($1,$2,$3)',[orgB.id,ids.outsider,'Other tenant'])
})
after(async()=>{await db?.close()})
test('RLS hides unrelated organizations and members',async()=>{
  const orgs=await as('worker',()=>sql('select id from public.cmd_orgs'))
  assert.deepEqual(orgs.map(o=>o.id),[orgA.id])
  const members=await as('worker',()=>sql('select user_id from public.cmd_members'))
  assert.deepEqual(members.map(m=>m.user_id),[ids.worker])
  const team=await as('teamlead',()=>sql('select user_id from public.cmd_members order by user_id'))
  assert.deepEqual(team.map(m=>m.user_id),[ids.teamlead,ids.worker])
  await assert.rejects(cmd('worker','rankings',orgB.id,{period:'monthly'}),/access denied/)
  await assert.rejects(cmd('worker','create_org',null,{name:'Escalation',mode:'business'}),/Platform admin/)
  await assert.rejects(as('worker',()=>sql('select public.cmd_runtime_settings()')),/permission denied/)
})
test('direct join creates no self-assigned party or leadership role',async()=>{
  await assert.rejects(cmd('newcomer','join',null,{name:'New Member',stage:1}),/Join directly/)
  await cmd('newcomer','basic_profile',null,{name:'New Member',district:'Patna',area:'North',stage:1,can_manage:true})
  assert.equal((await sql('select count(*)::int n from public.cmd_members where user_id=$1',[ids.newcomer]))[0].n,0)
  await cmd('admin','assign_member',orgA.id,{user_id:ids.newcomer,stage:5,wing:'ground',manager_id:ids.teamlead})
  const m=(await sql('select * from public.cmd_members where org_id=$1 and user_id=$2',[orgA.id,ids.newcomer]))[0]
  assert.equal(m.stage,5);assert.equal(m.can_manage,false);assert.equal(m.manager_id,ids.teamlead)
})

test('hierarchy moves enforce authority, stage order and tenant boundaries',async()=>{
  await assert.rejects(cmd('worker','move',orgA.id,{user_id:ids.worker,stage:1}),/admin required/)
  await assert.rejects(cmd('admin','move',orgA.id,{user_id:ids.worker,stage:4,manager_id:ids.outsider,reason:'Test invalid parent'}),/higher stage/)
  await assert.rejects(cmd('admin','move',orgA.id,{user_id:ids.teamlead,stage:5,reason:'Test existing reports'}),/existing reports/)
  await cmd('admin','move',orgA.id,{user_id:ids.peer,stage:2,manager_id:ids.lead,reason:'Performance promotion'})
  assert.equal((await sql('select stage from public.cmd_members where org_id=$1 and user_id=$2',[orgA.id,ids.peer]))[0].stage,2)
  assert.equal((await sql("select count(*)::int n from public.cmd_audit where action='stage_move'"))[0].n,1)
})
test('attendance and proof require owned, tenant-scoped records',async()=>{
  const task=await cmd('teamlead','task',orgA.id,{title:'Field visit',points:25,assigned_to:ids.worker});taskId=task.id
  await assert.rejects(cmd('worker','proof',orgA.id,{kind:'task',task_id:taskId,work:'Work completed'}),/check constraint/)
  shiftId=(await cmd('worker','check_in',orgA.id,{slot:'subah'})).id
  await assert.rejects(cmd('worker','check_in',orgA.id,{slot:'shaam'}),/unique constraint/)
  await assert.rejects(cmd('newcomer','proof',orgA.id,{kind:'diary',hazri_id:shiftId,work:'Forged ownership',note:'Not my shift evidence'}),/does not belong/)
  await assert.rejects(cmd('worker','proof',orgA.id,{kind:'task',task_id:taskId,work:'Photo evidence',photo_path:`${orgB.id}/${ids.outsider}/fake.jpg`}),/Upload your proof/)
  await sql("update public.cmd_hazri set checked_in=now()-interval '1 hour' where id=$1",[shiftId])
  await cmd('worker','check_out',orgA.id)
  proofId=(await cmd('worker','proof',orgA.id,{kind:'task',task_id:taskId,hazri_id:shiftId,work:'Completed field visit',note:'Visited the assigned area and reported observations',mood:'concern',pulse:'Road access concern'})).id
  assert.equal((await sql('select count(*)::int n from public.cmd_ledger'))[0].n,0)
})
test('independent verification awards once and cannot be forged',async()=>{
  await assert.rejects(cmd('worker','review',orgA.id,{id:proofId,status:'verified',note:'Self approved'}),/cannot review/)
  await assert.rejects(cmd('peer','review',orgA.id,{id:proofId,status:'verified',note:'Unrelated peer'}),/cannot review/)
  await assert.rejects(cmd('outsider','review',orgA.id,{id:proofId,status:'verified',note:'Other organization'}),/access denied/)
  await cmd('teamlead','review',orgA.id,{id:proofId,status:'verified',note:'Field evidence checked'})
  const ledger=await sql('select category,points from public.cmd_ledger order by category')
  assert.deepEqual(ledger,[{category:'hazri',points:5},{category:'task',points:25}])
  await assert.rejects(cmd('teamlead','review',orgA.id,{id:proofId,status:'verified',note:'Duplicate approval'}),/already been reviewed/)
  await assert.rejects(as('worker',()=>sql("insert into public.cmd_ledger(org_id,user_id,category,source_key,points) values($1,$2,'task','forged',999)",[orgA.id,ids.worker])),/permission denied/)
  await assert.rejects(as('worker',()=>sql('update public.cmd_members set can_manage=true where user_id=$1',[ids.worker])),/permission denied/)
})
test('diary points are capped per verified day and rejected work can be resubmitted',async()=>{
  for(let i=0;i<2;i++){
    const p=await cmd('worker','proof',orgA.id,{kind:'diary',hazri_id:shiftId,work:'Diary activity '+i,note:'Detailed field verification note'})
    await cmd('teamlead','review',orgA.id,{id:p.id,status:'verified',note:'Verified diary evidence'})
  }
  assert.equal((await sql("select sum(points)::int n from public.cmd_ledger where category='diary'"))[0].n,10)
  assert.equal((await sql("select sum(points)::int n from public.cmd_ledger where category='hazri'"))[0].n,5)
  const t=await cmd('teamlead','task',orgA.id,{title:'Follow up visit',assigned_to:ids.worker,points:15})
  const p=await cmd('worker','proof',orgA.id,{kind:'task',task_id:t.id,work:'Visit was attempted',note:'Evidence of visit attempt'})
  await cmd('teamlead','review',orgA.id,{id:p.id,status:'rejected',note:'More evidence required'})
  const retry=await cmd('worker','proof',orgA.id,{kind:'task',task_id:t.id,work:'Follow up completed',note:'New supporting field evidence'})
  assert.ok(retry.id)
})
test('social sync baseline, ownership, idempotency and separated ground ledger',async()=>{
  await cmd('worker','social',orgA.id,{platform:'youtube',url:'https://youtube.com/@channel'})
  await assert.rejects(cmd('worker','verify_social',orgA.id,{user_id:ids.worker,platform:'youtube',note:'I own the channel'}),/Independent/)
  await cmd('teamlead','verify_social',orgA.id,{user_id:ids.worker,platform:'youtube',note:'Channel ownership confirmed with owner'})
  async function ingest(v,s){await db.exec('set role service_role');try{await sql('select public.cmd_ingest_youtube($1,$2,$3,$4,$5,$6)',[orgA.id,ids.worker,'UC_test',v,s,10])}finally{await db.exec('reset role')}}
  await ingest(10000,200)
  assert.equal((await sql("select count(*)::int n from public.cmd_ledger where category='social'"))[0].n,0)
  await assert.rejects(ingest(20000,400),/five minutes/)
  await sql("update public.cmd_social_snapshots set captured_at=now()-interval '6 minutes'")
  await ingest(11000,205)
  assert.equal((await sql("select sum(points)::int n from public.cmd_ledger where category='social'"))[0].n,15)
  assert.equal((await sql("select sum(points)::int n from public.cmd_ledger where category in ('task','diary','hazri')"))[0].n,40)
  await assert.rejects(as('worker',()=>sql('select public.cmd_ingest_youtube($1,$2,$3,99999,99999,10)',[orgA.id,ids.worker,'UC_test'])),/permission denied/)
})
test('rank periods follow IST, monthly boundaries and anchored 4-month cycles',async()=>{
  for(const [period,date,start,end] of [['daily','2026-02-10','2026-02-10','2026-02-11'],['weekly','2026-02-10','2026-02-09','2026-02-16'],['monthly','2026-02-10','2026-02-01','2026-03-01'],['grand','2026-06-10','2026-05-01','2026-09-01']]){
    const r=await cmd('worker','rankings',orgA.id,{period,date});assert.equal(r.start,start);assert.equal(r.end,end);assert.ok(!r.rows.some(x=>x.user_id===ids.outsider))
  }
  await sql("insert into public.cmd_ledger(org_id,user_id,category,source_key,points,earned_at) values($1,$2,'task','boundary1',17,'2026-01-31 18:29:59+00'),($1,$2,'task','boundary2',23,'2026-01-31 18:30:00+00')",[orgA.id,ids.worker])
  const jan=await cmd('worker','rankings',orgA.id,{period:'monthly',date:'2026-01-20'});const feb=await cmd('worker','rankings',orgA.id,{period:'monthly',date:'2026-02-20'})
  assert.equal(jan.rows.find(r=>r.user_id===ids.worker).points,17);assert.equal(feb.rows.find(r=>r.user_id===ids.worker).points,23)
})
test('rewards finalize closed periods once; broadcast remains tenant/subtree scoped',async()=>{
  await assert.rejects(cmd('admin','finalize_rewards',orgA.id,{period:'monthly',date:'2099-01-01'}),/still open/)
  await cmd('admin','finalize_rewards',orgA.id,{period:'monthly',date:'2026-01-15'})
  const repeated=await cmd('admin','finalize_rewards',orgA.id,{period:'monthly',date:'2026-01-15'})
  assert.equal(repeated.already_finalized,true)
  assert.equal((await sql('select count(*)::int n from public.cmd_rewards'))[0].n,1)
  await cmd('teamlead','broadcast',orgA.id,{title:'Morning briefing',body:'Check your assigned routes.'})
  const recipients=await sql("select user_id,org_id from public.cmd_notifications where title='Morning briefing'")
  assert.ok(recipients.every(r=>r.org_id===orgA.id));assert.ok(!recipients.some(r=>r.user_id===ids.peer||r.user_id===ids.outsider))
  assert.ok(recipients.some(r=>r.user_id===ids.worker))
  const other=await as('outsider',()=>sql('select * from public.cmd_notifications where org_id=$1',[orgA.id]));assert.equal(other.length,0)
  assert.ok((await sql('select count(*)::int n from public.cmd_push_outbox'))[0].n>0)
})
test('proof approved during a shift awards attendance when that shift closes',async()=>{
  const shift=await cmd('newcomer','check_in',orgA.id,{slot:'daytime'})
  await sql("update public.cmd_hazri set checked_in=now()-interval '1 hour' where id=$1",[shift.id])
  const proof=await cmd('newcomer','proof',orgA.id,{kind:'diary',hazri_id:shift.id,work:'Completed afternoon field report',note:'Detailed observations confirmed by the team leader'})
  await cmd('teamlead','review',orgA.id,{id:proof.id,status:'verified',note:'Evidence verified before check out'})
  assert.equal((await sql("select count(*)::int n from public.cmd_ledger where user_id=$1 and category='hazri'",[ids.newcomer]))[0].n,0)
  await cmd('newcomer','check_out',orgA.id)
  assert.equal((await sql("select sum(points)::int n from public.cmd_ledger where user_id=$1 and category='hazri'",[ids.newcomer]))[0].n,5)
})
test('one YouTube channel cannot earn points for multiple members',async()=>{
  await cmd('newcomer','social',orgA.id,{platform:'youtube',url:'https://youtube.com/@channel'})
  await cmd('teamlead','verify_social',orgA.id,{user_id:ids.newcomer,platform:'youtube',note:'Ownership evidence recorded for test'})
  await db.exec('set role service_role')
  try{await assert.rejects(sql('select public.cmd_ingest_youtube($1,$2,$3,12000,300,10)',[orgA.id,ids.newcomer,'UC_test']),/already assigned/)}finally{await db.exec('reset role')}
})
test('organization administrators can move an entire team and every move is audited',async()=>{
  const team=await cmd('admin','team',orgA.id,{name:'Ground Team'})
  await sql('update public.cmd_members set team_id=$1 where org_id=$2 and user_id=any($3::uuid[])',[team.id,orgA.id,[ids.peer,ids.newcomer]])
  await cmd('admin','move_team',orgA.id,{team_id:team.id,stage:4,manager_id:ids.district,reason:'Team performance promotion'})
  const rows=await sql('select stage,manager_id from public.cmd_members where org_id=$1 and team_id=$2',[orgA.id,team.id])
  assert.equal(rows.length,2);assert.ok(rows.every(r=>r.stage===4&&r.manager_id===ids.district))
  assert.equal((await sql("select count(*)::int n from public.cmd_audit where action='stage_move'"))[0].n,3)
})
test('private proof photos cannot cross tenant or reporting-scope boundaries',async()=>{
  const path=`${orgA.id}/${ids.worker}/proof.jpg`
  await as('worker',()=>sql("insert into storage.objects(bucket_id,name) values('command-proofs',$1)",[path]))
  assert.equal((await as('worker',()=>sql('select name from storage.objects'))).length,1)
  assert.equal((await as('teamlead',()=>sql('select name from storage.objects'))).length,1)
  assert.equal((await as('outsider',()=>sql('select name from storage.objects'))).length,0)
  await assert.rejects(as('outsider',()=>sql("insert into storage.objects(bucket_id,name) values('command-proofs',$1)",[`${orgA.id}/${ids.outsider}/forged.jpg`])),/row-level security/)
})

test('Admin is outside hierarchy, creates parties, and cannot grant global roles',async()=>{
  await cmd('admin','set_global_role',null,{user_id:ids.peer,role:'admin'})
  const m=(await sql('select * from public.cmd_members where org_id=$1 and user_id=$2',[orgA.id,ids.peer]))[0]
  assert.equal(m.stage,null); assert.equal(m.can_manage,true)
  const account=await cmd('peer','account'); assert.equal(account.isAdmin,true);assert.equal(account.isPlatform,false)
  const own=await cmd('peer','create_org',null,{name:'Admin Party',mode:'political'})
  assert.ok(own.id)
  await assert.rejects(cmd('peer','set_global_role',null,{user_id:ids.worker,role:'super_admin'}),/Super Admin required/)
  await assert.rejects(cmd('worker','directory'),/Admin required/)
  const directory=await cmd('peer','directory')
  assert.ok(!directory.some(p=>p.user_id===ids.outsider))
  await assert.rejects(cmd('peer','assign_member',orgB.id,{user_id:ids.worker,stage:5,wing:'social'}),/admin required/)
  await assert.rejects(cmd('peer','assign_member',orgA.id,{user_id:ids.outsider,stage:5,wing:'social'}),/outside your organization/)
  await assert.rejects(cmd('admin','move',orgA.id,{user_id:ids.peer,stage:1,reason:'Invalid admin placement'}),/outside the hierarchy/)
  const rank=await cmd('worker','rankings',orgA.id,{period:'monthly'})
  assert.ok(!rank.rows.some(r=>r.user_id===ids.peer||r.user_id===ids.admin))
})

test('Super Admin promotion, demotion, audit and last-admin protection',async()=>{
  await assert.rejects(cmd('admin','set_global_role',null,{user_id:ids.admin,role:'member'}),/last Super Admin/)
  await cmd('admin','set_global_role',null,{user_id:ids.worker,role:'super_admin'})
  assert.equal((await cmd('worker','account')).isPlatform,true)
  await cmd('worker','set_global_role',null,{user_id:ids.worker,role:'member'})
  assert.equal((await cmd('worker','account')).isPlatform,false)
  assert.equal((await sql('select stage from public.cmd_members where org_id=$1 and user_id=$2',[orgA.id,ids.worker]))[0].stage,5)
  await assert.rejects(cmd('worker','set_global_role',null,{user_id:ids.worker,role:'super_admin'}),/Super Admin required/)
  assert.ok((await sql("select count(*)::int n from public.cmd_audit where action='set_global_role'"))[0].n>=3)
  await assert.rejects(as('worker',()=>sql("select command_private.execute_legacy('access',$1,$2)",[orgA.id,JSON.stringify({user_id:ids.worker,can_manage:true,active:true})])),/permission denied/)
})

test('profile completion is mandatory for members and cannot set privileges',async()=>{
  await sql('update public.cmd_profiles set completed=false where user_id=$1',[ids.newcomer])
  await assert.rejects(cmd('newcomer','check_in',orgA.id,{slot:'subah'}),/basic profile/)
  await assert.rejects(cmd('admin','assign_member',orgA.id,{user_id:ids.newcomer,stage:5,wing:'social'}),/basic profile/)
  await assert.rejects(cmd('newcomer','basic_profile',null,{name:'Person',district:'',area:'North'}),/required/)
  await cmd('newcomer','basic_profile',null,{name:'Person',district:'Patna',area:'North',isPlatform:true})
  assert.equal((await cmd('newcomer','account')).isPlatform,false)
  await cmd('admin','assign_member',orgA.id,{user_id:ids.newcomer,stage:5,wing:'social',manager_id:ids.teamlead})
  const m=(await sql('select * from public.cmd_members where org_id=$1 and user_id=$2',[orgA.id,ids.newcomer]))[0]
  assert.equal(m.wing,'social');assert.equal(m.stage,5)
  await assert.rejects(cmd('admin','assign_member',orgA.id,{user_id:ids.newcomer,stage:4,wing:'social',manager_id:ids.worker}),/higher stage/)
})

test('initial privileged phones require verification and are granted only once',async()=>{
  const uid='00000000-0000-4000-8000-000000000099'
  await sql("insert into auth.users(id,phone) values($1,'+919643693090')",[uid])
  assert.equal((await cmd(uid,'account')).isPlatform,false)
  await sql('update auth.users set phone_confirmed_at=now() where id=$1',[uid])
  assert.equal((await cmd(uid,'account')).isPlatform,true)
  await cmd('admin','set_global_role',null,{user_id:uid,role:'member'})
  assert.equal((await cmd(uid,'account')).isPlatform,false)
  const aid='00000000-0000-4000-8000-000000000098'
  await sql("insert into auth.users(id,phone,phone_confirmed_at) values($1,'919315937048',now())",[aid])
  const a=await cmd(aid,'account');assert.equal(a.isAdmin,true);assert.equal(a.isPlatform,false)
})
