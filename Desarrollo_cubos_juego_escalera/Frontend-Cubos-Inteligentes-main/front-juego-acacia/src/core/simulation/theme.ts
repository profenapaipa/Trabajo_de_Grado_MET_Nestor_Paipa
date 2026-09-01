import type { CSSProperties } from 'react'

// Paleta deliberadamente fría (violeta/índigo) para que la pestaña de
// Simulación nunca se confunda a simple vista con el panel de Control real
// (que usa tonos cálidos, naranja/marrón). Misma estructura de tarjetas,
// distinto color, como pidió el autor.
export const SIM_BG = 'radial-gradient(ellipse at top left, #171033 0%, #0f0c26 45%, #06050f 100%)'
export const SIM_ACCENT = '#8b5cf6'
export const SIM_ACCENT_SOFT = 'rgba(139,92,246,0.18)'

export const simCard: CSSProperties = {
  background: 'rgba(18,14,38,0.85)',
  border: '1px solid rgba(70,55,110,0.6)',
  borderRadius: '12px',
  padding: '14px 16px',
}

export const simLabel: CSSProperties = { fontSize: '11px', color: '#8a82a8', letterSpacing: '0.08em' }
