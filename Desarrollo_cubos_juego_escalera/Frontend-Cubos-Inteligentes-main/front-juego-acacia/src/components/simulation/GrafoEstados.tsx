import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core } from 'cytoscape'
import { buildStateGraph, type StateGraph } from '../../core/simulation/stateGraph'
import { sectionLabel, smallBtn } from '../../ui/styles'
import { MiniBoard } from './RulesCard'

// Grafo de estados de La Escalera (el de Escalera.m / libro de Lina y Rafael)
// dibujado en vivo: todos los estados posibles para los pares elegidos, el
// Inicio, el Fin, los caminos sin retorno, la ruta del intento en curso y, a medida que
// se repiten intentos, los caminos y estados más transitados con más
// intensidad (más gruesos y más brillantes). Sirve a quien juega, al
// observador y al mago de Oz, y los mismos recorridos quedan en la bitácora
// para el análisis posterior.
//
// Las posiciones de los nodos son fijas (precalculadas con
// scripts/generarLayoutGrafos.ts) para que el dibujo sea idéntico entre
// estudiantes y sesiones.

const layouts = import.meta.glob('../../assets/GraphData/layout-n*.json', { import: 'default' }) as
  Record<string, () => Promise<number[][]>>

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function patternOf(board: StateGraph['nodes'][number]['board']) {
  return board.map(c => (c ? c.team : '_')).join('')
}

type Palette = { blue: string; online: string; offline: string; caution: string; paper: string; bg: string }

// Hoja de estilos del grafo. `k` escala nodos y aristas (1 = tamaño al ver todo
// el grafo) y `fs` es el tamaño de letra en unidades del grafo, calculado para
// que se vea siempre de ~12 px en pantalla sea cual sea el zoom.
function buildStyle(c: Palette, k: number, fs: number): cytoscape.StylesheetStyle[] {
  return [
    { selector: 'node', style: { width: 3 * k, height: 3 * k, 'background-color': '#5a6b6f', label: 'data(label)', color: c.paper, 'font-size': fs, 'font-weight': 700, 'text-valign': 'top', 'text-margin-y': -5 * k, 'text-background-color': c.bg, 'text-background-opacity': 0.85, 'text-background-padding': `${Math.max(1, fs * 0.15)}px`, 'z-index': 2 } },
    { selector: 'edge', style: { width: 1 * k, 'line-color': '#3a484b', 'curve-style': 'straight', opacity: 0.9, 'z-index': 1 } },
    { selector: 'node.sinsalida', style: { 'background-color': '#6a4348' } },
    { selector: 'node.bloqueo', style: { 'background-color': c.offline, shape: 'diamond', width: 6 * k, height: 6 * k } },
    { selector: 'node.inicio', style: { 'background-color': c.online, width: 12 * k, height: 12 * k, 'z-index': 5 } },
    { selector: 'node.fin', style: { 'background-color': c.blue, width: 12 * k, height: 12 * k, 'z-index': 5 } },
    { selector: 'edge[int > 0]', style: { 'line-color': 'mapData(int, 0, 1, #1f7580, #8ffcff)', width: `mapData(int, 0, 1, ${1.8 * k}, ${7 * k})` as unknown as number, 'z-index': 3 } },
    { selector: 'node[int > 0]', style: { 'background-color': 'mapData(int, 0, 1, #2a9aa8, #bffcff)', width: `mapData(int, 0, 1, ${5 * k}, ${11 * k})` as unknown as number, height: `mapData(int, 0, 1, ${5 * k}, ${11 * k})` as unknown as number, 'z-index': 4 } },
    { selector: 'node.bloqueo[int > 0]', style: { 'background-color': c.offline } },
    { selector: 'edge.ruta', style: { 'line-color': c.caution, width: 4.5 * k, 'z-index': 8 } },
    { selector: 'node.ruta', style: { 'background-color': c.caution, width: 8 * k, height: 8 * k, 'z-index': 9 } },
    { selector: 'node.actual', style: { 'background-color': '#ffffff', width: 16 * k, height: 16 * k, 'border-width': 3.5 * k, 'border-color': c.caution, 'z-index': 12 } },
  ] as cytoscape.StylesheetStyle[]
}

type Props = {
  pares: number
  // Recorridos de intentos ya terminados: lista de IDs de nodo, en orden.
  previos: number[][]
  // Recorrido del intento en curso (el primero es el Inicio).
  actual: number[]
  // Alto fijo en px; sin él, el grafo llena el alto de su contenedor.
  height?: number
}

function GrafoEstados({ pares, previos, actual, height }: Props) {
  const graph = useMemo(() => buildStateGraph(pares), [pares])
  const boxRef = useRef<HTMLDivElement>(null)
  // Zoom con el que se ve todo el grafo (base de la escala) y si la persona ya
  // movió la vista: si no la movió, el grafo se reajusta solo al cambiar el tamaño.
  const z0Ref = useRef(1)
  const touchedRef = useRef(false)
  const cyRef = useRef<Core | null>(null)
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  // Conteos acumulados: cuántas veces se visitó cada nodo y se recorrió cada
  // arista, sumando todos los intentos (previos + el actual).
  const counts = useMemo(() => {
    const nodos = new Array<number>(graph.nodes.length + 1).fill(0)
    const aristas = new Array<number>(graph.edges.length).fill(0)
    for (const path of [...previos, actual]) {
      path.forEach((id, i) => {
        nodos[id]++
        if (i > 0) {
          const e = graph.edgeIndexOf(path[i - 1], id)
          if (e >= 0) aristas[e]++
        }
      })
    }
    return { nodos, aristas }
  }, [graph, previos, actual])

  // Crear el grafo de Cytoscape al cambiar de pares.
  useEffect(() => {
    let cancelled = false
    let cy: Core | null = null
    let ro: ResizeObserver | null = null
    setReady(false)
    const load = layouts[`../../assets/GraphData/layout-n${pares}.json`]
    load().then(pos => {
      if (cancelled || !boxRef.current) return
      // Los grafos chicos (pocos nodos) usan marcas más grandes para que se lean.
      const unit = ({ 1: 4.5, 2: 3, 3: 2, 4: 1.4 } as Record<number, number>)[pares] ?? 1
      const palette: Palette = {
        blue: cssVar('--color-blue', '#4589FF'), online: cssVar('--color-online', '#42BE65'),
        offline: cssVar('--color-offline', '#FA4D56'), caution: cssVar('--color-caution', '#F1C21B'),
        paper: cssVar('--color-paper', '#E7EDEE'), bg: cssVar('--color-bg', '#0B0F10'),
      }
      cy = cytoscape({
        container: boxRef.current,
        elements: [
          ...graph.nodes.map(nd => ({
            group: 'nodes' as const,
            data: { id: `n${nd.id}`, nid: nd.id, int: 0, label: '' },
            position: { x: pos[nd.id - 1][0], y: pos[nd.id - 1][1] },
            classes: [
              nd.id === graph.inicioId ? 'inicio' : '', nd.id === graph.finId ? 'fin' : '',
              nd.bloqueo ? 'bloqueo' : nd.sinSalida ? 'sinsalida' : '',
            ].join(' '),
          })),
          ...graph.edges.map(e => ({
            group: 'edges' as const,
            data: { id: `e${e.index}`, source: `n${e.a}`, target: `n${e.b}`, int: 0 },
          })),
        ],
        layout: { name: 'preset' },
        autoungrabify: true, boxSelectionEnabled: false, minZoom: 0.4, maxZoom: 12, wheelSensitivity: 0.25,
        style: buildStyle(palette, unit, 12),
      })
      cyRef.current = cy
      cy.nodes().on('mouseover', ev => setHover(ev.target.data('nid')))
      cy.nodes().on('mouseout', () => setHover(null))
      cy.getElementById(`n${graph.inicioId}`).data('label', 'Inicio')
      cy.getElementById(`n${graph.finId}`).data('label', 'Fin')
      const marcarTocado = () => { touchedRef.current = true }
      boxRef.current.addEventListener('wheel', marcarTocado, { passive: true })
      boxRef.current.addEventListener('pointerdown', marcarTocado)
      touchedRef.current = false
      ro = new ResizeObserver(() => {
        if (!cy) return
        cy.resize()
        if (!touchedRef.current) { cy.fit(undefined, 12); z0Ref.current = cy.zoom() }
      })
      ro.observe(boxRef.current)
      cy.fit(undefined, 12)
      // Zoom con proporción: las etiquetas conservan un tamaño fijo en pantalla
      // (12 px) y nodos/aristas crecen solo con la raíz del zoom, en vez de
      // inflarse linealmente al acercar.
      z0Ref.current = cy.zoom()
      let lastK = 1, lastFs = 0, raf = 0
      const reescalar = () => {
        raf = 0
        if (!cy) return
        const z = cy.zoom()
        const k = Math.min(1.5, Math.max(0.1, Math.sqrt(z0Ref.current / z)))
        const fs = 12 / z
        if (Math.abs(k - lastK) / lastK < 0.04 && Math.abs(fs - lastFs) / Math.max(lastFs, 1e-6) < 0.04) return
        lastK = k; lastFs = fs
        cy.style(buildStyle(palette, k * unit, fs))
      }
      cy.on('zoom', () => { if (!raf) raf = requestAnimationFrame(reescalar) })
      reescalar()
      setReady(true)
    })
    return () => { cancelled = true; ro?.disconnect(); cy?.destroy(); cyRef.current = null }
  }, [graph, pares])

  // Actualizar intensidades y la ruta en curso.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !ready) return
    const maxE = Math.max(2, ...counts.aristas)
    const maxN = Math.max(2, ...counts.nodos)
    const enRuta = new Set(actual)
    const aristasRuta = new Set<number>()
    for (let i = 1; i < actual.length; i++) {
      const e = graph.edgeIndexOf(actual[i - 1], actual[i])
      if (e >= 0) aristasRuta.add(e)
    }
    const cur = actual.length ? actual[actual.length - 1] : -1
    cy.batch(() => {
      cy.nodes().forEach(n => {
        const id = n.data('nid') as number
        const c = counts.nodos[id]
        n.data('int', c > 0 ? Math.min(1, c / maxN) : 0)
        n.toggleClass('ruta', enRuta.has(id))
        n.toggleClass('actual', id === cur)
        if (id !== graph.inicioId && id !== graph.finId) n.data('label', id === cur ? 'Tú' : '')
        else n.data('label', id === graph.inicioId ? (id === cur ? 'Inicio · Tú' : 'Inicio') : 'Fin')
      })
      cy.edges().forEach(e => {
        const i = Number(String(e.id()).slice(1))
        const c = counts.aristas[i]
        e.data('int', c > 0 ? Math.min(1, c / maxE) : 0)
        e.toggleClass('ruta', aristasRuta.has(i))
      })
    })
  }, [counts, actual, graph, ready])

  const cur = actual.length ? actual[actual.length - 1] : graph.inicioId
  const nodoActual = graph.nodes[cur - 1]
  // Mínimo para ganar desde aquí, sabiendo de dónde se llegó (Regla 2).
  const distFin = graph.distFinDesde(cur, actual.length > 1 ? actual[actual.length - 2] : 0)
  const repetidos = actual.length - new Set(actual).size
  const intentos = previos.length + (actual.length > 1 ? 1 : 0)
  const hoverNode = hover !== null ? graph.nodes[hover - 1] : null

  function verTodo() {
    const cy = cyRef.current
    if (!cy) return
    touchedRef.current = false
    cy.fit(undefined, 12)
    z0Ref.current = cy.zoom()
  }

  function irAMiPosicion() {
    const cy = cyRef.current
    if (!cy) return
    cy.animate({ center: { eles: cy.getElementById(`n${cur}`) }, zoom: Math.min(4, cy.maxZoom()) }, { duration: 300 })
  }

  const chip = (color: string, text: string, shape: 'dot' | 'diamond' | 'line' = 'dot') => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-paper-dim)' }}>
      <span aria-hidden="true" style={{
        width: shape === 'line' ? '16px' : '9px', height: shape === 'line' ? '3px' : '9px', background: color,
        borderRadius: shape === 'dot' ? '50%' : '1px', transform: shape === 'diamond' ? 'rotate(45deg) scale(0.85)' : undefined,
      }} />{text}
    </span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: height === undefined ? '100%' : undefined, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>
          Estado <b style={{ color: 'var(--color-paper)', fontFamily: 'var(--font-mono)' }}>{cur}</b> de {graph.nodes.length}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>
          a <b style={{ color: 'var(--color-paper)', fontFamily: 'var(--font-mono)' }}>{nodoActual.distInicio}</b> movimientos del inicio
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>
          {distFin < 0
            ? <b style={{ color: 'var(--color-offline)' }}>{nodoActual.bloqueo ? 'Camino sin retorno: bloqueo' : 'Camino sin salida'}</b>
            : <>mínimo <b style={{ color: 'var(--color-paper)', fontFamily: 'var(--font-mono)' }}>{distFin}</b> para ganar</>}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>
          {repetidos > 0 ? <>estados repetidos en este intento: <b style={{ color: 'var(--color-caution)' }}>{repetidos}</b></> : 'sin estados repetidos'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button onClick={irAMiPosicion} style={smallBtn}>Ir a mi posición</button>
          <button onClick={verTodo} style={smallBtn}>Ver todo</button>
        </span>
      </div>

      <div style={{
        position: 'relative', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', background: 'var(--color-bg)',
        ...(height === undefined ? { flex: '1 1 0', minHeight: '240px' } : { height: `${height}px` }),
      }}>
        <div ref={boxRef} role="img" aria-label={`Grafo de estados de ${graph.nodes.length} posiciones`} style={{ position: 'absolute', inset: 0 }} />
        {!ready && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sectionLabel }}>Dibujando grafo…</div>}
        {hoverNode && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--color-panel)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '8px 10px', pointerEvents: 'none' }}>
            <div style={{ ...sectionLabel, marginBottom: '6px' }}>
              Estado {hoverNode.id} · visitas {counts.nodos[hoverNode.id]}
              {hoverNode.bloqueo ? ' · camino sin retorno' : hoverNode.sinSalida ? ' · sin salida' : ''}
            </div>
            <MiniBoard pattern={patternOf(hoverNode.board)} size={16} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        {chip('var(--color-online)', 'Inicio')}
        {chip('var(--color-blue)', 'Fin')}
        {chip('var(--color-caution)', 'Intento en curso', 'line')}
        {chip('#5fe0ec', 'Más repetido = más grueso y brillante', 'line')}
        {chip('var(--color-offline)', 'Camino sin retorno', 'diamond')}
        {chip('#6a4348', 'Sin salida')}
        <span style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginLeft: 'auto' }}>
          {intentos} intento{intentos === 1 ? '' : 's'} · rueda para zoom, arrastra para mover
        </span>
      </div>
    </div>
  )
}

export default GrafoEstados
