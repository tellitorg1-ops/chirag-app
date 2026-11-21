export const STAGES = ['Main Leader', 'Subordinates', 'District Leadership', 'Team Leadership', 'Ground Karyakarta Teams']
export const BUSINESS_STAGES = ['Executive Command', 'Regional Leadership', 'District / Area Leadership', 'Team Leadership', 'Field & Digital Teams']
export const GRADES = [{ name: 'Sparsh', min: 0 }, { name: 'Sankalp', min: 250 }, { name: 'Uday', min: 1000 }, { name: 'Ojas', min: 2500 }, { name: 'Tejas', min: 5000 }]
export const SLOTS = { subah: 'Subah · Morning', daytime: 'Daytime · Afternoon', shaam: 'Shaam · Evening', active: 'Active shift' }
export function gradeProgress(points = 0) {
  const current = [...GRADES].reverse().find(g => points >= g.min) || GRADES[0]
  const next = GRADES[GRADES.indexOf(current) + 1]
  return { current: current.name, next: next?.name, remaining: next ? Math.max(0, next.min - points) : 0, percent: next ? Math.min(100, (points - current.min) / (next.min - current.min) * 100) : 100 }
}
export function indiaDate(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) }
export function dateTime(value) { return value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—' }
export function safeUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null } catch { return null } }
export function verifiedStreak(proofs, now = new Date()) {
  const days = new Set(proofs.filter(p => p.status === 'verified' && p.submitted_at).map(p => indiaDate(new Date(p.submitted_at))))
  let day = new Date(`${indiaDate(now)}T00:00:00+05:30`)
  if (!days.has(indiaDate(day))) day = new Date(day.getTime() - 86400000)
  let streak = 0
  while (days.has(indiaDate(day))) { streak++; day = new Date(day.getTime() - 86400000) }
  return streak
}
export function statusPrompts({ proofs = [], shifts = [], points = 0 }) {
  const pending = proofs.filter(p => p.status === 'pending').length
  const rejected = proofs.filter(p => p.status === 'rejected').length
  const active = shifts.find(s => !s.checked_out)
  const grade = gradeProgress(points)
  const prompts = []
  const streak = verifiedStreak(proofs)
  if (streak) prompts.push(`${streak}-day verified work streak. Keep recording evidence for each workday.`)
  if (active) prompts.push('Your shift is active. Add a diary entry and check out when your work is complete.')
  if (pending) prompts.push(`${pending} proof${pending === 1 ? '' : 's'} awaiting verification. Points appear after approval.`)
  if (rejected) prompts.push(`${rejected} submission${rejected === 1 ? '' : 's'} need attention. Read reviewer feedback before resubmitting.`)
  prompts.push(grade.next ? `${grade.remaining.toLocaleString('en-IN')} verified points to reach ${grade.next} in this cycle.` : 'Tejas achieved in this cycle. Your verified points continue counting toward rewards.')
  return prompts
}
