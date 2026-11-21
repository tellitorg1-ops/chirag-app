import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { command } from './api'
import { Field, ErrorBox } from './ui'
export function OrganizationSettings({ org }) {
  const cache = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false)
    try {
      await command('org_settings', org.id, Object.fromEntries(new FormData(event.currentTarget)))
      await cache.invalidateQueries({ queryKey: ['organizations'] })
      await cache.invalidateQueries({ queryKey: ['platform-audit'] })
      setSaved(true)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <details className="org-settings"><summary>Organization name & rewards</summary><form onSubmit={submit}>
    <Field label="Organization name"><input name="name" defaultValue={org.name} required minLength={2} maxLength={100} /></Field>
    <Field label="Monthly reward"><input name="monthly_reward" defaultValue={org.monthly_reward} required maxLength={150} /></Field>
    <Field label="4-month big reward"><input name="grand_reward" defaultValue={org.grand_reward} required maxLength={150} /></Field>
    <ErrorBox error={error} />{saved && <p className="notice success">Organization settings saved.</p>}
    <button className="secondary" disabled={busy}>Save organization settings</button>
  </form></details>
}
