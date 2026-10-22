// Efecto de la mediación Pausar–Pensar–Actuar sobre la jugada siguiente.
//
// Es la pregunta central de la investigación, y hasta ahora los informes no
// la respondían: las activaciones quedaban registradas pero nadie las
// cruzaba con lo que el aprendiz hizo después.
//
// El procedimiento es el que permite un diseño de caso único: comparar, dentro
// de la misma sesión y del mismo aprendiz, las decisiones que vinieron
// inmediatamente después de una señal con las que no. Las dos series salen
// del mismo participante y de los mismos niveles, así que no hace falta un
// grupo de control para que la comparación signifique algo.
//
// Se miden dos cosas en cada decisión:
//
//   · la calidad del movimiento (ec. 3.7): si la señal ayudó a elegir mejor;
//   · el tiempo que la precede (ec. 3.17): si la señal hizo que se detuviera
//     a pensar, que es lo que «Pausar» pretende.
//
// Las dos son necesarias. Una señal podría alargar el tiempo sin mejorar la
// elección —el aprendiz se detiene pero sigue sin ver la jugada— o mejorar la
// elección sin alargar el tiempo, que sería un efecto de otra naturaleza.

import { buildStateGraph } from '../simulation/stateGraph'
import { juzgarMovimiento } from '../simulation/metricas'
import type { EventoSesion, Seccion } from './sesion'

export type Fase = 'pausar' | 'pensar' | 'actuar'

export type Grupo = {
  n: number // decisiones en el grupo
  calidad: number | null // calidad media (0 = la mejor jugada)
  latencia: number | null // ms medios antes de decidir
}

export type EfectoMediacion = {
  activaciones: number
  porFase: Record<Fase, number>
  // Decisiones que siguieron inmediatamente a una señal.
  conSenal: Grupo
  // Las demás decisiones de los mismos intentos: la línea base del propio
  // aprendiz.
  sinSenal: Grupo
  // Si no hay con qué comparar, el informe debe decirlo en vez de dibujar una
  // diferencia que no se sostiene.
  comparable: boolean
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

// Cuántos movimientos sigue vigente una señal mientras no aparezca una
// decisión. No basta con mirar la jugada inmediatamente posterior: en el
// grafo de este juego muchas posiciones ofrecen una sola jugada legal, y en
// las sesiones piloto la jugada que siguió a las dos señales registradas
// estaba forzada —no había nada que decidir, así que no había nada que
// medir—. La mediación pretende mejorar DECISIONES, de modo que lo que se
// observa es la primera decisión real que llega tras la señal. Se acota a
// tres movimientos porque atribuir a una señal una decisión muy posterior
// sería atribuirle lo que ya no le corresponde.
const VENTANA = 3

// Una activación es una señal que llegó a encenderse. La sugerencia del
// sistema no basta —el operador puede descartarla— y contarla falsearía la
// comparación con jugadas que nunca vieron una señal.
const esActivacion = (e: EventoSesion) =>
  e.tipo === 'decision_ppa' && e.decision !== 'descartada'

export function efectoMediacion(eventos: EventoSesion[], seccion?: Seccion): EfectoMediacion {
  const porFase: Record<Fase, number> = { pausar: 0, pensar: 0, actuar: 0 }
  let activaciones = 0
  const cal: Record<'con' | 'sin', number[]> = { con: [], sin: [] }
  const lat: Record<'con' | 'sin', number[]> = { con: [], sin: [] }

  // Estado por sección: las pestañas pueden alternarse dentro de una sesión.
  type Abierto = { pares: number; anterior: number; actual: number; tUltimo: number | null; tras: number }
  const abiertos = new Map<Seccion, Abierto>()

  for (const e of eventos) {
    if (seccion && e.seccion !== seccion) continue
    const t = Date.parse(e.ts)

    if (e.tipo === 'intento_iniciado') {
      abiertos.set(e.seccion, {
        pares: e.pares ?? 0, anterior: 0, actual: e.nodoGrafo ?? 0, tUltimo: null, tras: 0,
      })
      continue
    }
    const a = abiertos.get(e.seccion)
    if (!a) continue

    // El tablero queda jugable: origen de tiempos (ver ec. 3.17).
    if (e.tipo === 'juego_listo') { a.tUltimo = t; continue }

    if (esActivacion(e)) {
      activaciones++
      if (e.fase) porFase[e.fase]++
      // La señal queda «vigente» durante los siguientes movimientos.
      a.tras = VENTANA
      continue
    }

    // Un movimiento es cualquier evento que deja al aprendiz en otra posición
    // del grafo. Se detecta así, y no por el tipo, porque cada vista nombra
    // sus eventos de forma distinta: la simulación registra «movimiento» y
    // Control, la actualización de posiciones que llega del tablero físico.
    const nodo = e.nodoGrafo
    if (!nodo || nodo <= 0 || nodo === a.actual || !a.pares) continue

    const g = buildStateGraph(a.pares)
    const { calidad } = juzgarMovimiento(g, a.actual, a.anterior, nodo)
    const grupo = a.tras > 0 ? 'con' : 'sin'
    if (calidad !== null) {
      cal[grupo].push(calidad)
      if (a.tUltimo !== null) {
        const d = t - a.tUltimo
        if (d >= 0) lat[grupo].push(d)
      }
      // La señal se gasta al llegar la primera decisión: lo que viene después
      // ya no se le puede atribuir.
      a.tras = 0
    } else if (a.tras > 0) {
      // Movimiento forzado: no consume la señal, pero acorta su vigencia.
      a.tras--
    }
    a.anterior = a.actual
    a.actual = nodo
    a.tUltimo = t
  }

  const grupo = (k: 'con' | 'sin'): Grupo => ({
    n: cal[k].length, calidad: media(cal[k]), latencia: media(lat[k]),
  })
  const conSenal = grupo('con')
  const sinSenal = grupo('sin')
  return {
    activaciones, porFase, conSenal, sinSenal,
    comparable: conSenal.n > 0 && sinSenal.n > 0,
  }
}
