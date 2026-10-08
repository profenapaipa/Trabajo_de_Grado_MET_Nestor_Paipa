import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type Board, createInitialBoard, computeWinBoard, boardsEqual, isStuck, applyMove,
} from '../../core/simulation/laEscaleraRules'
import { classifyAttempt, explainError, successText } from '../../core/simulation/tutor'
import { type BitacoraEvent, type PPAPhase, nowIso, toCsv, downloadFile } from '../../core/simulation/bitacora'
import { playPpaFeedback, playError, playCountdownBeep } from '../../core/utils/ppaTones'
import { PPA_HEX, PPA_TEXT, PPA_LABEL, FALLAS_PARA_PAUSAR, AUTO_OFF_MS, ppaRgba } from '../../core/ppa/ppaColors'
import { Panel, SectionTitle, Collapsible, LogPanel, SignalGlyph } from '../../ui/brand'
import { sectionLabel, sessionBtn, countdownSemaforo } from '../../ui/styles'
import PpaChargeMeter from './PpaChargeMeter'
import SimBoard from './SimBoard'
import { AnimacionRegla } from './RulesAnimation'
import GrafoEstados from './GrafoEstados'
import Workbench from './Workbench'
import EndBanner from './EndBanner'
import InformeNivel from '../informe/InformeNivel'
import { BotonInformeNivel } from '../informe/botones'
import { metricasDeIntento } from '../../core/simulation/metricas'
import { useSesion } from '../../core/session/sesion'
import { buildStateGraph } from '../../core/simulation/stateGraph'

// Práctica libre: el juego completo sin ayudas del tutorial (sin pistas ni
// deshacer), organizado en intentos numerados igual que Control Mago de Oz
// — Iniciar intento con la cuenta regresiva en semáforo, Reiniciar con
// confirmación — y con la sugerencia PPA simulada: dos fallas seguidas
// sugieren Pausar; el operador confirma o descarta, nunca se activa sola.
// Cada error se explica en pantalla, igual que en el tutorial.

type SessionState = 'inactivo' | 'cuenta' | 'jugando' | 'victoria' | 'bloqueado'
const VERSION = 'sim-config-v0.2'

// Lista vacía estable: `?? []` crearía un arreglo nuevo en cada render.
const SIN_RECORRIDOS: number[][] = []

function PracticaLibre({ pares, operatorId, participante }: { pares: number; operatorId: string; participante: string }) {
  const sesion = useSesion()
  const [session, setSession] = useState<SessionState>('inactivo')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [board, setBoard] = useState<Board>(() => createInitialBoard(pares))
  const [prevBoard, setPrevBoard] = useState<Board | null>(null) // Regla 2
  const [selected, setSelected] = useState<number | null>(null)
  const [errorCell, setErrorCell] = useState<number | null>(null)
  const [moves, setMoves] = useState(0)
  const [errors, setErrors] = useState(0)
  const [fallaCount, setFallaCount] = useState(0)
  const [intento, setIntento] = useState(0)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null)
  // Qué regla se infringió en la última jugada rechazada, y su explicación.
  const [fallo, setFallo] = useState<{ error: string; titulo: string; texto: string } | null>(null)
  const [suggestion, setSuggestion] = useState<{ fase: PPAPhase; motivo: string } | null>(null)
  const [discardReason, setDiscardReason] = useState('')
  const [lastActivation, setLastActivation] = useState<{ fase: PPAPhase; at: string } | null>(null)
  const [events, setEvents] = useState<BitacoraEvent[]>([])
  const [confirmReset, setConfirmReset] = useState(false)
  const [actuarThresholdSec, setActuarThresholdSec] = useState(8)
  const [logOpen, setLogOpen] = useState(true)
  // Recorridos sobre el grafo de estados: el del intento en curso y los de
  // los intentos ya terminados (por cantidad de pares: cada una es otro grafo).
  const [actual, setActual] = useState<number[]>([1])
  const [previosPorPares, setPreviosPorPares] = useState<Record<number, number[][]>>({})
  const [, setTick] = useState(0)
  const startRef = useRef(0)
  const [finalMs, setFinalMs] = useState(0) // duración del intento al terminar (el cronómetro se queda ahí)
  const [informeAbierto, setInformeAbierto] = useState(false)
  const turnStartRef = useRef(Date.now())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const intentoRef = useRef(0)

  const win = computeWinBoard(createInitialBoard(pares))
  const graph = buildStateGraph(pares)
  // Los intentos terminados viven en la sesión: el informe del nivel y su
  // conteo no se pierden al cambiar de pestaña.
  const intentosDelNivel = useMemo(
    () => sesion.intentos.filter(i => i.seccion === 'libre' && i.pares === pares),
    [sesion.intentos, pares])
  const previos = useMemo(() => previosPorPares[pares] ?? SIN_RECORRIDOS, [previosPorPares, pares])

  // Guarda el intento terminado con sus métricas (ecuaciones de main.tex §3.3).
  function registrarIntento(recorrido: number[], resultado: 'victoria' | 'bloqueo' | 'reiniciado', ms: number) {
    const m = metricasDeIntento(pares, recorrido)
    const seg = Math.round(ms / 1000)
    sesion.registrarIntento({
      seccion: 'libre', numero: intentoRef.current, pares, resultado,
      segundos: seg, errores: errors, recorrido, metricas: m,
    })
  }

  function archivar(paresDelRecorrido: number) {
    if (actual.length > 1) setPreviosPorPares(p => ({ ...p, [paresDelRecorrido]: [...(p[paresDelRecorrido] ?? []), actual] }))
  }

  useEffect(() => {
    if (session !== 'jugando') return
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [session])

  useEffect(() => {
    if (!confirmReset) return
    const t = setTimeout(() => setConfirmReset(false), 4000)
    return () => clearTimeout(t)
  }, [confirmReset])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  function log(partial: Omit<BitacoraEvent, 'timestamp' | 'esSimulacion' | 'operadorId' | 'participanteId' | 'versionConfiguracion' | 'pares' | 'posiciones' | 'intentoNum' | 'nodoGrafo'>, b: Board) {
    const ev: BitacoraEvent = {
      timestamp: nowIso(), esSimulacion: true, operadorId: operatorId || '(sin asignar)', participanteId: participante || '(sin nombre)',
      versionConfiguracion: VERSION, pares, posiciones: b.map(c => c?.id ?? null),
      intentoNum: intentoRef.current || undefined, nodoGrafo: graph.nodeIdOf(b), ...partial,
    }
    setEvents(prev => [...prev, ev])
    sesion.registrarEvento({
      seccion: 'libre', ts: ev.timestamp, tipo: ev.tipo, detalle: ev.detalle,
      errorTipo: ev.errorTipo, pares, intentoNum: ev.intentoNum, nodoGrafo: ev.nodoGrafo,
    })
  }

  function abortToIdle(newPares: number) {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setCountdown(null)
    setBoard(createInitialBoard(newPares))
    setPrevBoard(null)
    setActual([1])
    setSelected(null); setErrorCell(null); setSuggestion(null); setMessage(null); setFallo(null)
    setMoves(0); setErrors(0); setFallaCount(0)
    setSession('inactivo')
  }

  // Cambiar los pares aborta el intento en curso (sin useEffect para no
  // pintar un cuadro con el tablero anterior).
  const [paresSeen, setParesSeen] = useState(pares)
  if (paresSeen !== pares) {
    archivar(paresSeen)
    setParesSeen(pares)
    abortToIdle(pares)
  }

  function iniciarIntento() {
    const n = intento + 1
    intentoRef.current = n
    setIntento(n)
    const initial = createInitialBoard(pares)
    archivar(pares)
    setActual([1])
    setPrevBoard(null)
    setBoard(initial)
    setSelected(null); setErrorCell(null); setSuggestion(null); setMessage(null); setFallo(null); setLastActivation(null)
    setMoves(0); setErrors(0); setFallaCount(0)
    setSession('cuenta')
    log({ tipo: 'intento_iniciado', detalle: `Intento #${n} iniciado (${pares} pares)` }, initial)
    timers.current.forEach(clearTimeout)
    timers.current = ([3, 2, 1, 0] as const).map((t, i) => setTimeout(() => {
      setCountdown(t)
      playCountdownBeep(t)
      if (t === 0) {
        startRef.current = Date.now()
        turnStartRef.current = Date.now()
        setSession('jugando')
        timers.current.push(setTimeout(() => setCountdown(null), 600))
      }
    }, i * 1000))
  }

  function reiniciar() {
    log({ tipo: 'reinicio', detalle: `Intento #${intentoRef.current} reiniciado por el operador` }, board)
    // Un intento abandonado a medias también se registra: su recorrido parcial
    // es dato para el análisis, y sin él el informe de sesión perdería intentos.
    if (session === 'jugando' && actual.length > 1) {
      registrarIntento(actual, 'reiniciado', Date.now() - startRef.current)
    }
    archivar(pares)
    abortToIdle(pares)
  }

  function handleMove(from: number, to: number) {
    const res = classifyAttempt(board, from, to, prevBoard)
    if (!res.ok) return
    const piece = board[from]!
    const next = applyMove(board, from, to)
    const m = moves + 1
    setPrevBoard(board)
    setBoard(next); setSelected(null); setErrorCell(null)
    setActual(a => [...a, graph.nodeIdOf(next)])
    setMoves(m); setFallaCount(0)
    turnStartRef.current = Date.now()
    setFallo(null)
    setMessage({ tone: 'ok', text: successText(res.kind, piece.team, to > from ? 'derecha' : 'izquierda') })
    log({ tipo: 'movimiento', detalle: `Ficha ${piece.id} (${res.kind}) de la posición ${from + 1} a la ${to + 1}` }, next)
    if (boardsEqual(next, win)) {
      const ms = Date.now() - startRef.current
      setFinalMs(ms)
      registrarIntento([...actual, graph.nodeIdOf(next)], 'victoria', ms)
      setSession('victoria')
      log({ tipo: 'victoria', detalle: `Intento #${intentoRef.current}: intercambio completo en ${m} movimientos y ${Math.round((Date.now() - startRef.current) / 1000)}s` }, next)
    } else if (isStuck(next, win, board)) {
      const ms = Date.now() - startRef.current
      setFinalMs(ms)
      registrarIntento([...actual, graph.nodeIdOf(next)], 'bloqueo', ms)
      setSession('bloqueado')
      log({ tipo: 'derrota', detalle: `Intento #${intentoRef.current}: ninguna jugada permitida (bloqueo)` }, next)
    }
  }

  function handleInvalid(from: number, to: number) {
    if (from === to) return
    const res = classifyAttempt(board, from, to, prevBoard)
    if (res.ok) return
    const piece = board[from]!
    const { titulo, texto } = explainError(res.error, piece.team)
    playError()
    setErrorCell(to)
    setErrors(e => e + 1)
    setFallo({ error: res.error, titulo, texto })
    setMessage({ tone: 'error', text: `${titulo}. ${texto}` })
    log({ tipo: 'falla', errorTipo: res.error, detalle: `Ficha ${piece.id} a la posición ${to + 1}: ${titulo}` }, board)
    const nf = fallaCount + 1
    if (nf >= FALLAS_PARA_PAUSAR && suggestion === null) {
      setFallaCount(0)
      setSuggestion({ fase: 'pausar', motivo: 'dos fallas consecutivas' })
      log({ tipo: 'sugerencia_ppa', fase: 'pausar', motivo: 'dos fallas consecutivas', detalle: 'Sugerencia de Pausar emitida' }, board)
    } else {
      setFallaCount(nf)
    }
  }

  function resolveSuggestion(decision: 'confirmada' | 'descartada') {
    if (!suggestion) return
    const { fase, motivo } = suggestion
    log({
      tipo: 'decision_ppa', fase, motivo, decision,
      motivoDescarte: decision === 'descartada' ? (discardReason.trim() || 'sin especificar') : undefined,
      activacionEfectiva: decision === 'confirmada',
      detalle: `Fase ${fase.toUpperCase()} ${decision} por el operador`,
    }, board)
    setSuggestion(null)
    setDiscardReason('')
    if (decision === 'confirmada') {
      setLastActivation({ fase, at: nowIso() })
      playPpaFeedback(fase, AUTO_OFF_MS / 1000)
      if (fase === 'pausar') {
        const next = { fase: 'pensar' as PPAPhase, motivo: 'encadenado tras confirmar Pausar (mismo ciclo)' }
        setSuggestion(next)
        log({ tipo: 'sugerencia_ppa', fase: next.fase, motivo: next.motivo, detalle: 'Sugerencia de Pensar emitida (encadenada)' }, board)
      }
    }
  }

  function exportCsv() { downloadFile(`bitacora-practica-libre-${Date.now()}.csv`, toCsv(events), 'text/csv;charset=utf-8') }
  function exportJson() { downloadFile(`bitacora-practica-libre-${Date.now()}.json`, JSON.stringify(events, null, 2), 'application/json') }

  const elapsedMs = session === 'jugando' ? Date.now() - startRef.current : session === 'victoria' || session === 'bloqueado' ? finalMs : 0
  const elapsed = `${Math.floor(elapsedMs / 60000)}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}`
  const statusLabel = session === 'inactivo' ? 'listo para iniciar'
    : session === 'cuenta' ? 'cuenta regresiva…'
      : session === 'jugando' ? 'en curso'
        : session === 'victoria' ? `victoria en ${moves} movimientos` : 'bloqueado — ningún movimiento posible'
  const canReset = session === 'jugando' || session === 'victoria' || session === 'bloqueado'
  const latency = session === 'jugando' ? Math.min(Math.floor((Date.now() - turnStartRef.current) / 1000), actuarThresholdSec) : 0

  const main = (
    <>
      <Panel style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px 16px', padding: '12px 16px' }}>
        <div>
          <div style={sectionLabel}>{statusLabel}{intento > 0 ? ` · intento ${intento}` : ''}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '34px', fontWeight: 600, lineHeight: 1.15 }}>{elapsed}</span>
            <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>{moves} movimientos · {errors} errores</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={iniciarIntento} disabled={session === 'cuenta' || session === 'jugando'}
            style={sessionBtn(!(session === 'cuenta' || session === 'jugando'), 'var(--color-blue)')}>Iniciar intento</button>
          <button
            onClick={() => { if (!confirmReset) { setConfirmReset(true); return } setConfirmReset(false); reiniciar() }}
            disabled={!canReset}
            style={sessionBtn(canReset, confirmReset ? 'var(--color-offline)' : 'var(--color-paper-dim)')}>
            {confirmReset ? '¿Confirmar reinicio?' : 'Reiniciar'}
          </button>
          <BotonInformeNivel onClick={() => setInformeAbierto(true)} pares={pares} intentos={intentosDelNivel.length} />
        </div>
        {countdown !== null && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: countdownSemaforo(countdown).bg, borderRadius: 'var(--radius)', zIndex: 5,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '52px', fontWeight: 700, color: countdownSemaforo(countdown).text }}>
              {countdown === 0 ? '¡INICIA!' : countdown}
            </span>
          </div>
        )}
      </Panel>

      <Panel>
        <SectionTitle right={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>toca y toca, o arrastra</span>}>
          Tablero · {pares} par{pares > 1 ? 'es' : ''}
        </SectionTitle>
        {session === 'victoria' && (
          <EndBanner kind="victoria" title="¡Victoria!"
            detail={`Intercambio completo en ${moves} movimientos y ${Math.round(finalMs / 1000)} s (el mínimo posible con ${pares} par${pares > 1 ? 'es' : ''} es ${pares * pares + 2 * pares}). Inicia otro intento cuando quieras.`} />
        )}
        {session === 'bloqueado' && (
          <EndBanner kind="bloqueo" title="Camino sin retorno: bloqueado"
            detail="La única jugada que queda es volver a la posición anterior, y la Regla 2 no lo permite. Mira en el grafo dónde te metiste e inicia otro intento." />
        )}
        <SimBoard
          board={board} prev={prevBoard} disabled={session !== 'jugando'}
          selected={selected} onSelect={i => { setSelected(i); setErrorCell(null) }}
          onMove={handleMove} onInvalid={handleInvalid} errorCell={errorCell} />
        {/* Jugada rechazada: se dice qué regla se rompió y se anima, igual que
            en el tutorial. Antes solo aparecía una línea fina bajo el tablero. */}
        {fallo && session === 'jugando' ? (
          <div style={{
            marginTop: '12px', padding: '12px 14px', borderRadius: 'var(--radius)',
            background: 'rgba(250,77,86,0.10)', border: '2px solid var(--color-offline)',
            display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap',
          }}>
            <span aria-hidden="true" style={{
              width: '30px', height: '30px', flexShrink: 0, borderRadius: '50%', background: 'var(--color-offline)',
              color: '#0B0F10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800,
            }}>✕</span>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div style={{ ...sectionLabel, color: 'var(--color-offline)' }}>Movimiento no permitido</div>
              <div style={{ fontSize: '17px', fontWeight: 700, margin: '2px 0' }}>{fallo.titulo}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)', lineHeight: 1.5 }}>{fallo.texto}</div>
            </div>
            <div style={{ flex: '1 1 330px', minWidth: '240px', maxWidth: '430px' }}><AnimacionRegla error={fallo.error} /></div>
          </div>
        ) : (
        <div style={{
          marginTop: '12px', padding: '8px 12px', borderRadius: 'var(--radius)', background: 'var(--color-bg)', fontSize: '13px',
          borderLeft: `3px solid ${message?.tone === 'error' ? 'var(--color-offline)' : message?.tone === 'ok' ? 'var(--color-online)' : 'var(--color-blue)'}`,
          color: message?.tone === 'error' ? 'var(--color-paper)' : 'var(--color-paper-dim)',
        }}>
          {session === 'inactivo' ? 'Toca «Iniciar intento» para empezar.'
            : session === 'victoria' ? `¡Intercambio completo en ${moves} movimientos! Puedes iniciar otro intento.`
              : session === 'bloqueado' ? 'No queda ninguna jugada permitida (solo volver a la posición anterior, y eso no se puede) y no se completó el cambio. Inicia otro intento.'
                : message?.text ?? 'Toca una ficha y luego la casilla a donde quieres llevarla.'}
        </div>
        )}
      </Panel>

      {suggestion && (
        <Panel style={{ borderColor: PPA_HEX[suggestion.fase], display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SignalGlyph phase={suggestion.fase} color={PPA_TEXT[suggestion.fase]} />
            <span style={{ fontWeight: 700, color: PPA_TEXT[suggestion.fase] }}>Sugerencia: {PPA_LABEL[suggestion.fase]}</span>
            <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>— motivo: {suggestion.motivo}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-paper-faint)' }}>El sistema sugiere; el operador decide. Ninguna fase se activa sin confirmación.</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => resolveSuggestion('confirmada')} style={sessionBtn(true, 'var(--color-online)')}>Confirmar</button>
            <input value={discardReason} onChange={e => setDiscardReason(e.target.value)} placeholder="motivo del descarte (opcional)"
              style={{ flex: 1, minWidth: '180px', background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '8px 10px', color: 'var(--color-paper)', fontSize: '12px' }} />
            <button onClick={() => resolveSuggestion('descartada')} style={sessionBtn(true, 'var(--color-offline)')}>Descartar</button>
          </div>
        </Panel>
      )}

      {lastActivation && (
        <Panel style={{ display: 'flex', alignItems: 'center', gap: '12px', background: ppaRgba(lastActivation.fase, 0.08), borderColor: PPA_HEX[lastActivation.fase] }}>
          <SignalGlyph phase={lastActivation.fase} color={PPA_TEXT[lastActivation.fase]} />
          <span style={{ fontSize: '13px', color: 'var(--color-paper-dim)' }}>
            Señal multisensorial simulada — <b style={{ color: PPA_TEXT[lastActivation.fase] }}>{PPA_LABEL[lastActivation.fase]}</b> activada a las {new Date(lastActivation.at).toLocaleTimeString()}
          </span>
        </Panel>
      )}

      <Panel>
        <SectionTitle>En vivo</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
          <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pausar} label="Pausar — fallas consecutivas" />
          <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pensar} label="Pensar — mismo criterio, encadenado tras Pausar" />
          <PpaChargeMeter value={latency} max={actuarThresholdSec} colorHex={PPA_HEX.actuar} label={`Actuar — latencia sin mover (umbral ${actuarThresholdSec}s, no oficial)`} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <span style={{ fontSize: '10px', color: 'var(--color-paper-dim)' }}>Umbral Actuar:</span>
          <input type="range" min={2} max={30} value={actuarThresholdSec} onChange={e => setActuarThresholdSec(Number(e.target.value))} style={{ flex: 1, maxWidth: '260px', accentColor: 'var(--color-blue)' }} />
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{actuarThresholdSec}s</span>
        </div>
      </Panel>

      <Collapsible title="Histórico — bitácora de la práctica" open={logOpen} onToggle={() => setLogOpen(o => !o)}>
        <LogPanel
          title="Bitácora de práctica libre (simulación)"
          rows={events.map(e => ({ ts: e.timestamp, tag: e.intentoNum ? `#${e.intentoNum} ${e.tipo}` : e.tipo, text: e.participanteId + " · " + e.detalle + (e.decision ? ` · decisión: ${e.decision}${e.motivoDescarte ? ` (${e.motivoDescarte})` : ''}` : '') }))}
          empty="Sin eventos todavía."
          onCsv={exportCsv} onJson={exportJson} maxHeight={220} />
      </Collapsible>
    </>
  )

  const graphPanel = (
    <Panel style={{ height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <SectionTitle>Grafo de estados · {pares} par{pares > 1 ? 'es' : ''} — tu recorrido</SectionTitle>
      <div style={{ flex: 1, minHeight: 0 }}>
        <GrafoEstados pares={pares} previos={previos} actual={actual}
          terminado={session === 'victoria' || session === 'bloqueado'} />
      </div>
    </Panel>
  )

  return (
    <>
      <Workbench left={main} right={graphPanel} offset={264} />
      {/* El informe del nivel se abre en ventana emergente (antes era otro
          panel bajo el tablero, que tapaba el grafo y obligaba a bajar). */}
      {informeAbierto && <InformeNivel seccion="libre" pares={pares} onCerrar={() => setInformeAbierto(false)} />}
    </>
  )
}

export default PracticaLibre
