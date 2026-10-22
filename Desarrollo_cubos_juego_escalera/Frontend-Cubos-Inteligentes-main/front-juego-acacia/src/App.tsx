import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { type CubeAction } from './components/Cube'
import AmbientMusicPanel from './components/AmbientMusicPanel'
import { GameState } from './core/GameState'
import socket from './client-socket/sockets'
import { TriangleAlert } from 'lucide-react'
import {
  type EventoCubo, type DecisionOperador,
  toCsvEventosCubo, toCsvDecisionesOperador, downloadFile, nowIso,
} from './core/control/bitacoraControl'
import hexToRgbArray from './core/utils/hextToRgb'
import { cubosDesubicados, ventanaIgual } from './core/control/ordenTablero'
import TableroFisico, { type CeldaTablero, type CuboLevantado, type CubeVisual } from './components/control/TableroFisico'
import { publicarVistaJugador, escucharPedidosVistaJugador, type VistaJugadorSnapshot } from './core/control/vistaJugador'
import { type TelemetriaCubo, type MarcaLatencia, estimarLatencia, porcentajeBateria, textoSinMedicion, motivoReinicio, reinicioAnomalo, BATERIA_BAJA_PCT } from './core/control/telemetria'
import { type MarcadorEeg, type TipoMarcador, crearMarcador, toCsvMarcadores } from './core/control/marcadoresEeg'
import { type Temporizador, ponerTemporizador, ponerIntervalo, quitarTemporizador, useMantenerPantalla } from './core/utils/temporizadorFondo'
import PanelCubos from './components/control/PanelCubos'
import PruebaBase from './components/control/PruebaBase'
import { playPpaFeedback, playError, playCountdownBeep } from './core/utils/ppaTones'
import { PPA_RGB, PPA_HEX, PPA_TEXT, PPA_VIBRATION, PPA_SOUND_LABEL, PPA_LABEL, PPA_FRASE, ppaRgba, AUTO_OFF_MS, FALLAS_PARA_PAUSAR, type PPAPhase, EFECTOS } from './core/ppa/ppaColors'
import { type Board, physicalLegalMoves, physicalOffset, physicalWindow, physicalWindowCanonico, computeWinBoard, boardsEqual, isStuck } from './core/simulation/laEscaleraRules'
import { classifyAttempt, explainError } from './core/simulation/tutor'
import { useSesion } from './core/session/sesion'
import { metricasDeIntento } from './core/simulation/metricas'
import { buildStateGraph } from './core/simulation/stateGraph'
import {
  type SessionState, type SustainedCubeVisual,
  sessionVisualTier, resolveSustainedVisual, sustainedVisualToCommand, resolveCubeDisplay,
} from './core/ppa/cubeVisualState'
import PpaChargeMeter from './components/simulation/PpaChargeMeter'
import GrafoEstados from './components/simulation/GrafoEstados'
import EndBanner from './components/simulation/EndBanner'
import { AnimacionRegla } from './components/simulation/RulesAnimation'
import InformeNivel from './components/informe/InformeNivel'
import { BotonInformeNivel } from './components/informe/botones'
import { SignalGlyph, Electrode, StepMark, PageFrame, PersonField, ParesPicker, Collapsible, Badge, LogPanel, SectionTitle } from './ui/brand'
import { panel, sectionLabel, sessionBtn, countdownSemaforo } from './ui/styles'

const SND_H = [0.55, 0.75, 0.95, 0.60, 1.00, 0.80, 0.70, 0.90]
const INITIAL_POSITIONS = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10]

// Lista vacía estable para el grafo (ver GrafoEstados: un arreglo nuevo en
// cada render le haría recalcular las intensidades de todos los nodos).
const SIN_RECORRIDOS: number[][] = []

// Foto del estado de Control que se comparte con la Vista de observador —
// solo lectura: el observador ve lo mismo que el operador sin duplicar el
// socket ni poder alterar nada.
export type ControlSnapshot = {
  board: number[] // ids por posición visible, 0 = casilla vacía
  cubeActions: Record<number, PPAPhase>
  connected: boolean
  esclavos: number[]
  status: string
  elapsed: string
  intento: number
  moveCount: number
  pares: number
  // Recorrido del intento sobre el grafo de estados, para que el observador
  // vea el mismo mapa que el operador sin tocar el socket.
  recorrido: number[]
}

function App({ onSnapshot, operatorId, setOperatorId }: {
  onSnapshot?: (snapshot: ControlSnapshot) => void
  // El operador es uno solo para toda la aplicación (vive en AppShell): se
  // escribe una vez al entrar y lo usan Control y Simulación por igual.
  operatorId: string
  setOperatorId: (name: string) => void
}) {
  // Sin socket.connect() aquí (2026-10-16): el socket se conecta y reconecta
  // solo (client-socket/sockets.ts). Llamarlo en cada render (cada 500 ms,
  // por el cronómetro) mandaba un segundo "connect" si el render caía entre
  // la apertura del websocket y la confirmación del servidor, y el servidor
  // cerraba la conexión — se veía al recargar la página.

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
  const sesion = useSesion()
  // Recorrido del intento físico sobre el grafo de estados, para que Control
  // aporte las mismas métricas que las pestañas de simulación. La referencia
  // la escribe el listener del socket (fuera de React); el estado es la copia
  // que dibuja el grafo en vivo.
  const recorridoRef = useRef<number[]>([])
  const [recorrido, setRecorrido] = useState<number[]>([])
  // Qué regla infringió la última jugada rechazada del tablero físico: el
  // hardware solo dice que algo cambió, así que se clasifica aquí con las
  // mismas reglas del libro que usan el tutorial y la simulación.
  const [fallo, setFallo] = useState<{ error: string; titulo: string; texto: string } | null>(null)
  const [informeNivel, setInformeNivel] = useState(false)
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

  // ── Estado real del tablero (2026-10-15) ────────────────────────────────────
  // Hasta recibir el estado de la base (caché del backend, reporte del
  // maestro o identificación por IP) el tablero mostrado es solo un supuesto:
  // antes se tomaba [1..5,0,6..10] como cierto al cargar la página aunque los
  // cubos estuvieran en desorden.
  const [sincronizado,   setSincronizado]   = useState(false)
  // Lo que la base LEE en cada casilla (1 = algo apoyado), aparte de la
  // identidad inferida: permite ver en pantalla si el canal de posición
  // funciona, y dónde discrepa del seguimiento (2026-10-16).
  const [presencia,      setPresencia]      = useState<number[] | null>(null)
  // Vista del jugador: el operador decide si el participante ve el
  // cronómetro (a algunos niños la cuenta del tiempo les genera presión).
  const [tiempoJugador,  setTiempoJugador]  = useState(true)
  const vistaJugadorRef = useRef<{ json: string; s: VistaJugadorSnapshot } | null>(null)
  // Ronda de identificación en curso ('iniciar': la pidió Iniciar intento y
  // al terminar arranca la cuenta regresiva si el orden es correcto).
  const [identificando,  setIdentificando]  = useState<null | 'auto' | 'manual' | 'iniciar'>(null)
  const [identResultado, setIdentResultado] = useState<{ ts: number; completa: boolean; casillas: number[]; timeout?: true } | null>(null)
  const [avisoIdentificacion, setAvisoIdentificacion] = useState<string | null>(null)
  const identTimerRef  = useRef<Temporizador | null>(null)
  const autoIdentRef   = useRef(false)
  // Pausa automática por jugada inválida: posición a la que hay que volver
  // (la anterior a la jugada) y la "posición anterior" de la Regla 2 que
  // tenía el juego antes de esa jugada, para restaurarla al corregir.
  const correccionRef  = useRef<{ objetivo: number[]; previoAntes: number[] | null } | null>(null)
  const [objetivoCorreccion, setObjetivoCorreccion] = useState<number[] | null>(null)

  const intentoIdRef        = useRef<string | null>(null)
  // Espejo síncrono de intentoCount para las bitácoras: logCuboEvent se
  // llama en el mismo tick que setIntentoCount, antes de que el nuevo
  // valor de estado esté disponible por closure — igual que intentoIdRef,
  // que existe por la misma razón.
  const intentoNumRef       = useRef<number>(0)
  const sessionStartRef     = useRef<number>(0)   // Date.now() del arranque del tramo "jugando" actual
  const sessionAccumMsRef   = useRef<number>(0)   // tiempo acumulado de tramos "jugando" anteriores del mismo intento
  // Los temporizadores que marcan tiempos de la sesión (cuenta regresiva,
  // pulso de jugada inválida, apagado automático de señales PPA,
  // identificación) corren en un worker: no se frenan si el operador
  // minimiza Control o cambia de ventana (core/utils/temporizadorFondo.ts).
  const countdownTimersRef  = useRef<Temporizador[]>([])
  const flashTimerRef       = useRef<Temporizador | null>(null)
  const sessionWarnTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Telemetría, latencia, marcadores EEG y prueba de la base (2026-10-16) ──
  const [telemetria,     setTelemetria]     = useState<Record<number, TelemetriaCubo>>({})
  const [latencias,      setLatencias]      = useState<number[]>([])
  const [marcadores,     setMarcadores]     = useState<MarcadorEeg[]>([])
  const [pruebaBase,     setPruebaBase]     = useState(false)
  const telemetriaRef    = useRef<Record<number, TelemetriaCubo>>({})
  const bateriaAvisadaRef = useRef<Set<number>>(new Set())
  // Hora real estimada (reloj del PC) del último cambio que reportó la base:
  // la usan los marcadores de jugada en vez de la hora de llegada.
  const tRealUltimoRef   = useRef<{ tReal: number; latencia: number } | null>(null)
  // Nombre del archivo de bitácora en el backend (una por sesión).
  const archivoSesionRef = useRef(`control_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`)
  if (sesion.perfil) archivoSesionRef.current = `${sesion.perfil.perfilId}_${sesion.perfil.sesionId}`

  const actionTimer = useRef<Temporizador | null>(null)
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esclavosRef  = useRef<number[]>([])
  const paresRef      = useRef(pares)
  const operatorIdRef = useRef(operatorId)
  const lastSettledPositionsRef = useRef<number[]>(INITIAL_POSITIONS)
  // Posiciones asentadas ANTES de la última jugada: la Regla 2 (no volver a la
  // posición inmediatamente anterior) las necesita. null al comienzo de un intento.
  const previousSettledRef = useRef<number[] | null>(null)
  const turnStartRef = useRef<number>(Date.now())
  const prevControlStatusRef = useRef<'jugando' | 'victoria' | 'derrota'>('jugando')
  // ── Resolutor único de estado visual (ver core/ppa/cubeVisualState.ts y
  // ESTADO_VISUAL_CUBOS.md): estas referencias existen solo para que el
  // despacho de comandos sepa qué ya se envió (y no repetirlo) y para que el
  // listener de socket, montado una sola vez más abajo, lea sessionState
  // sin cerrarse sobre un valor obsoleto.
  //
  // Caché vacía a propósito (2026-09-18, 2ª corrección): el cubo arranca en
  // NARANJA por defecto (firmware, esperando confirmación) y NO se asienta
  // solo en su color de equipo — necesita que el frontend se lo confirme en
  // cuanto lo vea de verdad conectado (esclavos, más abajo). Si esta caché
  // empezara ya en "equipo_reposo" para todos, ese primer envío de
  // confirmación nunca saldría (la caché ya "creería" que no hace falta).
  const lastSentSustainedRef = useRef<Record<number, string>>({})
  const lastSentSessionRef   = useRef<string | null>(null)
  const sessionStateRef      = useRef<SessionState>('inactivo')
  useEffect(() => { paresRef.current = pares }, [pares])
  // Cambiar de nivel cambia de grafo: el recorrido arranca en la posición
  // actual del tablero físico dentro de la ventana de ese nivel.
  useEffect(() => {
    const nodo = buildStateGraph(pares).nodeIdOf(physicalWindowCanonico(lastSettledPositionsRef.current, pares))
    recorridoRef.current = nodo > 0 ? [nodo] : []
    setRecorrido([...recorridoRef.current])
    setFallo(null)
  }, [pares])
  useEffect(() => { operatorIdRef.current = operatorId }, [operatorId])
  useEffect(() => { sessionStateRef.current = sessionState }, [sessionState])
  useEffect(() => {
    const id = ponerIntervalo(() => setTick(t => t + 1), 500)
    return () => quitarTemporizador(id)
  }, [])
  void tick // fuerza el re-render del medidor de Actuar cada 500ms; su valor no se muestra
  // Pantalla siempre encendida mientras Control está abierto.
  useMantenerPantalla(true)

  // Todo lo que se registra en Control se manda además al backend, que lo
  // agrega en disco (bitacoras/<sesion>.jsonl) al instante: si el navegador
  // se cierra a mitad de sesión, lo registrado no se pierde.
  function guardarEnBackend(registro: string, datos: object) {
    socket.emit('bitacoraEvento', { sesion: archivoSesionRef.current, registro, tsCliente: Date.now(), ...datos })
  }

  // Marcador para el EEG (core/control/marcadoresEeg.ts). Las jugadas del
  // tablero usan la hora estimada del movimiento físico (tRealUltimoRef).
  function registrarMarcador(evento: TipoMarcador, detalle: string, origen: MarcadorEeg['origen'], delTablero = false) {
    const fisico = delTablero ? tRealUltimoRef.current : null
    const m = crearMarcador(evento, detalle, {
      origen,
      intentoNum: intentoIdRef.current ? intentoNumRef.current : undefined,
      ...(fisico ? { tsMs: fisico.tReal, latenciaMs: fisico.latencia } : {}),
    })
    setMarcadores(prev => [...prev, m])
    guardarEnBackend('marcador_eeg', { marcador: m })
  }

  // `errorTipo` llega solo cuando la jugada rechazada se pudo clasificar
  // contra las reglas del libro; si no, queda como falta sin clasificar.
  function logCuboEvent(entry: Omit<EventoCubo, 'timestamp' | 'pares' | 'intentoId' | 'intentoNum'>, errorTipo?: string) {
    const ev: EventoCubo = {
      timestamp: nowIso(), pares: paresRef.current,
      intentoId: intentoIdRef.current ?? undefined,
      intentoNum: intentoIdRef.current ? intentoNumRef.current : undefined,
      ...entry,
    }
    setCuboEvents(prev => [...prev, ev])
    guardarEnBackend('evento_cubo', ev)
    // Los eventos de la partida van también como marcador para el EEG; los
    // que provoca el tablero llevan la hora del movimiento físico.
    const MARCADOR_DE: Partial<Record<EventoCubo['tipo'], [TipoMarcador, boolean]>> = {
      intento_iniciado: ['intento_iniciado', false], falla_movimiento: ['falla_movimiento', true],
      pausa_automatica: ['pausa_automatica', true], correccion_completada: ['correccion_completada', true],
      victoria: ['victoria', true], derrota: ['derrota', true],
      reinicio_manual: ['reinicio_manual', false], tablero_reordenado: ['tablero_reordenado', true],
    }
    const mk = MARCADOR_DE[ev.tipo]
    if (mk) registrarMarcador(mk[0], ev.detalle, mk[1] ? 'tablero' : 'operador', mk[1])
    sesion.registrarEvento({
      seccion: 'control', ts: ev.timestamp, tipo: ev.tipo, detalle: ev.detalle,
      // Una falla del tablero físico es una jugada que infringe las reglas,
      // pero el hardware no dice cuál: se marca como falta sin clasificar.
      errorTipo: ev.tipo === 'falla_movimiento' ? (errorTipo ?? 'movimiento_invalido') : undefined,
      pares: ev.pares, intentoNum: ev.intentoNum,
    })
  }
  function logOperatorEvent(entry: Omit<DecisionOperador, 'timestamp' | 'pares' | 'operadorId' | 'intentoId' | 'intentoNum'>) {
    const ev: DecisionOperador = {
      timestamp: nowIso(), pares: paresRef.current, operadorId: operatorIdRef.current || '(sin asignar)',
      intentoId: intentoIdRef.current ?? undefined,
      intentoNum: intentoIdRef.current ? intentoNumRef.current : undefined,
      ...entry,
    }
    setOperatorEvents(prev => [...prev, ev])
    guardarEnBackend('decision_operador', ev)
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
  // cubos con un solo mensaje ("all"). Marca como al día, en la caché
  // por-cubo, solo a los que YA están conectados (esclavosRef) — llega casi
  // al instante por los sockets persistentes, así que el efecto de
  // reconciliación de nivel cubo no les reenvía el mismo comando por
  // separado. A los que todavía no están conectados los deja SIN marcar a
  // propósito: en cuanto aparezcan en esclavos, ese mismo efecto se los
  // manda solo (por ejemplo, un cubo que se reconecta a mitad de un
  // bloqueo/victoria/pausa).
  function sendSustainedAll(v: SustainedCubeVisual) {
    const key = JSON.stringify(v)
    if (lastSentSessionRef.current === key) return
    lastSentSessionRef.current = key
    for (const id of esclavosRef.current) lastSentSustainedRef.current[id] = key
    socket.emit('comandoCubo', { id: 'all', ...sustainedVisualToCommand(v) })
  }

  useEffect(() => {
    // Al conectar (y en cada reconexión) se pide el estado vigente del
    // tablero en vez de suponer el orden inicial.
    const pedirEstado = () => socket.emit('solicitarEstado')
    socket.on('connect', pedirEstado)
    if (socket.connected) pedirEstado()
    socket.on('disconnect', (motivo: string) => {
      setIsBaseConnected(false)
      logCuboEvent({ tipo: 'base_desconectada', detalle: `Conexión con el backend perdida (${motivo})` })
    })
    socket.on('baseStatus', (data: { connected: boolean }) => {
      setIsBaseConnected(data.connected)
      logCuboEvent({
        tipo: data.connected ? 'base_conectada' : 'base_desconectada',
        detalle: data.connected ? 'La base física reporta conexión activa' : 'La base física reporta desconexión',
      })
    })
    socket.on('actualizarPosiciones', (data: MarcaLatencia & { posiciones: number[]; presencia?: number[]; origen?: string; identificacion?: { completa: boolean; casillas: number[] } }) => {
      if (Array.isArray(data.presencia)) setPresencia([...data.presencia])
      // Latencia de un cambio físico (no de la caché ni de reportes): cuánto
      // tardó de la casilla a esta pantalla, y a qué hora ocurrió de verdad.
      if (!data.origen || data.origen === 'evento' || data.origen === 'presencia') {
        const est = estimarLatencia(data)
        if (est) {
          tRealUltimoRef.current = { tReal: est.tReal, latencia: est.totalMs }
          setLatencias(prev => [...prev.slice(-199), est.totalMs])
        } else {
          tRealUltimoRef.current = null
        }
      }
      // Solo cambió lo que lee la base (la identidad inferida es la misma):
      // es diagnóstico, no una jugada ni un cambio de tablero.
      if (data.origen === 'presencia') return
      // Sin origen (firmware anterior) o 'evento': una jugada real. Los demás
      // orígenes describen cómo ESTÁ el tablero, no un movimiento: se
      // sincronizan sin evaluarse como jugada.
      if (data.origen && data.origen !== 'evento') {
        sincronizarTablero([...data.posiciones], data.origen, data.identificacion)
        return
      }
      logCuboEvent({ tipo: 'posiciones', detalle: 'Actualización de posiciones reportada por la base', posiciones: [...data.posiciones] })
      setSincronizado(true)
      SimDataReceived([...data.posiciones])
    })
    socket.on('esclavosConectados', (data: { esclavos: number[]; telemetria?: TelemetriaCubo[] }) => {
      const nuevos = data.esclavos ?? []
      const antes = esclavosRef.current
      if (Array.isArray(data.telemetria)) {
        const prevTel = telemetriaRef.current
        const tel: Record<number, TelemetriaCubo> = {}
        for (const t of data.telemetria) {
          tel[t.id] = t
          // Reinicio del cubo: su tiempo encendido volvió a empezar. Se anota
          // el motivo (una caída de tensión apunta a la batería o al cableado).
          const p = prevTel[t.id]
          if (p && t.up + 10 < p.up) {
            logCuboEvent({ tipo: 'reinicio_cubo', detalle: `Cubo #${t.id} se reinició (${motivoReinicio(t.rst)})${reinicioAnomalo(t.rst) ? ' — revisar batería/conexiones' : ''}` })
          }
          const pct = porcentajeBateria(t.mv)
          if (pct !== null && pct <= BATERIA_BAJA_PCT && !bateriaAvisadaRef.current.has(t.id)) {
            bateriaAvisadaRef.current.add(t.id)
            logCuboEvent({ tipo: 'bateria_baja', detalle: `Cubo #${t.id} con batería baja: ${pct}% (${(t.mv / 1000).toFixed(2)} V)` })
          } else if (pct !== null && pct > BATERIA_BAJA_PCT + 10) {
            bateriaAvisadaRef.current.delete(t.id)
          }
        }
        // Se reemplaza entero: el maestro ya omite los datos de más de 15 s.
        telemetriaRef.current = tel
        setTelemetria(tel)
      }
      // Este handler ya NO decide qué mandarle a un cubo recién conectado:
      // solo lleva el registro (bitácora + esclavosRef/esclavos). Confirmarle
      // el color de equipo (o la señal de sesión vigente, si la hay) es
      // trabajo del efecto de despacho de nivel cubo, más abajo — que
      // depende de `esclavos` y por eso reacciona igual apenas este estado
      // cambie, sin duplicar el criterio en dos sitios distintos.
      for (const id of nuevos) if (!antes.includes(id)) {
        logCuboEvent({ tipo: 'esclavo_conectado', detalle: `Cubo esclavo #${id} conectado` })
        // Un cubo que (re)conecta pudo haberse reiniciado: se olvida lo que
        // se le había mandado para que el efecto de nivel cubo le reafirme
        // su estado vigente (color de equipo, pausa, etc.).
        delete lastSentSustainedRef.current[id]
      }
      for (const id of antes) if (!nuevos.includes(id)) logCuboEvent({ tipo: 'esclavo_desconectado', detalle: `Cubo esclavo #${id} desconectado` })
      esclavosRef.current = nuevos
      setEsclavos(nuevos)
    })
    return () => {
      socket.off('connect', pedirEstado)
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
    if (gameState.emptyPosition === null || sessionState === 'correccion') return []
    // Sobre la ventana del ejercicio (2n+1 posiciones), no sobre las 11
    // físicas: los bordes del .m dependen del largo del tablero jugado.
    return physicalLegalMoves(lastSettledPositionsRef.current, pares, gameState.emptyPosition, previousSettledRef.current)
  })()
  // El tablero físico siempre tiene 11 posiciones fijas (0-10, vacío en el
  // centro). Para un ejercicio de menos pares, se muestran solo las
  // posiciones más cercanas al centro (las mismas que ocuparía ese
  // ejercicio), sin inventar una reasignación de qué cubo físico es cuál.
  const visibleCubes = cubes.slice(5 - pares, 5 + pares + 1)

  // Victoria/derrota del tablero físico, con las mismas reglas de
  // laEscaleraRules que usa la simulación — informativo: no envía ninguna
  // señal por sí solo, solo se muestra al operador.
  const initialBoardForPares: Board = physicalWindow(INITIAL_POSITIONS, pares)
  const winBoardControl: Board = computeWinBoard(initialBoardForPares)
  const currentBoardControl: Board = physicalWindow(cubes.map(c => c.id), pares)
  // La derrota solo se evalúa con el tablero asentado: exactamente una
  // casilla vacía en la ventana. Con un cubo levantado hay dos (aún no es una
  // posición del juego) y sin ninguna (un cubo de fuera ocupó el hueco) el
  // ejercicio está mal armado, no perdido.
  // Durante la corrección de una jugada inválida el tablero no es una
  // posición del juego: no se evalúa victoria ni bloqueo hasta volver a la
  // posición anterior.
  const controlStatus: 'jugando' | 'victoria' | 'derrota' =
    sessionState === 'correccion' ? 'jugando'
    : boardsEqual(currentBoardControl, winBoardControl) ? 'victoria'
      : currentBoardControl.filter(c => c === null).length === 1 && isStuck(currentBoardControl, winBoardControl, previousSettledRef.current ? physicalWindow(previousSettledRef.current, pares) : null) ? 'derrota'
      : 'jugando'

  // El tablero volvió a la posición inicial del nivel (5 azules + 5 rojos
  // en orden, para pares=5) — es la señal de "listo para iniciar" y la
  // condición que saca a los cubos del blanco ("reordenen") tras un
  // bloqueo o una victoria.
  const isBoardAtInitial = boardsEqual(currentBoardControl, initialBoardForPares)

  // Tablero al que hay que llevar los cubos: el orden inicial antes de
  // jugar, o la posición previa a una jugada inválida durante la corrección.
  const objetivoOrden: number[] | null =
    sessionState === 'correccion' ? objetivoCorreccion
      : sessionState === 'inactivo' && sincronizado && !isBoardAtInitial ? INITIAL_POSITIONS
        : null
  const desubicados = objetivoOrden ? cubosDesubicados(cubes.map(c => c.id), objetivoOrden, pares) : []
  // En blanco, uno por uno, los cubos que hay que mover antes de iniciar (en
  // la corrección van todos en Pausar, como pidió el autor).
  const fueraDeLugarIds = sessionState === 'inactivo' ? desubicados.map(d => d.cubo) : []
  const fueraDeLugarKey = fueraDeLugarIds.join(',')

  // ── Tablero animado (ver components/control/TableroFisico.tsx) ──────────────
  // Mismo resolutor que decide el comando físico (ESTADO_VISUAL_CUBOS.md):
  // pantalla y cubo real nunca discrepan.
  const visualDe = (id: number): CubeVisual =>
    resolveCubeDisplay(sessionVisualTier(sessionState), flashCubeId === id, cubeActions[id], id <= 5 ? teamAColor : teamBColor, fueraDeLugarIds.includes(id))
  const offVentana = 5 - pares
  // Cubos en la mano: estaban en el último tablero asentado y ahora no
  // aparecen en ninguna casilla — se dibujan flotando sobre la que dejaron.
  const enTablero = new Set(gameState.cubesPositions)
  const levantadosVentana: CuboLevantado[] = gameState.cubesPositions.flatMap((id, i) => {
    const antes = lastSettledPositionsRef.current[i]
    if (id !== 0 || !antes || enTablero.has(antes) || i < offVentana || i > offVentana + 2 * pares) return []
    return [{ id: antes, origen: i - offVentana, visual: visualDe(antes) }]
  })
  // Batería bajo cada cubo conectado (solo en Control). Hoy los cubos la
  // tienen desactivada (mv = -1, BATERIA_PIN en Cubo_Esclavo_v3.ino) y no se
  // dibuja nada; aparece sola el día que un cubo traiga el divisor soldado.
  const bateriaDe = (id: number): CeldaTablero['bateria'] => {
    if (id === 0 || !esclavos.includes(id)) return undefined
    const t = telemetria[id]
    if (!t || t.mv === -1) return undefined
    const pct = porcentajeBateria(t.mv)
    return {
      pct,
      titulo: pct === null
        ? `Cubo #${id}: ${textoSinMedicion(t.mv)}`
        : `Cubo #${id}: batería ${pct}% (${(t.mv / 1000).toFixed(2)} V) · WiFi ${t.rssi} dBm`,
    }
  }
  const celdasTablero: CeldaTablero[] = visibleCubes.map((cube, idx) => {
    const casilla = idx + offVentana
    return {
      id: cube.id,
      visual: cube.id === 0 ? { hex: emptySpaceColor } : visualDe(cube.id),
      conectado: esclavos.includes(cube.id),
      presente: presencia ? presencia[casilla] === 1 : undefined,
      legal: cube.id === 0 && legalTargetsLive.includes(casilla),
      bateria: bateriaDe(cube.id),
    }
  })
  const cubosBateriaBaja = esclavos.flatMap(id => {
    const pct = telemetria[id] ? porcentajeBateria(telemetria[id].mv) : null
    return pct !== null && pct <= BATERIA_BAJA_PCT ? [{ id, pct }] : []
  })
  // Diagnóstico del canal de posición: dónde lo que lee la base no cuadra
  // con el seguimiento de identidades (solo con un tablero asentado).
  const avisosBase: string[] = []
  if (presencia && gameState.cubesPositions.filter(x => x === 0).length === 1) {
    gameState.cubesPositions.forEach((id, i) => {
      if (id !== 0 && presencia[i] === 0) avisosBase.push(`Casilla ${i + 1}: debería estar el cubo #${id}, pero la base no lo detecta${esclavos.includes(id) ? '' : ' (además el cubo no está conectado)'}.`)
      if (id === 0 && presencia[i] === 1) avisosBase.push(`Casilla ${i + 1}: la base detecta un cubo que no está identificado — pulsa «Identificar cubos».`)
    })
  }


  async function SimDataReceived(positions: number[]) { await handleStateChange([...positions]) }

  // Estas dos funciones las llama el listener del socket (montado una sola
  // vez): solo usan refs y setters, nunca estado de React leído por closure.

  // Cuando el tablero vuelve a la posición anterior a la jugada inválida,
  // se levanta la pausa automática y el cronómetro sigue.
  function verificarCorreccion(positions: number[]) {
    const c = correccionRef.current
    if (!c || !ventanaIgual(positions, c.objetivo, paresRef.current)) return
    lastSettledPositionsRef.current = positions
    previousSettledRef.current = c.previoAntes
    correccionRef.current = null
    setObjetivoCorreccion(null)
    setFallo(null)
    sessionStartRef.current = Date.now()
    turnStartRef.current = Date.now()
    logCuboEvent({ tipo: 'correccion_completada', detalle: 'El tablero volvió a la posición anterior a la jugada inválida — el intento continúa' })
    setSessionState('jugando')
  }

  // Estado del tablero tal como ESTÁ (caché del backend, reporte del
  // maestro o identificación por IP): reemplaza lo que se suponía, sin
  // evaluarse como jugada.
  function sincronizarTablero(positions: number[], origen: string, ident?: { completa: boolean; casillas: number[] }) {
    const vacias = positions.filter(p => p === 0).length
    if (vacias === 1) lastSettledPositionsRef.current = positions
    const prev = lastSettledPositionsRef.current
    let levantado: number | null = null, hueco: number | null = null
    if (vacias === 2) {
      const v = positions.findIndex((p, i) => p === 0 && prev[i] !== 0)
      if (v !== -1) { levantado = prev[v]; hueco = v }
    }
    setCubesData(originalCubes)
    setGameState({ cubesPositions: [...positions], liftedCube: levantado, emptyPosition: hueco })
    setSincronizado(true)
    if (origen === 'identificacion') {
      quitarTemporizador(identTimerRef.current); identTimerRef.current = null
      const casillas = ident?.casillas ?? []
      const completa = !!ident?.completa
      setIdentResultado({ ts: Date.now(), completa, casillas })
      const sinIdentificar = casillas.flatMap((c, i) => (c === -1 ? [i + 1] : []))
      logCuboEvent({
        tipo: 'identificacion_cubos',
        detalle: completa
          ? 'Identificación por IP completa: cada casilla muestra el cubo que realmente tiene'
          : `Identificación incompleta — casillas sin identificar: ${sinIdentificar.join(', ')}`,
        posiciones: [...positions],
      })
    } else {
      logCuboEvent({
        tipo: 'tablero_sincronizado',
        detalle: origen === 'cache' ? 'Estado del tablero recibido del backend al conectar' : 'Estado del tablero reportado por el maestro',
        posiciones: [...positions],
      })
    }
    if (sessionStateRef.current === 'correccion' && vacias === 1) verificarCorreccion(positions)
  }

  async function handleStateChange(positions: number[]) {
    const empties: number[] = []
    for (let i = 0; i < positions.length; i++) if (positions[i] === 0) empties.push(i)
    if (empties.length !== 1 && empties.length !== 2) {
      // Varios cubos en la mano a la vez (o un cubo puesto sobre el hueco
      // sin verlo salir): no es una posición del juego, solo se muestra.
      setGameState({ cubesPositions: [...positions], liftedCube: null, emptyPosition: null })
    } else if (empties.length === 2) {
      // Último tablero asentado (ref), no `gameState`: este manejador lo
      // llama el listener del socket, montado una sola vez, y `gameState`
      // ahí quedaba congelado en el estado inicial — el cubo levantado y
      // sus casillas válidas se calculaban sobre el tablero equivocado.
      const prev = lastSettledPositionsRef.current
      const v    = empties.find(i => prev[i] !== 0)
      setCubesData(originalCubes)
      setGameState({ cubesPositions: [...positions], liftedCube: v !== undefined ? prev[v] : null, emptyPosition: v ?? null })
      // Inicio del movimiento (el niño levanta un cubo): marcador para el EEG.
      if (v !== undefined && (sessionStateRef.current === 'jugando' || sessionStateRef.current === 'pausado')) {
        registrarMarcador('cubo_levantado', `Cubo #${prev[v]} levantado de la casilla ${v + 1}`, 'tablero', true)
      }
    } else if (empties.length === 1 && sessionStateRef.current === 'correccion') {
      // En corrección los movimientos no son jugadas: solo se sigue el
      // tablero hasta que vuelva a la posición anterior a la falla.
      lastSettledPositionsRef.current = positions
      setGameState({ cubesPositions: [...positions], liftedCube: null, emptyPosition: null })
      verificarCorreccion(positions)
    } else if (empties.length === 1 && sessionStateRef.current !== 'jugando' && sessionStateRef.current !== 'pausado') {
      // Sin intento en curso (antes de iniciar, o reordenando tras un
      // bloqueo/victoria) mover cubos no es jugar: se sigue el tablero sin
      // evaluar reglas, sin sonido de error ni aviso de jugada inválida.
      lastSettledPositionsRef.current = positions
      setCubesData(originalCubes)
      setGameState({ cubesPositions: [...positions], liftedCube: null, emptyPosition: null })
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
        const legal = physicalLegalMoves(prevSettled, paresRef.current, fromIdx, previousSettledRef.current).includes(toIdx)
        if (legal) {
          registrarMarcador('jugada_valida', `Cubo #${prevSettled[fromIdx]} de la casilla ${fromIdx + 1} a la ${toIdx + 1}`, 'tablero', true)
          setFallaCount(0)
          setFallo(null)
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
            // Qué regla se rompió: se clasifica sobre la ventana del
            // ejercicio (2n+1 casillas), con la jugada anterior para la
            // Regla 2 — el mismo clasificador del tutorial, así que la
            // explicación y su animación son las mismas en las tres vistas.
            const off = physicalOffset(paresRef.current)
            const ventana = physicalWindow(prevSettled, paresRef.current)
            const ventanaPrev = previousSettledRef.current ? physicalWindow(previousSettledRef.current, paresRef.current) : null
            const fw = fromIdx - off, tw = toIdx - off
            let tipoFalta: string | undefined
            if (fw >= 0 && fw < ventana.length && tw >= 0 && tw < ventana.length) {
              const res = classifyAttempt(ventana, fw, tw, ventanaPrev)
              const ficha = ventana[fw]
              if (!res.ok && ficha) {
                tipoFalta = res.error
                const { titulo, texto } = explainError(res.error, ficha.team)
                setFallo({ error: res.error, titulo, texto })
              }
            }
            if (!tipoFalta) {
              setFallo({
                error: 'ocupada',
                titulo: 'Jugada no permitida',
                texto: `El cubo #${cuboImplicado} pasó de la posición ${fromIdx + 1} a la ${toIdx + 1}, que no es un movimiento válido del juego. Devuélvelo y prueba otra ficha.`,
              })
            }
            logCuboEvent({ tipo: 'falla_movimiento', detalle: `Movimiento inválido detectado: cubo #${cuboImplicado} de la posición ${fromIdx + 1} a la ${toIdx + 1}` }, tipoFalta)
            setFallaCount(nf => (nf + 1 >= FALLAS_PARA_PAUSAR ? 0 : nf + 1))
            // Reacción física casi inmediata: el cubo implicado se pone
            // naranja y vibra por su cuenta (EF=3, un solo mensaje, sin ida
            // y vuelta repetida). El envío real vive en el efecto de pulso
            // de más abajo (keyed on flashCubeId), no aquí — así respeta el
            // mismo criterio de prioridad que todo lo demás (no se dispara
            // si la sesión ya está en bloqueo/victoria/pausada).
            setFlashCubeId(cuboImplicado)
            quitarTemporizador(flashTimerRef.current)
            flashTimerRef.current = ponerTemporizador(() => setFlashCubeId(null), 1000)

            // Pausa automática (2026-10-15): con un intento en curso, una
            // jugada inválida pone los 10 cubos en Pausar y detiene el
            // cronómetro hasta que el tablero vuelva a la posición anterior,
            // que se muestra en pantalla. La jugada inválida no entra en el
            // recorrido ni cambia la "posición anterior" de la Regla 2.
            if (sessionStateRef.current === 'jugando') {
              correccionRef.current = { objetivo: [...prevSettled], previoAntes: previousSettledRef.current }
              setObjetivoCorreccion([...prevSettled])
              sessionAccumMsRef.current += Date.now() - sessionStartRef.current
              logCuboEvent({ tipo: 'pausa_automatica', detalle: `Jugada inválida del cubo #${cuboImplicado}: todos los cubos en pausa hasta volver a la posición anterior` })
              setSessionState('correccion')
              lastSettledPositionsRef.current = positions
              setCubesData(originalCubes)
              setGameState({ cubesPositions: [...positions], liftedCube: null, emptyPosition: null })
              return
            }
          } else {
            logCuboEvent({ tipo: 'cubo_no_detectado', detalle: `Cubo #${cuboImplicado} no aparece conectado (esclavosConectados) — cambio de posición desde la ${fromIdx + 1} no se cuenta como falla` })
          }
        }
      }
      // Solo cuenta como jugada si el tablero cambió (un cubo levantado y
      // devuelto a su sitio no mueve la "posición anterior").
      if (fromIdx !== -1 && toIdx !== -1) previousSettledRef.current = prevSettled
      // Recorrido sobre el grafo del ejercicio, para las métricas del intento.
      if (intentoIdRef.current) {
        const nodo = buildStateGraph(paresRef.current).nodeIdOf(physicalWindowCanonico(positions, paresRef.current))
        const r = recorridoRef.current
        if (nodo > 0 && r[r.length - 1] !== nodo) {
          r.push(nodo)
          setRecorrido([...r])
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
    quitarTemporizador(actionTimer.current)
    setActiveAction(a)
    actionTimer.current = ponerTemporizador(() => {
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
    registrarMarcador(`senal_${a}` as TipoMarcador,`Señal ${a.toUpperCase()} al cubo #${cubeId}`, 'operador')
  }

  function apagarSenal() {
    if (selectedCubeId === null) { showNoSel(); return }
    const cubeId = selectedCubeId
    quitarTemporizador(actionTimer.current)
    setActiveAction(null)
    setCubeActions(prev => { const next = { ...prev }; delete next[cubeId]; return next })
    // Mismo paso atrás que sendAction: envío directo, no delegado al efecto.
    sendSustained(cubeId, { tier: 'equipo_reposo' }, true)
    logOperatorEvent({ cuboId: cubeId, fase: 'estado_inicial', detalle: `Operador apagó manualmente la señal del cubo #${cubeId} (estado inicial)` })
    registrarMarcador('senal_estado_inicial', `Señal del cubo #${cubeId} apagada`, 'operador')
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
  // Ronda de identificación por IP (Maestro_v3.ino/identificarCubos). Si la
  // base no responde (firmware anterior), a los 12 s se sigue con el orden
  // que lleva el maestro, avisándolo.
  function solicitarIdentificacion(modo: 'auto' | 'manual' | 'iniciar') {
    setIdentificando(modo)
    socket.emit('identificarCubos')
    quitarTemporizador(identTimerRef.current)
    identTimerRef.current = ponerTemporizador(() => {
      identTimerRef.current = null
      setIdentResultado({ ts: Date.now(), completa: false, casillas: [], timeout: true })
    }, 12000)
  }

  function iniciarJuego() {
    if (sessionState !== 'inactivo' || identificando) return
    if (!sincronizado) { showSessionWarning('Todavía no se ha leído el estado real de la base'); return }
    // Antes de empezar se comprueba qué cubo está de verdad en cada casilla;
    // la cuenta regresiva arranca al llegar el resultado (efecto de
    // identResultado, más abajo) solo si el orden es el correcto.
    if (isBaseConnected && esclavos.length > 0) { solicitarIdentificacion('iniciar'); return }
    if (!isBoardAtInitial) { showSessionWarning('Reordena los cubos (5 azules + 5 rojos) antes de iniciar'); return }
    comenzarIntento()
  }

  function comenzarIntento() {
    const nextIntento = intentoCount + 1
    intentoIdRef.current = `intento-${Date.now()}`
    intentoNumRef.current = nextIntento
    previousSettledRef.current = null // intento nuevo: aún no hay posición anterior
    recorridoRef.current = [buildStateGraph(pares).nodeIdOf(physicalWindowCanonico(lastSettledPositionsRef.current, pares))].filter(x => x > 0)
    setRecorrido([...recorridoRef.current])
    sessionAccumMsRef.current = 0
    setFallaCount(0)
    setFallo(null)
    setPath([[...gameState.cubesPositions]])
    setIntentoCount(nextIntento)
    logCuboEvent({ tipo: 'intento_iniciado', detalle: `Intento #${nextIntento} iniciado (${pares} pares)` })
    setSessionState('cuenta_regresiva')

    countdownTimersRef.current.forEach(quitarTemporizador)
    countdownTimersRef.current = [];
    ([3, 2, 1, 0] as const).forEach((t, i) => {
      countdownTimersRef.current.push(ponerTemporizador(() => {
        setCountdownTick(t)
        playCountdownBeep(t)
        if (t === 0) {
          registrarMarcador('inicio_juego', `Intento #${nextIntento}: ¡YA! — el participante puede mover`, 'sistema')
          // La misma marca, en la bitácora de la sesión: es el origen de
          // tiempos desde el que se mide la planificación (ec. 3.17).
          logCuboEvent({ tipo: 'juego_listo', detalle: 'El tablero queda disponible para jugar' })
          sessionStartRef.current = Date.now()
          setSessionState('jugando')
          ponerTemporizador(() => setCountdownTick(null), 600)
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
    registrarMarcador('pausa_operador', 'Operador pausó la partida', 'operador')
    setSessionState('pausado')
  }

  function reanudarJuego() {
    if (sessionState !== 'pausado') return
    // Cualquier señal PPA manual que hubiera quedado pendiente antes de la
    // pausa se descarta aquí explícitamente (no basta con que la pausa la
    // haya tapado visualmente): al reanudar se parte de cero, nunca se
    // restaura sola — decisión validada con el autor 2026-09-18.
    quitarTemporizador(actionTimer.current)
    setActiveAction(null)
    setCubeActions({})
    sessionStartRef.current = Date.now()
    logOperatorEvent({ cuboId: 0, fase: 'estado_inicial', detalle: 'Operador reanudó la partida' })
    registrarMarcador('reanudar_operador', 'Operador reanudó la partida', 'operador')
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
    countdownTimersRef.current.forEach(quitarTemporizador)
    countdownTimersRef.current = []
    logCuboEvent({ tipo: 'reinicio_manual', detalle: `Intento #${intentoCount} reiniciado manualmente por el operador — cubos en blanco, pendiente de reordenar` })
    intentoIdRef.current = null
    sessionAccumMsRef.current = 0
    correccionRef.current = null
    setObjetivoCorreccion(null)
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
  function exportMarcadoresCsv() { downloadFile(`marcadores-eeg-${archivoSesionRef.current}.csv`, toCsvMarcadores(marcadores), 'text/csv;charset=utf-8') }
  function exportOperatorEventsJson() { downloadFile(`bitacora-operador-control-${Date.now()}.json`, JSON.stringify(operatorEvents, null, 2), 'application/json') }

  // ── Derived display values ──────────────────────────────────────────────────
  // Intentos ya terminados de este nivel: alimentan el botón del informe y los
  // recorridos de fondo del grafo. Memorizados porque Control se vuelve a
  // dibujar cada 500 ms (el cronómetro) y el grafo no debe recalcular nada.
  const intentosDelNivel = useMemo(
    () => sesion.intentos.filter(i => i.seccion === 'control' && i.pares === pares),
    [sesion.intentos, pares])
  const recorridosPrevios = useMemo(
    () => (intentosDelNivel.length ? intentosDelNivel.map(i => i.recorrido) : SIN_RECORRIDOS),
    [intentosDelNivel])
  const moveCount    = path.length - 1
  const selAction    = selectedCubeId !== null ? cubeActions[selectedCubeId] : undefined
  // El cronómetro se apoya en el mismo re-render de 500ms de `tick` (arriba).
  const sessionElapsedMs = sessionState === 'jugando'
    ? sessionAccumMsRef.current + (Date.now() - sessionStartRef.current)
    : sessionAccumMsRef.current
  const sessionElapsedLabel = `${Math.floor(sessionElapsedMs / 60000)}:${String(Math.floor((sessionElapsedMs % 60000) / 1000)).padStart(2, '0')}`
  const sessionStatusLabel = sessionState === 'inactivo' ? 'listo para iniciar'
    : sessionState === 'cuenta_regresiva' ? 'cuenta regresiva…'
      : sessionState === 'jugando' ? 'en curso'
        : sessionState === 'pausado' ? 'en pausa'
        : sessionState === 'correccion' ? 'pausa automática — vuelve a la posición anterior'
          : sessionState === 'victoria' ? 'victoria — reordena para seguir'
            : 'bloqueado — reordena para seguir'

  // Foto del estado hacia AppShell para la Vista de observador (ver
  // ControlSnapshot). Incluye la casilla vacía para conservar el orden real.
  const boardIds = visibleCubes.map(c => c.id).join(',')
  useEffect(() => {
    onSnapshot?.({
      board: visibleCubes.map(c => c.id), cubeActions, connected: isBaseConnected, esclavos,
      status: sessionStatusLabel, elapsed: sessionElapsedLabel, intento: intentoCount, moveCount, pares,
      recorrido,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardIds, cubeActions, isBaseConnected, esclavos, sessionStatusLabel, sessionElapsedLabel, intentoCount, moveCount, pares, recorrido])

  // Registra victoria/derrota una sola vez por partida (al pasar de
  // "jugando" a un estado final), no en cada render.
  useEffect(() => {
    if (controlStatus !== 'jugando' && prevControlStatusRef.current === 'jugando') {
      logCuboEvent(
        controlStatus === 'victoria'
          ? { tipo: 'victoria', detalle: `Intento #${intentoCount} — intercambio completo en ${moveCount} movimientos` }
          : { tipo: 'derrota', detalle: `Intento #${intentoCount} — no queda ninguna jugada permitida (bloqueo)` }
      )
      const recorrido = [...recorridoRef.current]
      sesion.registrarIntento({
        seccion: 'control', numero: intentoCount, pares, segundos: Math.round(sessionElapsedMs / 1000),
        resultado: controlStatus === 'victoria' ? 'victoria' : 'bloqueo',
        errores: cuboEvents.filter(e => e.tipo === 'falla_movimiento' && e.intentoNum === intentoCount).length,
        recorrido, metricas: metricasDeIntento(pares, recorrido),
      })
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

  // ── Identificación por IP y estado real del tablero (2026-10-15) ────────────
  // Resultado de una ronda (o su tiempo agotado). Si la pidió "Iniciar
  // intento", la cuenta regresiva arranca aquí — con el tablero ya
  // actualizado al orden real — o se avisa qué falta reordenar.
  useEffect(() => {
    if (!identResultado) return
    const modo = identificando
    setIdentificando(null)
    if (identResultado.timeout) {
      setAvisoIdentificacion('La base no respondió a la identificación (¿maestro o cubos con el firmware anterior?). Se usa el orden que lleva el maestro.')
    } else if (!identResultado.completa) {
      const sin = identResultado.casillas.flatMap((c, i) => (c === -1 ? [i + 1] : []))
      setAvisoIdentificacion(`No se pudo identificar el cubo de la${sin.length > 1 ? 's casillas' : ' casilla'} ${sin.join(', ')}: revisa que esté conectado (punto verde) y con el firmware nuevo. Se usa el orden que lleva el maestro.`)
    } else {
      setAvisoIdentificacion(null)
    }
    if (modo !== 'iniciar' || sessionState !== 'inactivo') return
    if (isBoardAtInitial) comenzarIntento()
    else showSessionWarning('Hay cubos fuera de lugar (en blanco): ubícalos como indica el tablero y vuelve a iniciar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identResultado])

  // Al cargar la página: con la base conectada y los cubos ya reportando,
  // una ronda automática confirma qué cubo hay en cada casilla — así, si la
  // página se recarga con los cubos en desorden, lo primero que se ve es
  // cuáles están mal y adónde van.
  useEffect(() => {
    if (autoIdentRef.current || !isBaseConnected || !sincronizado || esclavos.length === 0) return
    const t = setTimeout(() => {
      if (autoIdentRef.current || sessionStateRef.current !== 'inactivo') return
      autoIdentRef.current = true
      solicitarIdentificacion('auto')
    }, 3000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBaseConnected, sincronizado, esclavos.length])

  // Si la base está conectada pero no manda su estado (maestro con el
  // firmware anterior y backend recién reiniciado), no se bloquea Control
  // para siempre: se asume el orden inicial, avisándolo.
  useEffect(() => {
    if (sincronizado || !isBaseConnected) return
    const t = setTimeout(() => {
      setSincronizado(true)
      setAvisoIdentificacion('La base no envió el estado del tablero; se asume el orden inicial. Usa "Identificar cubos" para comprobarlo.')
    }, 6000)
    return () => clearTimeout(t)
  }, [sincronizado, isBaseConnected])

  useEffect(() => () => { quitarTemporizador(identTimerRef.current) }, [])

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

  // ── Efecto de despacho: nivel CUBO + confirmación de conexión ───────────────
  // Itera sobre `esclavos` (los cubos que el maestro reporta conectados de
  // verdad), no sobre los 10 "virtuales" — así un cubo que arranca en
  // NARANJA por defecto (firmware, a la espera) recibe su color de equipo
  // en cuanto queda confirmado, y no antes. Corre para CUALQUIER nivel de
  // sesión, no solo 'normal': si la sesión ya está en bloqueo/victoria/
  // pausa, un cubo recién conectado también necesita esa señal (no la
  // recibió del broadcast "all" porque todavía no estaba conectado cuando
  // se mandó). La caché de sendSustained evita reenviar de más a los que ya
  // están al día, así que esto también se autocorrige solo si el enlace
  // maestro↔backend se cae un rato y vuelve (como "Base física
  // desconectada", ya visto en la prueba del 2026-09-18) — no depende de
  // que la confirmación llegue a la primera.
  useEffect(() => {
    const tier = sessionVisualTier(sessionState)
    for (const id of esclavos) {
      if (tier === 'normal' && id === flashCubeId) continue // el pulso de inválido tiene prioridad temporal
      sendSustained(id, resolveSustainedVisual(tier, tier === 'normal' ? cubeActions[id] : undefined, fueraDeLugarIds.includes(id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, cubeActions, flashCubeId, esclavos, fueraDeLugarKey])

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

  // ── Vista del jugador (components/jugador/VistaJugador.tsx) ─────────────────
  // Solo lo que ve el participante: sin casillas válidas resaltadas (sería
  // una pista que el juego físico no da) ni lecturas de diagnóstico.
  const vistaJugador: VistaJugadorSnapshot = {
    celdas: celdasTablero.map(c => ({ id: c.id, visual: c.visual, conectado: c.conectado })),
    primeraCasilla: offVentana,
    levantados: levantadosVentana,
    tiempo: sessionElapsedLabel,
    mostrarTiempo: tiempoJugador,
    estado: sessionState,
    intento: intentoCount,
    baseConectada: isBaseConnected,
    conectados: esclavos.length,
    cuenta: countdownTick,
    objetivo: objetivoOrden
      ? { celdas: objetivoOrden.slice(offVentana, offVentana + 2 * pares + 1), desubicados, motivo: sessionState === 'correccion' ? 'correccion' : 'orden' }
      : null,
    fin: controlStatus === 'victoria' ? 'victoria' : controlStatus === 'derrota' ? 'bloqueo' : null,
  }
  useEffect(() => {
    const json = JSON.stringify(vistaJugador)
    if (vistaJugadorRef.current?.json === json) return
    vistaJugadorRef.current = { json, s: vistaJugador }
    publicarVistaJugador(vistaJugador)
  })
  useEffect(() => escucharPedidosVistaJugador(() => {
    if (vistaJugadorRef.current) publicarVistaJugador(vistaJugadorRef.current.s)
  }), [])

  const signalBtn = (a: PPAPhase): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '14px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
    background: activeAction === a ? ppaRgba(a, 0.10) : 'var(--color-panel)',
    border: `${activeAction === a ? 2 : 1}px solid ${activeAction === a ? PPA_HEX[a] : 'var(--color-line)'}`,
    opacity: selectedCubeId === null ? 0.5 : 1,
  })

  return (
    <PageFrame subtitle="Control Mago de Oz" traceColor={isBaseConnected ? 'var(--color-online)' : 'var(--color-offline)'}>

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
              {sessionStatusLabel}
              {intentoCount > 0 ? ` · intento ${intentoCount}` : ''}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '40px', fontWeight: 600, lineHeight: 1.15 }}>
              {sessionElapsedLabel}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={iniciarJuego} disabled={sessionState !== 'inactivo' || identificando !== null}
              style={sessionBtn(sessionState === 'inactivo' && identificando === null, 'var(--color-blue)')}>
              {identificando === 'iniciar' ? 'Identificando cubos…' : 'Iniciar intento'}
            </button>
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
            {/* Mismo botón y mismo informe que en el tutorial y la
                simulación libre: el nivel que se está jugando aquí. */}
            <BotonInformeNivel onClick={() => setInformeNivel(true)} pares={pares}
              intentos={intentosDelNivel.length} />
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

        {controlStatus === 'victoria' && (
          <EndBanner kind="victoria" title="¡Victoria!"
            detail={`Intercambio completo en ${moveCount} movimientos (el mínimo posible con ${pares} par${pares > 1 ? 'es' : ''} es ${pares * pares + 2 * pares}). Reordena los cubos para iniciar otro intento.`} />
        )}
        {controlStatus === 'derrota' && (
          <EndBanner kind="bloqueo" title="Camino sin retorno: bloqueado"
            detail="La única jugada que queda es volver a la posición anterior, y la Regla 2 no lo permite. Mira en el grafo dónde se metió el recorrido y reordena los cubos para otro intento." />
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
              {/* Ronda manual de identificación por IP: qué cubo está de
                  verdad en cada casilla. Solo con la partida detenida. */}
              <button
                onClick={() => solicitarIdentificacion('manual')}
                disabled={!isBaseConnected || identificando !== null || sessionState !== 'inactivo'}
                title="Cada cubo baja un instante su señal de presencia y la base anota en qué casilla está"
                style={{
                  background: 'transparent', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)',
                  padding: '3px 8px', fontSize: '11px', color: 'var(--color-paper-dim)',
                  cursor: !isBaseConnected || identificando !== null || sessionState !== 'inactivo' ? 'not-allowed' : 'pointer',
                  opacity: !isBaseConnected || identificando !== null || sessionState !== 'inactivo' ? 0.5 : 1,
                }}
              >
                {identificando ? 'Identificando…' : 'Identificar cubos'}
              </button>
              <button
                onClick={() => setPruebaBase(p => !p)}
                disabled={sessionState === 'jugando' || sessionState === 'cuenta_regresiva'}
                title="Levantar y apoyar un cubo en cada casilla para comprobar el cableado de la base"
                style={{
                  background: pruebaBase ? 'var(--color-blue)' : 'transparent', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)',
                  padding: '3px 8px', fontSize: '11px', color: pruebaBase ? '#fff' : 'var(--color-paper-dim)',
                  cursor: sessionState === 'jugando' || sessionState === 'cuenta_regresiva' ? 'not-allowed' : 'pointer',
                  opacity: sessionState === 'jugando' || sessionState === 'cuenta_regresiva' ? 0.5 : 1,
                }}
              >
                Probar base
              </button>
              <Badge color={isBaseConnected ? 'var(--color-online)' : 'var(--color-offline)'}>
                <Electrode on={isBaseConnected} colorOn="var(--color-online)" colorOff="var(--color-offline)" />
                {isBaseConnected ? 'Conectado' : 'Desconectado'}
              </Badge>
            </div>
          </div>

          {/* Bajo cada cubo: punto = WiFi del cubo (verde/rojo); barra =
              lo que lee la base en esa casilla (azul = detecta un cubo). */}
          <div style={{ overflowX: 'auto' }}>
            <TableroFisico
              celdas={celdasTablero}
              primeraCasilla={offVentana}
              levantados={levantadosVentana}
              seleccionado={selectedCubeId}
              onSelect={setSelectedCubeId}
              mostrarPresencia={presencia !== null} />
          </div>
          {pruebaBase && <PruebaBase presencia={presencia} onCerrar={() => setPruebaBase(false)} />}
          {cubosBateriaBaja.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-offline)' }}>
              <TriangleAlert size={13} /> Batería baja: {cubosBateriaBaja.map(c => `#${c.id} (${c.pct}%)`).join(', ')} — cárgalos antes del siguiente intento.
            </div>
          )}
          {avisosBase.length > 0 && (
            <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--color-offline)', fontSize: '12px', lineHeight: 1.6 }}>
              <div style={{ ...sectionLabel, color: 'var(--color-offline)' }}>Base física — lectura distinta del seguimiento</div>
              {avisosBase.map(a => <div key={a}>{a}</div>)}
            </div>
          )}

          {!sincronizado && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-paper-dim)' }}>
              Leyendo el estado real de la base… mientras tanto el tablero mostrado es solo un supuesto.
            </div>
          )}
          {(identificando === 'auto' || identificando === 'manual') && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-paper-dim)' }}>
              Identificando qué cubo hay en cada casilla (cada cubo baja un instante su señal de presencia)…
            </div>
          )}
          {avisoIdentificacion && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: 'var(--color-offline)' }}>
              <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: '2px' }} /> {avisoIdentificacion}
            </div>
          )}

          {/* Tablero al que hay que llevar los cubos: el orden inicial (antes
              de jugar, con los cubos fuera de lugar en blanco también en
              físico) o la posición anterior a una jugada inválida (pausa
              automática: todos los cubos en Pausar hasta corregir). */}
          {objetivoOrden && (
            <div style={{
              marginTop: '12px', padding: '12px 14px', borderRadius: 'var(--radius)',
              background: sessionState === 'correccion' ? ppaRgba('pausar', 0.08) : 'var(--color-bg)',
              border: `2px solid ${sessionState === 'correccion' ? PPA_HEX.pausar : 'var(--color-line-strong)'}`,
            }}>
              <div style={{ ...sectionLabel, color: sessionState === 'correccion' ? PPA_TEXT.pausar : undefined }}>
                {sessionState === 'correccion' ? 'Pausa automática · jugada inválida' : 'Cubos fuera de lugar'}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, margin: '2px 0 10px' }}>
                {sessionState === 'correccion'
                  ? 'Vuelve los cubos a esta posición para seguir — el cronómetro está detenido'
                  : 'Ubica los cubos así antes de iniciar (los que están mal se ven en blanco)'}
              </div>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'nowrap', overflowX: 'auto' }}>
                {objetivoOrden.slice(5 - pares, 5 + pares + 1).map((id, k) => {
                  const casilla = k + (5 - pares)
                  const bien = (cubes[casilla]?.id ?? 0) === id
                  return (
                    <div key={casilla} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                      <div style={{
                        width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '13px', borderRadius: '4px', color: '#fff',
                        background: id === 0 ? 'transparent' : (id <= 5 ? teamAColor : teamBColor),
                        border: id === 0 ? '1px dashed var(--color-line-strong)' : 'none',
                        outline: bien ? 'none' : '2px solid var(--color-offline)', outlineOffset: '2px',
                      }}>{id === 0 ? '' : id}</div>
                      <span style={{ fontSize: '10px', color: 'var(--color-paper-faint)', fontFamily: 'var(--font-mono)' }}>{casilla + 1}</span>
                    </div>
                  )
                })}
              </div>
              {desubicados.length > 0 && (
                <ul style={{ margin: '10px 0 0', paddingLeft: '18px', fontSize: '13px', lineHeight: 1.6 }}>
                  {desubicados.map(d => (
                    <li key={d.cubo}>
                      Cubo <b>#{d.cubo}</b>: {d.desde === null ? 'no está sobre el tablero' : `está en la casilla ${d.desde}`} → va en la casilla <b>{d.hasta}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {Object.keys(cubeActions).length > 0 && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
              {Object.entries(cubeActions).map(([id, act]) => (
                <span key={id} style={{ color: PPA_TEXT[act] }}>#{id} {PPA_LABEL[act]}</span>
              ))}
            </div>
          )}

          {/* Jugada rechazada del tablero físico: se dice qué regla se rompió
              y se anima, igual que en el tutorial y en la simulación libre.
              Antes solo subía el medidor de fallas, sin explicar nada. */}
          {fallo && (
            <div style={{
              marginTop: '12px', padding: '12px 14px', borderRadius: 'var(--radius)',
              background: 'rgba(250,77,86,0.10)', border: '2px solid var(--color-offline)',
              display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap',
            }}>
              <span aria-hidden="true" style={{
                width: '30px', height: '30px', flexShrink: 0, borderRadius: '50%', background: 'var(--color-offline)',
                color: '#0B0F10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800,
              }}>✕</span>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ ...sectionLabel, color: 'var(--color-offline)' }}>Movimiento no permitido en el tablero físico</div>
                <div style={{ fontSize: '17px', fontWeight: 700, margin: '2px 0' }}>{fallo.titulo}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)', lineHeight: 1.5 }}>{fallo.texto}</div>
              </div>
              <div style={{ flex: '1 1 330px', minWidth: '240px', maxWidth: '430px' }}><AnimacionRegla error={fallo.error} /></div>
              <button onClick={() => setFallo(null)} style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: '11px', color: 'var(--color-paper-faint)', textDecoration: 'underline',
              }}>ocultar</button>
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

        {/* ── Grafo de estados del intento físico — el mismo componente y el
             mismo comportamiento que en el tutorial y la simulación libre
             (margen, acercamiento automático centrado en la posición actual,
             vista completa al terminar): el operador y el observador siguen
             el recorrido real de los cubos sobre el mapa del juego. ── */}
        <div style={{ ...panel, flexShrink: 0 }}>
          <SectionTitle right={
            <span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>
              recorrido del tablero físico
            </span>
          }>
            Grafo de estados · {pares} par{pares > 1 ? 'es' : ''}
          </SectionTitle>
          <GrafoEstados
            pares={pares}
            previos={recorridosPrevios}
            actual={recorrido}
            height={420}
            terminado={controlStatus !== 'jugando'} />
        </div>

        {/* ── Histórico, colapsable — solo bitácoras: son registro de lo ya
             ocurrido, a diferencia de la barra lateral de arriba. Va dentro
             de la columna principal, con el mismo ancho que Señal PPA, en
             vez de a todo el ancho de la página: así no queda un hueco
             vacío debajo cuando la barra lateral es más alta que Tablero +
             Señal PPA. Es un separador de sección, no otro panel más: sin
             caja ni relleno, solo un filo inferior. ── */}
        <Collapsible title="Histórico — bitácoras de eventos y decisiones" open={histOpen} onToggle={() => setHistOpen(o => !o)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
            <LogPanel
              title="Bitácora de eventos de los cubos"
              rows={cuboEvents.map(ev => ({ ts: ev.timestamp, tag: ev.tipo, text: ev.detalle }))}
              empty="Sin eventos todavía — reportados por el hardware físico."
              onCsv={exportCuboEventsCsv} onJson={exportCuboEventsJson} />
            <LogPanel
              title="Bitácora del operador (decisiones)"
              rows={operatorEvents.map(ev => ({ ts: ev.timestamp, tag: ev.operadorId, text: ev.detalle }))}
              empty="Sin decisiones todavía — cada envío de Pausar/Pensar/Actuar queda aquí."
              onCsv={exportOperatorEventsCsv} onJson={exportOperatorEventsJson} />
          </div>
          {/* Marcadores para alinear con el EEG (hora del PC, la misma de la
              columna Timestamp del OpenBCI GUI) — ver herramientas/sincronizar_eeg.py.
              Todo se guarda además en disco en el backend, evento a evento. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '12px', fontSize: '12px', color: 'var(--color-paper-dim)' }}>
            <span>
              Marcadores EEG: <b style={{ color: 'var(--color-paper)' }}>{marcadores.length}</b>
              {' · '}bitácora guardándose en el backend como <code style={{ fontSize: '11px' }}>bitacoras/{archivoSesionRef.current}.jsonl</code>
            </span>
            <button onClick={exportMarcadoresCsv} disabled={marcadores.length === 0}
              style={{ ...sessionBtn(marcadores.length > 0, 'var(--color-blue)'), fontSize: '12px', padding: '6px 12px' }}>
              Descargar marcadores EEG (CSV)
            </button>
          </div>
        </Collapsible>

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
            <PersonField label="Operador Mago de Oz" value={operatorId} onConfirm={setOperatorId} onClear={() => setOperatorId('')} />
            <ParesPicker value={pares} onChange={setPares} />
            {/* Pantalla del participante: sin controles del operador. Pensada
                para un segundo monitor frente a quien juega. */}
            <div>
              <div style={{ ...sectionLabel, marginBottom: '8px' }}>Vista del jugador</div>
              <button
                onClick={() => window.open(`${location.pathname}?vista=jugador`, 'vista-jugador', 'popup,width=1280,height=800')}
                style={{ ...sessionBtn(true, 'var(--color-blue)'), width: '100%', justifyContent: 'center', fontSize: '12px', padding: '8px' }}>
                Abrir en otra ventana
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px', color: 'var(--color-paper-dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={tiempoJugador} onChange={e => setTiempoJugador(e.target.checked)} />
                Mostrarle el cronómetro
              </label>
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

          <div style={panel}>
            <div style={{ ...sectionLabel, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><StepMark />Cubos · conexión y señal</div>
            <PanelCubos esclavos={esclavos} telemetria={telemetria} latencias={latencias} />
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

        {informeNivel && (
          <InformeNivel seccion="control" pares={pares} onCerrar={() => setInformeNivel(false)} />
        )}
    </PageFrame>
  )
}

export default App
