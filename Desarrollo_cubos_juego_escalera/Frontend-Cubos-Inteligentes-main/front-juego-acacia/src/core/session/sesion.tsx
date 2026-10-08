import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { MetricasIntento } from '../simulation/metricas'
import { archivarSesion, idDeNombre, registrarPerfil, type RolPerfil } from './perfiles'

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
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) {
      const e = JSON.parse(crudo) as Estado
      // Sesión guardada por una versión anterior, sin perfil asociado.
      if (e.perfil && !e.perfil.perfilId) {
        e.perfil = { ...e.perfil, perfilId: idDeNombre(e.perfil.participante), rol: 'participante' }
      }
      return e
    }
  } catch { /* sin almacenamiento: la sesión dura lo que dure la pestaña */ }
  return { perfil: null, eventos: [], intentos: [] }
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(cargar)
  // Las pestañas registran eventos dentro de efectos y callbacks; guardar en
  // disco en cada uno sería costoso, así que se vuelca con un respiro.
  const pendiente = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (pendiente.current) clearTimeout(pendiente.current)
    pendiente.current = setTimeout(() => {
      try { localStorage.setItem(CLAVE, JSON.stringify(estado)) } catch { /* sin almacenamiento */ }
    }, 400)
    return () => { if (pendiente.current) clearTimeout(pendiente.current) }
  }, [estado])

  // La sesión se archiva en el perfil cada vez que se cierra un intento, no
  // solo al pulsar «Terminar sesión»: si el navegador se cierra a mitad de
  // una sesión, lo jugado hasta ahí ya quedó en el historial del perfil.
  useEffect(() => {
    const p = estado.perfil
    if (!p || estado.intentos.length === 0) return
    archivarSesion({
      sesionId: p.sesionId, perfilId: p.perfilId, participante: p.participante, operador: p.operador,
      inicio: p.inicio, fin: new Date().toISOString(),
      intentos: estado.intentos, eventos: estado.eventos,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.intentos.length])

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
        archivarSesion({
          sesionId: s.perfil.sesionId, perfilId: s.perfil.perfilId,
          participante: s.perfil.participante, operador: s.perfil.operador,
          inicio: s.perfil.inicio, fin: new Date().toISOString(),
          intentos: s.intentos, eventos: s.eventos,
        })
      }
      return { perfil: null, eventos: [], intentos: [] }
    })
    try { localStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ }
  }, [])

  const registrarEvento = useCallback((e: Omit<EventoSesion, 'ts'> & { ts?: string }) => {
    setEstado(s => ({ ...s, eventos: [...s.eventos, { ...e, ts: e.ts ?? new Date().toISOString() }] }))
  }, [])

  const registrarIntento = useCallback((i: Omit<IntentoSesion, 'id' | 'fin'>) => {
    setEstado(s => ({
      ...s,
      intentos: [...s.intentos, { ...i, id: `${i.seccion}-${i.numero}-${Date.now()}`, fin: new Date().toISOString() }],
    }))
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
