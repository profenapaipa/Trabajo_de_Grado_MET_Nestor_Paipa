// Comprueba que el grafo generado en TypeScript coincide con Escalera.m:
// n=5 -> 3780 aristas (comentario zeros(3780,22) del script) y n=2 -> Fin = nodo 26.
import { buildStateGraph } from '../src/core/simulation/stateGraph'
const esperado: Record<number, { nodos: number; aristas: number; fin: number }> = {
  1: { nodos: 6, aristas: 6, fin: 5 }, 2: { nodos: 30, aristas: 36, fin: 26 },
  3: { nodos: 140, aristas: 180, fin: 136 }, 4: { nodos: 630, aristas: 840, fin: 620 },
  5: { nodos: 2772, aristas: 3780, fin: 2757 },
}
let ok = true
for (let n = 1; n <= 5; n++) {
  const g = buildStateGraph(n)
  const e = esperado[n]
  const bien = g.nodes.length === e.nodos && g.edges.length === e.aristas && g.finId === e.fin
  if (!bien) ok = false
  console.log(`n=${n} nodos=${g.nodes.length} aristas=${g.edges.length} fin=${g.finId} unSentido=${g.edges.filter(x => x.unSentido).length} bloqueos=${g.nodes.filter(x => x.bloqueo).length} dist(fin)=${g.nodes[g.finId - 1].distInicio} ${bien ? 'OK' : 'DIFIERE'}`)
}
process.exit(ok ? 0 : 1)
