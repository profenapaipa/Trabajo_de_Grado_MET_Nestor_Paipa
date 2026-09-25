// Motor pedagógico del tutorial de La Escalera: explica por qué un intento
// es inválido (en lenguaje para cualquier edad), sugiere la siguiente
// jugada y detecta cuándo una partida ya no puede ganarse, antes de llegar
// al bloqueo final. Las reglas en sí siguen siendo las de
// laEscaleraRules.ts — aquí solo se interpretan.

import { type Board, type Team, legalMovesFor, applyMove, boardsEqual } from './laEscaleraRules'

export type MoveKind = 'deslizar' | 'saltar'
export type MoveError = 'ocupada' | 'atras' | 'lejos' | 'salto_propio' | 'salto_hueco'

export type AttemptResult =
  | { ok: true; kind: MoveKind }
  | { ok: false; error: MoveError }

export const TEAM_NAME: Record<Team, { ficha: string; plural: string; hacia: string; flecha: string }> = {
  A: { ficha: 'azul', plural: 'azules', hacia: 'la derecha', flecha: '→' },
  B: { ficha: 'roja', plural: 'rojas', hacia: 'la izquierda', flecha: '←' },
}

// Clasifica el intento de llevar la ficha de `from` a `to`. El orden de
// las comprobaciones importa: se reporta el motivo más evidente para quien
// juega (primero "está ocupada", luego "va hacia atrás", etc.).
export function classifyAttempt(board: Board, from: number, to: number): AttemptResult {
  const piece = board[from]
  if (!piece) return { ok: false, error: 'ocupada' }
  if (board[to] !== null) return { ok: false, error: 'ocupada' }
  const dir = piece.team === 'A' ? 1 : -1
  const delta = to - from
  if (Math.sign(delta) !== dir) return { ok: false, error: 'atras' }
  const dist = Math.abs(delta)
  if (dist > 2) return { ok: false, error: 'lejos' }
  if (dist === 1) return { ok: true, kind: 'deslizar' }
  const middle = board[from + dir]
  if (middle === null) return { ok: false, error: 'salto_hueco' }
  if (middle.team === piece.team) return { ok: false, error: 'salto_propio' }
  return { ok: true, kind: 'saltar' }
}

export function explainError(error: MoveError, team: Team): { titulo: string; texto: string } {
  const t = TEAM_NAME[team]
  switch (error) {
    case 'ocupada':
      return { titulo: 'Esa casilla ya tiene una ficha', texto: 'Solo puedes mover una ficha a la casilla vacía (la gris).' }
    case 'atras':
      return { titulo: 'Las fichas nunca retroceden', texto: `Las fichas ${t.plural} solo avanzan hacia ${t.hacia} ${t.flecha}.` }
    case 'lejos':
      return { titulo: 'Demasiado lejos', texto: 'Una ficha avanza 1 casilla (deslizar) o 2 casillas saltando por encima de otra (saltar). Nunca más de 2.' }
    case 'salto_propio':
      return { titulo: 'No se salta a tu propio color', texto: `Una ficha ${t.ficha} solo puede saltar por encima de una ficha del otro color.` }
    case 'salto_hueco':
      return { titulo: 'No hay nada que saltar', texto: 'La casilla de al lado está vacía: ahí se avanza deslizando de a una, no saltando.' }
  }
}

// Por qué una ficha concreta no tiene ningún movimiento en este momento.
export function whyNoMoves(board: Board, index: number): string {
  const piece = board[index]!
  const t = TEAM_NAME[piece.team]
  const dir = piece.team === 'A' ? 1 : -1
  const next = board[index + dir]
  if (next === undefined) return `Esta ficha ${t.ficha} ya llegó al borde: no puede avanzar más.`
  if (next !== null && next.team === piece.team) return `Delante tiene otra ficha ${t.ficha}: no puede deslizar ni saltar sobre su propio color.`
  return 'Delante tiene una ficha del otro color, pero detrás de ella no hay casilla vacía para caer.'
}

export function successText(kind: MoveKind, team: Team): string {
  const t = TEAM_NAME[team]
  const otro = TEAM_NAME[team === 'A' ? 'B' : 'A'].ficha
  return kind === 'deslizar'
    ? `¡Bien! La ficha ${t.ficha} se deslizó una casilla hacia ${t.hacia}.`
    : `¡Muy bien! La ficha ${t.ficha} saltó por encima de una ficha ${otro}.`
}

// Toda partida ganada dura exactamente n² + 2n movimientos: cada par de
// fichas contrarias se cruza una vez (n² saltos) y cada ficha desliza 2n
// casillas en total entre las dos — por eso el tutorial no premia "menos
// movimientos" sino jugar sin errores ni pistas.
export function optimalMoves(pares: number): number {
  return pares * pares + 2 * pares
}

type Move = { from: number; to: number }
const key = (b: Board) => b.map(c => c?.id ?? 0).join(',')

// Búsqueda en anchura desde `board` hasta `win`. El espacio de estados es
// pequeño (unos pocos miles para 5 pares), así que se puede recalcular
// tras cada jugada sin costo perceptible.
export function solve(board: Board, win: Board): Move[] | null {
  if (boardsEqual(board, win)) return []
  const start = key(board)
  const prev = new Map<string, { parent: string; move: Move; board: Board } | null>([[start, null]])
  const queue: Board[] = [board]
  const winKey = key(win)
  while (queue.length) {
    const b = queue.shift()!
    const kb = key(b)
    for (let from = 0; from < b.length; from++) {
      if (!b[from]) continue
      for (const to of legalMovesFor(b, from)) {
        const nb = applyMove(b, from, to)
        const kn = key(nb)
        if (prev.has(kn)) continue
        prev.set(kn, { parent: kb, move: { from, to }, board: nb })
        if (kn === winKey) {
          const path: Move[] = []
          let k: string = kn
          while (k !== start) {
            const step = prev.get(k)!
            path.unshift(step.move)
            k = step.parent
          }
          return path
        }
        queue.push(nb)
      }
    }
  }
  return null
}

// ── Tutorial por niveles (1 a 5 pares) ─────────────────────────────────────
export const LEVELS: Record<number, { titulo: string; practica: string[]; consejo: string }> = {
  1: { titulo: 'Tu primer cambio', practica: ['Deslizar', 'Saltar'], consejo: 'Empieza deslizando una ficha hacia la casilla gris. Después, la otra podrá saltar por encima.' },
  2: { titulo: 'Dos por lado', practica: ['Alternar deslizar y saltar'], consejo: 'Después de cada salto queda un hueco nuevo: fíjate qué ficha puede ocuparlo.' },
  3: { titulo: 'Tres por lado', practica: ['Evitar bloqueos'], consejo: 'Cuidado con dejar dos fichas del mismo color juntas frente a la casilla gris: se tapan entre ellas.' },
  4: { titulo: 'Cuatro por lado', practica: ['Seguir un ritmo'], consejo: 'Hay un ritmo: los saltos seguidos van aumentando (1, 2, 3…) y luego disminuyendo. Si lo encuentras, no te equivocas.' },
  5: { titulo: 'El juego completo', practica: ['Todo lo aprendido'], consejo: 'Es la versión real, cinco por lado, igual que en una sesión con los cubos: 35 movimientos si no te equivocas.' },
}

// Estrellas: se gana siempre en el mismo número de movimientos (n² + 2n),
// así que lo que se premia es jugar sin errores, sin pistas y sin deshacer.
export function starsFor(errors: number, hints: number, undos: number): number {
  const faltas = errors + hints + undos
  return faltas === 0 ? 3 : faltas <= 3 ? 2 : 1
}
