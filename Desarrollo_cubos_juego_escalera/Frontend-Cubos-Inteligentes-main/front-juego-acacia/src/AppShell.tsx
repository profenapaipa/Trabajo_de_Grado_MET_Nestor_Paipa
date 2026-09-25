import { useState } from 'react'
import App, { type ControlSnapshot } from './App'
import SimulationTab from './components/SimulationTab'
import ObservadorTab from './components/ObservadorTab'
import { StepMark } from './ui/brand'

type Tab = 'control' | 'simulacion' | 'observador'

const TABS: { id: Tab; label: string; mode: string; modeColor: string }[] = [
  { id: 'control', label: '1 · Control Mago de Oz', mode: 'Hardware real', modeColor: 'var(--color-online)' },
  { id: 'simulacion', label: '2 · Simulación', mode: 'Sin hardware — práctica', modeColor: 'var(--color-blue)' },
  { id: 'observador', label: '3 · Vista de observador', mode: 'Solo lectura', modeColor: 'var(--color-paper-dim)' },
]

function AppShell() {
  const [tab, setTab] = useState<Tab>('control')
  // Estado de Control que la Vista de observador ve en espejo (solo lectura).
  const [snapshot, setSnapshot] = useState<ControlSnapshot | null>(null)
  // Un solo operador para toda la aplicación: se escribe una vez al entrar.
  const [operatorId, setOperatorId] = useState('')

  const current = TABS.find(t => t.id === tab)!

  return (
    <div style={{
      height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: 'var(--color-bg)', color: 'var(--color-paper)', fontFamily: 'var(--font-sans)',
    }}>
      {/* Pestañas con el mismo lenguaje del resto: etiqueta mono en
          mayúsculas, la activa marcada con el medio escalón azul y un filo
          inferior — no botones redondeados de colores sueltos. */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-line)' }}>
        <div style={{
          display: 'flex', alignItems: 'stretch', gap: '4px', maxWidth: '1400px', margin: '0 auto',
          padding: '0 20px', boxSizing: 'border-box',
        }}>
          {TABS.map(t => {
            const active = t.id === tab
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: '7px', padding: '12px 14px 10px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${active ? 'var(--color-blue)' : 'transparent'}`,
                color: active ? 'var(--color-paper)' : 'var(--color-paper-faint)',
                fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                <StepMark color={active ? 'var(--color-blue)' : 'var(--color-line-strong)'} size={11} />
                {t.label}
              </button>
            )
          })}
          <span style={{
            marginLeft: 'auto', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
            color: current.modeColor,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: current.modeColor }} />
            {current.mode}
          </span>
        </div>
      </div>

      {/* Cada pestaña maneja su propio scroll interno dentro de esta región
          de altura fija — un único scrollbar visible por pestaña. Control
          queda siempre montado (display none) para no perder la conexión. */}
      <div style={{ display: tab === 'control' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <App
          operatorId={operatorId} setOperatorId={setOperatorId}
          onSnapshot={setSnapshot} />
      </div>
      {tab === 'simulacion' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <SimulationTab operatorId={operatorId} setOperatorId={setOperatorId} />
        </div>
      )}
      {tab === 'observador' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <ObservadorTab snapshot={snapshot} operatorId={operatorId} />
        </div>
      )}
    </div>
  )
}

export default AppShell
