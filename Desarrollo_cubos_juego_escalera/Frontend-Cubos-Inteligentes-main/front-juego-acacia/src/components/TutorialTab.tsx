import { useState } from 'react'
import { PageFrame, Panel, PersonField, Badge, SectionTitle, TwoColumn } from '../ui/brand'
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

  const side = (
    <>
      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <PersonField label="Quién hace el tutorial" value={participante} onConfirm={setParticipante} onClear={() => setParticipante('')} />
        <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>
          Operador en sesión: <span style={{ color: operatorId ? 'var(--color-paper-dim)' : undefined }}>{operatorId || 'sin confirmar'}</span>
        </div>
      </Panel>

      <Panel>
        <SectionTitle right={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>{done}/5 superados</span>}>
          Niveles · pares
        </SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[1, 2, 3, 4, 5].map(n => {
            const stars = progress[n] ?? 0
            const active = n === level
            return (
              <button key={n} onClick={() => setLevel(n)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '8px 10px',
                borderRadius: 'var(--radius)', cursor: 'pointer',
                background: active ? 'rgba(69,137,255,0.10)' : 'var(--color-bg)',
                border: `1px solid ${active ? 'var(--color-blue)' : 'var(--color-line)'}`,
                color: 'var(--color-paper)',
              }}>
                <span style={{
                  width: '26px', height: '26px', flexShrink: 0, borderRadius: 'var(--radius)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px',
                  background: active ? 'var(--color-blue)' : 'transparent',
                  border: `1px solid ${active ? 'var(--color-blue)' : 'var(--color-line-strong)'}`,
                  color: active ? '#fff' : 'var(--color-paper-dim)',
                }}>{n}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{LEVELS[n].titulo}</span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-paper-faint)' }}>{n} par{n > 1 ? 'es' : ''} · {2 * n + 1} casillas</span>
                </span>
                <span style={{ fontSize: '13px', letterSpacing: '1px' }} aria-label={`${stars} estrellas`}>
                  {[1, 2, 3].map(i => <span key={i} style={{ color: i <= stars ? 'var(--color-caution)' : 'var(--color-line-strong)' }}>★</span>)}
                </span>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-line)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', fontSize: '11px', color: 'var(--color-paper-dim)' }}>
          <span style={{ color: 'var(--color-caution)' }}>★★★</span><span>sin errores, pistas ni deshacer</span>
          <span style={{ color: 'var(--color-caution)' }}>★★<span style={{ color: 'var(--color-line-strong)' }}>★</span></span><span>hasta 3 ayudas o errores</span>
          <span style={{ color: 'var(--color-caution)' }}>★<span style={{ color: 'var(--color-line-strong)' }}>★★</span></span><span>nivel completado</span>
        </div>
        <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--color-paper-faint)' }}>
          Se recomienda ir en orden, del 1 al 5.
        </div>
      </Panel>
    </>
  )

  return (
    <PageFrame subtitle="Tutorial guiado" traceColor="var(--color-blue)"
      badge={<Badge color="var(--color-blue)">TUTORIAL · SIN HARDWARE</Badge>}>
      <TwoColumn
        main={<Tutorial level={level} operatorId={operatorId} participante={participante}
          onComplete={handleComplete} onGoToLevel={setLevel} onFinishAll={onGoToFreeSim} />}
        side={side} />
    </PageFrame>
  )
}

export default TutorialTab
