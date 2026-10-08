import { useEffect, useRef, useState, type ReactNode } from 'react'
import { type Board, type Team, applyMove } from '../../core/simulation/laEscaleraRules'
import { classifyAttempt, explainError, successText } from '../../core/simulation/tutor'
import { sectionLabel } from '../../ui/styles'
// El mismo naranja con que el cubo físico avisa una jugada inválida
// (EFECTOS.INVALIDO): la pantalla y el hardware dicen lo mismo.
import { INVALIDO_HEX } from '../../core/ppa/ppaColors'
import { TEAM_HEX } from '../../ui/styles'

// Las tres reglas del libro (Figura 3.3), explicadas y en movimiento: cada
// regla muestra ejemplos que se animan en bucle, unos válidos (la ficha se
// desliza o salta a la casilla vacía) y otros no válidos (la ficha lo
// intenta, rebota y aparece el motivo). El veredicto de cada jugada lo
// calcula el mismo motor de reglas del juego (classifyAttempt), no está
// escrito a mano: la animación no puede contradecir a la partida.

type Beat = { from: number; to: number; ok?: string } // `ok`: texto opcional si la jugada es válida
export type Scene = { pattern: string; beats: Beat[] }

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
// Medidas reducidas para los pares de tableros de la tarjeta de error,
// que van uno al lado del otro.
const CELDA_CHICA = { w: 26, h: 30, gap: 5 }
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

type Verdict = { ok: boolean; titulo: string; texto: string } | null

// Una demostración: reproduce en bucle las escenas de una regla.
// `sinTexto` deja solo el tablero animado (el motivo se explica una vez al
// lado, no dos veces); `celda` permite dibujarlo más pequeño.
function Demo({ scenes, compacto = false, sinTexto = false, celda, tono, breve = false }: {
  scenes: Scene[]
  compacto?: boolean
  sinTexto?: boolean
  celda?: { w: number; h: number; gap: number }
  // Color con el que habla la animación: naranja cuando enseña el error,
  // verde cuando enseña la jugada correcta. Sin tono, el veredicto lo pone
  // cada jugada (la sección de reglas, donde se mezclan válidas e inválidas).
  tono?: 'error' | 'ok'
  // Ciclo corto, para las dos animaciones que acompañan a una falla.
  breve?: boolean
}) {
  const CW = celda?.w ?? CELL_W, CH = celda?.h ?? CELL_H, GP = celda?.gap ?? GAP
  const acento = tono === 'ok' ? 'var(--color-online)' : tono === 'error' ? INVALIDO_HEX : undefined
  const t = (normal: number, corto: number) => (breve ? corto : normal)
  const [sceneIdx, setSceneIdx] = useState(0)
  const [board, setBoard] = useState<Board>(() => boardOf(scenes[0].pattern))
  const [selected, setSelected] = useState<number | null>(null) // índice de la ficha que se prueba
  const [target, setTarget] = useState<number | null>(null)
  const [nudge, setNudge] = useState<{ id: number; dx: number } | null>(null)
  const [shakeId, setShakeId] = useState<number | null>(null)
  const [hopId, setHopId] = useState<number | null>(null)
  const [okId, setOkId] = useState<number | null>(null)
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
        await sleep(t(650, 420)); if (!alive) return
        for (const beat of scene.beats) {
          const piece = b[beat.from]!
          setSelected(beat.from); setTarget(beat.to); setVerdict(null)
          await sleep(t(750, 520)); if (!alive) return
          const res = classifyAttempt(b, beat.from, beat.to, prev)
          if (res.ok) {
            if (res.kind === 'saltar') { setHopId(piece.id); setTimeout(() => setHopId(null), 700) }
            setOkId(piece.id); setTimeout(() => setOkId(null), 720)
            prev = b
            b = applyMove(b, beat.from, beat.to)
            setBoard(b); setSelected(null)
            setVerdict({ ok: true, titulo: 'Jugada válida', texto: beat.ok ?? successText(res.kind, piece.team) })
            await sleep(t(1500, 950))
          } else {
            const dx = (beat.to - beat.from) * (CW + GP)
            setNudge({ id: piece.id, dx: dx * 0.4 }); await sleep(t(320, 260)); if (!alive) return
            setNudge({ id: piece.id, dx: 0 }); setShakeId(piece.id); setTimeout(() => setShakeId(null), 500)
            const e = explainError(res.error, piece.team)
            setVerdict({ ok: false, titulo: 'Jugada NO válida', texto: `${e.titulo}. ${e.texto}` })
            await sleep(t(1900, 1150))
          }
          if (!alive) return
        }
        setTarget(null); setSelected(null)
        await sleep(t(400, 260)); if (!alive) return
        sceneRef.current = (si + 1) % scenes.length
      }
    })()
    return () => { alive = false }
  }, [running, restart, scenes])

  function goTo(i: number) { sceneRef.current = i; setRunning(true); setRestart(r => r + 1) }

  const W = board.length * CW + (board.length - 1) * GP
  const x = (i: number) => i * (CW + GP)
  const arrow = selected !== null && target !== null ? { x1: x(selected) + CW / 2, x2: x(target) + CW / 2 } : null
  const arrowColor = acento ?? (verdict ? (verdict.ok ? 'var(--color-online)' : 'var(--color-offline)') : '#ffffff')

  return (
    <div style={acento ? ({ ['--tono-demo' as string]: acento } as React.CSSProperties) : undefined}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: compacto ? '2px 0 4px' : '8px 0 4px' }}>
        <div style={{ position: 'relative', width: `${W}px`, height: `${CH + 22}px` }}>
          {/* casillas de fondo (la vacía, más clara) */}
          {board.map((c, i) => (
            <div key={`s${i}`} style={{
              position: 'absolute', left: `${x(i)}px`, top: '22px', width: `${CW}px`, height: `${CH}px`, borderRadius: '8px',
              background: c === null ? 'rgba(128,128,128,0.45)' : 'rgba(255,255,255,0.05)',
              border: `2px ${c === null ? 'solid' : 'dashed'} ${c === null && target === i && (verdict || acento) ? arrowColor : 'var(--color-line-strong)'}`,
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
              position: 'absolute', top: '22px', left: 0, width: `${CW}px`, height: `${CH}px`,
              transform: `translateX(${x(i) + (nudge?.id === c.id ? nudge.dx : 0)}px)`,
              transition: `transform ${nudge?.id === c.id ? 260 : 650}ms cubic-bezier(0.4, 0, 0.2, 1)`,
              zIndex: selected === i || hopId === c.id ? 3 : 2,
            }}>
              <div className={[
                shakeId === c.id ? 'demo-shake' : '',
                hopId === c.id ? 'demo-hop' : '',
                okId === c.id ? 'demo-ok' : '',
              ].filter(Boolean).join(' ') || undefined} style={{
                width: '100%', height: '100%', borderRadius: '8px', background: TEAM_HEX[c.team], boxSizing: 'border-box',
                boxShadow: selected === i ? `0 0 0 3px ${acento ?? '#ffffff'}` : '0 2px 6px rgba(0,0,0,0.45)',
              }} />
            </div>
          ))}
        </div>
      </div>

      {sinTexto ? null : (
      <div role="status" aria-live="off" style={{
        minHeight: compacto ? '52px' : '82px', padding: '8px 10px', borderRadius: 'var(--radius)', background: 'var(--color-bg)',
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
            {selected !== null ? 'Se prueba esta jugada…' : compacto ? 'Así se ve la regla.' : 'Mira qué pasa con cada jugada.'}
          </div>
        )}
      </div>
      )}

      {compacto ? null : (
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
      )}
    </div>
  )
}

// ── Animación de la regla que se acaba de infringir ────────────────────────
// Con ver solo la jugada rechazada no se entiende qué habría que hacer en su
// lugar, así que cada error muestra DOS tableros animados que parten de la
// misma posición: el movimiento incorrecto («Así no») y uno correcto
// («Así sí»). El veredicto de ambos lo decide el mismo motor de reglas del
// juego, y scripts/verificarAnimaciones.ts comprueba que el de la izquierda
// sea siempre inválido por el motivo anunciado y el de la derecha, válido.
export const ESCENA_POR_ERROR: Record<string, {
  regla: number
  mal: Scene
  bien: Scene
  pieMal: string
  pieBien: string
}> = {
  ocupada: {
    regla: 1,
    mal: { pattern: 'AB_', beats: [{ from: 0, to: 1 }] },
    bien: { pattern: 'AB_', beats: [{ from: 1, to: 2 }] },
    pieMal: 'la ficha empuja hacia una casilla que ya está ocupada y rebota.',
    pieBien: 'la ficha que está junto a la casilla vacía se desliza hasta ella.',
  },
  lejos: {
    regla: 1,
    mal: { pattern: 'AAB_', beats: [{ from: 0, to: 3 }] },
    bien: { pattern: 'AAB_', beats: [{ from: 2, to: 3 }] },
    pieMal: 'la ficha intenta recorrer tres casillas de una sola vez.',
    pieBien: 'se mueve la ficha pegada al hueco: una casilla, deslizando.',
  },
  salto_propio: {
    regla: 3,
    mal: { pattern: 'AA_', beats: [{ from: 0, to: 2 }] },
    bien: { pattern: 'AA_', beats: [{ from: 1, to: 2 }] },
    pieMal: 'intenta saltar por encima de una ficha de su mismo color.',
    pieBien: 'en su lugar, la ficha vecina se desliza a la casilla vacía.',
  },
  salto_hueco: {
    regla: 3,
    mal: { pattern: 'A__', beats: [{ from: 0, to: 2 }] },
    bien: { pattern: 'A__', beats: [{ from: 0, to: 1 }] },
    pieMal: 'intenta saltar, pero al lado no hay ninguna ficha que saltar.',
    pieBien: 'con la casilla vacía al lado, avanza de a una casilla.',
  },
  regreso: {
    regla: 2,
    mal: {
      pattern: 'AA_BB',
      beats: [{ from: 1, to: 2, ok: 'Primero la azul se desliza a la casilla vacía.' }, { from: 2, to: 1 }],
    },
    bien: {
      pattern: 'AA_BB',
      beats: [{ from: 1, to: 2, ok: 'Primero la azul se desliza a la casilla vacía.' }, { from: 3, to: 1 }],
    },
    pieMal: 'la misma ficha vuelve de inmediato a la casilla de donde salió.',
    pieBien: 'se mueve otra ficha; después sí se puede volver por otro camino.',
  },
}

const TITULO_REGLA: Record<number, string> = {
  1: 'Regla 1 · Mover a la casilla vacía',
  2: 'Regla 2 · No volver a la posición inmediatamente anterior',
  3: 'Regla 3 · Saltar solo una pieza de color contrario',
}

// Un lado del par: el tablero animado, su veredicto y su pie. El color lo
// dice todo antes que el texto —naranja la jugada que no se puede, verde la
// que sí—, y es el mismo naranja con que el cubo físico avisa un movimiento
// inválido, para que el aprendiz asocie pantalla y cubo.
function Lado({ ok, escena, pie }: { ok: boolean; escena: Scene; pie: string }) {
  const color = ok ? 'var(--color-online)' : INVALIDO_HEX
  return (
    <div style={{
      border: `2px solid ${color}`, borderRadius: 'var(--radius)', padding: '6px 7px', minWidth: 0,
      background: ok ? 'rgba(66,190,101,0.07)' : 'rgba(255,140,0,0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
        <span aria-hidden="true" style={{
          width: '16px', height: '16px', borderRadius: '50%', background: color, color: '#0B0F10',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800,
        }}>{ok ? '✓' : '✕'}</span>
        <span style={{ ...sectionLabel, color, fontWeight: 700 }}>{ok ? 'Así sí' : 'Así no'}</span>
      </div>
      <Demo scenes={[escena]} compacto sinTexto breve celda={CELDA_CHICA} tono={ok ? 'ok' : 'error'} />
      <div style={{ fontSize: '11px', color: 'var(--color-paper-dim)', lineHeight: 1.4, marginTop: '4px' }}>{pie}</div>
    </div>
  )
}

export function AnimacionRegla({ error }: { error: string }) {
  const caso = ESCENA_POR_ERROR[error]
  if (!caso) return null
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
      <div style={{ ...sectionLabel, color: INVALIDO_HEX, marginBottom: '6px', lineHeight: 1.3 }}>{TITULO_REGLA[caso.regla]}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
        <Lado ok={false} escena={caso.mal} pie={caso.pieMal} />
        <Lado ok escena={caso.bien} pie={caso.pieBien} />
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
      <Demo scenes={SCENES[rule]} />
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
