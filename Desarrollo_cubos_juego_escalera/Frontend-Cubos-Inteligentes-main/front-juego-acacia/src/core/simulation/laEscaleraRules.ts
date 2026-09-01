// Reglas de La Escalera, tomadas de main.tex ("El juego La Escalera como
// problema matemático bien definido", líneas 559-595): tablero lineal de
// 2n+1 posiciones, n fichas de cada equipo, una vacía. Cada ficha solo
// avanza hacia el lado contrario (unidireccional, sin retrocesos) por dos
// operadores: deslizar a la casilla vacía adyacente, o saltar sobre una
// ficha del equipo contrario si la casilla siguiente está vacía.
//
// El estado meta (intercambio completo) se verificó contra el nodo 2771 del
// grafo precalculado del proyecto (EstadosGrafo.csv, caso n=5): las fichas
// del equipo derecho terminan ocupando el extremo izquierdo en su mismo
// orden relativo, las del equipo izquierdo el tramo siguiente, y la casilla
// vacía termina en el extremo derecho. Esa misma regla generaliza para
// cualquier n (verificado a mano también para n=1).
//
// "Derrota" (bloqueo sin movimientos legales) no está definida en ningún
// documento del proyecto; su inclusión aquí fue una decisión explícita del
// autor tomada en la sesión que aprobó esta simulación, no una regla
// preexistente en el código o la tesis.

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
  return [...right, ...left, null]
}

export function boardsEqual(a: Board, b: Board): boolean {
  if (a.length !== b.length) return false
  return a.every((cell, i) => (cell?.id ?? null) === (b[i]?.id ?? null))
}

// Movimientos legales (índices destino) para la ficha en `index`, según los
// dos operadores del juego y la dirección fija de cada equipo.
export function legalMovesFor(board: Board, index: number): number[] {
  const piece = board[index]
  if (!piece) return []
  const dir = piece.team === 'A' ? 1 : -1
  const dest: number[] = []

  const slideTo = index + dir
  if (board[slideTo] === undefined) {
    // fuera de tablero, sin movimiento
  } else if (board[slideTo] === null) {
    dest.push(slideTo)
  } else if (board[slideTo]!.team !== piece.team) {
    const jumpTo = index + dir * 2
    if (board[jumpTo] === null) dest.push(jumpTo)
  }

  return dest
}

export function allLegalMoves(board: Board): { from: number; to: number }[] {
  const moves: { from: number; to: number }[] = []
  board.forEach((cell, i) => {
    if (!cell) return
    for (const to of legalMovesFor(board, i)) moves.push({ from: i, to })
  })
  return moves
}

export function isStuck(board: Board, winBoard: Board): boolean {
  if (boardsEqual(board, winBoard)) return false
  return allLegalMoves(board).length === 0
}

export function applyMove(board: Board, from: number, to: number): Board {
  const next = [...board]
  next[to] = board[from]
  next[from] = null
  return next
}
