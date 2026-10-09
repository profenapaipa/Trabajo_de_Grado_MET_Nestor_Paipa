// Métricas de trayectoria del juego La Escalera, según las ecuaciones de
// main.tex, sección "Fundamento matemático de las métricas de análisis"
// (3.2 a 3.13). Se calculan sobre el recorrido del aprendiz proyectado
// sobre el grafo de estados: el paseo W = (s0, s1, …, sL).
//
// Tres familias independientes, porque miden conductas distintas:
//   · Circuidad    — cuánto se desvió la ruta de la mínima posible.
//   · Ramificación — qué tan buenas fueron sus decisiones, allí donde decidió.
//   · Buclicidad   — cuántas veces volvió sobre sus pasos.
//
// Una trayectoria puede alejarse mucho del recorrido más corto sin repetir jamás
// un estado, o repetir mucho sin alejarse: por eso no se agregan en un índice
// único.
//
// Ninguna de las tres compara el paseo contra una ruta óptima de referencia, y
// no por comodidad: del Inicio al Fin hay DOS recorridos mínimos (ver
// stateGraph.ts), así que apartarse de uno puede ser seguir el otro. La
// circuidad compara longitudes y la ramificación compara distancias; ambas dan
// lo mismo se tome el recorrido mínimo que se tome.

import { buildStateGraph, type StateGraph } from './stateGraph'

export type MetricasIntento = {
  pares: number
  movimientos: number // L_i
  optimo: number // D*(n) = n² + 2n
  // Circuidad Q_i = L_i / D*(n). Vale 1 en una partida óptima (ec. 3.5).
  // Solo tiene sentido en un intento que alcanzó la meta: en uno bloqueado o
  // abandonado el recorrido no llegó a destino y el cociente no es comparable.
  circuidad: number
  // Ramificación R_i: calidad media de las decisiones, en [0,1]. 0 = siempre
  // eligió lo mejor disponible (ec. 3.7).
  ramificacion: number
  // Tasa de acierto α_i en puntos críticos, en [0,1] (ec. 3.8).
  tasaAcierto: number
  // Grado de libertad medio del recorrido (ec. 3.9).
  gradoLibertadMedio: number
  puntosDecision: number // |K|
  aciertos: number
  // Perfil: la secuencia de C_k a lo largo del intento. El promedio resume;
  // el perfil muestra en qué tramo se concentraron los errores.
  perfil: { movimiento: number; calidad: number }[]
  // Retornos ν_i (ec. 3.10) y su versión normalizada β_i (ec. 3.11).
  retornos: number
  buclicidad: number
  // Ciclos independientes μ_i = |E(W)| − |V(W)| + 1 (número ciclomático, ec. 3.12).
  ciclosIndependientes: number
  // Tamaño de cada bucle observado. Por el cuello del grafo, nunca menor que 6.
  tamanosBucle: number[]
  estadosDistintos: number
}

const vacias = (pares: number): MetricasIntento => ({
  pares, movimientos: 0, optimo: pares * pares + 2 * pares, circuidad: 0,
  ramificacion: 0, tasaAcierto: 1, gradoLibertadMedio: 0, puntosDecision: 0,
  aciertos: 0, perfil: [], retornos: 0, buclicidad: 0, ciclosIndependientes: 0,
  tamanosBucle: [], estadosDistintos: 0,
})

// `recorrido` es la lista de IDs de nodo del grafo, en orden, empezando por el
// estado inicial. Es exactamente lo que ya guardan las pestañas de simulación.
export function metricasDeIntento(pares: number, recorrido: number[]): MetricasIntento {
  const g: StateGraph = buildStateGraph(pares)
  const L = recorrido.length - 1
  if (L <= 0) return vacias(pares)

  const optimo = pares * pares + 2 * pares
  const calidades: number[] = []
  const perfil: MetricasIntento['perfil'] = []
  let sumaGrados = 0

  for (let k = 1; k <= L; k++) {
    const s = recorrido[k - 1]
    const anterior = k >= 2 ? recorrido[k - 2] : 0
    const elegido = recorrido[k]

    // Grados de libertad: los vecinos, menos el estado anterior (Regla 2).
    const opciones = g.vecinos(s).filter(w => w !== anterior)
    sumaGrados += opciones.length

    // Distancia a la meta que dejaría cada opción.
    const dists = opciones.map(w => g.distFinDesde(w, s))
    // Un callejón sin salida (distancia -1) es el peor resultado posible, no
    // un valor menor: se normaliza por encima del máximo alcanzable.
    const finitas = dists.filter(d => d >= 0)
    if (finitas.length === 0) continue
    const peorFinita = Math.max(...finitas)
    const valor = (d: number) => (d < 0 ? peorFinita + 1 : d)
    const vals = dists.map(valor)
    const dMin = Math.min(...vals)
    const dMax = Math.max(...vals)

    // Punto de decisión: más de una opción y no todas equivalentes (ec. 3.4).
    if (opciones.length < 2 || dMax === dMin) continue

    const C = (valor(g.distFinDesde(elegido, s)) - dMin) / (dMax - dMin)
    calidades.push(C)
    perfil.push({ movimiento: k, calidad: C })
  }

  // Buclicidad sobre el paseo.
  const estados = new Set(recorrido)
  const aristas = new Set<string>()
  for (let i = 1; i <= L; i++) {
    const a = recorrido[i - 1], b = recorrido[i]
    aristas.add(a < b ? `${a}-${b}` : `${b}-${a}`)
  }
  const retornos = (L + 1) - estados.size

  // Tamaño de cada bucle: distancia al paso previo en que se visitó ese estado.
  const ultimaVisita = new Map<number, number>()
  const tamanosBucle: number[] = []
  recorrido.forEach((id, i) => {
    const previa = ultimaVisita.get(id)
    if (previa !== undefined) tamanosBucle.push(i - previa)
    ultimaVisita.set(id, i)
  })

  const aciertos = calidades.filter(c => c === 0).length
  return {
    pares,
    movimientos: L,
    optimo,
    circuidad: L / optimo,
    ramificacion: calidades.length ? calidades.reduce((a, b) => a + b, 0) / calidades.length : 0,
    tasaAcierto: calidades.length ? aciertos / calidades.length : 1,
    gradoLibertadMedio: sumaGrados / L,
    puntosDecision: calidades.length,
    aciertos,
    perfil,
    retornos,
    buclicidad: retornos / L,
    ciclosIndependientes: Math.max(0, aristas.size - estados.size + 1),
    tamanosBucle,
    estadosDistintos: estados.size,
  }
}

export type IntentoRegistrado = {
  numero: number
  pares: number
  resultado: 'victoria' | 'bloqueo' | 'reiniciado'
  segundos: number
  errores: number
  metricas: MetricasIntento
}

export type MetricasSesion = {
  intentos: number
  victorias: number
  bloqueos: number
  // Promedios por experiencia (ec. 3.13): la tendencia de estos valores a lo
  // largo de los intentos es la evidencia de aprendizaje que se busca observar.
  circuidadMedia: number // solo sobre los intentos ganados (ver `circuidad`)
  ramificacionMedia: number // R_e
  buclicidadMedia: number // B_e
  tasaAciertoMedia: number
  retornosTotales: number
  movimientosTotales: number
  erroresTotales: number
  segundosTotales: number
}

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function metricasDeSesion(intentos: IntentoRegistrado[]): MetricasSesion {
  const jugados = intentos.filter(i => i.metricas.movimientos > 0)
  return {
    intentos: intentos.length,
    victorias: intentos.filter(i => i.resultado === 'victoria').length,
    bloqueos: intentos.filter(i => i.resultado === 'bloqueo').length,
    circuidadMedia: promedio(jugados.filter(i => i.resultado === 'victoria').map(i => i.metricas.circuidad)),
    ramificacionMedia: promedio(jugados.filter(i => i.metricas.puntosDecision > 0).map(i => i.metricas.ramificacion)),
    buclicidadMedia: promedio(jugados.map(i => i.metricas.buclicidad)),
    tasaAciertoMedia: promedio(jugados.filter(i => i.metricas.puntosDecision > 0).map(i => i.metricas.tasaAcierto)),
    retornosTotales: jugados.reduce((a, i) => a + i.metricas.retornos, 0),
    movimientosTotales: jugados.reduce((a, i) => a + i.metricas.movimientos, 0),
    erroresTotales: intentos.reduce((a, i) => a + i.errores, 0),
    segundosTotales: intentos.reduce((a, i) => a + i.segundos, 0),
  }
}

// Filas planas para exportar a CSV, una por intento.
export function intentosACsv(intentos: IntentoRegistrado[], participante: string, operador: string): string {
  const cols = [
    'intento', 'participante', 'operador', 'pares', 'resultado', 'segundos', 'movimientos',
    'optimo', 'circuidad', 'ramificacion', 'tasaAcierto', 'puntosDecision', 'gradoLibertadMedio',
    'retornos', 'buclicidad', 'ciclosIndependientes', 'estadosDistintos', 'tamanosBucle', 'errores',
  ]
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const num = (x: number, d = 4) => x.toFixed(d)
  const filas = intentos.map(i => [
    i.numero, participante || '(sin nombre)', operador || '(sin asignar)', i.pares, i.resultado,
    i.segundos, i.metricas.movimientos, i.metricas.optimo,
    i.resultado === 'victoria' ? num(i.metricas.circuidad) : '',
    num(i.metricas.ramificacion), num(i.metricas.tasaAcierto), i.metricas.puntosDecision,
    num(i.metricas.gradoLibertadMedio, 2), i.metricas.retornos, num(i.metricas.buclicidad),
    i.metricas.ciclosIndependientes, i.metricas.estadosDistintos,
    i.metricas.tamanosBucle.join(' '), i.errores,
  ].map(esc).join(','))
  return [cols.join(','), ...filas].join('\n')
}
