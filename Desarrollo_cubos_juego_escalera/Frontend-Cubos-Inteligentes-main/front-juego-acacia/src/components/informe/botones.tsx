import { FileText, ClipboardList } from 'lucide-react'
import { sessionBtn } from '../../ui/styles'

// Los dos informes se piden desde dos botones distintos, a propósito: antes
// «Informe de la sesión» aparecía dentro de cada pestaña y se confundía con
// «Terminar sesión», que es el informe general de las cuatro pestañas.
//
//   · Informe del nivel  — azul, dentro de la pantalla de juego, junto a los
//     controles del intento: habla del nivel que se está jugando.
//   · Terminar sesión    — ámbar, arriba en la barra de pestañas, siempre a
//     la vista: cierra y resume toda la sesión.

export function BotonInformeNivel({ onClick, pares, intentos }: { onClick: () => void; pares: number; intentos: number }) {
  return (
    <button
      onClick={onClick}
      title={`Informe del nivel de ${pares} par${pares > 1 ? 'es' : ''} — movimientos frente al mínimo, decisiones, bucles y su grafo`}
      style={{ ...sessionBtn(true, 'var(--color-blue)'), background: 'transparent', color: 'var(--color-blue)' }}
    >
      <FileText size={14} /> Informe del nivel{intentos > 0 ? ` (${intentos})` : ''}
    </button>
  )
}

export function BotonTerminarSesion({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Informe general: las cuatro pestañas y todos los niveles de esta sesión"
      style={{ ...sessionBtn(true, 'var(--color-caution)'), color: '#1a1300', padding: '6px 12px', fontSize: '12px' }}
    >
      <ClipboardList size={13} /> Terminar sesión
    </button>
  )
}
