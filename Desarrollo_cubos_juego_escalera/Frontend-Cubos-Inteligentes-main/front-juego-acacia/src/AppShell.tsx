import { useState } from 'react'
import { Gamepad2, SlidersHorizontal } from 'lucide-react'
import App from './App'
import SimulationTab from './components/SimulationTab'
import { SIM_ACCENT } from './core/simulation/theme'

const CONTROL_ACCENT = '#d97706'

function AppShell() {
  const [tab, setTab] = useState<'control' | 'simulacion'>('control')
  const accent = tab === 'control' ? CONTROL_ACCENT : SIM_ACCENT

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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={tabBtn(tab === 'control', CONTROL_ACCENT)} onClick={() => setTab('control')}>
            <SlidersHorizontal size={14} /> Control
          </button>
          <button style={tabBtn(tab === 'simulacion', SIM_ACCENT)} onClick={() => setTab('simulacion')}>
            <Gamepad2 size={14} /> Simulación
          </button>
        </div>
        <span style={{ fontSize: '11px', color: accent, letterSpacing: '0.05em' }}>
          {tab === 'control' ? '● HARDWARE REAL' : '● SIN HARDWARE — PRÁCTICA'}
        </span>
      </div>

      <div style={{ display: tab === 'control' ? 'block' : 'none' }}>
        <App />
      </div>
      {tab === 'simulacion' && <SimulationTab />}
    </div>
  )
}

export default AppShell
