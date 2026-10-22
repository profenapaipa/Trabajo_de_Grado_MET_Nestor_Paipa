import type { EventoSesion, IntentoSesion, Seccion } from './sesion'
import { archivoDeIdb, avisarLocal, escribirLocal, leerLocal, poner } from './almacen'

// Perfiles y archivo de sesiones.
//
// Antes, «Cerrar sesión» borraba todo lo registrado: si el informe no se
// había exportado en ese momento, el trabajo de la sesión se perdía. Ahora
// cada sesión se guarda en el perfil de quien la jugó, así que el historial
// se acumula sesión por sesión y nivel por nivel, y el informe general puede
// comparar lo de hoy con lo anterior — que es la evidencia de aprendizaje
// que busca la tesis: la tendencia, no un valor aislado.
//
// Vive en el navegador, con IndexedDB como fuente de verdad y localStorage
// como segundo respaldo (ver almacen.ts). Se lee de una copia en memoria que se
// hidrata al arrancar. Si ninguno de los dos está disponible, la aplicación
// sigue funcionando y el historial dura lo que dure la pestaña.

export type RolPerfil = 'admin' | 'participante'

export type PerfilGuardado = {
  id: string
  nombre: string
  rol: RolPerfil
  creado: string
}

export type SesionArchivada = {
  sesionId: string
  perfilId: string
  participante: string
  operador: string
  inicio: string
  fin: string
  intentos: IntentoSesion[]
  eventos: EventoSesion[]
  // Los eventos son el dato más voluminoso: si el navegador se queda sin
  // espacio se sueltan los de las sesiones más antiguas, no la sesión entera.
  eventosRecortados?: boolean
}

type Archivo = { perfiles: PerfilGuardado[]; sesiones: SesionArchivada[] }

const CLAVE = 'escalera.perfiles.v1'

// Perfil por defecto: entrar con un clic sin escribir nada y que todo quede
// igualmente registrado. Es el perfil de quien prueba y administra, no el de
// un participante del estudio.
export const ID_ADMIN = 'admin'
export const PERFIL_ADMIN: PerfilGuardado = {
  id: ID_ADMIN, nombre: 'ADMIN', rol: 'admin', creado: '1970-01-01T00:00:00.000Z',
}

export function idDeNombre(nombre: string): string {
  const base = nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'sin-nombre'
}

function leerLocalArchivo(): Archivo | null {
  try {
    const crudo = leerLocal(CLAVE)
    if (!crudo) return null
    const a = JSON.parse(crudo) as Archivo
    return {
      perfiles: Array.isArray(a.perfiles) ? a.perfiles : [],
      sesiones: Array.isArray(a.sesiones) ? a.sesiones : [],
    }
  } catch { return null }
}

// Normaliza: el perfil por defecto no se puede perder ni duplicar.
function normalizar(a: Archivo | null | undefined): Archivo {
  const lista = Array.isArray(a?.perfiles) ? a!.perfiles : []
  const sesiones = Array.isArray(a?.sesiones) ? a!.sesiones : []
  return {
    perfiles: lista.some(p => p.id === ID_ADMIN) ? lista : [PERFIL_ADMIN, ...lista],
    sesiones,
  }
}

// De dos copias de la misma sesión se queda con la más completa: la que tiene
// más eventos e intentos, o, a igualdad, la que terminó más tarde. Así una copia
// recortada por falta de espacio nunca pisa a la completa.
const peso = (x: SesionArchivada) => x.eventos.length + x.intentos.length * 1000
function mejor(x: SesionArchivada, y: SesionArchivada): SesionArchivada {
  if (peso(x) !== peso(y)) return peso(x) > peso(y) ? x : y
  return x.fin >= y.fin ? x : y
}

// Une dos archivos sin perder nada de ninguno: perfiles por id, sesiones por
// sesionId. Es lo que permite restaurar una copia de seguridad encima de lo
// que ya hay, o abrir la aplicación por otra dirección sin vaciar el historial.
export function fusionarArchivos(a: Archivo, b: Archivo): Archivo {
  const perfilesPorId = new Map<string, PerfilGuardado>()
  for (const p of [...a.perfiles, ...b.perfiles]) if (!perfilesPorId.has(p.id)) perfilesPorId.set(p.id, p)
  const sesionesPorId = new Map<string, SesionArchivada>()
  for (const s of [...a.sesiones, ...b.sesiones]) {
    const previa = sesionesPorId.get(s.sesionId)
    sesionesPorId.set(s.sesionId, previa ? mejor(previa, s) : s)
  }
  return normalizar({
    perfiles: [...perfilesPorId.values()],
    sesiones: [...sesionesPorId.values()].sort((x, y) => x.inicio.localeCompare(y.inicio)),
  })
}

// Copia en memoria: todos los componentes leen de aquí, de forma síncrona.
let cache: Archivo | null = null

// Se llama una vez al arrancar, después de almacen.hidratar(): reúne lo que
// haya en IndexedDB y en localStorage. Si una de las dos copias tenía menos
// (porque se recortó), la fusión la completa con la otra.
export function hidratarArchivo(): void {
  const idb = archivoDeIdb<Archivo>()
  const local = leerLocalArchivo()
  cache = fusionarArchivos(normalizar(idb), normalizar(local))
  // Si IndexedDB iba por detrás de lo fusionado, se pone al día.
  void poner('archivo', 'archivo', cache)
}

// Sustituye el archivo completo y lo guarda en todas las vías. Lo usa la
// restauración de una copia de seguridad, que ya viene fusionada.
export function reemplazarArchivo(a: Archivo): void { guardar(normalizar(a)) }

export function cargarArchivo(): Archivo {
  if (cache) return cache
  cache = normalizar(leerLocalArchivo())
  return cache
}

// localStorage solo admite unos 5 M de caracteres, y la aplicación ya no
// depende de él: aquí se guarda una copia secundaria, reducida si hace falta.
// Lo que se recorta es esa copia; la de memoria y la de IndexedDB no se tocan.
function guardarLocal(a: Archivo): void {
  let copia = a
  for (let i = 0; i < 24; i++) {
    if (escribirLocal(CLAVE, JSON.stringify(copia))) { avisarLocal(true); return }
    const conEventos = copia.sesiones.findIndex(x => x.eventos.length > 0)
    if (conEventos >= 0) {
      copia = { ...copia, sesiones: copia.sesiones.map((x, k) => (k === conEventos ? { ...x, eventos: [], eventosRecortados: true } : x)) }
    } else if (copia.sesiones.length > 0) {
      copia = { ...copia, sesiones: copia.sesiones.slice(1) }
    } else break
  }
  avisarLocal(false)
}

// Guarda en las dos partes. La copia en memoria es la completa y la que lee la
// aplicación; IndexedDB la hace duradera; localStorage es el respaldo reducido.
function guardar(archivo: Archivo): void {
  cache = archivo
  void poner('archivo', 'archivo', archivo)
  guardarLocal(archivo)
}

function ultimaActividad(a: Archivo, perfilId: string): string | undefined {
  const suyas = a.sesiones.filter(s => s.perfilId === perfilId)
  return suyas.length ? suyas[suyas.length - 1].fin : undefined
}

export function perfiles(): PerfilGuardado[] {
  const a = cargarArchivo()
  // Un perfil puede estar en una sesión archivada sin figurar en la lista
  // (por ejemplo si la lista se recortó por falta de espacio): se reconstruye
  // desde las sesiones, para que la pantalla de inicio y la pestaña de
  // informes no puedan mostrar cosas distintas.
  const conocidos = new Map(a.perfiles.map(p => [p.id, p]))
  for (const s of a.sesiones) {
    if (conocidos.has(s.perfilId)) continue
    conocidos.set(s.perfilId, {
      id: s.perfilId, nombre: s.participante || s.perfilId.toUpperCase(),
      rol: 'participante', creado: s.inicio,
    })
  }
  // Admin primero (entrada rápida); el resto, el de actividad más reciente arriba.
  const resto = [...conocidos.values()].filter(p => p.id !== ID_ADMIN)
    .sort((x, y) => (ultimaActividad(a, y.id) ?? y.creado).localeCompare(ultimaActividad(a, x.id) ?? x.creado))
  return [conocidos.get(ID_ADMIN) ?? PERFIL_ADMIN, ...resto]
}

// Crea el perfil si no existía y lo devuelve.
export function registrarPerfil(nombre: string, rol: RolPerfil = 'participante'): PerfilGuardado {
  const a = cargarArchivo()
  const id = idDeNombre(nombre)
  const existente = a.perfiles.find(p => p.id === id)
  if (existente) return existente
  const nuevo: PerfilGuardado = { id, nombre: nombre.trim().toUpperCase(), rol, creado: new Date().toISOString() }
  guardar({ ...a, perfiles: [...a.perfiles, nuevo] })
  return nuevo
}

export function archivarSesion(s: SesionArchivada): void {
  if (s.intentos.length === 0 && s.eventos.length === 0) return // nada que archivar
  const a = cargarArchivo()
  // Archivar dos veces la misma sesión la reemplaza, no la duplica.
  const sesiones = [...a.sesiones.filter(x => x.sesionId !== s.sesionId), s]
  guardar({ ...a, sesiones })
}

export function sesionesDePerfil(perfilId: string): SesionArchivada[] {
  return cargarArchivo().sesiones.filter(s => s.perfilId === perfilId)
}

export type NivelHistorico = { pares: number; intentos: number; victorias: number; movimientos: number }

export type ResumenPerfil = {
  sesiones: number
  intentos: number
  victorias: number
  movimientos: number
  segundos: number
  faltas: number
  primera?: string
  ultima?: string
  niveles: NivelHistorico[]
  secciones: Seccion[]
}

export function resumenDePerfil(perfilId: string): ResumenPerfil {
  const ss = sesionesDePerfil(perfilId)
  const niveles = new Map<number, NivelHistorico>()
  const secciones = new Set<Seccion>()
  let intentos = 0, victorias = 0, movimientos = 0, segundos = 0, faltas = 0
  for (const s of ss) {
    for (const i of s.intentos) {
      intentos++
      if (i.resultado === 'victoria') victorias++
      movimientos += i.metricas.movimientos
      segundos += i.segundos
      secciones.add(i.seccion)
      const n = niveles.get(i.pares) ?? { pares: i.pares, intentos: 0, victorias: 0, movimientos: 0 }
      n.intentos++
      if (i.resultado === 'victoria') n.victorias++
      n.movimientos += i.metricas.movimientos
      niveles.set(i.pares, n)
    }
    for (const e of s.eventos) {
      if (e.errorTipo) faltas++
      secciones.add(e.seccion)
    }
  }
  return {
    sesiones: ss.length, intentos, victorias, movimientos, segundos, faltas,
    primera: ss[0]?.inicio, ultima: ss[ss.length - 1]?.fin,
    niveles: [...niveles.values()].sort((a, b) => a.pares - b.pares),
    secciones: [...secciones],
  }
}

// Una fila por intento de todas las sesiones archivadas del perfil: el
// formato que sirve para analizar la evolución fuera de la aplicación.
export function historialCsv(perfilId: string): string {
  const cols = ['sesion', 'inicio', 'fin', 'participante', 'operador', 'seccion', 'intento', 'pares',
    'resultado', 'segundos', 'movimientos', 'optimo', 'circuidad', 'eficiencia', 'ramificacion', 'tasaAcierto',
    'puntosDecision', 'retornos', 'buclicidad', 'ciclosIndependientes', 'errores', 'recorrido']
  const esc = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const filas: string[] = []
  for (const s of sesionesDePerfil(perfilId)) {
    for (const i of s.intentos) {
      filas.push([
        s.sesionId, s.inicio, s.fin, s.participante, s.operador, i.seccion, i.numero, i.pares,
        i.resultado, i.segundos, i.metricas.movimientos, i.metricas.optimo,
        i.resultado === 'victoria' ? i.metricas.circuidad.toFixed(4) : '',
        i.resultado === 'victoria' ? i.metricas.eficiencia.toFixed(4) : '',
        i.metricas.puntosDecision ? i.metricas.ramificacion.toFixed(4) : '',
        i.metricas.puntosDecision ? i.metricas.tasaAcierto.toFixed(4) : '',
        i.metricas.puntosDecision, i.metricas.retornos, i.metricas.buclicidad.toFixed(4),
        i.metricas.ciclosIndependientes, i.errores, i.recorrido.join(' '),
      ].map(esc).join(','))
    }
  }
  return [cols.join(','), ...filas].join('\n')
}
