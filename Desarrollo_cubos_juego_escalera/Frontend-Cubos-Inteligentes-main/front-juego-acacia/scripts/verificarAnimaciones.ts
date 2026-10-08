// Verifica las animaciones de «Así no / Así sí» que acompañan a cada jugada
// rechazada (components/simulation/RulesAnimation.tsx).
//
// La tarjeta de error enseña dos movimientos: el que se intentó y uno válido
// desde la misma posición. Si una de esas escenas estuviera mal elegida, la
// aplicación le estaría enseñando al aprendiz una regla equivocada — y eso no
// se ve en una revisión a ojo, porque el tablero es pequeño y la animación
// corre en bucle. Aquí se comprueba contra el motor de reglas del juego:
//
//   · la escena «Así no» termina en una jugada inválida, y el motivo que
//     reporta el motor es exactamente el error que anuncia la tarjeta;
//   · todas las jugadas de la escena «Así sí» son válidas;
//   · los pasos previos de ambas escenas (el contexto que prepara la Regla 2)
//     también son válidos.

import { type Board, type Team, applyMove } from '../src/core/simulation/laEscaleraRules'
import { classifyAttempt } from '../src/core/simulation/tutor'
import { ESCENA_POR_ERROR } from '../src/components/simulation/RulesAnimation'

// Misma lectura del patrón que hace la animación, reescrita aquí a propósito:
// si se importara la suya, un error en esa función pasaría inadvertido.
function tableroDe(patron: string): Board {
  let a = 0, b = 0
  return patron.split('').map(c =>
    c === '_' ? null : c === 'A' ? { id: ++a, team: 'A' as Team } : { id: 100 + ++b, team: 'B' as Team })
}

type Escena = { pattern: string; beats: { from: number; to: number }[] }

// Reproduce la escena y devuelve el veredicto de cada jugada.
function reproducir(escena: Escena) {
  let board = tableroDe(escena.pattern)
  let prev: Board | null = null
  const out: { from: number; to: number; ok: boolean; error?: string }[] = []
  for (const beat of escena.beats) {
    const res = classifyAttempt(board, beat.from, beat.to, prev)
    out.push({ from: beat.from, to: beat.to, ok: res.ok, error: res.ok ? undefined : res.error })
    if (!res.ok) break
    prev = board
    board = applyMove(board, beat.from, beat.to)
  }
  return out
}

let fallos = 0
const chk = (cond: boolean, msg: string) => {
  if (!cond) { fallos++; console.log('  FALLO · ' + msg) }
}

console.log('')
console.log('Error reportado | «Así no»                      | «Así sí»')
console.log('----------------|-------------------------------|------------------------------')

for (const [error, caso] of Object.entries(ESCENA_POR_ERROR)) {
  const mal = reproducir(caso.mal)
  const bien = reproducir(caso.bien)

  // «Así no»: todo válido hasta la última jugada, que debe fallar por el
  // motivo anunciado.
  const ultima = mal[mal.length - 1]
  chk(mal.length === caso.mal.beats.length,
    `${error}: la escena «Así no» se cortó antes de la jugada final (una jugada previa ya era inválida)`)
  chk(!!ultima && !ultima.ok, `${error}: la escena «Así no» termina en una jugada VÁLIDA`)
  chk(!!ultima && ultima.error === error,
    `${error}: la escena «Así no» falla por «${ultima?.error}», no por «${error}»`)
  chk(mal.slice(0, -1).every(m => m.ok), `${error}: un paso previo de «Así no» ya era inválido`)

  // «Así sí»: todas las jugadas válidas.
  chk(bien.length === caso.bien.beats.length && bien.every(m => m.ok),
    `${error}: la escena «Así sí» contiene una jugada inválida (${bien.find(m => !m.ok)?.error ?? '?'})`)

  // Las dos escenas tienen que partir de la misma posición para que la
  // comparación enseñe algo.
  chk(caso.mal.pattern === caso.bien.pattern,
    `${error}: las dos escenas parten de posiciones distintas (${caso.mal.pattern} vs ${caso.bien.pattern})`)

  const fmt = (p: string, ms: typeof mal) =>
    (p + ' ' + ms.map(m => `${m.from}->${m.to}${m.ok ? '✓' : '✕' + m.error}`).join(' ')).padEnd(29)
  console.log(`${error.padEnd(15)} | ${fmt(caso.mal.pattern, mal)} | ${fmt(caso.bien.pattern, bien)}`)
}

console.log('')
if (fallos) {
  console.log(`>>> ${fallos} FALLOS en las animaciones de las reglas`)
  process.exit(1)
}
console.log('ANIMACIONES OK: cada tarjeta de error muestra una jugada inválida por el motivo que anuncia y una válida desde la misma posición.')
