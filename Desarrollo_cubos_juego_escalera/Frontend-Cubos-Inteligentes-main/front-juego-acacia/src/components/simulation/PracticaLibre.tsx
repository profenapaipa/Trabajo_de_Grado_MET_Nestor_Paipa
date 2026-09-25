import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  type Board, createInitialBoard, computeWinBoard, boardsEqual, isStuck, applyMove,
} from '../../core/simulation/laEscaleraRules'
import { classifyAttempt, explainError, successText } from '../../core/simulation/tutor'
import { type BitacoraEvent, type PPAPhase, nowIso, toCsv, downloadFile } from '../../core/simulation/bitacora'
import { playPpaFeedback, playError, playCountdownBeep } from '../../core/utils/ppaTones'
import { PPA_HEX, PPA_TEXT, PPA_LABEL, FALLAS_PARA_PAUSAR, AUTO_OFF_MS, ppaRgba } from '../../core/ppa/ppaColors'
import { Panel, SectionTitle, Collapsible, LogPanel, TwoColumn, SignalGlyph } from '../../ui/brand'
import { sectionLabel, sessionBtn, countdownSemaforo } from '../../ui/styles'
import PpaChargeMeter from './PpaChargeMeter'
import SimBoard from './SimBoard'

// Práctica libre: el juego completo sin ayudas del tutorial (sin pistas ni
// deshacer), organizado en intentos numerados igual que Control Mago de Oz
// — Iniciar intento con la cuenta regresiva en semáforo, Reiniciar con
// confirmación — y con la sugerencia PPA simulada: dos fallas seguidas
// sugieren Pausar; el operador confirma o descarta, nunca se activa sola.
// Cada error se explica en pantalla, igual que en el tutorial.

type SessionState = 'inactivo' | 'cuenta' | 'jugando' | 'victoria' | 'bloqueado'
const VERSION = 'sim-config-v0.2'

function PracticaLibre({ pares, operatorId, participante, sidebarTop }: { pares: number; operatorId: string; participante: string; sidebarTop: ReactNode }) {
  const [session, setSession] = useState<SessionState>('inactivo')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [board, setBoard] = useState<Board>(() => createInitialBoard(pares))
  const [selected, setSelected] = useState<number | null>(null)
  const [errorCell, setErrorCell] = useState<number | null>(null)
  const [moves, setMoves] = useState(0)
  const [errors, setErrors] = useState(0)
  const [fallaCount, setFallaCount] = useState(0)
  const [intento, setIntento] = useState(0)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null)
  const [suggestion, setSuggestion] = useState<{ fase: PPAPhase; motivo: string } | null>(null)
  const [discardReason, setDiscardReason] = useState('')
  const [lastActivation, setLastActivation] = useState<{ fase: PPAPhase; at: string } | null>(null)
  const [events, setEvents] = useState<BitacoraEvent[]>([])
  const [confirmReset, setConfirmReset] = useState(false)
  const [actuarThresholdSec, setActuarThresholdSec] = useState(8)
  const [logOpen, setLogOpen] = useState(true)
  const [, setTick] = useState(0)
  const startRef = useRef(0)
  const turnStartRef = useRef(Date.now())
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const intentoRef = useRef(0)

  const win = computeWinBoard(createInitialBoard(pares))

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

  function log(partial: Omit<BitacoraEvent, 'timestamp' | 'esSimulacion' | 'operadorId' | 'participanteId' | 'versionConfiguracion' | 'pares' | 'posiciones' | 'intentoNum'>, b: Board) {
    setEvents(prev => [...prev, {
      timestamp: nowIso(), esSimulacion: true, operadorId: operatorId || '(sin asignar)', participanteId: participante || '(sin nombre)',
      versionConfiguracion: VERSION, pares, posiciones: b.map(c => c?.id ?? null),
      intentoNum: intentoRef.current || undefined, ...partial,
    }])
  }

  function abortToIdle(newPares: number) {
    timers.current.forEach(clearTimeout)
    timers.current = []
    setCountdown(null)
    setBoard(createInitialBoard(newPares))
    setSelected(null); setErrorCell(null); setSuggestion(null); setMessage(null)
    setMoves(0); setErrors(0); setFallaCount(0)
    setSession('inactivo')
  }

  // Cambiar los pares aborta el intento en curso (sin useEffect para no
  // pintar un cuadro con el tablero anterior).
  const [paresSeen, setParesSeen] = useState(pares)
  if (paresSeen !== pares) {
    setParesSeen(pares)
    abortToIdle(pares)
  }

  function iniciarIntento() {
    const n = intento + 1
    intentoRef.current = n
    setIntento(n)
    const initial = createInitialBoard(pares)
    setBoard(initial)
    setSelected(null); setErrorCell(null); setSuggestion(null); setMessage(null); setLastActivation(null)
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
    abortToIdle(pares)
  }

  function handleMove(from: number, to: number) {
    const res = classifyAttempt(board, from, to)
    if (!res.ok) return
    const piece = board[from]!
    const next = applyMove(board, from, to)
    const m = moves + 1
    setBoard(next); setSelected(null); setErrorCell(null)
    setMoves(m); setFallaCount(0)
    turnStartRef.current = Date.now()
    setMessage({ tone: 'ok', text: successText(res.kind, piece.team) })
    log({ tipo: 'movimiento', detalle: `Ficha ${piece.id} (${res.kind}) de la posición ${from + 1} a la ${to + 1}` }, next)
    if (boardsEqual(next, win)) {
      setSession('victoria')
      log({ tipo: 'victoria', detalle: `Intento #${intentoRef.current}: intercambio completo en ${m} movimientos y ${Math.round((Date.now() - startRef.current) / 1000)}s` }, next)
    } else if (isStuck(next, win)) {
      setSession('bloqueado')
      log({ tipo: 'derrota', detalle: `Intento #${intentoRef.current}: ningún cubo tiene un movimiento legal (bloqueo)` }, next)
    }
  }

  function handleInvalid(from: number, to: number) {
    if (from === to) return
    const res = classifyAttempt(board, from, to)
    if (res.ok) return
    const piece = board[from]!
    const { titulo, texto } = explainError(res.error, piece.team)
    playError()
    setErrorCell(to)
    setErrors(e => e + 1)
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

  const elapsedMs = session === 'jugando' ? Date.now() - startRef.current : 0
  const elapsed = `${Math.floor(elapsedMs / 60000)}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}`
  const statusLabel = session === 'inactivo' ? 'listo para iniciar'
    : session === 'cuenta' ? 'cuenta regresiva…'
      : session === 'jugando' ? 'en curso'
        : session === 'victoria' ? `victoria en ${moves} movimientos` : 'bloqueado — ningún movimiento posible'
  const canReset = session === 'jugando' || session === 'victoria' || session === 'bloqueado'
  const latency = session === 'jugando' ? Math.min(Math.floor((Date.now() - turnStartRef.current) / 1000), actuarThresholdSec) : 0

  const main = (
    <>
      <Panel style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px 16px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={sectionLabel}>{statusLabel}{intento > 0 ? ` · intento ${intento}` : ''}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '40px', fontWeight: 600, lineHeight: 1.15 }}>{elapsed}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>{moves} movimientos · {errors} errores</div>
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
        <SimBoard
          board={board} disabled={session !== 'jugando'}
          selected={selected} onSelect={i => { setSelected(i); setErrorCell(null) }}
          onMove={handleMove} onInvalid={handleInvalid} errorCell={errorCell} />
        <div style={{
          marginTop: '12px', padding: '8px 12px', borderRadius: 'var(--radius)', background: 'var(--color-bg)', fontSize: '13px',
          borderLeft: `3px solid ${message?.tone === 'error' ? 'var(--color-offline)' : message?.tone === 'ok' ? 'var(--color-online)' : 'var(--color-blue)'}`,
          color: message?.tone === 'error' ? 'var(--color-paper)' : 'var(--color-paper-dim)',
        }}>
          {session === 'inactivo' ? 'Toca «Iniciar intento» para empezar.'
            : session === 'victoria' ? `¡Intercambio completo en ${moves} movimientos! Puedes iniciar otro intento.`
              : session === 'bloqueado' ? 'Ninguna ficha puede moverse y no se completó el cambio. Inicia otro intento.'
                : message?.text ?? 'Toca una ficha y luego la casilla a donde quieres llevarla.'}
        </div>
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

      <Collapsible title="Histórico — bitácora de la práctica" open={logOpen} onToggle={() => setLogOpen(o => !o)}>
        <LogPanel
          title="Bitácora de práctica libre (simulación)"
          rows={events.map(e => ({ ts: e.timestamp, tag: e.intentoNum ? `#${e.intentoNum} ${e.tipo}` : e.tipo, text: e.participanteId + " · " + e.detalle + (e.decision ? ` · decisión: ${e.decision}${e.motivoDescarte ? ` (${e.motivoDescarte})` : ''}` : '') }))}
          empty="Sin eventos todavía."
          onCsv={exportCsv} onJson={exportJson} maxHeight={220} />
      </Collapsible>
    </>
  )

  const side = (
    <>
      {sidebarTop}
      <Panel>
        <SectionTitle>En vivo</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pausar} label="Pausar — fallas consecutivas" />
          <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pensar} label="Pensar — mismo criterio, encadenado tras Pausar" />
          <PpaChargeMeter value={latency} max={actuarThresholdSec} colorHex={PPA_HEX.actuar} label={`Actuar — latencia sin mover (umbral ${actuarThresholdSec}s, no oficial)`} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <span style={{ fontSize: '10px', color: 'var(--color-paper-dim)' }}>Umbral Actuar:</span>
          <input type="range" min={2} max={30} value={actuarThresholdSec} onChange={e => setActuarThresholdSec(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--color-blue)' }} />
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{actuarThresholdSec}s</span>
        </div>
      </Panel>
    </>
  )

  return <TwoColumn main={main} side={side} />
}

export default PracticaLibre
