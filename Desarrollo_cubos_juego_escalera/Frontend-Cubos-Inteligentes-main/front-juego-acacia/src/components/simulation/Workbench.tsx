import type { ReactNode } from 'react'

// Mesa de trabajo de las pestañas de Simulación (ver .sim-bench en
// index.css): `left` es lo que se juega (tablero, mensajes, bitácora) y
// `right` el grafo de estados, que en pantallas anchas se queda fijo a la
// vista. `offset` es el alto que ocupa todo lo que está por encima del grafo
// (pestañas + encabezado + franja de configuración), para que el grafo llene
// justo el resto de la ventana sin crear barra de desplazamiento.
export default function Workbench({ left, right, offset = 250 }: { left: ReactNode; right: ReactNode; offset?: number }) {
  return (
    <div className="sim-bench">
      <div className="sim-bench__cols" style={{ ['--bench-offset' as string]: `${offset}px` }}>
        <div className="sim-bench__left">{left}</div>
        <div className="sim-bench__right">{right}</div>
      </div>
    </div>
  )
}
