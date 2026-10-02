import { useState } from 'react'
import { PageFrame, Panel, PersonField, ParesPicker, Badge } from '../ui/brand'
import { sectionLabel } from '../ui/styles'
import PracticaLibre from './simulation/PracticaLibre'
import ControlSimulado from './simulation/ControlSimulado'

// Pestaña "Simulación libre": el juego completo sin ayudas, eligiendo
// cuántos pares de cubos usar y quién hace la simulación (queda en cada
// registro de la bitácora). Incluye además el control simulado, para
// practicar el rol de operador con los botones PPA sin hardware.
//
// La configuración (quién, cuántos pares, qué modo) va en una franja
// horizontal arriba, en vez de una barra lateral: así el tablero y el grafo
// de estados se reparten todo el ancho de la pantalla.

type Mode = 'juego' | 'control'

function SimulacionLibreTab({ operatorId, participante, setParticipante, pares, setPares }: {
  operatorId: string
  participante: string
  setParticipante: (name: string) => void
  pares: number
  setPares: (n: number) => void
}) {
  const [mode, setMode] = useState<Mode>('juego')

  const toolbar = (
    <Panel style={{ padding: '10px 16px' }}>
      <div className="sim-toolbar">
        <div style={{ width: '240px', maxWidth: '100%' }}>
          <PersonField label="Quién hace la simulación" value={participante} onConfirm={setParticipante} onClear={() => setParticipante('')} />
        </div>
        <ParesPicker label="Pares de cubos" value={pares} onChange={setPares} />
        <div>
          <div style={{ ...sectionLabel, marginBottom: '6px' }}>Modo</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {([['juego', 'Juego libre'], ['control', 'Control simulado']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setMode(id)} style={{
                padding: '5px 12px', cursor: 'pointer', border: 'none', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
                background: mode === id ? 'var(--color-blue)' : 'var(--color-bg)',
                color: mode === id ? '#fff' : 'var(--color-paper-dim)',
              }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: '220px', fontSize: '11px', color: 'var(--color-paper-faint)', lineHeight: 1.5 }}>
          {mode === 'juego'
            ? 'Intentos numerados, sin pistas. Dos fallas seguidas sugieren Pausar.'
            : 'Practica el rol de operador: mueve los cubos y envía Pausar/Pensar/Actuar.'}
          <br />
          Operador en sesión: <span style={{ color: operatorId ? 'var(--color-paper-dim)' : undefined }}>{operatorId || 'sin confirmar'}</span>
        </div>
      </div>
    </Panel>
  )

  return (
    <PageFrame wide subtitle="Simulación libre" traceColor="var(--color-blue)"
      badge={<Badge color="var(--color-blue)">SIMULACIÓN · SIN HARDWARE</Badge>}>
      {toolbar}
      {mode === 'juego'
        ? <PracticaLibre pares={pares} operatorId={operatorId} participante={participante} />
        : <ControlSimulado pares={pares} operatorId={participante || operatorId} />}
    </PageFrame>
  )
}

export default SimulacionLibreTab
