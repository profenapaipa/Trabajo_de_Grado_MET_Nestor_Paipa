import { useEffect, useRef, useState } from 'react'
import './App.css'
import Cube, { CubeAction } from './components/Cube'
import AmbientMusicPanel from './components/AmbientMusicPanel'
import { GameState } from './core/GameState'
import socket from './client-socket/sockets'
import { TriangleAlert, Download } from 'lucide-react'
import {
  type EventoCubo, type DecisionOperador,
  toCsvEventosCubo, toCsvDecisionesOperador, downloadFile, nowIso,
} from './core/control/bitacoraControl'
import hexToRgbArray from './core/utils/hextToRgb'
import { playPpaFeedback, playError, playCountdownBeep } from './core/utils/ppaTones'
import { PPA_RGB, PPA_HEX, PPA_TEXT, PPA_VIBRATION, PPA_SOUND_LABEL, PPA_LABEL, PPA_FRASE, ppaRgba, AUTO_OFF_MS, FALLAS_PARA_PAUSAR, type PPAPhase, EFECTOS } from './core/ppa/ppaColors'
import { type Board, legalMovesFor, computeWinBoard, boardsEqual, isStuck } from './core/simulation/laEscaleraRules'
import {
  type SessionState, type SustainedCubeVisual,
  sessionVisualTier, resolveSustainedVisual, sustainedVisualToCommand, resolveCubeDisplay,
} from './core/ppa/cubeVisualState'
import PpaChargeMeter from './components/simulation/PpaChargeMeter'

const SND_H = [0.55, 0.75, 0.95, 0.60, 1.00, 0.80, 0.70, 0.90]
const INITIAL_POSITIONS = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10]

// Glifos de señal neuronal, uno por fase PPA — no íconos de librería
// genéricos: cada trazo ilustra literalmente el concepto cognitivo de su
// fase (Pausar = actividad calma, Pensar = búsqueda irregular, Actuar = un
// potencial de acción — el disparo súbito de una neurona), tomado del
// vocabulario visual real de EEG que atraviesa toda la tesis.
const SIGNAL_PATH: Record<PPAPhase, string> = {
  pausar: 'M2,13 Q9,7 16,13 Q23,7 30,13',
  pensar: 'M2,13 L7,5 L12,17 L17,7 L22,15 L27,9 L30,13',
  actuar: 'M2,13 L11,13 L13.5,2 L16,20 L18.5,13 L30,13',
}
function SignalGlyph({ phase, color }: { phase: PPAPhase; color: string }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22" fill="none" aria-hidden="true">
      <path d={SIGNAL_PATH[phase]} stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Trazo EEG usado como línea de estado bajo el encabezado — el propio
// instrumento de la tesis como elemento de identidad, no un ícono de
// librería. El color refleja el estado real de conexión, así que informa
// además de decorar. Única excepción deliberada a la regla de "nada de
// animación decorativa": un destello periódico (no un loop constante) que
// recorre el trazo cada ~7s, pedido explícitamente para dar vida a este
// elemento sin caer en movimiento gratuito — ver @keyframes eeg-sweep en
// index.css. pathLength=100 normaliza el dasharray/dashoffset a un 0-100
// fijo sin depender de la longitud geométrica real del trazo en zigzag.
const EEG_TRACE = '0,10 22,10 28,3 34,17 40,10 74,10 80,4 86,16 92,10 130,10 137,2 144,18 151,10 190,10 196,5 202,15 208,10 250,10 256,3 262,17 268,10 310,10 316,4 322,16 328,10 370,10 376,3 383,17 390,10 400,10'
function EegTrace({ color }: { color: string }) {
  return (
    <svg width="100%" height="18" viewBox="0 0 400 20" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <polyline points={EEG_TRACE} fill="none" stroke={color} strokeWidth="1.1" />
      <polyline
        points={EEG_TRACE}
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        pathLength={100}
        style={{ mixBlendMode: 'screen', animation: 'eeg-sweep 7s linear infinite' }}
      />
    </svg>
  )
}

// Marcador tipo electrodo — reemplaza el punto circular genérico de estado
// por el vocabulario visual de un sensor EEG (relleno = señal presente).
// Color por defecto (azul/alerta) para usos generales de "activo/inactivo"
// (selección, victoria/derrota); los usos de conexión real pasan
// verde/rojo explícito — ver colorOn/colorOff en cada llamado.
function Electrode({ on, colorOn = 'var(--color-blue)', colorOff = 'var(--color-offline)' }: { on: boolean; colorOn?: string; colorOff?: string }) {
  return (
    <span style={{
      width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block', flexShrink: 0,
      background: on ? colorOn : 'transparent',
      border: `1.5px solid ${on ? colorOn : colorOff}`,
    }} />
  )
}

// Marca del proyecto: una escalera geométrica — dos tramos de escalón que
// suben desde cada lado hasta un mismo pico central, mitad azul (equipo A)
// y mitad roja (equipo B). No es un ícono de librería: es el mecanismo real
// del juego (dos colores que ascienden y se cruzan) hecho logotipo.
function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * (20 / 32)} viewBox="0 0 32 20" aria-hidden="true">
      <path d="M0,20 L5.3,20 L5.3,14 L10.6,14 L10.6,8 L16,8 L16,2 L16,20 Z" fill="var(--color-blue)" />
      <path d="M16,2 L16,8 L21.3,8 L21.3,14 L26.7,14 L26.7,20 L32,20 L16,20 Z" fill="var(--color-red)" />
    </svg>
  )
}

type WatermarkLogo = { x: number; y: number; rotation: number; size: number }

// Marca de agua del logo, esparcida al azar por el fondo — cada entrada a
// la página genera una disposición nueva (posición y rotación de cada
// copia), no un patrón fijo repetido: primero fue una sola copia en una
// esquina (quedaba tapada por los paneles), luego un mosaico regular
// (se veía cuadriculado); esta versión resuelve ambos con posiciones y
// giros aleatorios por sesión, con separación mínima entre copias para
// que nunca se superpongan ni se choquen entre sí.
function generateWatermarkLogos(width: number, height: number): WatermarkLogo[] {
  const COUNT = 14
  const MARGIN = 60
  const MIN_DIST = 130 // > 2x el semi-diagonal del logo más grande (tamaño 64) — nunca se tocan
  const MAX_ATTEMPTS = 200
  const logos: WatermarkLogo[] = []
  for (let i = 0; i < COUNT; i++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const x = MARGIN + Math.random() * Math.max(width - MARGIN * 2, 1)
      const y = MARGIN + Math.random() * Math.max(height - MARGIN * 2, 1)
      const collides = logos.some(l => Math.hypot(l.x - x, l.y - y) < MIN_DIST)
      if (!collides) {
        logos.push({ x, y, rotation: Math.random() * 360, size: 40 + Math.random() * 24 })
        break
      }
    }
  }
  return logos
}

// Medio escalón, tomado directamente de la mitad izquierda del logo —
// marcador recurrente para títulos de sección en vez de una viñeta
// genérica. Monocromo a propósito: no compite con el azul/rojo de marca.
function StepMark({ color = 'var(--color-paper-faint)', size = 13 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M0,16 L5.3,16 L5.3,10.7 L10.6,10.7 L10.6,5.3 L16,5.3 L16,16 Z" fill={color} />
    </svg>
  )
}

export type ObservedCube = { id: number; team: 'A' | 'B' }

function App({ onCubesUpdate }: { onCubesUpdate?: (cubes: ObservedCube[], cubeActions: Record<number, PPAPhase>) => void } = {}) {
  socket.connect()

  // Disposición de la marca de agua: se calcula una sola vez por montaje
  // (cada vez que se entra a la página), no en cada render.
  const [watermarkLogos] = useState<WatermarkLogo[]>(() => generateWatermarkLogos(window.innerWidth, window.innerHeight))

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
  // Estado puramente de presentación (no de juego): abre/cierra el panel de
  // histórico (bitácoras, condición acumulada, música ambiental).
  const [histOpen,       setHistOpen]       = useState(true)
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

  // ── Control de partida (Iniciar/Pausar/Reiniciar) ──────────────────────────
  const [sessionState,   setSessionState]   = useState<SessionState>('inactivo')
  const [countdownTick,  setCountdownTick]  = useState<number | null>(null) // 3,2,1,0("¡Inicia!") mientras cuenta
  const [flashCubeId,    setFlashCubeId]    = useState<number | null>(null) // reacción inmediata a movimiento inválido, en espejo con EF=3 del cubo físico
  const [sessionWarning, setSessionWarning] = useState<string | null>(null)
  // Cuántos intentos lleva la sesión — un correlativo legible (1, 2, 3…)
  // aparte del intentoId interno (timestamp, sirve para agrupar filas de
  // bitácora pero no para contar). Nunca baja: Reiniciar cierra el intento
  // en curso, pero el próximo Iniciar sigue la numeración, no la reinicia.
  const [intentoCount,   setIntentoCount]   = useState(0)
  const [confirmReset,   setConfirmReset]   = useState(false)

  const intentoIdRef        = useRef<string | null>(null)
  // Espejo síncrono de intentoCount para las bitácoras: logCuboEvent se
  // llama en el mismo tick que setIntentoCount, antes de que el nuevo
  // valor de estado esté disponible por closure — igual que intentoIdRef,
  // que existe por la misma razón.
  const intentoNumRef       = useRef<number>(0)
  const sessionStartRef     = useRef<number>(0)   // Date.now() del arranque del tramo "jugando" actual
  const sessionAccumMsRef   = useRef<number>(0)   // tiempo acumulado de tramos "jugando" anteriores del mismo intento
  const countdownTimersRef  = useRef<ReturnType<typeof setTimeout>[]>([])
  const flashTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionWarnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esclavosRef  = useRef<number[]>([])
  const paresRef      = useRef(pares)
  const operatorIdRef = useRef(operatorId)
  const lastSettledPositionsRef = useRef<number[]>(INITIAL_POSITIONS)
  const turnStartRef = useRef<number>(Date.now())
  const prevControlStatusRef = useRef<'jugando' | 'victoria' | 'derrota'>('jugando')
  // ── Resolutor único de estado visual (ver core/ppa/cubeVisualState.ts y
  // ESTADO_VISUAL_CUBOS.md): estas referencias existen solo para que el
  // despacho de comandos sepa qué ya se envió (y no repetirlo) y para que el
  // listener de socket, montado una sola vez más abajo, lea sessionState
  // sin cerrarse sobre un valor obsoleto.
  //
  // Caché sembrada con "color de equipo en reposo" para los 10 cubos: ese es
  // el punto de partida REAL de cada cubo, porque el propio firmware se lo
  // asigna solo desde su IP al conectar al WiFi (Cubo_Esclavo_v3.ino), sin
  // que el frontend mande nada. Así el efecto de despacho no reenvía el
  // color de equipo al cargar la página — decisión del autor (2026-09-18):
  // el color de equipo lo maneja solo el cubo; el frontend solo manda
  // eventos extraordinarios (PPA, bloqueo/victoria/pausa, inválido).
  const lastSentSustainedRef = useRef<Record<number, string>>(
    Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(id => [id, JSON.stringify({ tier: 'equipo_reposo' })])),
  )
  const lastSentSessionRef   = useRef<string | null>(null)
  const sessionStateRef      = useRef<SessionState>('inactivo')
  useEffect(() => { paresRef.current = pares }, [pares])
  useEffect(() => { operatorIdRef.current = operatorId }, [operatorId])
  useEffect(() => { sessionStateRef.current = sessionState }, [sessionState])
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [])
  void tick // fuerza el re-render del medidor de Actuar cada 500ms; su valor no se muestra

  function logCuboEvent(entry: Omit<EventoCubo, 'timestamp' | 'pares' | 'intentoId' | 'intentoNum'>) {
    setCuboEvents(prev => [...prev, {
      timestamp: nowIso(), pares: paresRef.current,
      intentoId: intentoIdRef.current ?? undefined,
      intentoNum: intentoIdRef.current ? intentoNumRef.current : undefined,
      ...entry,
    }])
  }
  function logOperatorEvent(entry: Omit<DecisionOperador, 'timestamp' | 'pares' | 'operadorId' | 'intentoId' | 'intentoNum'>) {
    setOperatorEvents(prev => [...prev, {
      timestamp: nowIso(), pares: paresRef.current, operadorId: operatorIdRef.current || '(sin asignar)',
      intentoId: intentoIdRef.current ?? undefined,
      intentoNum: intentoIdRef.current ? intentoNumRef.current : undefined,
      ...entry,
    }])
  }

  // ── Resolutor único de estado visual (ver core/ppa/cubeVisualState.ts y
  // ESTADO_VISUAL_CUBOS.md) ───────────────────────────────────────────────
  // sendSustained/sendSustainedAll son las ÚNICAS funciones que mandan el
  // color/vibración SOSTENIDO de un cubo por socket. Todo lo demás
  // (handleStateChange, sendAction, pausarJuego, etc.) solo cambia estado de
  // React; el efecto de despacho de más abajo llama a estas dos cuando ese
  // estado cambia. Esto es justo lo que evita que un evento no relacionado
  // pise el estado vigente: ya no hay N sitios decidiendo por su cuenta qué
  // mandarle a un cubo, hay uno solo.
  function teamRgbFor(cubeId: number): [number, number, number] {
    return hexToRgbArray(cubeId <= 5 ? teamAColor : teamBColor)
  }

  // `forzar`: para acciones directas del operador (clic en PPA / Estado
  // inicial) y para un cubo que se acaba de reconectar — en ambos casos el
  // comando tiene que salir sí o sí, aunque la caché diga que ya se mandó
  // (un reintento manual del operador nunca debe quedar en silencio).
  function sendSustained(cubeId: number, v: SustainedCubeVisual, forzar = false) {
    const key = JSON.stringify(v)
    if (!forzar && lastSentSustainedRef.current[cubeId] === key) return
    lastSentSustainedRef.current[cubeId] = key
    socket.emit('comandoCubo', { id: cubeId, ...sustainedVisualToCommand(v, teamRgbFor(cubeId)) })
  }

  // Difunde un estado de nivel SESIÓN (bloqueo/victoria/pausado) a los 10
  // cubos con un solo mensaje ("all"). Invalida la caché por-cubo: en
  // cuanto la sesión vuelva a 'normal', cada cubo debe reafirmarse sí o sí,
  // porque "all" les cambió el estado sin que sendSustained se enterara.
  function sendSustainedAll(v: SustainedCubeVisual) {
    const key = JSON.stringify(v)
    if (lastSentSessionRef.current === key) return
    lastSentSessionRef.current = key
    lastSentSustainedRef.current = {}
    socket.emit('comandoCubo', { id: 'all', ...sustainedVisualToCommand(v) })
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
        // Al conectar NO se le manda el color de equipo: el propio firmware
        // ya se lo asigna solo desde su IP (decisión del autor, 2026-09-18,
        // tras prueba con hardware real — menos condicionales en el momento
        // de conexión, para no arriesgar la baja latencia ni pisar el color
        // que el cubo ya puso bien). Única excepción: si se reconecta en
        // medio de un bloqueo/victoria/pausa, se le reafirma esa señal de
        // sesión (forzado: al reconectar, el cubo volvió a su color de
        // equipo y la caché ya no refleja lo que muestra). sessionStateRef en
        // vez de sessionState porque este listener se monta una sola vez.
        const tier = sessionVisualTier(sessionStateRef.current)
        if (tier !== 'normal') sendSustained(id, resolveSustainedVisual(tier), true)
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

  // Movimientos válidos del cubo actualmente levantado, en vivo — mismo
  // criterio y misma fuente (lastSettledPositionsRef) que ya usa la
  // detección de fallas más abajo, replicando el resaltado que ya existe
  // en las pestañas de Simulación (ControladorSimulado/JuegoSimulado).
  const legalTargetsLive: number[] = (() => {
    if (gameState.emptyPosition === null) return []
    const prevBoard: Board = lastSettledPositionsRef.current
      .map(id => id === 0 ? null : { id, team: id <= 5 ? 'A' as const : 'B' as const })
    return legalMovesFor(prevBoard, gameState.emptyPosition)
  })()
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

  // El tablero volvió a la posición inicial del nivel (5 azules + 5 rojos
  // en orden, para pares=5) — es la señal de "listo para iniciar" y la
  // condición que saca a los cubos del blanco ("reordenen") tras un
  // bloqueo o una victoria.
  const isBoardAtInitial = boardsEqual(currentBoardControl, initialBoardForPares)

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
          // Segundo paso del algoritmo de dos pasos (DECISIONES_PROYECTO.md,
          // "Distinción entre cubo levantado y cubo desconectado"): un cambio
          // de posición que no corresponde a un movimiento legal no se
          // asume automáticamente como falla — primero se revisa la señal
          // independiente de conectividad (esclavosConectados, cada 5s) del
          // cubo implicado. Si ese cubo no aparece conectado, se registra
          // como "no detectado" y NO se cuenta como falla.
          const cuboImplicado = prevSettled[fromIdx]
          const cuboConectado = esclavosRef.current.includes(cuboImplicado)
          if (cuboConectado) {
            playError()
            logCuboEvent({ tipo: 'falla_movimiento', detalle: `Movimiento inválido detectado: cubo #${cuboImplicado} de la posición ${fromIdx + 1} a la ${toIdx + 1}` })
            setFallaCount(nf => (nf + 1 >= FALLAS_PARA_PAUSAR ? 0 : nf + 1))
            // Reacción física casi inmediata: el cubo implicado se pone
            // naranja y vibra por su cuenta (EF=3, un solo mensaje, sin ida
            // y vuelta repetida). El envío real vive en el efecto de pulso
            // de más abajo (keyed on flashCubeId), no aquí — así respeta el
            // mismo criterio de prioridad que todo lo demás (no se dispara
            // si la sesión ya está en bloqueo/victoria/pausada).
            setFlashCubeId(cuboImplicado)
            if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
            flashTimerRef.current = setTimeout(() => setFlashCubeId(null), 1000)
          } else {
            logCuboEvent({ tipo: 'cubo_no_detectado', detalle: `Cubo #${cuboImplicado} no aparece conectado (esclavosConectados) — cambio de posición desde la ${fromIdx + 1} no se cuenta como falla` })
          }
        }
      }
      lastSettledPositionsRef.current = positions
      setCubesData(originalCubes)
      setPath(t => [...t, positions])
      setGameState({ cubesPositions: [...positions], liftedCube: null, emptyPosition: null })
    }
    // Antes: socket.emit('restaurarCubos', 'restaurar') incondicional en
    // cada evento de posición — esa fue la causa del bug de "restaurar"
    // corregido el 2026-09-18 (ver Cubo_Esclavo_v3.ino y
    // PENDIENTES_TESIS.md): apagaba a negro cualquier cubo ya modificado
    // con solo que OTRO cubo cambiara de posición. Se retira del todo: el
    // resolutor único (sendSustained/sendSustainedAll, más abajo) ya sabe
    // en todo momento qué debe mostrar cada cubo y lo manda explícito
    // (color de equipo incluido) — no hace falta un comando aparte de
    // "restaurar" disparado a ciegas. El comando sigue existiendo en el
    // firmware para uso manual/depuración por Monitor Serial.
  }

  function triggerAction(a: CubeAction, cubeId: number) {
    if (actionTimer.current) clearTimeout(actionTimer.current)
    setActiveAction(a)
    actionTimer.current = setTimeout(() => {
      setActiveAction(null)
      // Solo se borra el estado de React — el efecto de despacho (más
      // abajo) ve que cubeActions ya no tiene a este cubo y manda él mismo
      // el color de equipo (o lo que corresponda según la sesión). Antes
      // este timeout mandaba un comando directo sin mirar el resto del
      // estado: si esto expiraba durante un bloqueo/victoria/pausa, apagaba
      // ese cubo a color de equipo por encima de la señal de sesión vigente.
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
    setCubeActions(prev => ({ ...prev, [cubeId]: a }))
    // Paso atrás deliberado (2026-09-18, tras prueba con hardware real): el
    // envío es directo e inmediato aquí mismo, como en el commit anterior a
    // este resolutor — la señal PPA manual es la acción más directa del
    // operador y no puede depender de que un efecto posterior la despache
    // (ese efecto, condicionado al nivel de sesión, fue justo lo que dejó
    // de "servir el PPA" al agregarlo). Se llama a sendSustained
    // directamente en vez de duplicar el payload: mismo comando/misma
    // caché que usa el efecto de despacho de más abajo, así ese efecto no
    // reenvía por su cuenta ni entra en conflicto cuando cubeActions cambie
    // en la línea de arriba.
    sendSustained(cubeId, { tier: 'ppa_manual', accion: a }, true)
    triggerAction(a, cubeId)
    playPpaFeedback(a, AUTO_OFF_MS / 1000)
    logOperatorEvent({ cuboId: cubeId, fase: a, detalle: `Operador envió ${a.toUpperCase()} al cubo #${cubeId}` })
  }

  function apagarSenal() {
    if (selectedCubeId === null) { showNoSel(); return }
    const cubeId = selectedCubeId
    if (actionTimer.current) clearTimeout(actionTimer.current)
    setActiveAction(null)
    setCubeActions(prev => { const next = { ...prev }; delete next[cubeId]; return next })
    // Mismo paso atrás que sendAction: envío directo, no delegado al efecto.
    sendSustained(cubeId, { tier: 'equipo_reposo' }, true)
    logOperatorEvent({ cuboId: cubeId, fase: 'estado_inicial', detalle: `Operador apagó manualmente la señal del cubo #${cubeId} (estado inicial)` })
  }

  function showSessionWarning(msg: string) {
    if (sessionWarnTimer.current) clearTimeout(sessionWarnTimer.current)
    setSessionWarning(msg)
    sessionWarnTimer.current = setTimeout(() => setSessionWarning(null), 3000)
  }

  // Cuenta regresiva sincronizada (3,2,1,¡Inicia!): cada tick solo cambia
  // countdownTick — el efecto de pulso de más abajo (keyed on countdownTick)
  // es quien manda el mensaje de difusión (id:"all", EF=6/7) a los 10
  // cubos; el destello corre entero dentro de cada cubo, sin depender de
  // que el frontend mande varios comandos seguidos.
  function iniciarJuego() {
    if (sessionState !== 'inactivo') return
    if (!isBoardAtInitial) { showSessionWarning('Reordena los cubos (5 azules + 5 rojos) antes de iniciar'); return }

    const nextIntento = intentoCount + 1
    intentoIdRef.current = `intento-${Date.now()}`
    intentoNumRef.current = nextIntento
    sessionAccumMsRef.current = 0
    setFallaCount(0)
    setPath([[...gameState.cubesPositions]])
    setIntentoCount(nextIntento)
    logCuboEvent({ tipo: 'intento_iniciado', detalle: `Intento #${nextIntento} iniciado (${pares} pares)` })
    setSessionState('cuenta_regresiva')

    countdownTimersRef.current.forEach(clearTimeout)
    countdownTimersRef.current = [];
    ([3, 2, 1, 0] as const).forEach((t, i) => {
      countdownTimersRef.current.push(setTimeout(() => {
        setCountdownTick(t)
        playCountdownBeep(t)
        if (t === 0) {
          sessionStartRef.current = Date.now()
          setSessionState('jugando')
          setTimeout(() => setCountdownTick(null), 600)
        }
      }, i * 1000))
    })
  }

  // Sesión pausada = nivel SESIÓN (ver cubeVisualState.ts): el efecto de
  // despacho manda la señal de pausa a los 10 cubos por su cuenta en cuanto
  // ve sessionState==='pausado', y de paso cancela (invalidando la caché
  // por-cubo) cualquier señal PPA manual que estuviera vigente — decisión
  // ya validada: la pausa global gana siempre, y al reanudar no se
  // restaura sola (ver reanudarJuego).
  function pausarJuego() {
    if (sessionState !== 'jugando') return
    sessionAccumMsRef.current += Date.now() - sessionStartRef.current
    logOperatorEvent({ cuboId: 0, fase: 'pausar', detalle: 'Operador pausó la partida (señal Pausar a los 10 cubos)' })
    setSessionState('pausado')
  }

  function reanudarJuego() {
    if (sessionState !== 'pausado') return
    // Cualquier señal PPA manual que hubiera quedado pendiente antes de la
    // pausa se descarta aquí explícitamente (no basta con que la pausa la
    // haya tapado visualmente): al reanudar se parte de cero, nunca se
    // restaura sola — decisión validada con el autor 2026-09-18.
    if (actionTimer.current) clearTimeout(actionTimer.current)
    setActiveAction(null)
    setCubeActions({})
    sessionStartRef.current = Date.now()
    logOperatorEvent({ cuboId: 0, fase: 'estado_inicial', detalle: 'Operador reanudó la partida' })
    setSessionState('jugando')
  }

  // Reinicio manual, disponible en cualquier momento: reutiliza el mismo
  // nivel SESIÓN "bloqueado" que la detección real de bloqueo (mismo
  // efecto de despacho, mismo EF=4) y cierra el intento en curso. La misma
  // detección de "tablero reordenado" ya existente los libera de vuelta a
  // su color de equipo en cuanto el operador los reacomoda. Nota: esto
  // significa que un reinicio manual también reproduce la breve animación
  // de alarma de EF=4 antes de quedar en blanco (antes quedaba en blanco
  // de inmediato, sin animación) — cambio deliberado para no bifurcar el
  // criterio de prioridad en dos variantes de "blanco, pide reordenar".
  function reiniciarJuego() {
    countdownTimersRef.current.forEach(clearTimeout)
    countdownTimersRef.current = []
    logCuboEvent({ tipo: 'reinicio_manual', detalle: `Intento #${intentoCount} reiniciado manualmente por el operador — cubos en blanco, pendiente de reordenar` })
    intentoIdRef.current = null
    sessionAccumMsRef.current = 0
    setFallaCount(0)
    setCountdownTick(null)
    setCubeActions({})
    setSessionState('bloqueado') // reutiliza la espera de reorden ya existente (ver useEffect de isBoardAtInitial)
  }

  // El botón Reiniciar pide confirmación en 2 pasos (mismo botón cambia a
  // "¿Confirmar reinicio?") en vez de un diálogo nativo del navegador, para
  // no romper la identidad visual del resto de la interfaz. Si no se
  // confirma en 4s, vuelve solo al estado normal.
  useEffect(() => {
    if (!confirmReset) return
    const t = setTimeout(() => setConfirmReset(false), 4000)
    return () => clearTimeout(t)
  }, [confirmReset])
  useEffect(() => { setConfirmReset(false) }, [sessionState])

  function exportCuboEventsCsv() { downloadFile(`bitacora-cubos-control-${Date.now()}.csv`, toCsvEventosCubo(cuboEvents), 'text/csv;charset=utf-8') }
  function exportCuboEventsJson() { downloadFile(`bitacora-cubos-control-${Date.now()}.json`, JSON.stringify(cuboEvents, null, 2), 'application/json') }
  function exportOperatorEventsCsv() { downloadFile(`bitacora-operador-control-${Date.now()}.csv`, toCsvDecisionesOperador(operatorEvents), 'text/csv;charset=utf-8') }
  function exportOperatorEventsJson() { downloadFile(`bitacora-operador-control-${Date.now()}.json`, JSON.stringify(operatorEvents, null, 2), 'application/json') }

  // ── Derived display values ──────────────────────────────────────────────────
  const moveCount    = path.length - 1
  const selAction    = selectedCubeId !== null ? cubeActions[selectedCubeId] : undefined
  // El cronómetro se apoya en el mismo re-render de 500ms de `tick` (arriba).
  const sessionElapsedMs = sessionState === 'jugando'
    ? sessionAccumMsRef.current + (Date.now() - sessionStartRef.current)
    : sessionAccumMsRef.current
  const sessionElapsedLabel = `${Math.floor(sessionElapsedMs / 60000)}:${String(Math.floor((sessionElapsedMs % 60000) / 1000)).padStart(2, '0')}`

  // Registra victoria/derrota una sola vez por partida (al pasar de
  // "jugando" a un estado final), no en cada render.
  useEffect(() => {
    if (controlStatus !== 'jugando' && prevControlStatusRef.current === 'jugando') {
      logCuboEvent(
        controlStatus === 'victoria'
          ? { tipo: 'victoria', detalle: `Intento #${intentoCount} — intercambio completo en ${moveCount} movimientos` }
          : { tipo: 'derrota', detalle: `Intento #${intentoCount} — ningún cubo tiene ya un movimiento legal disponible (bloqueo)` }
      )
      // Fin de partida: cierre del intento en curso en la bitácora + detener
      // el cronómetro. La señal física a los 10 cubos (EF=VICTORIA/BLOQUEO,
      // un solo mensaje, toda la secuencia corre en el propio cubo) la
      // manda el efecto de despacho de más abajo en cuanto ve el cambio de
      // sessionState a 'victoria'/'bloqueado' — no aquí directamente.
      if (sessionState === 'jugando' || sessionState === 'pausado') {
        sessionAccumMsRef.current += sessionState === 'jugando' ? Date.now() - sessionStartRef.current : 0
        const elapsedSec = Math.round(sessionAccumMsRef.current / 1000)
        logCuboEvent({
          tipo: 'intento_finalizado',
          detalle: `Intento #${intentoCount} ${controlStatus === 'victoria' ? 'ganado' : 'bloqueado'} en ${elapsedSec}s y ${moveCount} movimientos`,
        })
        setSessionState(controlStatus === 'victoria' ? 'victoria' : 'bloqueado')
      }
    }
    prevControlStatusRef.current = controlStatus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlStatus])

  // Tras un bloqueo/victoria (cubos en blanco, "reordenen"), detecta que
  // el operador ya devolvió el tablero a la posición inicial del nivel y
  // libera los cubos de vuelta a su color de equipo — quedan listos para
  // un nuevo "Iniciar juego". El efecto de despacho hace el envío real en
  // cuanto ve sessionState volver a 'inactivo'; aquí también se limpia
  // cubeActions por si había quedado alguna señal PPA manual de antes del
  // bloqueo/victoria (igual que al reanudar de una pausa).
  useEffect(() => {
    if ((sessionState === 'bloqueado' || sessionState === 'victoria') && isBoardAtInitial) {
      logCuboEvent({ tipo: 'tablero_reordenado', detalle: 'El tablero volvió a la posición inicial — listo para un nuevo intento' })
      intentoIdRef.current = null
      setCubeActions({})
      setSessionState('inactivo')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, isBoardAtInitial])

  // ── Efecto de despacho: nivel SESIÓN (bloqueo/victoria/pausado) ─────────────
  // Gana siempre sobre el nivel cubo — ver ESTADO_VISUAL_CUBOS.md. Un solo
  // mensaje "all" por cambio de tier; al volver a 'normal' se limpia
  // lastSentSessionRef para que una futura repetición del MISMO tier
  // (p. ej. bloqueo -> normal -> bloqueo de nuevo) también se reafirme.
  useEffect(() => {
    const tier = sessionVisualTier(sessionState)
    if (tier === 'normal') { lastSentSessionRef.current = null; return }
    sendSustainedAll(resolveSustainedVisual(tier))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState])

  // ── Efecto de despacho: nivel CUBO (señal PPA manual / color de equipo) ─────
  // Solo corre en juego normal (nivel sesión ya cubierto arriba). Se salta
  // el cubo que esté en pleno pulso de "movimiento inválido" (ver el efecto
  // siguiente) para no pisarlo mientras dura.
  useEffect(() => {
    if (sessionVisualTier(sessionState) !== 'normal') return
    for (const cubo of originalCubes) {
      if (cubo.id === 0 || cubo.id === flashCubeId) continue
      sendSustained(cubo.id, resolveSustainedVisual('normal', cubeActions[cubo.id]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, cubeActions, flashCubeId])

  // ── Efecto de pulso: movimiento inválido (EF=3, ~1s) ────────────────────────
  // Solo se dispara en juego normal (tier 1/2/4 ya ganaron arriba). Al
  // terminar (flashCubeId vuelve a null por su propio flashTimerRef, en
  // handleStateChange) el efecto de nivel CUBO de arriba ya deja de saltarse
  // este cubo y lo reafirma — restaurando la señal PPA manual si su propio
  // temporizador de 5s no había expirado, o el color de equipo si no había
  // ninguna (decisión validada con el autor 2026-09-18).
  useEffect(() => {
    if (flashCubeId === null) return
    if (sessionVisualTier(sessionStateRef.current) !== 'normal') return
    socket.emit('comandoCubo', { id: flashCubeId, efecto: EFECTOS.INVALIDO })
    // El cubo físico, al terminar el pulso, se asienta solo en color de
    // equipo (último paso de EFECTO_3_INVALIDO en el firmware) — no sabe
    // nada de una señal PPA manual que pudiera seguir vigente. Se invalida
    // la caché de este cubo para que, cuando el efecto de nivel CUBO deje
    // de saltárselo (flashCubeId vuelve a null), vea sí o sí una diferencia
    // y reenvíe explícitamente lo que corresponda, aunque sea el mismo
    // valor que tenía antes del pulso.
    delete lastSentSustainedRef.current[flashCubeId]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashCubeId])

  // ── Efecto de pulso: cuenta regresiva (EF=6/7, ~300ms) ──────────────────────
  useEffect(() => {
    if (countdownTick === null) return
    socket.emit('comandoCubo', { id: 'all', efecto: countdownTick === 0 ? EFECTOS.CUENTA_INICIA : EFECTOS.CUENTA_TICK })
  }, [countdownTick])

  // ── Shared styles — v4 "consola neurocientífica" ────────────────────────────
  // Retoma los paneles delimitados de v2 (el usuario los prefirió por
  // ordenados) y les suma identidad propia: trazo EEG, glifos de señal
  // neuronal, electrodos — nada de esto es un ícono de librería genérico.
  // Sin `transition` en ningún estilo (regla dura #1).
  const panel: React.CSSProperties = {
    background: 'var(--color-panel)',
    border: '1px solid var(--color-line)',
    borderRadius: 'var(--radius)',
    padding: '14px 16px',
  }

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
    letterSpacing: '0.1em', color: 'var(--color-paper-faint)', textTransform: 'uppercase',
  }

  // Botones de Iniciar/Pausar/Reanudar/Reiniciar: únicos del sistema con
  // relleno sólido y forma de píldora — el resto de la interfaz usa bordes
  // discretos a propósito, pero estos 3 son la acción principal de toda la
  // sesión (arrancan/paran el cronómetro real), así que se resaltan aparte.
  const sessionBtn = (enabled: boolean, tone: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px',
    borderRadius: '999px', cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? tone : 'var(--color-line)',
    border: `1px solid ${enabled ? tone : 'var(--color-line-strong)'}`,
    color: enabled ? '#fff' : 'var(--color-paper-faint)',
    fontWeight: 700, fontSize: '13px',
  })

  // Cuenta regresiva como un semáforo real: rojo mientras se espera (3, 2),
  // amarillo de aviso justo antes (1), verde al arrancar (0/"¡INICIA!") —
  // los mismos 3 colores de un semáforo de calle, no una paleta nueva.
  const countdownSemaforo = (t: number): { bg: string; text: string } =>
    t === 0 ? { bg: 'var(--color-online)', text: '#ffffff' }
      : t === 1 ? { bg: 'var(--color-caution)', text: '#1a1300' }
        : { bg: 'var(--color-offline)', text: '#ffffff' }

  const signalBtn = (a: PPAPhase): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '14px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
    background: activeAction === a ? ppaRgba(a, 0.10) : 'var(--color-panel)',
    border: `${activeAction === a ? 2 : 1}px solid ${activeAction === a ? PPA_HEX[a] : 'var(--color-line)'}`,
    opacity: selectedCubeId === null ? 0.5 : 1,
  })

  return (
    <div style={{
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg)',
      // Retícula de osciloscopio — puntos de 1px, estática (sin animación,
      // regla dura #1), no un degradado difuso: la textura real de un
      // instrumento de laboratorio, no decoración genérica.
      backgroundImage: 'radial-gradient(circle, var(--color-line) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
      color: 'var(--color-paper)',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
    }}>

      {/* Marca de agua — logos esparcidos al azar (posición y rotación),
          nunca superpuestos entre sí (ver generateWatermarkLogos). Capa
          aparte del backgroundImage porque cada copia necesita su propia
          rotación, algo que un solo backgroundImage repetido no puede
          variar por instancia. */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {watermarkLogos.map((l, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${l.x}px`, top: `${l.y}px`,
            transform: `translate(-50%, -50%) rotate(${l.rotation}deg)`,
            opacity: 0.09,
          }}>
            <Logo size={l.size} />
          </div>
        ))}
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        padding: '16px 20px',
        gap: '12px',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* ── Encabezado: marca (la escalera geométrica azul/rojo) + trazo
             EEG como línea de estado de conexión ── */}
        <header style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Logo con presencia propia de marca, no un ícono más de la
                fila — a la altura del bloque completo del título, no solo
                de la caja de la "E". */}
            <Logo size={46} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Escalera Inteligente</h1>
            <span style={{ ...sectionLabel, fontWeight: 500 }}>Control Mago de Oz</span>
          </div>
          <div style={{ marginTop: '8px' }}>
            <EegTrace color={isBaseConnected ? 'var(--color-online)' : 'var(--color-offline)'} />
          </div>
        </header>

        {/* ── Tablero + Señal PPA (columna principal), con Control de
             partida al mismo ancho arriba de ellos, junto a una barra
             lateral fija que arranca con Configuración (pares + operador,
             que se ajustan antes de jugar, no mientras) y sigue con "en
             vivo" (condición acumulada + sonido/música) — ya no queda
             hueco vacío bajo el tablero. Solo Bitácoras queda en el
             desplegable de más abajo. ── */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>

        {/* ── Control de partida: cronómetro grande centrado arriba, los 3
             botones justo debajo — el patrón de un cronómetro real, no un
             display de tiempo aislado en una esquina. ── */}
        <div style={{ ...panel, flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px 16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={sectionLabel}>
              {sessionState === 'inactivo' ? 'listo para iniciar'
                : sessionState === 'cuenta_regresiva' ? 'cuenta regresiva…'
                : sessionState === 'jugando' ? 'en curso'
                : sessionState === 'pausado' ? 'en pausa'
                : sessionState === 'victoria' ? 'victoria — reordena para seguir'
                : 'bloqueado — reordena para seguir'}
              {intentoCount > 0 ? ` · intento ${intentoCount}` : ''}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '40px', fontWeight: 600, lineHeight: 1.15 }}>
              {sessionElapsedLabel}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={iniciarJuego} disabled={sessionState !== 'inactivo'} style={sessionBtn(sessionState === 'inactivo', 'var(--color-blue)')}>Iniciar intento</button>
            {sessionState === 'pausado' ? (
              <button onClick={reanudarJuego} style={sessionBtn(true, 'var(--color-blue)')}>Reanudar</button>
            ) : (
              <button onClick={pausarJuego} disabled={sessionState !== 'jugando'} style={sessionBtn(sessionState === 'jugando', 'var(--color-blue)')}>Pausar</button>
            )}
            <button
              onClick={() => {
                if (!confirmReset) { setConfirmReset(true); return }
                setConfirmReset(false)
                reiniciarJuego()
              }}
              disabled={sessionState === 'cuenta_regresiva' || sessionState === 'inactivo'}
              style={sessionBtn(
                !(sessionState === 'cuenta_regresiva' || sessionState === 'inactivo'),
                confirmReset ? 'var(--color-offline)' : 'var(--color-paper-dim)',
              )}
            >
              {confirmReset ? '¿Confirmar reinicio?' : 'Reiniciar'}
            </button>
          </div>

          {sessionWarning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-offline)' }}>
              <TriangleAlert size={13} /> {sessionWarning}
            </div>
          )}

          {countdownTick !== null && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: countdownSemaforo(countdownTick).bg, borderRadius: 'var(--radius)', zIndex: 5,
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '52px', fontWeight: 700,
                color: countdownSemaforo(countdownTick).text,
              }}>
                {countdownTick === 0 ? '¡INICIA!' : countdownTick}
              </span>
            </div>
          )}
        </div>

        {(controlStatus === 'victoria' || controlStatus === 'derrota') && (
          <div style={{
            ...panel, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px',
            borderColor: controlStatus === 'victoria' ? 'var(--color-blue)' : 'var(--color-offline)',
          }}>
            <Electrode on={controlStatus === 'victoria'} />
            <span style={{ fontWeight: 700, fontSize: '13px' }}>
              {controlStatus === 'victoria' ? `Victoria — intercambio completo en ${moveCount} movimientos` : 'Derrota — ningún cubo tiene ya un movimiento legal disponible'}
            </span>
          </div>
        )}

        {/* Tablero — siempre en una sola fila (nowrap), incluso con 5
             pares/11 posiciones: ancho completo del panel, no una columna
             estrecha. */}
        <div style={{ ...panel, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: '6px' }}><StepMark />Tablero · {pares} par{pares > 1 ? 'es' : ''} · {visibleCubes.length} posiciones · esclavos {esclavos.length}/10</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '14px' }}>
                {[
                  { label: 'Equipo A', color: teamAColor },
                  { label: 'Equipo B', color: teamBColor },
                  { label: 'Vacío', color: 'transparent', border: '1px solid var(--color-line-strong)' },
                ].map(({ label, color, border }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '8px', height: '8px', background: color, border }} />
                    <span style={{ fontSize: '11px', color: 'var(--color-paper-dim)' }}>{label}</span>
                  </div>
                ))}
              </div>
              {/* Conectado/desconectado del maestro — vive en el propio
                  panel del Tablero (es lo que directamente afecta), no
                  suelto en el encabezado general de la página. */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '3px 10px', borderRadius: '20px',
                background: isBaseConnected ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.14)',
                border: `1px solid ${isBaseConnected ? 'var(--color-online)' : 'var(--color-offline)'}`,
                color: isBaseConnected ? 'var(--color-online)' : 'var(--color-offline)',
                fontSize: '11px', fontWeight: 600,
              }}>
                <Electrode on={isBaseConnected} colorOn="var(--color-online)" colorOff="var(--color-offline)" />
                {isBaseConnected ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', justifyContent: 'center' }}>
            {visibleCubes.map((cube, idx) => {
              // visibleCubes está recortado del tablero completo de 11
              // posiciones (0-10); legalTargetsLive usa índices del
              // tablero completo, así que hay que sumar el mismo offset
              // que ya usa el recorte de arriba (5 - pares).
              const fullBoardIdx = idx + (5 - pares)
              // Mismo resolutor que decide el comando físico (ver
              // ESTADO_VISUAL_CUBOS.md) — así pantalla y cubo real nunca
              // pueden discrepar.
              const visual = cube.id === 0
                ? { hex: emptySpaceColor }
                : resolveCubeDisplay(sessionVisualTier(sessionState), flashCubeId === cube.id, cubeActions[cube.id], cube.color)
              const isEmpty = cube.id === 0
              const connected = !isEmpty && esclavos.includes(cube.id)
              return (
                // Conexión del esclavo alineada bajo su propio cubo, no en
                // una lista aparte — el número ya está en la ficha, así que
                // aquí basta una señal de un solo color: verde conectado,
                // roja sin conexión.
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <Cube
                    id={cube.id}
                    isSelected={selectedCubeId === cube.id && cube.id !== 0}
                    onSelect={(id) => { if (id !== 0) setSelectedCubeId(id) }}
                    isLegalTarget={cube.id === 0 && legalTargetsLive.includes(fullBoardIdx)}
                    visual={visual}
                  />
                  {isEmpty ? (
                    <div style={{ width: '13px', height: '13px' }} />
                  ) : (
                    <div
                      title={`Cubo #${cube.id} — ${connected ? 'conectado' : 'sin conexión'}`}
                      style={{
                        width: '13px', height: '13px', borderRadius: '50%',
                        background: connected ? 'var(--color-online)' : 'var(--color-offline)',
                        boxShadow: `0 0 0 3px ${connected ? 'rgba(66,190,101,0.22)' : 'rgba(250,77,86,0.22)'}`,
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {Object.keys(cubeActions).length > 0 && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
              {Object.entries(cubeActions).map(([id, act]) => (
                <span key={id} style={{ color: PPA_TEXT[act] }}>#{id} {PPA_LABEL[act]}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Señal PPA — cada botón con su glifo de señal neuronal, no un
             ícono de librería en un círculo ── */}
        <div style={{ ...panel, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', marginBottom: '12px',
            background: 'var(--color-bg)', borderRadius: 'var(--radius)',
            border: `1px solid ${noSelWarning ? 'var(--color-offline)' : 'var(--color-line)'}`, fontSize: '12px',
          }}>
            {noSelWarning ? (
              <><TriangleAlert size={13} color="var(--color-offline)" /><span style={{ color: 'var(--color-offline)' }}>Selecciona un cubo del tablero antes de enviar una señal</span></>
            ) : selectedCubeId !== null ? (
              <>
                <Electrode on />
                <span style={{ color: 'var(--color-paper-dim)' }}>Cubo seleccionado:</span>
                <span style={{ color: 'var(--color-paper)', fontWeight: 600 }}>#{selectedCubeId}</span>
                {selAction && (
                  <span style={{ color: 'var(--color-paper-dim)' }}>
                    — acción actual: <span style={{ color: PPA_TEXT[selAction], fontWeight: 600 }}>{PPA_LABEL[selAction]}</span>
                  </span>
                )}
              </>
            ) : (
              <><Electrode on={false} /><span style={{ color: 'var(--color-paper-faint)' }}>Haz clic en un cubo del tablero para seleccionarlo</span></>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
            {(['pausar', 'pensar', 'actuar'] as const).map(a => (
              <button key={a} onClick={() => sendAction(a)} style={signalBtn(a)}>
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
            <button onClick={apagarSenal} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '14px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
              background: 'var(--color-panel)', border: '1px solid var(--color-line)',
              opacity: selectedCubeId === null ? 0.5 : 1,
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
        </div>

        {/* ── Histórico, colapsable — solo bitácoras: son registro de lo ya
             ocurrido, a diferencia de la barra lateral de arriba. Va dentro
             de la columna principal, con el mismo ancho que Señal PPA, en
             vez de a todo el ancho de la página: así no queda un hueco
             vacío debajo cuando la barra lateral es más alta que Tablero +
             Señal PPA. Es un separador de sección, no otro panel más: sin
             caja ni relleno, solo un filo inferior. ── */}
        <button onClick={() => setHistOpen(o => !o)} style={{
          background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-line)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
          flexShrink: 0, textAlign: 'left', width: '100%', padding: '6px 2px',
        }}>
          <StepMark />
          <span style={sectionLabel}>Histórico — bitácoras de eventos y decisiones</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-paper-faint)' }}>{histOpen ? '−' : '+'}</span>
        </button>

        {histOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
            <div style={panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={sectionLabel}>Bitácora de eventos de los cubos · {cuboEvents.length}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={exportCuboEventsCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '4px 8px', color: 'var(--color-paper)', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> CSV</button>
                  <button onClick={exportCuboEventsJson} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '4px 8px', color: 'var(--color-paper)', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> JSON</button>
                </div>
              </div>
              <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                {cuboEvents.length === 0 && <div style={{ color: 'var(--color-paper-faint)' }}>Sin eventos todavía — reportados por el hardware físico.</div>}
                {[...cuboEvents].reverse().map((ev, i) => (
                  <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--color-line)', color: 'var(--color-paper-dim)' }}>
                    <span style={{ color: 'var(--color-paper-faint)' }}>{ev.timestamp}</span> · <span style={{ color: 'var(--color-blue)' }}>{ev.tipo}</span> · {ev.detalle}
                  </div>
                ))}
              </div>
            </div>

            <div style={panel}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={sectionLabel}>Bitácora del operador (decisiones) · {operatorEvents.length}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={exportOperatorEventsCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '4px 8px', color: 'var(--color-paper)', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> CSV</button>
                  <button onClick={exportOperatorEventsJson} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '4px 8px', color: 'var(--color-paper)', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> JSON</button>
                </div>
              </div>
              <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                {operatorEvents.length === 0 && <div style={{ color: 'var(--color-paper-faint)' }}>Sin decisiones todavía — cada envío de Pausar/Pensar/Actuar queda aquí.</div>}
                {[...operatorEvents].reverse().map((ev, i) => (
                  <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--color-line)', color: 'var(--color-paper-dim)' }}>
                    <span style={{ color: 'var(--color-paper-faint)' }}>{ev.timestamp}</span> · <span style={{ color: 'var(--color-blue)' }}>{ev.operadorId}</span> · {ev.detalle}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Barra lateral "en vivo" — fija, no colapsable: condición
            acumulada y señal sonora/música cambian mientras se juega, así
            que quedan siempre a la vista junto al tablero y los botones. */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* ── Configuración: operador + pares — se ajustan antes de
               jugar, así que van arriba de todo en la barra lateral, no
               en la columna del tablero. Operador va primero y resaltado:
               es lo primero que debe resolver quien opera al entrar, antes
               incluso de elegir cuántos pares jugar. ── */}
          <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ ...sectionLabel, color: 'var(--color-blue)', fontSize: '11px' }}>Operador Mago de Oz</div>
              {operatorId ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <Electrode on />
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-paper)' }}>{operatorId}</span>
                  <button onClick={() => setOperatorId('')} style={{
                    marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: '11px', color: 'var(--color-paper-faint)', textDecoration: 'underline', padding: 0,
                  }}>cambiar</button>
                </div>
              ) : (
                <div style={{ marginTop: '8px' }}>
                  <input
                    value={operatorInput}
                    onChange={e => setOperatorInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && operatorInput.trim()) setOperatorId(operatorInput.trim().toUpperCase()) }}
                    placeholder="nombre + Enter"
                    autoFocus
                    title="Escribe tu nombre y confirma con Enter — queda en cada evento de la bitácora. No es un identificador oficial del proyecto (ver DECISIONES_PROYECTO.md)."
                    style={{
                      background: 'rgba(69,137,255,0.08)', border: '1px solid var(--color-blue)',
                      borderRadius: 'var(--radius)', padding: '8px 10px', color: 'var(--color-paper)', fontSize: '14px',
                      width: '100%', boxSizing: 'border-box',
                    }} />
                  <div style={{ fontSize: '10px', color: 'var(--color-blue)', marginTop: '5px' }}>Escribe tu nombre y presiona Enter para empezar</div>
                </div>
              )}
            </div>

            <div>
              <div style={sectionLabel}>Pares</div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setPares(n)} style={{
                    width: '26px', height: '26px', cursor: 'pointer', borderRadius: 'var(--radius)',
                    background: pares === n ? 'var(--color-blue)' : 'var(--color-bg)',
                    color: pares === n ? '#fff' : 'var(--color-paper-dim)',
                    border: `1px solid ${pares === n ? 'var(--color-blue)' : 'var(--color-line-strong)'}`,
                    fontWeight: 700, fontSize: '12px',
                  }}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={panel}>
            <div style={{ ...sectionLabel, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><StepMark />En vivo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pausar} label={'Pausar — fallas reales detectadas'} />
              <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pensar} label={'Pensar — mismo criterio, encadenado tras Pausar'} />
              <PpaChargeMeter value={Math.min(Math.floor((Date.now() - turnStartRef.current) / 1000), actuarThresholdSec)} max={actuarThresholdSec} colorHex={PPA_HEX.actuar} label={`Actuar — latencia sin mover (umbral ${actuarThresholdSec}s, no oficial)`} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <span style={{ fontSize: '10px', color: 'var(--color-paper-dim)' }}>Umbral Actuar:</span>
              <input type="range" min={2} max={30} value={actuarThresholdSec}
                onChange={e => setActuarThresholdSec(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--color-blue)' }} />
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>{actuarThresholdSec}s</span>
            </div>
          </div>

          <div style={{ ...panel, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={sectionLabel}>Señal sonora PPA</div>
              <span style={{ fontSize: '9px', color: activeAction ? 'var(--color-blue)' : 'var(--color-paper-faint)' }}>{activeAction ? 'activo' : 'en espera'}</span>
            </div>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '24px', marginBottom: '12px' }}>
              {SND_H.map((h, i) => (
                <div key={i} style={{ flex: 1, background: 'var(--color-line-strong)', height: `${activeAction ? h * 90 : h * 35}%` }} />
              ))}
            </div>
            <div style={{ ...sectionLabel, marginBottom: '6px' }}>Música de fondo</div>
            <AmbientMusicPanel accentColor="#2A6DF5" />
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default App
