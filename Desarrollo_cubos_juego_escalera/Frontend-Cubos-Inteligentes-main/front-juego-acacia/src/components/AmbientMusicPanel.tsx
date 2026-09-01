import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { AMBIENTES, playAmbiente, type AmbienteHandle, type AmbienteId } from '../core/utils/ambientAudio'

// Configuración de música de fondo, siempre visible (no un botón que abre
// un modal aparte) — para que se pueda ajustar sin salir de la tarjeta de
// Sonido, tanto en Control Mago de Oz como en Control simulado.
function AmbientMusicPanel({ accentColor }: { accentColor: string }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {AMBIENTES.map(a => {
        const isPlaying = playing === a.id
        return (
          <button key={a.id} onClick={() => toggle(a.id)} style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
            borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
            background: isPlaying ? `${accentColor}22` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isPlaying ? accentColor : 'rgba(255,255,255,0.1)'}`,
          }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isPlaying ? accentColor : 'rgba(255,255,255,0.08)',
              color: isPlaying ? '#000' : '#fff',
            }}>
              {isPlaying ? <Square size={11} /> : <Play size={11} />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '12px' }}>{a.label}</div>
              <div style={{ fontSize: '10px', color: '#999' }}>{a.descripcion}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default AmbientMusicPanel
