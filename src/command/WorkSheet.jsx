import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useRows, useWorkspace } from './context'
import { command, uploadProof } from './api'
import { Card, PageHeading, Field, Badge, QueryState, Empty, ErrorBox } from './ui'
import { dateTime, indiaDate, safeUrl, SLOTS } from './domain'
import { ProofCard } from './Operations'
import { sheetCsv, pastedWorkRows } from './worksheetData'

function newRow(values = {}) { return { id: crypto.randomUUID(), work: '', note: '', link: '', pulse: '', mood: 'neutral', ...values } }

export function WorkSheetTable({ records = [], members = [], shifts = [], review = false }) {
  const { user } = useWorkspace()
  const [day, setDay] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const names = new Map(members.map(m => [m.user_id,m]))
  const filtered = records.filter(p => (!day || indiaDate(new Date(p.submitted_at)) === day) && (!status || p.status === status) && `${names.get(p.user_id)?.name || ''} ${names.get(p.user_id)?.district || ''} ${p.work} ${p.note || ''}`.toLowerCase().includes(search.toLowerCase()))
  const detail = records.find(p => p.id === selected)
  function download() {
    const csv = sheetCsv([['No.','Submitted (IST)','Member','District / area','Work completed','Evidence note','Proof link','Ground situation','Status','Review note'], ...filtered.map((p,i) => [i+1,dateTime(p.submitted_at),names.get(p.user_id)?.name, [names.get(p.user_id)?.district,names.get(p.user_id)?.area].filter(Boolean).join(' / '),p.work,p.note,p.link,p.pulse,p.status,p.review_note])])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href=url; a.download=`ground-work-sheet-${indiaDate()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000)
  }
  return <Card title={review ? 'Team ground work sheet' : 'Saved work sheet'}><div className="sheet-toolbar"><Field label="Entry date (IST)"><input type="date" value={day} onChange={e=>setDay(e.target.value)}/></Field><Field label="Entry status"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option value="pending">Pending review</option><option value="verified">Verified</option><option value="rejected">Needs correction</option></select></Field><Field label="Search work sheet"><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Work, member or district"/></Field><button className="secondary" disabled={!filtered.length} onClick={download}>Download CSV for Excel</button></div><p className="muted small">{filtered.length} saved rows. {review ? 'Only members in your authorized reporting scope appear here.' : 'Saved rows are visible to your reporting leaders. Verification updates the status and earned points.'}</p><div className="table-scroll work-sheet-scroll" tabIndex={0} role="region" aria-label={review ? 'Team ground work records' : 'My ground work records'}><table className="work-sheet"><thead><tr><th scope="col">#</th><th scope="col">Time (IST)</th>{review && <th scope="col">Member / area</th>}<th scope="col">Work completed</th><th scope="col">Evidence / details</th><th scope="col">Ground situation</th><th scope="col">Status</th><th scope="col">Review / proof</th></tr></thead><tbody>{filtered.map((p,i)=><tr key={p.id}><th scope="row">{i+1}</th><td>{dateTime(p.submitted_at)}</td>{review && <td><strong>{names.get(p.user_id)?.name || 'Member'}</strong><small>{[names.get(p.user_id)?.district,names.get(p.user_id)?.area].filter(Boolean).join(' / ')}</small></td>}<td className="sheet-text">{p.work}</td><td className="sheet-text">{p.note || 'Attached evidence'}{safeUrl(p.link) && <a className="text-link" href={safeUrl(p.link)} target="_blank" rel="noreferrer">Open proof link</a>}{p.photo_path && <small>Photo attached</small>}</td><td className="sheet-text">{p.pulse || 'Routine'}<small>{p.mood}</small></td><td><Badge tone={p.status}>{p.status === 'rejected' ? 'Needs correction' : p.status}</Badge></td><td className="sheet-text">{p.review_note && <small>{p.review_note}</small>}<button className="ghost" onClick={()=>setSelected(p.id)}>{review && p.status==='pending' && p.user_id!==user.id ? 'Review row' : 'View row'}</button></td></tr>)}</tbody></table></div>{!filtered.length && <Empty title="No work rows for this selection">Saved field work will appear here. Clear the filters to see earlier entries.</Empty>}{detail && <section className="sheet-detail" aria-label="Work row details"><div className="spread"><h3>Work row details</h3><button className="ghost" onClick={()=>setSelected(null)}>Close details</button></div><ProofCard proof={detail} name={names.get(detail.user_id)?.name || 'Ground work'} shift={shifts.find(s=>s.id===detail.hazri_id)} review={review && detail.user_id!==user.id}/></section>}</Card>
}

export function WorkSheet() {
  const { org, user, member } = useWorkspace()
  const cache = useQueryClient()
  const shifts = useRows('hazri', { order: 'checked_in', filters: { user_id: user.id } })
  const proofs = useRows('proofs', { order: 'submitted_at', filters: { user_id: user.id, kind: 'diary' } })
  const draftKey = `work-sheet:${org.id}:${user.id}`
  const [drafts, setDrafts] = useState(() => { try { const saved=JSON.parse(sessionStorage.getItem(draftKey)); return Array.isArray(saved)&&saved.length ? saved.slice(0,50).map(row=>newRow(row)) : [newRow()] } catch { return [newRow()] } })
  const [shiftId, setShiftId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [rowErrors, setRowErrors] = useState({})
  const [paste, setPaste] = useState('')
  useEffect(() => { try { sessionStorage.setItem(draftKey,JSON.stringify(drafts.map(({file,...row})=>row))) } catch { /* Saving to the server still works when browser storage is unavailable. */ } }, [draftKey,drafts])
  const activeId = shifts.data?.find(s=>!s.checked_out)?.id || ''
  const chosenShift = shiftId || activeId
  function update(id,key,value) { setDrafts(rows=>rows.map(row=>row.id===id ? {...row,[key]:value} : row)) }
  function addPasted() {
    const rows=pastedWorkRows(paste); if(!rows.length)return
    const existing=drafts.filter(r=>r.work||r.note||r.file||r.link||r.pulse)
    if(existing.length+rows.length>50) { setError('Keep each batch within 50 rows. Your pasted data has not been changed.');return }
    if(rows.some(r=>r.work.length>3000||r.note.length>3000||r.pulse.length>1000)) { setError('A pasted cell is too long. Work/evidence allow 3,000 characters; ground situation allows 1,000.');return }
    setError('');setDrafts([...existing,...rows.map(newRow)]);setPaste('')
  }
  async function save() {
    setError('');setMessage('');setRowErrors({})
    if(!chosenShift) { setError('Check in or select a Hazri shift before saving your work.');return }
    const filled=drafts.filter(r=>r.work.trim()||r.note.trim()||r.link||r.file||r.pulse.trim())
    if(!filled.length) { setError('Write at least one work row.');return }
    const invalid={}
    for(const row of filled) {
      if(row.work.trim().length<5) invalid[row.id]='Describe the work in at least 5 characters.'
      else if(row.link && !safeUrl(row.link)) invalid[row.id]='Use an HTTPS proof link.'
      else if(!row.link && row.note.trim().length<10 && !row.file) invalid[row.id]='Add an evidence note (10+ characters), link or photo.'
    }
    if(Object.keys(invalid).length) { setRowErrors(invalid);setError('Check the highlighted rows. Nothing has been submitted.');return }
    setBusy(true)
    const saved=new Set();const failures={}
    try {
      for(const row of filled) {
        try {
          const photo_path=row.file ? await uploadProof(org.id,user.id,row.file) : null
          await command('proof',org.id,{kind:'diary',hazri_id:chosenShift,work:row.work.trim(),note:row.note.trim(),link:row.link||null,photo_path,mood:row.mood,pulse:row.pulse})
          saved.add(row.id)
        } catch(e) { failures[row.id]=e.message }
      }
      setDrafts(rows=>{const remaining=rows.filter(row=>!saved.has(row.id));return remaining.length ? remaining : [newRow()]})
      setRowErrors(failures)
      setMessage(`${saved.size} work row${saved.size===1?'':'s'} saved for review.`)
      if(Object.keys(failures).length)setError('Some rows could not be saved. Their details are still in the sheet; review the row errors before retrying.')
      await cache.invalidateQueries({queryKey:['workspace',org.id]})
    } finally { setBusy(false) }
  }
  return <><PageHeading eyebrow="GROUND OPERATIONS" title="Ground Work Sheet" description="Keep adding your daily work in rows. Your reporting leaders can view the same saved sheet and review the evidence."/><QueryState queries={[shifts,proofs]}><Card title="Add work rows"><div className="sheet-toolbar"><Field label="Hazri shift for these rows"><select value={chosenShift} onChange={e=>setShiftId(e.target.value)} disabled={busy}><option value="">Choose a shift</option>{shifts.data?.map(s=><option key={s.id} value={s.id}>{dateTime(s.checked_in)} / {SLOTS[s.slot]}{s.checked_out?'':' (active)'}</option>)}</select></Field><Link className="button secondary" to="/hazri">{activeId ? 'Manage shift' : 'Check in'}</Link></div><p className="muted small">Type in the cells and use Tab to move across. Each saved row gets its own time and review status. Drafts stay in this browser tab; they are shared only after saving. Re-select unsaved photo attachments after a refresh.</p><ErrorBox error={error}/>{message && <p className="notice success" role="status">{message}</p>}<div className="table-scroll work-sheet-scroll" tabIndex={0} role="region" aria-label="New ground work rows"><table className="work-sheet sheet-inputs"><thead><tr><th scope="col">#</th><th scope="col">Work completed</th><th scope="col">Evidence note</th><th scope="col">Proof link / photo</th><th scope="col">Ground situation</th><th scope="col">Row</th></tr></thead><tbody>{drafts.map((row,i)=><tr key={row.id} className={rowErrors[row.id]?'sheet-error':''}><th scope="row">{i+1}</th><td><textarea aria-label={`Work completed row ${i+1}`} value={row.work} onChange={e=>update(row.id,'work',e.target.value)} maxLength={3000} disabled={busy} placeholder="What did you do?"/></td><td><textarea aria-label={`Evidence note row ${i+1}`} value={row.note} onChange={e=>update(row.id,'note',e.target.value)} maxLength={3000} disabled={busy} placeholder="Where, what happened and the result"/></td><td><input type="url" aria-label={`Proof link row ${i+1}`} value={row.link} onChange={e=>update(row.id,'link',e.target.value)} disabled={busy} placeholder="https://"/><input type="file" aria-label={`Proof photo row ${i+1}`} accept="image/jpeg,image/png,image/webp" onChange={e=>update(row.id,'file',e.target.files[0])} disabled={busy}/></td><td><select aria-label={`Ground mood row ${i+1}`} value={row.mood} onChange={e=>update(row.id,'mood',e.target.value)} disabled={busy}><option value="neutral">Routine</option><option value="positive">Positive</option><option value="concern">Concern</option><option value="urgent">Urgent</option></select><input aria-label={`Ground situation row ${i+1}`} value={row.pulse} onChange={e=>update(row.id,'pulse',e.target.value)} maxLength={1000} disabled={busy} placeholder="Situation / escalation"/></td><td><button className="ghost" disabled={busy} onClick={()=>setDrafts(rows=>rows.length===1?[newRow()]:rows.filter(r=>r.id!==row.id))} aria-label={`Remove row ${i+1}`}>Remove</button>{rowErrors[row.id] && <p className="alert-text sheet-text" role="alert">{rowErrors[row.id]}</p>}</td></tr>)}</tbody></table></div><div className="button-row sheet-actions"><button className="secondary" disabled={busy||drafts.length>=50} onClick={()=>setDrafts(rows=>[...rows,newRow()])}>Add row</button><button className="primary" disabled={busy} onClick={save}>{busy?'Saving rows…':'Save work rows'}</button></div><details className="sheet-paste"><summary>Paste rows from Excel</summary><p className="muted small">Column order: Work completed, Evidence note, Proof link, Ground situation. Paste data rows without a header (up to 50 rows per batch).</p><textarea aria-label="Paste spreadsheet rows" value={paste} onChange={e=>setPaste(e.target.value)} disabled={busy}/><button className="secondary" disabled={busy||!paste.trim()} onClick={addPasted}>Add pasted rows</button></details></Card><WorkSheetTable records={proofs.data} members={member?[member]:[]} shifts={shifts.data}/></QueryState></>
}
