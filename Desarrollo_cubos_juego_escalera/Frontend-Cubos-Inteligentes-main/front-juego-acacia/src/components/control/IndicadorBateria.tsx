// Pila pequeña con el porcentaje de batería de un cubo (bajo cada casilla
// del tablero en Control y en la lista de cubos). Gris punteada cuando el
// cubo no reporta una medición válida.

import { BATERIA_BAJA_PCT } from '../../core/control/telemetria'

export default function IndicadorBateria({ pct, titulo, conTexto = true }: { pct: number | null | undefined; titulo: string; conTexto?: boolean }) {
  const sin = pct === null || pct === undefined
  const color = sin ? 'var(--color-paper-faint)'
    : pct <= BATERIA_BAJA_PCT ? 'var(--color-offline)'
      : pct <= 40 ? '#f1c21b' : 'var(--color-online)'
  return (
    <span title={titulo} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
      <span style={{
        position: 'relative', width: '18px', height: '9px', borderRadius: '2px', boxSizing: 'border-box',
        border: `1px ${sin ? 'dashed' : 'solid'} ${color}`, display: 'inline-block',
      }}>
        {!sin && (
          <span style={{ position: 'absolute', left: '1px', top: '1px', bottom: '1px', width: `calc(${Math.max(pct, 4)}% - 2px)`, background: color, borderRadius: '1px' }} />
        )}
        <span style={{ position: 'absolute', right: '-3px', top: '2px', width: '2px', height: '3px', background: color, borderRadius: '0 1px 1px 0' }} />
      </span>
      {conTexto && (
        <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color, minWidth: '22px' }}>{sin ? '—' : `${pct}%`}</span>
      )}
    </span>
  )
}
