// Vista del jugador: la pantalla que mira el participante mientras juega con
// los cubos físicos. Solo espejo, sin ningún control: en un Mago de Oz el
// participante no debe ver la consola del operador (sus señales, medidores
// ni bitácoras), porque entonces la respuesta de los cubos deja de parecer
// del sistema. Se abre como pestaña o en una ventana aparte (segundo monitor)
// y recibe el estado de Control por BroadcastChannel.

import { useEffect, useState } from 'react'
import TableroFisico from '../control/TableroFisico'
import { suscribirVistaJugador, type VistaJugadorSnapshot } from '../../core/control/vistaJugador'
import { countdownSemaforo } from '../../ui/styles'
import { PPA_HEX } from '../../core/ppa/ppaColors'
import { useMantenerPantalla } from '../../core/utils/temporizadorFondo'

const AZUL = '#0000ff', ROJO = '#ff0000'

// Mensajes cortos y concretos: qué está pasando y qué hacer.
function mensaje(s: VistaJugadorSnapshot): { titulo: string; texto?: string; color?: string } {
  if (s.fin === 'victoria') return { titulo: '¡Lo lograste!', texto: 'Cambiaste de lugar a todos los cubos.', color: 'var(--color-online)' }
  if (s.fin === 'bloqueo') return { titulo: 'Ya no quedan jugadas', texto: 'Vamos a ordenar los cubos para intentarlo otra vez.' }
  switch (s.estado) {
    case 'correccion': return { titulo: 'Esa jugada no se puede', texto: 'Devuelve los cubos así para seguir:', color: PPA_HEX.pausar }
    case 'pausado': return { titulo: 'Pausa', color: PPA_HEX.pausar }
    case 'cuenta_regresiva': return { titulo: '¡Prepárate!' }
    case 'jugando': return { titulo: 'A jugar' }
    case 'bloqueado':
    case 'victoria': return { titulo: 'Ordenemos los cubos', texto: 'Ponlos como se ve abajo.' }
    default:
      return s.objetivo
        ? { titulo: 'Ordenemos los cubos', texto: 'Los cubos en blanco van en otro lugar:' }
        : { titulo: 'Todo listo', texto: 'Espera la señal para empezar.' }
  }
}

function TableroObjetivo({ celdas, primeraCasilla, actuales }: { celdas: number[]; primeraCasilla: number; actuales: number[] }) {
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      {celdas.map((id, k) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', fontWeight: 700, color: '#fff',
            background: id === 0 ? 'transparent' : id <= 5 ? AZUL : ROJO,
            border: id === 0 ? '2px dashed var(--color-line-strong)' : 'none',
            outline: actuales[k] === id ? 'none' : '3px solid var(--color-offline)', outlineOffset: '3px',
          }}>{id || ''}</div>
          <span style={{ fontSize: '12px', color: 'var(--color-paper-faint)', fontFamily: 'var(--font-mono)' }}>{primeraCasilla + k + 1}</span>
        </div>
      ))}
    </div>
  )
}

export default function VistaJugador({ enVentana = false }: { enVentana?: boolean }) {
  const [s, setS] = useState<VistaJugadorSnapshot | null>(null)
  useEffect(() => suscribirVistaJugador(setS), [])
  // La pantalla del participante no debe apagarse en mitad de un intento.
  useMantenerPantalla(true)

  const fondo: React.CSSProperties = {
    flex: 1, minHeight: enVentana ? '100vh' : 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '28px', padding: '24px', boxSizing: 'border-box', overflow: 'auto',
    background: 'var(--color-bg)', color: 'var(--color-paper)', fontFamily: 'var(--font-sans)', position: 'relative',
  }

  if (!s) {
    return (
      <div style={fondo}>
        <div style={{ fontSize: '20px', color: 'var(--color-paper-dim)', textAlign: 'center', maxWidth: '520px', lineHeight: 1.5 }}>
          Esperando a Control Mago de Oz…
          <div style={{ fontSize: '13px', marginTop: '8px', color: 'var(--color-paper-faint)' }}>
            Esta vista se llena sola cuando la pestaña de Control está abierta en este mismo navegador.
          </div>
        </div>
      </div>
    )
  }

  const m = mensaje(s)
  // Cubos tan grandes como quepan: 11 casillas a 1,35x ocupan ~1160 px.
  const zoom = Math.min(1.9, 1.35 * 11 / s.celdas.length)

  return (
    <div style={fondo}>
      {s.mostrarTiempo && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '64px', fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.tiempo}</div>
          {s.intento > 0 && <div style={{ fontSize: '14px', color: 'var(--color-paper-faint)', marginTop: '6px' }}>Intento {s.intento}</div>}
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '34px', fontWeight: 700, color: m.color }}>{m.titulo}</div>
        {m.texto && <div style={{ fontSize: '18px', color: 'var(--color-paper-dim)', marginTop: '6px' }}>{m.texto}</div>}
      </div>

      {s.objetivo && (
        <TableroObjetivo celdas={s.objetivo.celdas} primeraCasilla={s.primeraCasilla} actuales={s.celdas.map(c => c.id)} />
      )}

      <TableroFisico celdas={s.celdas} primeraCasilla={s.primeraCasilla} levantados={s.levantados} zoom={zoom} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--color-paper-faint)' }}>
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.baseConectada ? 'var(--color-online)' : 'var(--color-offline)' }} />
        {s.baseConectada ? `Tablero conectado · ${s.conectados} de 10 cubos` : 'Tablero sin conexión'}
      </div>

      {s.cuenta !== null && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: countdownSemaforo(s.cuenta).bg, zIndex: 5,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '160px', fontWeight: 700, color: countdownSemaforo(s.cuenta).text }}>
            {s.cuenta === 0 ? '¡YA!' : s.cuenta}
          </span>
        </div>
      )}
    </div>
  )
}
