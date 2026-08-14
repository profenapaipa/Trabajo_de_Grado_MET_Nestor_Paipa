type CubeAction = 'pausar' | 'pensar' | 'actuar'

const ACTION_META: Record<CubeAction, {
  bg: string; textColor: string; icon: string
  vibLabel: string; vibLevel: number; soundLabel: string
}> = {
  pausar: {
    bg: '#00008c',      textColor: '#fff',
    icon: '⏸',
    vibLabel: '20%',    vibLevel: 0.20,
    soundLabel: '250Hz',
  },
  pensar: {
    bg: '#e6e600',      textColor: '#1a1a00',
    icon: '💡',
    vibLabel: '50%',    vibLevel: 0.50,
    soundLabel: '600Hz',
  },
  actuar: {
    bg: '#00cc44',      textColor: '#001a0a',
    icon: '⚡',
    vibLabel: '80%',    vibLevel: 0.80,
    soundLabel: '↑1kHz',
  },
}

const VIB_HEIGHTS = [0.5, 0.9, 0.6, 1.0, 0.7]

function Cube({
  id,
  color,
  isSelected,
  action,
  onSelect,
}: {
  id: number
  color: string
  isSelected: boolean
  action?: CubeAction
  onSelect: (id: number) => void
}) {
  const isEmpty = id === 0
  const meta    = action ? ACTION_META[action] : null

  const bgColor    = meta ? meta.bg : color
  const textColor  = meta ? meta.textColor : '#fff'

  // selection ring: white on action color, accent blue on default
  const selRing = isSelected
    ? `0 0 0 3px ${meta ? '#fff' : '#4fc3f7'}, 0 0 14px ${meta ? meta.bg + 'aa' : '#4fc3f7aa'}`
    : meta
      ? `0 0 10px ${meta.bg}66`
      : '0 2px 8px rgba(0,0,0,0.5)'

  return (
    <div
      className={!isEmpty && action ? `cube-${action}` : undefined}
      onClick={() => { if (!isEmpty) onSelect(id) }}
      title={!isEmpty && action ? `Cubo #${id} — ${action.toUpperCase()}` : undefined}
      style={{
        width: '72px',
        height: '80px',
        borderRadius: '10px',
        background: bgColor,
        cursor: isEmpty ? 'default' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 4px 6px',
        boxShadow: selRing,
        transition: 'background 0.4s ease, box-shadow 0.2s ease',
        position: 'relative',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* ── Number ── */}
      <span style={{
        fontSize: '20px',
        fontWeight: 700,
        color: textColor,
        lineHeight: 1,
        textShadow: meta ? 'none' : '0 1px 4px rgba(0,0,0,0.4)',
      }}>
        {isEmpty ? '' : id}
      </span>

      {/* ── Action indicator (visible only when action assigned) ── */}
      {meta && !isEmpty ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          width: '100%',
        }}>
          {/* Vibration mini-bars */}
          <div
            className={`vib-${action}`}
            style={{
              display: 'flex',
              gap: '2px',
              alignItems: 'flex-end',
              height: '14px',
            }}
          >
            {VIB_HEIGHTS.map((h, i) => (
              <div
                key={i}
                style={{
                  width: '4px',
                  borderRadius: '1px',
                  background: meta.textColor === '#fff'
                    ? 'rgba(255,255,255,0.75)'
                    : 'rgba(0,0,0,0.45)',
                  height: `${Math.max(h * meta.vibLevel * 100, 15)}%`,
                  transition: 'height 0.3s',
                }}
              />
            ))}
          </div>

          {/* Action label row: icon + sound */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '0 2px',
          }}>
            <span style={{ fontSize: '11px' }}>{meta.icon}</span>
            <span style={{
              fontSize: '9px',
              fontWeight: 600,
              color: meta.textColor === '#fff'
                ? 'rgba(255,255,255,0.85)'
                : 'rgba(0,0,0,0.6)',
              letterSpacing: '0.02em',
            }}>
              {meta.soundLabel}
            </span>
          </div>
        </div>
      ) : (
        /* Empty placeholder to keep height consistent */
        <div style={{ height: '34px' }} />
      )}
    </div>
  )
}

export type { CubeAction }
export default Cube
