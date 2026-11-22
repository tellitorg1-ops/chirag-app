import { test, expect } from '@playwright/test'
import { loadEnv } from 'vite'
import { readFile } from 'node:fs/promises'
const env=loadEnv('test',process.cwd(),'VITE_')
const project=new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const org='10000000-0000-4000-8000-000000000001'
const user='20000000-0000-4000-8000-000000000001'
const worker='20000000-0000-4000-8000-000000000002'
async function mockWorkspace(page,stage=1,options={}){
  const orgRecord={id:org,name:'Test Organization',mode:'political',active:true,reward_anchor:'2026-01-01',monthly_reward:'Monthly recognition',grand_reward:'4-Month Big Reward'}
  const member={org_id:org,user_id:user,name:'Test Leader',stage,wing:options.wing||'ground',manager_id:null,can_manage:!!options.admin,active:true,district:'Patna',area:'North'}
  const database={cmd_orgs:[orgRecord],cmd_members:[member,{org_id:org,user_id:worker,name:'Field Member',stage:5,manager_id:user,active:true,district:'Patna'}],cmd_platform_admins:[],cmd_teams:[],cmd_invites:[],cmd_audit:[],cmd_broadcasts:[],cmd_rewards:[],cmd_ledger:[],cmd_social:[],cmd_social_snapshots:[],cmd_notifications:[],cmd_hazri:[],cmd_proofs:[],cmd_tasks:[{id:'30000000-0000-4000-8000-000000000001',org_id:org,title:'Visit assigned area',instructions:'Record your field observations.',active:true,points:25,assigned_to:null,created_by:worker,created_at:new Date().toISOString()}],cmd_campaigns:[{id:'40000000-0000-4000-8000-000000000001',org_id:org,title:'Community outreach',body:'Coordinate daily ground work.',active:true,created_at:new Date().toISOString()}]}
  if(options.pending)database.cmd_members=[]
  const calls=[]
  await page.route('**/*.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url())
    const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}
    if(request.method()==='OPTIONS')return route.fulfill({status:200,headers,body:'{}'})
    if(url.pathname.includes('/auth/v1/'))return route.fulfill({status:200,headers,body:JSON.stringify({id:user,phone:'919999999999',aud:'authenticated',role:'authenticated'})})
    if(url.pathname.endsWith('/rpc/cmd_execute')){
      const body=request.postDataJSON();calls.push(body)
      if(body.action==='proof' && options.failWork===body.payload.work) return route.fulfill({status:400,headers,body:JSON.stringify({message:'This row could not be saved'})})
      let result={ok:true,id:crypto.randomUUID()}
      if(body.action==='account')result={isPlatform:!!options.superAdmin,isAdmin:!!options.admin||!!options.superAdmin,profile:{name:'Test Leader',district:'Patna',area:'North',completed:options.completed!==false}}
      if(body.action==='directory')result=options.directory||[]
      if(body.action==='basic_profile')options.completed=true
      if(body.action==='rankings')result={start:'2026-11-01',end:'2026-12-01',rows:[{user_id:user,name:member.name,district:'Patna',stage,rank:1,points:245,ground_points:200,social_points:45,grade:'Sparsh'}]}
      if(body.action==='check_in')database.cmd_hazri.push({id:result.id,org_id:org,user_id:user,slot:body.payload.slot,checked_in:new Date().toISOString(),checked_out:null})
      if(body.action==='check_out')database.cmd_hazri.forEach(s=>s.checked_out=new Date().toISOString())
      if(body.action==='proof')database.cmd_proofs.push({...body.payload,id:result.id,org_id:org,user_id:user,status:'pending',submitted_at:new Date().toISOString()})
      if(body.action==='review')database.cmd_proofs.forEach(p=>{if(p.id===body.payload.id){p.status=body.payload.status;p.review_note=body.payload.note}})
      return route.fulfill({status:200,headers,body:JSON.stringify(result)})
    }
    const table=url.pathname.split('/').pop()
    let rows=[...(database[table]||[])]
    for(const [key,value]of url.searchParams)if(value.startsWith('eq.'))rows=rows.filter(r=>String(r[key])===value.slice(3))
    return route.fulfill({status:200,headers,body:JSON.stringify(rows)})
  })
  await page.addInitScript(({user,org,project})=>{
    const session={access_token:'test-jwt-token',refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:user,aud:'authenticated',role:'authenticated',phone:'919999999999',app_metadata:{},user_metadata:{}}}
    localStorage.setItem(`sb-${project}-auth-token`,JSON.stringify(session));localStorage.setItem('command_org',org)
  },{user,org,project})
  return {calls,database}
}
test('entry mode choice leads to mobile login without Aadhaar',async({page})=>{
  await page.goto('/')
  await expect(page.getByRole('heading',{name:/Leadership meets/})).toBeVisible()
  await page.getByRole('button',{name:/Business \/ Brand/}).click()
  await expect(page).toHaveURL(/login/)
  await expect(page.getByLabel('Mobile number')).toBeVisible()
  await expect(page.getByText('No Aadhaar document or number')).toBeVisible()
})

for (const [label, stage, options] of [
  ['Super Admin',null,{superAdmin:true,completed:false}],
  ['Admin',null,{admin:true,completed:false}],
  ['Main Leader',1,{}], ['Subordinate Leader',2,{}], ['District Leader',3,{}], ['Team Leader',4,{}],
  ['Ground Karyakarta',5,{wing:'ground'}], ['Social Media Karyakarta',5,{wing:'social'}],
]) test(`${label} receives its own dashboard`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await mockWorkspace(page,stage,options)
  await page.goto(options.admin||options.superAdmin ? '/organizations' : '/home')
  await expect(page.getByRole('heading',{name:`${label} dashboard`,exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Basic profile',exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  if(label==='Social Media Karyakarta') await expect(page.locator('.quick-actions').getByRole('link',{name:'Campaign content',exact:true})).toBeVisible()
  expect(errors).toEqual([])
})

test('direct signup requires profile, waits for assignment, then automatically opens assigned dashboard',async({page})=>{
  const {database,calls}=await mockWorkspace(page,5,{pending:true,completed:false})
  await page.goto('/organizations')
  await expect(page.getByRole('heading',{name:'Basic profile',exact:true})).toBeVisible()
  await expect(page.getByLabel('Invitation code')).toHaveCount(0)
  await page.getByLabel('Full name').fill('New Karyakarta')
  await page.getByLabel('District / region').fill('Patna')
  await page.getByLabel('Block / area').fill('North')
  await page.getByRole('button',{name:'Save profile & continue'}).click()
  await expect(page.getByRole('heading',{name:'Party/team assignment pending'})).toBeVisible()
  expect(calls.some(c=>c.action==='basic_profile')).toBeTruthy()
  database.cmd_members.push({org_id:org,user_id:user,name:'New Karyakarta',stage:5,wing:'social',active:true})
  await page.getByRole('button',{name:'Check assignment'}).click()
  await expect(page.getByRole('heading',{name:'Social Media Karyakarta dashboard'})).toBeVisible()
})

test('a reassigned member sees their new dashboard without another login',async({page})=>{
  const {database}=await mockWorkspace(page,5,{wing:'ground'})
  await page.goto('/home')
  await expect(page.getByRole('heading',{name:'Ground Karyakarta dashboard'})).toBeVisible()
  database.cmd_members[0].stage=4
  await expect(page.getByRole('heading',{name:'Team Leader dashboard'})).toBeVisible({timeout:15000})
})

test('Super Admin assigns a joined member and promotes an account from the dashboard',async({page})=>{
  const {calls}=await mockWorkspace(page,null,{superAdmin:true,directory:[{user_id:worker,name:'Joined Person',phone:'919888888888',role:'member',completed:true,memberships:[]}]})
  await page.goto('/platform')
  await page.getByRole('button',{name:'Manage',exact:true}).click()
  await page.getByRole('combobox',{name:'Party',exact:true}).selectOption(org)
  await page.getByRole('combobox',{name:'Hierarchy level',exact:true}).selectOption('5')
  await page.getByRole('combobox',{name:'Work type',exact:true}).selectOption('social')
  await page.getByRole('button',{name:'Save party & dashboard assignment'}).click()
  await expect.poll(()=>calls.some(c=>c.action==='assign_member'&&c.org_id===org&&c.payload.user_id===worker&&c.payload.wing==='social')).toBeTruthy()
  await page.getByRole('combobox',{name:'Account role',exact:true}).selectOption('super_admin')
  await page.getByRole('button',{name:'Update account role'}).click()
  await expect.poll(()=>calls.some(c=>c.action==='set_global_role'&&c.payload.user_id===worker&&c.payload.role==='super_admin')).toBeTruthy()
})

for(const [label,stage,options] of [['Super Admin',null,{superAdmin:true}],['Admin',null,{admin:true}],['Leader',3,{}]])
test(`${label} workspace offers oversight instead of worker actions`,async({page})=>{
  await mockWorkspace(page,stage,options)
  await page.goto('/home')
  await expect(page.getByRole('link',{name:'Check in',exact:true})).toHaveCount(0)
  await expect(page.getByText('THIS MONTH · YOUR PROGRESS',{exact:true})).toHaveCount(0)
  await page.goto('/tasks')
  await expect(page.getByRole('heading',{name:'Task monitoring',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Submit proof',exact:true})).toHaveCount(0)
  await expect(page.getByText(/Issued by:/)).toBeVisible()
  await page.goto('/analytics')
  await expect(page.getByRole('heading',{name:'Social team performance'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Sync my YouTube'})).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'Link an account'})).toHaveCount(0)
  await page.goto('/hazri')
  await expect(page.getByRole('heading',{name:'This option is not part of your role'})).toBeVisible()
})

test('Ground worker has field tools and cannot open social tools',async({page})=>{
  await mockWorkspace(page,5,{wing:'ground'})
  await page.goto('/home')
  await expect(page.getByRole('link',{name:'Check in',exact:true})).toBeVisible()
  await page.goto('/content')
  await expect(page.getByRole('heading',{name:'Ground instructions',exact:true})).toBeVisible()
  await page.goto('/analytics')
  await expect(page.getByRole('heading',{name:'This option is not part of your role'})).toBeVisible()
})

test('Social worker has digital tools and evidence without ground fields',async({page})=>{
  await mockWorkspace(page,5,{wing:'social'})
  await page.goto('/tasks')
  await page.getByRole('button',{name:'Submit proof',exact:true}).click()
  await expect(page.getByLabel('Post / campaign evidence')).toBeVisible()
  await expect(page.getByLabel('Ground pulse / mahaul')).toHaveCount(0)
  await expect(page.getByLabel('Linked Hazri shift (optional)')).toHaveCount(0)
  await page.goto('/analytics')
  await expect(page.getByRole('heading',{name:'Link an account'})).toBeVisible()
  await page.goto('/diary')
  await expect(page.getByRole('heading',{name:'This option is not part of your role'})).toBeVisible()
})
test('role-aware dashboard is responsive and all active routes render',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await mockWorkspace(page)
  await page.goto('/home')
  await expect(page.getByRole('heading',{name:'Main Leader dashboard'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Sparsh',exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  if(info.project.name==='desktop')await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible()
  else await expect(page.getByRole('navigation',{name:'Quick navigation'})).toBeVisible()
  await page.screenshot({path:`test-results/${info.project.name}-dashboard.png`,fullPage:true})
  for(const [path,title] of [['/content','Directives & assignments'],['/hierarchy','Every person. A clear role.'],['/leaderboard','Rankings & recognition'],['/analytics','Social accounts & analytics'],['/reviews','Verification desk'],['/broadcast','Broadcast to your team'],['/profile','My profile'],['/notifications','Notification center']]){
    await page.goto(path);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
  }
  expect(errors).toEqual([])
})
test('ground worker checks in and submits evidence without self-awarding points',async({page})=>{
  const {calls}=await mockWorkspace(page,5)
  await page.goto('/hazri');await page.getByRole('button',{name:'Check in',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Your shift is active.'})).toBeVisible()
  await page.goto('/diary')
  await page.getByLabel('Work completed row 1').fill('Visited the assigned route and recorded observations.')
  await page.getByLabel('Evidence note row 1').fill('Met the field coordinator at the assigned location and completed the report.')
  await page.getByRole('button',{name:'Save work rows'}).click()
  await expect(page.getByText('1 work row saved for review.',{exact:true})).toBeVisible()
  expect(calls.some(c=>c.action==='proof'&&c.org_id===org&&c.payload.hazri_id)).toBeTruthy()
  expect(calls.some(c=>c.action==='review')).toBeFalsy()
  await page.goto('/reviews')
  await expect(page.getByRole('heading',{name:'This option is not part of your role'})).toBeVisible()
})
test('rank controls request distinct timeframes and show exact next-grade points',async({page})=>{
  const {calls}=await mockWorkspace(page,5);await page.goto('/leaderboard')
  await expect(page.getByText('5 points to Sankalp')).toBeVisible()
  for(const label of ['Daily','Weekly','Monthly','4-Month'])await page.getByRole('button',{name:label,exact:true}).click()
  await expect.poll(()=>new Set(calls.filter(c=>c.action==='rankings').map(c=>c.payload.period)).size).toBe(4)
})

test('work sheet pastes multiple rows, keeps drafts on refresh and exports saved rows',async({page})=>{
  const {calls,database}=await mockWorkspace(page,5)
  database.cmd_hazri.push({id:'50000000-0000-4000-8000-000000000009',user_id:user,org_id:org,slot:'subah',checked_in:new Date().toISOString(),checked_out:null})
  await page.goto('/work-sheet')
  await page.getByText('Paste rows from Excel',{exact:true}).click()
  await page.getByLabel('Paste spreadsheet rows').fill('Visited ward one\tMet residents and recorded requests\t\tRoad issue\nSurveyed market\tRecorded local shop feedback\t\t')
  await page.getByRole('button',{name:'Add pasted rows'}).click()
  await page.reload()
  await expect(page.getByLabel('Work completed row 2')).toHaveValue('Surveyed market')
  await page.getByRole('button',{name:'Save work rows'}).click()
  await expect(page.getByText('2 work rows saved for review.',{exact:true})).toBeVisible()
  expect(calls.filter(c=>c.action==='proof')).toHaveLength(2)
  await expect(page.getByRole('region',{name:'My ground work records'}).getByRole('cell',{name:'Surveyed market',exact:true})).toBeVisible()
  const downloadPromise=page.waitForEvent('download')
  await page.getByRole('button',{name:'Download CSV for Excel'}).click()
  const download=await downloadPromise
  const csv=await readFile(await download.path(),'utf8')
  expect(csv).toContain('Visited ward one');expect(csv).toContain('Surveyed market')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
})

test('work sheet retains failed rows and does not resubmit successful rows',async({page})=>{
  const {database,calls}=await mockWorkspace(page,5,{failWork:'Second field visit'})
  database.cmd_hazri.push({id:'50000000-0000-4000-8000-000000000009',user_id:user,org_id:org,slot:'subah',checked_in:new Date().toISOString(),checked_out:null})
  await page.goto('/work-sheet')
  await page.getByLabel('Work completed row 1').fill('First field visit')
  await page.getByLabel('Evidence note row 1').fill('Recorded verified location details')
  await page.getByRole('button',{name:'Add row',exact:true}).click()
  await page.getByLabel('Work completed row 2').fill('Second field visit')
  await page.getByRole('button',{name:'Save work rows'}).click()
  await expect(page.getByText('Check the highlighted rows. Nothing has been submitted.')).toBeVisible()
  expect(calls.filter(c=>c.action==='proof')).toHaveLength(0)
  await page.getByLabel('Evidence note row 2').fill('Recorded separate location details')
  await page.getByRole('button',{name:'Save work rows'}).click()
  await expect(page.getByText('1 work row saved for review.',{exact:true})).toBeVisible()
  await expect(page.getByLabel('Work completed row 1')).toHaveValue('Second field visit')
  await expect(page.getByText('This row could not be saved',{exact:true})).toBeVisible()
  expect(calls.filter(c=>c.action==='proof'&&c.payload.work==='First field visit')).toHaveLength(1)
})
test('leadership sees linked shift timings and ground pulse in team reporting',async({page})=>{
  const {database,calls}=await mockWorkspace(page)
  const shift='50000000-0000-4000-8000-000000000001'
  database.cmd_hazri.push({id:shift,org_id:org,user_id:worker,slot:'subah',checked_in:new Date().toISOString(),checked_out:null})
  database.cmd_proofs.push({id:'60000000-0000-4000-8000-000000000001',org_id:org,user_id:worker,hazri_id:shift,kind:'diary',status:'pending',mood:'concern',work:'Recorded field situation',pulse:'Access road needs attention',submitted_at:new Date().toISOString()})
  await page.goto('/hierarchy')
  await expect(page.getByRole('heading',{name:'Team attendance & daily reporting'})).toBeVisible()
  await expect(page.getByRole('cell',{name:'Subah · Morning'})).toBeVisible()
  await page.getByRole('button',{name:'Review row',exact:true}).click()
  await expect(page.getByText('Ground pulse: Access road needs attention')).toBeVisible()
  await page.getByLabel('Review note').fill('Location and work evidence checked')
  await page.getByRole('button',{name:'Verify & award'}).click()
  await expect.poll(()=>calls.some(c=>c.action==='review'&&c.payload.status==='verified')).toBeTruthy()
  await expect(page.getByRole('region',{name:'Team ground work records'}).getByText('verified',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy()
})
