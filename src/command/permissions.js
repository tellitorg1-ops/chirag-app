export function workspaceCapabilities({ isAdmin = false, isLeader = false, member }) {
  const worker = !isAdmin && member?.stage === 5
  const ground = worker && member?.wing !== 'social'
  const social = worker && member?.wing === 'social'
  return { worker, ground, social, supervise: isAdmin || isLeader }
}
export function allowedWorkspacePath(path, access) {
  if (['/home','/tasks','/content','/leaderboard','/notifications','/profile'].includes(path)) return true
  if (['/hazri','/diary'].includes(path)) return access.ground
  if (path === '/analytics') return access.social || access.supervise
  if (['/reviews','/hierarchy','/broadcast','/reports'].includes(path)) return access.supervise
  return false
}
