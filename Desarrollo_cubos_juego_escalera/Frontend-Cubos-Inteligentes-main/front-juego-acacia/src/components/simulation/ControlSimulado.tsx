import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import {
  type Board, createInitialBoard, computeWinBoard, boardsEqual, isStuck, applyMove,
} from '../../core/simulation/laEscaleraRules'
import { classifyAttempt, explainError } from '../../core/simulation/tutor'
import {
  PPA_RGB, PPA_HEX, PPA_TEXT, PPA_VIBRATION, PPA_SOUND_LABEL, PPA_LABEL, PPA_FRASE,
  ppaRgba, AUTO_OFF_MS, FALLAS_PARA_PAUSAR, type PPAPhase,
} from '../../core/ppa/ppaColors'
import { playPpaFeedback, playError } from '../../core/utils/ppaTones'
import { type DecisionOperador, toCsvDecisionesOperador, downloadFile, nowIso } from '../../core/control/bitacoraControl'
import AmbientMusicPanel from '../AmbientMusicPanel'
import { Panel, SectionTitle, Collapsible, LogPanel, TwoColumn, SignalGlyph, Electrode } from '../../ui/brand'
import { sectionLabel, smallBtn, TEAM_HEX } from '../../ui/styles'
import PpaChargeMeter from './PpaChargeMeter'
import SimBoard from './SimBoard'

// Réplica de Control Mago de Oz para practicar el rol de operador sin
// hardware: mismos botones PPA, misma barra lateral. La diferencia, a
// propósito: aquí sí se pueden arrastrar los cubos para simular lo que
// haría un estudiante (en Control solo se refleja lo que reportan los
// sensores reales), y cada movimiento inválido se explica en pantalla.

const SND_H = [0.55, 0.75, 0.95, 0.60, 1.00, 0.80, 0.70, 0.90]

function ControlSimulado({ pares, operatorId, sidebarTop }: { pares: number; operatorId: string; sidebarTop: ReactNode }) {
  const [board, setBoard] = useState<Board>(() => createInitialBoard(pares))
  const [selectedPos, setSelectedPos] = useState<number | null>(null)
  const [selectedCubeId, setSelectedCubeId] = useState<number | null>(null)
  const [status, setStatus] = useState<'jugando' | 'victoria' | 'bloqueado'>('jugando')
  const [moves, setMoves] = useState(0)
  const [fallaCount, setFallaCount] = useState(0)
  const [errorCell, setErrorCell] = useState<number | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [cubeActions, setCubeActions] = useState<Record<number, PPAPhase>>({})
  const [activeAction, setActiveAction] = useState<PPAPhase | null>(null)
  const [noSelWarning, setNoSelWarning] = useState(false)
  const [events, setEvents] = useState<DecisionOperador[]>([])
  const [actuarThresholdSec, setActuarThresholdSec] = useState(8)
  const [logOpen, setLogOpen] = useState(true)
  const [, setTick] = useState(0)
  const offTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnStartRef = useRef(Date.now())

  const win = computeWinBoard(createInitialBoard(pares))

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [])

  function resetBoard(n: number) {
    setBoard(createInitialBoard(n))
    setSelectedPos(null); setErrorCell(null); setLastError(null)
    setStatus('jugando'); setMoves(0); setFallaCount(0)
    turnStartRef.current = Date.now()
  }

  const [paresSeen, setParesSeen] = useState(pares)
  if (paresSeen !== pares) {
    setParesSeen(pares)
    resetBoard(pares)
  }

  function logControl(entry: Omit<DecisionOperador, 'timestamp' | 'pares' | 'operadorId'>) {
    setEvents(prev => [...prev, { timestamp: nowIso(), pares, operadorId: operatorId || '(sin asignar)', ...entry }])
  }

  function handleMove(from: number, to: number) {
    if (!classifyAttempt(board, from, to).ok) return
    const moved = board[from]!
    const next = applyMove(board, from, to)
    setBoard(next); setSelectedPos(null); setErrorCell(null); setLastError(null)
    setMoves(m => m + 1); setFallaCount(0)
    setSelectedCubeId(moved.id)
    turnStartRef.current = Date.now()
    if (boardsEqual(next, win)) setStatus('victoria')
    else if (isStuck(next, win)) setStatus('bloqueado')
  }

  function handleInvalid(from: number, to: number) {
    if (from === to) return
    const res = classifyAttempt(board, from, to)
    if (res.ok) return
    const { titulo, texto } = explainError(res.error, board[from]!.team)
    playError()
    setErrorCell(to)
    setLastError(`${titulo}. ${texto}`)
    setFallaCount(n => (n + 1 >= FALLAS_PARA_PAUSAR ? FALLAS_PARA_PAUSAR : n + 1))
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

  function send(a: PPAPhase) {
    const id = selectedCubeId!
    if (offTimers.current[id]) clearTimeout(offTimers.current[id])
    setCubeActions(prev => ({ ...prev, [id]: a }))
    setActiveAction(a)
    playPpaFeedback(a, AUTO_OFF_MS / 1000)
    logControl({ cuboId: id, fase: a, detalle: `Operador envió ${a.toUpperCase()} (simulado) al cubo #${id}` })
    if (a === 'pausar' || a === 'pensar') setFallaCount(0)
    offTimers.current[id] = setTimeout(() => {
      setCubeActions(prev => { const n = { ...prev }; delete n[id]; return n })
      setActiveAction(null)
      logControl({ cuboId: id, fase: 'estado_inicial', detalle: `Señal del cubo #${id} apagada automáticamente tras ${AUTO_OFF_MS / 1000}s (simulado)` })
    }, AUTO_OFF_MS)
  }

  function apagar() {
    const id = selectedCubeId!
    if (offTimers.current[id]) clearTimeout(offTimers.current[id])
    setCubeActions(prev => { const n = { ...prev }; delete n[id]; return n })
    setActiveAction(null)
    logControl({ cuboId: id, fase: 'estado_inicial', detalle: `Operador apagó manualmente la señal del cubo #${id} (simulado)` })
  }

  function exportCsv() { downloadFile(`bitacora-control-simulado-${Date.now()}.csv`, toCsvDecisionesOperador(events), 'text/csv;charset=utf-8') }
  function exportJson() { downloadFile(`bitacora-control-simulado-${Date.now()}.json`, JSON.stringify(events, null, 2), 'application/json') }

  const selAction = selectedCubeId !== null ? cubeActions[selectedCubeId] : undefined
  const signalBtn = (a: PPAPhase): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '14px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
    background: selAction === a ? ppaRgba(a, 0.10) : 'var(--color-panel)',
    border: `${selAction === a ? 2 : 1}px solid ${selAction === a ? PPA_HEX[a] : 'var(--color-line)'}`,
    opacity: selectedCubeId === null ? 0.5 : 1,
  })
  const latency = Math.min(Math.floor((Date.now() - turnStartRef.current) / 1000), actuarThresholdSec)

  const main = (
    <>
      <Panel>
        <SectionTitle right={
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {[{ l: 'Equipo A', c: TEAM_HEX.A }, { l: 'Equipo B', c: TEAM_HEX.B }, { l: 'Vacío', c: '#808080' }].map(x => (
              <span key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-paper-dim)' }}>
                <span style={{ width: '8px', height: '8px', background: x.c }} />{x.l}
              </span>
            ))}
            <button onClick={() => resetBoard(pares)} style={smallBtn}>Reiniciar tablero</button>
          </div>
        }>
          Tablero simulado · {pares} par{pares > 1 ? 'es' : ''} · {moves} movimientos
        </SectionTitle>
        <SimBoard
          board={board} disabled={status !== 'jugando'}
          selected={selectedPos} onSelect={i => { setSelectedPos(i); setErrorCell(null) }}
          onTapPiece={i => { const p = board[i]; if (p) setSelectedCubeId(p.id) }}
          onMove={handleMove} onInvalid={handleInvalid}
          errorCell={errorCell} cubeActions={cubeActions} />
        {(lastError || status !== 'jugando') && (
          <div style={{
            marginTop: '12px', padding: '8px 12px', borderRadius: 'var(--radius)', background: 'var(--color-bg)', fontSize: '13px',
            borderLeft: `3px solid ${status === 'victoria' ? 'var(--color-online)' : 'var(--color-offline)'}`,
          }}>
            {status === 'victoria' ? `¡Intercambio completo en ${moves} movimientos!`
              : status === 'bloqueado' ? 'Bloqueado — ningún cubo tiene ya un movimiento legal disponible.'
                : `Movimiento no permitido: ${lastError}`}
          </div>
        )}
      </Panel>

      <Panel>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', marginBottom: '12px',
          background: 'var(--color-bg)', borderRadius: 'var(--radius)', fontSize: '12px',
          border: `1px solid ${noSelWarning ? 'var(--color-offline)' : 'var(--color-line)'}`,
        }}>
          {noSelWarning ? (
            <><TriangleAlert size={13} color="var(--color-offline)" /><span style={{ color: 'var(--color-offline)' }}>Selecciona un cubo del tablero antes de enviar una señal</span></>
          ) : selectedCubeId !== null ? (
            <>
              <Electrode on />
              <span style={{ color: 'var(--color-paper-dim)' }}>Cubo seleccionado:</span>
              <span style={{ fontWeight: 600 }}>#{selectedCubeId}</span>
              {selAction && <span style={{ color: 'var(--color-paper-dim)' }}>— acción actual: <span style={{ color: PPA_TEXT[selAction], fontWeight: 600 }}>{PPA_LABEL[selAction]}</span></span>}
            </>
          ) : (
            <><Electrode on={false} /><span style={{ color: 'var(--color-paper-faint)' }}>Toca un cubo del tablero para seleccionarlo</span></>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
          {(['pausar', 'pensar', 'actuar'] as const).map(a => (
            <button key={a} onClick={() => guarded(() => send(a))} style={signalBtn(a)}>
              <SignalGlyph phase={a} color={PPA_TEXT[a]} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.06em', color: PPA_TEXT[a] }}>{PPA_LABEL[a]}</div>
                <div style={{ fontSize: '10px', color: 'var(--color-paper-faint)', marginTop: '3px', fontFamily: 'var(--font-mono)' }}>
                  {PPA_RGB[a].join(',')} · {Math.round(PPA_VIBRATION[a] * 100)}% · {PPA_SOUND_LABEL[a]}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-paper-faint)', marginTop: '2px', fontStyle: 'italic' }}>{PPA_FRASE[a]}</div>
              </div>
            </button>
          ))}
          <button onClick={() => guarded(apagar)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '14px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
            background: 'var(--color-panel)', border: '1px solid var(--color-line)', opacity: selectedCubeId === null ? 0.5 : 1,
          }}>
            <svg width="32" height="22" viewBox="0 0 32 22" fill="none" aria-hidden="true">
              <circle cx="16" cy="11" r="8" stroke="var(--color-paper-dim)" strokeWidth="1.6" />
              <line x1="16" y1="4" x2="16" y2="11" stroke="var(--color-paper-dim)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.06em', color: 'var(--color-paper-dim)' }}>ESTADO INICIAL</div>
              <div style={{ fontSize: '10px', color: 'var(--color-paper-faint)', marginTop: '3px' }}>Apaga color y vibración · auto {AUTO_OFF_MS / 1000}s</div>
            </div>
          </button>
        </div>
      </Panel>

      <Collapsible title="Histórico — bitácora del operador (simulado)" open={logOpen} onToggle={() => setLogOpen(o => !o)}>
        <LogPanel
          title="Bitácora del operador (control simulado)"
          rows={events.map(e => ({ ts: e.timestamp, tag: e.operadorId, text: e.detalle }))}
          empty="Sin envíos todavía."
          onCsv={exportCsv} onJson={exportJson} />
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
      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={sectionLabel}>Señal sonora PPA</div>
          <span style={{ fontSize: '9px', color: activeAction ? 'var(--color-blue)' : 'var(--color-paper-faint)' }}>{activeAction ? 'activo' : 'en espera'}</span>
        </div>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '24px', marginBottom: '12px' }}>
          {SND_H.map((h, i) => <div key={i} style={{ flex: 1, background: 'var(--color-line-strong)', height: `${activeAction ? h * 90 : h * 35}%` }} />)}
        </div>
        <div style={{ ...sectionLabel, marginBottom: '6px' }}>Música de fondo</div>
        <AmbientMusicPanel accentColor="#4589FF" />
      </Panel>
    </>
  )

  return <TwoColumn main={main} side={side} />
}

export default ControlSimulado
