// Verifica las animaciones que explican las reglas del juego
// (components/simulation/RulesAnimation.tsx).
//
// Son las mismas que usa el tutorial en «¿Cómo se juega?» y las que acompañan
// a cada jugada rechazada. Si una escena estuviera mal elegida, la aplicación
// le estaría enseñando al aprendiz una regla equivocada —y eso no se ve en una
// revisión a ojo, porque el tablero es pequeño y la animación corre en bucle.
// Aquí se comprueba contra el motor de reglas del juego:
//
//   · cada jugada anunciada como válida (lleva su texto «ok») lo es de verdad;
//   · cada regla muestra al menos una jugada válida y al menos una inválida,
//     que es lo que hace que el ejemplo enseñe algo;
//   · y los cinco errores que el juego sabe detectar tienen su regla asociada.

import { type Board, type Team, applyMove } from '../src/core/simulation/laEscaleraRules'
import { classifyAttempt } from '../src/core/simulation/tutor'
import { SCENES, REGLA_POR_ERROR } from '../src/components/simulation/RulesAnimation'

// Misma lectura del patrón que hace la animación, reescrita aquí a propósito:
// si se importara la suya, un error en esa función pasaría inadvertido.
function tableroDe(patron: string): Board {
  let a = 0, b = 0
  return patron.split('').map(c =>
    c === '_' ? null : c === 'A' ? { id: ++a, team: 'A' as Team } : { id: 100 + ++b, team: 'B' as Team })
}

type Beat = { from: number; to: number; ok?: string }

// Reproduce una escena y devuelve el veredicto de cada jugada.
function reproducir(escena: { pattern: string; beats: Beat[] }) {
  let board = tableroDe(escena.pattern)
  let prev: Board | null = null
  const out: { from: number; to: number; ok: boolean; error?: string; anunciadaValida: boolean }[] = []
  for (const beat of escena.beats) {
    const res = classifyAttempt(board, beat.from, beat.to, prev)
    out.push({ from: beat.from, to: beat.to, ok: res.ok, error: res.ok ? undefined : res.error, anunciadaValida: !!beat.ok })
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
console.log('Regla | escenas | jugadas válidas | jugadas inválidas')
console.log('------|---------|-----------------|-------------------')

for (const [regla, escenas] of Object.entries(SCENES)) {
  let validas = 0, invalidas = 0
  escenas.forEach((escena, i) => {
    const r = reproducir(escena)
    chk(r.length > 0, `regla ${regla}, ejemplo ${i + 1}: la escena no tiene jugadas`)
    r.forEach((m, k) => {
      if (m.ok) validas++; else invalidas++
      // Una jugada anunciada como válida (lleva texto de acierto) tiene que serlo.
      chk(!m.anunciadaValida || m.ok,
        `regla ${regla}, ejemplo ${i + 1}, jugada ${k + 1} (${m.from}->${m.to}): se anuncia válida pero el motor la rechaza por «${m.error}»`)
      // Y una jugada inválida solo puede ser la última: después de rebotar no
      // se sigue jugando.
      chk(m.ok || k === r.length - 1,
        `regla ${regla}, ejemplo ${i + 1}: hay una jugada inválida que no es la última`)
    })
  })
  chk(validas > 0, `la regla ${regla} no muestra ninguna jugada válida`)
  chk(invalidas > 0, `la regla ${regla} no muestra ninguna jugada inválida`)
  console.log(`  ${regla}   |    ${escenas.length}    |        ${validas}        |         ${invalidas}`)
}

console.log('')
const ERRORES = ['ocupada', 'lejos', 'salto_propio', 'salto_hueco', 'regreso']
for (const e of ERRORES) {
  const regla = REGLA_POR_ERROR[e]
  chk(!!regla && !!SCENES[regla], `el error «${e}» no tiene una regla con animación asociada`)
  console.log(`  ${e.padEnd(13)} → regla ${regla}`)
}

console.log('')
if (fallos) {
  console.log(`>>> ${fallos} FALLOS en las animaciones de las reglas`)
  process.exit(1)
}
console.log('ANIMACIONES OK: cada regla se enseña con jugadas válidas e inválidas verificadas contra el motor del juego, y cada error tiene su regla.')
