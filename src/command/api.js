import { supabase } from '../lib/supabase'
export async function command(action, orgId, payload = {}) {
  const { data, error } = await supabase.rpc('cmd_execute', { action, org_id: orgId || null, payload })
  if (error) throw new Error(error.message)
  return data
}
export async function rows(table, orgId, { order = 'created_at', ascending = false, filters = {} } = {}) {
  if (!orgId) throw new Error('Choose an organization first')
  const result = []
  for (let offset = 0; ; offset += 500) {
    let q = supabase.from(`cmd_${table}`).select('*').eq('org_id', orgId)
    for (const [key, value] of Object.entries(filters)) q = q.eq(key, value)
    if (order) q = q.order(order, { ascending })
    const { data, error } = await q.range(offset, offset + 499)
    if (error) throw new Error(error.message)
    result.push(...(data || []))
    if (!data || data.length < 500) return result
  }
}
export async function uploadProof(orgId, userId, file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Use a JPG, PNG or WebP image under 5 MB.')
  const path = `${orgId}/${userId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`
  const { error } = await supabase.storage.from('command-proofs').upload(path, file)
  if (error) throw new Error(error.message)
  return path
}
export async function proofUrl(path) {
  const { data, error } = await supabase.storage.from('command-proofs').createSignedUrl(path, 120)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
