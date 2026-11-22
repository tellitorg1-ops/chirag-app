import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useRows, useWorkspace } from './context'
import { Card, PageHeading, Field, Empty, Badge, QueryState, useAction, Feedback, AccessDenied, ErrorBox } from './ui'
import { SLOTS, dateTime, safeUrl } from './domain'
import { uploadProof, proofUrl } from './api'

export function Hazri() {
  const { user } = useWorkspace()
  const q = useRows('hazri', { order: 'checked_in', filters: { user_id: user.id } })
  const action = useAction()
  const [slot, setSlot] = useState('subah')
  const active = q.data?.find(s => !s.checked_out)
  return <><PageHeading eyebrow="GROUND OPERATIONS" title="Hazri / attendance" description="Start your shift, record your work, and close the day with proof. Times are recorded by the server in IST." /><Feedback action={action} /><QueryState queries={[q]}><div className="two-col"><Card className="shift-card"><Badge tone={active ? 'verified' : ''}>{active ? 'On duty' : 'Off duty'}</Badge><h2>{active ? 'Your shift is active.' : 'Ready for the ground?'}</h2><p className="muted">{active ? `${SLOTS[active.slot]} · Checked in ${dateTime(active.checked_in)}` : 'Choose a slot and check in when you begin work.'}</p>{!active && <Field label="Shift slot"><select value={slot} onChange={e => setSlot(e.target.value)}>{Object.entries(SLOTS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>}<div className="button-row"><button className="primary" disabled={action.busy} onClick={() => action.run(active ? 'check_out' : 'check_in', { slot }, active ? 'Checked out. Submit your diary for verification.' : 'You are checked in.')}>{active ? 'Check out / Off' : 'Check in'}</button><Link className="button secondary" to="/diary">Write diary</Link></div></Card><Card title="How attendance earns points"><p>Link a diary or task proof to your shift. A leader verifies the evidence.</p><ul className="plain-list"><li>5 Hazri points per verified workday.</li><li>Closed shifts must be between 5 minutes and 16 hours.</li><li>10 Diary points per verified day.</li><li>Check-in alone does not award points.</li></ul></Card></div><Card title="My shift history">{!q.data?.length ? <Empty title="No shifts recorded">Your first check-in will appear here.</Empty> : <div className="table-scroll"><table><thead><tr><th>Slot</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead><tbody>{q.data.map(s => <tr key={s.id}><td>{SLOTS[s.slot]}</td><td>{dateTime(s.checked_in)}</td><td>{dateTime(s.checked_out)}</td><td><Badge tone={!s.checked_out ? 'verified' : ''}>{s.checked_out ? 'Closed' : 'Active'}</Badge></td></tr>)}</tbody></table></div>}</Card></QueryState></>
}
export function ProofForm({ kind, task, shifts, onSuccess }) {
  const { org, user, member } = useWorkspace()
  const socialWorker = member?.wing === 'social'
  const action = useAction()
  const [uploading, setUploading] = useState(false)
  async function submit(e) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const payload = Object.fromEntries(data)
    const file = data.get('photo')
    delete payload.photo
    payload.kind = kind; payload.task_id = task?.id || null
    if (!payload.link && payload.note.trim().length < 10 && !file?.size) { action.setError('Add a photo, an HTTPS proof link, or a field note of at least 10 characters.'); return }
    if (payload.link && !safeUrl(payload.link)) { action.setError('Proof links must start with https://'); return }
    setUploading(true)
    try {
      if (file?.size) payload.photo_path = await uploadProof(org.id, user.id, file)
      const result = await action.run('proof', payload, 'Proof submitted for verification. Points are awarded after approval.')
      if (result) { form.reset(); onSuccess?.() }
    } catch (err) { action.setError(err.message) } finally { setUploading(false) }
  }
  return <form onSubmit={submit}><Feedback action={action} /><Field label={kind === 'diary' ? 'What work did you do?' : 'What did you complete?'}><textarea name="work" minLength={5} maxLength={3000} required placeholder="Briefly describe the action and outcome…" /></Field>{!socialWorker && <Field label={kind === 'diary' ? 'Linked Hazri shift (required)' : 'Linked Hazri shift (optional)'}><select name="hazri_id" required={kind === 'diary'} defaultValue={shifts?.find(s => !s.checked_out)?.id || ''}><option value="">Select a shift</option>{shifts?.map(s => <option key={s.id} value={s.id}>{SLOTS[s.slot]} · {dateTime(s.checked_in)} {s.checked_out ? '(closed)' : '(active)'}</option>)}</select></Field>}<div className="form-grid"><Field label="Proof link"><input name="link" type="url" placeholder="https://…" /></Field><Field label="Proof photo" hint="JPG, PNG, WebP · up to 5 MB"><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" /></Field></div><Field label={socialWorker ? "Post / campaign evidence" : "Field note / evidence"} hint="At least one photo, link or detailed field note is required."><textarea name="note" maxLength={3000} placeholder="Where, what happened, and the result…" /></Field>{!socialWorker && <div className="form-grid"><Field label="Ground pulse / mahaul"><select name="mood"><option value="neutral">Neutral / routine</option><option value="positive">Positive</option><option value="concern">Concern</option><option value="urgent">Urgent issue</option></select></Field><Field label="Situation / escalation"><input name="pulse" maxLength={1000} placeholder="Brief local situation, if relevant" /></Field></div>}<p className="muted small">Submission time is recorded automatically. Your leadership can view and verify this report.</p><button className="primary" disabled={action.busy || uploading}>{uploading ? 'Submitting…' : 'Submit for verification'}</button></form>
}
export function Diary() {
  const { user } = useWorkspace()
  const shifts = useRows('hazri', { order: 'checked_in', filters: { user_id: user.id } })
  const proofs = useRows('proofs', { order: 'submitted_at', filters: { user_id: user.id, kind: 'diary' } })
  return <><PageHeading eyebrow="DAILY FIELD REPORT" title="Your work, on record." description="Action, evidence, timing and ground pulse — one concise entry." /><QueryState queries={[shifts,proofs]}><div className="two-col"><Card title="New diary entry">{shifts.data?.length ? <ProofForm kind="diary" shifts={shifts.data} /> : <Empty title="Check in first"><Link to="/hazri">Start a Hazri shift</Link> to link your diary to attendance.</Empty>}</Card><Card title="My diary">{!proofs.data?.length && <Empty title="Your diary starts here">Verified entries build your progress and keep leadership informed.</Empty>}{proofs.data?.map(p => <ProofCard key={p.id} proof={p} />)}</Card></div></QueryState></>
}
export function Tasks() {
  const { user, isLeader, isManager } = useWorkspace()
  const members = useRows('members', {order:'name'})
  const [params] = useSearchParams()
  const q = useRows('tasks')
  const proofs = useRows('proofs', { order: 'submitted_at', filters: isLeader ? { kind: 'task' } : { user_id: user.id, kind: 'task' } })
  const shifts = useRows('hazri', { order: 'checked_in', filters: { user_id: user.id } })
  const [selected, setSelected] = useState(null)
  const action = useAction()
  const [closed, setClosed] = useState(false)
  const data = q.data?.filter(t => (closed ? !t.active : t.active) && (!params.get('campaign') || t.campaign_id === params.get('campaign')))
  return <><PageHeading title={isLeader ? "Task monitoring" : "Tasks & verified execution"} description={isLeader ? "Track who issued each task, its recipient and the team�s submitted evidence." : "Complete your assigned work and submit evidence for independent verification."} action={isLeader && <Link className="button primary" to="/content">Create task</Link>} /><Feedback action={action} /><div className="tabs"><button className={!closed ? "selected" : ""} onClick={() => setClosed(false)}>Active tasks</button><button className={closed ? "selected" : ""} onClick={() => setClosed(true)}>Closed tasks</button></div><QueryState queries={[q,proofs,shifts]}>{!isLeader && selected && <Card title={`Submit proof · ${selected.title}`}><button className="ghost" onClick={() => setSelected(null)}>Close form</button><ProofForm kind="task" task={selected} shifts={shifts.data} onSuccess={() => setSelected(null)} /></Card>}<div className="card-grid">{data?.map(t => {
    const latest = proofs.data?.find(p => p.task_id === t.id)
    const mine = !isLeader && (!t.assigned_to || t.assigned_to === user.id)
    return <Card key={t.id}><div className="spread"><Badge>{t.target_wing==='social' ? 'Social Media' : t.target_wing==='ground' ? 'Ground' : 'Shared assignment'}</Badge><strong className="points">+{t.points} pts</strong></div><h2>{t.title}</h2><p className="muted">{t.instructions || 'Complete the assignment and submit evidence for review.'}</p><p className="small muted">Due: {dateTime(t.due_at)}</p><p className="small">Issued by: {members.data?.find(m=>m.user_id===t.created_by)?.name || 'Leadership'}<br/>Assigned to: {t.assigned_to ? members.data?.find(m=>m.user_id===t.assigned_to)?.name || 'Assigned member' : (t.target_wing || 'all') + ' team'}</p>{isLeader && <p className="small">Submissions: {proofs.data?.filter(p=>p.task_id===t.id).length || 0} � Pending: {proofs.data?.filter(p=>p.task_id===t.id&&p.status==='pending').length || 0} � Verified: {proofs.data?.filter(p=>p.task_id===t.id&&p.status==='verified').length || 0}</p>}{!isLeader && latest && <div className="task-status"><Badge tone={latest.status}>{latest.status}</Badge>{latest.review_note && <p>{latest.review_note}</p>}</div>}{!isLeader && <button className="secondary" disabled={!t.active || !mine || latest?.status === 'pending' || latest?.status === 'verified' || (!!t.due_at && new Date(t.due_at)<new Date())} onClick={() => setSelected(t)}>{!mine ? 'Assigned to team member' : latest?.status === 'verified' ? 'Verified & awarded' : latest?.status === 'pending' ? 'Awaiting verification' : latest?.status === 'rejected' ? 'Resubmit proof' : 'Submit proof'}</button>}{isLeader && (isManager || t.created_by === user.id) && <button className="ghost" disabled={action.busy} onClick={() => action.run('task_status', { id: t.id, active: !t.active }, t.active ? 'Task closed.' : 'Task reopened.')}>{t.active ? 'Close task' : 'Reopen task'}</button>}</Card>
  })}</div>{!data?.length && <Empty title="No active tasks">New assignments from leadership will appear here.</Empty>}</QueryState></>
}
export function ProofCard({ proof: p, name, review = false, shift }) {
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const action = useAction()
  async function openPhoto() { try { setImage(await proofUrl(p.photo_path)) } catch (e) { setError(e.message) } }
  async function submit(e) { e.preventDefault(); const d = new FormData(e.currentTarget); await action.run('review', { id: p.id, status: e.nativeEvent.submitter.value, note: d.get('note') }, 'Review recorded.') }
  return <article className="proof-card"><div className="spread"><strong>{name || p.kind.toUpperCase()}</strong><Badge tone={p.status}>{p.status}</Badge></div><p>{p.work}</p>{shift && <p className="notice">{SLOTS[shift.slot]}: {dateTime(shift.checked_in)} / {shift.checked_out ? dateTime(shift.checked_out) : "Still on duty"}</p>}<p className="muted small">{dateTime(p.submitted_at)} · {p.mood}</p>{p.note && <blockquote>{p.note}</blockquote>}{p.pulse && <p className={p.mood === 'urgent' ? 'alert-text' : ''}>Ground pulse: {p.pulse}</p>}<div className="button-row">{safeUrl(p.link) && <a href={safeUrl(p.link)} target="_blank" rel="noreferrer" className="text-link">Open proof link</a>}{p.photo_path && <button className="ghost" onClick={openPhoto}>View private photo</button>}</div>{image && <img className="proof-image" src={image} alt="Submitted work evidence" />}{p.review_note && <p className="notice">Reviewer: {p.review_note}</p>}<ErrorBox error={error} />{review && p.status === 'pending' && <form onSubmit={submit}><Feedback action={action} /><Field label="Review note"><input name="note" required minLength={3} placeholder="Evidence checked / reason for rejection" /></Field><div className="button-row"><button className="primary" value="verified" disabled={action.busy}>Verify & award</button><button className="danger-button" value="rejected" disabled={action.busy}>Reject</button></div></form>}</article>
}
export function Reviews() {
  const { isLeader, user } = useWorkspace()
  const q = useRows('proofs', { order: 'submitted_at' })
  const members = useRows('members', { order: 'name' })
  const shifts = useRows('hazri', { order: 'checked_in' })
  const [filter, setFilter] = useState('pending')
  if (!isLeader) return <AccessDenied />
  const data = q.data?.filter(p => p.status === filter && p.user_id !== user.id)
  return <><PageHeading eyebrow="TEAM LEADERSHIP" title="Verification desk" description="Review evidence from your reporting chain. Self-approval is not allowed." /><div className="tabs">{['pending','verified','rejected'].map(f => <button key={f} className={f === filter ? 'selected' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div><QueryState queries={[q,members,shifts]}><div className="card-grid">{data?.map(p => <Card key={p.id}><ProofCard proof={p} name={members.data?.find(m => m.user_id === p.user_id)?.name} shift={shifts.data?.find(s => s.id === p.hazri_id)} review /></Card>)}</div>{!data?.length && <Empty title={`No ${filter} proofs`}>Your team’s submitted work will appear here.</Empty>}</QueryState></>
}
