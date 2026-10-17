// Tablero de los cubos físicos, con las dos animaciones del juego real:
//  - levantar: el cubo sube y queda "flotando" sobre su casilla de origen;
//  - apoyar: el cubo se desliza desde donde estaba hasta su nueva casilla.
// Lo usan Control Mago de Oz y la Vista del jugador, con los mismos datos.
//
// Las animaciones son FLIP con la Web Animations API: cada render se mide
// dónde quedó cada cubo y, si cambió de casilla, se anima desde donde estaba.
// No pasan por estado de React, así que no retrasan nada: el tablero siempre
// muestra la posición real y la animación solo la acompaña (~250 ms).

import { useLayoutEffect, useRef } from 'react'
import Cube from '../Cube'
import IndicadorBateria from './IndicadorBateria'
import type { PPAPhase } from '../../core/ppa/ppaColors'

export type CubeVisual = { hex: string; accion?: PPAPhase; pulso?: true }

export type CeldaTablero = {
  id: number            // 0 = casilla vacía
  visual: CubeVisual
  conectado?: boolean   // WiFi del cubo (punto bajo la casilla)
  presente?: boolean    // lo que lee la base en esa casilla (diagnóstico)
  legal?: boolean       // casilla vacía a la que el cubo levantado puede ir
  bateria?: { pct: number | null; titulo: string } // solo en Control (no en la vista del jugador)
}

export type CuboLevantado = { id: number; origen: number; visual: CubeVisual } // origen = índice en `celdas`

const ALTURA_LEVANTADO = 18
const LEVANTADO = `translateY(-${ALTURA_LEVANTADO}px) scale(1.06)`
const EASE = 'cubic-bezier(.2,.8,.2,1)'

export default function TableroFisico({
  celdas, primeraCasilla, levantados, seleccionado, onSelect,
  mostrarConexion = true, mostrarPresencia = false, mostrarCasillas = true, zoom = 1,
}: {
  celdas: CeldaTablero[]
  primeraCasilla: number   // índice físico (0-10) de la primera celda, para numerar 1-11
  levantados: CuboLevantado[]
  seleccionado?: number | null
  onSelect?: (id: number) => void
  mostrarConexion?: boolean
  mostrarPresencia?: boolean
  mostrarCasillas?: boolean
  zoom?: number
}) {
  const nodos = useRef(new Map<number, HTMLDivElement>())
  const antes = useRef(new Map<number, { rect: DOMRect; casilla: number; levantado: boolean }>())

  // Casilla y condición (apoyado/levantado) de cada cubo en este render.
  const ahora = new Map<number, { casilla: number; levantado: boolean }>()
  celdas.forEach((c, i) => { if (c.id) ahora.set(c.id, { casilla: i, levantado: false }) })
  for (const l of levantados) ahora.set(l.id, { casilla: l.origen, levantado: true })

  useLayoutEffect(() => {
    const nuevo = new Map<number, { rect: DOMRect; casilla: number; levantado: boolean }>()
    for (const [id, pos] of ahora) {
      const el = nodos.current.get(id)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const prev = antes.current.get(id)
      if (prev) {
        if (pos.levantado && !prev.levantado && pos.casilla === prev.casilla) {
          el.animate([{ transform: 'none' }, { transform: LEVANTADO }], { duration: 180, easing: EASE })
        } else if (!pos.levantado && prev.levantado && pos.casilla === prev.casilla) {
          el.animate([{ transform: LEVANTADO }, { transform: 'none' }], { duration: 160, easing: EASE })
        } else if (pos.casilla !== prev.casilla) {
          // Desde donde estaba (flotando o apoyado) hasta su casilla nueva.
          const dx = (prev.rect.left - rect.left) / zoom
          const dy = (prev.rect.top - rect.top) / zoom
          el.animate(
            [{ transform: `translate(${dx}px, ${dy}px)${prev.levantado ? ' scale(1.06)' : ''}` }, { transform: pos.levantado ? LEVANTADO : 'none' }],
            { duration: 260, easing: EASE })
        }
      }
      nuevo.set(id, { rect, ...pos })
    }
    antes.current = nuevo
  })

  const registrar = (id: number) => (el: HTMLDivElement | null) => {
    if (el) nodos.current.set(id, el)
    else nodos.current.delete(id)
  }

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', justifyContent: 'center', zoom, paddingTop: `${ALTURA_LEVANTADO + 4}px` }}>
      {celdas.map((celda, i) => {
        const levantado = levantados.find(l => l.origen === i)
        const vacia = celda.id === 0
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              {/* La casilla (vacía o con su cubo) */}
              <div ref={vacia ? undefined : registrar(celda.id)}>
                <Cube id={celda.id}
                  isSelected={!vacia && seleccionado === celda.id}
                  onSelect={id => { if (id !== 0) onSelect?.(id) }}
                  isLegalTarget={vacia && celda.legal}
                  visual={vacia && levantado ? { hex: 'rgba(128,128,128,0.25)' } : celda.visual} />
              </div>
              {/* El cubo levantado, flotando sobre la casilla que dejó */}
              {levantado && (
                <div ref={registrar(levantado.id)} style={{
                  position: 'absolute', inset: 0, transform: LEVANTADO,
                  filter: 'drop-shadow(0 14px 10px rgba(0,0,0,0.55))', pointerEvents: 'none',
                }}>
                  <Cube id={levantado.id} isSelected={false} onSelect={() => {}} visual={levantado.visual} />
                </div>
              )}
            </div>
            {mostrarConexion && (
              vacia ? <div style={{ width: '13px', height: '13px' }} /> : (
                <div title={`Cubo #${celda.id} — ${celda.conectado ? 'conectado' : 'sin conexión'}`} style={{
                  width: '13px', height: '13px', borderRadius: '50%',
                  background: celda.conectado ? 'var(--color-online)' : 'var(--color-offline)',
                  boxShadow: `0 0 0 3px ${celda.conectado ? 'rgba(66,190,101,0.22)' : 'rgba(250,77,86,0.22)'}`,
                }} />
              )
            )}
            {celdas.some(c => c.bateria) && (
              celda.bateria
                ? <IndicadorBateria pct={celda.bateria.pct} titulo={celda.bateria.titulo} />
                : <div style={{ height: '11px' }} />
            )}
            {mostrarPresencia && (
              <div title={`Casilla ${primeraCasilla + i + 1} — la base ${celda.presente ? 'detecta un cubo' : 'no detecta nada'}`} style={{
                width: '22px', height: '6px', borderRadius: '2px',
                background: celda.presente ? 'var(--color-blue)' : 'transparent',
                border: '1px solid var(--color-line-strong)',
              }} />
            )}
            {mostrarCasillas && (
              <span style={{ fontSize: '10px', color: 'var(--color-paper-faint)', fontFamily: 'var(--font-mono)' }}>{primeraCasilla + i + 1}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
