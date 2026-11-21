import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useRows, useWorkspace } from './context'
import { command } from './api'
import { supabase } from '../lib/supabase'
import { PageHeading, Card, Field, Badge, QueryState, Empty, Feedback, ErrorBox, useAction, AccessDenied } from './ui'
import { dateTime } from './domain'
import { OrganizationSettings } from './OrganizationSettings'
import { TeamReport } from './TeamReport'

export function Hierarchy() {
  const { isLeader, isManager, isPlatform, stageNames, user } = useWorkspace()
  const members = useRows('members', { order: 'name' })
  const teams = useRows('teams', { order: 'name' })
  const audits = useRows('audit')
  const action = useAction()
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState(5)
  const [moveType, setMoveType] = useState('move')
  const [invitation, setInvitation] = useState('')
  if (!isLeader) return <AccessDenied />
  async function submit(e, type) {
    e.preventDefault(); const form = e.currentTarget; const payload = Object.fromEntries(new FormData(form))
    const result = await action.run(type, payload)
    if (result) form.reset()
  }
  const shown = members.data?.filter(m => `${m.name} ${m.district} ${m.area}`.toLowerCase().includes(search.toLowerCase())) || []
  return <><PageHeading eyebrow="PEOPLE & CHAIN OF COMMAND" title="Every person. A clear role." description="New members enter the ground pool. Authorized administrators assign stages and reporting lines." /><Feedback action={action} /><QueryState queries={[members,teams]}><div className="stage-grid">{stageNames.map((name,i) => <Card key={name}><p className="eyebrow">LEVEL {i+1}</p><strong className="stage-number">{members.data?.filter(m => m.stage === i+1 && m.active).length}</strong><h3>{name}</h3></Card>)}</div><Card title="People in your reporting scope"><Field label="Find a member"><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, district or area" /></Field><div className="table-scroll"><table><thead><tr><th>Member</th><th>Stage</th><th>Reporting to</th><th>District / team</th><th>Access</th></tr></thead><tbody>{shown.map(m => <tr key={m.user_id}><td><strong>{m.name}</strong><small>{m.area}</small></td><td>{m.stage == null ? 'Admin' : stageNames[m.stage-1]}</td><td>{members.data?.find(x => x.user_id === m.manager_id)?.name || (m.manager_id ? 'Higher leadership' : 'Unassigned / top command')}</td><td>{m.district || '—'}<small>{teams.data?.find(t => t.id === m.team_id)?.name || 'Ground / social pool'}</small></td><td><Badge tone={m.active ? 'verified' : 'rejected'}>{m.active ? (m.can_manage ? 'Org admin' : 'Active') : 'Suspended'}</Badge></td></tr>)}</tbody></table></div>{!shown.length && <Empty title="No matching members" />}</Card><TeamReport />{isManager && <div className="two-col"><Card title="Stage movement"><p className="muted">Moves are recorded in the audit trail. Managers must be above their reports; existing reports may need reassignment first.</p><form onSubmit={e => submit(e,moveType)}><Field label="Move a member or whole team"><select value={moveType} onChange={e => setMoveType(e.target.value)}><option value="move">Individual member</option><option value="move_team">Entire team</option></select></Field>{moveType === 'move' && <Field label="Member"><select name="user_id" required><option value="">Choose a member</option>{members.data?.filter(m => m.stage != null).map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select></Field>}<Field label={moveType === 'move_team' ? 'Team to move' : 'Assign to team (optional)'}><select name="team_id" required={moveType === 'move_team'}><option value="">{moveType === 'move_team' ? 'Choose a team' : 'Keep current team'}</option>{teams.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><Field label="Destination stage"><select name="stage" value={stage} onChange={e => setStage(Number(e.target.value))}>{stageNames.map((n,i) => <option key={n} value={i+1}>{i+1} · {n}</option>)}</select></Field><Field label="Reporting manager"><select name="manager_id" key={stage}><option value="">Unassigned / top command</option>{members.data?.filter(m => m.stage != null && m.stage<stage && m.active).map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select></Field><Field label="Reason for movement"><textarea name="reason" required minLength={5} maxLength={1000} placeholder="Performance, new responsibility or team restructuring" /></Field><button className="primary" disabled={action.busy}>Save assignment & audit</button></form></Card><div><Card title="Assign new members"><p>Members join directly and complete their basic profile. Assign party, work type and hierarchy from your administration dashboard.</p><Link className="button primary" to="/platform">Open member assignments</Link></Card><Card title="Create a team"><form onSubmit={e => submit(e,'team')}><Field label="Team name"><input name="name" minLength={2} maxLength={100} required /></Field><button className="secondary" disabled={action.busy}>Create team</button></form></Card></div></div>}{isManager && <Card title="Organization audit trail"><QueryState queries={[audits]}>{!audits.data?.length && <Empty title="No changes recorded yet" />}{audits.data?.map(a => <details className="audit-row" key={a.id}><summary><strong>{a.action.replaceAll('_',' ')}</strong><span>{dateTime(a.created_at)}</span></summary><p>Actor: {members.data?.find(m => m.user_id === a.actor_id)?.name || a.actor_id}</p><pre>{JSON.stringify(a.details,null,2)}</pre></details>)}</QueryState></Card>}</QueryState></>
}
export function Broadcast() {
  const { isLeader } = useWorkspace()
  const history = useRows('broadcasts')
  const members = useRows('members', { order: 'name' })
  const action = useAction()
  if (!isLeader) return <AccessDenied />
  async function send(e) { e.preventDefault(); const form=e.currentTarget; if(await action.run('broadcast',Object.fromEntries(new FormData(form)),'Broadcast saved. In-app notices created and off-app delivery queued.')) form.reset() }
  return <><PageHeading title="Broadcast to your team" description="Mandatory in-app updates and background push delivery for your authorized reporting scope." /><Feedback action={action} /><div className="two-col"><Card title="New announcement"><form onSubmit={send}><Field label="Title"><input name="title" required minLength={2} maxLength={150} /></Field><Field label="Message"><textarea name="body" required minLength={3} maxLength={3000} /></Field><Field label="District filter"><select name="district"><option value="">All districts in my scope</option>{[...new Set(members.data?.map(m=>m.district).filter(Boolean))].map(d=><option key={d}>{d}</option>)}</select></Field><p className="muted small">Recipients are checked on the server. Push delivery requires a registered device and notification permission.</p><button className="primary" disabled={action.busy}>Send announcement</button></form></Card><Card title="Broadcast history"><QueryState queries={[history]}>{history.data?.map(b=><article className="feed-row" key={b.id}><h3>{b.title}</h3><p className="preserve-lines">{b.body}</p><small className="muted">{dateTime(b.created_at)} · {b.district || 'All districts in scope'}</small></article>)}{!history.data?.length && <Empty title="No broadcasts yet" />}</QueryState></Card></div></>
}
