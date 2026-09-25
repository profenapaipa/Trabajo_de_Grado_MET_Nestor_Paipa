import { useState } from 'react'
import { PageFrame, Panel, PersonField, ParesPicker, Badge } from '../ui/brand'
import { sectionLabel } from '../ui/styles'
import PracticaLibre from './simulation/PracticaLibre'
import ControlSimulado from './simulation/ControlSimulado'

// Pestaña "Simulación libre": el juego completo sin ayudas, eligiendo
// cuántos pares de cubos usar y quién hace la simulación (queda en cada
// registro de la bitácora). Incluye además el control simulado, para
// practicar el rol de operador con los botones PPA sin hardware.

type Mode = 'juego' | 'control'

function SimulacionLibreTab({ operatorId, participante, setParticipante, pares, setPares }: {
  operatorId: string
  participante: string
  setParticipante: (name: string) => void
  pares: number
  setPares: (n: number) => void
}) {
  const [mode, setMode] = useState<Mode>('juego')

  const sidebarTop = (
    <Panel style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <PersonField label="Quién hace la simulación" value={participante} onConfirm={setParticipante} onClear={() => setParticipante('')} />
      <ParesPicker label="Pares de cubos" value={pares} onChange={setPares} />
      <div>
        <div style={{ ...sectionLabel, marginBottom: '6px' }}>Modo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {([['juego', 'Juego libre'], ['control', 'Control simulado']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} style={{
              padding: '7px 6px', cursor: 'pointer', border: 'none', fontSize: '12px', fontWeight: 600,
              background: mode === id ? 'var(--color-blue)' : 'var(--color-bg)',
              color: mode === id ? '#fff' : 'var(--color-paper-dim)',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '6px', lineHeight: 1.4 }}>
          {mode === 'juego'
            ? 'Intentos numerados, sin pistas. Dos fallas seguidas sugieren Pausar.'
            : 'Practica el rol de operador: mueve los cubos y envía Pausar/Pensar/Actuar.'}
        </div>
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>
        Operador en sesión: <span style={{ color: operatorId ? 'var(--color-paper-dim)' : undefined }}>{operatorId || 'sin confirmar'}</span>
      </div>
    </Panel>
  )

  return (
    <PageFrame subtitle="Simulación libre" traceColor="var(--color-blue)"
      badge={<Badge color="var(--color-blue)">SIMULACIÓN · SIN HARDWARE</Badge>}>
      {mode === 'juego'
        ? <PracticaLibre pares={pares} operatorId={operatorId} participante={participante} sidebarTop={sidebarTop} />
        : <ControlSimulado pares={pares} operatorId={participante || operatorId} sidebarTop={sidebarTop} />}
    </PageFrame>
  )
}

export default SimulacionLibreTab
