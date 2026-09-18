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
import { PPA_RGB, PPA_HEX, PPA_TEXT, PPA_VIBRATION, PPA_SOUND_LABEL, PPA_LABEL, AUTO_OFF_MS, FALLAS_PARA_PAUSAR, type PPAPhase, EFECTOS } from './core/ppa/ppaColors'
import { type Board, legalMovesFor, computeWinBoard, boardsEqual, isStuck } from './core/simulation/laEscaleraRules'
import {
  type SessionState, type SustainedCubeVisual,
  sessionVisualTier, resolveSustainedVisual, sustainedVisualToCommand, resolveCubeDisplay,
} from './core/ppa/cubeVisualState'
import PpaChargeMeter from './components/simulation/PpaChargeMeter'

const SND_H = [0.55, 0.75, 0.95, 0.60, 1.00, 0.80, 0.70, 0.90]
const INITIAL_POSITIONS = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10]

// Transformación puramente de presentación (no toca PPA_LABEL, que sigue
// siendo 'PAUSAR'/'PENSAR'/'ACTUAR' en mayúsculas para el resto del
// sistema): en un display serif grande, versalitas gritan menos que
// mayúsculas completas.
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

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

  // ── Shared styles — v3 "cuaderno de campo" (docs/REDISENO_UI.md) ───────────
  // Sin tarjetas, sin ícono-en-círculo, sin grilla simétrica: numeración de
  // sección + reglas de 1px + tipografía con carácter. Sin `transition` en
  // ningún estilo (regla dura #1).
  const kicker: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.14em',
    color: 'var(--color-paper-faint)', textTransform: 'uppercase', lineHeight: 1.5,
  }

  const rule: React.CSSProperties = { border: 'none', borderTop: '1px solid var(--color-rule)', margin: 0 }

  const textBtn = (enabled: boolean, tone?: string): React.CSSProperties => ({
    background: 'none', border: 'none', padding: '0 0 3px', cursor: enabled ? 'pointer' : 'default',
    fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '14px',
    color: enabled ? (tone ?? 'var(--color-paper)') : 'var(--color-paper-faint)',
    borderBottom: `1px solid ${enabled ? (tone ?? 'var(--color-paper)') : 'transparent'}`,
  })

  const signalWord = (a: PPAPhase): React.CSSProperties => ({
    display: 'block', textAlign: 'left', cursor: 'pointer', background: 'none',
    border: 'none', borderBottom: `${activeAction === a ? 3 : 1}px solid ${activeAction === a ? PPA_HEX[a] : 'var(--color-rule)'}`,
    padding: '0 0 12px', opacity: selectedCubeId === null ? 0.45 : 1,
  })

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-ink)',
      color: 'var(--color-paper)',
      fontFamily: 'var(--font-sans)',
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

        {/* ── Marca: dos cuadrados azul/rojo — el mecanismo real del juego
             (dos colores que se intercambian), no un ícono de librería ── */}
        <header style={{ display: 'flex', alignItems: 'baseline', gap: '14px', padding: '22px 28px 14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '3px', alignSelf: 'center' }}>
            <span style={{ width: '11px', height: '11px', background: 'var(--color-blue)', display: 'inline-block' }} />
            <span style={{ width: '11px', height: '11px', background: 'var(--color-red)', display: 'inline-block' }} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '23px', margin: 0, letterSpacing: '-0.01em' }}>
            Escalera Inteligente
          </h1>
          <span style={kicker}>Control Mago de Oz</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '7px', ...kicker }}>
            <span style={{ width: '6px', height: '6px', background: isBaseConnected ? 'var(--color-blue)' : 'var(--color-alert)', display: 'inline-block' }} />
            {isBaseConnected ? 'conectado' : 'desconectado'}
          </div>
        </header>
        <hr style={rule} />

        {/* ── 01 · Sesión: pares, operador, control de partida, cronómetro ── */}
        <section style={{ display: 'flex', gap: '28px', padding: '18px 28px', alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ ...kicker, flexShrink: 0 }}>01<br />Sesión</div>

          <div style={{ flexShrink: 0 }}>
            <div style={kicker}>pares</div>
            <div style={{ display: 'flex', gap: '2px', marginTop: '5px' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setPares(n)} style={{
                  width: '22px', height: '22px', cursor: 'pointer',
                  background: pares === n ? 'var(--color-paper)' : 'transparent',
                  color: pares === n ? 'var(--color-ink)' : 'var(--color-paper-dim)',
                  border: '1px solid var(--color-rule)', fontFamily: 'var(--font-mono)', fontSize: '12px',
                }}>{n}</button>
              ))}
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            <div style={kicker}>operador</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '5px' }}>
              <input
                value={operatorInput}
                onChange={e => setOperatorInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && operatorInput.trim()) setOperatorId(operatorInput.trim()) }}
                placeholder="nombre + enter"
                title="Escribe tu nombre y confirma con Enter — queda en cada evento de la bitácora. No es un identificador oficial del proyecto (ver DECISIONES_PROYECTO.md)."
                style={{
                  background: 'none', border: 'none', borderBottom: '1px solid var(--color-rule)',
                  fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-paper)', padding: '2px 0', width: '128px',
                }} />
              <span style={{ fontSize: '11px', color: operatorId ? 'var(--color-blue)' : 'var(--color-paper-faint)' }}>
                {operatorId || 'sin confirmar'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '18px', flexShrink: 0 }}>
            <button onClick={iniciarJuego} disabled={sessionState !== 'inactivo'} style={textBtn(sessionState === 'inactivo', 'var(--color-blue)')}>Iniciar</button>
            {sessionState === 'pausado' ? (
              <button onClick={reanudarJuego} style={textBtn(true, 'var(--color-blue)')}>Reanudar</button>
            ) : (
              <button onClick={pausarJuego} disabled={sessionState !== 'jugando'} style={textBtn(sessionState === 'jugando', 'var(--color-blue)')}>Pausar</button>
            )}
            <button onClick={reiniciarJuego} disabled={sessionState === 'cuenta_regresiva' || sessionState === 'inactivo'} style={textBtn(!(sessionState === 'cuenta_regresiva' || sessionState === 'inactivo'))}>Reiniciar</button>
          </div>

          <div style={{ marginLeft: 'auto', textAlign: 'right', position: 'relative' }}>
            <div style={kicker}>
              {sessionState === 'inactivo' ? 'listo para iniciar'
                : sessionState === 'cuenta_regresiva' ? 'cuenta regresiva…'
                : sessionState === 'jugando' ? 'en curso'
                : sessionState === 'pausado' ? 'en pausa'
                : sessionState === 'victoria' ? 'victoria — reordena para seguir'
                : 'bloqueado — reordena para seguir'}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '42px', lineHeight: 1 }}>
              {sessionElapsedLabel}
            </div>

            {countdownTick !== null && (
              <div style={{
                position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--color-ink-raised)', zIndex: 5,
              }}>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: '30vh', fontWeight: 600, lineHeight: 1,
                  color: countdownTick === 0 ? 'var(--color-blue)' : 'var(--color-paper)',
                }}>
                  {countdownTick === 0 ? '¡Inicia!' : countdownTick}
                </span>
              </div>
            )}
          </div>

          {sessionWarning && (
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-alert)' }}>
              <TriangleAlert size={13} /> {sessionWarning}
            </div>
          )}
        </section>
        <hr style={rule} />

        {(controlStatus === 'victoria' || controlStatus === 'derrota') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 28px', flexShrink: 0 }}>
              <span style={{ width: '9px', height: '9px', background: controlStatus === 'victoria' ? 'var(--color-blue)' : 'var(--color-alert)', display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '17px' }}>
                {controlStatus === 'victoria' ? `Victoria — intercambio completo en ${moveCount} movimientos` : 'Derrota — ningún cubo tiene ya un movimiento legal'}
              </span>
            </div>
            <hr style={rule} />
          </>
        )}

        {/* ── 02 · Tablero — SIEMPRE en una sola fila, incluso con 5 pares (11
             posiciones): ancho completo, nowrap, sin la columna al 42% que
             lo partía en dos filas en la versión anterior. ── */}
        <section style={{ padding: '20px 28px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            <div style={{ ...kicker, flexShrink: 0, paddingTop: '4px' }}>02<br />Tablero</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto' }}>
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

              <div style={{ marginTop: '12px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', ...kicker }}>
                <span>{gameState.liftedCube !== null ? 'procesando' : 'listo'}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>mov. {moveCount}</span>
                <span>vacía {gameState.emptyPosition != null ? gameState.emptyPosition + 1 : '—'}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  esclavos {esclavos.length}/10
                  <span style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(id => (
                      <span key={id} title={`Cubo #${id}`} style={{ width: '5px', height: '5px', background: esclavos.includes(id) ? 'var(--color-blue)' : 'var(--color-alert)', display: 'inline-block' }} />
                    ))}
                  </span>
                </span>
              </div>

              {Object.keys(cubeActions).length > 0 && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', ...kicker }}>
                  {Object.entries(cubeActions).map(([id, act]) => (
                    <span key={id} style={{ color: PPA_TEXT[act] }}>#{id} {act}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
        <hr style={rule} />

        {/* ── 03 · Señal — Pausar/Pensar/Actuar como palabra tipográfica, no
             caja con ícono; Estado inicial queda deliberadamente más chico,
             no igualado en peso a las 3 señales reales. ── */}
        <section style={{ padding: '20px 28px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            <div style={{ ...kicker, flexShrink: 0, paddingTop: '4px' }}>03<br />Señal</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: noSelWarning ? 'var(--color-alert)' : 'var(--color-paper-dim)', marginBottom: '18px' }}>
                {noSelWarning ? 'selecciona un cubo antes de enviar una señal'
                  : selectedCubeId !== null ? `cubo #${selectedCubeId} seleccionado${selAction ? ' · ' + PPA_LABEL[selAction].toLowerCase() : ''}`
                  : 'selecciona un cubo del tablero'}
              </div>
              <div style={{ display: 'flex', gap: '44px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {(['pausar', 'pensar', 'actuar'] as const).map(a => (
                  <button key={a} onClick={() => sendAction(a)} style={signalWord(a)}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '42px', color: PPA_TEXT[a], letterSpacing: '-0.01em' }}>
                      {titleCase(PPA_LABEL[a])}
                    </span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-paper-faint)', marginTop: '4px' }}>
                      {PPA_RGB[a].join(',')} · {Math.round(PPA_VIBRATION[a] * 100)}% · {PPA_SOUND_LABEL[a]}
                    </span>
                  </button>
                ))}
                <button onClick={apagarSenal} style={{ ...textBtn(selectedCubeId !== null), marginLeft: 'auto', alignSelf: 'flex-end' }}>
                  estado inicial
                </button>
              </div>
              <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--color-paper-faint)' }}>
                Cada señal se apaga sola a los {AUTO_OFF_MS / 1000}s; estado inicial la apaga antes, de inmediato.
              </div>
            </div>
          </div>
        </section>
        <hr style={rule} />

        {/* ── 04 · Histórico, colapsable — bitácoras, condición acumulada, música ── */}
        <button onClick={() => setHistOpen(o => !o)} style={{
          display: 'flex', alignItems: 'center', gap: '24px', padding: '14px 28px', flexShrink: 0,
          background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
        }}>
          <span style={{ ...kicker, flexShrink: 0 }}>{histOpen ? '–' : '+'} 04</span>
          <span style={kicker}>Histórico — bitácoras, condición acumulada, música ambiental</span>
        </button>

        {histOpen && (
          <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

            {/* Condición acumulada por fase */}
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ ...kicker, flexShrink: 0, width: '0px', overflow: 'visible', whiteSpace: 'nowrap' }} />
              <div style={{ flex: 1 }}>
                <div style={{ ...kicker, marginBottom: '12px' }}>condición acumulada por fase — informativo</div>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pausar} label={'Pausar — fallas reales detectadas'} />
                  <PpaChargeMeter value={fallaCount} max={FALLAS_PARA_PAUSAR} colorHex={PPA_HEX.pensar} label={'Pensar — mismo criterio, encadenado tras Pausar'} />
                  <PpaChargeMeter value={Math.min(Math.floor((Date.now() - turnStartRef.current) / 1000), actuarThresholdSec)} max={actuarThresholdSec} colorHex={PPA_HEX.actuar} label={`Actuar — latencia sin mover (umbral ${actuarThresholdSec}s, no oficial)`} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--color-paper-dim)' }}>umbral Actuar (s, no oficial)</span>
                  <input type="range" min={2} max={30} value={actuarThresholdSec}
                    onChange={e => setActuarThresholdSec(Number(e.target.value))}
                    style={{ flex: 1, maxWidth: '160px', accentColor: 'var(--color-blue)' }} />
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{actuarThresholdSec}s</span>
                </div>
              </div>
            </div>
            <hr style={rule} />

            {/* Sonido / música de fondo */}
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ ...kicker, flexShrink: 0, width: '0px', overflow: 'visible', whiteSpace: 'nowrap' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={kicker}>señal sonora ppa — tono al enviar pausar/pensar/actuar</div>
                  <span style={{ fontSize: '10px', color: activeAction ? 'var(--color-blue)' : 'var(--color-paper-faint)' }}>{activeAction ? 'activo' : 'en espera'}</span>
                </div>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '24px', marginBottom: '14px' }}>
                  {SND_H.map((h, i) => (
                    <div key={i} style={{ flex: 1, background: 'var(--color-rule)', height: `${activeAction ? h * 90 : h * 35}%` }} />
                  ))}
                </div>
                <div style={{ ...kicker, marginBottom: '6px' }}>música de fondo (opcional)</div>
                <AmbientMusicPanel accentColor="#2A3EFF" />
              </div>
            </div>
            <hr style={rule} />

            {/* Bitácoras */}
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              <div style={{ ...kicker, flexShrink: 0, width: '0px', overflow: 'visible', whiteSpace: 'nowrap' }} />
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '24px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={kicker}>bitácora de eventos de los cubos · {cuboEvents.length}</span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={exportCuboEventsCsv} style={textBtn(true)}><Download size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />csv</button>
                      <button onClick={exportCuboEventsJson} style={textBtn(true)}><Download size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />json</button>
                    </div>
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    {cuboEvents.length === 0 && <div style={{ color: 'var(--color-paper-faint)' }}>sin eventos todavía</div>}
                    {[...cuboEvents].reverse().map((ev, i) => (
                      <div key={i} style={{ padding: '3px 0', borderTop: '1px solid var(--color-rule)', color: 'var(--color-paper-dim)' }}>
                        <span style={{ color: 'var(--color-paper-faint)' }}>{ev.timestamp}</span> · <span>{ev.tipo}</span> · {ev.detalle}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={kicker}>bitácora del operador (decisiones) · {operatorEvents.length}</span>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={exportOperatorEventsCsv} style={textBtn(true)}><Download size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />csv</button>
                      <button onClick={exportOperatorEventsJson} style={textBtn(true)}><Download size={11} style={{ verticalAlign: '-1px', marginRight: '3px' }} />json</button>
                    </div>
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    {operatorEvents.length === 0 && <div style={{ color: 'var(--color-paper-faint)' }}>sin decisiones todavía</div>}
                    {[...operatorEvents].reverse().map((ev, i) => (
                      <div key={i} style={{ padding: '3px 0', borderTop: '1px solid var(--color-rule)', color: 'var(--color-paper-dim)' }}>
                        <span style={{ color: 'var(--color-paper-faint)' }}>{ev.timestamp}</span> · <span>{ev.operadorId}</span> · {ev.detalle}
                      </div>
                    ))}
                  </div>
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
