export default function TickBadge({ type, size = 14 }) {
  if (!type) return null

  const config = {
    blue: {
      bg: '#1D6FED',
      symbol: '✓',
      label: 'Verified Admin',
    },
    gold: {
      bg: '#F59E0B',
      symbol: '✓',
      label: 'Verified Author',
    },
  }

  const c = config[type]
  if (!c) return null

  return (
    <span
      title={c.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: c.bg,
        color: '#fff',
        fontSize: size * 0.6,
        fontWeight: 800,
        marginLeft: 4,
        flexShrink: 0,
        cursor: 'default',
      }}
    >
      {c.symbol}
    </span>
  )
}
