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
  Trophy, Ban, Play, RotateCcw, PauseCircle, PlayCircle, Volume2,
} from 'lucide-react'
import {
  type EventoCubo, type DecisionOperador,
  toCsvEventosCubo, toCsvDecisionesOperador, downloadFile, nowIso,
} from './core/control/bitacoraControl'
import hexToRgbArray from './core/utils/hextToRgb'
import { playPpaFeedback, playError, playCountdownBeep } from './core/utils/ppaTones'
import { PPA_RGB, PPA_HEX, PPA_TEXT, PPA_VIBRATION, PPA_SOUND_LABEL, PPA_LABEL, ppaRgba, AUTO_OFF_MS, FALLAS_PARA_PAUSAR, type PPAPhase, EFECTOS } from './core/ppa/ppaColors'
import { type Board, legalMovesFor, computeWinBoard, boardsEqual, isStuck } from './core/simulation/laEscaleraRules'
import {
  type SessionState, type SustainedCubeVisual,
  sessionVisualTier, resolveSustainedVisual, sustainedVisualToCommand, resolveCubeDisplay,
} from './core/ppa/cubeVisualState'
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
  // Estado puramente de presentación (no de juego): abre/cierra el panel de
  // histórico (bitácoras, condición acumulada, música ambiental) — ver
  // docs/REDISENO_UI.md §6, layout de monitor clínico sin scroll. Abierto
  // por defecto: la compresión de las franjas de arriba deja espacio de
  // sobra incluso en 1366x768 (medido), así que no hace falta ocultarlo.
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

  const intentoIdRef        = useRef<string | null>(null)
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
  // listener de socket, montado una sola vez más abajo, lea sessionState/
  // cubeActions sin cerrarse sobre un valor obsoleto.
  const lastSentSustainedRef = useRef<Record<number, string>>({})
  const lastSentSessionRef   = useRef<string | null>(null)
  const sessionStateRef      = useRef<SessionState>('inactivo')
  const cubeActionsRef       = useRef<Record<number, CubeAction>>({})
  useEffect(() => { paresRef.current = pares }, [pares])
  useEffect(() => { operatorIdRef.current = operatorId }, [operatorId])
  useEffect(() => { sessionStateRef.current = sessionState }, [sessionState])
  useEffect(() => { cubeActionsRef.current = cubeActions }, [cubeActions])
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [])
  void tick // fuerza el re-render del medidor de Actuar cada 500ms; su valor no se muestra

  function logCuboEvent(entry: Omit<EventoCubo, 'timestamp' | 'pares' | 'intentoId'>) {
    setCuboEvents(prev => [...prev, { timestamp: nowIso(), pares: paresRef.current, intentoId: intentoIdRef.current ?? undefined, ...entry }])
  }
  function logOperatorEvent(entry: Omit<DecisionOperador, 'timestamp' | 'pares' | 'operadorId' | 'intentoId'>) {
    setOperatorEvents(prev => [...prev, { timestamp: nowIso(), pares: paresRef.current, operadorId: operatorIdRef.current || '(sin asignar)', intentoId: intentoIdRef.current ?? undefined, ...entry }])
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

  function sendSustained(cubeId: number, v: SustainedCubeVisual) {
    const key = JSON.stringify(v)
    if (lastSentSustainedRef.current[cubeId] === key) return
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
        // Color de reposo del equipo (azul/rojo) al conectar, directo y sin
        // etapa intermedia — ver PENDIENTES_TESIS.md, "Cubos sin color por
        // defecto" (antes se enviaba primero una señal EF=2 de conexión,
        // retirada tras la prueba con hardware real del 2026-09-18). Se
        // resuelve con el mismo criterio de prioridad que todo lo demás
        // (sessionStateRef/cubeActionsRef en vez de sessionState/cubeActions
        // directos porque este listener se monta una sola vez, ver useEffect
        // de más abajo con deps []): si el cubo se reconecta en medio de un
        // bloqueo/victoria/pausa, debe reflejar eso de inmediato, no el
        // color de equipo.
        const tier = sessionVisualTier(sessionStateRef.current)
        sendSustained(id, resolveSustainedVisual(tier, tier === 'normal' ? cubeActionsRef.current[id] : undefined))
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
    // Ya no se arma un payload aparte aquí: setCubeActions es lo único que
    // hace falta — el efecto de despacho ve el cambio y manda, con
    // sustainedVisualToCommand (mismo criterio para todos los caminos), el
    // color/vibración de esta fase PPA. Antes esta función mandaba su propio
    // payload (con campos extra como ledModo/vibracionPatron/sonido que el
    // maestro nunca leyó — ver PENDIENTES_TESIS.md/memoria del proyecto,
    // "brecha de sonido") en paralelo a lo que el resolutor manda ahora; se
    // retira para que solo exista una fuente de verdad del comando físico.
    setCubeActions(prev => ({ ...prev, [cubeId]: a }))
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

    intentoIdRef.current = `intento-${Date.now()}`
    sessionAccumMsRef.current = 0
    setFallaCount(0)
    setPath([[...gameState.cubesPositions]])
    logCuboEvent({ tipo: 'intento_iniciado', detalle: `Nuevo intento iniciado (${pares} pares)` })
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
    logCuboEvent({ tipo: 'reinicio_manual', detalle: 'Operador reinició manualmente el intento — cubos en blanco, pendiente de reordenar' })
    intentoIdRef.current = null
    sessionAccumMsRef.current = 0
    setFallaCount(0)
    setCountdownTick(null)
    setCubeActions({})
    setSessionState('bloqueado') // reutiliza la espera de reorden ya existente (ver useEffect de isBoardAtInitial)
  }

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
          ? { tipo: 'victoria', detalle: `Intercambio completo en ${moveCount} movimientos` }
          : { tipo: 'derrota', detalle: 'Ningún cubo tiene ya un movimiento legal disponible (bloqueo)' }
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
          detalle: `Intento ${controlStatus === 'victoria' ? 'ganado' : 'bloqueado'} en ${elapsedSec}s y ${moveCount} movimientos`,
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

  // ── Shared styles — monitor clínico (docs/REDISENO_UI.md §5) ───────────────
  // Franjas horizontales con hairline, no tarjetas — ver §5.5. Sin
  // `transition` en ningún estilo de este archivo: regla dura #1 del
  // rediseño (cero animación decorativa, cero transición >150ms).
  const band: React.CSSProperties = {
    background: 'var(--color-graphite-800)',
    borderBottom: '1px solid var(--color-graphite-700)',
    padding: '10px 20px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px',
    flexShrink: 0,
  }

  const label: React.CSSProperties = { fontSize: '10px', color: 'var(--color-paper-500)', letterSpacing: '0.08em' }

  const ghostBtn = (enabled: boolean, tone: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
    borderRadius: 'var(--radius-sm)', cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? `${tone}1e` : 'var(--color-graphite-900)',
    border: `1px solid ${enabled ? tone : 'var(--color-graphite-600)'}`,
    color: enabled ? tone : 'var(--color-paper-500)',
    fontWeight: 700, fontSize: '13px',
  })

  const btnAction = (a: PPAPhase): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
    padding: '10px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
    background: activeAction === a ? ppaRgba(a, 0.14) : 'var(--color-graphite-800)',
    border: `${activeAction === a ? 2 : 1}px solid ${activeAction === a ? PPA_HEX[a] : 'var(--color-graphite-600)'}`,
    color: PPA_TEXT[a],
    opacity: selectedCubeId === null ? 0.5 : 1,
    flex: 1,
  })

  const iconCircle = (a: PPAPhase): React.CSSProperties => ({
    width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: ppaRgba(a, 0.16),
  })

  const Dot = ({ color }: { color: string }) => (
    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
  )

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-graphite-900)',
      fontFamily: 'var(--font-sans)',
      color: 'var(--color-paper-100)',
    }}>
      <div style={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '1400px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>

        {/* ── Franja A: identidad + conexión ── */}
        <header style={band}>
          <Box size={16} color="var(--color-paper-300)" />
          <span style={{ fontWeight: 700, fontSize: '14px' }}>Escalera Inteligente</span>
          <span style={{ fontSize: '11px', color: 'var(--color-paper-500)' }}>Control Mago de Oz · el operador confirma cada señal</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isBaseConnected ? PPA_TEXT.actuar : 'var(--color-alert)' }}>
            {isBaseConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isBaseConnected ? 'Conectado' : 'Desconectado'}
          </div>
        </header>

        {/* ── Franja B: sesión — pares, operador, control de partida y cronómetro, todo en una sola banda ── */}
        <div style={{ ...band, position: 'relative' }}>
          <div>
            <div style={label}>PARES</div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setPares(n)} style={{
                  width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  background: pares === n ? 'var(--color-signal-neutral)' : 'var(--color-graphite-900)',
                  border: `1px solid ${pares === n ? 'var(--color-signal-neutral)' : 'var(--color-graphite-600)'}`,
                  color: pares === n ? 'var(--color-graphite-900)' : 'var(--color-paper-300)', fontWeight: 700, fontSize: '12px',
                }}>{n}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={label}>OPERADOR</div>
            <div style={{ marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                value={operatorInput}
                onChange={e => setOperatorInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && operatorInput.trim()) setOperatorId(operatorInput.trim()) }}
                placeholder="nombre + Enter"
                title="Escribe tu nombre y confirma con Enter — queda en cada evento de la bitácora. No es un identificador oficial del proyecto (ver DECISIONES_PROYECTO.md)."
                style={{
                  background: 'var(--color-graphite-900)',
                  border: `1px solid ${operatorId && operatorInput.trim() === operatorId ? 'var(--color-signal-neutral)' : 'var(--color-graphite-600)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '5px 8px', color: 'var(--color-paper-100)', fontSize: '12px', width: '150px',
                }} />
              {operatorId
                ? <span style={{ fontSize: '11px', color: 'var(--color-signal-neutral)', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> {operatorId}</span>
                : <span style={{ fontSize: '11px', color: 'var(--color-alert)' }}>sin confirmar</span>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={iniciarJuego} disabled={sessionState !== 'inactivo'} style={ghostBtn(sessionState === 'inactivo', PPA_TEXT.actuar)}>
              <Play size={14} /> Iniciar
            </button>
            {sessionState === 'pausado' ? (
              <button onClick={reanudarJuego} style={ghostBtn(true, PPA_TEXT.pausar)}><PlayCircle size={14} /> Reanudar</button>
            ) : (
              <button onClick={pausarJuego} disabled={sessionState !== 'jugando'} style={ghostBtn(sessionState === 'jugando', PPA_TEXT.pausar)}><PauseCircle size={14} /> Pausar</button>
            )}
            <button onClick={reiniciarJuego} disabled={sessionState === 'cuenta_regresiva' || sessionState === 'inactivo'} style={ghostBtn(!(sessionState === 'cuenta_regresiva' || sessionState === 'inactivo'), 'var(--color-paper-300)')}>
              <RotateCcw size={14} /> Reiniciar
            </button>
          </div>

          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={label}>
              {sessionState === 'inactivo' ? 'listo para iniciar'
                : sessionState === 'cuenta_regresiva' ? 'cuenta regresiva…'
                : sessionState === 'jugando' ? 'en curso'
                : sessionState === 'pausado' ? 'en pausa'
                : sessionState === 'victoria' ? 'victoria — reordena para seguir'
                : 'bloqueado — reordena para seguir'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '26px', fontWeight: 700, lineHeight: 1.1 }}>
              {sessionElapsedLabel}
            </div>
          </div>

          {sessionWarning && (
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-alert)' }}>
              <TriangleAlert size={13} /> {sessionWarning}
            </div>
          )}

          {countdownTick !== null && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-graphite-900)', zIndex: 5,
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '48px', fontWeight: 700,
                color: countdownTick === 0 ? PPA_TEXT.actuar : 'var(--color-signal-neutral)',
              }}>
                {countdownTick === 0 ? '¡INICIA!' : countdownTick}
              </span>
            </div>
          )}
        </div>

        {(controlStatus === 'victoria' || controlStatus === 'derrota') && (
          <div style={{
            ...band, flexShrink: 0,
            background: controlStatus === 'victoria' ? 'rgba(0,255,136,0.12)' : 'rgba(212,105,74,0.16)',
            borderBottom: `1px solid ${controlStatus === 'victoria' ? PPA_TEXT.actuar : 'var(--color-alert)'}`,
          }}>
            {controlStatus === 'victoria' ? <Trophy size={16} /> : <Ban size={16} />}
            <span style={{ fontWeight: 700, fontSize: '13px' }}>
              {controlStatus === 'victoria' ? `¡Victoria! Intercambio completo en ${moveCount} movimientos.` : 'Derrota — ningún cubo tiene ya un movimiento legal disponible.'}
            </span>
          </div>
        )}

        {/* ── Tablero (col A) + botones PPA (col B) — alto natural, no estirado:
             el espacio que la compresión de las franjas de arriba recupera se
             destina a mostrar el histórico abajo, no a agrandar estos botones
             artificialmente (ver docs/REDISENO_UI.md §6). ── */}
        <div style={{ display: 'flex', gap: '16px', padding: '14px 20px', flexShrink: 0 }}>

          {/* Col A: tablero + telemetría compacta */}
          <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ ...label, marginBottom: '8px' }}>TABLERO · {pares} PAR(ES)</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
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
                  return (
                    <Cube
                      key={idx}
                      id={cube.id}
                      isSelected={selectedCubeId === cube.id && cube.id !== 0}
                      onSelect={(id) => { if (id !== 0) setSelectedCubeId(id) }}
                      isLegalTarget={cube.id === 0 && legalTargetsLive.includes(fullBoardIdx)}
                      visual={visual}
                    />
                  )
                })}
              </div>
              {Object.keys(cubeActions).length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {Object.entries(cubeActions).map(([id, act]) => {
                    const ActionIcon = act === 'pausar' ? Pause : act === 'pensar' ? Lightbulb : Zap
                    return (
                      <span key={id} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        fontSize: '11px', padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                        background: ppaRgba(act, 0.16), color: PPA_TEXT[act],
                        border: `1px solid ${ppaRgba(act, 0.4)}`,
                      }}><ActionIcon size={10} /> #{id}</span>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--color-graphite-700)', paddingTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: 'var(--color-paper-300)' }}>
              <span><Activity size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />{gameState.liftedCube !== null ? 'Procesando' : 'Listo'}</span>
              <span><Hand size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />Levantado {gameState.liftedCube ?? '—'}</span>
              <span><Grid2X2 size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />Vacía {gameState.emptyPosition != null ? gameState.emptyPosition + 1 : '—'}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}><Shuffle size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />Mov. {moveCount}</span>
            </div>

            <div style={{ borderTop: '1px solid var(--color-graphite-700)', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={label}>CUBOS ESCLAVOS</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: esclavos.length >= 10 ? PPA_TEXT.actuar : 'var(--color-alert)' }}>{esclavos.length}/10</span>
              </div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(id => {
                  const conectado = esclavos.includes(id)
                  return <div key={id} title={`Cubo #${id} — ${conectado ? 'conectado' : 'sin conexión'}`} style={{ width: '7px', height: '7px', borderRadius: '50%', background: conectado ? PPA_TEXT.actuar : 'var(--color-alert)' }} />
                })}
              </div>
            </div>
          </div>

          {/* Col B: selección + botones PPA */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
              background: 'var(--color-graphite-800)', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${noSelWarning ? 'var(--color-alert)' : 'var(--color-graphite-700)'}`,
              fontSize: '12px',
            }}>
              {noSelWarning ? (
                <><TriangleAlert size={13} color="var(--color-alert)" /><span style={{ color: 'var(--color-alert)' }}>Selecciona un cubo del tablero antes de enviar una señal</span></>
              ) : selectedCubeId !== null ? (
                <>
                  <Dot color="var(--color-signal-neutral)" />
                  <span style={{ color: 'var(--color-paper-300)' }}>Cubo seleccionado:</span>
                  <span style={{ color: 'var(--color-paper-100)', fontWeight: 600 }}>#{selectedCubeId}</span>
                  {selAction && (
                    <span style={{ color: 'var(--color-paper-300)' }}>
                      — acción actual: <span style={{ color: PPA_TEXT[selAction], fontWeight: 600 }}>{PPA_LABEL[selAction]}</span>
                    </span>
                  )}
                </>
              ) : (
                <><Dot color="var(--color-paper-500)" /><span style={{ color: 'var(--color-paper-500)' }}>Haz clic en un cubo del tablero para seleccionarlo</span></>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gridAutoRows: '128px', gap: '10px' }}>
              {(['pausar', 'pensar', 'actuar'] as const).map(a => {
                const Icon = a === 'pausar' ? Pause : a === 'pensar' ? Lightbulb : Zap
                return (
                  <button key={a} onClick={() => sendAction(a)} style={btnAction(a)}>
                    <div style={iconCircle(a)}><Icon size={20} color={PPA_TEXT[a]} /></div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.08em' }}>{PPA_LABEL[a]}</div>
                      <div style={{ fontSize: '10px', color: 'var(--color-paper-500)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        {PPA_RGB[a].join(',')} · {Math.round(PPA_VIBRATION[a] * 100)}% · {PPA_SOUND_LABEL[a]}
                      </div>
                    </div>
                  </button>
                )
              })}
              <button onClick={apagarSenal} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '10px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                background: 'var(--color-graphite-800)', border: '1px solid var(--color-graphite-600)',
                color: 'var(--color-paper-300)', opacity: selectedCubeId === null ? 0.5 : 1,
              }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-graphite-700)' }}>
                  <Power size={20} color="var(--color-paper-300)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.08em' }}>ESTADO INICIAL</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-paper-500)', marginTop: '2px' }}>Apaga color y vibración · auto {AUTO_OFF_MS / 1000}s</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── Franja de histórico, colapsable — bitácoras, condición acumulada, música ── */}
        <button onClick={() => setHistOpen(o => !o)} style={{ ...band, cursor: 'pointer', justifyContent: 'flex-start', border: 'none', borderTop: '1px solid var(--color-graphite-700)', width: '100%', textAlign: 'left' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-paper-300)' }}>{histOpen ? '▾' : '▸'} HISTÓRICO — bitácoras, condición acumulada, música ambiental</span>
        </button>

        {histOpen && (
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Condición acumulada por fase */}
            <div>
              <div style={{ ...label, marginBottom: '10px' }}>CONDICIÓN ACUMULADA POR FASE — informativo, el operador decide si envía la señal</div>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pausar} label={'Pausar — fallas reales detectadas'} />
                <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pensar} label={'Pensar — mismo criterio, encadenado tras Pausar'} />
                <PpaChargeMeter value={Math.min(Math.floor((Date.now() - turnStartRef.current) / 1000), actuarThresholdSec)} max={actuarThresholdSec} colorHex={PPA_HEX.actuar} label={`Actuar — latencia sin mover (umbral ${actuarThresholdSec}s, no oficial)`} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-paper-500)' }}>Umbral Actuar (segundos, no oficial):</span>
                <input type="range" min={2} max={30} value={actuarThresholdSec}
                  onChange={e => setActuarThresholdSec(Number(e.target.value))}
                  style={{ flex: 1, maxWidth: '160px', accentColor: 'var(--color-signal-neutral)' }} />
                <span style={{ fontSize: '11px' }}>{actuarThresholdSec}s</span>
              </div>
            </div>

            {/* Sonido / música de fondo */}
            <div style={{ borderTop: '1px solid var(--color-graphite-700)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Volume2 size={15} color="var(--color-paper-300)" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>Señal sonora PPA</div>
                    <div style={{ color: 'var(--color-paper-500)', fontSize: '10px' }}>Tono al enviar Pausar/Pensar/Actuar</div>
                  </div>
                </div>
                <span style={{ fontSize: '9px', color: activeAction ? PPA_TEXT.actuar : 'var(--color-paper-500)', background: 'var(--color-graphite-800)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', letterSpacing: '0.08em', alignSelf: 'flex-start' }}>
                  {activeAction ? 'activo' : 'en espera'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '32px', marginBottom: '12px' }}>
                {SND_H.map((h, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: '2px 2px 0 0', background: 'var(--color-graphite-600)', height: `${activeAction ? h * 90 : h * 35}%` }} />
                ))}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-paper-500)', marginBottom: '6px' }}>MÚSICA DE FONDO (OPCIONAL)</div>
              <AmbientMusicPanel accentColor="#CFE8EC" />
            </div>

            {/* Bitácoras */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '14px', borderTop: '1px solid var(--color-graphite-700)', paddingTop: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={12} /> BITÁCORA DE EVENTOS DE LOS CUBOS · {cuboEvents.length}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={exportCuboEventsCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-graphite-800)', border: '1px solid var(--color-graphite-600)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', color: 'var(--color-paper-100)', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> CSV</button>
                    <button onClick={exportCuboEventsJson} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-graphite-800)', border: '1px solid var(--color-graphite-600)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', color: 'var(--color-paper-100)', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> JSON</button>
                  </div>
                </div>
                <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                  {cuboEvents.length === 0 && <div style={{ color: 'var(--color-paper-500)' }}>Sin eventos todavía — reportados por el hardware físico.</div>}
                  {[...cuboEvents].reverse().map((ev, i) => (
                    <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--color-graphite-700)', color: 'var(--color-paper-300)' }}>
                      <span style={{ color: 'var(--color-paper-500)' }}>{ev.timestamp}</span> · <span style={{ color: 'var(--color-signal-neutral)' }}>{ev.tipo}</span> · {ev.detalle}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={12} /> BITÁCORA DEL OPERADOR (DECISIONES) · {operatorEvents.length}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={exportOperatorEventsCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-graphite-800)', border: '1px solid var(--color-graphite-600)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', color: 'var(--color-paper-100)', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> CSV</button>
                    <button onClick={exportOperatorEventsJson} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-graphite-800)', border: '1px solid var(--color-graphite-600)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', color: 'var(--color-paper-100)', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> JSON</button>
                  </div>
                </div>
                <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                  {operatorEvents.length === 0 && <div style={{ color: 'var(--color-paper-500)' }}>Sin decisiones todavía — cada envío de Pausar/Pensar/Actuar queda aquí.</div>}
                  {[...operatorEvents].reverse().map((ev, i) => (
                    <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--color-graphite-700)', color: 'var(--color-paper-300)' }}>
                      <span style={{ color: 'var(--color-paper-500)' }}>{ev.timestamp}</span> · <span style={{ color: 'var(--color-signal-neutral)' }}>{ev.operadorId}</span> · {ev.detalle}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
