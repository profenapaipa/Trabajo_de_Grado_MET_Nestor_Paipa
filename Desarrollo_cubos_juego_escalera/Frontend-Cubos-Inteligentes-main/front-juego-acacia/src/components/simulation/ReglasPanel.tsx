import { ArrowRight, Trophy, Ban, Sparkles } from 'lucide-react'
import { simCard, SIM_ACCENT } from '../../core/simulation/theme'

const chip = (bg: string): React.CSSProperties => ({
  width: '30px', height: '34px', borderRadius: '6px', background: bg,
  display: 'inline-flex', flexShrink: 0,
})

function ReglasPanel() {
  return (
    <div style={{ ...simCard, display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={16} color={SIM_ACCENT} />
        <span style={{ fontWeight: 700, fontSize: '15px' }}>¿Cómo se juega La Escalera?</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>1. Deslizar</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
            <span style={chip('#0000ff')} />
            <span style={{ ...chip('transparent'), border: '2px dashed #555' }} />
            <ArrowRight size={16} color="#888" />
            <span style={{ ...chip('transparent'), border: '2px dashed #555' }} />
            <span style={chip('#0000ff')} />
          </div>
          <div style={{ fontSize: '12px', color: '#aaa' }}>Si la casilla de al lado está vacía, la ficha se mueve ahí.</div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>2. Saltar</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
            <span style={chip('#0000ff')} />
            <span style={chip('#ff0000')} />
            <span style={{ ...chip('transparent'), border: '2px dashed #555' }} />
            <ArrowRight size={16} color="#888" />
            <span style={chip('#ff0000')} />
            <span style={chip('#0000ff')} />
          </div>
          <div style={{ fontSize: '12px', color: '#aaa' }}>Si hay una ficha del otro color y luego una casilla vacía, se puede saltar sobre ella.</div>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: '#aaa', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 12px' }}>
        Cada ficha avanza siempre hacia el lado contrario — nunca se puede devolver.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '10px', padding: '10px 12px' }}>
          <Trophy size={20} color="#22c55e" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#22c55e' }}>Ganar</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>Los dos colores quedan totalmente intercambiados de lado.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', padding: '10px 12px' }}>
          <Ban size={20} color="#ef4444" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#ef4444' }}>Perder</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>Ninguna ficha puede moverse más y el juego no se completó.</div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: '11px', color: '#666' }}>
        Fuente: main.tex, "El juego La Escalera como problema matemático bien definido". La condición de perder fue una decisión
        explícita del autor para esta simulación — no aparecía antes en ningún documento del proyecto.
      </div>
    </div>
  )
}

export default ReglasPanel
