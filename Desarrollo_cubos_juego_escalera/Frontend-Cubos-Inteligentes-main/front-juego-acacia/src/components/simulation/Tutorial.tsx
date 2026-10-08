import { useMemo, useRef, useState } from 'react'
import {
  type Board, createInitialBoard, computeWinBoard, boardsEqual, legalMovesFor, applyMove,
} from '../../core/simulation/laEscaleraRules'
import {
  classifyAttempt, explainError, whyNoMoves, successText, optimalMoves, solve, TEAM_NAME, LEVELS, starsFor,
} from '../../core/simulation/tutor'
import { type BitacoraEvent, nowIso, toCsv, downloadFile } from '../../core/simulation/bitacora'
import { playError, playTone, playAscending } from '../../core/utils/ppaTones'
import { Panel, SectionTitle, Collapsible, LogPanel } from '../../ui/brand'
import { sectionLabel, sessionBtn } from '../../ui/styles'
import SimBoard, { type BoardHint } from './SimBoard'
import RulesCard, { MiniBoard } from './RulesCard'
import RulesAnimation, { AnimacionRegla } from './RulesAnimation'
import InformeNivel from '../informe/InformeNivel'
import { BotonInformeNivel } from '../informe/botones'
import { metricasDeIntento } from '../../core/simulation/metricas'
import { useSesion } from '../../core/session/sesion'
import GrafoEstados from './GrafoEstados'
import Workbench from './Workbench'
import { buildStateGraph } from '../../core/simulation/stateGraph'

// Tutorial por niveles, de 1 a 5 pares: cada nivel presenta su objetivo,
// acompaña cada jugada con un mensaje en pantalla (qué salió bien, qué
// regla se rompió y por qué), avisa cuando la partida ya no puede ganarse
// antes de llegar al bloqueo, y ofrece Pista y Deshacer. Pensado para que
// cualquier persona — de niños a adultos mayores — aprenda las reglas
// jugando, sin necesitar a alguien al lado que se las explique.

type Tone = 'info' | 'ok' | 'error' | 'warn'
type Feedback = { tone: Tone; titulo: string; texto: string }
const TONE_COLOR: Record<Tone, string> = {
  info: 'var(--color-blue)', ok: 'var(--color-online)', error: 'var(--color-offline)', warn: 'var(--color-caution)',
}

const VERSION = 'tutorial-niveles-v1'

// Lista vacía estable: `?? []` crearía un arreglo nuevo en cada render.
const SIN_RECORRIDOS: number[][] = []

function Stars({ n, size = 28 }: { n: number; size?: number }) {
  return (
    <span aria-label={`${n} de 3 estrellas`} style={{ display: 'inline-flex', gap: '4px' }}>
      {[1, 2, 3].map(i => (
        <span key={i} style={{ fontSize: `${size}px`, lineHeight: 1, color: i <= n ? 'var(--color-caution)' : 'var(--color-line-strong)' }}>★</span>
      ))}
    </span>
  )
}

function Tutorial({ level, operatorId, participante, onComplete, onGoToLevel, onFinishAll }: {
  level: number
  operatorId: string
  participante: string
  onComplete: (level: number, stars: number) => void
  onGoToLevel: (level: number) => void
  onFinishAll: () => void
}) {
  const sesion = useSesion()
  const [phase, setPhase] = useState<'intro' | 'jugando' | 'superado'>('intro')
  const [board, setBoard] = useState<Board>(() => createInitialBoard(level))
  const [history, setHistory] = useState<Board[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<BoardHint>(null)
  const [errorCell, setErrorCell] = useState<number | null>(null)
  // Última regla infringida, para mostrar su animación junto al mensaje.
  const [reglaRota, setReglaRota] = useState<string | null>(null)
  const [deadEnd, setDeadEnd] = useState(false)
  const [counts, setCounts] = useState({ moves: 0, errors: 0, hints: 0, undos: 0 })
  const [feedback, setFeedback] = useState<Feedback>(introFeedback())
  const [events, setEvents] = useState<BitacoraEvent[]>([])
  const [rulesOpen, setRulesOpen] = useState(level === 1)
  const [logOpen, setLogOpen] = useState(true)
  const [informeAbierto, setInformeAbierto] = useState(false)
  const inicioRef = useRef(Date.now())
  // Recorridos de intentos ya terminados, por nivel (cada nivel es otro grafo).
  const [previosPorNivel, setPreviosPorNivel] = useState<Record<number, number[][]>>({})

  // Los intentos terminados viven en la sesión (no en estado local): así el
  // informe del nivel y la numeración sobreviven al cambio de pestaña.
  const intentosTutorial = sesion.intentos.filter(i => i.seccion === 'tutorial')
  const intentosDelNivel = intentosTutorial.filter(i => i.pares === level)

  const win = computeWinBoard(createInitialBoard(level))
  const graph = buildStateGraph(level)
  // Tablero anterior (Regla 2: no se vuelve a la posición inmediatamente anterior).
  const prev: Board | null = history.length ? history[history.length - 1] : null
  // El recorrido del intento en curso se deduce de las jugadas vigentes
  // (al deshacer, el último paso sale del recorrido). Memorizado: si cambiara
  // de identidad en cada render, el grafo recalcularía intensidades de miles
  // de nodos por cada pulsación.
  const actual = useMemo(() => [...history, board].map(b => graph.nodeIdOf(b)), [history, board, graph])
  const previos = useMemo(() => previosPorNivel[level] ?? SIN_RECORRIDOS, [previosPorNivel, level])

  function archivar(nivel: number) {
    // Se convierte con el grafo de ESE nivel: al cambiar de nivel, el tablero
    // vigente todavía es el del nivel anterior.
    const g = buildStateGraph(nivel)
    const path = [...history, board].map(b => g.nodeIdOf(b))
    if (path.length > 1 && !path.includes(-1)) setPreviosPorNivel(p => ({ ...p, [nivel]: [...(p[nivel] ?? []), path] }))
  }
  const optimal = optimalMoves(level)
  const info = LEVELS[level]

  function introFeedback(): Feedback {
    return { tone: 'info', titulo: 'Tu turno', texto: 'Toca una ficha para ver a dónde puede ir, y luego toca la casilla marcada AQUÍ. También puedes arrastrarla.' }
  }

  function log(partial: Omit<BitacoraEvent, 'timestamp' | 'esSimulacion' | 'operadorId' | 'participanteId' | 'versionConfiguracion' | 'pares' | 'posiciones' | 'nivel' | 'nodoGrafo'>, b: Board) {
    const ev: BitacoraEvent = {
      timestamp: nowIso(), esSimulacion: true, operadorId: operatorId || '(sin asignar)', participanteId: participante || '(sin nombre)',
      versionConfiguracion: VERSION, pares: level, nivel: level, posiciones: b.map(c => c?.id ?? null), nodoGrafo: graph.nodeIdOf(b), ...partial,
    }
    setEvents(prev => [...prev, ev])
    sesion.registrarEvento({
      seccion: 'tutorial', ts: ev.timestamp, tipo: ev.tipo, detalle: ev.detalle,
      errorTipo: ev.errorTipo, pares: level, nivel: level, nodoGrafo: ev.nodoGrafo,
    })
  }

  function reset(toPhase: 'intro' | 'jugando') {
    const initial = createInitialBoard(level)
    archivar(level)
    setBoard(initial)
    setHistory([])
    setSelected(null)
    setHint(null)
    setErrorCell(null)
    setDeadEnd(false)
    setCounts({ moves: 0, errors: 0, hints: 0, undos: 0 })
    setFeedback(introFeedback())
    inicioRef.current = Date.now()
    setPhase(toPhase)
    if (toPhase === 'jugando') log({ tipo: 'intento_iniciado', detalle: `Nivel ${level} (${level} par${level > 1 ? 'es' : ''}) iniciado` }, initial)
  }

  // Cambio de nivel desde la barra lateral: se reinicia sin useEffect para
  // no pintar un cuadro con el tablero del nivel anterior.
  const [levelSeen, setLevelSeen] = useState(level)
  if (levelSeen !== level) {
    archivar(levelSeen)
    setLevelSeen(level)
    const initial = createInitialBoard(level)
    setBoard(initial); setHistory([]); setSelected(null); setHint(null); setErrorCell(null); setDeadEnd(false)
    setCounts({ moves: 0, errors: 0, hints: 0, undos: 0 }); setFeedback(introFeedback()); setPhase('intro')
    setRulesOpen(level === 1)
  }

  function handleSelect(i: number | null) {
    setErrorCell(null)
    setSelected(i)
    if (i === null || !board[i]) return
    const piece = board[i]!
    if (legalMovesFor(board, i, prev).length === 0) {
      setFeedback({ tone: 'warn', titulo: `La ficha ${piece.id} no puede moverse ahora`, texto: `${whyNoMoves(board, i, prev)} Prueba con otra ficha.` })
    } else {
      setFeedback({ tone: 'info', titulo: `Elegiste la ficha ${TEAM_NAME[piece.team].ficha} ${piece.id}`, texto: 'Ahora toca la casilla marcada AQUÍ (o arrastra la ficha hasta ella).' })
    }
  }

  function handleMove(from: number, to: number) {
    const res = classifyAttempt(board, from, to, prev)
    if (!res.ok) return
    setReglaRota(null)
    const piece = board[from]!
    const next = applyMove(board, from, to)
    const moves = counts.moves + 1
    setHistory(h => [...h, board])
    setBoard(next)
    setSelected(null)
    setHint(null)
    setErrorCell(null)
    setCounts(c => ({ ...c, moves }))
    log({ tipo: 'movimiento', detalle: `Ficha ${piece.id} (${res.kind}) de la posición ${from + 1} a la ${to + 1}` }, next)

    if (boardsEqual(next, win)) {
      const stars = starsFor(counts.errors, counts.hints, counts.undos)
      const recorrido = [...history, board, next].map(b => graph.nodeIdOf(b))
      const m = metricasDeIntento(level, recorrido)
      const seg = Math.round((Date.now() - inicioRef.current) / 1000)
      sesion.registrarIntento({
        seccion: 'tutorial', numero: intentosTutorial.length + 1, pares: level, resultado: 'victoria',
        segundos: seg, errores: counts.errors, recorrido, metricas: m,
      })
      setPhase('superado')
      setDeadEnd(false)
      playAscending(523, 1046, 0.5)
      log({ tipo: 'nivel_superado', detalle: `Nivel ${level} superado · ${stars}★ · ${counts.errors} errores, ${counts.hints} pistas, ${counts.undos} deshacer` }, next)
      onComplete(level, stars)
      return
    }

    if (!solve(next, win, board)) {
      const noMoves = !next.some((c, i) => c && legalMovesFor(next, i, board).length > 0)
      setDeadEnd(true)
      playError()
      setFeedback(noMoves
        ? { tone: 'warn', titulo: 'Te quedaste sin movimientos', texto: 'Ninguna jugada está permitida (solo quedaría volver a la posición anterior, y eso no se puede) y todavía no cambiaron de lado. Toca «Deshacer» para volver atrás, o «Empezar de nuevo».' }
        : { tone: 'warn', titulo: 'Camino sin salida', texto: 'Esa jugada es válida, pero desde aquí ya no se puede completar el cambio. Toca «Deshacer» para volver un paso atrás y probar otra ficha.' })
      log({ tipo: 'callejon_sin_salida', detalle: noMoves ? 'Bloqueo: sin movimientos legales' : 'Jugada válida que impide ganar' }, next)
      return
    }

    setDeadEnd(false)
    playTone(660, 0.07, 0.15)
    setFeedback({ tone: 'ok', titulo: successText(res.kind, piece.team, to > from ? 'derecha' : 'izquierda'), texto: `Llevas ${moves} de ${optimal} movimientos. Sigue así.` })
  }

  function handleInvalid(from: number, to: number) {
    if (from === to) return
    const res = classifyAttempt(board, from, to, prev)
    if (res.ok) return
    const piece = board[from]!
    const { titulo, texto } = explainError(res.error, piece.team)
    const canMove = legalMovesFor(board, from, prev).length > 0
    playError()
    setErrorCell(to)
    setReglaRota(res.error)
    setSelected(canMove ? from : null)
    setCounts(c => ({ ...c, errors: c.errors + 1 }))
    setFeedback({
      tone: 'error', titulo, texto: canMove
        ? `${texto} Esta ficha sí puede ir a la casilla marcada AQUÍ.`
        : `${texto} Además, esta ficha no puede moverse ahora: prueba con otra.`,
    })
    log({ tipo: 'falla', errorTipo: res.error, detalle: `Ficha ${piece.id} a la posición ${to + 1}: ${titulo}` }, board)
  }

  function pedirPista() {
    const path = solve(board, win, prev)
    if (!path || path.length === 0) {
      setFeedback({ tone: 'warn', titulo: 'No hay pista desde aquí', texto: 'Esta posición ya no tiene salida. Toca «Deshacer» para volver atrás.' })
      return
    }
    const step = path[0]
    const piece = board[step.from]!
    setHint(step)
    setSelected(null)
    setErrorCell(null)
    setCounts(c => ({ ...c, hints: c.hints + 1 }))
    setFeedback({ tone: 'info', titulo: 'Pista', texto: `Mueve la ficha ${TEAM_NAME[piece.team].ficha} ${piece.id} a la casilla marcada PISTA.` })
    log({ tipo: 'pista', detalle: `Pista: ficha ${piece.id} de la posición ${step.from + 1} a la ${step.to + 1}` }, board)
  }

  function deshacer() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    setBoard(prev)
    setSelected(null)
    setHint(null)
    setErrorCell(null)
    setDeadEnd(false)
    setCounts(c => ({ ...c, moves: c.moves - 1, undos: c.undos + 1 }))
    setFeedback({ tone: 'info', titulo: 'Volviste un paso atrás', texto: 'Prueba con otra ficha. Si dudas, toca «Pista».' })
    log({ tipo: 'deshacer', detalle: 'Se deshizo la última jugada' }, prev)
  }

  function exportCsv() { downloadFile(`bitacora-tutorial-${Date.now()}.csv`, toCsv(events), 'text/csv;charset=utf-8') }
  function exportJson() { downloadFile(`bitacora-tutorial-${Date.now()}.json`, JSON.stringify(events, null, 2), 'application/json') }

  const startPattern = 'A'.repeat(level) + '_' + 'B'.repeat(level)
  const endPattern = 'B'.repeat(level) + '_' + 'A'.repeat(level)
  const stars = starsFor(counts.errors, counts.hints, counts.undos)

  const left = (
    <>
      {phase === 'intro' && (
        <Panel style={{ padding: '22px 24px' }}>
          <div style={{ ...sectionLabel, color: 'var(--color-blue)' }}>Nivel {level} de 5 · {level} par{level > 1 ? 'es' : ''} de fichas</div>
          <div style={{ fontSize: '26px', fontWeight: 700, margin: '6px 0 16px' }}>{info.titulo}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'flex-end', marginBottom: '18px' }}>
            <div>
              <div style={{ ...sectionLabel, marginBottom: '8px' }}>Así empieza</div>
              <MiniBoard pattern={startPattern} size={30} />
            </div>
            <span aria-hidden="true" style={{ fontSize: '22px', color: 'var(--color-paper-faint)', paddingBottom: '6px' }}>⟶</span>
            <div>
              <div style={{ ...sectionLabel, marginBottom: '8px' }}>Así tiene que terminar</div>
              <MiniBoard pattern={endPattern} size={30} />
            </div>
          </div>
          <div style={{ fontSize: '15px', lineHeight: 1.6, maxWidth: '720px' }}>
            Las fichas <b style={{ color: '#6f9dff' }}>azules</b> tienen que llegar a la derecha y las <b style={{ color: 'var(--color-red)' }}>rojas</b> a la izquierda.
            {' '}{info.consejo}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '14px 0 20px' }}>
            <span style={{ ...sectionLabel, alignSelf: 'center', marginRight: '4px' }}>Vas a practicar</span>
            {info.practica.map(p => (
              <span key={p} style={{ fontSize: '12px', padding: '3px 10px', border: '1px solid var(--color-line-strong)', borderRadius: '20px', color: 'var(--color-paper-dim)' }}>{p}</span>
            ))}
          </div>
          <button onClick={() => reset('jugando')} style={{ ...sessionBtn(true, 'var(--color-blue)'), fontSize: '15px', padding: '12px 28px' }}>¡Empezar!</button>
        </Panel>
      )}

      {phase === 'jugando' && (
        <div style={{
          background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderLeft: `4px solid ${TONE_COLOR[feedback.tone]}`,
          borderRadius: 'var(--radius)', padding: '14px 18px', display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ ...sectionLabel, color: TONE_COLOR[feedback.tone] }}>
              Nivel {level} · {feedback.tone === 'error' ? 'Movimiento no permitido' : feedback.tone === 'warn' ? 'Atención' : feedback.tone === 'ok' ? 'Correcto' : 'Guía'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0' }}>{feedback.titulo}</div>
            <div style={{ fontSize: '14px', color: 'var(--color-paper-dim)', lineHeight: 1.5 }}>{feedback.texto}</div>
          </div>
          {feedback.tone === 'error' && reglaRota && (
            <div style={{ flex: '1 1 330px', minWidth: '240px', maxWidth: '430px' }}><AnimacionRegla error={reglaRota} /></div>
          )}
          <div style={{ minWidth: '190px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...sectionLabel }}>
              <span>Movimientos</span><span style={{ color: 'var(--color-paper)' }}>{counts.moves} / {optimal}</span>
            </div>
            <div style={{ height: '6px', background: 'var(--color-bg)', borderRadius: '3px', margin: '6px 0 8px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(counts.moves / optimal, 1) * 100}%`, background: 'var(--color-blue)' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--color-paper-dim)' }}>
              <span>Errores <b style={{ color: counts.errors ? 'var(--color-offline)' : 'var(--color-paper)' }}>{counts.errors}</b></span>
              <span>Pistas <b style={{ color: 'var(--color-paper)' }}>{counts.hints}</b></span>
              <span>Deshacer <b style={{ color: 'var(--color-paper)' }}>{counts.undos}</b></span>
            </div>
          </div>
        </div>
      )}

      {phase === 'superado' && (
        <Panel style={{ padding: '22px 24px', borderColor: 'var(--color-online)', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ ...sectionLabel, color: 'var(--color-online)' }}>Nivel {level} superado</div>
            <div style={{ fontSize: '26px', fontWeight: 700, margin: '6px 0' }}>
              {level === 5 ? '¡Completaste el tutorial!' : '¡Lo lograste!'}
            </div>
            <Stars n={stars} />
            <div style={{ fontSize: '14px', color: 'var(--color-paper-dim)', marginTop: '8px', lineHeight: 1.5 }}>
              {counts.moves} movimientos · {counts.errors} errores · {counts.hints} pistas · {counts.undos} veces deshacer.
              {stars < 3 && ' Para 3 estrellas, termina sin errores, sin pistas y sin deshacer.'}
              {level === 5 && ' Ya conoces todas las reglas de La Escalera.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => reset('jugando')} style={sessionBtn(true, 'var(--color-line-strong)')}>Repetir nivel</button>
            <BotonInformeNivel onClick={() => setInformeAbierto(true)} pares={level} intentos={intentosDelNivel.length} />
            {level < 5
              ? <button onClick={() => onGoToLevel(level + 1)} style={{ ...sessionBtn(true, 'var(--color-blue)'), fontSize: '15px' }}>Siguiente nivel →</button>
              : <button onClick={onFinishAll} style={{ ...sessionBtn(true, 'var(--color-blue)'), fontSize: '15px' }}>Ir a simulación libre →</button>}
          </div>
        </Panel>
      )}

      {phase !== 'intro' && (
        <Panel>
          <SectionTitle right={
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>toca y toca, o arrastra</span>
              {intentosDelNivel.length > 0 && (
                <button onClick={() => setInformeAbierto(true)} style={{
                  background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: '11px', color: 'var(--color-blue)', textDecoration: 'underline',
                }}>informe del nivel ({intentosDelNivel.length})</button>
              )}
            </span>
          }>
            Tablero · nivel {level}
          </SectionTitle>
          <SimBoard
            board={board}
            prev={prev}
            disabled={phase !== 'jugando'}
            selected={selected}
            onSelect={handleSelect}
            onMove={handleMove}
            onInvalid={handleInvalid}
            hint={hint}
            errorCell={errorCell}
          />
          {phase === 'jugando' && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
              <button onClick={pedirPista} style={{ ...sessionBtn(true, 'var(--color-caution)'), color: '#1a1300' }}>Pista</button>
              <button onClick={deshacer} disabled={history.length === 0}
                style={sessionBtn(history.length > 0, deadEnd ? 'var(--color-blue)' : 'var(--color-line-strong)')}>Deshacer</button>
              <button onClick={() => reset('jugando')} style={sessionBtn(true, 'var(--color-line-strong)')}>Empezar de nuevo</button>
            </div>
          )}
        </Panel>
      )}

      <Collapsible title="¿Cómo se juega? — las 3 reglas, explicadas y en movimiento" open={rulesOpen} onToggle={() => setRulesOpen(o => !o)}>
        <RulesAnimation />
        <RulesCard resumen />
      </Collapsible>

      <Collapsible title="Bitácora del tutorial" open={logOpen} onToggle={() => setLogOpen(o => !o)}>
        <LogPanel
          title="Bitácora del tutorial (simulación)"
          rows={events.map(e => ({ ts: e.timestamp, tag: `N${e.nivel} ${e.tipo}`, text: `${e.participanteId} · ${e.detalle}` }))}
          empty="Sin eventos todavía."
          onCsv={exportCsv} onJson={exportJson} maxHeight={220} />
      </Collapsible>
    </>
  )

  const graphPanel = (
    <Panel style={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionTitle>Grafo de estados · {level} par{level > 1 ? 'es' : ''} — todas las posiciones del juego</SectionTitle>
      <div style={{ flex: 1, minHeight: 0 }}>
        <GrafoEstados pares={level} previos={previos} actual={actual}
          terminado={phase === 'superado'} />
      </div>
    </Panel>
  )

  return (
    <>
      <Workbench left={left} right={graphPanel} offset={300} />
      {/* El informe del nivel se abre en una ventana emergente, no como un
          panel más bajo el tablero: así se lee completo y no desordena la
          pantalla de juego. */}
      {informeAbierto && <InformeNivel seccion="tutorial" pares={level} onCerrar={() => setInformeAbierto(false)} />}
    </>
  )
}

export default Tutorial
