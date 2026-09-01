import { useEffect, useRef, useState } from 'react'
import { Music, Play, Square, X } from 'lucide-react'
import { AMBIENTES, playAmbiente, type AmbienteHandle, type AmbienteId } from '../core/utils/ambientAudio'

type Props = {
  accentColor?: string
}

function PlatformConfigPopup({ accentColor = '#d97706' }: Props) {
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState<AmbienteId | null>(null)
  const handleRef = useRef<AmbienteHandle | null>(null)

  useEffect(() => () => { handleRef.current?.stop() }, [])

  function toggle(id: AmbienteId) {
    if (playing === id) {
      handleRef.current?.stop()
      handleRef.current = null
      setPlaying(null)
      return
    }
    handleRef.current?.stop()
    handleRef.current = playAmbiente(id)
    setPlaying(id)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        width: '100%', padding: '10px 16px', background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff',
        fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      }}>
        <Music size={15} /> Música de fondo{playing ? ` — ${AMBIENTES.find(a => a.id === playing)?.label} sonando` : ''}
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#161010', border: `1px solid ${accentColor}55`, borderRadius: '14px',
            padding: '20px', width: '100%', maxWidth: '420px', color: '#fff',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px' }}>
                <Music size={16} color={accentColor} /> Música de fondo
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>
              Opcional, para usar durante la sesión. Elige un ambiente — puedes cambiarlo o apagarlo en cualquier momento.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {AMBIENTES.map(a => {
                const isPlaying = playing === a.id
                return (
                  <button key={a.id} onClick={() => toggle(a.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                    borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                    background: isPlaying ? `${accentColor}22` : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isPlaying ? accentColor : 'rgba(255,255,255,0.1)'}`,
                  }}>
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isPlaying ? accentColor : 'rgba(255,255,255,0.08)',
                      color: isPlaying ? '#000' : '#fff',
                    }}>
                      {isPlaying ? <Square size={14} /> : <Play size={14} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>{a.label}</div>
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>{a.descripcion}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {playing && (
              <button onClick={() => toggle(playing)} style={{
                marginTop: '14px', width: '100%', padding: '8px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
                color: '#ef4444', fontSize: '13px', cursor: 'pointer',
              }}>
                Detener música
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default PlatformConfigPopup
