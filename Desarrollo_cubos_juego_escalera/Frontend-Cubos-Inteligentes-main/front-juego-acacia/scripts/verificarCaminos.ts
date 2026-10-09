// Comprueba las propiedades métricas del grafo de estados de La Escalera:
// las que la tesis publica en la Tabla «Propiedades métricas del grafo de
// estados» (sección 3.3) y, sobre todo, la que obliga a formular las métricas
// como están formuladas: la solución mínima NO es única.
//
// El antecedente es Hinz, Klavžar, Milutinović, Parisse y Petr (2005),
// «Metric properties of the Tower of Hanoi graphs and Stern’s diatomic
// sequence»: en los grafos de Hanói hay a lo sumo DOS caminos mínimos entre
// dos estados cualesquiera, y los únicos estados desde los que la solución
// más corta es única hacia todos los demás son los estados perfectos
// (Corolario 3.7). Aquí se verifica qué ocurre en La Escalera:
//
//   · del Inicio al Fin hay exactamente dos recorridos mínimos, y la simetría
//     del tablero (invertirlo y cambiar de equipo cada ficha) lleva el uno en
//     el otro;
//   · el único estado de esos recorridos en el que hay que elegir es el
//     Inicio: después, cada movimiento mínimo es forzado;
//   · la Regla 2 no encarece la solución: el mínimo sigue siendo n² + 2n;
//   · entre pares cualesquiera de estados, en cambio, puede haber muchos más
//     de dos caminos mínimos, de modo que el resultado de Hanói NO se hereda.
//
// Si alguno de estos números cambiara, cambiarían afirmaciones del documento:
// por eso se comprueban en cada compilación.

import { buildStateGraph } from '../src/core/simulation/stateGraph'
import type { Board, Team } from '../src/core/simulation/laEscaleraRules'

type Esperado = {
  optimo: number; diametro: number; radio: number; excInicio: number
  distanciaMedia: string; caminosMinimos: number; multiplicidadMaxima: number
}

// Los mismos valores que aparecen en la tesis.
const ESPERADO: Record<number, Esperado> = {
  1: { optimo: 3, diametro: 3, radio: 3, excInicio: 3, distanciaMedia: '1.80', caminosMinimos: 2, multiplicidadMaxima: 2 },
  2: { optimo: 8, diametro: 10, radio: 6, excInicio: 8, distanciaMedia: '4.14', caminosMinimos: 2, multiplicidadMaxima: 8 },
  3: { optimo: 15, diametro: 19, radio: 11, excInicio: 16, distanciaMedia: '7.10', caminosMinimos: 2, multiplicidadMaxima: 42 },
  4: { optimo: 24, diametro: 30, radio: 16, excInicio: 26, distanciaMedia: '10.58', caminosMinimos: 2, multiplicidadMaxima: 450 },
  5: { optimo: 35, diametro: 43, radio: 23, excInicio: 38, distanciaMedia: '14.44', caminosMinimos: 2, multiplicidadMaxima: 1350 },
}

let fallos = 0
const chk = (cond: boolean, msg: string) => { if (!cond) { fallos++; console.log('  FALLO · ' + msg) } }

console.log('')
console.log(' n | D*=n²+2n | diámetro | radio | exc(Inicio) | dist. media | rutas mínimas | máx. caminos mínimos entre dos estados')
console.log('---|----------|----------|-------|-------------|-------------|---------------|---------------------------------------')

for (let n = 1; n <= 5; n++) {
  const g = buildStateGraph(n)
  const N = g.nodes.length
  const adj = g.nodes.map(x => g.vecinos(x.id))
  const e = ESPERADO[n]

  // Recorrido en anchura (Dijkstra con pesos unitarios) contando caminos mínimos.
  const bfs = (s: number) => {
    const d = new Array<number>(N + 1).fill(-1)
    const c = new Array<number>(N + 1).fill(0)
    d[s] = 0; c[s] = 1
    const q = [s]
    for (let h = 0; h < q.length; h++) {
      const u = q[h]
      for (const v of adj[u - 1]) {
        if (d[v] < 0) { d[v] = d[u] + 1; c[v] = c[u]; q.push(v) }
        else if (d[v] === d[u] + 1) c[v] += c[u]
      }
    }
    return { d, c }
  }

  let diametro = 0, radio = Infinity, suma = 0, pares = 0, multMax = 0, paresVarios = 0
  for (let s = 1; s <= N; s++) {
    const { d, c } = bfs(s)
    let exc = 0
    for (let t = 1; t <= N; t++) if (d[t] > exc) exc = d[t]
    if (exc > diametro) diametro = exc
    if (exc < radio) radio = exc
    for (let t = s + 1; t <= N; t++) {
      suma += d[t]; pares++
      if (c[t] > multMax) multMax = c[t]
      if (c[t] > 1) paresVarios++
    }
  }
  const { d: dIni, c: cIni } = bfs(g.inicioId)
  const { d: dFin } = bfs(g.finId)
  const D = dIni[g.finId]
  const media = (suma / pares).toFixed(2)

  chk(D === n * n + 2 * n, `n=${n}: d(Inicio, Fin) = ${D}, pero D*(n) = n²+2n = ${n * n + 2 * n}`)
  chk(D === e.optimo, `n=${n}: D* = ${D} ≠ ${e.optimo} (valor publicado)`)
  chk(diametro === e.diametro, `n=${n}: diámetro = ${diametro} ≠ ${e.diametro} (valor publicado)`)
  chk(radio === e.radio, `n=${n}: radio = ${radio} ≠ ${e.radio} (valor publicado)`)
  chk(Math.max(...dIni.slice(1)) === e.excInicio, `n=${n}: exc(Inicio) = ${Math.max(...dIni.slice(1))} ≠ ${e.excInicio} (publicado)`)
  chk(media === e.distanciaMedia, `n=${n}: distancia media = ${media} ≠ ${e.distanciaMedia} (valor publicado)`)
  chk(multMax === e.multiplicidadMaxima, `n=${n}: multiplicidad máxima = ${multMax} ≠ ${e.multiplicidadMaxima} (publicado)`)
  // La meta no es el estado más lejano del Inicio: se puede estar peor que al empezar.
  chk(e.excInicio >= D, `n=${n}: la excentricidad del Inicio (${e.excInicio}) debería ser al menos D* (${D})`)

  // ── Las dos rutas mínimas ────────────────────────────────────────────────
  chk(cIni[g.finId] === e.caminosMinimos, `n=${n}: caminos mínimos Inicio→Fin = ${cIni[g.finId]} ≠ ${e.caminosMinimos}`)
  const rm = g.rutasMinimas
  chk(rm.caminos === cIni[g.finId], `n=${n}: buildStateGraph cuenta ${rm.caminos} rutas mínimas y el recuento directo ${cIni[g.finId]}`)
  // Dos recorridos que solo comparten los extremos: 2·D* aristas y 2·D* nodos.
  chk(rm.aristas.size === 2 * D, `n=${n}: aristas en rutas mínimas = ${rm.aristas.size}, se esperaban ${2 * D}`)
  chk(rm.nodos.size === 2 * D, `n=${n}: nodos en rutas mínimas = ${rm.nodos.size}, se esperaban ${2 * D}`)

  // El único punto de decisión de una partida mínima es el Inicio.
  const bifurcaciones: number[] = []
  for (const s of rm.nodos) {
    const sig = adj[s - 1].filter(v => dIni[v] === dIni[s] + 1 && dIni[v] + dFin[v] === D)
    if (sig.length > 1) bifurcaciones.push(s)
  }
  chk(bifurcaciones.length === 1 && bifurcaciones[0] === g.inicioId,
    `n=${n}: una partida mínima debería tener un solo punto de decisión (el Inicio) y tiene ${bifurcaciones.length}`)

  // La simetría del tablero: invertirlo y cambiar de equipo cada ficha.
  const canon = (equipos: (Team | null)[]): Board => {
    let a = 0, b = 0
    return equipos.map(t => (t === null ? null : t === 'A'
      ? { id: ++a, team: 'A' as Team }
      : { id: n + ++b, team: 'B' as Team }))
  }
  const refl = (id: number): number => g.nodeIdOf(canon(
    g.nodes[id - 1].board.map(c => c?.team ?? null).reverse()
      .map(t => (t === null ? null : t === 'A' ? 'B' as Team : 'A' as Team))))
  const esAutomorfismo = g.nodes.every(x => {
    const r = refl(x.id)
    if (r < 0) return false
    const vecinosReflejados = new Set(adj[x.id - 1].map(refl))
    return adj[r - 1].length === vecinosReflejados.size && adj[r - 1].every(v => vecinosReflejados.has(v))
  })
  chk(esAutomorfismo, `n=${n}: invertir el tablero y cambiar de equipo las fichas no resultó ser una simetría del grafo`)
  chk(refl(g.inicioId) === g.inicioId && refl(g.finId) === g.finId,
    `n=${n}: la simetría debería dejar fijos el Inicio y el Fin`)

  // …y esa simetría intercambia las dos rutas mínimas.
  const minimos: number[][] = []
  const rec = (u: number, acc: number[]) => {
    if (u === g.finId) { minimos.push([...acc]); return }
    for (const v of adj[u - 1]) if (dIni[v] === dIni[u] + 1 && dIni[v] + dFin[v] === D) { acc.push(v); rec(v, acc); acc.pop() }
  }
  rec(g.inicioId, [g.inicioId])
  chk(minimos.length === 2 && minimos[0].map(refl).join() === minimos[1].join(),
    `n=${n}: las dos rutas mínimas deberían ser reflejo una de la otra`)

  // La Regla 2 no encarece la solución: mismo mínimo sobre arcos (prev, cur).
  const conRegla2 = g.distFinDesde(g.inicioId, 0)
  chk(conRegla2 === D, `n=${n}: con la Regla 2 el mínimo es ${conRegla2} y sin ella ${D}`)

  const porc = (100 * paresVarios / pares).toFixed(1)
  console.log(` ${n} |    ${String(D).padEnd(5)} |    ${String(diametro).padEnd(5)} |  ${String(radio).padEnd(4)} |     ${String(e.excInicio).padEnd(7)} |    ${media.padEnd(8)} |       ${rm.caminos}       | ${multMax}  (${porc} % de los pares tiene más de uno)`)
}

console.log('')
if (fallos) {
  console.log(`>>> ${fallos} FALLOS en las propiedades métricas del grafo`)
  process.exit(1)
}
console.log('CAMINOS OK: D* = n²+2n se alcanza por exactamente dos recorridos, reflejo uno del otro; el único')
console.log('punto de decisión de una partida mínima es el Inicio; la Regla 2 no encarece la solución; y, a')
console.log('diferencia de los grafos de Hanói, entre dos estados cualesquiera puede haber más de dos caminos mínimos.')
