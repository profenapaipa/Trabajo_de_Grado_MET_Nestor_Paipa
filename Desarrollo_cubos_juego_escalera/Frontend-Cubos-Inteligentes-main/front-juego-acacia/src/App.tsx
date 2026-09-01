import { useEffect, useRef, useState } from 'react'
import sound1 from './assets/sounds/loop.mp3'
import './App.css'
import Cube, { CubeAction } from './components/Cube'
import PlatformConfigPopup from './components/PlatformConfigPopup'
import { GameState } from './core/GameState'
import socket from './client-socket/sockets'
import {
  Activity, Hand, Grid2X2, Shuffle,
  Wifi, WifiOff, Send,
  Pause, Lightbulb, Zap, Box, TriangleAlert, Download, ClipboardList,
} from 'lucide-react'
import {
  type EventoCubo, type DecisionOperador,
  toCsvEventosCubo, toCsvDecisionesOperador, downloadFile, nowIso,
} from './core/control/bitacoraControl'

// ─── Web Audio helpers ────────────────────────────────────────────────────────
function playTone(freq: number, duration: number) {
  try {
    const ctx = new AudioContext(), osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.45, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(); osc.stop(ctx.currentTime + duration)
  } catch (e) { console.warn('Audio:', e) }
}
function playBipBip(freq: number) {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination); osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.30
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.45, t + 0.01)
      g.gain.setValueAtTime(0.45, t + 0.12); g.gain.linearRampToValueAtTime(0, t + 0.15)
      osc.start(t); osc.stop(t + 0.16)
    }
  } catch (e) { console.warn('Audio:', e) }
}
function playAscending(s: number, e2: number, d: number) {
  try {
    const ctx = new AudioContext(), osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.setValueAtTime(s, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(e2, ctx.currentTime + d)
    g.gain.setValueAtTime(0.45, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d)
    osc.start(); osc.stop(ctx.currentTime + d)
  } catch (e) { console.warn('Audio:', e) }
}

const VIB_H = [0.40, 0.65, 0.30, 0.85, 1.00, 0.70, 0.90, 0.50]
const SND_H = [0.55, 0.75, 0.95, 0.60, 1.00, 0.80, 0.70, 0.90]

// vibration display per action
const ACTION_VIB: Record<CubeAction, number> = { pausar: 0.20, pensar: 0.50, actuar: 0.80 }

function App() {
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
  const [currentAudio,   setCurrentAudio]   = useState<HTMLAudioElement | null>(null)
  const [currentSoundId, setCurrentSoundId] = useState(1)
  const [selectedCubeId, setSelectedCubeId] = useState<number | null>(null)
  const [noSelWarning,   setNoSelWarning]   = useState(false)
  // tracks the action assigned to each cube id
  const [cubeActions,    setCubeActions]    = useState<Record<number, CubeAction>>({})
  const [esclavos,       setEsclavos]       = useState<number[]>([])
  const [pares,          setPares]          = useState(5)
  const [operatorId,     setOperatorId]     = useState('')
  const [cuboEvents,     setCuboEvents]     = useState<EventoCubo[]>([])
  const [operatorEvents, setOperatorEvents] = useState<DecisionOperador[]>([])

  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esclavosRef  = useRef<number[]>([])
  const paresRef      = useRef(pares)
  const operatorIdRef = useRef(operatorId)
  useEffect(() => { paresRef.current = pares }, [pares])
  useEffect(() => { operatorIdRef.current = operatorId }, [operatorId])

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
      for (const id of nuevos) if (!antes.includes(id)) logCuboEvent({ tipo: 'esclavo_conectado', detalle: `Cubo esclavo #${id} conectado` })
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

  const stopAudio = () => {
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; setCurrentAudio(null) }
  }
  const playAudioById = (id: number) => {
    const map: Record<number, string> = { 1: sound1, 2: sound1, 3: sound1, 4: sound1, 5: sound1 }
    if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0 }
    const a = new Audio(map[id]); a.play(); setCurrentAudio(a)
  }

  async function SimDataReceived(positions: number[]) { await handleStateChange([...positions]) }

  async function SimDataSend() {
    socket.emit('comandoCubo', { id: 0, color: [173,216,230], vibrationIntensity: 0.23, iluminationFrequency: 1, soundId: 1 })
  }

  async function handleStateChange(positions: number[]) {
    const empties: number[] = []
    for (let i = 0; i < positions.length; i++) if (positions[i] === 0) empties.push(i)
    if (empties.length === 2) {
      const prev = gameState.cubesPositions
      const v    = empties.find(i => prev[i] !== 0)!
      setCubesData(originalCubes)
      setGameState({ cubesPositions: [...positions], liftedCube: prev[v], emptyPosition: v })
      stopAudio()
    } else if (empties.length === 1) {
      setCubesData(originalCubes)
      setPath(t => [...t, positions])
      setGameState({ cubesPositions: [...positions], liftedCube: null, emptyPosition: null })
    }
    socket.emit('restaurarCubos', 'restaurar')
  }

  function triggerAction(a: CubeAction) {
    if (actionTimer.current) clearTimeout(actionTimer.current)
    setActiveAction(a)
    actionTimer.current = setTimeout(() => setActiveAction(null), 3000)
  }
  function showNoSel() {
    if (warnTimer.current) clearTimeout(warnTimer.current)
    setNoSelWarning(true)
    warnTimer.current = setTimeout(() => setNoSelWarning(false), 2500)
  }

  function sendAction(a: CubeAction) {
    if (selectedCubeId === null) { showNoSel(); return }
    const payloads: Record<CubeAction, object> = {
      pausar: { id: selectedCubeId, color: [0,0,150],     vibrationIntensity: 0.20, iluminationFrequency: 0.50, tipo: 'pausar', ledModo: 'fija',       vibracionPatron: 'pulso_largo',  vibracionIntervalo: 2000, sonido: { hz: 250, duracion: 500 } },
      pensar: { id: selectedCubeId, color: [255,255,102], vibrationIntensity: 0.50, iluminationFrequency: 1.00, tipo: 'pensar', ledModo: 'respiracion', vibracionPatron: 'doble_pulso',  sonido: { hz: 600, patron: 'bip_bip' } },
      actuar: { id: selectedCubeId, color: [0,255,0],     vibrationIntensity: 0.80, iluminationFrequency: 2.00, tipo: 'actuar', ledModo: 'fija',       vibracionPatron: 'pulso_unico',  sonido: { hz_inicio: 600, hz_fin: 1000, duracion: 500 } },
    }
    socket.emit('comandoCubo', payloads[a])
    // update cube visual in real time
    setCubeActions(prev => ({ ...prev, [selectedCubeId]: a }))
    triggerAction(a)
    if (a === 'pausar') playTone(250, 0.5)
    if (a === 'pensar') playBipBip(600)
    if (a === 'actuar') playAscending(600, 1000, 0.5)
    logOperatorEvent({ cuboId: selectedCubeId, fase: a, detalle: `Operador envió ${a.toUpperCase()} al cubo #${selectedCubeId}` })
  }

  function exportCuboEventsCsv() { downloadFile(`bitacora-cubos-control-${Date.now()}.csv`, toCsvEventosCubo(cuboEvents), 'text/csv;charset=utf-8') }
  function exportCuboEventsJson() { downloadFile(`bitacora-cubos-control-${Date.now()}.json`, JSON.stringify(cuboEvents, null, 2), 'application/json') }
  function exportOperatorEventsCsv() { downloadFile(`bitacora-operador-control-${Date.now()}.csv`, toCsvDecisionesOperador(operatorEvents), 'text/csv;charset=utf-8') }
  function exportOperatorEventsJson() { downloadFile(`bitacora-operador-control-${Date.now()}.json`, JSON.stringify(operatorEvents, null, 2), 'application/json') }

  // ── Derived display values ──────────────────────────────────────────────────
  const moveCount    = path.length - 1
  const selAction    = selectedCubeId !== null ? cubeActions[selectedCubeId] : undefined
  const vibIntensity = activeAction ? ACTION_VIB[activeAction] : defVib

  const ledColor = activeAction === 'pausar' ? 'rgb(0,0,150)'    :
                   activeAction === 'pensar' ? 'rgb(255,255,102)' :
                   activeAction === 'actuar' ? 'rgb(0,255,0)'     : null
  const ledCircles   = ['#008080','#00bcd4','#e91e63','#4caf50','#9c27b0','#ff9800']
  const displayLed   = ledColor ? [ledColor, ...ledCircles.slice(1)] : ledCircles

  // ── Shared styles ───────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'rgba(26,16,8,0.85)',
    border: '1px solid rgba(60,40,20,0.6)',
    borderRadius: '12px',
    padding: '14px 16px',
  }

  const btnAction = (a: CubeAction): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
    padding: '14px 12px', borderRadius: '12px', cursor: 'pointer',
    background: activeAction === a
      ? a === 'pausar' ? 'rgba(30,60,180,0.28)' : a === 'pensar' ? 'rgba(120,110,0,0.28)' : 'rgba(0,110,40,0.28)'
      : 'rgba(26,16,8,0.85)',
    border: `${activeAction === a ? 2 : 1}px solid ${
      activeAction === a ? (a === 'pausar' ? '#4466ff' : a === 'pensar' ? '#cccc00' : '#00cc55')
      : 'rgba(60,40,20,0.6)'
    }`,
    color: a === 'pausar' ? '#6699ff' : a === 'pensar' ? '#ffff66' : '#00ff88',
    transition: 'all 0.25s',
    opacity: selectedCubeId === null ? 0.45 : 1,
  })

  const iconCircle = (a: CubeAction): React.CSSProperties => ({
    width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: a === 'pausar' ? 'rgba(0,0,180,0.20)' : a === 'pensar' ? 'rgba(150,130,0,0.20)' : 'rgba(0,140,40,0.20)',
    boxShadow: activeAction === a
      ? a === 'pausar' ? '0 0 16px rgba(0,80,255,0.6)' : a === 'pensar' ? '0 0 16px rgba(200,200,0,0.6)' : '0 0 16px rgba(0,220,80,0.6)'
      : 'none',
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
              <p  style={{ margin: 0, fontSize: '12px', color: '#888' }}>Panel de control IoT</p>
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
            <button onClick={SimDataSend} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px', padding: '6px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer',
            }}>
              <Send size={13} /> Simular envío
            </button>
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
            <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.08em' }}>IDENTIFICADOR DE OPERADOR</span>
            <div style={{ marginTop: '6px' }}>
              <input value={operatorId} onChange={e => setOperatorId(e.target.value)} placeholder="sin asignar" style={{
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '160px',
              }} />
            </div>
          </div>
          <div style={{ color: '#555', fontSize: '11px', flex: 1, minWidth: '200px' }}>
            El nivel etiqueta cada evento de la bitácora; no cambia qué cubos físicos responden. Identificador libre — no hay identificadores de persona asignados todavía (ver DECISIONES_PROYECTO.md).
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

        {/* ── Board ── */}
        <div style={{ ...card, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', color: '#666', letterSpacing: '0.08em' }}>TABLERO · 11 POSICIONES</span>
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
            {cubes.map((cube, idx) => (
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
                  background: act === 'pausar' ? 'rgba(0,0,140,0.5)' : act === 'pensar' ? 'rgba(180,180,0,0.4)' : 'rgba(0,160,60,0.4)',
                  color: act === 'pensar' ? '#ffff88' : '#fff',
                  border: `1px solid ${act === 'pausar' ? '#4466ff55' : act === 'pensar' ? '#cccc0055' : '#00cc5555'}`,
                }}>
                  {act === 'pausar' ? '⏸' : act === 'pensar' ? '💡' : '⚡'} #{id}
                </span>
              ))}
            </div>
          )}
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
                    <span style={{ color: selAction === 'pausar' ? '#6699ff' : selAction === 'pensar' ? '#ffff66' : '#00ff88', fontWeight: 600 }}>
                      {selAction === 'pausar' ? '⏸ PAUSAR' : selAction === 'pensar' ? '💡 PENSAR' : '⚡ ACTUAR'}
                    </span>
                  </span>
                )}
              </>
            ) : (
              <><span style={{ color: '#555' }}>○</span><span style={{ color: '#555' }}>Haz clic en un cubo del tablero para seleccionarlo</span></>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
            {/* PAUSAR */}
            <button onClick={() => sendAction('pausar')} style={btnAction('pausar')}>
              <div style={iconCircle('pausar')}><Pause size={22} color="#6699ff" /></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em' }}>PAUSAR</div>
                <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>rgb(0,0,150) · 20% vibr. · 250 Hz</div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '1px', fontStyle: 'italic' }}>"Detente. No respondas todavía."</div>
              </div>
            </button>
            {/* PENSAR */}
            <button onClick={() => sendAction('pensar')} style={btnAction('pensar')}>
              <div style={iconCircle('pensar')}><Lightbulb size={22} color="#ffff66" /></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em' }}>PENSAR</div>
                <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>rgb(255,255,102) · 50% vibr. · bip–bip 600 Hz</div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '1px', fontStyle: 'italic' }}>"Analiza y busca alternativas."</div>
              </div>
            </button>
            {/* ACTUAR */}
            <button onClick={() => sendAction('actuar')} style={btnAction('actuar')}>
              <div style={iconCircle('actuar')}><Zap size={22} color="#00ff88" /></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em' }}>ACTUAR</div>
                <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>rgb(0,255,0) · 80% vibr. · 600→1000 Hz</div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '1px', fontStyle: 'italic' }}>"La decisión está tomada."</div>
              </div>
            </button>
          </div>
        </div>

        {/* ── Bottom panels ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', flexShrink: 0 }}>

          {/* Vibración */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>〰</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Vibración</div>
                  <div style={{ color: '#666', fontSize: '10px' }}>Intensidad global</div>
                </div>
              </div>
              <span style={{ fontSize: '9px', color: '#777', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.08em', alignSelf: 'flex-start' }}>SIMULADO</span>
            </div>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', flex: 1, marginBottom: '10px', minHeight: '40px' }}>
              {VIB_H.map((h, i) => (
                <div key={i} style={{
                  flex: 1, borderRadius: '2px 2px 0 0', background: '#d97706',
                  height: `${Math.max(vibIntensity * h * 100, 6)}%`,
                  transition: 'height 0.35s ease',
                }} />
              ))}
            </div>
            <input type="range" min={0} max={1} step={0.01} value={vibIntensity} readOnly onChange={() => {}}
              style={{ width: '100%', accentColor: '#d97706', cursor: 'default' }} />
            <div style={{ color: '#777', fontSize: '11px', marginTop: '3px' }}>{vibIntensity.toFixed(2)}</div>
          </div>

          {/* LED */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>💡</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>LED</div>
                  <div style={{ color: '#666', fontSize: '10px' }}>Color y frecuencia</div>
                </div>
              </div>
              <span style={{ fontSize: '9px', color: '#777', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.08em', alignSelf: 'flex-start' }}>SIMULADO</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {displayLed.map((c, i) => (
                <div key={i} style={{
                  width: '28px', height: '28px', borderRadius: '50%', background: c,
                  border: `2px solid ${i === 0 && activeAction ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: i === 0 && activeAction ? `0 0 10px ${c}` : 'none',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>
            <input type="range" min={0} max={2} step={0.01} value={defFreq} readOnly onChange={() => {}}
              style={{ width: '100%', accentColor: '#00bcd4', cursor: 'default', marginTop: '10px' }} />
            <div style={{ color: '#777', fontSize: '11px', marginTop: '3px' }}>{defFreq.toFixed(2)} Hz</div>
          </div>

          {/* Sonido */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>🔊</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Sonido</div>
                  <div style={{ color: '#666', fontSize: '10px' }}>Plataforma · pista {currentSoundId}</div>
                </div>
              </div>
              <span style={{ fontSize: '9px', color: activeAction ? '#22c55e' : '#777', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.08em', alignSelf: 'flex-start' }}>
                {activeAction ? 'activo' : 'en espera'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', flex: 1, marginBottom: '12px', minHeight: '40px' }}>
              {SND_H.map((h, i) => (
                <div key={i} style={{
                  flex: 1, borderRadius: '2px 2px 0 0', background: '#16a34a',
                  height: `${activeAction ? h * 90 : h * 35}%`,
                  transition: 'height 0.35s ease',
                }} />
              ))}
            </div>
            <PlatformConfigPopup
              currentSoundId={currentSoundId}
              onSave={({ soundId }) => { setCurrentSoundId(soundId); playAudioById(soundId) }}
            />
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
