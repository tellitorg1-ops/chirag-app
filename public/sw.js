// Push-only worker: authenticated pages/API responses are never cached.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() || {} } catch { data = { title: 'Organization update' } }
  event.waitUntil(self.registration.showNotification(data.title || 'Leader IQ.in', {
    body: data.body || 'Open your workspace to view the update.',
    icon: '/command-icon.svg', badge: '/command-icon.svg',
    tag: data.id || 'command-update', data: { org_id: data.org_id },
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  // Always return through organization selection: never silently cross tenant contexts.
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const target = clients.find(c => new URL(c.url).origin === self.location.origin)
    if (target) { await target.navigate('/organizations'); return target.focus() }
    return self.clients.openWindow('/organizations')
  }))
})
