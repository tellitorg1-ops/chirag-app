import { createClient } from 'npm:@supabase/supabase-js@2.106.2'
import webpush from 'npm:web-push@3.6.7'
import { json, required } from '../_shared/http.ts'
import { allowedPushEndpoint } from '../_shared/youtube.mjs'

// Invoke every minute from a trusted scheduler with a dedicated bearer secret.
// Notifications/outbox are committed together; the browser never invokes delivery.
Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405)
  try {
    const server = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
    const { data: settings, error: configError } = await server.rpc('cmd_runtime_settings')
    if (configError) throw configError
    if (request.headers.get('Authorization') !== `Bearer ${required('PUSH_DISPATCH_SECRET',settings || {})}`) return json({ error: 'Unauthorized' }, 401)
    webpush.setVapidDetails(required('VAPID_SUBJECT',settings), required('VAPID_PUBLIC_KEY',settings), required('VAPID_PRIVATE_KEY',settings))
    const { data: jobs, error } = await server.rpc('cmd_claim_push')
    if (error) throw error
    let delivered = 0
    for (const job of jobs || []) {
      const { data: member, error: memberError } = await server.from('cmd_members').select('active').eq('org_id', job.org_id).eq('user_id', job.user_id).single()
      const { data: org, error: orgError } = await server.from('cmd_orgs').select('active').eq('id', job.org_id).single()
      if (memberError || orgError) throw new Error('Unable to check delivery authorization')
      if (!member?.active || !org?.active) {
        await server.from('cmd_push_outbox').update({ delivered_at: new Date().toISOString(), last_error: 'Suppressed: inactive membership or organization', locked_until: null }).eq('id', job.id)
        continue
      }
      const { data: subscriptions, error: subError } = await server.from('cmd_push_subscriptions').select('endpoint,subscription').eq('org_id', job.org_id).eq('user_id', job.user_id)
      if (subError) throw subError
      let failures = 0
      for (const sub of subscriptions || []) {
        if (!allowedPushEndpoint(sub.endpoint)) { failures++; continue }
        try {
          // Keep sensitive campaign/ground details off lock screens.
          await webpush.sendNotification(sub.subscription, JSON.stringify({ id: job.notification_id, org_id: job.org_id, title: 'Leader IQ.in update', body: 'You have a new organization update. Open your workspace to view it.' }), { TTL: 86400, timeout: 10000 })
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) await server.from('cmd_push_subscriptions').delete().eq('org_id', job.org_id).eq('user_id', job.user_id).eq('endpoint', sub.endpoint)
          else failures++
        }
      }
      if (!subscriptions?.length || failures) {
        const { error: retryError } = await server.from('cmd_push_outbox').update({ locked_until: null, available_at: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts)).toISOString(), last_error: subscriptions?.length ? 'One or more devices could not be reached' : 'No registered push device' }).eq('id', job.id)
        if (retryError) throw retryError
      } else {
        const { error: doneError } = await server.from('cmd_push_outbox').update({ delivered_at: new Date().toISOString(), locked_until: null, last_error: null }).eq('id', job.id)
        if (doneError) throw doneError
        delivered++
      }
    }
    return json({ processed: jobs?.length || 0, delivered })
  } catch { return json({ error: 'Push dispatcher failed. Check server configuration and outbox status.' }, 500) }
})
