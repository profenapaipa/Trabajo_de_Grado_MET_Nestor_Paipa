import { useState } from 'react'
import { PageFrame, Panel, PersonField, Badge, SectionTitle } from '../ui/brand'
import { LEVELS } from '../core/simulation/tutor'
import Tutorial from './simulation/Tutorial'

// Pestaña "Tutorial guiado": aprender las reglas de La Escalera nivel por
// nivel (1 a 5 pares). Cualquier nivel se puede elegir directamente — el
// orden 1→5 es la recomendación, no un candado — y cada registro de la
// bitácora lleva el nombre de quien hace el tutorial.

// Mejores estrellas por nivel: comodidad por navegador — si el
// almacenamiento no está disponible, el progreso dura solo la sesión.
const PROGRESS_KEY = 'escalera.tutorial.progreso.v1'
function loadProgress(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') } catch { return {} }
}
function saveProgress(p: Record<number, number>) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)) } catch { /* sin almacenamiento */ }
}

function TutorialTab({ operatorId, participante, setParticipante, onGoToFreeSim }: {
  operatorId: string
  participante: string
  setParticipante: (name: string) => void
  onGoToFreeSim: () => void
}) {
  const [progress, setProgress] = useState<Record<number, number>>(loadProgress)
  const [level, setLevel] = useState(() => [1, 2, 3, 4, 5].find(n => !progress[n]) ?? 1)

  function handleComplete(n: number, stars: number) {
    setProgress(prev => {
      const next = { ...prev, [n]: Math.max(prev[n] ?? 0, stars) }
      saveProgress(next)
      return next
    })
  }

  const done = Object.keys(progress).length

  // Franja de configuración: quién hace el tutorial y el selector de niveles
  // en horizontal, para que el tablero y el grafo se repartan todo el ancho.
  const toolbar = (
    <Panel style={{ padding: '10px 16px' }}>
      <div className="sim-toolbar" style={{ alignItems: 'stretch' }}>
        <div style={{ width: '230px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
          <PersonField label="Quién hace el tutorial" value={participante} onConfirm={setParticipante} onClear={() => setParticipante('')} />
          <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>
            Operador en sesión: <span style={{ color: operatorId ? 'var(--color-paper-dim)' : undefined }}>{operatorId || 'sin confirmar'}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <SectionTitle right={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>{done}/5 superados · se recomienda ir en orden · <span style={{ color: 'var(--color-caution)' }}>★★★</span> sin errores, pistas ni deshacer</span>}>
            Niveles · pares
          </SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
            {[1, 2, 3, 4, 5].map(n => {
              const stars = progress[n] ?? 0
              const active = n === level
              return (
                <button key={n} onClick={() => setLevel(n)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', padding: '6px 8px', minWidth: 0,
                  borderRadius: 'var(--radius)', cursor: 'pointer',
                  background: active ? 'rgba(69,137,255,0.10)' : 'var(--color-bg)',
                  border: `1px solid ${active ? 'var(--color-blue)' : 'var(--color-line)'}`,
                  color: 'var(--color-paper)',
                }}>
                  <span style={{
                    width: '24px', height: '24px', flexShrink: 0, borderRadius: 'var(--radius)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px',
                    background: active ? 'var(--color-blue)' : 'transparent',
                    border: `1px solid ${active ? 'var(--color-blue)' : 'var(--color-line-strong)'}`,
                    color: active ? '#fff' : 'var(--color-paper-dim)',
                  }}>{n}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{LEVELS[n].titulo}</span>
                    <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-paper-faint)' }}>
                      <span>{n} par{n > 1 ? 'es' : ''}</span>
                      <span aria-label={`${stars} estrellas`}>
                        {[1, 2, 3].map(i => <span key={i} style={{ color: i <= stars ? 'var(--color-caution)' : 'var(--color-line-strong)' }}>★</span>)}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Panel>
  )

  return (
    <PageFrame wide subtitle="Tutorial guiado" traceColor="var(--color-blue)"
      badge={<Badge color="var(--color-blue)">TUTORIAL · SIN HARDWARE</Badge>}>
      {toolbar}
      <Tutorial level={level} operatorId={operatorId} participante={participante}
        onComplete={handleComplete} onGoToLevel={setLevel} onFinishAll={onGoToFreeSim} />
    </PageFrame>
  )
}

export default TutorialTab
