// Comparación entre el tablero físico y el tablero al que hay que volver
// (orden inicial antes de jugar, o la posición previa a una jugada
// inválida). Trabaja sobre las 11 casillas físicas (ids, 0 = vacía) y
// considera solo los cubos que importan para el nivel jugado: los que van
// dentro de la ventana del ejercicio y los que hoy la ocupan sin deber.

import { physicalOffset, PHYSICAL_PAIRS } from '../simulation/laEscaleraRules'

export type CuboDesubicado = {
  cubo: number
  // Casillas en numeración 1-11, igual que el resto de mensajes de Control.
  // `desde` null: el cubo no aparece en el tablero (levantado o sin detectar).
  desde: number | null
  hasta: number
}

export function cubosDesubicados(actual: number[], objetivo: number[], pares: number): CuboDesubicado[] {
  const inicio = physicalOffset(pares)
  const fin = PHYSICAL_PAIRS + pares // inclusive
  const relevantes = new Set<number>()
  for (let i = inicio; i <= fin; i++) {
    if (objetivo[i]) relevantes.add(objetivo[i])
    if (actual[i]) relevantes.add(actual[i])
  }
  const desubicados: CuboDesubicado[] = []
  for (const cubo of [...relevantes].sort((a, b) => a - b)) {
    const hasta = objetivo.indexOf(cubo)
    const desde = actual.indexOf(cubo)
    if (hasta !== -1 && desde !== hasta) {
      desubicados.push({ cubo, desde: desde === -1 ? null : desde + 1, hasta: hasta + 1 })
    }
  }
  return desubicados
}

// ¿Coinciden las casillas del ejercicio (la ventana del nivel)?
export function ventanaIgual(actual: number[], objetivo: number[], pares: number): boolean {
  const inicio = physicalOffset(pares)
  const fin = PHYSICAL_PAIRS + pares
  for (let i = inicio; i <= fin; i++) if ((actual[i] ?? 0) !== (objetivo[i] ?? 0)) return false
  return true
}
