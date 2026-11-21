import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { command } from './api'
import { useWorkspace } from './context'
export function PageHeading({ eyebrow, title, description, action }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow || 'COMMAND WORKSPACE'}</p><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</div> }
export function Card({ children, className = '', title }) { return <section className={`panel ${className}`}>{title && <h2>{title}</h2>}{children}</section> }
export function Empty({ title = 'Nothing here yet', children }) { return <div className="empty"><span className="empty-symbol">◇</span><h3>{title}</h3><p>{children}</p></div> }
export function Badge({ children, tone = '' }) { return <span className={`badge ${tone}`}>{children}</span> }
export function Field({ label, children, hint }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label> }
export function ErrorBox({ error }) { return error ? <div className="notice danger" role="alert">{error.message || error}</div> : null }
export function QueryState({ queries, children }) {
  const error = queries.find(q => q.error)?.error
  if (error) return <ErrorBox error={error} />
  if (queries.some(q => q.isPending)) return <div className="loading-panel" role="status">Loading workspace data…</div>
  return children
}
export function useAction() {
  const { org } = useWorkspace()
  const cache = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const run = async (action, payload, success = 'Saved successfully') => {
    setBusy(true); setError(''); setMessage('')
    try {
      const data = await command(action, org.id, payload)
      await cache.invalidateQueries({ queryKey: ['workspace', org.id] })
      await cache.invalidateQueries({ queryKey: ['organizations'] })
      setMessage(success); return data
    } catch (e) { setError(e.message); return null } finally { setBusy(false) }
  }
  return { run, busy, error, message, setError }
}
export function Feedback({ action }) { return <><ErrorBox error={action.error} />{action.message && <div className="notice success" role="status">{action.message}</div>}</> }
export function AccessDenied() { return <Empty title="Leadership access required">This view is available to authorized leadership in your organization.</Empty> }
