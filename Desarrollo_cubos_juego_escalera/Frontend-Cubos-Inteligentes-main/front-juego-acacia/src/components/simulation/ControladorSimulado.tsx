import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Pause, Lightbulb, Zap, Power, Download, ClipboardList, TriangleAlert, Trophy, Ban, RotateCcw } from 'lucide-react'
import { simCard, simLabel, SIM_ACCENT } from '../../core/simulation/theme'
import {
  PPA_RGB, PPA_HEX, PPA_TEXT, PPA_VIBRATION, PPA_SOUND_LABEL, PPA_LABEL, PPA_FRASE,
  ppaRgba, AUTO_OFF_MS, FALLAS_PARA_PAUSAR, type PPAPhase,
} from '../../core/ppa/ppaColors'
import { playError } from '../../core/utils/ppaTones'
import { type DecisionOperador, toCsvDecisionesOperador, downloadFile } from '../../core/control/bitacoraControl'
import AmbientMusicPanel from '../AmbientMusicPanel'
import {
  type Board, type Team, createInitialBoard, computeWinBoard, boardsEqual, legalMovesFor, isStuck, applyMove,
} from '../../core/simulation/laEscaleraRules'
import PpaChargeMeter from './PpaChargeMeter'

export type CubeAction = PPAPhase

const VIB_HEIGHTS = [0.5, 0.9, 0.6, 1.0, 0.7]
const SND_H = [0.55, 0.75, 0.95, 0.60, 1.00, 0.80, 0.70, 0.90]
const ICONS: Record<PPAPhase, React.ReactNode> = { pausar: <Pause size={16} />, pensar: <Lightbulb size={16} />, actuar: <Zap size={16} /> }
const TEAM_COLOR: Record<Team, string> = { A: '#0000ff', B: '#ff0000' }
const DRAG_THRESHOLD_PX = 12
const SNAP_RANGE_FACTOR = 1.6
const SNAP_DURATION_MS = 180

type DragState = { fromIndex: number; startX: number; startY: number; dx: number; dy: number; snapping: boolean }

function ControladorSimulado({
  pares, selectedCubeId, setSelectedCubeId, cubeActions, events, onSend, onApagar,
}: {
  pares: number
  selectedCubeId: number | null
  setSelectedCubeId: (id: number | null) => void
  cubeActions: Record<number, CubeAction>
  events: DecisionOperador[]
  onSend: (a: CubeAction) => void
  onApagar: () => void
}) {
  const [noSelWarning, setNoSelWarning] = useState(false)
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Tablero movible del control simulado — a diferencia de Control Mago de
  // Oz (que solo refleja lo que reportan los sensores reales), aquí sí se
  // puede arrastrar un cubo para simular un movimiento, exactamente con las
  // mismas reglas del juego, y ver cómo se acumulan las fallas hacia una
  // sugerencia de Pausar. Los botones PAUSAR/PENSAR/ACTUAR siguen siendo
  // de envío directo — el acumulado es solo información para que el
  // operador decida, no dispara nada solo.
  const [board, setBoard] = useState<Board>(() => createInitialBoard(pares))
  const [winBoard, setWinBoard] = useState<Board>(() => computeWinBoard(createInitialBoard(pares)))
  const [selectedPos, setSelectedPos] = useState<number | null>(null)
  const [status, setStatus] = useState<'jugando' | 'victoria' | 'derrota'>('jugando')
  const [fallaCount, setFallaCount] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [actuarThresholdSec, setActuarThresholdSec] = useState(8)
  const [, setTick] = useState(0)
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])
  const restRectsRef = useRef<(DOMRect | null)[]>([])
  const toggleOffRef = useRef(false)
  const turnStartRef = useRef<number>(Date.now())

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [])

  function resetBoard(newPares: number) {
    const initial = createInitialBoard(newPares)
    setBoard(initial)
    setWinBoard(computeWinBoard(initial))
    setSelectedPos(null)
    setDragState(null)
    setStatus('jugando')
    setFallaCount(0)
    setMoveCount(0)
    turnStartRef.current = Date.now()
  }

  // Reinicia el tablero cuando cambian los pares (nivel), sin useEffect
  // para no desincronizar con el primer render de ese nivel.
  const paresSeenRef = useRef(pares)
  if (paresSeenRef.current !== pares) {
    paresSeenRef.current = pares
    resetBoard(pares)
  }

  function guarded(fn: () => void) {
    if (selectedCubeId === null) {
      if (warnTimer.current) clearTimeout(warnTimer.current)
      setNoSelWarning(true)
      warnTimer.current = setTimeout(() => setNoSelWarning(false), 2500)
      return
    }
    fn()
  }

  function applyLegalMove(fromIndex: number, targetIndex: number) {
    const moved = board[fromIndex]!
    const next = applyMove(board, fromIndex, targetIndex)
    setBoard(next)
    setFallaCount(0)
    setMoveCount(m => m + 1)
    setSelectedCubeId(moved.id)
    turnStartRef.current = Date.now()
    if (boardsEqual(next, winBoard)) setStatus('victoria')
    else if (isStuck(next, winBoard)) setStatus('derrota')
  }

  function registerFalla() {
    playError()
    setFallaCount(nf => nf + 1 >= FALLAS_PARA_PAUSAR ? 0 : nf + 1)
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
      if (outcome === 'falla') registerFalla()
      setDragState(null)
      setSelectedPos(null)
    }, SNAP_DURATION_MS)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    if (status !== 'jugando' || !board[index]) return
    e.currentTarget.setPointerCapture(e.pointerId)
    toggleOffRef.current = selectedPos === index
    restRectsRef.current = cellRefs.current.map(el => el ? el.getBoundingClientRect() : null)
    setSelectedPos(index)
    setDragState({ fromIndex: index, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, snapping: false })
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const clientX = e.clientX, clientY = e.clientY
    setDragState(d => (d && !d.snapping ? { ...d, dx: clientX - d.startX, dy: clientY - d.startY } : d))
  }
  function handlePointerUpOrCancel() {
    const current = dragState
    if (!current || current.snapping) return
    const { fromIndex, dx, dy } = current
    const dist = Math.hypot(dx, dy)
    if (dist < DRAG_THRESHOLD_PX) {
      // Un toque simple selecciona el cubo para enviarle una señal directa.
      const piece = board[fromIndex]
      if (piece) setSelectedCubeId(piece.id)
      if (toggleOffRef.current) setSelectedPos(null)
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

  function exportCsv() { downloadFile(`bitacora-control-simulado-${Date.now()}.csv`, toCsvDecisionesOperador(events), 'text/csv;charset=utf-8') }
  function exportJson() { downloadFile(`bitacora-control-simulado-${Date.now()}.json`, JSON.stringify(events, null, 2), 'application/json') }

  const legalTargets = selectedPos !== null ? legalMovesFor(board, selectedPos) : []
  const activeAction = selectedCubeId !== null ? cubeActions[selectedCubeId] : undefined

  const btnAction = (a: PPAPhase): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    padding: '14px 12px', borderRadius: '12px', cursor: 'pointer',
    background: activeAction === a ? ppaRgba(a, 0.28) : 'rgba(20,14,38,0.85)',
    border: `${activeAction === a ? 2 : 1}px solid ${activeAction === a ? PPA_HEX[a] : 'rgba(90,75,130,0.5)'}`,
    color: PPA_TEXT[a],
    transition: 'all 0.25s',
  })
  const iconCircle = (a: PPAPhase): React.CSSProperties => ({
    width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: ppaRgba(a, 0.20),
    boxShadow: activeAction === a ? `0 0 16px ${ppaRgba(a, 0.6)}` : 'none',
    transition: 'box-shadow 0.25s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={simCard}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>Panel de control — simulado</div>
        <div style={{ color: '#9088ab', fontSize: '12px', marginTop: '2px' }}>
          Réplica de Control Mago de Oz con los mismos colores y botones PPA, pero con una diferencia a propósito: aquí sí puedes arrastrar los cubos para simular un movimiento (Control Mago de Oz solo refleja lo que reportan los sensores reales) y ver cómo se acumulan las condiciones hacia una sugerencia de Pausar.
        </div>
      </div>

      {status === 'victoria' && (
        <div style={{ ...simCard, background: 'rgba(20,80,30,0.5)', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={20} color="#22c55e" />
          <span style={{ fontWeight: 700 }}>¡Intercambio completo en {moveCount} movimientos!</span>
        </div>
      )}
      {status === 'derrota' && (
        <div style={{ ...simCard, background: 'rgba(90,20,20,0.5)', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Ban size={20} color="#ef4444" />
          <span style={{ fontWeight: 700 }}>Bloqueado — ningún cubo tiene ya un movimiento legal disponible.</span>
        </div>
      )}

      <div style={{ ...simCard, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={simLabel}>TABLERO SIMULADO · {pares} PAR(ES) · mantén presionado y arrastra para mover, toca para seleccionar</span>
          <button onClick={() => resetBoard(pares)} style={{
            display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 10px', color: '#fff', fontSize: '11px', cursor: 'pointer',
          }}><RotateCcw size={11} /> Reiniciar</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', padding: '6px 0', touchAction: 'none' }}>
          {board.map((cell, i) => {
            const isSelectedPos = selectedPos === i
            const isSelectedCube = cell && selectedCubeId === cell.id
            const isLegalTarget = legalTargets.includes(i)
            const isDragging = dragState?.fromIndex === i
            const showEmpty = !cell || isDragging
            const action = cell ? cubeActions[cell.id] : undefined
            const bg = showEmpty ? 'rgba(255,255,255,0.10)' : action ? PPA_HEX[action] : TEAM_COLOR[cell!.team]
            return (
              <div key={i} data-cell={i}
                ref={el => { cellRefs.current[i] = el }}
                onPointerDown={e => handlePointerDown(e, i)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUpOrCancel}
                onPointerCancel={handlePointerUpOrCancel}
                style={{
                  width: '54px', height: '62px', borderRadius: '8px', background: bg,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                  cursor: status === 'jugando' && cell ? 'grab' : 'default',
                  border: isSelectedPos || isSelectedCube ? '3px solid #fff' : isLegalTarget ? `3px solid ${SIM_ACCENT}`
                    : showEmpty ? '2px dashed rgba(255,255,255,0.4)' : action ? `1px solid ${PPA_HEX[action]}` : '1px solid rgba(255,255,255,0.15)',
                  boxShadow: isLegalTarget ? `0 0 10px ${SIM_ACCENT}aa` : action ? `0 0 10px ${ppaRgba(action, 0.7)}` : 'none',
                  color: action ? PPA_TEXT[action] : '#fff', fontWeight: 700, fontSize: '13px',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  position: 'relative', touchAction: 'none', userSelect: 'none',
                }}>
                {showEmpty ? <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>vacío</span> : (
                  <>
                    <span>#{cell!.id}</span>
                    {action && (
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '10px' }}>
                        {VIB_HEIGHTS.map((h, vi) => (
                          <div key={vi} style={{ width: '2px', borderRadius: '1px', background: 'rgba(0,0,0,0.45)', height: `${h * 100}%` }} />
                        ))}
                      </div>
                    )}
                    {action && <span style={{ fontSize: '9px' }}>{ICONS[action]}</span>}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {dragState && board[dragState.fromIndex] && (() => {
          const fromRect = restRectsRef.current[dragState.fromIndex]
          if (!fromRect) return null
          const piece = board[dragState.fromIndex]!
          return (
            <div style={{
              position: 'fixed', left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height,
              borderRadius: '8px', background: TEAM_COLOR[piece.team],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '13px',
              boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
              transform: `translate(${dragState.dx}px, ${dragState.dy}px) scale(1.08)`,
              transition: dragState.snapping ? `transform ${SNAP_DURATION_MS}ms ease` : 'none',
              pointerEvents: 'none', zIndex: 50,
            }}>
              #{piece.id}
            </div>
          )
        })()}
      </div>

      <div style={simCard}><div style={simLabel}>MOVIMIENTOS SIMULADOS</div><div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px' }}>{moveCount}</div></div>

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

      <div style={simCard}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginBottom: '12px', padding: '7px 10px',
          background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
          border: `1px solid ${noSelWarning ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
          fontSize: '12px',
        }}>
          {noSelWarning ? (
            <><TriangleAlert size={13} color="#ef4444" /><span style={{ color: '#ef4444' }}>Selecciona un cubo antes de enviar una señal</span></>
          ) : selectedCubeId !== null ? (
            <>
              <span style={{ color: SIM_ACCENT }}>●</span><span style={{ color: '#888' }}>Cubo seleccionado:</span><span style={{ color: '#fff', fontWeight: 600 }}>#{selectedCubeId}</span>
              {activeAction && <span style={{ color: '#aaa' }}>— acción actual: <span style={{ color: PPA_TEXT[activeAction], fontWeight: 600 }}>{PPA_LABEL[activeAction]}</span></span>}
            </>
          ) : (
            <><span style={{ color: '#555' }}>○</span><span style={{ color: '#555' }}>Toca un cubo del tablero para seleccionarlo</span></>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
          {(['pausar', 'pensar', 'actuar'] as const).map(a => (
            <button key={a} onClick={() => guarded(() => onSend(a))} style={btnAction(a)}>
              <div style={iconCircle(a)}>{ICONS[a]}</div>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{PPA_LABEL[a]}</div>
              <div style={{ fontSize: '10px', color: '#888' }}>rgb({PPA_RGB[a].join(',')}) · {Math.round(PPA_VIBRATION[a] * 100)}% vibr.</div>
              <div style={{ fontSize: '9px', color: '#666' }}>{PPA_SOUND_LABEL[a]}</div>
              <div style={{ fontSize: '9px', color: '#666', fontStyle: 'italic' }}>{PPA_FRASE[a]}</div>
            </button>
          ))}
          <button onClick={() => guarded(onApagar)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            padding: '14px 12px', borderRadius: '12px', cursor: 'pointer',
            background: 'rgba(20,14,38,0.85)', border: '1px solid rgba(90,75,130,0.5)', color: '#aaa',
          }}>
            <Power size={16} />
            <div style={{ fontWeight: 700, fontSize: '13px' }}>ESTADO INICIAL</div>
            <div style={{ fontSize: '10px', color: '#888' }}>Apaga color y vibración</div>
            <div style={{ fontSize: '9px', color: '#666', fontStyle: 'italic' }}>Manual — o automático a los {AUTO_OFF_MS / 1000}s</div>
          </button>
        </div>
      </div>

      <div style={{ ...simCard, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>🔊</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>Señal sonora PPA</div>
              <div style={{ color: '#9088ab', fontSize: '10px' }}>Tono al enviar Pausar/Pensar/Actuar (simulado)</div>
            </div>
          </div>
          <span style={{ fontSize: '9px', color: activeAction ? SIM_ACCENT : '#777', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.08em', alignSelf: 'flex-start' }}>
            {activeAction ? 'activo' : 'en espera'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '40px' }}>
          {SND_H.map((h, i) => (
            <div key={i} style={{
              flex: 1, borderRadius: '2px 2px 0 0', background: SIM_ACCENT,
              height: `${activeAction ? h * 90 : h * 35}%`,
              transition: 'height 0.35s ease',
            }} />
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '10px 0' }} />
        <div style={{ fontSize: '10px', color: '#7a7095', marginBottom: '6px' }}>MÚSICA DE FONDO (OPCIONAL)</div>
        <AmbientMusicPanel accentColor={SIM_ACCENT} />
      </div>

      <div style={simCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ ...simLabel, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClipboardList size={12} /> BITÁCORA DEL OPERADOR (CONTROL SIMULADO) · {events.length}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> CSV</button>
            <button onClick={exportJson} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> JSON</button>
          </div>
        </div>
        <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '10px', fontFamily: 'monospace' }}>
          {events.length === 0 && <div style={{ color: '#555' }}>Sin envíos todavía.</div>}
          {[...events].reverse().map((ev, i) => (
            <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#aaa' }}>
              <span style={{ color: '#666' }}>{ev.timestamp}</span> · <span style={{ color: SIM_ACCENT }}>{ev.operadorId}</span> · {ev.detalle}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ControladorSimulado
