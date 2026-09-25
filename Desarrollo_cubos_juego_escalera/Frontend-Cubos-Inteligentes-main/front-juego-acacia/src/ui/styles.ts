import type { CSSProperties } from 'react'

// Estilos compartidos del sistema visual v4 ("consola neurocientífica") —
// una sola fuente para Control Mago de Oz, Simulación y Observador. Sin
// `transition` decorativa en ningún estilo (regla dura #1).

export const panel: CSSProperties = {
  background: 'var(--color-panel)',
  border: '1px solid var(--color-line)',
  borderRadius: 'var(--radius)',
  padding: '14px 16px',
}

export const sectionLabel: CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600,
  letterSpacing: '0.1em', color: 'var(--color-paper-faint)', textTransform: 'uppercase',
}

// Píldoras de relleno sólido — reservadas para la acción principal de cada
// vista (Iniciar/Pausar/Reiniciar en Control, Pista/Deshacer/Siguiente
// nivel en el tutorial). El resto de la interfaz usa bordes discretos.
export const sessionBtn = (enabled: boolean, tone: string): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px',
  borderRadius: '999px', cursor: enabled ? 'pointer' : 'not-allowed',
  background: enabled ? tone : 'var(--color-line)',
  border: `1px solid ${enabled ? tone : 'var(--color-line-strong)'}`,
  color: enabled ? '#fff' : 'var(--color-paper-faint)',
  fontWeight: 700, fontSize: '13px',
})

// Botón pequeño con borde (exportar CSV/JSON, acciones secundarias).
export const smallBtn: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '4px',
  background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)',
  borderRadius: 'var(--radius)', padding: '4px 8px',
  color: 'var(--color-paper)', fontSize: '11px', cursor: 'pointer',
}

// Cuenta regresiva como un semáforo real: rojo mientras se espera (3, 2),
// amarillo de aviso justo antes (1), verde al arrancar (0/"¡INICIA!").
export const countdownSemaforo = (t: number): { bg: string; text: string } =>
  t === 0 ? { bg: 'var(--color-online)', text: '#ffffff' }
    : t === 1 ? { bg: 'var(--color-caution)', text: '#1a1300' }
      : { bg: 'var(--color-offline)', text: '#ffffff' }

// Colores reales del hardware de cada equipo — los mismos que el cubo
// físico, no los acentos de interfaz (--color-blue/--color-red).
export const TEAM_HEX = { A: '#0000ff', B: '#ff0000' } as const
