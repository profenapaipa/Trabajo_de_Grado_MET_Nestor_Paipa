// Grafo de estados de La Escalera para n = 1..5 pares: el grafo NO DIRIGIDO que
// dibuja Escalera.m (carpeta Grafos/) y que aparece en el libro de Lina y
// Rafael. Cada nodo es una disposición del tablero; cada arista, una jugada
// posible (que siempre se puede recorrer en los dos sentidos: el libro dice
// "La Escalera tiene un grafo no dirigido. Es decir, permite retornar a estados
// anteriores").
//
// Numeración: los IDs (1-based) replican el orden en que Escalera.m descubre
// los estados, para que Inicio sea el 1 y, por ejemplo, el Fin de n=2 sea el
// 26 como en la figura del libro. Ese orden depende de dos condiciones de borde
// del script que NO son reglas del juego (ver laEscaleraRules.ts), así que
// solo se usan aquí para numerar; las aristas salen de las reglas del libro y
// son las mismas (se verifica en scripts/auditarReglas.ts).
//
// La Regla 2 (no volver a la posición inmediatamente anterior) hace que lo que
// se puede hacer dependa de la jugada anterior; por eso las distancias al Fin
// se calculan sobre "arcos" (de dónde vengo, dónde estoy), no solo sobre nodos.

import {
  type Board, createInitialBoard, computeWinBoard, legalMovesFor, applyMove,
} from './laEscaleraRules'

export type GraphNode = {
  id: number // 1-based, como en el .m
  board: Board
  grado: number // jugadas posibles sin contar la Regla 2
  distInicio: number // movimientos mínimos desde el Inicio
  // "Camino sin retorno" del libro: solo tiene una jugada (volver atrás), así
  // que quien llegue aquí queda bloqueado. No incluye el Fin.
  bloqueo: boolean
  // Desde aquí ya no se puede ganar sin importar de dónde se llegue (incluye
  // los bloqueos y los pasillos que solo llevan a ellos).
  sinSalida: boolean
}

export type GraphEdge = { index: number; a: number; b: number } // a < b

export type StateGraph = {
  n: number
  nodes: GraphNode[] // nodes[id - 1]
  edges: GraphEdge[]
  inicioId: number
  finId: number
  nodeIdOf: (board: Board) => number
  edgeIndexOf: (idA: number, idB: number) => number
  // Movimientos mínimos para ganar estando en `cur` habiendo llegado desde
  // `prev` (id de nodo, o 0/undefined si no hay historial), respetando la Regla 2.
  // -1 si desde ahí ya no se puede ganar.
  distFinDesde: (cur: number, prev?: number) => number
  // Estados a los que se puede ir desde `cur` (sin aplicar la Regla 2): son los
  // grados de libertad de esa posición una vez se descuenta el estado anterior.
  vecinos: (cur: number) => number[]
  // Las rutas mínimas del Inicio al Fin. No hay una sola: son dos, imagen
  // especular la una de la otra (ver abajo).
  rutasMinimas: RutasMinimas
}

// Conjunto de estados y de aristas que están en ALGUNA ruta mínima del Inicio
// al Fin, y cuántas rutas mínimas distintas hay.
//
// Que sean varias no es un detalle: en los grafos de la Torre de Hanói, entre
// dos estados cualesquiera hay a lo sumo dos caminos mínimos, y los únicos
// estados desde los que la solución más corta es única son los estados
// perfectos (Hinz, Klavžar, Milutinović, Parisse y Petr, 2005, Cor. 3.7). En
// La Escalera ocurre lo propio en el punto que importa: del Inicio al Fin hay
// exactamente dos recorridos de longitud n² + 2n, intercambiados por la
// simetría del tablero (invertirlo y cambiar de equipo cada ficha). Por eso
// ninguna métrica de este proyecto compara el recorrido del aprendiz contra
// «la» ruta óptima: todas se calculan con longitudes y distancias, que no
// dependen de cuál de las dos se tome.
export type RutasMinimas = { nodos: Set<number>; aristas: Set<number>; caminos: number }

export const boardKey = (b: Board) => b.map(c => c?.id ?? 0).join(',')

// Vecinos de un tablero según las reglas del libro (sin Regla 2): las fichas
// que pueden ir a la casilla vacía.
function neighbors(board: Board): Board[] {
  const hole = board.indexOf(null)
  const out: Board[] = []
  for (const off of [-1, 1, -2, 2]) {
    const from = hole + off
    if (from < 0 || from >= board.length) continue
    if (legalMovesFor(board, from).includes(hole)) out.push(applyMove(board, from, hole))
  }
  return out
}

// Orden de descubrimiento de Escalera.m (solo para numerar). Replica sus
// acciones mover(1), mover(2), saltar(1), saltar(2) con sus condiciones de
// borde literales.
function matlabOrder(n: number): Board[] {
  const initial = createInitialBoard(n)
  const B = initial.length
  const boards: Board[] = [initial]
  const seen = new Set<string>([boardKey(initial)])
  for (let i = 0; i < boards.length; i++) {
    const cur = boards[i]
    const hole = cur.indexOf(null)
    const idx = hole + 1 // 1-based, como en el .m
    const candidates: number[] = [] // índices 0-based de la ficha que ocupa el hueco
    if (!(idx >= B || idx <= 1)) candidates.push(hole - 1) // mover(1)
    if (!(idx >= B)) candidates.push(hole + 1) // mover(2)
    for (const [lado, off] of [[1, -2], [2, 2]] as const) { // saltar(1), saltar(2)
      if (lado === 1 ? !(idx > 2) : !(idx < B - 2)) continue
      const from = hole + off
      const over = cur[hole + off / 2]
      if (over && cur[from] && over.team !== cur[from]!.team) candidates.push(from)
    }
    for (const from of candidates) {
      const nb = applyMove(cur, from, hole)
      const k = boardKey(nb)
      if (!seen.has(k)) { seen.add(k); boards.push(nb) }
    }
  }
  return boards
}

const cache = new Map<number, StateGraph>()

export function buildStateGraph(n: number): StateGraph {
  const hit = cache.get(n)
  if (hit) return hit

  const boards = matlabOrder(n)
  const N = boards.length
  const idByKey = new Map<string, number>(boards.map((b, i) => [boardKey(b), i + 1]))
  const idOf = (b: Board) => idByKey.get(boardKey(b)) ?? -1

  const adj: number[][] = boards.map(b => neighbors(b).map(idOf)) // ids 1-based
  const edges: GraphEdge[] = []
  const edgeIdx = new Map<string, number>()
  adj.forEach((ns, i) => ns.forEach(j => {
    const a = i + 1
    if (a < j) { edgeIdx.set(`${a}-${j}`, edges.length); edges.push({ index: edges.length, a, b: j }) }
  }))

  const inicioId = 1
  const finId = idOf(computeWinBoard(createInitialBoard(n)))

  // Distancia desde el Inicio (BFS simple sobre el grafo no dirigido).
  const dist = new Array<number>(N + 1).fill(-1)
  dist[inicioId] = 0
  const q = [inicioId]
  for (let h = 0; h < q.length; h++) {
    const u = q[h]
    for (const v of adj[u - 1]) if (dist[v] < 0) { dist[v] = dist[u] + 1; q.push(v) }
  }

  // Distancia al Fin sobre arcos (cur, prev): BFS inverso desde el Fin. Desde
  // (v, p) se puede pasar a (w, v) para todo vecino w de v distinto de p
  // (Regla 2: no se vuelve de inmediato a p).
  const arcKey = (cur: number, prev: number) => cur * (N + 1) + prev
  const arcDist = new Map<number, number>()
  const queue: [number, number][] = []
  for (const p of adj[finId - 1]) { arcDist.set(arcKey(finId, p), 0); queue.push([finId, p]) }
  for (let h = 0; h < queue.length; h++) {
    const [w, v] = queue[h]
    const d = arcDist.get(arcKey(w, v))!
    for (const p of adj[v - 1]) {
      if (p === w) continue
      const k = arcKey(v, p)
      if (!arcDist.has(k)) { arcDist.set(k, d + 1); queue.push([v, p]) }
    }
  }
  const distFinDesde = (cur: number, prev = 0): number => {
    if (cur === finId) return 0
    if (prev !== 0) return arcDist.get(arcKey(cur, prev)) ?? -1
    // sin historial (comienzo del intento): se puede ir a cualquier vecino
    let best = -1
    for (const w of adj[cur - 1]) {
      const d = arcDist.get(arcKey(w, cur))
      if (d !== undefined && (best < 0 || d + 1 < best)) best = d + 1
    }
    return best
  }

  // Rutas mínimas Inicio → Fin. Distancia al Fin en el grafo simple (sin la
  // Regla 2) y conteo de caminos mínimos por capas: un estado está en una ruta
  // mínima si d(Inicio, s) + d(s, Fin) = d(Inicio, Fin). La Regla 2 no cambia
  // nada aquí —los dos recorridos mínimos la respetan— y se comprueba en
  // scripts/verificarCaminos.ts.
  const distF = new Array<number>(N + 1).fill(-1)
  distF[finId] = 0
  const qf = [finId]
  for (let h = 0; h < qf.length; h++) {
    const u = qf[h]
    for (const v of adj[u - 1]) if (distF[v] < 0) { distF[v] = distF[u] + 1; qf.push(v) }
  }
  const D = dist[finId]
  const nodosMin = new Set<number>()
  const aristasMin = new Set<number>()
  const caminosHasta = new Array<number>(N + 1).fill(0)
  caminosHasta[inicioId] = 1
  const enRuta = (id: number) => dist[id] >= 0 && distF[id] >= 0 && dist[id] + distF[id] === D
  const porCapa = [...Array(N).keys()].map(i => i + 1).filter(enRuta).sort((a, b) => dist[a] - dist[b])
  for (const u of porCapa) {
    nodosMin.add(u)
    for (const v of adj[u - 1]) {
      if (!enRuta(v) || dist[v] !== dist[u] + 1) continue
      aristasMin.add(edgeIdx.get(u < v ? `${u}-${v}` : `${v}-${u}`)!)
      caminosHasta[v] += caminosHasta[u]
    }
  }
  const rutasMinimas: RutasMinimas = { nodos: nodosMin, aristas: aristasMin, caminos: caminosHasta[finId] }

  const nodes: GraphNode[] = boards.map((board, i) => {
    const id = i + 1
    const sinSalida = id !== finId && adj[i].every(p => distFinDesde(id, p) < 0)
    return {
      id, board, grado: adj[i].length, distInicio: dist[id],
      bloqueo: id !== finId && adj[i].length <= 1, sinSalida,
    }
  })

  const graph: StateGraph = {
    n, nodes, edges, inicioId, finId,
    nodeIdOf: idOf,
    edgeIndexOf: (x, y) => edgeIdx.get(x < y ? `${x}-${y}` : `${y}-${x}`) ?? -1,
    distFinDesde,
    vecinos: (cur) => adj[cur - 1] ?? [],
    rutasMinimas,
  }
  cache.set(n, graph)
  return graph
}
