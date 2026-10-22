// Guardado de sesiones e informes fuera de la memoria interna del navegador.
//
// Tres vías, de menos a más a la vista del usuario:
//   1. IndexedDB (almacen.ts): continuo y silencioso.
//   2. Una carpeta del disco, si el navegador la admite y se eligió una
//      (carpeta.ts): archivos de verdad, uno por sesión.
//   3. La descarga normal de archivos: siempre disponible.
//
// Estructura dentro de la carpeta elegida:
//
//   <carpeta>/<perfil>/<fecha>_<sesion>/sesion.json     ← la sesión completa
//                                       informe-*.html  ← los informes guardados
//                                       datos-*.json / intentos-*.csv

import { poner, quitar, todos } from './almacen'
import { elegirCarpeta, escribirEnCarpeta, leerCarpeta, reactivarCarpeta, type ArchivoSalida } from './carpeta'
import { cargarArchivo, fusionarArchivos, reemplazarArchivo, type SesionArchivada } from './perfiles'

type Clave = { sesionId: string; perfilId: string; inicio: string }

// <perfil>/<2026-10-22_14-05>_<sesion>
export function rutaDeSesion(s: Clave): string[] {
  const fecha = s.inicio.slice(0, 16).replace('T', '_').replace(':', '-')
  return [s.perfilId, `${fecha}_${s.sesionId}`]
}

// Copia la sesión a la carpeta, sin interrumpir: si no hay carpeta o falta el
// permiso, no hace nada. Se llama al cerrar cada intento y al terminar.
export function volcarSesion(s: SesionArchivada): Promise<boolean> {
  return escribirEnCarpeta(rutaDeSesion(s), [{ nombre: 'sesion.json', contenido: JSON.stringify(s) }])
}

// ── Informes guardados ─────────────────────────────────────────────────────

export type InformeGuardado = {
  id: string
  tipo: 'nivel' | 'sesion' | 'macro'
  titulo: string
  perfilId: string
  participante: string
  sesionId: string
  creado: string
  html: string
}

export async function listarInformes(): Promise<InformeGuardado[]> {
  return (await todos<InformeGuardado>('informes')).sort((a, b) => b.creado.localeCompare(a.creado))
}

// Cuenta de cambios en los informes guardados, para que la lista de la
// pestaña de Informes se actualice sola cuando se guarda o borra uno, aunque
// la pestaña ya estuviera abierta.
let versionInformes = 0
const oyentesInformes = new Set<() => void>()
const avisarInformes = () => { versionInformes++; oyentesInformes.forEach(f => f()) }
export const leerVersionInformes = () => versionInformes
export function suscribirInformes(f: () => void): () => void {
  oyentesInformes.add(f)
  return () => { oyentesInformes.delete(f) }
}

export async function borrarInforme(id: string): Promise<void> {
  await quitar('informes', id)
  avisarInformes()
}

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export type ResultadoGuardado = {
  navegador: boolean // quedó en IndexedDB
  carpeta: string | null // nombre de la carpeta, si se escribió en ella
  descargado: boolean // se recurrió a la descarga de archivos
  error: string | null
}

// Guarda un informe por todas las vías disponibles. DEBE llamarse desde el
// clic de un botón: elegir carpeta y reactivar el permiso exigen un gesto del
// usuario, y si se intentara después de un `await` largo el navegador lo
// rechazaría.
export async function guardarInforme(o: {
  tipo: InformeGuardado['tipo']
  titulo: string
  base: string // nombre de archivo sin extensión
  sesion: Clave & { participante: string }
  html: string
  json: unknown
  csv: string
}): Promise<ResultadoGuardado> {
  const creado = new Date().toISOString()
  const id = `${o.sesion.sesionId}|${o.tipo}|${creado}`
  const r: ResultadoGuardado = { navegador: false, carpeta: null, descargado: false, error: null }

  // 1) El navegador: no depende de ningún permiso.
  r.navegador = await poner('informes', id, {
    id, tipo: o.tipo, titulo: o.titulo, perfilId: o.sesion.perfilId,
    participante: o.sesion.participante, sesionId: o.sesion.sesionId, creado, html: o.html,
  } satisfies InformeGuardado)
  avisarInformes()

  // 2) Una carpeta del disco, si el navegador la admite.
  const archivos: ArchivoSalida[] = [
    { nombre: `${o.base}.html`, contenido: o.html },
    { nombre: `${o.base}.json`, contenido: JSON.stringify(o.json, null, 2) },
    { nombre: `${o.base}.csv`, contenido: o.csv },
  ]
  let c = leerCarpeta()
  if (c.soportada) {
    if (!c.nombre) await elegirCarpeta()
    c = leerCarpeta()
    if (c.nombre && c.permiso !== 'granted') await reactivarCarpeta()
    c = leerCarpeta()
    if (c.nombre && c.permiso === 'granted') {
      if (await escribirEnCarpeta(rutaDeSesion(o.sesion), archivos)) r.carpeta = c.nombre
      else r.error = c.error
    }
  }

  // 3) Sin carpeta, se descarga: el informe y los datos, que bastan para
  // regenerarlo. Dos archivos y no tres, para no multiplicar los avisos del
  // navegador por descargas múltiples.
  if (!r.carpeta) {
    descargar(`${o.base}.html`, o.html, 'text/html;charset=utf-8')
    descargar(`${o.base}.json`, JSON.stringify(o.json, null, 2), 'application/json')
    r.descargado = true
  }
  return r
}

// ── Copia de seguridad completa ────────────────────────────────────────────

const FORMATO = 'escalera-respaldo'

export function exportarRespaldo(): string {
  const a = cargarArchivo()
  return JSON.stringify({
    formato: FORMATO, version: 1, generado: new Date().toISOString(),
    perfiles: a.perfiles, sesiones: a.sesiones,
  })
}

// Devuelve cuántas sesiones había en la copia, o un mensaje de error.
export function importarRespaldo(texto: string): { ok: true; sesiones: number; nuevas: number } | { ok: false; error: string } {
  let d: { formato?: string; perfiles?: unknown; sesiones?: unknown }
  try { d = JSON.parse(texto) } catch { return { ok: false, error: 'El archivo no es un JSON válido.' } }
  if (d.formato !== FORMATO || !Array.isArray(d.perfiles) || !Array.isArray(d.sesiones)) {
    return { ok: false, error: 'No es una copia de seguridad de Escalera Inteligente.' }
  }
  const antes = new Set(cargarArchivo().sesiones.map(s => s.sesionId))
  const fusion = fusionarArchivos(cargarArchivo(), { perfiles: d.perfiles as never, sesiones: d.sesiones as never })
  reemplazarArchivo(fusion)
  return {
    ok: true, sesiones: d.sesiones.length,
    nuevas: fusion.sesiones.filter(s => !antes.has(s.sesionId)).length,
  }
}

