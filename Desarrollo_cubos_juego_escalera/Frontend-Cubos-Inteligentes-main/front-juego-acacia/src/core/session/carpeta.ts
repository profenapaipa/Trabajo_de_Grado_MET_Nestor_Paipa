// Carpeta de respaldo en el disco del equipo.
//
// El navegador guarda lo suyo en un almacén interno al que el usuario no
// accede y que se pierde si se borran los datos del sitio, si se abre la
// aplicación por otra dirección o si se cambia de equipo. Una carpeta de
// verdad, elegida por quien usa la aplicación, no tiene ninguno de esos
// problemas: los archivos están ahí, a la vista, se pueden copiar y enviar.
//
// Usa la API de acceso al sistema de archivos (File System Access), que solo
// existe en navegadores basados en Chromium (Chrome, Edge). En los demás la
// aplicación no ofrece carpeta y recurre a la descarga normal de archivos.
//
// LÍMITE QUE CONVIENE CONOCER. Tras recargar la página, Chrome no devuelve el
// permiso de escritura por sí solo: hay que volver a concederlo con un clic.
// Hasta entonces la copia automática a la carpeta no puede escribir, y la
// interfaz lo dice en vez de fallar callada (ver `permiso`).

import { leer, poner, quitar } from './almacen'

export type Permiso = 'granted' | 'denied' | 'prompt'

type Manejador = FileSystemDirectoryHandle & {
  queryPermission(d?: { mode: 'readwrite' }): Promise<Permiso>
  requestPermission(d?: { mode: 'readwrite' }): Promise<Permiso>
}

type SelectorCarpeta = (o?: { mode?: 'readwrite'; id?: string }) => Promise<Manejador>

export type EstadoCarpeta = {
  soportada: boolean
  nombre: string | null
  permiso: Permiso | null
  // Último error al escribir, para mostrarlo en vez de callarlo.
  error: string | null
}

export type ArchivoSalida = { nombre: string; contenido: string | Blob }

// Una carpeta puede devolver un nombre vacío (la raíz de una unidad, por
// ejemplo). La interfaz decide si hay carpeta por si el nombre existe, así que
// nunca puede quedar vacío.
const nombreDe = (h: FileSystemDirectoryHandle) => h.name || 'carpeta elegida'

const selector = (): SelectorCarpeta | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { showDirectoryPicker?: SelectorCarpeta }).showDirectoryPicker?.bind(window)

let manejador: Manejador | null = null
let estado: EstadoCarpeta = { soportada: !!selector(), nombre: null, permiso: null, error: null }
const oyentes = new Set<() => void>()

function cambiar(parcial: Partial<EstadoCarpeta>) {
  estado = { ...estado, ...parcial }
  oyentes.forEach(f => f())
}

export const leerCarpeta = (): EstadoCarpeta => estado
export function suscribirCarpeta(f: () => void): () => void {
  oyentes.add(f)
  return () => { oyentes.delete(f) }
}

// Recupera la carpeta elegida en una visita anterior.
export async function cargarCarpeta(): Promise<void> {
  if (!estado.soportada) return
  const h = await leer<Manejador>('ajustes', 'carpeta')
  if (!h) { manejador = null; cambiar({ nombre: null, permiso: null }); return }
  manejador = h
  try { cambiar({ nombre: nombreDe(h), permiso: await h.queryPermission({ mode: 'readwrite' }), error: null }) }
  catch { cambiar({ nombre: nombreDe(h), permiso: 'prompt' }) }
}

// Abre el selector de carpetas del sistema. Debe llamarse desde un clic.
export async function elegirCarpeta(): Promise<boolean> {
  const elegir = selector()
  if (!elegir) return false
  try {
    const h = await elegir({ mode: 'readwrite', id: 'escalera-sesiones' })
    manejador = h
    await poner('ajustes', 'carpeta', h)
    cambiar({ nombre: nombreDe(h), permiso: await h.queryPermission({ mode: 'readwrite' }), error: null })
    return true
  } catch (e) {
    // Cancelar el selector no es un error.
    if ((e as DOMException)?.name !== 'AbortError') cambiar({ error: String((e as Error)?.message ?? e) })
    return false
  }
}

// Vuelve a pedir el permiso de escritura. Debe llamarse desde un clic.
export async function reactivarCarpeta(): Promise<boolean> {
  if (!manejador) return false
  try {
    const p = await manejador.requestPermission({ mode: 'readwrite' })
    cambiar({ permiso: p, error: null })
    return p === 'granted'
  } catch (e) {
    cambiar({ error: String((e as Error)?.message ?? e) })
    return false
  }
}

export async function olvidarCarpeta(): Promise<void> {
  manejador = null
  await quitar('ajustes', 'carpeta')
  cambiar({ nombre: null, permiso: null, error: null })
}

// Nombres seguros para el sistema de archivos.
export const limpiar = (t: string) =>
  (t || 'sin-nombre').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60) || 'sin-nombre'

// Escribe archivos dentro de `ruta`, creando las subcarpetas que falten.
// No pide permiso: sirve para el guardado automático, que no puede interrumpir
// con un diálogo. Devuelve false si no hay carpeta o no tiene permiso.
export async function escribirEnCarpeta(ruta: string[], archivos: ArchivoSalida[]): Promise<boolean> {
  if (!manejador || estado.permiso !== 'granted') return false
  try {
    let dir: FileSystemDirectoryHandle = manejador
    for (const parte of ruta) dir = await dir.getDirectoryHandle(limpiar(parte), { create: true })
    for (const a of archivos) {
      const f = await dir.getFileHandle(limpiar(a.nombre), { create: true })
      const w = await f.createWritable()
      await w.write(a.contenido)
      await w.close()
    }
    if (estado.error) cambiar({ error: null })
    return true
  } catch (e) {
    cambiar({ error: String((e as Error)?.message ?? e) })
    return false
  }
}
