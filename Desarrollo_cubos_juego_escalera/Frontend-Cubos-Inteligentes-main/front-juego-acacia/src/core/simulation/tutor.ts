// Motor pedagógico del tutorial de La Escalera: explica por qué un intento
// es inválido (en lenguaje para cualquier edad), sugiere la siguiente
// jugada y detecta cuándo una partida ya no puede ganarse, antes de llegar
// al bloqueo final. Las reglas en sí son las del libro (Figura 3.3), en
// laEscaleraRules.ts — aquí solo se interpretan.

import { type Board, type Team, legalMovesFor, applyMove, boardsEqual, undoesPreviousMove } from './laEscaleraRules'

export type MoveKind = 'deslizar' | 'saltar'
export type MoveError = 'ocupada' | 'lejos' | 'salto_propio' | 'salto_hueco' | 'regreso'

export type AttemptResult =
  | { ok: true; kind: MoveKind }
  | { ok: false; error: MoveError }

export const TEAM_NAME: Record<Team, { ficha: string; plural: string; hacia: string; flecha: string }> = {
  A: { ficha: 'azul', plural: 'azules', hacia: 'la derecha', flecha: '→' }, // lado al que deben llegar
  B: { ficha: 'roja', plural: 'rojas', hacia: 'la izquierda', flecha: '←' },
}

// Clasifica el intento de llevar la ficha de `from` a `to`. El orden de
// las comprobaciones importa: se reporta el motivo más evidente para quien
// juega (primero "está ocupada", luego "está lejos", etc.). `prev` es el
// tablero anterior (Regla 2: no se vuelve a la posición inmediatamente
// anterior); sin él solo se aplican las Reglas 1 y 3.
export function classifyAttempt(board: Board, from: number, to: number, prev?: Board | null): AttemptResult {
  const piece = board[from]
  if (!piece) return { ok: false, error: 'ocupada' }
  if (board[to] !== null) return { ok: false, error: 'ocupada' }
  const dist = Math.abs(to - from)
  if (dist > 2) return { ok: false, error: 'lejos' }
  if (dist === 2) {
    const middle = board[(from + to) / 2]
    if (middle === null) return { ok: false, error: 'salto_hueco' }
    if (middle.team === piece.team) return { ok: false, error: 'salto_propio' }
  }
  if (undoesPreviousMove(board, from, to, prev)) return { ok: false, error: 'regreso' }
  return { ok: true, kind: dist === 1 ? 'deslizar' : 'saltar' }
}

export function explainError(error: MoveError, team: Team): { titulo: string; texto: string } {
  const t = TEAM_NAME[team]
  switch (error) {
    case 'ocupada':
      return { titulo: 'Esa casilla ya tiene una ficha', texto: 'Solo puedes mover una ficha a la casilla vacía (la gris).' }
    case 'lejos':
      return { titulo: 'Demasiado lejos', texto: 'Una ficha se mueve 1 casilla (deslizar) o 2 casillas saltando por encima de otra (saltar). Nunca más de 2.' }
    case 'salto_propio':
      return { titulo: 'No se salta a tu propio color', texto: `Una ficha ${t.ficha} solo puede saltar por encima de una ficha del otro color.` }
    case 'salto_hueco':
      return { titulo: 'No hay nada que saltar', texto: 'La casilla de al lado está vacía: ahí se mueve deslizando de a una, no saltando.' }
    case 'regreso':
      return { titulo: 'No puedes volver a la posición anterior', texto: 'Esa jugada deshace la que acabas de hacer. Mueve otra ficha; más adelante sí podrás volver por otro camino.' }
  }
}

// Por qué una ficha concreta no tiene ningún movimiento en este momento.
export function whyNoMoves(board: Board, index: number, prev?: Board | null): string {
  const piece = board[index]!
  const t = TEAM_NAME[piece.team]
  const hole = board.indexOf(null)
  const dist = Math.abs(index - hole)
  if (dist > 2) return `Esta ficha ${t.ficha} está lejos de la casilla vacía: solo se mueve la que está pegada a ella, o a dos casillas si salta sobre una ficha del otro color.`
  if (dist === 2) {
    const middle = board[(index + hole) / 2]!
    if (middle.team === piece.team) return `Entre esta ficha ${t.ficha} y la casilla vacía hay otra de su mismo color: no se puede saltar sobre el propio color.`
    if (undoesPreviousMove(board, index, hole, prev)) return 'Esa jugada deshace la que acabas de hacer, y no se puede volver a la posición inmediatamente anterior.'
    return 'Entre esta ficha y la casilla vacía no hay una ficha del otro color que saltar.'
  }
  if (undoesPreviousMove(board, index, hole, prev)) return 'Esa jugada deshace la que acabas de hacer, y no se puede volver a la posición inmediatamente anterior.'
  return 'Esta ficha no puede moverse ahora.'
}

export function successText(kind: MoveKind, team: Team, hacia?: 'derecha' | 'izquierda'): string {
  const t = TEAM_NAME[team]
  const otro = TEAM_NAME[team === 'A' ? 'B' : 'A'].ficha
  const lado = hacia ? ` hacia la ${hacia}` : ''
  return kind === 'deslizar'
    ? `¡Bien! La ficha ${t.ficha} se deslizó una casilla${lado}.`
    : `¡Muy bien! La ficha ${t.ficha} saltó por encima de una ficha ${otro}${lado}.`
}

// La partida ganada más corta dura n² + 2n movimientos (verificado por BFS
// sobre las reglas del libro, n=1..5): cada par de fichas contrarias se cruza
// una vez (n² saltos) y el resto son 2n deslizamientos. Como ahora se puede
// ir y volver, una partida puede durar más; por eso el tutorial no premia
// "menos movimientos" sino jugar sin errores ni pistas.
export function optimalMoves(pares: number): number {
  return pares * pares + 2 * pares
}

type Move = { from: number; to: number }
const key = (b: Board) => b.map(c => c?.id ?? 0).join(',')

// Búsqueda en anchura desde `board` hasta `win`, respetando la Regla 2: el
// estado de la búsqueda es (tablero, tablero anterior), porque qué jugadas se
// pueden hacer depende de la anterior. `prev` es el tablero anterior real de
// quien juega (null al comienzo). El espacio es pequeño (unos pocos miles de
// estados para 5 pares), así que se puede recalcular tras cada jugada.
export function solve(board: Board, win: Board, prev?: Board | null): Move[] | null {
  if (boardsEqual(board, win)) return []
  const nodeKey = (b: Board, p: Board | null | undefined) => key(b) + '|' + (p ? key(p) : '')
  const start = nodeKey(board, prev)
  const parents = new Map<string, { parent: string; move: Move } | null>([[start, null]])
  const queue: { b: Board; p: Board | null; k: string }[] = [{ b: board, p: prev ?? null, k: start }]
  const winKey = key(win)
  for (let head = 0; head < queue.length; head++) {
    const { b, p, k } = queue[head]
    for (let from = 0; from < b.length; from++) {
      if (!b[from]) continue
      for (const to of legalMovesFor(b, from, p)) {
        const nb = applyMove(b, from, to)
        const kn = nodeKey(nb, b)
        if (parents.has(kn)) continue
        parents.set(kn, { parent: k, move: { from, to } })
        if (key(nb) === winKey) {
          const path: Move[] = []
          let cur = kn
          while (cur !== start) {
            const step = parents.get(cur)!
            path.unshift(step.move)
            cur = step.parent
          }
          return path
        }
        queue.push({ b: nb, p: b, k: kn })
      }
    }
  }
  return null
}

// ── Tutorial por niveles (1 a 5 pares) ─────────────────────────────────────
export const LEVELS: Record<number, { titulo: string; practica: string[]; consejo: string }> = {
  1: { titulo: 'Tu primer cambio', practica: ['Deslizar', 'Saltar'], consejo: 'Empieza deslizando una ficha hacia la casilla gris. Después, una de la otra fila podrá saltar por encima.' },
  2: { titulo: 'Dos por lado', practica: ['Alternar deslizar y saltar'], consejo: 'Después de cada salto queda un hueco nuevo: fíjate qué ficha puede ocuparlo.' },
  3: { titulo: 'Tres por lado', practica: ['Evitar bloqueos'], consejo: 'Cuidado con dejar dos fichas del mismo color juntas frente a la casilla gris: se tapan entre ellas. Y recuerda: no puedes deshacer de inmediato tu última jugada.' },
  4: { titulo: 'Cuatro por lado', practica: ['Seguir un ritmo'], consejo: 'Hay un ritmo: los saltos seguidos van aumentando (1, 2, 3…) y luego disminuyendo. Si lo encuentras, no te equivocas.' },
  5: { titulo: 'El juego completo', practica: ['Todo lo aprendido'], consejo: 'Es la versión real, cinco por lado, igual que en una sesión con los cubos: 35 movimientos si no te equivocas.' },
}

// Estrellas: lo que se premia es jugar sin errores, sin pistas y sin
// deshacer (el mínimo de movimientos es n² + 2n, pero no se exige).
export function starsFor(errors: number, hints: number, undos: number): number {
  const faltas = errors + hints + undos
  return faltas === 0 ? 3 : faltas <= 3 ? 2 : 1
}
