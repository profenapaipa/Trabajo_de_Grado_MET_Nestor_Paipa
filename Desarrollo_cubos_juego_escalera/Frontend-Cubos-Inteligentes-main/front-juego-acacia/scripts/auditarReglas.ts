// Auditoría exhaustiva de las reglas de La Escalera contra el libro de Lina y
// Rafael (Figura 3.3):
//   Regla 1. Al hacer clic sobre la ficha esta se desplaza al espacio vacío, si las reglas lo permiten.
//   Regla 2. No puedes volver a la posición inmediatamente anterior.
//   Regla 3. Solo puedes saltar una pieza de color contrario.
// Se compara la app contra una implementación literal e independiente de esas
// tres reglas, para TODOS los estados de n = 1..5 y TODOS los tableros
// anteriores posibles, además de partidas aleatorias completas y del grafo
// (que debe coincidir con el que dibuja Escalera.m).
// Uso: npm run reglas:auditar   (sale con error si algo no coincide)
import {
  type Board, type Team, createInitialBoard, computeWinBoard, allLegalMoves, applyMove, isStuck,
  legalMovesFor, physicalLegalMoves, physicalWindow, boardsEqual,
} from '../src/core/simulation/laEscaleraRules'
import { classifyAttempt, whyNoMoves, solve, optimalMoves } from '../src/core/simulation/tutor'
import { buildStateGraph, boardKey } from '../src/core/simulation/stateGraph'

type Vec = number[]
const vec = (b: Board): Vec => b.map(c => c?.id ?? 0)

// ── Implementación literal de las tres reglas del libro ────────────────────
// M: 0 = casilla vacía; 1..n equipo A; n+1..2n equipo B.
// Devuelve las fichas (índices) que pueden ir al hueco.
function libroJugadas(M: Vec, n: number, prev: Vec | null): { from: number; kind: 'deslizar' | 'saltar' }[] {
  const team = (v: number) => (v === 0 ? 0 : v <= n ? 1 : 2)
  const h = M.indexOf(0)
  const out: { from: number; kind: 'deslizar' | 'saltar' }[] = []
  for (const d of [-2, -1, 1, 2]) {
    const from = h + d
    if (from < 0 || from >= M.length) continue
    // Regla 3: solo se salta UNA ficha, y de color contrario
    if (Math.abs(d) === 2 && (M[h + d / 2] === 0 || team(M[h + d / 2]) === team(M[from]))) continue
    const T = M.slice(); T[h] = M[from]; T[from] = 0
    if (prev && T.join() === prev.join()) continue // Regla 2
    out.push({ from, kind: Math.abs(d) === 1 ? 'deslizar' : 'saltar' })
  }
  return out
}

// Réplica LITERAL de Escalera.m (con sus condiciones de borde): solo para
// comprobar que el grafo no dirigido y la numeración coinciden con el libro.
function mover(M: Vec, lado: number): Vec {
  const B = M.length, idx = M.indexOf(0) + 1
  if ((lado === 1 && (idx >= B || idx <= 1)) || (lado === 2 && idx >= B)) return M
  const nuevo = idx - 1 + (lado === 2 ? 2 : 0)
  const T = M.slice(); T[idx - 1] = M[nuevo - 1]; T[nuevo - 1] = 0; return T
}
function saltar(M: Vec, lado: number, NB: number): Vec {
  const B = M.length, idx = M.indexOf(0) + 1
  let ib: number, ibs: number
  if (lado === 1 && idx > 2) { ib = idx - 2; ibs = idx - 1 } else if (lado === 2 && idx < B - 2) { ib = idx + 2; ibs = idx + 1 } else return M
  const a = M[ib - 1], b = M[ibs - 1]
  const inA = (v: number) => v >= 1 && v <= NB, inB = (v: number) => v >= NB + 1 && v <= 2 * NB
  if ((inA(a) && inB(b)) || (inB(a) && inA(b))) { const T = M.slice(); T[idx - 1] = a; T[ib - 1] = 0; return T }
  return M
}
function matlabGraph(n: number) {
  const init: Vec = [...Array.from({ length: n }, (_, i) => i + 1), 0, ...Array.from({ length: n }, (_, i) => n + i + 1)]
  const states = [init]; const id = new Map([[init.join(), 1]]); const edges = new Set<string>()
  for (let r = 0; r < states.length; r++) {
    const M = states[r]
    for (const nx of [mover(M, 1), mover(M, 2), saltar(M, 1, n), saltar(M, 2, n)]) {
      if (nx.join() === M.join()) continue
      if (!id.has(nx.join())) { states.push(nx); id.set(nx.join(), states.length) }
      const a = r + 1, b = id.get(nx.join())!; edges.add(`${Math.min(a, b)}-${Math.max(a, b)}`)
    }
  }
  return { states, edges }
}

function toBoard(p: (Team | null)[], n: number): Board {
  let a = 0, b = 0
  return p.map(t => (t === null ? null : t === 'A' ? { id: ++a, team: 'A' as Team } : { id: n + ++b, team: 'B' as Team }))
}
function allBoards(n: number): Board[] {
  const out: Board[] = [], len = 2 * n + 1
  const rec = (pos: number, a: number, b: number, hole: boolean, acc: (Team | null)[]) => {
    if (pos === len) { if (hole && a === n && b === n) out.push(toBoard(acc, n)); return }
    if (a < n) rec(pos + 1, a + 1, b, hole, [...acc, 'A'])
    if (b < n) rec(pos + 1, a, b + 1, hole, [...acc, 'B'])
    if (!hole) rec(pos + 1, a, b, true, [...acc, null])
  }
  rec(0, 0, 0, false, [])
  return out
}
const boardFrom = (M: Vec, n: number): Board => M.map(v => (v === 0 ? null : { id: v, team: (v <= n ? 'A' : 'B') as Team }))

let fallos = 0
const fail = (msg: string) => { if (fallos++ < 20) console.error('FALLO:', msg) }
const same = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

// ── Caso del libro/usuario: 1 par, mover primero el azul ────────────────────
{
  const n = 1
  const start = createInitialBoard(n), win = computeWinBoard(start)
  const a1 = applyMove(start, 0, 1) // [_ A B]
  const saltoRojo = legalMovesFor(a1, 2, start) // la roja salta sobre la azul hacia la izquierda
  if (saltoRojo.join() !== '0') fail('1 par: tras mover el azul, la roja debe poder saltar al otro lado')
  const a2 = applyMove(a1, 2, 0) // [B A _]
  if (legalMovesFor(a2, 1, a1).join() !== '2') fail('1 par: tras el salto, la azul debe poder deslizar a la derecha')
  if (!boardsEqual(applyMove(a2, 1, 2), win)) fail('1 par: camino azul-primero no llega a la meta')
  const r1 = applyMove(start, 2, 1) // [A B _]  (la roja primero)
  const r2 = applyMove(r1, 0, 2) // la azul salta: [_ B A]
  if (!boardsEqual(applyMove(r2, 1, 0), win)) fail('1 par: camino rojo-primero no llega a la meta')
  if (legalMovesFor(a1, 1, start).length !== 0) fail('Regla 2: la azul no puede volver de inmediato')
  if (legalMovesFor(a1, 1, null).join() !== '0') fail('sin historial la azul sí puede volver')
}

for (let n = 1; n <= 5; n++) {
  const boards = allBoards(n), B = 2 * n + 1
  const win = computeWinBoard(createInitialBoard(n))
  let jugadas = 0, intentos = 0, combos = 0, bloqueos = 0
  const fullIds = (M: Vec) => {
    const off = 5 - n
    const f = Array.from({ length: 11 }, (_, i) => (i === 5 ? 0 : i < 5 ? i + 1 : i))
    M.forEach((v, i) => { f[off + i] = v === 0 ? 0 : v <= n ? 5 - n + v : 5 + (v - n) })
    return f
  }
  for (const bd of boards) {
    const M = vec(bd)
    // tableros anteriores posibles: ninguno + todos los vecinos (por Reglas 1 y 3, sin historial)
    const prevs: (Vec | null)[] = [null, ...libroJugadas(M, n, null).map(j => { const T = M.slice(); const h = M.indexOf(0); T[h] = M[j.from]; T[j.from] = 0; return T })]
    for (const pv of prevs) {
      combos++
      const prevB = pv ? boardFrom(pv, n) : null
      const esperado = libroJugadas(M, n, pv)
      const app = allLegalMoves(bd, prevB)
      if (!same(app.map(m => m.from), esperado.map(e => e.from)) || app.some(m => m.to !== M.indexOf(0))) fail(`n=${n} jugadas distintas ${M.join(',')} prev=${pv?.join(',') ?? '-'}`)
      jugadas += app.length
      // clasificador consistente para TODO par (from, to)
      for (let from = 0; from < B; from++) for (let to = 0; to < B; to++) {
        if (!bd[from] || from === to) continue
        intentos++
        const r = classifyAttempt(bd, from, to, prevB)
        const legal = to === M.indexOf(0) && esperado.some(e => e.from === from)
        if (r.ok !== legal) { fail(`n=${n} clasificador ok=${r.ok} legal=${legal} ${M.join(',')} prev=${pv?.join(',') ?? '-'} ${from}->${to}`); continue }
        const d = Math.abs(to - from)
        if (r.ok) { if (r.kind !== (d === 1 ? 'deslizar' : 'saltar')) fail('tipo de jugada') } else {
          const mid = d === 2 ? bd[(from + to) / 2] : undefined
          const motivo = bd[to] !== null ? 'ocupada' : d > 2 ? 'lejos' : d === 2 && mid === null ? 'salto_hueco' : d === 2 && mid!.team === bd[from]!.team ? 'salto_propio' : 'regreso'
          if (r.error !== motivo) fail(`n=${n} motivo ${r.error} != ${motivo} ${M.join(',')} ${from}->${to}`)
        }
      }
      bd.forEach((c, i) => { if (c && legalMovesFor(bd, i, prevB).length === 0 && !whyNoMoves(bd, i, prevB)) fail('whyNoMoves vacío') })
      const stuckEsperado = esperado.length === 0 && !boardsEqual(bd, win)
      if (isStuck(bd, win, prevB) !== stuckEsperado) fail(`n=${n} isStuck ${M.join(',')} prev=${pv?.join(',') ?? '-'}`)
      if (stuckEsperado) bloqueos++
      // tablero físico de 11 posiciones: la ventana central juega con las mismas reglas
      const off = 5 - n, fisico = fullIds(M), fisicoPrev = pv ? fullIds(pv) : null
      for (let f = 0; f < 11; f++) {
        const got = physicalLegalMoves(fisico, n, f, fisicoPrev)
        const loc = f - off
        const want = loc >= 0 && loc <= 2 * n && esperado.some(e => e.from === loc) ? [M.indexOf(0) + off] : []
        if (got.join() !== want.join()) fail(`n=${n} físico f=${f} ${fisico.join(',')} got=${got} want=${want}`)
      }
    }
    if (physicalWindow(fullIds(M), n).map(c => c?.team ?? '_').join('') !== bd.map(c => c?.team ?? '_').join('')) fail('ventana física')
  }

  // Grafo: mismo grafo no dirigido y misma numeración que Escalera.m
  const g = buildStateGraph(n), m = matlabGraph(n)
  if (g.nodes.length !== m.states.length || g.edges.length !== m.edges.size) fail(`n=${n} tamaño del grafo ${g.nodes.length}/${m.states.length} ${g.edges.length}/${m.edges.size}`)
  g.nodes.forEach((nd, i) => { if (boardKey(nd.board) !== m.states[i].join(',')) fail(`n=${n} ID ${i + 1} distinto del .m`) })
  g.edges.forEach(e => { if (!m.edges.has(`${e.a}-${e.b}`)) fail(`n=${n} arista ${e.a}-${e.b} no está en el .m`) })
  // cada arista es una jugada de las reglas del libro, recorrible en los dos sentidos
  g.edges.forEach(e => {
    const A = vec(g.nodes[e.a - 1].board), Bv = vec(g.nodes[e.b - 1].board)
    const ab = libroJugadas(A, n, null).some(j => { const T = A.slice(); T[A.indexOf(0)] = A[j.from]; T[j.from] = 0; return T.join() === Bv.join() })
    const ba = libroJugadas(Bv, n, null).some(j => { const T = Bv.slice(); T[Bv.indexOf(0)] = Bv[j.from]; T[j.from] = 0; return T.join() === A.join() })
    if (!ab || !ba) fail(`n=${n} arista ${e.a}-${e.b} no es reversible según las reglas del libro`)
  })
  let aristasEsperadas = 0
  g.nodes.forEach(nd => { aristasEsperadas += libroJugadas(vec(nd.board), n, null).length })
  if (aristasEsperadas !== 2 * g.edges.length) fail(`n=${n} grados ${aristasEsperadas} != 2*aristas`)

  // distancias al Fin por arcos: contra una búsqueda independiente en (tablero, anterior)
  const bfs = (M: Vec, pv: Vec | null): number => {
    const finKey = vec(win).join()
    if (M.join() === finKey) return 0
    const seen = new Set<string>([M.join() + '|' + (pv?.join() ?? '')]); let frontier: [Vec, Vec | null][] = [[M, pv]]
    for (let d = 1; frontier.length; d++) {
      const nextF: [Vec, Vec | null][] = []
      for (const [X, P] of frontier) for (const j of libroJugadas(X, n, P)) {
        const T = X.slice(); T[X.indexOf(0)] = X[j.from]; T[j.from] = 0
        if (T.join() === finKey) return d
        const k = T.join() + '|' + X.join()
        if (!seen.has(k)) { seen.add(k); nextF.push([T, X]) }
      }
      frontier = nextF
    }
    return -1
  }
  let arcosProbados = 0
  const probar = (cur: number, prev: number) => {
    const Mc = vec(g.nodes[cur - 1].board), Mp = prev ? vec(g.nodes[prev - 1].board) : null
    const esp = bfs(Mc, Mp), got = g.distFinDesde(cur, prev)
    arcosProbados++
    if (esp !== got) fail(`n=${n} distFin(${cur},${prev}) got=${got} esp=${esp}`)
    // solve (tutor) coincide y su ruta es jugable con las reglas literales
    const path = solve(boardFrom(Mc, n), win, Mp ? boardFrom(Mp, n) : null)
    if ((path ? path.length : -1) !== esp) fail(`n=${n} solve ${path?.length} != ${esp} en ${Mc.join(',')}`)
    if (path) {
      let X = Mc, P = Mp
      for (const st of path) {
        const j = libroJugadas(X, n, P).find(q => q.from === st.from && X.indexOf(0) === st.to)
        if (!j) { fail(`n=${n} ruta de solve ilegal`); break }
        const T = X.slice(); T[st.to] = X[st.from]; T[st.from] = 0; P = X; X = T
      }
      if (X.join() !== vec(win).join()) fail(`n=${n} la ruta de solve no llega a la meta`)
    }
  }
  const todosNodos = g.nodes.map(x => x.id)
  const muestra = n <= 3 ? todosNodos : Array.from({ length: 150 }, (_, i) => todosNodos[(i * 7919) % todosNodos.length])
  for (const id of muestra) { probar(id, 0); for (const p of libroJugadas(vec(g.nodes[id - 1].board), n, null).map(j => { const M = vec(g.nodes[id - 1].board); const T = M.slice(); T[M.indexOf(0)] = M[j.from]; T[j.from] = 0; return g.nodeIdOf(boardFrom(T, n)) })) probar(id, p) }
  if (g.distFinDesde(1, 0) !== optimalMoves(n)) fail(`n=${n} mínimo ${g.distFinDesde(1, 0)} != ${optimalMoves(n)}`)

  // partidas aleatorias completas (app vs libro paso a paso)
  let victorias = 0, derrotas = 0, pasos = 0
  let seed = 99 + n; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
  for (let juego = 0; juego < 600; juego++) {
    let X = vec(createInitialBoard(n)), P: Vec | null = null
    for (let t = 0; t < 600; t++) {
      const bd = boardFrom(X, n), pb = P ? boardFrom(P, n) : null
      if (boardsEqual(bd, win)) { victorias++; break }
      const js = libroJugadas(X, n, P)
      const app = allLegalMoves(bd, pb)
      if (!same(app.map(m => m.from), js.map(j => j.from))) { fail(`n=${n} partida: jugadas distintas en ${X.join(',')}`); break }
      if (js.length === 0) { derrotas++; if (!isStuck(bd, win, pb)) fail('partida: bloqueo no detectado'); break }
      const j = js[Math.floor(rnd() * js.length)]
      const T = X.slice(); T[X.indexOf(0)] = X[j.from]; T[j.from] = 0; P = X; X = T; pasos++
    }
  }
  console.log(`n=${n}: ${boards.length} estados × ${combos / boards.length | 0} historiales promedio = ${combos} combinaciones, ${jugadas} jugadas y ${intentos} intentos (de,a) verificados; ${bloqueos} bloqueos; grafo ${g.nodes.length} nodos / ${g.edges.length} aristas (Fin=${g.finId}); ${arcosProbados} distancias al Fin contrastadas; 600 partidas aleatorias (${victorias} victorias, ${derrotas} bloqueos, ${pasos} pasos)`)
}
if (fallos) { console.error(`\n${fallos} fallos`); process.exit(1) }
console.log('\nAUDITORÍA OK: las reglas de la app coinciden con las tres reglas del libro (Fig. 3.3) y el grafo con el de Escalera.m.')
