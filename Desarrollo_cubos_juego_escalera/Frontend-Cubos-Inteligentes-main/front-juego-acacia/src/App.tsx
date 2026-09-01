import { useEffect, useRef, useState } from 'react'
import './App.css'
import Cube, { CubeAction } from './components/Cube'
import AmbientMusicPanel from './components/AmbientMusicPanel'
import { GameState } from './core/GameState'
import socket from './client-socket/sockets'
import {
  Activity, Hand, Grid2X2, Shuffle,
  Wifi, WifiOff,
  Pause, Lightbulb, Zap, Power, Box, TriangleAlert, Download, ClipboardList, Check,
  Trophy, Ban,
} from 'lucide-react'
import {
  type EventoCubo, type DecisionOperador,
  toCsvEventosCubo, toCsvDecisionesOperador, downloadFile, nowIso,
} from './core/control/bitacoraControl'
import hexToRgbArray from './core/utils/hextToRgb'
import { playPpaFeedback, playError } from './core/utils/ppaTones'
import { PPA_RGB, PPA_HEX, PPA_TEXT, PPA_VIBRATION, PPA_VIB_PATTERN, PPA_SOUND_LABEL, PPA_LABEL, PPA_FRASE, ppaRgba, AUTO_OFF_MS, FALLAS_PARA_PAUSAR, type PPAPhase } from './core/ppa/ppaColors'
import { type Board, legalMovesFor, computeWinBoard, boardsEqual, isStuck } from './core/simulation/laEscaleraRules'
import PpaChargeMeter from './components/simulation/PpaChargeMeter'

const SND_H = [0.55, 0.75, 0.95, 0.60, 1.00, 0.80, 0.70, 0.90]
const INITIAL_POSITIONS = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10]

export type ObservedCube = { id: number; team: 'A' | 'B' }

function App({ onCubesUpdate }: { onCubesUpdate?: (cubes: ObservedCube[], cubeActions: Record<number, PPAPhase>) => void } = {}) {
  socket.connect()

  const teamBColor      = '#ff0000'
  const teamAColor      = '#0000ff'
  const emptySpaceColor = '#808080'
  const defVib          = 0.30
  const defFreq         = 0.30

  const originalCubes = [
    { id: 1,  color: teamAColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 2,  color: teamAColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 3,  color: teamAColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 4,  color: teamAColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 5,  color: teamAColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 0,  color: emptySpaceColor, vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 6,  color: teamBColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 7,  color: teamBColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 8,  color: teamBColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 9,  color: teamBColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
    { id: 10, color: teamBColor,      vibrationIntensity: defVib, iluminationFrequency: defFreq },
  ]

  const [cubesData,      setCubesData]      = useState(originalCubes)
  const [gameState,      setGameState]      = useState<GameState>({
    cubesPositions: [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10],
    liftedCube: null, emptyPosition: null,
  })
  // refleja si la base física (cubos) está realmente comunicándose con el servidor
  const [isBaseConnected, setIsBaseConnected] = useState(false)
  const [path,           setPath]           = useState<number[][]>([[1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10]])
  const [activeAction,   setActiveAction]   = useState<CubeAction | null>(null)
  const [selectedCubeId, setSelectedCubeId] = useState<number | null>(null)
  const [noSelWarning,   setNoSelWarning]   = useState(false)
  // tracks the action assigned to each cube id
  const [cubeActions,    setCubeActions]    = useState<Record<number, CubeAction>>({})
  const [esclavos,       setEsclavos]       = useState<number[]>([])
  const [pares,          setPares]          = useState(5)
  const [operatorId,     setOperatorId]     = useState('')
  const [operatorInput,  setOperatorInput]  = useState('')
  const [cuboEvents,     setCuboEvents]     = useState<EventoCubo[]>([])
  const [operatorEvents, setOperatorEvents] = useState<DecisionOperador[]>([])
  // Condición acumulada hacia Pausar/Pensar: fallas reales detectadas
  // comparando posiciones sucesivas contra las reglas del juego (ver
  // laEscaleraRules) — informativo, nunca dispara nada solo.
  const [fallaCount,      setFallaCount]      = useState(0)
  const [actuarThresholdSec, setActuarThresholdSec] = useState(8)
  const [tick,            setTick]            = useState(0)

  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esclavosRef  = useRef<number[]>([])
  const paresRef      = useRef(pares)
  const operatorIdRef = useRef(operatorId)
  const lastSettledPositionsRef = useRef<number[]>(INITIAL_POSITIONS)
  const turnStartRef = useRef<number>(Date.now())
  const prevControlStatusRef = useRef<'jugando' | 'victoria' | 'derrota'>('jugando')
  useEffect(() => { paresRef.current = pares }, [pares])
  useEffect(() => { operatorIdRef.current = operatorId }, [operatorId])
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [])
  void tick // fuerza el re-render del medidor de Actuar cada 500ms; su valor no se muestra

  function logCuboEvent(entry: Omit<EventoCubo, 'timestamp' | 'pares'>) {
    setCuboEvents(prev => [...prev, { timestamp: nowIso(), pares: paresRef.current, ...entry }])
  }
  function logOperatorEvent(entry: Omit<DecisionOperador, 'timestamp' | 'pares' | 'operadorId'>) {
    setOperatorEvents(prev => [...prev, { timestamp: nowIso(), pares: paresRef.current, operadorId: operatorIdRef.current || '(sin asignar)', ...entry }])
  }

  useEffect(() => {
    socket.on('disconnect', () => {
      setIsBaseConnected(false)
      logCuboEvent({ tipo: 'base_desconectada', detalle: 'Conexión con el backend perdida (evento disconnect)' })
    })
    socket.on('baseStatus', (data: { connected: boolean }) => {
      setIsBaseConnected(data.connected)
      logCuboEvent({
        tipo: data.connected ? 'base_conectada' : 'base_desconectada',
        detalle: data.connected ? 'La base física reporta conexión activa' : 'La base física reporta desconexión',
      })
    })
    socket.on('actualizarPosiciones', (data: { posiciones: number[] }) => {
      logCuboEvent({ tipo: 'posiciones', detalle: 'Actualización de posiciones reportada por la base', posiciones: [...data.posiciones] })
      SimDataReceived([...data.posiciones])
    })
    socket.on('esclavosConectados', (data: { esclavos: number[] }) => {
      const nuevos = data.esclavos ?? []
      const antes = esclavosRef.current
      for (const id of nuevos) if (!antes.includes(id)) {
        logCuboEvent({ tipo: 'esclavo_conectado', detalle: `Cubo esclavo #${id} conectado` })
        // Color de reposo del equipo (azul/rojo) al conectar, para que el
        // cubo nunca quede en el color natural del MDF sin señal — ver
        // PENDIENTES_TESIS.md, "Cubos sin color por defecto".
        socket.emit('comandoCubo', estadoInicialPayload(id))
      }
      for (const id of antes) if (!nuevos.includes(id)) logCuboEvent({ tipo: 'esclavo_desconectado', detalle: `Cubo esclavo #${id} desconectado` })
      esclavosRef.current = nuevos
      setEsclavos(nuevos)
    })
    return () => {
      socket.off('disconnect'); socket.off('baseStatus')
      socket.off('actualizarPosiciones'); socket.off('esclavosConectados')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { console.log('Estado actualizado:', gameState) }, [gameState])

  const cubes = gameState.cubesPositions.map((id) => {
    const d = cubesData.find(c => c.id === id)
    return d ?? { id: 0, color: emptySpaceColor, vibrationIntensity: 0, iluminationFrequency: 0 }
  })
  // El tablero físico siempre tiene 11 posiciones fijas (0-10, vacío en el
  // centro). Para un ejercicio de menos pares, se muestran solo las
  // posiciones más cercanas al centro (las mismas que ocuparía ese
  // ejercicio), sin inventar una reasignación de qué cubo físico es cuál.
  const visibleCubes = cubes.slice(5 - pares, 5 + pares + 1)

  // Victoria/derrota del tablero físico, con las mismas reglas de
  // laEscaleraRules que usa la simulación — informativo: no envía ninguna
  // señal por sí solo, solo se muestra al operador.
  const initialBoardForPares: Board = INITIAL_POSITIONS.slice(5 - pares, 5 + pares + 1)
    .map(id => id === 0 ? null : { id, team: id <= 5 ? 'A' as const : 'B' as const })
  const winBoardControl: Board = computeWinBoard(initialBoardForPares)
  const currentBoardControl: Board = visibleCubes.map(c => c.id === 0 ? null : { id: c.id, team: c.id <= 5 ? 'A' as const : 'B' as const })
  const controlStatus: 'jugando' | 'victoria' | 'derrota' =
    boardsEqual(currentBoardControl, winBoardControl) ? 'victoria'
      : isStuck(currentBoardControl, winBoardControl) ? 'derrota'
      : 'jugando'

  // Reporta el estado visible de los cubos hacia AppShell, para que la
  // pestaña "Vista de observador" (ahora principal, no anidada en
  // Simulación) pueda mostrar en vivo los mismos cubos y colores PPA sin
  // duplicar el estado del socket.
  useEffect(() => {
    onCubesUpdate?.(visibleCubes.filter(c => c.id !== 0).map(c => ({ id: c.id, team: c.id <= 5 ? 'A' as const : 'B' as const })), cubeActions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.cubesPositions, pares, cubeActions])

  async function SimDataReceived(positions: number[]) { await handleStateChange([...positions]) }

  async function handleStateChange(positions: number[]) {
    const empties: number[] = []
    for (let i = 0; i < positions.length; i++) if (positions[i] === 0) empties.push(i)
    if (empties.length === 2) {
      const prev = gameState.cubesPositions
      const v    = empties.find(i => prev[i] !== 0)!
      setCubesData(originalCubes)
      setGameState({ cubesPositions: [...positions], liftedCube: prev[v], emptyPosition: v })
    } else if (empties.length === 1) {
      // Detección real de fallas: compara el último estado asentado
      // (antes de que se levantara este cubo) contra el nuevo, usando las
      // mismas reglas del juego (laEscaleraRules) — el criterio real de
      // Pausar/Pensar en main.tex ("dos movimientos que no corresponden a
      // una opción válida"). Solo informa (medidor); nunca activa nada.
      const prevSettled = lastSettledPositionsRef.current
      const fromIdx = prevSettled.findIndex((v, i) => v !== 0 && positions[i] === 0)
      const toIdx = prevSettled.findIndex((v, i) => v === 0 && positions[i] !== 0)
      if (fromIdx !== -1 && toIdx !== -1) {
        const prevBoard: Board = prevSettled.map(id => id === 0 ? null : { id, team: id <= 5 ? 'A' as const : 'B' as const })
        const legal = legalMovesFor(prevBoard, fromIdx).includes(toIdx)
        if (legal) {
          setFallaCount(0)
          turnStartRef.current = Date.now()
        } else {
          playError()
          logCuboEvent({ tipo: 'falla_movimiento', detalle: `Movimiento inválido detectado: cubo #${prevSettled[fromIdx]} de la posición ${fromIdx + 1} a la ${toIdx + 1}` })
          setFallaCount(nf => (nf + 1 >= FALLAS_PARA_PAUSAR ? 0 : nf + 1))
        }
      }
      lastSettledPositionsRef.current = positions
      setCubesData(originalCubes)
      setPath(t => [...t, positions])
      setGameState({ cubesPositions: [...positions], liftedCube: null, emptyPosition: null })
    }
    socket.emit('restaurarCubos', 'restaurar')
  }

  function estadoInicialPayload(cubeId: number) {
    const color = cubeId <= 5 ? teamAColor : teamBColor
    return { id: cubeId, color: hexToRgbArray(color), vibrationIntensity: 0, iluminationFrequency: 0, tipo: 'estado_inicial' as const }
  }

  function triggerAction(a: CubeAction, cubeId: number) {
    if (actionTimer.current) clearTimeout(actionTimer.current)
    setActiveAction(a)
    actionTimer.current = setTimeout(() => {
      setActiveAction(null)
      socket.emit('comandoCubo', estadoInicialPayload(cubeId))
      setCubeActions(prev => { const next = { ...prev }; delete next[cubeId]; return next })
      logCuboEvent({ tipo: 'senal_apagada_automatica', detalle: `Señal del cubo #${cubeId} apagada automáticamente tras ${AUTO_OFF_MS / 1000}s (estado inicial)` })
    }, AUTO_OFF_MS)
  }
  function showNoSel() {
    if (warnTimer.current) clearTimeout(warnTimer.current)
    setNoSelWarning(true)
    warnTimer.current = setTimeout(() => setNoSelWarning(false), 2500)
  }

  function sendAction(a: CubeAction) {
    if (selectedCubeId === null) { showNoSel(); return }
    const cubeId = selectedCubeId
    const payloads: Record<CubeAction, object> = {
      pausar: { id: cubeId, color: PPA_RGB.pausar, vibrationIntensity: PPA_VIBRATION.pausar, iluminationFrequency: 0.50, tipo: 'pausar', ledModo: 'fija',       vibracionPatron: PPA_VIB_PATTERN.pausar.patron, vibracionRepeticiones: PPA_VIB_PATTERN.pausar.repeticiones, vibracionIntervalo: PPA_VIB_PATTERN.pausar.intervaloMs, sonido: { hz: 250, duracion: 500 } },
      pensar: { id: cubeId, color: PPA_RGB.pensar, vibrationIntensity: PPA_VIBRATION.pensar, iluminationFrequency: 1.00, tipo: 'pensar', ledModo: 'respiracion', vibracionPatron: PPA_VIB_PATTERN.pensar.patron, vibracionRepeticiones: PPA_VIB_PATTERN.pensar.repeticiones, vibracionIntervalo: PPA_VIB_PATTERN.pensar.intervaloMs, sonido: { hz: 600, patron: 'bip_bip' } },
      actuar: { id: cubeId, color: PPA_RGB.actuar, vibrationIntensity: PPA_VIBRATION.actuar, iluminationFrequency: 2.00, tipo: 'actuar', ledModo: 'fija',       vibracionPatron: PPA_VIB_PATTERN.actuar.patron, sonido: { hz_inicio: 600, hz_fin: 1000, duracion: 500 } },
    }
    socket.emit('comandoCubo', payloads[a])
    // update cube visual in real time
    setCubeActions(prev => ({ ...prev, [cubeId]: a }))
    triggerAction(a, cubeId)
    playPpaFeedback(a, AUTO_OFF_MS / 1000)
    logOperatorEvent({ cuboId: cubeId, fase: a, detalle: `Operador envió ${a.toUpperCase()} al cubo #${cubeId}` })
  }

  function apagarSenal() {
    if (selectedCubeId === null) { showNoSel(); return }
    const cubeId = selectedCubeId
    if (actionTimer.current) clearTimeout(actionTimer.current)
    socket.emit('comandoCubo', estadoInicialPayload(cubeId))
    setActiveAction(null)
    setCubeActions(prev => { const next = { ...prev }; delete next[cubeId]; return next })
    logOperatorEvent({ cuboId: cubeId, fase: 'estado_inicial', detalle: `Operador apagó manualmente la señal del cubo #${cubeId} (estado inicial)` })
  }

  function exportCuboEventsCsv() { downloadFile(`bitacora-cubos-control-${Date.now()}.csv`, toCsvEventosCubo(cuboEvents), 'text/csv;charset=utf-8') }
  function exportCuboEventsJson() { downloadFile(`bitacora-cubos-control-${Date.now()}.json`, JSON.stringify(cuboEvents, null, 2), 'application/json') }
  function exportOperatorEventsCsv() { downloadFile(`bitacora-operador-control-${Date.now()}.csv`, toCsvDecisionesOperador(operatorEvents), 'text/csv;charset=utf-8') }
  function exportOperatorEventsJson() { downloadFile(`bitacora-operador-control-${Date.now()}.json`, JSON.stringify(operatorEvents, null, 2), 'application/json') }

  // ── Derived display values ──────────────────────────────────────────────────
  const moveCount    = path.length - 1
  const selAction    = selectedCubeId !== null ? cubeActions[selectedCubeId] : undefined

  // Registra victoria/derrota una sola vez por partida (al pasar de
  // "jugando" a un estado final), no en cada render.
  useEffect(() => {
    if (controlStatus !== 'jugando' && prevControlStatusRef.current === 'jugando') {
      logCuboEvent(
        controlStatus === 'victoria'
          ? { tipo: 'victoria', detalle: `Intercambio completo en ${moveCount} movimientos` }
          : { tipo: 'derrota', detalle: 'Ningún cubo tiene ya un movimiento legal disponible (bloqueo)' }
      )
    }
    prevControlStatusRef.current = controlStatus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlStatus])

  // ── Shared styles ───────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'rgba(26,16,8,0.85)',
    border: '1px solid rgba(60,40,20,0.6)',
    borderRadius: '12px',
    padding: '14px 16px',
  }

  const btnAction = (a: PPAPhase): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    padding: '14px 12px', borderRadius: '12px', cursor: 'pointer',
    background: activeAction === a ? ppaRgba(a, 0.28) : 'rgba(26,16,8,0.85)',
    border: `${activeAction === a ? 2 : 1}px solid ${activeAction === a ? PPA_HEX[a] : 'rgba(60,40,20,0.6)'}`,
    color: PPA_TEXT[a],
    transition: 'all 0.25s',
    opacity: selectedCubeId === null ? 0.45 : 1,
  })

  const iconCircle = (a: PPAPhase): React.CSSProperties => ({
    width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: ppaRgba(a, 0.20),
    boxShadow: activeAction === a ? `0 0 16px ${ppaRgba(a, 0.6)}` : 'none',
    transition: 'box-shadow 0.25s',
  })

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(ellipse at top left, #3d1a00 0%, #1c0c00 45%, #080400 100%)',
      fontFamily: "'Manrope', 'Segoe UI', sans-serif",
      color: '#fff',
    }}>
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '16px 20px',
        gap: '12px',
        boxSizing: 'border-box',
      }}>

        {/* ── Header ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.07)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box size={20} color="#aaa" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Escalera Inteligente</h1>
              <p  style={{ margin: 0, fontSize: '12px', color: '#888' }}>Control Mago de Oz · el operador confirma cada señal</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: isBaseConnected ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${isBaseConnected ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
              borderRadius: '20px', padding: '5px 12px',
              color: isBaseConnected ? '#22c55e' : '#ef4444', fontSize: '13px',
            }}>
              {isBaseConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
              {isBaseConnected ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
        </header>

        {/* ── Sesión: pares en juego + identificador de operador ── */}
        <div style={{ ...card, flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.08em' }}>NIVEL · PARES DE CUBOS EN USO</span>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setPares(n)} style={{
                  width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer',
                  background: pares === n ? '#d97706' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${pares === n ? '#d97706' : 'rgba(255,255,255,0.12)'}`,
                  color: '#fff', fontWeight: 700, fontSize: '13px',
                }}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.08em' }}>OPERADOR · NOMBRE DE QUIEN CONFIRMA Y ENVÍA LAS SEÑALES</span>
            <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
              <input
                value={operatorInput}
                onChange={e => setOperatorInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && operatorInput.trim()) setOperatorId(operatorInput.trim()) }}
                placeholder="escribe el nombre y confirma"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: `1px solid ${operatorId && operatorInput.trim() === operatorId ? '#22c55e77' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '180px',
                }} />
              <button
                onClick={() => operatorInput.trim() && setOperatorId(operatorInput.trim())}
                disabled={!operatorInput.trim()}
                title="Confirmar nombre (o presiona Enter)"
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px',
                  background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                  color: '#22c55e', fontSize: '12px', cursor: operatorInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: operatorInput.trim() ? 1 : 0.4,
                }}>
                <Check size={13} /> Confirmar
              </button>
            </div>
            <div style={{ marginTop: '4px', fontSize: '11px' }}>
              {operatorId
                ? <span style={{ color: '#22c55e' }}>✓ Operador confirmado: {operatorId}</span>
                : <span style={{ color: '#f59e0b' }}>Sin confirmar — los eventos se registrarán como "(sin asignar)" hasta que confirmes</span>}
            </div>
          </div>
          <div style={{ color: '#555', fontSize: '11px', flex: 1, minWidth: '200px' }}>
Escribe tu nombre y confirma con Enter — queda en cada evento de la bitácora. No es un identificador oficial del proyecto (ver DECISIONES_PROYECTO.md).
          </div>
        </div>

        {/* ── Esclavos conectados ── */}
        <div style={{ ...card, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.08em' }}>CUBOS ESCLAVOS</span>
            <span style={{
              fontSize: '12px', fontWeight: 700,
              color: esclavos.length >= 10 ? '#22c55e' : esclavos.length >= 9 ? '#f59e0b' : '#ef4444',
            }}>
              {esclavos.length} / 10 conectados
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(id => {
              const conectado = esclavos.includes(id)
              return (
                <div key={id} style={{
                  width: '42px', height: '42px', borderRadius: '8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: conectado ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.10)',
                  border: `1px solid ${conectado ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'}`,
                  gap: '2px',
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: conectado ? '#22c55e' : '#ef4444',
                    boxShadow: conectado ? '0 0 6px #22c55e' : 'none',
                  }} />
                  <span style={{ fontSize: '10px', color: conectado ? '#22c55e' : '#666', fontWeight: 600 }}>
                    #{id}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', flexShrink: 0 }}>
          {([
            { title: 'ESTADO',         value: gameState.liftedCube !== null ? 'Procesando' : 'Listo', icon: <Activity size={14} color="#666" /> },
            { title: 'CUBO LEVANTADO', value: String(gameState.liftedCube ?? '—'),   icon: <Hand    size={14} color="#666" /> },
            { title: 'POSICIÓN VACÍA', value: gameState.emptyPosition != null ? String(gameState.emptyPosition + 1) : '—', icon: <Grid2X2 size={14} color="#666" /> },
            { title: 'MOVIMIENTOS',    value: String(moveCount),                     icon: <Shuffle size={14} color="#666" /> },
          ] as const).map(({ title, value, icon }) => (
            <div key={title} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', color: '#666', letterSpacing: '0.1em' }}>{title}</span>
                {icon}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>

        {controlStatus === 'victoria' && (
          <div style={{ ...card, flexShrink: 0, background: 'rgba(20,80,30,0.5)', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={20} color="#22c55e" />
            <span style={{ fontWeight: 700 }}>¡Victoria! Intercambio completo en {moveCount} movimientos.</span>
          </div>
        )}
        {controlStatus === 'derrota' && (
          <div style={{ ...card, flexShrink: 0, background: 'rgba(90,20,20,0.5)', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Ban size={20} color="#ef4444" />
            <span style={{ fontWeight: 700 }}>Derrota — ningún cubo tiene ya un movimiento legal disponible.</span>
          </div>
        )}

        {/* ── Board ── */}
        <div style={{ ...card, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.08em' }}>TABLERO · {pares} PAR(ES) · {visibleCubes.length} POSICIONES</span>
            <div style={{ display: 'flex', gap: '14px' }}>
              {[
                { label: 'Equipo A', color: teamAColor },
                { label: 'Equipo B', color: teamBColor },
                { label: 'Vacío',    color: 'transparent', border: '1px solid #666' },
              ].map(({ label, color, border }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, border }} />
                  <span style={{ fontSize: '11px', color: '#888' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {visibleCubes.map((cube, idx) => (
              <Cube
                key={idx}
                id={cube.id}
                color={cube.color}
                isSelected={selectedCubeId === cube.id && cube.id !== 0}
                action={cubeActions[cube.id]}
                onSelect={(id) => { if (id !== 0) setSelectedCubeId(id) }}
              />
            ))}
          </div>
          {/* Cube action legend */}
          {Object.keys(cubeActions).length > 0 && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Object.entries(cubeActions).map(([id, act]) => (
                <span key={id} style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                  background: ppaRgba(act, 0.4),
                  color: act === 'pensar' ? '#ffff88' : '#fff',
                  border: `1px solid ${ppaRgba(act, 0.4)}`,
                }}>
                  {act === 'pausar' ? '⏸' : act === 'pensar' ? '💡' : '⚡'} #{id}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Condición acumulada por fase (informativo) ── */}
        <div style={{ ...card, flexShrink: 0 }}>
          <div style={{ fontSize: '11px', color: '#666', letterSpacing: '0.08em', marginBottom: '10px' }}>
            CONDICIÓN ACUMULADA POR FASE — informativo, el operador decide si envía la señal
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pausar} label={'Pausar — fallas reales detectadas'} />
            <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pensar} label={'Pensar — mismo criterio, encadenado tras Pausar'} />
            <PpaChargeMeter value={Math.min(Math.floor((Date.now() - turnStartRef.current) / 1000), actuarThresholdSec)} max={actuarThresholdSec} colorHex={PPA_HEX.actuar} label={`Actuar — latencia sin mover (umbral ${actuarThresholdSec}s, no oficial)`} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <span style={{ fontSize: '11px', color: '#666' }}>Umbral Actuar (segundos, no oficial):</span>
            <input type="range" min={2} max={30} value={actuarThresholdSec}
              onChange={e => setActuarThresholdSec(Number(e.target.value))}
              style={{ flex: 1, maxWidth: '160px', accentColor: '#d97706' }} />
            <span style={{ fontSize: '11px' }}>{actuarThresholdSec}s</span>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div style={{ ...card, flexShrink: 0 }}>
          {/* Selection status bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '12px', padding: '7px 10px',
            background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
            border: `1px solid ${noSelWarning ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
            fontSize: '12px', transition: 'border-color 0.2s',
          }}>
            {noSelWarning ? (
              <><TriangleAlert size={13} color="#ef4444" /><span style={{ color: '#ef4444' }}>Selecciona un cubo del tablero antes de enviar una señal</span></>
            ) : selectedCubeId !== null ? (
              <>
                <span style={{ color: '#22c55e' }}>●</span>
                <span style={{ color: '#888' }}>Cubo seleccionado:</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>#{selectedCubeId}</span>
                {selAction && (
                  <span style={{ color: '#aaa' }}>
                    — acción actual:&nbsp;
                    <span style={{ color: PPA_TEXT[selAction], fontWeight: 600 }}>
                      {selAction === 'pausar' ? '⏸' : selAction === 'pensar' ? '💡' : '⚡'} {PPA_LABEL[selAction]}
                    </span>
                  </span>
                )}
              </>
            ) : (
              <><span style={{ color: '#555' }}>○</span><span style={{ color: '#555' }}>Haz clic en un cubo del tablero para seleccionarlo</span></>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
            {(['pausar', 'pensar', 'actuar'] as const).map(a => {
              const Icon = a === 'pausar' ? Pause : a === 'pensar' ? Lightbulb : Zap
              return (
                <button key={a} onClick={() => sendAction(a)} style={btnAction(a)}>
                  <div style={iconCircle(a)}><Icon size={22} color={PPA_TEXT[a]} /></div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em' }}>{PPA_LABEL[a]}</div>
                    <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>
                      rgb({PPA_RGB[a].join(',')}) · {Math.round(PPA_VIBRATION[a] * 100)}% vibr. · {PPA_SOUND_LABEL[a]}
                    </div>
                    <div style={{ fontSize: '10px', color: '#444', marginTop: '1px', fontStyle: 'italic' }}>{PPA_FRASE[a]}</div>
                  </div>
                </button>
              )
            })}
            {/* ESTADO INICIAL */}
            <button onClick={apagarSenal} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              padding: '14px 12px', borderRadius: '12px', cursor: 'pointer',
              background: 'rgba(26,16,8,0.85)', border: '1px solid rgba(60,40,20,0.6)',
              color: '#aaa', transition: 'all 0.25s', opacity: selectedCubeId === null ? 0.45 : 1,
            }}>
              <div style={{
                width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(150,150,150,0.15)',
              }}><Power size={22} color="#ccc" /></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em' }}>ESTADO INICIAL</div>
                <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>Apaga color y vibración</div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '1px', fontStyle: 'italic' }}>Manual — o automático a los {AUTO_OFF_MS / 1000}s</div>
              </div>
            </button>
          </div>
          <div style={{ color: '#555', fontSize: '11px', marginTop: '10px' }}>
            Cada señal enviada (Pausar/Pensar/Actuar) se apaga sola a los {AUTO_OFF_MS / 1000} segundos; "Estado inicial" la apaga antes, de inmediato.
          </div>
        </div>

        {/* ── Bottom panels ── */}
        <div style={{ flexShrink: 0 }}>

          {/* Sonido / música de fondo */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>🔊</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Señal sonora PPA</div>
                  <div style={{ color: '#666', fontSize: '10px' }}>Tono al enviar Pausar/Pensar/Actuar</div>
                </div>
              </div>
              <span style={{ fontSize: '9px', color: activeAction ? '#22c55e' : '#777', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.08em', alignSelf: 'flex-start' }}>
                {activeAction ? 'activo' : 'en espera'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '40px', marginBottom: '12px' }}>
              {SND_H.map((h, i) => (
                <div key={i} style={{
                  flex: 1, borderRadius: '2px 2px 0 0', background: '#16a34a',
                  height: `${activeAction ? h * 90 : h * 35}%`,
                  transition: 'height 0.35s ease',
                }} />
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0 10px' }} />
            <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px' }}>MÚSICA DE FONDO (OPCIONAL)</div>
            <AmbientMusicPanel accentColor="#d97706" />
          </div>

        </div>

        {/* ── Bitácoras (independientes: cubos vs. operador) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px', flexShrink: 0 }}>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ClipboardList size={12} /> BITÁCORA DE EVENTOS DE LOS CUBOS · {cuboEvents.length}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={exportCuboEventsCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> CSV</button>
                <button onClick={exportCuboEventsJson} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> JSON</button>
              </div>
            </div>
            <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '10px', fontFamily: 'monospace' }}>
              {cuboEvents.length === 0 && <div style={{ color: '#555' }}>Sin eventos todavía — reportados por el hardware físico.</div>}
              {[...cuboEvents].reverse().map((ev, i) => (
                <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#aaa' }}>
                  <span style={{ color: '#666' }}>{ev.timestamp}</span> · <span style={{ color: '#d97706' }}>{ev.tipo}</span> · {ev.detalle}
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ClipboardList size={12} /> BITÁCORA DEL OPERADOR (DECISIONES) · {operatorEvents.length}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={exportOperatorEventsCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> CSV</button>
                <button onClick={exportOperatorEventsJson} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> JSON</button>
              </div>
            </div>
            <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '10px', fontFamily: 'monospace' }}>
              {operatorEvents.length === 0 && <div style={{ color: '#555' }}>Sin decisiones todavía — cada envío de Pausar/Pensar/Actuar queda aquí.</div>}
              {[...operatorEvents].reverse().map((ev, i) => (
                <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#aaa' }}>
                  <span style={{ color: '#666' }}>{ev.timestamp}</span> · <span style={{ color: '#d97706' }}>{ev.operadorId}</span> · {ev.detalle}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
