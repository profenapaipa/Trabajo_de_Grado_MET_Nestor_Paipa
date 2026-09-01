import { useState } from 'react'
import { Eye, MousePointerClick, Gamepad2, SlidersHorizontal } from 'lucide-react'
import { SIM_BG, SIM_ACCENT, simCard, simLabel } from '../core/simulation/theme'
import ControladorSimulado from './simulation/ControladorSimulado'
import JuegoSimulado from './simulation/JuegoSimulado'

function SimulationTab() {
  const [subMode, setSubMode] = useState<'controlador' | 'juego'>('juego')
  const [pares, setPares] = useState(1)
  const [role, setRole] = useState<'operador' | 'observador'>('operador')
  const [operatorId, setOperatorId] = useState('')

  return (
    <div style={{ minHeight: '100%', background: SIM_BG, padding: '4px 2px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '1200px', margin: '0 auto', padding: '12px 20px 0' }}>

        <div style={{ ...simCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>Simulación — sin cubos físicos</div>
            <div style={{ color: '#9088ab', fontSize: '12px', marginTop: '2px' }}>
              {role === 'operador'
                ? 'Toda señal requiere confirmación o envío manual del operador — el sistema nunca activa nada por sí solo.'
                : 'Vista de observador: solo lectura, sin controles.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '3px' }}>
            <button onClick={() => setRole('operador')} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: role === 'operador' ? SIM_ACCENT : 'transparent', color: role === 'operador' ? '#fff' : '#8a82a8', fontSize: '12px', fontWeight: 600,
            }}><MousePointerClick size={12} /> Operador</button>
            <button onClick={() => setRole('observador')} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: role === 'observador' ? SIM_ACCENT : 'transparent', color: role === 'observador' ? '#fff' : '#8a82a8', fontSize: '12px', fontWeight: 600,
            }}><Eye size={12} /> Observador</button>
          </div>
        </div>

        <div style={{ ...simCard, display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', opacity: role === 'observador' ? 0.5 : 1 }}>
          <div>
            <div style={simLabel}>NIVEL · PARES DE CUBOS</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} disabled={role === 'observador'} onClick={() => setPares(n)} style={{
                  width: '32px', height: '32px', borderRadius: '8px', cursor: role === 'observador' ? 'not-allowed' : 'pointer',
                  background: pares === n ? SIM_ACCENT : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${pares === n ? SIM_ACCENT : 'rgba(255,255,255,0.12)'}`,
                  color: '#fff', fontWeight: 700, fontSize: '13px',
                }}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={simLabel}>IDENTIFICADOR DE OPERADOR</div>
            <input value={operatorId} disabled={role === 'observador'} onChange={e => setOperatorId(e.target.value)} placeholder="sin asignar"
              style={{
                marginTop: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '160px',
              }} />
          </div>
          <div style={{ color: '#665e80', fontSize: '11px', flex: 1, minWidth: '200px' }}>
            Identificadores de persona sin asignar todavía (ver DECISIONES_PROYECTO.md) — campo libre para pruebas.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setSubMode('juego')} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
            background: subMode === 'juego' ? SIM_ACCENT : 'rgba(255,255,255,0.06)',
            border: `1px solid ${subMode === 'juego' ? SIM_ACCENT : 'rgba(255,255,255,0.12)'}`,
            color: '#fff', fontSize: '13px', fontWeight: 600,
          }}><Gamepad2 size={14} /> Simulación jugable</button>
          <button onClick={() => setSubMode('controlador')} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
            background: subMode === 'controlador' ? SIM_ACCENT : 'rgba(255,255,255,0.06)',
            border: `1px solid ${subMode === 'controlador' ? SIM_ACCENT : 'rgba(255,255,255,0.12)'}`,
            color: '#fff', fontSize: '13px', fontWeight: 600,
          }}><SlidersHorizontal size={14} /> Controlador simulado</button>
        </div>

        {subMode === 'juego'
          ? <JuegoSimulado pares={pares} role={role} operatorId={operatorId} />
          : <ControladorSimulado pares={pares} role={role} operatorId={operatorId} />}
      </div>
    </div>
  )
}

export default SimulationTab
