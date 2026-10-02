// Aviso grande y imposible de pasar por alto cuando un intento termina:
// victoria (intercambio completo) o bloqueo ("camino sin retorno": la única
// jugada que queda es volver a la posición anterior). Antes solo salía una
// línea pequeña bajo el tablero y el cronómetro volvía a 0:00, así que
// terminar un intento casi no se notaba.
export default function EndBanner({ kind, title, detail }: { kind: 'victoria' | 'bloqueo'; title: string; detail: string }) {
  const color = kind === 'victoria' ? 'var(--color-online)' : 'var(--color-offline)'
  return (
    <div role="status" aria-live="polite" style={{
      display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', marginBottom: '12px',
      borderRadius: 'var(--radius)', border: `2px solid ${color}`,
      background: kind === 'victoria' ? 'rgba(66,190,101,0.14)' : 'rgba(250,77,86,0.12)',
    }}>
      <span aria-hidden="true" style={{
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '50%', background: color, color: '#0B0F10',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800,
      }}>{kind === 'victoria' ? '✓' : '✕'}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '20px', fontWeight: 800, color, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)', marginTop: '2px', lineHeight: 1.45 }}>{detail}</div>
      </div>
    </div>
  )
}
