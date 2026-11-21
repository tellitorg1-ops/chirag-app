export const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
export function required(name: string, settings: Record<string,string> = {}) {
  const value = Deno.env.get(name) || settings[name]
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}
