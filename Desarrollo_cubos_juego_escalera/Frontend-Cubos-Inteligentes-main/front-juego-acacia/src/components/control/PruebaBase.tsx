// Prueba guiada de la base, antes de una sesión: levantar y volver a
// apoyar un cubo en cada una de las 11 casillas. Una casilla queda probada
// cuando la base la ve pasar de "ocupada" a "libre" y de nuevo a
// "ocupada" — confirma de punta a punta el cableado de esa casilla, el pin
// del maestro y el canal hasta la pantalla. Usa solo la lectura cruda de
// presencia (no la identidad de los cubos), así que no toca la partida.

import { useEffect, useRef, useState } from 'react'

type EstadoCasilla = 'pendiente' | 'levantado' | 'ok'

export default function PruebaBase({ presencia, onCerrar }: { presencia: number[] | null; onCerrar: () => void }) {
  const [estado, setEstado] = useState<EstadoCasilla[]>(() => Array(11).fill('pendiente'))
  const anterior = useRef<number[] | null>(null)

  useEffect(() => {
    if (!presencia) return
    const prev = anterior.current
    anterior.current = [...presencia]
    if (!prev) return
    setEstado(e => e.map((s, i) => {
      if (s === 'pendiente' && prev[i] === 1 && presencia[i] === 0) return 'levantado'
      if (s === 'levantado' && presencia[i] === 1) return 'ok'
      return s
    }))
  }, [presencia])

  const probadas = estado.filter(s => s === 'ok').length
  const color = (s: EstadoCasilla) => (s === 'ok' ? 'var(--color-online)' : s === 'levantado' ? '#f1c21b' : 'var(--color-line-strong)')

  return (
    <div style={{ marginTop: '12px', padding: '12px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--color-blue)', fontSize: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <b>Prueba de la base · {probadas}/11 casillas</b>
        <span style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { setEstado(Array(11).fill('pendiente')); anterior.current = presencia ? [...presencia] : null }}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-paper-dim)', textDecoration: 'underline', cursor: 'pointer', fontSize: '11px', padding: 0 }}>repetir</button>
          <button onClick={onCerrar}
            style={{ background: 'transparent', border: 'none', color: 'var(--color-paper-dim)', textDecoration: 'underline', cursor: 'pointer', fontSize: '11px', padding: 0 }}>cerrar</button>
        </span>
      </div>
      <div style={{ color: 'var(--color-paper-dim)', marginBottom: '10px', lineHeight: 1.5 }}>
        {presencia === null
          ? 'La base todavía no envía la lectura de presencia (requiere Maestro_v3 actualizado).'
          : 'Levanta y vuelve a apoyar el cubo de cada casilla, una por una. En la casilla vacía: apoya un cubo, retíralo y vuelve a apoyarlo.'}
      </div>
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
        {estado.map((s, i) => (
          <div key={i} title={s === 'ok' ? 'probada' : s === 'levantado' ? 'detectó que se levantó; falta volver a apoyar' : 'sin probar'}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${color(s)}`, background: s === 'ok' ? 'rgba(66,190,101,0.15)' : 'transparent',
              fontSize: '13px', color: color(s), fontWeight: 700,
            }}>{s === 'ok' ? '✓' : s === 'levantado' ? '↑' : ''}</div>
            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: presencia?.[i] ? 'var(--color-blue)' : 'var(--color-paper-faint)' }}>{i + 1}</span>
          </div>
        ))}
      </div>
      {probadas === 11 && <div style={{ marginTop: '8px', color: 'var(--color-online)', textAlign: 'center' }}>Las 11 casillas responden.</div>}
      {probadas >= 4 && probadas < 11 && estado.slice(0, 3).some(s => s !== 'ok') && (
        <div style={{ marginTop: '8px', fontSize: '11px', lineHeight: 1.5, color: '#f1c21b' }}>
          Si las casillas 1, 2 o 3 no llegan a ✓ aunque levantes y apoyes el cubo, probablemente es la base y no el programa
          (pin, cable o contacto de esa casilla; los pines 39, 34 y 35 no tienen resistencia interna). Intercambia de casilla dos cubos
          para saber si la falla se queda en la casilla o acompaña al cubo. Ver GUIA_ENSAYO_SESION.md, sección 1.
        </div>
      )}
    </div>
  )
}
