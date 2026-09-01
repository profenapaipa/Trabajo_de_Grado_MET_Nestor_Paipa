import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Trophy, Ban, TriangleAlert, RotateCcw, Download,
  Pause, Lightbulb, Zap, Info, Eye, MousePointerClick,
} from 'lucide-react'
import {
  type Board, type Team,
  createInitialBoard, computeWinBoard, boardsEqual,
  legalMovesFor, isStuck, applyMove,
} from '../core/simulation/laEscaleraRules'
import {
  type PPAPhase, type BitacoraEvent,
  nowIso, toCsv, downloadFile,
} from '../core/simulation/bitacora'

// Etiqueta honesta: el umbral de Actuar quedó explícitamente pendiente en
// DECISIONES_PROYECTO.md (2026-09-01) — este valor es ajustable en pantalla
// y nunca debe presentarse como la calibración real.
const VERSION_CONFIGURACION = 'sim-config-v0.1 (umbral Actuar ajustable en pantalla, no calibrado)'

function playTone(freq: number, duration: number) {
  try {
    const ctx = new AudioContext(), osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.35, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(); osc.stop(ctx.currentTime + duration)
  } catch { /* audio no disponible en este navegador */ }
}
function playBipBip(freq: number) {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination); osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.30
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.01)
      g.gain.setValueAtTime(0.35, t + 0.12); g.gain.linearRampToValueAtTime(0, t + 0.15)
      osc.start(t); osc.stop(t + 0.16)
    }
  } catch { /* audio no disponible en este navegador */ }
}
function playAscending(s: number, e: number, d: number) {
  try {
    const ctx = new AudioContext(), osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.setValueAtTime(s, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(e, ctx.currentTime + d)
    g.gain.setValueAtTime(0.35, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d)
    osc.start(); osc.stop(ctx.currentTime + d)
  } catch { /* audio no disponible en este navegador */ }
}

const PPA_META: Record<PPAPhase, { label: string; color: string; text: string; icon: ReactNode; rgb: string }> = {
  pausar: { label: 'PAUSAR', color: 'rgba(0,0,150,0.85)', text: '#6699ff', icon: <Pause size={16} />, rgb: 'rgb(0,0,150)' },
  pensar: { label: 'PENSAR', color: 'rgba(180,180,0,0.55)', text: '#1a1a00', icon: <Lightbulb size={16} />, rgb: 'rgb(255,255,102)' },
  actuar: { label: 'ACTUAR', color: 'rgba(0,140,40,0.65)', text: '#00ff88', icon: <Zap size={16} />, rgb: 'rgb(0,255,0)' },
}

const TEAM_COLOR: Record<Team, string> = { A: '#0000ff', B: '#ff0000' }

function playFeedback(fase: PPAPhase) {
  if (fase === 'pausar') playTone(250, 0.5)
  if (fase === 'pensar') playBipBip(600)
  if (fase === 'actuar') playAscending(600, 1000, 0.5)
}

function SimulationTab() {
  const [role, setRole] = useState<'operador' | 'observador'>('operador')
  const [pairs, setPairs] = useState(1)
  const [board, setBoard] = useState<Board>(() => createInitialBoard(1))
  const [winBoard, setWinBoard] = useState<Board>(() => computeWinBoard(createInitialBoard(1)))
  const [selected, setSelected] = useState<number | null>(null)
  const [status, setStatus] = useState<'jugando' | 'victoria' | 'derrota'>('jugando')
  const [fallaCount, setFallaCount] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [pendingSuggestion, setPendingSuggestion] = useState<{ fase: PPAPhase; motivo: string } | null>(null)
  const [lastActivation, setLastActivation] = useState<{ fase: PPAPhase; at: string } | null>(null)
  const [actuarThresholdSec, setActuarThresholdSec] = useState(8)
  const [operatorId, setOperatorId] = useState('')
  const [events, setEvents] = useState<BitacoraEvent[]>([])
  const [discardReason, setDiscardReason] = useState('')
  const [showRules, setShowRules] = useState(false)

  const turnStartRef = useRef<number>(Date.now())

  function logEvent(
    partial: Omit<BitacoraEvent, 'timestamp' | 'esSimulacion' | 'operadorId' | 'versionConfiguracion' | 'pares' | 'posiciones'>,
    boardForLog: Board,
  ) {
    const entry: BitacoraEvent = {
      timestamp: nowIso(),
      esSimulacion: true,
      operadorId: operatorId || '(sin asignar)',
      versionConfiguracion: VERSION_CONFIGURACION,
      pares: pairs,
      posiciones: boardForLog.map(c => c?.id ?? null),
      ...partial,
    }
    setEvents(prev => [...prev, entry])
  }

  function startExercise(newPairs: number) {
    if (role === 'observador') return
    const initial = createInitialBoard(newPairs)
    const win = computeWinBoard(initial)
    setPairs(newPairs)
    setBoard(initial)
    setWinBoard(win)
    setSelected(null)
    setStatus('jugando')
    setFallaCount(0)
    setMoveCount(0)
    setPendingSuggestion(null)
    setLastActivation(null)
    turnStartRef.current = Date.now()
    logEvent({ tipo: 'reinicio', detalle: `Nuevo ejercicio: ${newPairs} par(es) de cubos` }, initial)
  }

  const didLogStartRef = useRef(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (didLogStartRef.current) return
    didLogStartRef.current = true
    logEvent({ tipo: 'reinicio', detalle: 'Sesión de simulación iniciada: 1 par de cubos' }, board)
  }, [])

  useEffect(() => {
    if (status !== 'jugando') return
    const id = setInterval(() => {
      if (pendingSuggestion !== null) return
      const elapsed = (Date.now() - turnStartRef.current) / 1000
      if (elapsed >= actuarThresholdSec) {
        const motivo = `latencia sin movimiento ≥ ${actuarThresholdSec}s (umbral configurable, no oficial)`
        setPendingSuggestion({ fase: 'actuar', motivo })
        logEvent({ tipo: 'sugerencia_ppa', fase: 'actuar', motivo, detalle: 'Sugerencia de Actuar emitida por latencia' }, board)
      }
    }, 500)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pendingSuggestion, actuarThresholdSec, board, operatorId, pairs])

  function handleCellClick(index: number) {
    if (status !== 'jugando') return
    const cell = board[index]

    if (selected === null) {
      if (cell) setSelected(index)
      return
    }
    if (index === selected) { setSelected(null); return }

    const legal = legalMovesFor(board, selected)
    if (cell === null && legal.includes(index)) {
      const moved = board[selected]!
      const next = applyMove(board, selected, index)
      setBoard(next)
      setSelected(null)
      setFallaCount(0)
      setMoveCount(m => m + 1)
      turnStartRef.current = Date.now()
      logEvent({ tipo: 'movimiento', detalle: `Cubo #${moved.id} movido de la posición ${selected + 1} a la ${index + 1}` }, next)

      if (boardsEqual(next, winBoard)) {
        setStatus('victoria')
        logEvent({ tipo: 'victoria', detalle: `Intercambio completo en ${moveCount + 1} movimientos` }, next)
      } else if (isStuck(next, winBoard)) {
        setStatus('derrota')
        logEvent({ tipo: 'derrota', detalle: 'Ningún cubo tiene un movimiento legal disponible (bloqueo)' }, next)
      }
      return
    }

    const attemptedId = board[selected]!.id
    setSelected(null)
    logEvent({ tipo: 'falla', detalle: `Intento inválido: mover el cubo #${attemptedId} a la posición ${index + 1}` }, board)

    const nf = fallaCount + 1
    if (nf >= 2 && pendingSuggestion === null) {
      setFallaCount(0)
      setPendingSuggestion({ fase: 'pausar', motivo: 'dos fallas consecutivas' })
      logEvent({ tipo: 'sugerencia_ppa', fase: 'pausar', motivo: 'dos fallas consecutivas', detalle: 'Sugerencia de Pausar emitida' }, board)
    } else {
      setFallaCount(nf)
    }
  }

  function resolveSuggestion(decision: 'confirmada' | 'descartada') {
    if (role === 'observador') return
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
      playFeedback(fase)
      if (fase === 'pausar') {
        const next = { fase: 'pensar' as PPAPhase, motivo: 'encadenado tras confirmar Pausar (mismo ciclo)' }
        setPendingSuggestion(next)
        logEvent({ tipo: 'sugerencia_ppa', fase: next.fase, motivo: next.motivo, detalle: 'Sugerencia de Pensar emitida (encadenada)' }, board)
      }
      if (fase === 'actuar') turnStartRef.current = Date.now()
    } else if (fase === 'actuar') {
      turnStartRef.current = Date.now()
    }
  }

  function exportCsv() {
    downloadFile(`bitacora-simulacion-${Date.now()}.csv`, toCsv(events), 'text/csv;charset=utf-8')
  }
  function exportJson() {
    downloadFile(`bitacora-simulacion-${Date.now()}.json`, JSON.stringify(events, null, 2), 'application/json')
  }

  const legalTargets = selected !== null ? legalMovesFor(board, selected) : []

  const card: React.CSSProperties = {
    background: 'rgba(26,16,8,0.85)', border: '1px solid rgba(60,40,20,0.6)',
    borderRadius: '12px', padding: '14px 16px',
  }
  const label: React.CSSProperties = { fontSize: '11px', color: '#666', letterSpacing: '0.08em' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 2px 20px' }}>

      {/* ── Encabezado y advertencia Mago de Oz ── */}
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>Simulación jugable — La Escalera</div>
          <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>
            {role === 'operador'
              ? 'Práctica sin cubos físicos. Toda sugerencia PPA requiere confirmación manual del operador — el sistema nunca activa nada por sí solo.'
              : 'Vista de observador: solo lectura. Puedes ver el tablero, las sugerencias y la bitácora en vivo, pero no confirmar ni descartar, ni cambiar la configuración de la sesión.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '3px' }}>
            <button onClick={() => setRole('operador')} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: role === 'operador' ? '#d97706' : 'transparent', color: role === 'operador' ? '#fff' : '#888', fontSize: '12px', fontWeight: 600,
            }}><MousePointerClick size={12} /> Operador</button>
            <button onClick={() => setRole('observador')} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: role === 'observador' ? '#d97706' : 'transparent', color: role === 'observador' ? '#fff' : '#888', fontSize: '12px', fontWeight: 600,
            }}><Eye size={12} /> Observador</button>
          </div>
          <button onClick={() => setShowRules(s => !s)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '6px 12px',
            color: '#fff', fontSize: '13px', cursor: 'pointer',
          }}>
            <Info size={13} /> {showRules ? 'Ocultar reglas' : 'Cómo se juega'}
          </button>
        </div>
      </div>

      {showRules && (
        <div style={{ ...card, fontSize: '13px', lineHeight: 1.6, color: '#ccc' }}>
          <p style={{ margin: '0 0 8px' }}>
            El tablero es una fila de 2n+1 casillas: n fichas azules a la izquierda, n rojas a la derecha, una vacía en el medio.
            Cada ficha solo avanza hacia el lado contrario — nunca retrocede — usando dos movimientos: <b>deslizar</b> a la
            casilla vacía adyacente, o <b>saltar</b> sobre una ficha del color contrario si la casilla siguiente está vacía.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <b>Victoria:</b> los dos grupos quedan completamente intercambiados. <b>Derrota:</b> ningún cubo tiene ya un
            movimiento legal disponible sin haber llegado a la victoria (bloqueo).
          </p>
          <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>
            Fuente: main.tex, "El juego La Escalera como problema matemático bien definido". La condición de derrota fue una
            decisión explícita del autor para esta simulación — no aparecía antes en ningún documento del proyecto.
          </p>
        </div>
      )}

      {/* ── Configuración de sesión (solo modo Operador) ── */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', opacity: role === 'observador' ? 0.45 : 1 }}>
        <div>
          <div style={label}>NIVEL · PARES DE CUBOS</div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} disabled={role === 'observador'} onClick={() => startExercise(n)} style={{
                width: '32px', height: '32px', borderRadius: '8px', cursor: role === 'observador' ? 'not-allowed' : 'pointer',
                background: pairs === n ? '#d97706' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${pairs === n ? '#d97706' : 'rgba(255,255,255,0.12)'}`,
                color: '#fff', fontWeight: 700, fontSize: '13px',
              }}>{n}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={label}>IDENTIFICADOR DE OPERADOR</div>
          <input value={operatorId} disabled={role === 'observador'} onChange={e => setOperatorId(e.target.value)} placeholder="sin asignar"
            style={{
              marginTop: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '160px',
              cursor: role === 'observador' ? 'not-allowed' : 'text',
            }} />
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={label}>UMBRAL ACTUAR (segundos, no oficial)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <input type="range" min={2} max={30} step={1} value={actuarThresholdSec} disabled={role === 'observador'}
              onChange={e => setActuarThresholdSec(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#00cc44' }} />
            <span style={{ fontSize: '13px', width: '32px' }}>{actuarThresholdSec}s</span>
          </div>
        </div>

        <button disabled={role === 'observador'} onClick={() => startExercise(pairs)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 14px',
          color: '#fff', fontSize: '13px', cursor: role === 'observador' ? 'not-allowed' : 'pointer', alignSelf: 'flex-end',
        }}>
          <RotateCcw size={13} /> Nuevo ejercicio
        </button>
      </div>

      <div style={{ color: '#555', fontSize: '11px' }}>
        Config: {VERSION_CONFIGURACION} · Identificadores de persona sin asignar todavía (ver DECISIONES_PROYECTO.md) — el campo de operador queda libre para pruebas.
        {role === 'observador' && ' · Modo Observador: controles de sesión bloqueados.'}
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
        <div style={card}><div style={label}>MOVIMIENTOS</div><div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px' }}>{moveCount}</div></div>
        <div style={card}><div style={label}>FALLAS CONSECUTIVAS</div><div style={{ fontSize: '22px', fontWeight: 700, marginTop: '6px' }}>{fallaCount}</div></div>
        <div style={card}><div style={label}>ESTADO</div><div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', textTransform: 'capitalize' }}>{status}</div></div>
      </div>

      {/* ── Banners victoria / derrota ── */}
      {status === 'victoria' && (
        <div style={{ ...card, background: 'rgba(20,80,30,0.5)', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={20} color="#22c55e" />
          <span style={{ fontWeight: 700 }}>¡Victoria! Intercambio completo en {moveCount} movimientos.</span>
        </div>
      )}
      {status === 'derrota' && (
        <div style={{ ...card, background: 'rgba(90,20,20,0.5)', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Ban size={20} color="#ef4444" />
          <span style={{ fontWeight: 700 }}>Derrota — ningún cubo tiene ya un movimiento legal disponible.</span>
        </div>
      )}

      {/* ── Tablero ── */}
      <div style={card}>
        <div style={{ ...label, marginBottom: '12px' }}>TABLERO · {pairs} PAR(ES)</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {board.map((cell, i) => {
            const isSelected = selected === i
            const isLegalTarget = legalTargets.includes(i)
            const bg = cell ? TEAM_COLOR[cell.team] : 'rgba(255,255,255,0.04)'
            return (
              <div key={i} data-cell={i} onClick={() => handleCellClick(i)} style={{
                width: '56px', height: '64px', borderRadius: '10px', background: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: status === 'jugando' ? 'pointer' : 'default',
                border: isSelected ? '3px solid #fff' : isLegalTarget ? '3px solid #d97706' : '1px solid rgba(255,255,255,0.15)',
                boxShadow: isLegalTarget ? '0 0 10px rgba(217,119,6,0.7)' : 'none',
                color: '#fff', fontWeight: 700, fontSize: '16px', transition: 'all 0.15s',
              }}>
                {cell ? `#${cell.id}` : ''}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Sugerencia PPA pendiente ── */}
      {pendingSuggestion && (
        <div style={{ ...card, border: `1px solid ${PPA_META[pendingSuggestion.fase].rgb}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TriangleAlert size={16} color="#f59e0b" />
            <span style={{ fontWeight: 700 }}>Sugerencia: {PPA_META[pendingSuggestion.fase].label}</span>
            <span style={{ color: '#888', fontSize: '12px' }}>— motivo: {pendingSuggestion.motivo}</span>
          </div>
          <div style={{ color: '#888', fontSize: '12px' }}>El sistema sugiere; el operador decide. Ninguna fase se activa sin confirmación.</div>
          {role === 'operador' ? (
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', fontStyle: 'italic' }}>
              <Eye size={12} /> Vista de observador — esperando la decisión del operador. Sin controles de confirmación.
            </div>
          )}
        </div>
      )}

      {/* ── Última señal confirmada (simulada) ── */}
      {lastActivation && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px' }}>
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

      {/* ── Bitácora ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={label}>BITÁCORA DE LA SESIÓN (SIMULACIÓN) · {events.length} EVENTOS</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '5px 10px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> CSV</button>
            <button onClick={exportJson} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '5px 10px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}><Download size={12} /> JSON</button>
          </div>
        </div>
        <div style={{ maxHeight: '220px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
          {events.length === 0 && <div style={{ color: '#555' }}>Sin eventos todavía.</div>}
          {[...events].reverse().map((ev, i) => (
            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#aaa' }}>
              <span style={{ color: '#666' }}>{ev.timestamp}</span> · <span style={{ color: '#d97706' }}>{ev.tipo}</span> · {ev.detalle}
              {ev.decision && <> · decisión: {ev.decision}{ev.motivoDescarte ? ` (${ev.motivoDescarte})` : ''}</>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SimulationTab
