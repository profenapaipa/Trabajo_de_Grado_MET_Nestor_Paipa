import { useState } from 'react'
import { Gamepad2, SlidersHorizontal } from 'lucide-react'
import App from './App'
import SimulationTab from './components/SimulationTab'

function AppShell() {
  const [tab, setTab] = useState<'control' | 'simulacion'>('control')

  const tabBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
    borderRadius: '8px', border: `1px solid ${active ? '#d97706' : 'rgba(255,255,255,0.12)'}`,
    background: active ? 'rgba(217,119,6,0.18)' : 'rgba(255,255,255,0.05)',
    color: active ? '#d97706' : '#aaa', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top left, #3d1a00 0%, #1c0c00 45%, #080400 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#fff',
    }}>
      <div style={{
        display: 'flex', gap: '8px', padding: '10px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)', maxWidth: '1200px', margin: '0 auto',
      }}>
        <button style={tabBtn(tab === 'control')} onClick={() => setTab('control')}>
          <SlidersHorizontal size={14} /> Control
        </button>
        <button style={tabBtn(tab === 'simulacion')} onClick={() => setTab('simulacion')}>
          <Gamepad2 size={14} /> Simulación
        </button>
      </div>

      <div style={{ display: tab === 'control' ? 'block' : 'none' }}>
        <App />
      </div>
      {tab === 'simulacion' && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <SimulationTab />
        </div>
      )}
    </div>
  )
}

export default AppShell
