import { useState } from 'react'
import { useRows } from './context'
import { Card, Field, Badge, QueryState, Empty } from './ui'
import { dateTime, indiaDate, SLOTS } from './domain'

export function TeamReport() {
  const shifts = useRows('hazri', { order: 'checked_in' })
  const proofs = useRows('proofs', { order: 'submitted_at' })
  const members = useRows('members', { order: 'name' })
  const [date, setDate] = useState(indiaDate())
  const [district, setDistrict] = useState('')
  const memberMap = new Map(members.data?.map(m => [m.user_id, m]))
  const visible = shifts.data?.filter(s => (!date || indiaDate(new Date(s.checked_in)) === date) && (!district || memberMap.get(s.user_id)?.district === district)) || []
  return <Card title="Team attendance & daily reporting">
    <p className="muted">Shift timings, verified work and local situation roll up through your reporting chain. Only your authorized scope is shown.</p>
    <div className="form-grid">
      <Field label="Workday (IST)"><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="District / region"><select value={district} onChange={e => setDistrict(e.target.value)}><option value="">All districts in my scope</option>{[...new Set(members.data?.map(m => m.district).filter(Boolean))].map(d => <option key={d}>{d}</option>)}</select></Field>
    </div>
    <QueryState queries={[shifts, proofs, members]}>
      <div className="table-scroll"><table><thead><tr><th>Member / district</th><th>Slot</th><th>Check-in (IST)</th><th>Check-out (IST)</th><th>Evidence</th></tr></thead><tbody>
        {visible.map(s => {
          const evidence = proofs.data?.filter(p => p.hazri_id === s.id) || []
          return <tr key={s.id}><td><strong>{memberMap.get(s.user_id)?.name || 'Member'}</strong><small>{memberMap.get(s.user_id)?.district || '—'}</small></td><td>{SLOTS[s.slot]}</td><td>{dateTime(s.checked_in)}</td><td>{s.checked_out ? dateTime(s.checked_out) : <Badge tone="verified">On duty</Badge>}</td><td>{evidence.filter(p => p.status === 'verified').length} verified / {evidence.length} submitted</td></tr>
        })}
      </tbody></table></div>
      {!visible.length && <Empty title="No shifts for this selection">Check another workday or district.</Empty>}
      {visible.flatMap(s => (proofs.data?.filter(p => p.hazri_id === s.id) || []).map(p => <details key={p.id} className="audit-row"><summary><strong>{memberMap.get(p.user_id)?.name || 'Member'} · {p.kind}</strong><Badge tone={p.mood === 'urgent' ? 'rejected' : p.mood === 'concern' ? 'pending' : p.status}>{p.mood} · {p.status}</Badge></summary><p>{p.work}</p>{p.pulse && <p>Ground pulse: {p.pulse}</p>}<small>{dateTime(p.submitted_at)}</small></details>))}
    </QueryState>
  </Card>
}
