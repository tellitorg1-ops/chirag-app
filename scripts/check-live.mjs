import { readFileSync } from 'node:fs'
const values=Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]}))
for(const name of ['command-youtube','command-push']){
  const response=await fetch(`${values.VITE_SUPABASE_URL}/functions/v1/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})
  const body=await response.json()
  if(response.status!==401)throw new Error(`${name}: expected unauthenticated 401, received ${response.status}`)
  console.log(`${name}: unauthenticated access rejected (${response.status}; ${body.error})`)
}
// Validate key configuration with a read-only public channel lookup; never print the key.
if(values.VITE_YOUTUBE_API_KEY){
  const params=new URLSearchParams({part:'id',id:'UC_x5XG1OV2P6uZZ5FSM9Ttw',key:values.VITE_YOUTUBE_API_KEY})
  const response=await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`)
  const body=await response.json()
  console.log(response.ok&&body.items?.length?'YouTube API key: public channel lookup succeeded':`YouTube API key: lookup failed (${response.status}, ${body.error?.status||'unknown'})`)
}
