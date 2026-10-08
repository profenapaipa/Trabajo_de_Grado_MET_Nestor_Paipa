import { metricasDeIntento } from '../simulation/metricas'
import { archivarSesion, idDeNombre, registrarPerfil, type SesionArchivada } from './perfiles'
import type { EventoSesion, IntentoSesion, Seccion } from './sesion'

// Importar bitácoras exportadas y reconstruir la sesión que las produjo.
//
// Las sesiones anteriores a la pestaña de informes solo existen como los
// archivos .json que se descargaron en su momento (las de Joel y Jerónimo,
// por ejemplo). Ahí está todo lo necesario —cada evento lleva su marca de
// tiempo, el nivel, el tipo y el nodo del grafo en que quedó el tablero—, así
// que los intentos y sus métricas se pueden reconstruir exactamente igual que
// los calcula la aplicación en vivo, y esas sesiones vuelven a tener informe.
//
// Lo que NO se inventa: si una bitácora no trae el nodo del grafo (la de
// Control, que registra el hardware) se importan sus eventos y se avisa que
// no hay recorridos que medir.

type Crudo = Record<string, unknown>

const texto = (v: unknown) => (typeof v === 'string' ? v : '')
const numero = (v: unknown) => (typeof v === 'number' ? v : undefined)

export type BitacoraImportada = {
  archivo: string
  seccion: Seccion
  participanteDetectado: string
  eventos: EventoSesion[]
  // Sin numerar todavía: el número depende de con qué otras partes se una.
  intentos: Omit<IntentoSesion, 'id' | 'fin' | 'numero'>[]
  inicio: string
  fin: string
  aviso?: string
}

export type Lectura =
  | { ok: true; datos: BitacoraImportada }
  | { ok: false; error: string }

const SECCION_POR_VERSION: Record<string, Seccion> = {
  'tutorial-niveles-v1': 'tutorial',
  'sim-config-v0.2': 'libre',
}

function seccionDe(filas: Crudo[], archivo: string): Seccion {
  for (const f of filas) {
    const s = SECCION_POR_VERSION[texto(f.versionConfiguracion)]
    if (s) return s
  }
  const n = archivo.toLowerCase()
  if (n.includes('tutorial')) return 'tutorial'
  if (n.includes('observa')) return 'observador'
  if (n.includes('control') || n.includes('cubos') || n.includes('operador')) return 'control'
  return 'libre'
}

// Una nota de observación tiene otra forma (observador/etiqueta/nota).
const esObservacion = (f: Crudo) => 'etiqueta' in f && 'observador' in f

export function leerBitacora(archivo: string, contenido: string): Lectura {
  let filas: Crudo[]
  try {
    const d = JSON.parse(contenido)
    if (!Array.isArray(d)) return { ok: false, error: 'el archivo no contiene una lista de eventos' }
    filas = d as Crudo[]
  } catch {
    return { ok: false, error: 'no es un JSON válido (¿es el CSV en vez del JSON?)' }
  }
  if (filas.length === 0) return { ok: false, error: 'el archivo está vacío' }

  const observacion = esObservacion(filas[0])
  const seccion: Seccion = observacion ? 'observador' : seccionDe(filas, archivo)

  const eventos: EventoSesion[] = []
  const intentos: BitacoraImportada['intentos'] = []
  let participante = ''
  let conNodo = 0

  // Intento en curso mientras se recorre la bitácora.
  let abierto: { pares: number; recorrido: number[]; errores: number; inicio: string; ultimo: string } | null = null
  const cerrar = (resultado: IntentoSesion['resultado'], fin: string) => {
    if (!abierto) return
    const { pares, recorrido, errores, inicio } = abierto
    abierto = null
    if (recorrido.length < 2) return // no llegó a moverse: no hay intento que medir
    intentos.push({
      seccion, pares, resultado,
      segundos: Math.max(0, Math.round((Date.parse(fin) - Date.parse(inicio)) / 1000)),
      errores, recorrido, metricas: metricasDeIntento(pares, recorrido),
    })
  }

  for (const f of filas) {
    const ts = texto(f.timestamp) || new Date().toISOString()
    if (observacion) {
      participante = participante || texto(f.observador)
      eventos.push({
        ts, seccion: 'observador', tipo: 'nota_observacion',
        detalle: `${texto(f.etiqueta)}${texto(f.nota) ? `: ${texto(f.nota)}` : ''}`,
        intentoNum: numero(f.intento),
      })
      continue
    }

    const tipo = texto(f.tipo)
    const pares = numero(f.pares) ?? numero(f.nivel) ?? 0
    const nodo = numero(f.nodoGrafo)
    const quien = texto(f.participanteId)
    if (quien && quien !== '(sin nombre)' && !participante) participante = quien
    if (nodo && nodo > 0) conNodo++

    eventos.push({
      ts, seccion, tipo, detalle: texto(f.detalle),
      errorTipo: texto(f.errorTipo) || undefined,
      pares: pares || undefined, nivel: numero(f.nivel),
      intentoNum: numero(f.intentoNum), nodoGrafo: nodo,
    })

    // Reconstrucción del intento, con el mismo criterio que la aplicación:
    // el recorrido es la sucesión de nodos distintos, y «deshacer» quita el
    // último paso en vez de añadir uno nuevo.
    switch (tipo) {
      case 'intento_iniciado':
        cerrar('reiniciado', ts)
        abierto = { pares, recorrido: nodo && nodo > 0 ? [nodo] : [], errores: 0, inicio: ts, ultimo: ts }
        break
      case 'movimiento':
        if (abierto && nodo && nodo > 0 && abierto.recorrido[abierto.recorrido.length - 1] !== nodo) {
          abierto.recorrido.push(nodo)
        }
        break
      case 'deshacer':
        if (abierto && abierto.recorrido.length > 1) abierto.recorrido.pop()
        break
      case 'falla':
      case 'falla_movimiento':
        if (abierto) abierto.errores++
        break
      case 'nivel_superado':
      case 'victoria':
        cerrar('victoria', ts)
        break
      case 'derrota':
        cerrar('bloqueo', ts)
        break
      case 'reinicio':
      case 'reinicio_manual':
        cerrar('reiniciado', ts)
        break
    }
    if (abierto) abierto.ultimo = ts
  }
  cerrar('reiniciado', texto(filas[filas.length - 1].timestamp) || new Date().toISOString())

  const marcas = eventos.map(e => e.ts).sort()
  return {
    ok: true,
    datos: {
      archivo, seccion,
      participanteDetectado: participante || '',
      eventos, intentos,
      inicio: marcas[0], fin: marcas[marcas.length - 1],
      aviso: conNodo === 0 && !observacion
        ? 'esta bitácora no guarda la posición en el grafo, así que no se pueden reconstruir los recorridos ni sus métricas'
        : undefined,
    },
  }
}

export type ResultadoImportacion = { sesiones: number; intentos: number; eventos: number; perfil: string }

// Importa las partes leídas. `unir` las junta en una sola sesión (lo normal
// cuando son el tutorial y la práctica libre del mismo día); si no, cada
// archivo queda como una sesión aparte.
export function importarBitacoras(
  partes: BitacoraImportada[],
  participante: string,
  operador: string,
  unir: boolean,
): ResultadoImportacion {
  const perfil = registrarPerfil(participante)
  const grupos = unir ? [partes] : partes.map(p => [p])
  let intentosTotal = 0, eventosTotal = 0

  for (const grupo of grupos) {
    if (grupo.length === 0) continue
    const eventos = grupo.flatMap(g => g.eventos).sort((a, b) => a.ts.localeCompare(b.ts))
    const porSeccion = new Map<Seccion, number>()
    const intentos: IntentoSesion[] = grupo
      .slice()
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .flatMap(g => g.intentos.map(i => {
        const n = (porSeccion.get(i.seccion) ?? 0) + 1
        porSeccion.set(i.seccion, n)
        return { ...i, numero: n, id: `${i.seccion}-${n}-imp`, fin: g.fin }
      }))
    const inicio = eventos[0]?.ts ?? new Date().toISOString()
    const fin = eventos[eventos.length - 1]?.ts ?? inicio
    // Identificador estable: volver a importar los mismos archivos actualiza
    // la sesión en vez de duplicarla.
    const sesion: SesionArchivada = {
      sesionId: `importada-${idDeNombre(participante)}-${Date.parse(inicio)}`,
      perfilId: perfil.id,
      participante: perfil.nombre,
      operador: operador.trim().toUpperCase(),
      inicio, fin, intentos, eventos,
    }
    archivarSesion(sesion)
    intentosTotal += intentos.length
    eventosTotal += eventos.length
  }

  return { sesiones: grupos.filter(g => g.length > 0).length, intentos: intentosTotal, eventos: eventosTotal, perfil: perfil.nombre }
}
