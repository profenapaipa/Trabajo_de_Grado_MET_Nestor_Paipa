import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { metricasDeIntento, type MetricasIntento } from '../simulation/metricas'
import { archivarSesion, idDeNombre, registrarPerfil, type RolPerfil } from './perfiles'
import { avisarLocal, escribirLocal, leerLocal, poner, quitar, quitarLocal, vivoDeIdb } from './almacen'
import { volcarSesion } from './respaldo'

// Sesión de trabajo: un participante, un operador y todo lo que ocurre en las
// cuatro pestañas, en un único lugar.
//
// Antes cada pestaña guardaba su propia bitácora en su propio estado, y al
// cambiar de pestaña React desmontaba el componente y se perdía todo. Ahora las
// pestañas siguen llevando su estado de interfaz, pero cada evento y cada
// intento terminado se registran aquí, que vive por encima de ellas y sobrevive
// al cambio de pestaña y a una recarga del navegador.
//
// Al terminar, la sesión se archiva en el perfil de quien la jugó (ver
// perfiles.ts): el historial por sesiones y niveles no se borra.

export type Seccion = 'control' | 'tutorial' | 'libre' | 'observador'

export const NOMBRE_SECCION: Record<Seccion, string> = {
  control: 'Control Mago de Oz',
  tutorial: 'Tutorial guiado',
  libre: 'Simulación libre',
  observador: 'Vista de observador',
}

// Evento normalizado: las pestañas de simulación y la de Control registran
// cosas distintas, así que aquí se guarda el mínimo común que el informe necesita.
export type EventoSesion = {
  ts: string
  seccion: Seccion
  tipo: string
  detalle: string
  // Qué regla se infringió, cuando el evento es una falla (ver tutor.ts).
  errorTipo?: string
  // Fase del ciclo, cuando el evento es una activación de la mediación. Sin
  // esto el informe sabe que hubo señal pero no cuál, y la pregunta de esta
  // investigación es precisamente si Pausar hace algo distinto de Actuar.
  fase?: 'pausar' | 'pensar' | 'actuar'
  // Qué hizo el operador con la sugerencia. Una descartada no es una
  // activación: el cubo nunca se encendió.
  decision?: 'confirmada' | 'descartada'
  pares?: number
  nivel?: number
  intentoNum?: number
  nodoGrafo?: number
}

export type IntentoSesion = {
  id: string
  seccion: Seccion
  numero: number
  pares: number
  resultado: 'victoria' | 'bloqueo' | 'reiniciado'
  segundos: number
  errores: number
  // Recorrido sobre el grafo de estados, para poder redibujarlo en el informe.
  recorrido: number[]
  // Milisegundos desde el inicio del intento hasta cada movimiento, uno por
  // movimiento. Es lo que permite medir el tiempo de planificación. Opcional:
  // una bitácora antigua puede no traerlo.
  tiempos?: number[]
  metricas: MetricasIntento
  fin: string
}

export type Perfil = {
  participante: string
  operador: string
  // Perfil al que pertenece la sesión (ver perfiles.ts): es lo que permite
  // acumular historial del mismo participante entre sesiones.
  perfilId: string
  rol: RolPerfil
  sesionId: string
  inicio: string
}

type Estado = {
  perfil: Perfil | null
  eventos: EventoSesion[]
  intentos: IntentoSesion[]
}

type Ctx = Estado & {
  abrirSesion: (participante: string, operador: string, rol?: RolPerfil) => void
  cerrarSesion: () => void
  registrarEvento: (e: Omit<EventoSesion, 'ts'> & { ts?: string }) => void
  registrarIntento: (i: Omit<IntentoSesion, 'id' | 'fin'>) => void
  seccionesTrabajadas: Seccion[]
}

const CLAVE = 'escalera.sesion.v1'
const SesionCtx = createContext<Ctx | null>(null)

function cargar(): Estado {
  // Primero localStorage; si no está —porque no cupo, o porque se abrió por
  // otra dirección—, la copia de IndexedDB. Quien guarda se asegura de que
  // localStorage nunca conserve una versión más vieja que la de IndexedDB.
  let e: Estado | null = null
  try {
    const crudo = leerLocal(CLAVE)
    if (crudo) e = JSON.parse(crudo) as Estado
  } catch { /* copia ilegible: se prueba con la otra */ }
  if (!e) e = vivoDeIdb<Estado>() ?? null
  if (!e) return { perfil: null, eventos: [], intentos: [] }
  // Sesión guardada por una versión anterior, sin perfil asociado.
  if (e.perfil && !e.perfil.perfilId) {
    e = { ...e, perfil: { ...e.perfil, perfilId: idDeNombre(e.perfil.participante), rol: 'participante' } }
  }
  return e
}

// Guarda la sesión en curso en las dos partes. Si en localStorage no cabe, se
// borra su copia en vez de dejar una vieja que, al recargar, ganaría a la nueva.
function guardarVivo(e: Estado) {
  if (!e.perfil && e.eventos.length === 0 && e.intentos.length === 0) {
    quitarLocal(CLAVE)
    void quitar('vivo', 'vivo')
    return
  }
  const ok = escribirLocal(CLAVE, JSON.stringify(e))
  if (!ok) quitarLocal(CLAVE)
  avisarLocal(ok)
  void poner('vivo', 'vivo', e)
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(cargar)
  // Las pestañas registran eventos dentro de efectos y callbacks; guardar en
  // disco en cada uno sería costoso, así que se vuelca con un respiro.
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ultimo = useRef(estado)
  ultimo.current = estado

  useEffect(() => {
    if (pendiente.current) clearTimeout(pendiente.current)
    pendiente.current = setTimeout(() => guardarVivo(estado), 400)
    return () => { if (pendiente.current) clearTimeout(pendiente.current) }
  }, [estado])

  // El respiro de 400 ms es un riesgo si la página se recarga o se cierra justo
  // después de una jugada: lo último quedaría sin guardar. Al ocultarse o
  // cerrarse la página se vuelca de inmediato, sin esperar al temporizador.
  useEffect(() => {
    const volcar = () => {
      if (pendiente.current) clearTimeout(pendiente.current)
      guardarVivo(ultimo.current)
    }
    const alOcultar = () => { if (document.visibilityState === 'hidden') volcar() }
    window.addEventListener('pagehide', volcar)
    document.addEventListener('visibilitychange', alOcultar)
    return () => {
      window.removeEventListener('pagehide', volcar)
      document.removeEventListener('visibilitychange', alOcultar)
    }
  }, [])

  // La sesión se archiva en el perfil cada vez que se cierra un intento, no
  // solo al pulsar «Terminar sesión»: si el navegador se cierra a mitad de
  // una sesión, lo jugado hasta ahí ya quedó en el historial del perfil.
  useEffect(() => {
    const p = estado.perfil
    if (!p || estado.intentos.length === 0) return
    const sesion = {
      sesionId: p.sesionId, perfilId: p.perfilId, participante: p.participante, operador: p.operador,
      inicio: p.inicio, fin: new Date().toISOString(),
      intentos: estado.intentos, eventos: estado.eventos,
    }
    archivarSesion(sesion)
    // Y a la carpeta del disco, si hay una elegida y con permiso.
    void volcarSesion(sesion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.intentos.length])

  // Entre un intento y otro pueden pasar minutos de eventos (jugadas, señales,
  // telemetría). Se copian a la carpeta con un respiro largo, para que una
  // caída del navegador a mitad de un intento no los pierda.
  const aCarpeta = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const p = estado.perfil
    if (!p || (estado.eventos.length === 0 && estado.intentos.length === 0)) return
    if (aCarpeta.current) clearTimeout(aCarpeta.current)
    aCarpeta.current = setTimeout(() => {
      void volcarSesion({
        sesionId: p.sesionId, perfilId: p.perfilId, participante: p.participante, operador: p.operador,
        inicio: p.inicio, fin: new Date().toISOString(), intentos: estado.intentos, eventos: estado.eventos,
      })
    }, 8000)
    return () => { if (aCarpeta.current) clearTimeout(aCarpeta.current) }
  }, [estado.eventos.length, estado.intentos.length, estado.perfil])

  const abrirSesion = useCallback((participante: string, operador: string, rol: RolPerfil = 'participante') => {
    const guardado = registrarPerfil(participante, rol)
    setEstado({
      perfil: {
        participante: guardado.nombre,
        operador: operador.trim().toUpperCase(),
        perfilId: guardado.id,
        rol: guardado.rol,
        sesionId: `sesion-${Date.now()}`,
        inicio: new Date().toISOString(),
      },
      eventos: [], intentos: [],
    })
  }, [])

  const cerrarSesion = useCallback(() => {
    setEstado(s => {
      // Se archiva antes de limpiar: cerrar la sesión no borra lo trabajado,
      // lo guarda en el historial del perfil.
      if (s.perfil) {
        const sesion = {
          sesionId: s.perfil.sesionId, perfilId: s.perfil.perfilId,
          participante: s.perfil.participante, operador: s.perfil.operador,
          inicio: s.perfil.inicio, fin: new Date().toISOString(),
          intentos: s.intentos, eventos: s.eventos,
        }
        archivarSesion(sesion)
        void volcarSesion(sesion)
      }
      return { perfil: null, eventos: [], intentos: [] }
    })
    quitarLocal(CLAVE)
    void quitar('vivo', 'vivo')
  }, [])

  const registrarEvento = useCallback((e: Omit<EventoSesion, 'ts'> & { ts?: string }) => {
    setEstado(s => ({ ...s, eventos: [...s.eventos, { ...e, ts: e.ts ?? new Date().toISOString() }] }))
  }, [])

  // Los instantes de cada jugada no los lleva la pestaña: los tiene esta
  // bitácora, que ya registró cada movimiento con su marca de tiempo. Así las
  // latencias salen sin tocar las cuatro vistas.
  //
  // Si las cuentas no cuadran —típicamente porque el intento usó «deshacer»,
  // que quita un paso del recorrido pero deja su evento— se devuelve
  // undefined. Unas latencias desplazadas serían peor que ninguna.
  const registrarIntento = useCallback((i: Omit<IntentoSesion, 'id' | 'fin'>) => {
    setEstado(s => {
      let tiempos = i.tiempos
      if (!tiempos) {
        const movimientos = i.recorrido.length - 1
        const marcas: string[] = []
        let inicio: string | null = null
        let listo: string | null = null
        for (let k = s.eventos.length - 1; k >= 0; k--) {
          const e = s.eventos[k]
          if (e.seccion !== i.seccion) continue
          if (e.tipo === 'intento_iniciado') { inicio = e.ts; break }
          // El origen de tiempos es el instante en que el tablero queda
          // jugable, no el de pulsar «Iniciar»: entre uno y otro corre la
          // cuenta regresiva, que no es tiempo de planificación de nadie.
          if (e.tipo === 'juego_listo') listo = e.ts
          if (e.tipo === 'movimiento') marcas.unshift(e.ts)
        }
        inicio = listo ?? inicio
        if (inicio && marcas.length === movimientos && movimientos > 0) {
          const t0 = Date.parse(inicio)
          tiempos = marcas.map(m => Math.max(0, Date.parse(m) - t0))
        }
      }
      const metricas = tiempos ? metricasDeIntento(i.pares, i.recorrido, tiempos) : i.metricas
      return {
        ...s,
        intentos: [...s.intentos, {
          ...i, tiempos, metricas,
          id: `${i.seccion}-${i.numero}-${Date.now()}`, fin: new Date().toISOString(),
        }],
      }
    })
  }, [])

  const seccionesTrabajadas = useMemo(() => {
    const vistas = new Set<Seccion>()
    estado.eventos.forEach(e => vistas.add(e.seccion))
    estado.intentos.forEach(i => vistas.add(i.seccion))
    return (['control', 'tutorial', 'libre', 'observador'] as Seccion[]).filter(s => vistas.has(s))
  }, [estado.eventos, estado.intentos])

  const valor = useMemo<Ctx>(() => ({
    ...estado, abrirSesion, cerrarSesion, registrarEvento, registrarIntento, seccionesTrabajadas,
  }), [estado, abrirSesion, cerrarSesion, registrarEvento, registrarIntento, seccionesTrabajadas])

  return <SesionCtx.Provider value={valor}>{children}</SesionCtx.Provider>
}

export function useSesion(): Ctx {
  const c = useContext(SesionCtx)
  if (!c) throw new Error('useSesion debe usarse dentro de <SesionProvider>')
  return c
}

// ── Lecturas derivadas, para el informe ────────────────────────────────────

export const REGLA_DE_ERROR: Record<string, string> = {
  ocupada: 'Mover a una casilla ocupada',
  lejos: 'Mover más de dos casillas',
  salto_propio: 'Saltar sobre el propio color',
  salto_hueco: 'Saltar donde no hay ficha',
  regreso: 'Volver a la posición anterior (Regla 2)',
  movimiento_invalido: 'Jugada inválida en el tablero físico (sin clasificar)',
}

export function faltasPorRegla(eventos: EventoSesion[], seccion?: Seccion): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of eventos) {
    if (seccion && e.seccion !== seccion) continue
    if (!e.errorTipo) continue
    out[e.errorTipo] = (out[e.errorTipo] ?? 0) + 1
  }
  return out
}

export function contarTipo(eventos: EventoSesion[], tipo: string, seccion?: Seccion): number {
  return eventos.filter(e => e.tipo === tipo && (!seccion || e.seccion === seccion)).length
}

// Niveles (pares) efectivamente jugados en una sección, en orden.
export function nivelesDe(intentos: IntentoSesion[], seccion: Seccion): number[] {
  return [...new Set(intentos.filter(i => i.seccion === seccion).map(i => i.pares))].sort((a, b) => a - b)
}
