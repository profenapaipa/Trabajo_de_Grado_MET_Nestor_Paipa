// Reglas de La Escalera, tal como las enuncia el libro de Lina y Rafael en la
// interfaz original del juego (Trabajo_de_Grado_Lina_Rafael.pdf, Figura 3.3):
//
//   Regla 1. Al hacer clic sobre la ficha, esta se desplaza al espacio vacío,
//            si las siguientes reglas lo permiten. Caso contrario, se reinicia.
//   Regla 2. No puedes volver a la posición inmediatamente anterior.
//   Regla 3. Solo puedes saltar una pieza de color contrario.
//
// Tablero lineal de 2n+1 posiciones, n fichas de cada equipo (A = 1..n a la
// izquierda, B = n+1..2n a la derecha) y una casilla vacía. Una jugada siempre
// lleva una ficha a la casilla vacía: deslizándola desde una casilla vecina, o
// saltando por encima de UNA ficha del equipo contrario. Ningún equipo tiene
// una dirección fija: se puede ir y volver, y por eso el espacio de estados es
// un grafo no dirigido (el del libro, generado por Escalera.m). Lo único que
// no se puede es deshacer de inmediato la jugada anterior (Regla 2); volver a
// una posición anterior por otro camino sí se puede, y eso son los bucles.
//
// De la Regla 2 salen los "caminos sin retorno" del libro: un estado en el que
// la única jugada posible es volver a la posición anterior ("la única opción
// de movimiento sea infringir una regla"). En la implementación digital
// original violar una regla reinicia el juego; aquí la jugada se rechaza y se
// explica, y el intento termina (bloqueo) solo si no queda ninguna jugada
// permitida.
//
// Nota sobre Escalera.m: el script tiene dos condiciones de borde que hacen
// asimétricas algunas jugadas (no desliza hacia la última casilla derecha ni
// salta desde ella). No son reglas del juego —ninguna de las tres reglas del
// libro las menciona— y contradicen que el grafo sea no dirigido; el grafo
// no dirigido que dibuja el script es el mismo con o sin ellas. Aquí NO se
// aplican (ver stateGraph.ts, donde solo se usan para numerar los nodos igual
// que el libro).
//
// El estado meta (intercambio completo) deja a las fichas del equipo B a la
// izquierda, el hueco al centro y las de A a la derecha. La menor cantidad de
// movimientos para llegar es n² + 2n (verificado por BFS con estas reglas para
// n=1..5), pero ya no es la única longitud posible de una partida ganada.

export type Team = 'A' | 'B'

export type Piece = { id: number; team: Team }
export type Cell = Piece | null
export type Board = Cell[]

export function createInitialBoard(pairs: number): Board {
  const left: Board = Array.from({ length: pairs }, (_, i) => ({ id: i + 1, team: 'A' as Team }))
  const right: Board = Array.from({ length: pairs }, (_, i) => ({ id: pairs + i + 1, team: 'B' as Team }))
  return [...left, null, ...right]
}

export function computeWinBoard(initial: Board): Board {
  const pairs = (initial.length - 1) / 2
  const left = initial.slice(0, pairs)
  const right = initial.slice(pairs + 1)
  return [...right, null, ...left]
}

export function boardsEqual(a: Board, b: Board): boolean {
  if (a.length !== b.length) return false
  return a.every((cell, i) => (cell?.id ?? null) === (b[i]?.id ?? null))
}

export function applyMove(board: Board, from: number, to: number): Board {
  const next = [...board]
  next[to] = board[from]
  next[from] = null
  return next
}

// Reglas 1 y 3 solamente (sin historial): ¿puede la ficha en `index` ir a la
// casilla vacía? Desliza si es contigua; salta si está a dos casillas y entre
// ambas hay una ficha del equipo contrario.
function geometryAllows(board: Board, index: number): boolean {
  const piece = board[index]
  if (!piece) return false
  const hole = board.indexOf(null)
  if (hole < 0) return false
  const gap = Math.abs(index - hole)
  if (gap === 1) return true
  if (gap === 2) {
    const over = board[(index + hole) / 2]
    return over !== null && over.team !== piece.team
  }
  return false
}

// Regla 2: esa jugada deshace la inmediatamente anterior (deja el tablero
// como estaba antes de ella). `prev` es el tablero anterior, o null/undefined
// al comienzo del intento.
export function undoesPreviousMove(board: Board, from: number, to: number, prev?: Board | null): boolean {
  return !!prev && boardsEqual(applyMove(board, from, to), prev)
}

// Movimientos legales (índices destino) para la ficha en `index`: Reglas 1 y 3
// más la Regla 2 si se conoce el tablero anterior. El único destino posible es
// la casilla vacía, así que la lista tiene 0 o 1 elemento.
export function legalMovesFor(board: Board, index: number, prev?: Board | null): number[] {
  if (!geometryAllows(board, index)) return []
  const hole = board.indexOf(null)
  return undoesPreviousMove(board, index, hole, prev) ? [] : [hole]
}

export function allLegalMoves(board: Board, prev?: Board | null): { from: number; to: number }[] {
  const moves: { from: number; to: number }[] = []
  board.forEach((cell, i) => {
    if (!cell) return
    for (const to of legalMovesFor(board, i, prev)) moves.push({ from: i, to })
  })
  return moves
}

// Bloqueo: no se ha ganado y toda jugada posible está prohibida (incluye el
// "camino sin retorno" del libro: la única jugada es volver atrás).
export function isStuck(board: Board, winBoard: Board, prev?: Board | null): boolean {
  if (boardsEqual(board, winBoard)) return false
  return allLegalMoves(board, prev).length === 0
}

// ── Tablero físico (Control Mago de Oz) ────────────────────────────────────
// La base siempre tiene 11 posiciones (0-10) con los cubos 1-5 (equipo A) y
// 6-10 (equipo B). Para un ejercicio de n < 5 pares solo se juega en la
// ventana central de 2n+1 posiciones: los cubos de fuera de la ventana no
// participan y sus posiciones nunca tienen jugadas.

export const PHYSICAL_PAIRS = 5

export function physicalOffset(pares: number): number {
  return PHYSICAL_PAIRS - pares
}

// ids de cubo (0 = casilla vacía) -> Board del ejercicio de `pares` pares.
export function physicalWindow(ids: number[], pares: number): Board {
  return ids
    .slice(physicalOffset(pares), PHYSICAL_PAIRS + pares + 1)
    .map(id => (id === 0 ? null : { id, team: (id <= PHYSICAL_PAIRS ? 'A' : 'B') as Team }))
}

// Destinos legales (índices FÍSICOS 0-10) de la ficha en el índice físico
// `fullIndex`; `prevIds` son las posiciones asentadas anteriores (Regla 2).
export function physicalLegalMoves(ids: number[], pares: number, fullIndex: number, prevIds?: number[] | null): number[] {
  const off = physicalOffset(pares)
  const local = fullIndex - off
  if (local < 0 || local > 2 * pares) return []
  const prev = prevIds ? physicalWindow(prevIds, pares) : null
  return legalMovesFor(physicalWindow(ids, pares), local, prev).map(t => t + off)
}
