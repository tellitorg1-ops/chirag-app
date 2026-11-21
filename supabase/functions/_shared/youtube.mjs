export function channelSelector(input) {
  const url = new URL(input)
  if (url.protocol !== 'https:' || !['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)) throw new Error('Use a valid HTTPS YouTube channel URL.')
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0]?.startsWith('@') && /^@[\p{L}\p{N}_.-]+$/u.test(parts[0])) return { forHandle: parts[0] }
  if (parts[0] === 'channel' && /^UC[A-Za-z0-9_-]{22}$/.test(parts[1] || '')) return { id: parts[1] }
  throw new Error('Use a channel URL containing /@handle or /channel/UC…; video URLs are not supported.')
}
export function allowedPushEndpoint(endpoint) {
  try {
    const u = new URL(endpoint)
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false
    return ['fcm.googleapis.com','updates.push.services.mozilla.com','updates-autopush.stage.mozaws.net','web.push.apple.com'].includes(u.hostname)
      || u.hostname.endsWith('.notify.windows.com') || u.hostname.endsWith('.push.apple.com')
  } catch { return false }
}
