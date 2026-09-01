import { useState } from 'react'
import { Gamepad2, SlidersHorizontal, Eye } from 'lucide-react'
import App, { type ObservedCube } from './App'
import SimulationTab from './components/SimulationTab'
import ObservadorTab, { OBS_ACCENT } from './components/ObservadorTab'
import { SIM_ACCENT } from './core/simulation/theme'
import type { PPAPhase } from './core/ppa/ppaColors'

const CONTROL_ACCENT = '#d97706'

type Tab = 'control' | 'simulacion' | 'observador'

function AppShell() {
  const [tab, setTab] = useState<Tab>('control')
  const [observedCubes, setObservedCubes] = useState<ObservedCube[]>([])
  const [observedActions, setObservedActions] = useState<Record<number, PPAPhase>>({})

  const accent = tab === 'control' ? CONTROL_ACCENT : tab === 'simulacion' ? SIM_ACCENT : OBS_ACCENT

  const tabBtn = (active: boolean, color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
    borderRadius: '8px', border: `1px solid ${active ? color : 'rgba(255,255,255,0.12)'}`,
    background: active ? `${color}2e` : 'rgba(255,255,255,0.05)',
    color: active ? color : '#aaa', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '10px 20px',
        borderBottom: `1px solid ${accent}33`, maxWidth: '1200px', margin: '0 auto',
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={tabBtn(tab === 'control', CONTROL_ACCENT)} onClick={() => setTab('control')}>
            <SlidersHorizontal size={14} /> 1. Control Mago de Oz
          </button>
          <button style={tabBtn(tab === 'simulacion', SIM_ACCENT)} onClick={() => setTab('simulacion')}>
            <Gamepad2 size={14} /> 2. Simulación
          </button>
          <button style={tabBtn(tab === 'observador', OBS_ACCENT)} onClick={() => setTab('observador')}>
            <Eye size={14} /> 3. Vista de observador
          </button>
        </div>
        <span style={{ fontSize: '11px', color: accent, letterSpacing: '0.05em' }}>
          {tab === 'control' ? '● HARDWARE REAL' : tab === 'simulacion' ? '● SIN HARDWARE — PRÁCTICA' : '● SOLO LECTURA'}
        </span>
      </div>

      <div style={{ display: tab === 'control' ? 'block' : 'none' }}>
        <App onCubesUpdate={(cubes, actions) => { setObservedCubes(cubes); setObservedActions(actions) }} />
      </div>
      {tab === 'simulacion' && <SimulationTab />}
      {tab === 'observador' && <ObservadorTab cubes={observedCubes} cubeActions={observedActions} />}
    </div>
  )
}

export default AppShell
