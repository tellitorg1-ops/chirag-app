import { command } from './api'
export async function enablePush(orgId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Use a browser that supports push. On iPhone/iPad, add this app to your Home Screen and open it there.')
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!key) throw new Error('Push delivery is not configured. Your administrator must configure the public push key.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Enable notifications for this site in your browser or device settings, then return here.')
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const padding = '='.repeat((4 - key.length % 4) % 4)
    const raw = atob((key + padding).replace(/-/g, '+').replace(/_/g, '/'))
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, c => c.charCodeAt(0)) })
  }
  await command('subscribe', orgId, { subscription: subscription.toJSON() })
  return subscription
}
export async function detachDevice(orgId) {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    try { await command('unsubscribe_device', orgId, { endpoint: subscription.endpoint }) }
    finally { await subscription.unsubscribe() }
  }
}
