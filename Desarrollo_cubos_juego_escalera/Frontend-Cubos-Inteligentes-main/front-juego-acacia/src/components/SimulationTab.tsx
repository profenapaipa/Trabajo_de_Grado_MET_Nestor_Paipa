import { useRef, useState } from 'react'
import { Check, GraduationCap, Gamepad2, SlidersHorizontal } from 'lucide-react'
import { SIM_BG, SIM_ACCENT, simCard, simLabel } from '../core/simulation/theme'
import { playPpaFeedback } from '../core/utils/ppaTones'
import { AUTO_OFF_MS } from '../core/ppa/ppaColors'
import { type DecisionOperador, nowIso } from '../core/control/bitacoraControl'
import ControladorSimulado, { type CubeAction } from './simulation/ControladorSimulado'
import JuegoSimulado from './simulation/JuegoSimulado'

type SubMode = 'tutorial' | 'libre' | 'controlSimulado'

function SimulationTab() {
  const [subMode, setSubMode] = useState<SubMode>('tutorial')
  const [pares, setPares] = useState(1)
  const [operatorId, setOperatorId] = useState('')
  const [operatorInput, setOperatorInput] = useState('')

  const [selectedCubeId, setSelectedCubeId] = useState<number | null>(null)
  const [cubeActions, setCubeActions] = useState<Record<number, CubeAction>>({})
  const [controlEvents, setControlEvents] = useState<DecisionOperador[]>([])
  const offTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  function logControl(entry: Omit<DecisionOperador, 'timestamp' | 'pares' | 'operadorId'>) {
    setControlEvents(prev => [...prev, { timestamp: nowIso(), pares, operadorId: operatorId || '(sin nombre)', ...entry }])
  }

  function handleSend(a: CubeAction) {
    if (selectedCubeId === null) return
    const cubeId = selectedCubeId
    if (offTimers.current[cubeId]) clearTimeout(offTimers.current[cubeId])
    setCubeActions(prev => ({ ...prev, [cubeId]: a }))
    playPpaFeedback(a, AUTO_OFF_MS / 1000)
    logControl({ cuboId: cubeId, fase: a, detalle: `Operador envió ${a.toUpperCase()} (simulado) al cubo #${cubeId}` })
    offTimers.current[cubeId] = setTimeout(() => {
      setCubeActions(prev => { const next = { ...prev }; delete next[cubeId]; return next })
      logControl({ cuboId: cubeId, fase: 'estado_inicial', detalle: `Señal del cubo #${cubeId} apagada automáticamente tras ${AUTO_OFF_MS / 1000}s (simulado)` })
    }, AUTO_OFF_MS)
  }

  function handleApagar() {
    if (selectedCubeId === null) return
    const cubeId = selectedCubeId
    if (offTimers.current[cubeId]) clearTimeout(offTimers.current[cubeId])
    setCubeActions(prev => { const next = { ...prev }; delete next[cubeId]; return next })
    logControl({ cuboId: cubeId, fase: 'estado_inicial', detalle: `Operador apagó manualmente la señal del cubo #${cubeId} (simulado)` })
  }

  return (
    <div style={{ minHeight: '100%', background: SIM_BG, padding: '4px 2px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '1200px', margin: '0 auto', padding: '12px 20px 0' }}>

        <div style={simCard}>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>Simulación — sin cubos físicos</div>
          <div style={{ color: '#9088ab', fontSize: '12px', marginTop: '2px' }}>
            Toda señal requiere confirmación o envío manual del operador — el sistema nunca activa nada por sí solo.
          </div>
        </div>

        <div style={{ ...simCard, display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div>
            <div style={simLabel}>NIVEL · PARES DE CUBOS</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setPares(n)} style={{
                  width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer',
                  background: pares === n ? SIM_ACCENT : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${pares === n ? SIM_ACCENT : 'rgba(255,255,255,0.12)'}`,
                  color: '#fff', fontWeight: 700, fontSize: '13px',
                }}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={simLabel}>OPERADOR · NOMBRE DE QUIEN ENVÍA O CONFIRMA</div>
            <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
              <input
                value={operatorInput}
                onChange={e => setOperatorInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && operatorInput.trim()) setOperatorId(operatorInput.trim()) }}
                placeholder="escribe el nombre y confirma"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: `1px solid ${operatorId && operatorInput.trim() === operatorId ? '#22c55e77' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '170px',
                }} />
              <button
                onClick={() => operatorInput.trim() && setOperatorId(operatorInput.trim())}
                disabled={!operatorInput.trim()}
                title="Confirmar nombre (o presiona Enter)"
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px',
                  background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                  color: '#22c55e', fontSize: '12px', cursor: operatorInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: operatorInput.trim() ? 1 : 0.4,
                }}>
                <Check size={13} /> Confirmar
              </button>
            </div>
            <div style={{ marginTop: '4px', fontSize: '11px' }}>
              {operatorId
                ? <span style={{ color: '#22c55e' }}>✓ Operador confirmado: {operatorId}</span>
                : <span style={{ color: '#f59e0b' }}>Sin confirmar — los eventos quedan como "(sin nombre)" hasta que confirmes</span>}
            </div>
          </div>
          <div style={{ color: '#665e80', fontSize: '11px', flex: 1, minWidth: '200px' }}>
            No es un identificador oficial del proyecto (ver DECISIONES_PROYECTO.md) — es libre para pruebas.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={() => setSubMode('tutorial')} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
            background: subMode === 'tutorial' ? SIM_ACCENT : 'rgba(255,255,255,0.06)',
            border: `1px solid ${subMode === 'tutorial' ? SIM_ACCENT : 'rgba(255,255,255,0.12)'}`,
            color: '#fff', fontSize: '13px', fontWeight: 600,
          }}><GraduationCap size={14} /> Tutorial guiado</button>
          <button onClick={() => setSubMode('libre')} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
            background: subMode === 'libre' ? SIM_ACCENT : 'rgba(255,255,255,0.06)',
            border: `1px solid ${subMode === 'libre' ? SIM_ACCENT : 'rgba(255,255,255,0.12)'}`,
            color: '#fff', fontSize: '13px', fontWeight: 600,
          }}><Gamepad2 size={14} /> Simulación libre</button>
          <button onClick={() => setSubMode('controlSimulado')} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
            background: subMode === 'controlSimulado' ? SIM_ACCENT : 'rgba(255,255,255,0.06)',
            border: `1px solid ${subMode === 'controlSimulado' ? SIM_ACCENT : 'rgba(255,255,255,0.12)'}`,
            color: '#fff', fontSize: '13px', fontWeight: 600,
          }}><SlidersHorizontal size={14} /> Control simulado</button>
        </div>

        {subMode === 'tutorial' && <JuegoSimulado key="tutorial" pares={pares} operatorId={operatorId} guiado modo="tutorial" />}
        {subMode === 'libre' && <JuegoSimulado key="libre" pares={pares} operatorId={operatorId} modo="simulacion-libre" />}
        {subMode === 'controlSimulado' && (
          <ControladorSimulado
            pares={pares}
            selectedCubeId={selectedCubeId} setSelectedCubeId={setSelectedCubeId}
            cubeActions={cubeActions} events={controlEvents}
            onSend={handleSend} onApagar={handleApagar}
          />
        )}
      </div>
    </div>
  )
}

export default SimulationTab
