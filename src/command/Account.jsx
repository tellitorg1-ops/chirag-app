import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { command } from './api'
import { supabase } from '../lib/supabase'
import { useOrganizations, useSession } from './context'
import { Card, ErrorBox, Field, PageHeading, Badge } from './ui'
import { STAGES } from './domain'
import { OrganizationSettings } from './OrganizationSettings'

export function BasicProfile({ profile, onSaved }) {
  const { user } = useSession()
  const cache = useQueryClient()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    const data = new FormData(e.currentTarget)
    try {
      const payload = { name: data.get('name'), district: data.get('district'), area: data.get('area') }
      const photo = data.get('photo')
      if (photo?.size) {
        if (!['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 5242880) throw new Error('Choose a JPG, PNG or WebP photo under 5 MB.')
        const path = `${user.id}/${crypto.randomUUID()}`
        const { error: uploadError } = await supabase.storage.from('command-avatars').upload(path, photo)
        if (uploadError) throw uploadError
        payload.photo_path = path
      }
      await command('basic_profile', null, payload)
      await cache.invalidateQueries({ queryKey: ['organizations'] })
      await cache.invalidateQueries({ queryKey: ['workspace'] })
      onSaved?.()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <Card title="Basic profile"><p className="muted">Complete your details to join. Your administrator will assign your party, team and role.</p><ErrorBox error={error}/><form onSubmit={save}><Field label="Full name"><input name="name" defaultValue={profile?.name} required minLength={2} maxLength={100}/></Field><Field label="District / region"><input name="district" defaultValue={profile?.district} required minLength={2} maxLength={100}/></Field><Field label="Block / area"><input name="area" defaultValue={profile?.area} required minLength={2} maxLength={100}/></Field><Field label="Profile photo (optional)"><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></Field><p className="muted small">Your mobile number is verified through OTP. No Aadhaar or invitation code is required.</p><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile & continue'}</button></form></Card>
}

export function JoinWorkspace() {
  const { user, loading } = useSession()
  const q = useOrganizations()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const active = q.data?.orgs.filter(o => o.active && (q.data.isPlatform || q.data.members.some(m => m.org_id === o.id && m.active))) || []
  const selected = active.find(o => o.id === localStorage.getItem('command_org')) || (active.length === 1 ? active[0] : null)
  useEffect(() => {
    if (!editing && q.data && !q.data.isAdmin && q.data.profile?.completed && selected) {
      localStorage.setItem('command_org', selected.id); navigate('/home', { replace: true })
    }
  }, [q.data, selected, editing, navigate])
  if (loading || (user && q.isPending)) return <div className="loading-screen">Opening your account…</div>
  if (!user) return <Navigate to="/login" replace/>
  if (q.data?.isAdmin) return <Navigate to="/platform" replace/>
  return <div className="org-page"><div className="topline"><Link className="wordmark" to="/">Leader IQ.in</Link><button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button></div><PageHeading title="Welcome, Karyakarta" description="Join directly. Your administrator will set up your responsibilities."/><ErrorBox error={q.error}/>{!q.error && (!q.data?.profile?.completed || editing ? <BasicProfile profile={q.data?.profile} onSaved={() => setEditing(false)}/> : <><Card title={active.length ? 'Your assigned workspaces' : 'Party/team assignment pending'}><p>{active.length ? 'Open your assigned party. Your dashboard follows the role given by your administrator.' : 'You have joined successfully. An Admin or Super Admin will assign your party, work type and reporting leader. This page updates automatically.'}</p>{active.map(o => <button className="org-option" key={o.id} onClick={() => { localStorage.setItem('command_org', o.id); navigate('/home') }}>{o.name}</button>)}<Badge>Karyakarta</Badge><p>{q.data?.profile?.name} · {q.data?.profile?.district}</p><div className="button-row"><button className="secondary" onClick={() => q.refetch()}>Check assignment</button><button className="ghost" onClick={() => setEditing(true)}>Edit basic profile</button></div></Card></>)}</div>
}

export function AdministrationCenter() {
  const { user, loading } = useSession()
  const q = useOrganizations()
  const cache = useQueryClient()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [orgId, setOrgId] = useState('')
  const [stage, setStage] = useState('5')
  const [search, setSearch] = useState('')
  const directory = useQuery({ queryKey: ['admin-directory',user?.id], enabled: !!q.data?.isAdmin, refetchInterval: 10000, queryFn: () => command('directory') })
  const people = useQuery({ queryKey: ['assignment-people',user?.id,orgId], enabled: !!orgId && !!q.data?.isAdmin, queryFn: async () => { const r=await supabase.from('cmd_members').select('*').eq('org_id',orgId); if(r.error) throw r.error; return r.data } })
  const logs = useQuery({ queryKey: ['admin-logs',user?.id], enabled: !!q.data?.isAdmin, queryFn: async () => { const r=await supabase.from('cmd_audit').select('*').order('created_at',{ascending:false}).limit(50); if(r.error) throw r.error; return r.data } })
  async function run(action, org, payload) {
    setBusy(true); setError(''); setMessage('')
    try { await command(action,org,payload); await cache.invalidateQueries(); setMessage('Saved. The member’s dashboard will update automatically.'); return true } catch(e) { setError(e.message); return false } finally { setBusy(false) }
  }
  if (loading || (user && q.isPending)) return <div className="loading-screen">Opening administration…</div>
  if (!user) return <Navigate to="/login" replace/>
  if (q.error) return <div className="org-page"><ErrorBox error={q.error}/></div>
  if (!q.data?.isAdmin) return <Navigate to="/organizations" replace/>
  const role = q.data.isPlatform ? 'Super Admin' : 'Admin'
  const target = directory.data?.find(x => x.user_id === selectedUser)
  const shown = directory.data?.filter(x => `${x.name} ${x.phone || ''} ${x.district}`.toLowerCase().includes(search.toLowerCase())) || []
  return <div className="org-page"><div className="topline"><Link className="wordmark" to="/">Leader IQ.in</Link><button className="ghost" onClick={() => supabase.auth.signOut()}>Sign out</button></div><PageHeading eyebrow={role} title={`${role} dashboard`} description={q.data.isPlatform ? 'Manage all parties, administrators and the five-level hierarchy.' : 'Manage your parties, new members and their responsibilities.'}/><div className="metric-grid"><Card title="Profile"><Badge>{role}</Badge></Card><Card title="Parties"><strong className="stage-number">{q.data.orgs.length}</strong></Card><Card title="Waiting for assignment"><strong className="stage-number">{directory.data?.filter(x => x.role==='member' && !x.memberships.length && x.completed).length || 0}</strong></Card></div><ErrorBox error={error || directory.error || people.error || logs.error}/>{message && <p className="notice success" role="status">{message}</p>}<div className="two-col"><Card title="Create party / workspace"><form onSubmit={async e => { e.preventDefault(); const form=e.currentTarget; if(await run('create_org',null,Object.fromEntries(new FormData(form)))) form.reset() }}><Field label="Party / organization name"><input name="name" required minLength={2} maxLength={100}/></Field><Field label="Workspace type"><select name="mode"><option value="political">Political Party</option><option value="business">Business / Brand</option></select></Field><button className="primary" disabled={busy}>Create workspace</button></form></Card><Card title="Your parties">{q.data.orgs.map(o => <div className="feed-row" key={o.id}><strong>{o.name}</strong><p>{o.active ? 'Active' : 'Suspended'}</p><OrganizationSettings org={o}/>{q.data.isPlatform && <button className="ghost" disabled={busy} onClick={()=>run('org_settings',o.id,{active:!o.active})}>{o.active ? 'Suspend party' : 'Restore party'}</button>}<Link className="button secondary" to="/home" onClick={() => { cache.removeQueries({queryKey:['workspace']}); localStorage.setItem('command_org',o.id) }}>Open workspace</Link></div>)}{!q.data.orgs.length && <p>Create a party, or ask a Super Admin to assign you to one.</p>}</Card></div><Card title="Members & access"><Field label="Find a user"><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, mobile or district"/></Field><div className="table-scroll"><table><thead><tr><th>Member</th><th>Access</th><th>Assignment</th><th>Manage</th></tr></thead><tbody>{shown.map(p => <tr key={p.user_id}><td><strong>{p.role==='super_admin' ? 'Super Admin' : p.role==='admin' ? 'Admin' : p.name}</strong><small>{p.phone}</small></td><td>{p.role==='member' ? (p.completed ? 'Profile complete' : 'Profile pending') : p.role.replace('_',' ')}</td><td>{p.memberships.map(m => `${q.data.orgs.find(o => o.id===m.org_id)?.name || 'Party'}: ${m.stage == null ? 'Admin' : STAGES[m.stage-1]}${m.stage===5 ? ` · ${m.wing==='social' ? 'Social Media' : 'Ground'}` : ''}`).join(', ') || 'Unassigned'}</td><td><button className="secondary" onClick={() => setSelectedUser(p.user_id)}>Manage</button></td></tr>)}</tbody></table></div></Card>{target && <div className="two-col"><Card title={`Assign: ${target.name}`}><form onSubmit={e => { e.preventDefault(); run('assign_member',orgId,{...Object.fromEntries(new FormData(e.currentTarget)),user_id:selectedUser}) }}><Field label="Party"><select required value={orgId} onChange={e => setOrgId(e.target.value)}><option value="">Choose party</option>{q.data.orgs.filter(o => o.active).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>{target.role==='member' && <><Field label="Hierarchy level"><select name="stage" value={stage} onChange={e=>setStage(e.target.value)}>{STAGES.map((s,i)=><option key={s} value={i+1}>{s}</option>)}</select></Field><Field label="Work type"><select name="wing"><option value="ground">Ground</option><option value="social">Social Media</option></select></Field><Field label="Reporting leader"><select name="manager_id" key={`${orgId}-${stage}`}><option value="">Unassigned / top leadership</option>{people.data?.filter(m=>m.active && m.stage != null && m.stage<Number(stage) && m.user_id!==selectedUser).map(m=><option key={m.user_id} value={m.user_id}>{m.name} · {STAGES[m.stage-1]}</option>)}</select></Field></>}<button className="primary" disabled={busy || !orgId || (target.role==='member' && !target.completed)}>Save party & dashboard assignment</button>{!target.completed && target.role==='member' && <p>Member must complete their basic profile first.</p>}</form></Card>{q.data.isPlatform && <Card title="Super Admin role controls"><p>Administrators are outside the five-level hierarchy. Only a Super Admin can change these permissions.</p><form onSubmit={e=>{e.preventDefault();run('set_global_role',null,{user_id:selectedUser,...Object.fromEntries(new FormData(e.currentTarget))})}}><Field label="Account role"><select key={target.user_id+target.role} name="role" defaultValue={target.role}><option value="member">Member / Karyakarta</option><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></Field><button className="primary" disabled={busy}>Update account role</button></form></Card>}</div>}<Card title="Administration audit">{logs.data?.map(a=><details className="audit-row" key={a.id}><summary>{a.action.replaceAll('_',' ')} · {new Date(a.created_at).toLocaleString('en-IN')}</summary><pre>{JSON.stringify(a.details,null,2)}</pre></details>)}</Card></div>
}
