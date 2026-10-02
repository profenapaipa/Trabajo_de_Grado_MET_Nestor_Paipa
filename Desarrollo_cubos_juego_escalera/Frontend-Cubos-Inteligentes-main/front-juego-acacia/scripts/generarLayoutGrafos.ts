// Precalcula las posiciones de los nodos del grafo de estados (n = 1..5) con un
// layout de fuerzas, equivalente al plot(G,'Layout','force') de Escalera.m.
// Se guardan fijas en src/assets/GraphData/layout-n{n}.json para que el dibujo
// sea idéntico para todos los estudiantes y entre sesiones (comparables).
// Uso: npm run grafo:layout
import { writeFileSync } from 'node:fs'
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force'
import { buildStateGraph } from '../src/core/simulation/stateGraph'

// RNG con semilla para que el resultado sea reproducible.
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
}

for (let n = 1; n <= 5; n++) {
  const g = buildStateGraph(n)
  const rand = rng(1234 + n)
  const maxD = Math.max(...g.nodes.map(x => x.distInicio))
  // Arranque: a lo largo del eje Inicio->Fin según la distancia al Inicio.
  const nodes = g.nodes.map(nd => ({
    id: nd.id,
    x: (nd.distInicio / maxD) * 400 * Math.sqrt(n) + (rand() - 0.5) * 60,
    y: (rand() - 0.5) * 300 * Math.sqrt(n),
  })) as { id: number; x: number; y: number }[]
  const links = g.edges.map(e => ({ source: e.a - 1, target: e.b - 1 }))
  const sim = forceSimulation(nodes)
    .force('link', forceLink(links).distance(14).strength(0.9))
    .force('charge', forceManyBody().strength(-38).theta(0.9).distanceMax(260))
    .force('center', forceCenter(0, 0))
    .stop()
  const ticks = n <= 3 ? 600 : 400
  for (let i = 0; i < ticks; i++) sim.tick()

  // Rotar para que Inicio quede abajo-izquierda y Fin arriba-derecha
  // (la pantalla tiene y hacia abajo), y normalizar a ~[0,1000].
  const a = nodes[0], f = nodes[g.finId - 1]
  const ang = -Math.PI / 4 - Math.atan2(f.y - a.y, f.x - a.x)
  const c = Math.cos(ang), s = Math.sin(ang)
  const pts = nodes.map(p => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }))
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const sc = 1000 / Math.max(maxX - minX, maxY - minY)
  const out = pts.map(p => [Math.round((p.x - minX) * sc * 10) / 10, Math.round((p.y - minY) * sc * 10) / 10])
  writeFileSync(`src/assets/GraphData/layout-n${n}.json`, JSON.stringify(out))
  console.log(`n=${n}: ${out.length} nodos`)
}
