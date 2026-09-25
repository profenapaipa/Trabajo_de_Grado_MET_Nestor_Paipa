import { useState } from 'react'
import { PageFrame, Panel, PersonField, ParesPicker, Badge, SectionTitle, TwoColumn } from '../ui/brand'
import { sectionLabel } from '../ui/styles'
import { LEVELS } from '../core/simulation/tutor'
import Tutorial from './simulation/Tutorial'
import PracticaLibre from './simulation/PracticaLibre'
import ControlSimulado from './simulation/ControlSimulado'

// Pestaña de Simulación — misma identidad visual que Control Mago de Oz
// (marco, barra lateral, paneles). Se distingue de una sesión real por el
// distintivo "sin hardware" y el trazo EEG en azul (no en verde/rojo de
// conexión), en vez de una paleta de color aparte como antes.

type Mode = 'tutorial' | 'libre' | 'control'

const MODES: { id: Mode; title: string; desc: string }[] = [
  { id: 'tutorial', title: 'Tutorial por niveles', desc: 'Aprende las reglas paso a paso, de 1 a 5 pares.' },
  { id: 'libre', title: 'Práctica libre', desc: 'El juego completo por intentos, sin ayudas.' },
  { id: 'control', title: 'Control simulado', desc: 'Practica el rol de operador con los botones PPA.' },
]

// Progreso del tutorial (mejores estrellas por nivel): comodidad por
// navegador — si el almacenamiento no está disponible, se empieza de cero.
const PROGRESS_KEY = 'escalera.tutorial.progreso.v1'
function loadProgress(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') } catch { return {} }
}
function saveProgress(p: Record<number, number>) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)) } catch { /* sin almacenamiento: el progreso dura la sesión */ }
}

function SimulationTab({ operatorId, setOperatorId }: { operatorId: string; setOperatorId: (name: string) => void }) {
  const [mode, setMode] = useState<Mode>('tutorial')
  const [pares, setPares] = useState(1)
  const [progress, setProgress] = useState<Record<number, number>>(loadProgress)
  const [unlockAll, setUnlockAll] = useState(false)
  const firstPending = [1, 2, 3, 4, 5].find(n => !progress[n]) ?? 5
  const [level, setLevel] = useState(firstPending)

  const isUnlocked = (n: number) => unlockAll || n === 1 || (progress[n - 1] ?? 0) > 0

  function handleComplete(n: number, stars: number) {
    setProgress(prev => {
      const next = { ...prev, [n]: Math.max(prev[n] ?? 0, stars) }
      saveProgress(next)
      return next
    })
  }

  const sidebarTop = (
    <>
      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <PersonField label="Operador Mago de Oz" value={operatorId} onConfirm={setOperatorId} onClear={() => setOperatorId('')} />
        <div>
          <div style={{ ...sectionLabel, marginBottom: '6px' }}>Modo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                textAlign: 'left', cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--radius)',
                background: mode === m.id ? 'rgba(69,137,255,0.10)' : 'transparent',
                border: '1px solid transparent', borderLeft: `3px solid ${mode === m.id ? 'var(--color-blue)' : 'var(--color-line)'}`,
                color: 'var(--color-paper)',
              }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: mode === m.id ? 'var(--color-paper)' : 'var(--color-paper-dim)' }}>{m.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '2px' }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
        {mode !== 'tutorial' && <ParesPicker value={pares} onChange={setPares} />}
      </Panel>

      {mode === 'tutorial' && (
        <Panel>
          <SectionTitle right={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>{Object.keys(progress).length}/5</span>}>Niveles</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[1, 2, 3, 4, 5].map(n => {
              const open = isUnlocked(n)
              const stars = progress[n] ?? 0
              const active = n === level
              return (
                <button key={n} disabled={!open} onClick={() => setLevel(n)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '8px 10px',
                  borderRadius: 'var(--radius)', cursor: open ? 'pointer' : 'not-allowed',
                  background: active ? 'rgba(69,137,255,0.10)' : 'var(--color-bg)',
                  border: `1px solid ${active ? 'var(--color-blue)' : 'var(--color-line)'}`,
                  color: 'var(--color-paper)', opacity: open ? 1 : 0.45,
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', width: '14px', color: active ? 'var(--color-blue)' : 'var(--color-paper-dim)' }}>{n}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{LEVELS[n].titulo}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-paper-faint)' }}>{n} par{n > 1 ? 'es' : ''}</span>
                  </span>
                  <span style={{ fontSize: '13px', letterSpacing: '1px' }} aria-label={open ? `${stars} estrellas` : 'bloqueado'}>
                    {open
                      ? [1, 2, 3].map(i => <span key={i} style={{ color: i <= stars ? 'var(--color-caution)' : 'var(--color-line-strong)' }}>★</span>)
                      : <span style={{ fontSize: '11px', color: 'var(--color-paper-faint)', fontFamily: 'var(--font-mono)' }}>BLOQUEADO</span>}
                  </span>
                </button>
              )
            })}
          </div>
          {!unlockAll && (
            <button onClick={() => setUnlockAll(true)} style={{ marginTop: '10px', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', color: 'var(--color-paper-faint)', textDecoration: 'underline' }}>
              Desbloquear todos (para el operador)
            </button>
          )}
        </Panel>
      )}
    </>
  )

  return (
    <PageFrame
      subtitle="Simulación"
      traceColor="var(--color-blue)"
      badge={<Badge color="var(--color-blue)">SIMULACIÓN · SIN HARDWARE</Badge>}
    >
      {mode === 'tutorial' && (
        <TwoColumn
          main={<Tutorial level={level} operatorId={operatorId} onComplete={handleComplete}
            onGoToLevel={n => setLevel(n)} onFinishAll={() => { setPares(5); setMode('libre') }} />}
          side={sidebarTop} />
      )}
      {mode === 'libre' && <PracticaLibre pares={pares} operatorId={operatorId} sidebarTop={sidebarTop} />}
      {mode === 'control' && <ControlSimulado pares={pares} operatorId={operatorId} sidebarTop={sidebarTop} />}
    </PageFrame>
  )
}

export default SimulationTab
