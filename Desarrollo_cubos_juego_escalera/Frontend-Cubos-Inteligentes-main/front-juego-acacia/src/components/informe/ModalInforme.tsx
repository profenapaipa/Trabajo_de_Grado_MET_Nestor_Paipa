import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Logo } from '../../ui/brand'
import { sectionLabel } from '../../ui/styles'
import { COLOR_BALANCE, PALABRA_BALANCE, type Balance } from './interpretar'

// Ventana emergente de los informes.
//
// El informe dejó de ser un panel más dentro de la pestaña (donde competía
// con el tablero y el grafo, y obligaba a desplazarse) y pasó a ser una hoja
// blanca sobre la consola: se abre encima, se lee de arriba abajo, se
// descarga y se cierra. La clase .doc (index.css) le da la paleta de fondo
// claro; todo lo que va dentro la hereda.
//
// Cierra con Esc, con el botón o tocando fuera de la hoja; mientras está
// abierta, la página de atrás no se desplaza.

export default function ModalInforme({ titulo, subtitulo, etiqueta, acciones, onCerrar, children }: {
  titulo: string
  subtitulo?: string
  // Distintivo de qué clase de informe es: evita confundir el del nivel con
  // el general de la sesión, que fue justo lo que pasaba antes.
  etiqueta: string
  acciones?: ReactNode
  onCerrar: () => void
  children: ReactNode
}) {
  const hojaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', onKey)
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    hojaRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previo
    }
  }, [onCerrar])

  return (
    <div className="modal-informe" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div
        ref={hojaRef}
        className="doc modal-informe__hoja"
        role="dialog"
        aria-modal="true"
        aria-label={`${etiqueta}: ${titulo}`}
        tabIndex={-1}
        style={{ outline: 'none' }}
      >
        {/* Encabezado fijo: mientras se baja por el informe siempre quedan a
            la vista de qué informe se trata y los botones de descarga. */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-line-strong)', padding: '14px 22px',
          display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
          borderRadius: '5px 5px 0 0',
        }}>
          <Logo size={34} />
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ ...sectionLabel, color: 'var(--color-blue)' }}>{etiqueta}</div>
            <div style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: '12px', color: 'var(--color-paper-dim)', marginTop: '2px' }}>{subtitulo}</div>}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {acciones}
            <button onClick={onCerrar} aria-label="Cerrar el informe" style={{
              display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
              background: 'var(--color-panel)', border: '1px solid var(--color-line-strong)',
              borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--color-paper)', fontSize: '12px',
            }}><X size={13} /> Cerrar</button>
          </div>
        </div>

        <div style={{ padding: '18px 22px 26px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Piezas comunes de la hoja ──────────────────────────────────────────────

export function Bloque({ titulo, derecha, children }: { titulo: string; derecha?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', padding: '14px 16px', background: 'var(--color-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '11px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-paper-dim)' }}>{titulo}</h3>
        {derecha}
      </div>
      {children}
    </section>
  )
}

// Síntesis en prosa, lo primero del informe: qué pasó, en tres frases.
export function Sintesis({ frases }: { frases: string[] }) {
  return (
    <div style={{
      borderLeft: '3px solid var(--color-blue)', background: 'var(--color-panel)',
      borderRadius: '0 var(--radius) var(--radius) 0', padding: '12px 16px',
    }}>
      <div style={{ ...sectionLabel, color: 'var(--color-blue)', marginBottom: '6px' }}>Síntesis</div>
      {frases.map((f, i) => (
        <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--color-paper)' }}>{f}</p>
      ))}
    </div>
  )
}

export function Dato({ valor, etiqueta, nota, color }: { valor: string; etiqueta: string; nota?: string; color?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...sectionLabel, marginBottom: '2px' }}>{etiqueta}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '21px', fontWeight: 700, lineHeight: 1.1, color: color ?? 'var(--color-paper)' }}>{valor}</div>
      {nota && <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '2px', lineHeight: 1.35 }}>{nota}</div>}
    </div>
  )
}

export function Datos({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: '14px' }}>{children}</div>
}

// Tablas del informe: encabezado tenue, filas separadas por un filo. Los
// números van alineados a la derecha y en monoespaciada, para poder
// compararlos de un vistazo columna abajo.
// Sin versalitas: `text-transform: uppercase` convertía los símbolos de las
// métricas en otras letras —la ν de retornos se veía como N y la μ de bucles
// como M—, que es justo lo contrario de lo que la tabla quiere decir.
export const th: React.CSSProperties = { ...sectionLabel, textTransform: 'none', fontSize: '11px', letterSpacing: '0.04em', textAlign: 'right', padding: '5px 7px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-line-strong)' }
export const thIzq: React.CSSProperties = { ...th, textAlign: 'left' }
export const td: React.CSSProperties = { textAlign: 'right', padding: '6px 7px', fontFamily: 'var(--font-mono)', fontSize: '12px', borderTop: '1px solid var(--color-line)' }
export const tdIzq: React.CSSProperties = { ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }

export function Tabla({ children, nota }: { children: ReactNode; nota?: string }) {
  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
      </div>
      {nota && <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '8px', lineHeight: 1.5 }}>{nota}</div>}
    </>
  )
}

// Botón de la cabecera del informe (descargas).
export const btnDoc: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
  background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)',
  borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--color-paper)', fontSize: '12px',
}

export const btnDocPrincipal: React.CSSProperties = {
  ...btnDoc, background: 'var(--color-blue)', borderColor: 'var(--color-blue)', color: '#fff', fontWeight: 600,
}

// ── Balance general ────────────────────────────────────────────────────────
// Lo primero que se ve del informe: una frase y cinco indicadores con
// semáforo. Quien no vaya a leer las ecuaciones se queda con esto; quien sí,
// encuentra el detalle debajo.
export function BalanceGeneral({ balance }: { balance: Balance }) {
  return (
    <section style={{
      border: '2px solid var(--color-blue)', borderRadius: 'var(--radius)',
      padding: '14px 16px', background: 'var(--color-panel)',
    }}>
      <div style={{ ...sectionLabel, color: 'var(--color-blue)' }}>Balance general · lo esencial en una mirada</div>
      <p style={{ margin: '6px 0 14px', fontSize: '15px', fontWeight: 600, lineHeight: 1.55 }}>{balance.titular}</p>
      {balance.indicadores.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '12px' }}>
          {balance.indicadores.map(i => (
            <div key={i.nombre} style={{
              borderLeft: `3px solid ${COLOR_BALANCE[i.nivel]}`, paddingLeft: '10px',
              background: 'var(--color-bg)', borderRadius: '0 var(--radius) var(--radius) 0', padding: '8px 10px',
            }}>
              <div style={sectionLabel}>{i.nombre}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', margin: '2px 0 3px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '19px', fontWeight: 700 }}>{i.valor}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: COLOR_BALANCE[i.nivel],
                }}>{PALABRA_BALANCE[i.nivel]}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-paper-dim)', lineHeight: 1.45 }}>{i.lectura}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// Encabezado de columna con nombre en palabras, símbolo entre paréntesis y la
// explicación al pasar el cursor. Una tabla con «Q» y «ν» a secas obliga a
// bajar hasta el glosario; así se entiende en el sitio.
export function ThM({ titulo, simbolo, ayuda, izq = false }: {
  titulo: string
  simbolo?: string
  ayuda?: string
  izq?: boolean
}) {
  return (
    <th title={ayuda} style={{ ...(izq ? thIzq : th), cursor: ayuda ? 'help' : undefined }}>
      {titulo}
      {simbolo && <span style={{ color: 'var(--color-paper-faint)', fontWeight: 400 }}> ({simbolo})</span>}
    </th>
  )
}

// Las ayudas de las columnas que se repiten en los informes.
export const AYUDA = {
  mov: 'Jugadas válidas del intento.',
  minimo: 'Mínimo de movimientos con que ese nivel se puede ganar: D* = n² + 2n.',
  q: 'Circuidad: movimientos usados dividido por el mínimo. 1,00 es la ruta más corta posible. Solo se calcula en intentos ganados.',
  r: 'Ramificación: qué tan buenas fueron las elecciones donde había más de una jugada posible. 0 es elegir siempre lo mejor.',
  acierto: 'En qué proporción de las decisiones reales eligió la mejor jugada disponible.',
  retornos: 'Veces que volvió a una posición del tablero en la que ya había estado.',
  bucles: 'Cuántos bucles distintos describió (no cuántas veces los repitió).',
  faltas: 'Jugadas prohibidas que intentó. La aplicación las rechaza y las cuenta.',
  tiempo: 'Cuánto duró el intento.',
  resultado: 'Victoria = completó el intercambio. Bloqueo = solo quedaba la jugada que prohíbe la Regla 2. Reiniciado = se empezó de nuevo.',
} as const
