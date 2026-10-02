import { useEffect, useRef, useState, type ReactNode } from 'react'
import { type Board, type Team, applyMove } from '../../core/simulation/laEscaleraRules'
import { classifyAttempt, explainError, successText } from '../../core/simulation/tutor'
import { sectionLabel } from '../../ui/styles'
import { TEAM_HEX } from '../../ui/styles'

// Las tres reglas del libro (Figura 3.3), explicadas y en movimiento: cada
// regla muestra ejemplos que se animan en bucle, unos válidos (la ficha se
// desliza o salta a la casilla vacía) y otros no válidos (la ficha lo
// intenta, rebota y aparece el motivo). El veredicto de cada jugada lo
// calcula el mismo motor de reglas del juego (classifyAttempt), no está
// escrito a mano: la animación no puede contradecir a la partida.

type Beat = { from: number; to: number; ok?: string } // `ok`: texto opcional si la jugada es válida
type Scene = { pattern: string; beats: Beat[] }

const SCENES: Record<1 | 2 | 3, Scene[]> = {
  1: [
    { pattern: 'AA_BB', beats: [{ from: 1, to: 2, ok: 'La ficha azul está pegada a la casilla vacía: se desliza a ella.' }] },
    { pattern: 'AA_BB', beats: [{ from: 3, to: 2, ok: 'También se puede desde el otro lado: la roja se desliza hacia la izquierda.' }] },
    { pattern: 'AAA_BBB', beats: [{ from: 0, to: 3 }] },
    { pattern: 'AA_BB', beats: [{ from: 0, to: 1 }] },
  ],
  2: [
    {
      pattern: 'AA_BB', beats: [
        { from: 1, to: 2, ok: 'Primero la azul se desliza a la casilla vacía.' },
        { from: 2, to: 1 },
        { from: 3, to: 1, ok: 'Mover OTRA ficha sí se puede. Después de esta jugada, la anterior ya no cuenta como "inmediata".' },
      ],
    },
    {
      pattern: 'AB_', beats: [
        { from: 0, to: 2, ok: 'La azul salta sobre la roja.' },
        { from: 2, to: 0 },
      ],
    },
  ],
  3: [
    { pattern: 'AB_', beats: [{ from: 0, to: 2, ok: 'Salta UNA ficha, y es de color contrario: válido.' }] },
    { pattern: '_AB', beats: [{ from: 2, to: 0, ok: 'También se salta hacia la izquierda.' }] },
    { pattern: 'AA_', beats: [{ from: 0, to: 2 }] },
    { pattern: 'ABB_', beats: [{ from: 0, to: 3 }] },
  ],
}

function boardOf(pattern: string): Board {
  let a = 0, b = 0
  return pattern.split('').map(c => (c === '_' ? null : c === 'A' ? { id: ++a, team: 'A' as Team } : { id: 100 + ++b, team: 'B' as Team }))
}

const CELL_W = 38, CELL_H = 44, GAP = 6
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

type Verdict = { ok: boolean; titulo: string; texto: string } | null

// Una demostración: reproduce en bucle las escenas de una regla.
function Demo({ rule }: { rule: 1 | 2 | 3 }) {
  const scenes = SCENES[rule]
  const [sceneIdx, setSceneIdx] = useState(0)
  const [board, setBoard] = useState<Board>(() => boardOf(scenes[0].pattern))
  const [selected, setSelected] = useState<number | null>(null) // índice de la ficha que se prueba
  const [target, setTarget] = useState<number | null>(null)
  const [nudge, setNudge] = useState<{ id: number; dx: number } | null>(null)
  const [shakeId, setShakeId] = useState<number | null>(null)
  const [hopId, setHopId] = useState<number | null>(null)
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [running, setRunning] = useState(() => !reduceMotion())
  const [restart, setRestart] = useState(0) // cambia para reiniciar la escena elegida
  const sceneRef = useRef(0)

  useEffect(() => {
    if (!running) return
    let alive = true
    ;(async () => {
      while (alive) {
        const si = sceneRef.current
        const scene = scenes[si]
        let b = boardOf(scene.pattern)
        let prev: Board | null = null
        setSceneIdx(si); setBoard(b); setSelected(null); setTarget(null); setVerdict(null); setNudge(null)
        await sleep(650); if (!alive) return
        for (const beat of scene.beats) {
          const piece = b[beat.from]!
          setSelected(beat.from); setTarget(beat.to); setVerdict(null)
          await sleep(750); if (!alive) return
          const res = classifyAttempt(b, beat.from, beat.to, prev)
          if (res.ok) {
            if (res.kind === 'saltar') { setHopId(piece.id); setTimeout(() => setHopId(null), 700) }
            prev = b
            b = applyMove(b, beat.from, beat.to)
            setBoard(b); setSelected(null)
            setVerdict({ ok: true, titulo: 'Jugada válida', texto: beat.ok ?? successText(res.kind, piece.team) })
            await sleep(1500)
          } else {
            const dx = (beat.to - beat.from) * (CELL_W + GAP)
            setNudge({ id: piece.id, dx: dx * 0.4 }); await sleep(320); if (!alive) return
            setNudge({ id: piece.id, dx: 0 }); setShakeId(piece.id); setTimeout(() => setShakeId(null), 500)
            const e = explainError(res.error, piece.team)
            setVerdict({ ok: false, titulo: 'Jugada NO válida', texto: `${e.titulo}. ${e.texto}` })
            await sleep(1900)
          }
          if (!alive) return
        }
        setTarget(null); setSelected(null)
        await sleep(400); if (!alive) return
        sceneRef.current = (si + 1) % scenes.length
      }
    })()
    return () => { alive = false }
  }, [running, restart, scenes])

  function goTo(i: number) { sceneRef.current = i; setRunning(true); setRestart(r => r + 1) }

  const W = board.length * CELL_W + (board.length - 1) * GAP
  const x = (i: number) => i * (CELL_W + GAP)
  const arrow = selected !== null && target !== null ? { x1: x(selected) + CELL_W / 2, x2: x(target) + CELL_W / 2 } : null
  const arrowColor = verdict ? (verdict.ok ? 'var(--color-online)' : 'var(--color-offline)') : '#ffffff'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
        <div style={{ position: 'relative', width: `${W}px`, height: `${CELL_H + 22}px` }}>
          {/* casillas de fondo (la vacía, más clara) */}
          {board.map((c, i) => (
            <div key={`s${i}`} style={{
              position: 'absolute', left: `${x(i)}px`, top: '22px', width: `${CELL_W}px`, height: `${CELL_H}px`, borderRadius: '8px',
              background: c === null ? 'rgba(128,128,128,0.45)' : 'rgba(255,255,255,0.05)',
              border: `2px ${c === null ? 'solid' : 'dashed'} ${c === null && target === i && verdict ? arrowColor : 'var(--color-line-strong)'}`,
              boxSizing: 'border-box',
            }} />
          ))}
          {/* flecha de la jugada que se prueba */}
          {arrow && (
            <svg width={W} height={22} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden="true">
              <path d={`M ${arrow.x1} 20 Q ${(arrow.x1 + arrow.x2) / 2} -6 ${arrow.x2 - Math.sign(arrow.x2 - arrow.x1) * 3} 18`}
                fill="none" stroke={arrowColor} strokeWidth="2.5" strokeDasharray={verdict ? undefined : '5 4'} />
              <circle cx={arrow.x2} cy={20} r="3.5" fill={arrowColor} />
            </svg>
          )}
          {/* fichas: se animan al cambiar de casilla */}
          {board.map((c, i) => c && (
            <div key={c.id} className="demo-piece" style={{
              position: 'absolute', top: '22px', left: 0, width: `${CELL_W}px`, height: `${CELL_H}px`,
              transform: `translateX(${x(i) + (nudge?.id === c.id ? nudge.dx : 0)}px)`,
              transition: `transform ${nudge?.id === c.id ? 260 : 650}ms cubic-bezier(0.4, 0, 0.2, 1)`,
              zIndex: selected === i || hopId === c.id ? 3 : 2,
            }}>
              <div className={shakeId === c.id ? 'demo-shake' : hopId === c.id ? 'demo-hop' : undefined} style={{
                width: '100%', height: '100%', borderRadius: '8px', background: TEAM_HEX[c.team], boxSizing: 'border-box',
                boxShadow: selected === i ? '0 0 0 3px #ffffff' : '0 2px 6px rgba(0,0,0,0.45)',
              }} />
            </div>
          ))}
        </div>
      </div>

      <div role="status" aria-live="off" style={{
        minHeight: '82px', padding: '8px 10px', borderRadius: 'var(--radius)', background: 'var(--color-bg)',
        borderLeft: `4px solid ${verdict ? (verdict.ok ? 'var(--color-online)' : 'var(--color-offline)') : 'var(--color-line-strong)'}`,
      }}>
        {verdict ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '13px', color: verdict.ok ? 'var(--color-online)' : 'var(--color-offline)' }}>
              <span aria-hidden="true" style={{
                width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: verdict.ok ? 'var(--color-online)' : 'var(--color-offline)', color: '#0B0F10', fontSize: '12px',
              }}>{verdict.ok ? '✓' : '✕'}</span>
              {verdict.titulo}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-paper-dim)', lineHeight: 1.45, marginTop: '3px' }}>{verdict.texto}</div>
          </>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--color-paper-faint)', paddingTop: '4px' }}>
            {selected !== null ? 'Se prueba esta jugada…' : 'Mira qué pasa con cada jugada.'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
        <button onClick={() => setRunning(r => !r)} aria-label={running ? 'Pausar la animación' : 'Reproducir la animación'} style={{
          background: 'transparent', border: '1px solid var(--color-line-strong)', color: 'var(--color-paper-dim)', borderRadius: 'var(--radius)',
          padding: '2px 8px', fontSize: '11px', cursor: 'pointer',
        }}>{running ? '❚❚ Pausar' : '▶ Ver'}</button>
        <span style={{ ...sectionLabel, marginLeft: '4px' }}>Ejemplo</span>
        {scenes.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} aria-label={`Ejemplo ${i + 1}`} aria-current={i === sceneIdx} style={{
            width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
            background: i === sceneIdx ? 'var(--color-blue)' : 'transparent', color: i === sceneIdx ? '#fff' : 'var(--color-paper-dim)',
            border: `1px solid ${i === sceneIdx ? 'var(--color-blue)' : 'var(--color-line-strong)'}`,
          }}>{i + 1}</button>
        ))}
      </div>
    </div>
  )
}

function RuleBlock({ n, title, children, rule }: { n: number; title: string; children: ReactNode; rule: 1 | 2 | 3 }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--color-blue)', whiteSpace: 'nowrap' }}>Regla {n}</span>
        <span style={{ fontWeight: 700, fontSize: '15px' }}>{title}</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)', lineHeight: 1.55 }}>{children}</div>
      <Demo rule={rule} />
    </div>
  )
}

export default function RulesAnimation() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)', lineHeight: 1.55 }}>
        <b style={{ color: 'var(--color-paper)' }}>Objetivo:</b> intercambiar de posición los dos grupos de fichas: las rojas deben quedar en el lugar de las azules y viceversa.
        Hay una sola casilla vacía (gris) y cada jugada consiste en llevar una ficha a esa casilla.
        Debajo están las tres reglas del juego; cada ejemplo se anima y te dice si la jugada es <b style={{ color: 'var(--color-online)' }}>✓ válida</b> o <b style={{ color: 'var(--color-offline)' }}>✕ no válida</b> y por qué.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px' }}>
        <RuleBlock n={1} rule={1} title="Mover a la casilla vacía">
          Al tocar una ficha, esta se desplaza a la casilla vacía —solo a ella— si las otras dos reglas lo permiten.
          Puede <b>deslizarse</b> si la casilla vacía está pegada a ella (1 casilla) o <b>saltar</b> si está a 2 casillas. Sirve en los dos sentidos: ninguna ficha tiene una dirección fija.
        </RuleBlock>
        <RuleBlock n={2} rule={2} title="No volver a la posición inmediatamente anterior">
          No puedes deshacer de inmediato tu última jugada: la ficha que acabas de mover no puede regresar de una a la casilla de donde salió.
          Con otra jugada de por medio sí puedes volver a una posición anterior (por eso en el juego hay «bucles»). Si la única jugada que te queda es volver atrás, quedas bloqueado: es un «camino sin retorno».
        </RuleBlock>
        <RuleBlock n={3} rule={3} title="Saltar solo una pieza de color contrario">
          Para saltar, entre la ficha y la casilla vacía debe haber <b>una sola ficha</b> y debe ser de <b>otro color</b>.
          No se salta el propio color ni dos fichas a la vez.
        </RuleBlock>
      </div>
    </div>
  )
}
