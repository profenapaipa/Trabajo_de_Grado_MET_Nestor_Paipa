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
  // Eficiencia E_i = D*(n) / L_i, la recíproca de la circuidad (ec. 3.6). Es la
  // forma en que esta magnitud se reporta en la literatura de tareas de torre
  // —Faber, Kühnpast, Sürer, Hinz y Danek (2009) la llaman «efficiency»— y
  // tiene una ventaja práctica sobre Q: está acotada en (0, 1], así que puede
  // dibujarse en el mismo eje que la ramificación, la tasa de acierto y la
  // buclicidad. 1 = partida mínima.
  eficiencia: number
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
  // ── Tiempos (ec. 3.17) ───────────────────────────────────────────────────
  //
  // Solo se calculan si la bitácora guarda el instante de cada jugada; si no,
  // quedan en null y el informe lo dice en vez de inventar un cero.
  //
  // `latenciaInicial` es el «initiation time» de la literatura de tareas de
  // torre: el tiempo desde que se presenta el problema hasta el primer
  // movimiento, que Faber, Kühnpast, Sürer, Hinz y Danek (2009) describen
  // como «the time needed for planning».
  //
  // Las otras dos separan lo que ningún total de tiempo distingue: cuánto
  // tardó donde había algo que decidir y cuánto donde la jugada estaba
  // forzada. Un participante puede ser lento en todo —y eso es velocidad
  // motriz— o lento solo donde había que elegir, que es deliberación.
  latenciaInicial: number | null // ms hasta el primer movimiento
  latenciaDecision: number | null // ms medios antes de un punto de decisión
  latenciaForzada: number | null // ms medios antes de una jugada sin elección
}

const vacias = (pares: number): MetricasIntento => ({
  pares, movimientos: 0, optimo: pares * pares + 2 * pares, circuidad: 0, eficiencia: 0,
  ramificacion: 0, tasaAcierto: 1, gradoLibertadMedio: 0, puntosDecision: 0,
  aciertos: 0, perfil: [], retornos: 0, buclicidad: 0, ciclosIndependientes: 0,
  tamanosBucle: [], estadosDistintos: 0,
  latenciaInicial: null, latenciaDecision: null, latenciaForzada: null,
})

// `recorrido` es la lista de IDs de nodo del grafo, en orden, empezando por el
// estado inicial. Es exactamente lo que ya guardan las pestañas de simulación.
// `tiempos` son los milisegundos transcurridos desde el inicio del intento
// hasta cada movimiento: uno por movimiento, de modo que su longitud es la del
// recorrido menos uno. Es opcional porque no todas las bitácoras lo guardan.
export function metricasDeIntento(pares: number, recorrido: number[], tiempos?: number[]): MetricasIntento {
  const g: StateGraph = buildStateGraph(pares)
  const L = recorrido.length - 1
  if (L <= 0) return vacias(pares)
  // Solo se usan si cuadran con el recorrido: una bitácora a medias daría
  // latencias desplazadas, que es peor que no darlas.
  const ts = tiempos && tiempos.length === L ? tiempos : null

  const optimo = pares * pares + 2 * pares
  const calidades: number[] = []
  const perfil: MetricasIntento['perfil'] = []
  const decision: boolean[] = [] // decision[k] = el movimiento k fue punto de decisión
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
    decision[k] = true

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

  // Latencias: el intervalo que precede a cada movimiento, separado según si
  // en esa posición había algo que decidir.
  let latenciaInicial: number | null = null
  let latenciaDecision: number | null = null
  let latenciaForzada: number | null = null
  if (ts) {
    latenciaInicial = ts[0]
    const conEleccion: number[] = []
    const forzadas: number[] = []
    // Desde el SEGUNDO movimiento. El intervalo que precede al primero es la
    // latencia inicial, que ya se reporta aparte y además arrastra el tiempo
    // que la interfaz tarda en dejar jugar; mezclarlo en estas dos medias las
    // falsea. Y lo falsea siempre en el mismo sentido: en el estado inicial
    // las dos jugadas posibles son imagen especular y dejan la misma
    // distancia, así que nunca es punto de decisión y el primer intervalo
    // caería entero del lado de las jugadas forzadas.
    for (let k = 2; k <= L; k++) {
      const intervalo = ts[k - 1] - ts[k - 2]
      if (intervalo < 0) continue // marcas de tiempo desordenadas: se descarta
      ;(decision[k] ? conEleccion : forzadas).push(intervalo)
    }
    const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
    latenciaDecision = media(conEleccion)
    latenciaForzada = media(forzadas)
  }

  const aciertos = calidades.filter(c => c === 0).length
  return {
    pares,
    movimientos: L,
    optimo,
    circuidad: L / optimo,
    eficiencia: optimo / L,
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
    latenciaInicial,
    latenciaDecision,
    latenciaForzada,
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
  // ── Agregación entre intentos ────────────────────────────────────────────
  //
  // Hay dos formas de resumir un conjunto de intentos, y NO dan lo mismo.
  //
  //   · La media por intento (ec. 3.14): promedia los valores ya promediados
  //     de cada intento. Un intento con un solo punto de decisión pesa igual
  //     que uno con cuarenta. Describe «cómo le fue en un intento típico».
  //   · La agregada o ponderada (ec. 3.15): junta primero y divide después.
  //     Equivale a promediar TODAS las decisiones de la sesión, no las medias.
  //     Describe «cómo decidió en la sesión».
  //
  // La diferencia es grande con datos reales: en la sesión piloto de Jerónimo
  // la ramificación pasa de 0,249 a 0,133 (un 47 % menos) porque sus intentos
  // cortos arrastraban la media; en la de Joel la buclicidad pasa de 0,0033 a
  // 0,0104 (el triple) porque sus retornos se concentran en los intentos
  // largos. Como la cifra puede cambiar de categoría en el informe, se
  // calculan y se muestran las dos, y la ponderada es la que titula.
  circuidadMedia: number // solo sobre los intentos ganados (ver `circuidad`)
  eficienciaMedia: number // E media, solo sobre los ganados
  ramificacionMedia: number // media por intento de R (ec. 3.14)
  buclicidadMedia: number // media por intento de β (ec. 3.14)
  // Ponderadas (ec. 3.15): Σ(|K_j|·R_j)/Σ|K_j| y Σν_j/ΣL_j.
  ramificacionPonderada: number
  buclicidadAgregada: number
  // Cuántas decisiones reales sostienen la cifra ponderada. Sin esto no se
  // puede juzgar si un valor es sólido o viene de tres jugadas.
  puntosDecisionTotales: number
  tasaAciertoMedia: number
  tasaAciertoPonderada: number
  retornosTotales: number
  movimientosTotales: number
  erroresTotales: number
  segundosTotales: number
}

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
// Media ponderada: Σ(p_j·x_j)/Σp_j. Si no hay peso, devuelve 0 en vez de NaN.
const ponderada = (xs: number[], ps: number[]) => {
  const t = suma(ps)
  return t > 0 ? suma(xs.map((x, k) => x * ps[k])) / t : 0
}

export function metricasDeSesion(intentos: IntentoRegistrado[]): MetricasSesion {
  const jugados = intentos.filter(i => i.metricas.movimientos > 0)
  const ganados = jugados.filter(i => i.resultado === 'victoria')
  const conDecisiones = jugados.filter(i => i.metricas.puntosDecision > 0)
  const pesos = conDecisiones.map(i => i.metricas.puntosDecision)
  return {
    intentos: intentos.length,
    victorias: ganados.length,
    bloqueos: intentos.filter(i => i.resultado === 'bloqueo').length,
    circuidadMedia: promedio(ganados.map(i => i.metricas.circuidad)),
    eficienciaMedia: promedio(ganados.map(i => i.metricas.eficiencia)),
    ramificacionMedia: promedio(conDecisiones.map(i => i.metricas.ramificacion)),
    buclicidadMedia: promedio(jugados.map(i => i.metricas.buclicidad)),
    ramificacionPonderada: ponderada(conDecisiones.map(i => i.metricas.ramificacion), pesos),
    buclicidadAgregada: suma(jugados.map(i => i.metricas.movimientos)) > 0
      ? suma(jugados.map(i => i.metricas.retornos)) / suma(jugados.map(i => i.metricas.movimientos))
      : 0,
    puntosDecisionTotales: suma(pesos),
    tasaAciertoMedia: promedio(conDecisiones.map(i => i.metricas.tasaAcierto)),
    tasaAciertoPonderada: ponderada(conDecisiones.map(i => i.metricas.tasaAcierto), pesos),
    retornosTotales: jugados.reduce((a, i) => a + i.metricas.retornos, 0),
    movimientosTotales: jugados.reduce((a, i) => a + i.metricas.movimientos, 0),
    erroresTotales: intentos.reduce((a, i) => a + i.errores, 0),
    segundosTotales: intentos.reduce((a, i) => a + i.segundos, 0),
  }
}

// Agregación estratificada por nivel (ec. 3.16).
//
// Promediar entre niveles mezcla cosas que no son comparables: el grado de
// libertad medio y el número de puntos de decisión cambian con el tamaño del
// tablero, de modo que una ramificación de 0,20 en dos pares y otra de 0,20 en
// cinco no describen la misma conducta. El estudio del iso-efecto en la Torre
// de Londres (Faber, Kühnpast, Sürer, Hinz y Danek, 2009) compara por esa
// razón dentro de problemas de la misma longitud, nunca entre longitudes
// distintas.
export type ResumenNivel = {
  pares: number
  optimo: number
  intentos: number
  ganados: number
  mejorMovimientos: number | null // la mejor partida ganada
  eficienciaMejor: number | null // D* / mejor
  ramificacionPonderada: number
  buclicidadAgregada: number
  puntosDecision: number
}

export function metricasPorNivel(intentos: IntentoRegistrado[]): ResumenNivel[] {
  const jugados = intentos.filter(i => i.metricas.movimientos > 0)
  const niveles = [...new Set(jugados.map(i => i.pares))].sort((a, b) => a - b)
  return niveles.map(pares => {
    const del = jugados.filter(i => i.pares === pares)
    const ganados = del.filter(i => i.resultado === 'victoria')
    const optimo = pares * pares + 2 * pares
    const mejor = ganados.length ? Math.min(...ganados.map(i => i.metricas.movimientos)) : null
    const conK = del.filter(i => i.metricas.puntosDecision > 0)
    const pesos = conK.map(i => i.metricas.puntosDecision)
    const total = pesos.reduce((a, b) => a + b, 0)
    const movs = del.reduce((a, i) => a + i.metricas.movimientos, 0)
    return {
      pares, optimo, intentos: del.length, ganados: ganados.length,
      mejorMovimientos: mejor,
      eficienciaMejor: mejor ? optimo / mejor : null,
      ramificacionPonderada: total > 0
        ? conK.reduce((a, i) => a + i.metricas.ramificacion * i.metricas.puntosDecision, 0) / total
        : 0,
      buclicidadAgregada: movs > 0 ? del.reduce((a, i) => a + i.metricas.retornos, 0) / movs : 0,
      puntosDecision: total,
    }
  })
}

// Pendiente de la recta de mínimos cuadrados de `ys` contra su orden (1, 2, …).
//
// La tendencia dejada en un gráfico es una impresión; esto es el número. Dice
// cuánto cambia el indicador por cada intento (o cada sesión) que pasa, y su
// signo es lo que sostiene la afirmación de que hubo aprendizaje. Devuelve
// null con menos de tres puntos, porque con dos cualquier recta pasa exacta.
export function pendiente(ys: number[]): number | null {
  const n = ys.length
  if (n < 3) return null
  const mx = (n + 1) / 2
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  ys.forEach((y, k) => { const dx = (k + 1) - mx; num += dx * (y - my); den += dx * dx })
  return den === 0 ? null : num / den
}

// Filas planas para exportar a CSV, una por intento.
export function intentosACsv(intentos: IntentoRegistrado[], participante: string, operador: string): string {
  const cols = [
    'intento', 'participante', 'operador', 'pares', 'resultado', 'segundos', 'movimientos',
    'optimo', 'circuidad', 'eficiencia', 'ramificacion', 'tasaAcierto', 'puntosDecision', 'gradoLibertadMedio',
    'retornos', 'buclicidad', 'ciclosIndependientes', 'estadosDistintos', 'tamanosBucle', 'errores',
    'latenciaInicialMs', 'latenciaDecisionMs', 'latenciaForzadaMs',
  ]
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const num = (x: number, d = 4) => x.toFixed(d)
  const filas = intentos.map(i => [
    i.numero, participante || '(sin nombre)', operador || '(sin asignar)', i.pares, i.resultado,
    i.segundos, i.metricas.movimientos, i.metricas.optimo,
    i.resultado === 'victoria' ? num(i.metricas.circuidad) : '',
    i.resultado === 'victoria' ? num(i.metricas.eficiencia) : '',
    num(i.metricas.ramificacion), num(i.metricas.tasaAcierto), i.metricas.puntosDecision,
    num(i.metricas.gradoLibertadMedio, 2), i.metricas.retornos, num(i.metricas.buclicidad),
    i.metricas.ciclosIndependientes, i.metricas.estadosDistintos,
    i.metricas.tamanosBucle.join(' '), i.errores,
    i.metricas.latenciaInicial ?? '', i.metricas.latenciaDecision?.toFixed(0) ?? '',
    i.metricas.latenciaForzada?.toFixed(0) ?? '',
  ].map(esc).join(','))
  return [cols.join(','), ...filas].join('\n')
}
