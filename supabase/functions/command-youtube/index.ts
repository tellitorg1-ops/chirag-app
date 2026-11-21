import { createClient } from 'npm:@supabase/supabase-js@2.106.2'
import { cors, json, required } from '../_shared/http.ts'
import { channelSelector } from '../_shared/youtube.mjs'

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'POST required' }, 405)
  try {
    const authorization = request.headers.get('Authorization') || ''
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Sign in required' }, 401)
    const url = required('SUPABASE_URL')
    const server = createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
    const client = createClient(url, required('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user) return json({ error: 'Invalid session' }, 401)
    const { org_id } = await request.json()
    if (!/^[0-9a-f-]{36}$/i.test(org_id || '')) return json({ error: 'Organization required' }, 400)
    // RLS checks membership and organization activity with the caller's JWT.
    const { data: account, error: accountError } = await client.from('cmd_social').select('url,verified').eq('org_id', org_id).eq('user_id', user.id).eq('platform', 'youtube').maybeSingle()
    if (accountError || !account?.verified) return json({ error: 'A verified YouTube account in this organization is required.' }, 403)
    const { data: previous, error: previousError } = await client.from('cmd_social_snapshots').select('captured_at').eq('org_id', org_id).eq('user_id', user.id).order('captured_at', { ascending: false }).limit(1).maybeSingle()
    if (previousError) return json({ error: 'Unable to check synchronization history.' }, 503)
    if (previous && Date.now() - new Date(previous.captured_at).getTime() < 300000) return json({ error: 'Wait five minutes between syncs.' }, 429)
    const { data: settings, error: configError } = await server.rpc('cmd_runtime_settings')
    if (configError) return json({ error: 'Server configuration is not available.' }, 503)
    const params = new URLSearchParams({ part: 'statistics,snippet', ...channelSelector(account.url), key: required('YOUTUBE_API_KEY', settings || {}) })
    const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`, { signal: AbortSignal.timeout(15000) })
    const result = await response.json()
    if (!response.ok || result.error) return json({ error: 'YouTube could not complete this sync. Existing points and snapshots are unchanged.' }, 502)
    const channel = result.items?.[0]
    if (!channel?.statistics) return json({ error: 'Channel not found. Check the saved channel URL.' }, 404)
    const { error } = await server.rpc('cmd_ingest_youtube', {
      o: org_id, u: user.id, channel: channel.id,
      views: Number(channel.statistics.viewCount || 0), subscribers: Number(channel.statistics.subscriberCount || 0), videos: Number(channel.statistics.videoCount || 0),
    })
    if (error) return json({ error: error.message }, 409)
    return json({ ok: true, channel: channel.snippet.title })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    return json({ error: message.startsWith('Missing server configuration') ? 'YouTube sync is not configured by the administrator yet.' : message }, 400)
  }
})
