import type { ReactNode } from 'react'
import { TEAM_HEX } from '../../ui/styles'

// Reglas de La Escalera en lenguaje para cualquier edad, cada una con su
// propio dibujo — antes eran dos tarjetas que no decían qué estaba
// prohibido, y en la práctica los errores más comunes (retroceder, saltar
// al propio color, saltar un hueco) no estaban explicados en ninguna parte.

// Mini tablero a partir de un patrón: A = azul, B = roja, _ = vacía.
export function MiniBoard({ pattern, size = 24 }: { pattern: string; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
      {pattern.split('').map((c, i) => (
        <span key={i} style={{
          width: `${size}px`, height: `${Math.round(size * 1.12)}px`, borderRadius: '4px', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: c === 'A' ? TEAM_HEX.A : c === 'B' ? TEAM_HEX.B : '#808080',
          opacity: c === '_' ? 0.55 : 1,
          color: '#fff', fontSize: `${Math.round(size * 0.5)}px`, fontWeight: 700,
        }}>
          {c === 'A' ? '→' : c === 'B' ? '←' : ''}
        </span>
      ))}
    </span>
  )
}

function Arrow() {
  return <span aria-hidden="true" style={{ color: 'var(--color-paper-faint)', fontSize: '16px', margin: '0 6px' }}>⟶</span>
}

function Rule({ n, title, children, pic }: { n: number; title: string; children: ReactNode; pic: ReactNode }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--color-blue)' }}>{n}</span>
        <span style={{ fontWeight: 700, fontSize: '15px' }}>{title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>{pic}</div>
      <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)', lineHeight: 1.5 }}>{children}</div>
    </div>
  )
}

function Forbidden({ pic, children }: { pic: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span aria-hidden="true" style={{ color: 'var(--color-offline)', fontWeight: 700, fontSize: '16px', width: '14px' }}>✕</span>
      <span style={{ flexShrink: 0 }}>{pic}</span>
      <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>{children}</span>
    </div>
  )
}

function RulesCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
        <Rule n={1} title="Cambiar de lado" pic={<><MiniBoard pattern="AA_BB" /><Arrow /><MiniBoard pattern="BB_AA" /></>}>
          Las fichas azules tienen que terminar a la derecha y las rojas a la izquierda.
        </Rule>
        <Rule n={2} title="Siempre hacia adelante" pic={<><MiniBoard pattern="A" /><span style={{ fontSize: '12px', margin: '0 8px 0 4px', color: 'var(--color-paper-dim)' }}>derecha</span><MiniBoard pattern="B" /><span style={{ fontSize: '12px', marginLeft: '4px', color: 'var(--color-paper-dim)' }}>izquierda</span></>}>
          Cada ficha avanza solo en la dirección de su flecha. Ninguna ficha retrocede.
        </Rule>
        <Rule n={3} title="Deslizar" pic={<><MiniBoard pattern="A_" /><Arrow /><MiniBoard pattern="_A" /></>}>
          Si la casilla de adelante está vacía (gris), la ficha avanza a ella.
        </Rule>
        <Rule n={4} title="Saltar" pic={<><MiniBoard pattern="AB_" /><Arrow /><MiniBoard pattern="_BA" /></>}>
          La ficha pasa por encima de <b>una</b> ficha del <b>otro color</b>, si justo detrás hay una casilla vacía.
        </Rule>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px 16px', padding: '12px 14px', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)' }}>
        <div style={{ gridColumn: '1 / -1', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--color-offline)', textTransform: 'uppercase' }}>No se puede</div>
        <Forbidden pic={<MiniBoard pattern="_A" size={18} />}>Retroceder (la azul no vuelve a la casilla de su izquierda)</Forbidden>
        <Forbidden pic={<MiniBoard pattern="AA_" size={18} />}>Saltar sobre tu propio color</Forbidden>
        <Forbidden pic={<MiniBoard pattern="ABB_" size={18} />}>Saltar dos fichas a la vez</Forbidden>
        <Forbidden pic={<MiniBoard pattern="AB" size={18} />}>Ir a una casilla que ya tiene ficha</Forbidden>
      </div>

      <div style={{ fontSize: '12px', color: 'var(--color-paper-dim)', lineHeight: 1.5 }}>
        <b style={{ color: 'var(--color-online)' }}>Ganas</b> cuando todas cambiaron de lado.{' '}
        <b style={{ color: 'var(--color-offline)' }}>Te bloqueas</b> si ninguna ficha puede moverse y aún no terminaste — tranquilo, se vuelve a intentar.
        <span style={{ display: 'block', marginTop: '4px', color: 'var(--color-paper-faint)', fontSize: '11px' }}>
          Fuente: main.tex, "El juego La Escalera como problema matemático bien definido". La condición de bloqueo fue una decisión explícita del autor para esta simulación.
        </span>
      </div>
    </div>
  )
}

export default RulesCard
