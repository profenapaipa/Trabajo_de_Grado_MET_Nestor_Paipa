// Almacenamiento duradero de sesiones, perfiles e informes.
//
// POR QUÉ EXISTE. Hasta ahora todo vivía en localStorage, que tiene un tope de
// unos 5 millones de caracteres para TODO el origen. Una sesión de Control con
// su telemetría pesa del orden de 700 KB, de modo que caben unas tres antes de
// que `guardar` empezara a descartar datos: primero los eventos de las
// sesiones más antiguas, después sesiones enteras, y todo sin avisar a nadie.
// Esa es la causa de las sesiones perdidas. Además, cada origen
// (localhost:5173, otra IP, otro puerto) tiene su propio localStorage, así que
// abrir la aplicación por otra dirección «vacía» el historial.
//
// QUÉ HACE AHORA.
//   · IndexedDB es la fuente de verdad: admite cientos de megabytes y no se
//     vacía al llenarse.
//   · localStorage queda como segundo respaldo, de acceso síncrono, y NUNCA
//     modifica los datos: si no le caben, se guarda una versión reducida de su
//     propia copia, no de la que usa la aplicación.
//   · Cuando algo falla, el estado queda visible (ver `leerSalud`) en lugar de
//     fallar en silencio.
//
// La aplicación necesita leer el archivo de forma síncrona (lo hacen varios
// componentes), así que se hidrata una sola vez al arrancar —main.tsx espera a
// `hidratar()` antes de pintar— y desde entonces se lee de memoria.

export type Salud = {
  idb: 'ok' | 'no-disponible' | 'error'
  local: 'ok' | 'lleno' | 'no-disponible'
  // Instante del último guardado que llegó a IndexedDB.
  ultimoGuardado: string | null
}

let salud: Salud = { idb: 'ok', local: 'ok', ultimoGuardado: null }
const oyentes = new Set<() => void>()

function cambiarSalud(parcial: Partial<Salud>) {
  const nueva = { ...salud, ...parcial }
  if (nueva.idb === salud.idb && nueva.local === salud.local && nueva.ultimoGuardado === salud.ultimoGuardado) return
  salud = nueva
  oyentes.forEach(f => f())
}

export const leerSalud = (): Salud => salud
export function suscribirSalud(f: () => void): () => void {
  oyentes.add(f)
  return () => { oyentes.delete(f) }
}

// ── IndexedDB ──────────────────────────────────────────────────────────────

const BD = 'escalera-respaldo'
// archivo: perfiles + sesiones archivadas. vivo: la sesión en curso.
// informes: informes guardados por el usuario. ajustes: p. ej. la carpeta.
const ALMACENES = ['archivo', 'vivo', 'informes', 'ajustes'] as const
export type NombreAlmacen = (typeof ALMACENES)[number]

let abierta: Promise<IDBDatabase | null> | null = null

function abrir(): Promise<IDBDatabase | null> {
  if (abierta) return abierta
  abierta = new Promise(resolver => {
    try {
      if (typeof indexedDB === 'undefined') { cambiarSalud({ idb: 'no-disponible' }); return resolver(null) }
      const pedido = indexedDB.open(BD, 1)
      pedido.onupgradeneeded = () => {
        for (const a of ALMACENES) if (!pedido.result.objectStoreNames.contains(a)) pedido.result.createObjectStore(a)
      }
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => { cambiarSalud({ idb: 'error' }); resolver(null) }
      pedido.onblocked = () => { cambiarSalud({ idb: 'error' }); resolver(null) }
    } catch { cambiarSalud({ idb: 'error' }); resolver(null) }
  })
  return abierta
}

function pedir<T>(almacen: NombreAlmacen, modo: IDBTransactionMode, f: (a: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return abrir().then(bd => new Promise<T | undefined>(resolver => {
    if (!bd) return resolver(undefined)
    try {
      const tx = bd.transaction(almacen, modo)
      const r = f(tx.objectStore(almacen))
      r.onsuccess = () => resolver(r.result)
      r.onerror = () => { cambiarSalud({ idb: 'error' }); resolver(undefined) }
      tx.onabort = () => { cambiarSalud({ idb: 'error' }); resolver(undefined) }
    } catch { cambiarSalud({ idb: 'error' }); resolver(undefined) }
  }))
}

export async function poner(almacen: NombreAlmacen, clave: string, valor: unknown): Promise<boolean> {
  const r = await pedir(almacen, 'readwrite', a => a.put(valor, clave))
  if (r === undefined) return false
  if (almacen === 'archivo' || almacen === 'vivo') cambiarSalud({ idb: 'ok', ultimoGuardado: new Date().toISOString() })
  return true
}

export const leer = <T,>(almacen: NombreAlmacen, clave: string) => pedir<T>(almacen, 'readonly', a => a.get(clave) as IDBRequest<T>)
export const quitar = (almacen: NombreAlmacen, clave: string) => pedir(almacen, 'readwrite', a => a.delete(clave))
export async function todos<T>(almacen: NombreAlmacen): Promise<T[]> {
  return (await pedir<T[]>(almacen, 'readonly', a => a.getAll() as IDBRequest<T[]>)) ?? []
}

// ── localStorage: segundo respaldo ─────────────────────────────────────────

// Intenta guardar. Devuelve false si no cupo o no hay almacenamiento. Nunca
// lanza: la aplicación no puede romperse porque el navegador esté lleno.
export function escribirLocal(clave: string, texto: string): boolean {
  try { localStorage.setItem(clave, texto); return true } catch {
    return false
  }
}
export function leerLocal(clave: string): string | null {
  try { return localStorage.getItem(clave) } catch { return null }
}
export function quitarLocal(clave: string): void {
  try { localStorage.removeItem(clave) } catch { /* sin almacenamiento */ }
}
export function avisarLocal(ok: boolean) {
  cambiarSalud({ local: ok ? 'ok' : (typeof localStorage === 'undefined' ? 'no-disponible' : 'lleno') })
}

// ── Hidratación ────────────────────────────────────────────────────────────

let vivoRespaldo: unknown = undefined
let archivoRespaldo: unknown = undefined

// Lee de IndexedDB lo que la aplicación necesita de forma síncrona. Se llama
// una vez, antes de pintar. Si IndexedDB no responde, la aplicación arranca
// igual con lo que haya en localStorage.
export async function hidratar(): Promise<void> {
  const [a, v] = await Promise.all([leer('archivo', 'archivo'), leer('vivo', 'vivo')])
  archivoRespaldo = a
  vivoRespaldo = v
}

export const archivoDeIdb = <T,>() => archivoRespaldo as T | undefined
export const vivoDeIdb = <T,>() => vivoRespaldo as T | undefined
