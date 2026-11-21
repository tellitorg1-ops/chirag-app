// Direct MCP transport through the authenticated Codex app-server.
// Starts no model turns and delegates no work. Credentials remain in Codex's store.
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { readFileSync, writeFileSync } from 'node:fs'
import { generateKeyPairSync, randomBytes } from 'node:crypto'
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'))
if (input.queryFile) input.arguments = { ...input.arguments, query: readFileSync(input.queryFile, 'utf8') }
if (input.functionDirectory) {
  const directory = input.functionDirectory
  input.arguments.files = ['index.ts', '../_shared/http.ts', '../_shared/youtube.mjs'].map(name => ({ name: `${directory}/${name}`, content: readFileSync(`${directory}/${name}`, 'utf8') }))
}
let runtimePublicKey
if (input.configureRuntime) {
  const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}))
  const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey.export({format:'jwk'})
  runtimePublicKey=Buffer.concat([Buffer.from([4]),Buffer.from(key.x,'base64url'),Buffer.from(key.y,'base64url')]).toString('base64url')
  const settings={VAPID_PUBLIC_KEY:runtimePublicKey,VAPID_PRIVATE_KEY:key.d,VAPID_SUBJECT:env.VITE_SUPABASE_URL,PROJECT_URL:env.VITE_SUPABASE_URL,PUSH_DISPATCH_SECRET:randomBytes(32).toString('hex')}
  if(env.VITE_YOUTUBE_API_KEY)settings.YOUTUBE_API_KEY=env.VITE_YOUTUBE_API_KEY
  const literal=JSON.stringify(settings).replaceAll("'","''")
  input.tool='execute_sql'
  input.arguments={query:`insert into command_private.runtime_settings(id,settings) values(true,'${literal}'::jsonb) on conflict(id) do update set settings=runtime_settings.settings || jsonb_build_object('PROJECT_URL',excluded.settings->>'PROJECT_URL'); select settings->>'VAPID_PUBLIC_KEY' as public_key from command_private.runtime_settings where id=true;`}
}
const child = spawn('codex', ['app-server','--stdio'], { stdio: ['pipe','pipe','pipe'] })
let counter=0
const pending=new Map()
const timer=setTimeout(()=>{console.error('MCP call timed out');child.kill();process.exitCode=1},90000)
child.stderr.on('data',()=>{}) // Runtime logs can contain local account metadata; do not echo them.
createInterface({input:child.stdout}).on('line',line=>{
  let message;try{message=JSON.parse(line)}catch{return}
  if(message.id!=null&&pending.has(message.id)){
    const {resolve,reject}=pending.get(message.id);pending.delete(message.id)
    message.error?reject(new Error(JSON.stringify(message.error))):resolve(message.result)
  }else if(message.id!=null&&message.method){
    // Never silently accept authorization/approval prompts.
    child.stdin.write(JSON.stringify({id:message.id,error:{code:-32601,message:'Interactive approval must be completed in the Codex client'}})+'\n')
  }
})
function request(method,params){return new Promise((resolve,reject)=>{const id=++counter;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,method,params})+'\n')})}
try{
  await request('initialize',{clientInfo:{name:'leader_iq_mcp_transport',version:'1.0.0'},capabilities:{experimentalApi:true}})
  child.stdin.write(JSON.stringify({method:'initialized'})+'\n')
  const started=await request('thread/start',{cwd:process.cwd(),ephemeral:true})
  const threadId=started.thread.id
  const inventory=await request('mcpServerStatus/list',{threadId,serverName:'supabase',detail:'toolsAndAuthOnly'})
  if(input.discover)console.log(JSON.stringify(input.toolNames ? inventory.data.map(s=>({name:s.name,runtimeStatus:s.runtimeStatus,tools:Object.fromEntries(Object.entries(s.tools).filter(([name])=>input.toolNames.includes(name)))})) : inventory))
  else{
    const result=await request('mcpServer/tool/call',{threadId,server:'supabase',tool:input.tool,arguments:input.arguments||{}})
    if(input.configureRuntime){
      const text=result.content?.find(c=>c.type==='text')?.text||''
      const envelope=JSON.parse(text)
      const report=envelope.result||''
      const match=report.match(/"public_key"\s*:\s*"([A-Za-z0-9_-]+)"/)
      if(!match)throw new Error('Configuration response did not confirm a public push key. No environment changes made.')
      let envText=readFileSync('.env','utf8')
      envText=envText.replace(/^VITE_VAPID_PUBLIC_KEY=.*\r?\n?/m,'')
      envText=envText.trimEnd()+`\nVITE_VAPID_PUBLIC_KEY=${match[1]}\n`
      writeFileSync('.env',envText)
      console.log('Server settings saved privately. Only the public push key was added to .env. No secrets printed.')
    }else console.log(JSON.stringify(result))
  }
}catch(error){console.error(error.message);process.exitCode=1}
finally{clearTimeout(timer);child.stdin.end();child.kill()}
