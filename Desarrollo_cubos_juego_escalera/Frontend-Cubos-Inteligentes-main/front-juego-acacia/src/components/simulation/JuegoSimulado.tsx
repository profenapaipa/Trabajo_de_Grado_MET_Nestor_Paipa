import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { Trophy, Ban, TriangleAlert, RotateCcw, Download, Pause, Lightbulb, Zap, GraduationCap } from 'lucide-react'
import {
  type Board, type Team,
  createInitialBoard, computeWinBoard, boardsEqual,
  legalMovesFor, isStuck, applyMove,
} from '../../core/simulation/laEscaleraRules'
import { type PPAPhase, type BitacoraEvent, nowIso, toCsv, downloadFile } from '../../core/simulation/bitacora'
import { simCard, simLabel, SIM_ACCENT } from '../../core/simulation/theme'
import { playPpaFeedback, playError } from '../../core/utils/ppaTones'
import { PPA_HEX, FALLAS_PARA_PAUSAR, AUTO_OFF_MS } from '../../core/ppa/ppaColors'
import ReglasPanel from './ReglasPanel'
import PpaChargeMeter from './PpaChargeMeter'

const VERSION_CONFIGURACION = 'sim-config-v0.1'
const DRAG_THRESHOLD_PX = 12
const SNAP_RANGE_FACTOR = 1.6
const SNAP_DURATION_MS = 180

const GUIDED_TIPS: Record<number, { titulo: string; texto: string }> = {
  1: { titulo: 'Paso 1 · Deslizar', texto: 'Con una sola pareja de fichas alcanza con deslizar: arrastra tu ficha azul hacia la casilla vacía de al lado, y luego la roja hacia la que quede libre.' },
  2: { titulo: 'Paso 2 · Saltar', texto: 'Ahora hay una ficha del otro color junto a la tuya. Si detrás de ella hay una casilla vacía, arrastra tu ficha para saltar sobre ella — es el segundo movimiento del juego.' },
  3: { titulo: 'Paso 3 · Combinar', texto: 'Ya conoces los dos movimientos (deslizar y saltar). Con más fichas hace falta alternarlos para completar el intercambio — no siempre el primer movimiento disponible es el mejor.' },
  4: { titulo: 'Paso 4 · Planificar', texto: 'Con más fichas en juego, antes de mover conviene pensar qué movimiento acerca más al intercambio completo — moverse rápido no siempre es lo más eficiente.' },
  5: { titulo: 'Paso 5 · Nivel completo', texto: 'Esta es la versión completa del juego, cinco fichas por lado — igual que en una sesión real.' },
}

const PPA_META: Record<PPAPhase, { label: string; icon: ReactNode; rgb: string }> = {
  pausar: { label: 'PAUSAR', icon: <Pause size={16} />, rgb: PPA_HEX.pausar },
  pensar: { label: 'PENSAR', icon: <Lightbulb size={16} />, rgb: PPA_HEX.pensar },
  actuar: { label: 'ACTUAR', icon: <Zap size={16} />, rgb: PPA_HEX.actuar },
}
const TEAM_COLOR: Record<Team, string> = { A: '#0000ff', B: '#ff0000' }

type DragState = { fromIndex: number; startX: number; startY: number; dx: number; dy: number; snapping: boolean }

function JuegoSimulado({ pares, operatorId, guiado = false, modo = 'juego' }: {
  pares: number
  operatorId: string
  guiado?: boolean
  modo?: string
}) {
  const [board, setBoard] = useState<Board>(() => createInitialBoard(pares))
  const [winBoard, setWinBoard] = useState<Board>(() => computeWinBoard(createInitialBoard(pares)))
  const [selected, setSelected] = useState<number | null>(null)
  const [status, setStatus] = useState<'jugando' | 'victoria' | 'derrota'>('jugando')
  const [fallaCount, setFallaCount] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [pendingSuggestion, setPendingSuggestion] = useState<{ fase: PPAPhase; motivo: string } | null>(null)
  const [lastActivation, setLastActivation] = useState<{ fase: PPAPhase; at: string } | null>(null)
  const [events, setEvents] = useState<BitacoraEvent[]>([])
  const [discardReason, setDiscardReason] = useState('')
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [actuarThresholdSec, setActuarThresholdSec] = useState(8)
  const [, setTick] = useState(0)

  const turnStartRef = useRef<number>(Date.now())
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])
  const restRectsRef = useRef<(DOMRect | null)[]>([])
  const toggleOffRef = useRef(false)

  useEffect(() => {
    if (guiado) return
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [guiado])

  function logEvent(
    partial: Omit<BitacoraEvent, 'timestamp' | 'esSimulacion' | 'operadorId' | 'versionConfiguracion' | 'pares' | 'posiciones'>,
    boardForLog: Board,
  ) {
    setEvents(prev => [...prev, {
      timestamp: nowIso(), esSimulacion: true, operadorId: operatorId || '(sin asignar)',
      versionConfiguracion: VERSION_CONFIGURACION, pares, posiciones: boardForLog.map(c => c?.id ?? null),
      ...partial,
    }])
  }

  function startExercise(newPares: number) {
    const initial = createInitialBoard(newPares)
    const win = computeWinBoard(initial)
    setBoard(initial)
    setWinBoard(win)
    setSelected(null)
    setDragState(null)
    setStatus('jugando')
    setFallaCount(0)
    setMoveCount(0)
    setPendingSuggestion(null)
    setLastActivation(null)
    turnStartRef.current = Date.now()
    logEvent({ tipo: 'reinicio', detalle: `Nuevo ejercicio: ${newPares} par(es) de cubos` }, initial)
  }

  const didLogStartRef = useRef(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (didLogStartRef.current) return
    didLogStartRef.current = true
    logEvent({ tipo: 'reinicio', detalle: `Sesión de ${modo} iniciada: ${pares} par(es) de cubos` }, board)
  }, [])

  const firstParesRef = useRef(pares)
  useEffect(() => {
    if (firstParesRef.current === pares) return
    firstParesRef.current = pares
    startExercise(pares)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pares])

  function applyLegalMove(fromIndex: number, targetIndex: number) {
    const moved = board[fromIndex]!
    const next = applyMove(board, fromIndex, targetIndex)
    setBoard(next)
    setFallaCount(0)
    setMoveCount(m => m + 1)
    turnStartRef.current = Date.now()
    logEvent({ tipo: 'movimiento', detalle: `Cubo #${moved.id} movido de la posición ${fromIndex + 1} a la ${targetIndex + 1}` }, next)

    if (boardsEqual(next, winBoard)) {
      setStatus('victoria')
      logEvent({ tipo: 'victoria', detalle: `Intercambio completo en ${moveCount + 1} movimientos` }, next)
    } else if (isStuck(next, winBoard)) {
      setStatus('derrota')
      logEvent({ tipo: 'derrota', detalle: 'Ningún cubo tiene un movimiento legal disponible (bloqueo)' }, next)
    }
  }

  function registerFalla(fromIndex: number, targetIndex: number) {
    const attemptedId = board[fromIndex]!.id
    playError()
    logEvent({ tipo: 'falla', detalle: `Intento inválido: mover el cubo #${attemptedId} a la posición ${targetIndex + 1}` }, board)
    // El tutorial es únicamente para aprender el juego y sus reglas — no
    // dispara la sugerencia de Pausar, solo la simulación libre lo hace.
    if (guiado) return
    const nf = fallaCount + 1
    if (nf >= FALLAS_PARA_PAUSAR && pendingSuggestion === null) {
      setFallaCount(0)
      setPendingSuggestion({ fase: 'pausar', motivo: 'dos fallas consecutivas' })
      logEvent({ tipo: 'sugerencia_ppa', fase: 'pausar', motivo: 'dos fallas consecutivas', detalle: 'Sugerencia de Pausar emitida' }, board)
    } else {
      setFallaCount(nf)
    }
  }

  function finishDrag(fromIndex: number, targetIndex: number, outcome: 'move' | 'falla' | 'cancel') {
    const fromRect = restRectsRef.current[fromIndex]
    const snapToIndex = outcome === 'move' ? targetIndex : fromIndex
    const toRect = restRectsRef.current[snapToIndex]
    setDragState(d => d && fromRect && toRect
      ? { ...d, dx: toRect.left - fromRect.left, dy: toRect.top - fromRect.top, snapping: true }
      : null)
    window.setTimeout(() => {
      if (outcome === 'move') applyLegalMove(fromIndex, targetIndex)
      if (outcome === 'falla') registerFalla(fromIndex, targetIndex)
      setDragState(null)
      setSelected(null)
    }, SNAP_DURATION_MS)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    if (status !== 'jugando') return
    if (!board[index]) return
    e.currentTarget.setPointerCapture(e.pointerId)
    toggleOffRef.current = selected === index
    restRectsRef.current = cellRefs.current.map(el => el ? el.getBoundingClientRect() : null)
    setSelected(index)
    setDragState({ fromIndex: index, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, snapping: false })
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const clientX = e.clientX, clientY = e.clientY
    setDragState(d => (d && !d.snapping ? { ...d, dx: clientX - d.startX, dy: clientY - d.startY } : d))
  }

  // No usa la forma funcional de setDragState a propósito: en StrictMode
  // (desarrollo) React invoca dos veces la función que recibe setState para
  // detectar impurezas, y finishDrag() tiene efectos secundarios reales
  // (aplica el movimiento). Ponerlos dentro del updater duplicaba cada
  // movimiento — bug encontrado y corregido en verificación con Playwright.
  function handlePointerUpOrCancel(_e: ReactPointerEvent<HTMLDivElement>) {
    const current = dragState
    if (!current || current.snapping) return
    const { fromIndex, dx, dy } = current
    const dist = Math.hypot(dx, dy)
    if (dist < DRAG_THRESHOLD_PX) {
      if (toggleOffRef.current) setSelected(null)
      setDragState(null)
      return
    }
    const fromRect = restRectsRef.current[fromIndex]
    if (!fromRect) { setDragState(null); return }
    const pieceCenterX = fromRect.left + fromRect.width / 2 + dx
    const pieceCenterY = fromRect.top + fromRect.height / 2 + dy
    let nearestIndex = -1, nearestDist = Infinity
    board.forEach((_, i) => {
      const r = restRectsRef.current[i]
      if (!r) return
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      const d = Math.hypot(cx - pieceCenterX, cy - pieceCenterY)
      if (d < nearestDist) { nearestDist = d; nearestIndex = i }
    })
    if (nearestIndex === -1 || nearestDist > fromRect.width * SNAP_RANGE_FACTOR) {
      finishDrag(fromIndex, fromIndex, 'cancel')
      return
    }
    const legal = board[nearestIndex] === null && legalMovesFor(board, fromIndex).includes(nearestIndex)
    finishDrag(fromIndex, nearestIndex, legal ? 'move' : 'falla')
  }

  function resolveSuggestion(decision: 'confirmada' | 'descartada') {
    if (!pendingSuggestion) return
    const { fase, motivo } = pendingSuggestion

    logEvent({
      tipo: 'decision_ppa', fase, motivo, decision,
      motivoDescarte: decision === 'descartada' ? (discardReason.trim() || 'sin especificar') : undefined,
      activacionEfectiva: decision === 'confirmada',
      detalle: decision === 'confirmada' ? `Fase ${fase.toUpperCase()} confirmada por el operador` : `Fase ${fase.toUpperCase()} descartada por el operador`,
    }, board)

    setPendingSuggestion(null)
    setDiscardReason('')

    if (decision === 'confirmada') {
      setLastActivation({ fase, at: nowIso() })
      playPpaFeedback(fase, AUTO_OFF_MS / 1000)
      if (fase === 'pausar') {
        const next = { fase: 'pensar' as PPAPhase, motivo: 'encadenado tras confirmar Pausar (mismo ciclo)' }
        setPendingSuggestion(next)
        logEvent({ tipo: 'sugerencia_ppa', fase: next.fase, motivo: next.motivo, detalle: 'Sugerencia de Pensar emitida (encadenada)' }, board)
      }
    }
  }

  function exportCsv() { downloadFile(`bitacora-${modo}-${Date.now()}.csv`, toCsv(events), 'text/csv;charset=utf-8') }
  function exportJson() { downloadFile(`bitacora-${modo}-${Date.now()}.json`, JSON.stringify(events, null, 2), 'application/json') }

  const legalTargets = selected !== null ? legalMovesFor(board, selected) : []

  const tip = GUIDED_TIPS[pares] ?? GUIDED_TIPS[5]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {guiado && (
        <div style={{ ...simCard, border: `1px solid ${SIM_ACCENT}`, display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <GraduationCap size={22} color={SIM_ACCENT} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: SIM_ACCENT }}>{tip.titulo}</div>
            <div style={{ fontSize: '13px', color: '#ccc', marginTop: '4px', lineHeight: 1.5 }}>{tip.texto}</div>
          </div>
        </div>
      )}

      {guiado && <ReglasPanel />}

      <div style={{ ...simCard, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => startExercise(pares)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px',
          color: '#fff', fontSize: '13px', cursor: 'pointer',
        }}>
          <RotateCcw size={13} /> Nuevo ejercicio
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px' }}>
        <div style={simCard}><div style={simLabel}>MOVIMIENTOS</div><div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px' }}>{moveCount}</div></div>
        <div style={simCard}><div style={simLabel}>ESTADO</div><div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', textTransform: 'capitalize' }}>{status}</div></div>
      </div>

      {!guiado && (
        <div style={simCard}>
          <div style={{ ...simLabel, marginBottom: '10px' }}>CONDICIÓN ACUMULADA POR FASE — informativo, el operador decide si envía la señal</div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pausar} label="Pausar — fallas consecutivas" />
            <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pensar} label="Pensar — mismo criterio, encadenado tras Pausar" />
            <PpaChargeMeter value={Math.min(Math.floor((Date.now() - turnStartRef.current) / 1000), actuarThresholdSec)} max={actuarThresholdSec} colorHex={PPA_HEX.actuar} label={`Actuar — latencia sin mover (umbral ${actuarThresholdSec}s, no oficial)`} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <span style={{ fontSize: '11px', color: '#888' }}>Umbral Actuar (segundos, no oficial):</span>
            <input type="range" min={2} max={30} value={actuarThresholdSec}
              onChange={e => setActuarThresholdSec(Number(e.target.value))}
              style={{ flex: 1, maxWidth: '160px', accentColor: SIM_ACCENT }} />
            <span style={{ fontSize: '11px' }}>{actuarThresholdSec}s</span>
          </div>
        </div>
      )}

      {status === 'victoria' && (
        <div style={{ ...simCard, background: 'rgba(20,80,30,0.5)', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={20} color="#22c55e" />
          <span style={{ fontWeight: 700 }}>¡Victoria! Intercambio completo en {moveCount} movimientos.</span>
        </div>
      )}
      {status === 'derrota' && (
        <div style={{ ...simCard, background: 'rgba(90,20,20,0.5)', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Ban size={20} color="#ef4444" />
          <span style={{ fontWeight: 700 }}>Derrota — ningún cubo tiene ya un movimiento legal disponible.</span>
        </div>
      )}

      <div style={{ ...simCard, position: 'relative' }}>
        <div style={{ ...simLabel, marginBottom: '4px' }}>TABLERO · {pares} PAR(ES) · mantén presionado y arrastra para mover</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', padding: '10px 0', touchAction: 'none' }}>
          {board.map((cell, i) => {
            const isSelected = selected === i
            const isLegalTarget = legalTargets.includes(i)
            const isDragging = dragState?.fromIndex === i
            // Mientras se arrastra, la casilla de origen se muestra vacía
            // de verdad — el cubo "levantado" se dibuja aparte, flotando
            // sobre el tablero, para que quede claro que esa posición
            // quedó libre en cuanto se sostiene el clic.
            const showEmpty = !cell || isDragging
            const bg = showEmpty ? 'rgba(255,255,255,0.10)' : TEAM_COLOR[cell!.team]
            return (
              <div key={i} data-cell={i}
                ref={el => { cellRefs.current[i] = el }}
                onPointerDown={e => handlePointerDown(e, i)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUpOrCancel}
                onPointerCancel={handlePointerUpOrCancel}
                style={{
                  width: '56px', height: '64px', borderRadius: '10px', background: bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: status === 'jugando' && cell ? 'grab' : 'default',
                  border: isSelected ? '3px solid #fff' : isLegalTarget ? `3px solid ${SIM_ACCENT}`
                    : showEmpty ? '2px dashed rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.15)',
                  boxShadow: isLegalTarget ? `0 0 10px ${SIM_ACCENT}aa` : 'none',
                  color: '#fff', fontWeight: 700, fontSize: '16px',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  position: 'relative',
                  touchAction: 'none',
                  userSelect: 'none',
                }}>
                {showEmpty ? <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>vacío</span> : `#${cell!.id}`}
              </div>
            )
          })}
        </div>

        {/* Pieza flotante mientras se arrastra */}
        {dragState && board[dragState.fromIndex] && (() => {
          const fromRect = restRectsRef.current[dragState.fromIndex]
          if (!fromRect) return null
          const piece = board[dragState.fromIndex]!
          return (
            <div style={{
              position: 'fixed',
              left: fromRect.left, top: fromRect.top,
              width: fromRect.width, height: fromRect.height,
              borderRadius: '10px', background: TEAM_COLOR[piece.team],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '16px',
              boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
              transform: `translate(${dragState.dx}px, ${dragState.dy}px) scale(1.08)`,
              transition: dragState.snapping ? `transform ${SNAP_DURATION_MS}ms ease` : 'none',
              pointerEvents: 'none',
              zIndex: 50,
            }}>
              #{piece.id}
            </div>
          )
        })()}
      </div>

      {pendingSuggestion && (
        <div style={{ ...simCard, border: `1px solid ${PPA_META[pendingSuggestion.fase].rgb}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TriangleAlert size={16} color="#f59e0b" />
            <span style={{ fontWeight: 700 }}>Sugerencia: {PPA_META[pendingSuggestion.fase].label}</span>
            <span style={{ color: '#888', fontSize: '12px' }}>— motivo: {pendingSuggestion.motivo}</span>
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>El sistema sugiere; el operador decide. Ninguna fase se activa sin confirmación.</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => resolveSuggestion('confirmada')} style={{
              background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#22c55e',
              borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 700,
            }}>Confirmar</button>
            <input value={discardReason} onChange={e => setDiscardReason(e.target.value)} placeholder="motivo del descarte (opcional)"
              style={{
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px', padding: '7px 10px', color: '#fff', fontSize: '12px', flex: 1, minWidth: '180px',
              }} />
            <button onClick={() => resolveSuggestion('descartada')} style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444',
              borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: 700,
            }}>Descartar</button>
          </div>
        </div>
      )}

      {lastActivation && (
        <div style={{ ...simCard, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%', background: PPA_META[lastActivation.fase].rgb,
            boxShadow: `0 0 10px ${PPA_META[lastActivation.fase].rgb}`,
          }} />
          {PPA_META[lastActivation.fase].icon}
          <span style={{ fontSize: '12px', color: '#888' }}>
            Señal multisensorial simulada — {PPA_META[lastActivation.fase].label} activada a las {new Date(lastActivation.at).toLocaleTimeString()}
          </span>
        </div>
      )}

      <div style={simCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={simLabel}>BITÁCORA · {modo.toUpperCase()} (SIMULACIÓN) · {events.length} EVENTOS</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '5px 10px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> CSV</button>
            <button onClick={exportJson} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '5px 10px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> JSON</button>
          </div>
        </div>
        <div style={{ maxHeight: '220px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
          {events.length === 0 && <div style={{ color: '#555' }}>Sin eventos todavía.</div>}
          {[...events].reverse().map((ev, i) => (
            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#aaa' }}>
              <span style={{ color: '#666' }}>{ev.timestamp}</span> · <span style={{ color: SIM_ACCENT }}>{ev.tipo}</span> · {ev.detalle}
              {ev.decision && <> · decisión: {ev.decision}{ev.motivoDescarte ? ` (${ev.motivoDescarte})` : ''}</>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default JuegoSimulado
