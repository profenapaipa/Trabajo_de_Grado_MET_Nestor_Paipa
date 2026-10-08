// Comprueba el módulo de métricas contra trayectorias de referencia.
// Uso: npm run metricas:verificar
import { buildStateGraph } from '../src/core/simulation/stateGraph'
import { metricasDeIntento } from '../src/core/simulation/metricas'

const n = 5
const g = buildStateGraph(n)
const paso = (cur: number, prev: number) => {
  let best = -1, bd = Infinity
  for (const w of g.vecinos(cur)) { if (w === prev) continue
    const d = g.distFinDesde(w, cur); if (d >= 0 && d < bd) { bd = d; best = w } }
  return best
}
function optima(): number[] {
  const W = [g.inicioId]; let cur = g.inicioId, prev = 0
  while (cur !== g.finId) { const w = paso(cur, prev); if (w < 0) break; prev = cur; cur = w; W.push(cur) }
  return W
}
function conRodeos(seed: number, azar: number): number[] {
  let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
  const W = [g.inicioId]; let cur = g.inicioId, prev = 0
  for (let i = 0; i < azar; i++) {
    const opts = g.vecinos(cur).filter(w => w !== prev && g.distFinDesde(w, cur) >= 0)
    if (!opts.length) break
    const w = opts[Math.floor(rnd() * opts.length)]; prev = cur; cur = w; W.push(cur)
    if (cur === g.finId) return W
  }
  while (cur !== g.finId) { const w = paso(cur, prev); if (w < 0) break; prev = cur; cur = w; W.push(cur) }
  return W
}

let fallos = 0
const chk = (cond: boolean, msg: string) => { if (!cond) { fallos++; console.error('FALLO:', msg) } }

const casos: [string, number[]][] = [
  ['Ruta óptima', optima()], ['Pocos rodeos', conRodeos(7, 12)],
  ['Rodeos moderados', conRodeos(23, 40)], ['Exploración amplia', conRodeos(99, 120)],
]
console.log('Caso                | L   | Q    | R     | α    | pts | δ̄    | ν | β     | μ')
for (const [nom, W] of casos) {
  const m = metricasDeIntento(n, W)
  console.log(`${nom.padEnd(19)} | ${String(m.movimientos).padEnd(3)} | ${m.circuidad.toFixed(2)} | ${m.ramificacion.toFixed(3)} | ${(100 * m.tasaAcierto).toFixed(0).padStart(3)}% | ${String(m.puntosDecision).padEnd(3)} | ${m.gradoLibertadMedio.toFixed(2)} | ${m.retornos} | ${m.buclicidad.toFixed(3)} | ${m.ciclosIndependientes}`)
  chk(m.perfil.length === m.puntosDecision, nom + ': el perfil debe tener un punto por decisión')
  chk(m.tamanosBucle.every(t => t >= 6), nom + ': ningún bucle puede medir menos de 6 (cuello del grafo)')
  chk(m.circuidad >= 1, nom + ': la circuidad nunca es menor que 1')
  chk(m.ramificacion >= 0 && m.ramificacion <= 1, nom + ': la ramificación vive en [0,1]')
  chk(m.retornos === (m.movimientos + 1) - m.estadosDistintos, nom + ': retornos mal contados')
}
// La ruta óptima debe dar exactamente los valores extremos
const o = metricasDeIntento(n, optima())
chk(o.movimientos === 35, 'la ruta óptima debe tener 35 movimientos')
chk(o.circuidad === 1, 'la ruta óptima debe tener circuidad exactamente 1')
chk(o.ramificacion === 0, 'la ruta óptima debe tener ramificación exactamente 0')
chk(o.tasaAcierto === 1, 'la ruta óptima debe acertar el 100%')
chk(o.retornos === 0 && o.ciclosIndependientes === 0, 'la ruta óptima no tiene bucles')
// Un intento sin movimientos no debe romper nada
const v = metricasDeIntento(n, [g.inicioId])
chk(v.movimientos === 0 && v.ramificacion === 0, 'intento vacío')

if (fallos) { console.error(`\n${fallos} fallos`); process.exit(1) }
console.log('\nMÉTRICAS OK: coinciden con las ecuaciones de main.tex y con el cálculo independiente.')
