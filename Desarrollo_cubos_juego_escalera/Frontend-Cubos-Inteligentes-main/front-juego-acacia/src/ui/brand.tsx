import { useState, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import type { PPAPhase } from '../core/ppa/ppaColors'
import { panel, sectionLabel, smallBtn } from './styles'

// Piezas de identidad compartidas por las 3 pestañas (Control Mago de Oz,
// Simulación, Observador) — una sola definición, para que la marca no
// diverja entre vistas.

// Glifos de señal neuronal, uno por fase PPA: Pausar = actividad calma,
// Pensar = búsqueda irregular, Actuar = un potencial de acción.
const SIGNAL_PATH: Record<PPAPhase, string> = {
  pausar: 'M2,13 Q9,7 16,13 Q23,7 30,13',
  pensar: 'M2,13 L7,5 L12,17 L17,7 L22,15 L27,9 L30,13',
  actuar: 'M2,13 L11,13 L13.5,2 L16,20 L18.5,13 L30,13',
}
export function SignalGlyph({ phase, color }: { phase: PPAPhase; color: string }) {
  return (
    <svg width="32" height="22" viewBox="0 0 32 22" fill="none" aria-hidden="true">
      <path d={SIGNAL_PATH[phase]} stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Trazo EEG bajo el encabezado. Única animación deliberada del sistema: un
// destello periódico que lo recorre (@keyframes eeg-sweep en index.css).
const EEG_TRACE = '0,10 22,10 28,3 34,17 40,10 74,10 80,4 86,16 92,10 130,10 137,2 144,18 151,10 190,10 196,5 202,15 208,10 250,10 256,3 262,17 268,10 310,10 316,4 322,16 328,10 370,10 376,3 383,17 390,10 400,10'
export function EegTrace({ color }: { color: string }) {
  return (
    <svg width="100%" height="18" viewBox="0 0 400 20" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <polyline points={EEG_TRACE} fill="none" stroke={color} strokeWidth="1.1" />
      <polyline
        points={EEG_TRACE} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"
        pathLength={100}
        style={{ mixBlendMode: 'screen', animation: 'eeg-sweep 7s linear infinite' }}
      />
    </svg>
  )
}

// Marcador tipo electrodo (relleno = señal presente).
export function Electrode({ on, colorOn = 'var(--color-blue)', colorOff = 'var(--color-offline)' }: { on: boolean; colorOn?: string; colorOff?: string }) {
  return (
    <span style={{
      width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block', flexShrink: 0,
      background: on ? colorOn : 'transparent',
      border: `1.5px solid ${on ? colorOn : colorOff}`,
    }} />
  )
}

// Marca del proyecto: escalera geométrica, mitad azul (equipo A) y mitad
// roja (equipo B) que suben hasta un mismo pico.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * (20 / 32)} viewBox="0 0 32 20" aria-hidden="true">
      <path d="M0,20 L5.3,20 L5.3,14 L10.6,14 L10.6,8 L16,8 L16,2 L16,20 Z" fill="var(--color-blue)" />
      <path d="M16,2 L16,8 L21.3,8 L21.3,14 L26.7,14 L26.7,20 L32,20 L16,20 Z" fill="var(--color-red)" />
    </svg>
  )
}

// Medio escalón (mitad izquierda del logo), monocromo — marcador de títulos.
export function StepMark({ color = 'var(--color-paper-faint)', size = 13 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M0,16 L5.3,16 L5.3,10.7 L10.6,10.7 L10.6,5.3 L16,5.3 L16,16 Z" fill={color} />
    </svg>
  )
}

export function SectionTitle({ children, right, color }: { children: ReactNode; right?: ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
      <span style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: '6px', color: color ?? sectionLabel.color }}>
        <StepMark color={color} />{children}
      </span>
      {right}
    </div>
  )
}

// ── Marca de agua ────────────────────────────────────────────────────────────
type WatermarkLogo = { x: number; y: number; rotation: number; size: number }

// Semi-diagonal del logo a un tamaño dado — su "radio" una vez rotado.
function logoRadius(size: number): number {
  const h = size * (20 / 32)
  return Math.sqrt(size * size + h * h) / 2
}

// Copias del logo con posición, giro y tamaño al azar en cada entrada a la
// vista, separadas por muestreo con rechazo para que nunca se toquen.
function generateWatermarkLogos(width: number, height: number): WatermarkLogo[] {
  const COUNT = 38
  const MARGIN = 40
  const GAP = 18
  const MAX_ATTEMPTS = 500
  const placed: (WatermarkLogo & { r: number })[] = []
  for (let i = 0; i < COUNT; i++) {
    const size = 28 + Math.random() * 60
    const r = logoRadius(size)
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const x = MARGIN + Math.random() * Math.max(width - MARGIN * 2, 1)
      const y = MARGIN + Math.random() * Math.max(height - MARGIN * 2, 1)
      const collides = placed.some(l => Math.hypot(l.x - x, l.y - y) < l.r + r + GAP)
      if (!collides) {
        placed.push({ x, y, rotation: Math.random() * 360, size, r })
        break
      }
    }
  }
  return placed.map(({ x, y, rotation, size }) => ({ x, y, rotation, size }))
}

// Marco común de cada pestaña: fondo con retícula de osciloscopio, marca
// de agua aleatoria, encabezado de marca con trazo EEG, y una única región
// con scroll (la pestaña nunca agrega un segundo scrollbar).
export function PageFrame({ subtitle, traceColor, badge, children }: {
  subtitle: string
  traceColor: string
  badge?: ReactNode
  children: ReactNode
}) {
  const [watermark] = useState(() => generateWatermarkLogos(window.innerWidth, window.innerHeight))
  return (
    <div style={{
      height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: 'var(--color-bg)',
      backgroundImage: 'radial-gradient(circle, var(--color-line) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
      color: 'var(--color-paper)', fontFamily: 'var(--font-sans)', position: 'relative',
    }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {watermark.map((l, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${l.x}px`, top: `${l.y}px`,
            transform: `translate(-50%, -50%) rotate(${l.rotation}deg)`,
            opacity: 0.16,
          }}>
            <Logo size={l.size} />
          </div>
        ))}
      </div>

      <div style={{
        flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column',
        maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '16px 20px', gap: '12px',
        boxSizing: 'border-box', position: 'relative', zIndex: 1,
      }}>
        <header style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Logo size={46} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Escalera Inteligente</h1>
            <span style={{ ...sectionLabel, fontWeight: 500 }}>{subtitle}</span>
            {badge && <div style={{ marginLeft: 'auto' }}>{badge}</div>}
          </div>
          <div style={{ marginTop: '8px' }}>
            <EegTrace color={traceColor} />
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}

// Distintivo tipo píldora con borde (modo de la vista, estado de conexión).
export function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '20px',
      border: `1px solid ${color}`, color, fontSize: '11px', fontWeight: 600,
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
    }}>
      {children}
    </div>
  )
}

// Nombre de quien opera/registra — resaltado mientras falta, porque es lo
// primero que se debe hacer al entrar. Siempre en mayúsculas.
export function PersonField({ label, value, onConfirm, onClear, placeholder = 'nombre + Enter' }: {
  label: string
  value: string
  onConfirm: (name: string) => void
  onClear: () => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  return (
    <div>
      <div style={{ ...sectionLabel, color: 'var(--color-blue)', fontSize: '11px' }}>{label}</div>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <Electrode on />
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-paper)' }}>{value}</span>
          <button onClick={onClear} style={{
            marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '11px', color: 'var(--color-paper-faint)', textDecoration: 'underline', padding: 0,
          }}>cambiar</button>
        </div>
      ) : (
        <div style={{ marginTop: '8px' }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) onConfirm(draft.trim().toUpperCase()) }}
            placeholder={placeholder}
            autoFocus
            title="Escribe el nombre y confirma con Enter — queda en cada evento de la bitácora. No es un identificador oficial del proyecto (ver DECISIONES_PROYECTO.md)."
            style={{
              background: 'rgba(69,137,255,0.08)', border: '1px solid var(--color-blue)',
              borderRadius: 'var(--radius)', padding: '8px 10px', color: 'var(--color-paper)', fontSize: '14px',
              width: '100%', boxSizing: 'border-box',
            }} />
          <div style={{ fontSize: '10px', color: 'var(--color-blue)', marginTop: '5px' }}>Escribe tu nombre y presiona Enter para empezar</div>
        </div>
      )}
    </div>
  )
}

export function ParesPicker({ value, onChange, label = 'Pares' }: { value: number; onChange: (n: number) => void; label?: string }) {
  return (
    <div>
      <div style={sectionLabel}>{label}</div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            width: '26px', height: '26px', cursor: 'pointer', borderRadius: 'var(--radius)',
            background: value === n ? 'var(--color-blue)' : 'var(--color-bg)',
            color: value === n ? '#fff' : 'var(--color-paper-dim)',
            border: `1px solid ${value === n ? 'var(--color-blue)' : 'var(--color-line-strong)'}`,
            fontWeight: 700, fontSize: '12px',
          }}>{n}</button>
        ))}
      </div>
    </div>
  )
}

// Sección colapsable con encabezado liviano (filo inferior, sin caja) —
// el mismo tratamiento del Histórico de Control.
export function Collapsible({ title, open, onToggle, children }: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <>
      <button onClick={onToggle} style={{
        background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-line)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
        flexShrink: 0, textAlign: 'left', width: '100%', padding: '6px 2px',
      }}>
        <StepMark />
        <span style={sectionLabel}>{title}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-paper-faint)' }}>{open ? '−' : '+'}</span>
      </button>
      {open && children}
    </>
  )
}

// Bitácora exportable: título + CSV/JSON + lista (más reciente arriba).
export type LogRow = { ts: string; tag: string; text: string }
export function LogPanel({ title, rows, empty, onCsv, onJson, maxHeight = 160 }: {
  title: string
  rows: LogRow[]
  empty: string
  onCsv: () => void
  onJson: () => void
  maxHeight?: number
}) {
  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <span style={sectionLabel}>{title} · {rows.length}</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onCsv} style={smallBtn}><Download size={11} /> CSV</button>
          <button onClick={onJson} style={smallBtn}><Download size={11} /> JSON</button>
        </div>
      </div>
      <div style={{ maxHeight: `${maxHeight}px`, overflowY: 'auto', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
        {rows.length === 0 && <div style={{ color: 'var(--color-paper-faint)' }}>{empty}</div>}
        {[...rows].reverse().map((r, i) => (
          <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid var(--color-line)', color: 'var(--color-paper-dim)' }}>
            <span style={{ color: 'var(--color-paper-faint)' }}>{r.ts}</span> · <span style={{ color: 'var(--color-blue)' }}>{r.tag}</span> · {r.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// Columna principal + barra lateral fija de 280px — la misma proporción de
// Control Mago de Oz, para que las 3 pestañas se lean igual.
export function TwoColumn({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>{main}</div>
      <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>{side}</div>
    </div>
  )
}

// Panel con el estilo base — atajo para no repetir `{...panel, ...}`.
export function Panel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...panel, ...style }}>{children}</div>
}
