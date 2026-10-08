import { useEffect, useRef, useState, type ReactNode } from 'react'
import { sectionLabel } from '../../ui/styles'

// Gráficos de los informes, sin librerías: barras y medidores en HTML/CSS y
// una sola curva en SVG dibujada a tamaño real (medido), no estirada — el
// texto estirado de un SVG escalado es justo lo que hacía ilegibles las
// etiquetas del grafo al acercarlo.
//
// Toda gráfica lleva dentro lo necesario para leerse sola: título, a quién y
// a qué nivel corresponde, el nombre de cada eje con su escala, la leyenda de
// todos los colores y, al pie, cómo se interpreta. Una gráfica recortada del
// informe —en una diapositiva, en un correo— tiene que seguir diciendo de qué
// sesión habla.
//
// Los colores salen de las variables del sistema, así que dentro de la hoja
// blanca del informe (clase .doc, ver index.css) se adaptan solos.

// Pie de una gráfica: cómo se lee. Ninguna se muestra sin esto.
export function ComoLeer({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: '11.5px', color: 'var(--color-paper-faint)', marginTop: '7px', lineHeight: 1.5 }}>
      <b style={{ color: 'var(--color-paper-dim)' }}>Cómo leerlo: </b>{children}
    </div>
  )
}

// Marco de una figura numerada: identificación arriba, gráfica en medio,
// lectura abajo. El número permite citarla («ver Figura 3»).
export function Figura({ numero, titulo, identificacion, derecha, comoLeer, children }: {
  numero: number
  titulo: string
  // Participante · sección · nivel: de qué sesión y qué ejercicio habla.
  identificacion: string
  derecha?: ReactNode
  comoLeer?: ReactNode
  children: ReactNode
}) {
  return (
    <figure style={{ margin: 0, border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', padding: '12px 14px', background: 'var(--color-bg)' }}>
      <figcaption style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ ...sectionLabel, color: 'var(--color-blue)' }}>Figura {numero}</span>
          <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, lineHeight: 1.3 }}>{titulo}</span>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '1px' }}>{identificacion}</span>
        </span>
        {derecha}
      </figcaption>
      {children}
      {comoLeer && <ComoLeer>{comoLeer}</ComoLeer>}
    </figure>
  )
}

// Leyenda explícita de colores/marcas: todos los que aparecen en la gráfica.
export function Leyenda({ items }: { items: { color?: string; marca?: 'linea' | 'punto' | 'barra' | 'regla'; texto: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '8px' }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--color-paper-dim)' }}>
          <span aria-hidden="true" style={
            it.marca === 'regla'
              ? { width: '3px', height: '13px', background: it.color ?? 'var(--color-paper)' }
              : it.marca === 'linea'
                ? { width: '15px', height: '3px', borderRadius: '2px', background: it.color ?? 'var(--color-paper)' }
                : it.marca === 'punto'
                  ? { width: '9px', height: '9px', borderRadius: '50%', background: it.color ?? 'var(--color-paper)' }
                  : { width: '11px', height: '11px', borderRadius: '2px', background: it.color ?? 'var(--color-paper)' }
          } />
          {it.texto}
        </span>
      ))}
    </div>
  )
}

// Eje horizontal con su escala y su nombre, bajo las barras.
function EjeX({ max, etiqueta, sangria = 0, cola = 0 }: { max: number; etiqueta: string; sangria?: number; cola?: number }) {
  const marcas = [0, Math.round(max / 2), max]
  return (
    <div style={{ marginTop: '4px' }}>
      <div style={{ display: 'flex', marginLeft: `${sangria}px`, marginRight: `${cola}px`, borderTop: '1px solid var(--color-line-strong)', paddingTop: '2px', justifyContent: 'space-between' }}>
        {marcas.map((m, i) => (
          <span key={i} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-paper-faint)' }}>{m}</span>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginLeft: `${sangria}px`, fontSize: '10.5px', color: 'var(--color-paper-dim)', marginTop: '1px' }}>
        {etiqueta} →
      </div>
    </div>
  )
}

// Nombre del eje vertical, girado.
function EtiquetaY({ children, alto }: { children: ReactNode; alto: number }) {
  return (
    <div style={{
      writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: `${alto}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '10.5px', color: 'var(--color-paper-dim)', flexShrink: 0,
    }}>{children}</div>
  )
}

// Ancho real del contenedor, para dibujar el SVG en píxeles 1:1.
function useAncho<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setAncho(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, ancho]
}

// ── Barras por intento, con la referencia del mínimo posible ────────────────
export type FilaBarra = {
  etiqueta: string
  valor: number
  referencia?: number
  color?: string
  nota?: string
}

export function BarrasConReferencia({ filas, etiquetaEjeX = 'movimientos', etiquetaEjeY = 'intento', leyenda, grupos }: {
  filas: FilaBarra[]
  etiquetaEjeX?: string
  etiquetaEjeY?: string
  // Tramos de filas que pertenecen a lo mismo (una pestaña, un nivel…): se
  // separan con su nombre para no leerlas todas de corrido.
  grupos?: GrupoEje[]
  // Qué significan los colores en esta gráfica concreta: por nivel no quieren
  // decir lo mismo que por intento.
  leyenda?: { color?: string; marca?: 'linea' | 'punto' | 'barra' | 'regla'; texto: string }[]
}) {
  const max = Math.max(1, ...filas.map(f => Math.max(f.valor, f.referencia ?? 0)))
  const ANCHO_ETIQUETA = 74, ANCHO_VALOR = 96, ANCHO_NOTA = 92
  const hayNota = filas.some(f => f.nota)
  return (
    <div>
      <Leyenda items={leyenda ?? [
        { marca: 'barra', color: 'var(--color-online)', texto: 'intento ganado' },
        { marca: 'barra', color: 'var(--color-offline)', texto: 'bloqueado' },
        { marca: 'barra', color: 'var(--color-paper-faint)', texto: 'reiniciado' },
        { marca: 'regla', color: 'var(--color-paper)', texto: 'mínimo posible del nivel (D*)' },
      ]} />
      <div style={{ display: 'flex', gap: '6px' }}>
        <EtiquetaY alto={filas.length * 22}>{etiquetaEjeY} ↓</EtiquetaY>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filas.map((f, i) => (
              <div key={i}>
                {grupos && grupos.length > 1 && grupos.some(g => g.desde === i) && (
                  <div style={{
                    ...sectionLabel, textTransform: 'none', fontSize: '10.5px', color: 'var(--color-paper-dim)',
                    borderTop: i === 0 ? undefined : '1px solid var(--color-line)',
                    paddingTop: i === 0 ? 0 : '7px', marginTop: i === 0 ? 0 : '2px', marginBottom: '4px',
                  }}>{grupos.find(g => g.desde === i)!.nombre}</div>
                )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: `${ANCHO_ETIQUETA}px`, flexShrink: 0, fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-paper-dim)' }}>{f.etiqueta}</span>
                <span style={{ flex: 1, position: 'relative', height: '16px', background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: '2px', minWidth: '60px' }}>
                  <span style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(f.valor / max) * 100}%`,
                    background: f.color ?? 'var(--color-blue)', borderRadius: '2px 0 0 2px',
                  }} />
                  {f.referencia !== undefined && (
                    <span title={`mínimo ${f.referencia}`} style={{
                      position: 'absolute', top: '-2px', bottom: '-2px', left: `${(f.referencia / max) * 100}%`,
                      width: '2px', background: 'var(--color-paper)', opacity: 0.85,
                    }} />
                  )}
                </span>
                <span style={{ width: `${ANCHO_VALOR}px`, flexShrink: 0, textAlign: 'right', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                  {f.valor}
                  {f.referencia !== undefined && <span style={{ color: 'var(--color-paper-faint)' }}> / {f.referencia}</span>}
                </span>
                {hayNota && <span style={{ width: `${ANCHO_NOTA}px`, flexShrink: 0, fontSize: '11px', color: 'var(--color-paper-faint)' }}>{f.nota ?? ''}</span>}
              </div>
              </div>
            ))}
          </div>
          <EjeX max={max} etiqueta={etiquetaEjeX} sangria={ANCHO_ETIQUETA + 8} cola={ANCHO_VALOR + 8 + (hayNota ? ANCHO_NOTA + 8 : 0)} />
        </div>
      </div>
    </div>
  )
}

// ── Barras horizontales simples (faltas por regla, etiquetas largas) ─────────
export function BarrasHorizontales({ filas, total, etiquetaEjeX = 'veces que ocurrió', etiquetaEjeY = 'regla' }: {
  filas: { etiqueta: string; valor: number; color?: string }[]
  total?: number
  etiquetaEjeX?: string
  etiquetaEjeY?: string
}) {
  const max = Math.max(1, ...filas.map(f => f.valor))
  const suma = total ?? filas.reduce((a, f) => a + f.valor, 0)
  return (
    <div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <EtiquetaY alto={filas.length * 24}>{etiquetaEjeY} ↓</EtiquetaY>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {filas.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '44%', flexShrink: 0, fontSize: '12px', color: 'var(--color-paper-dim)' }}>{f.etiqueta}</span>
                <span style={{ flex: 1, height: '14px', background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: '2px', minWidth: '40px' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(f.valor / max) * 100}%`, background: f.color ?? 'var(--color-offline)' }} />
                </span>
                <span style={{ width: '74px', flexShrink: 0, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {f.valor}
                  {suma > 0 && <span style={{ color: 'var(--color-paper-faint)' }}> · {Math.round((f.valor / suma) * 100)}%</span>}
                </span>
              </div>
            ))}
          </div>
          <EjeX max={max} etiqueta={etiquetaEjeX} cola={84} />
        </div>
      </div>
    </div>
  )
}

// ── Medidor de una métrica en [0,1] ─────────────────────────────────────────
// `optimoEn` dice dónde está lo deseable: en 0 (ramificación, buclicidad) o
// en 1 (tasa de acierto). Las zonas se pintan en ese sentido.
export function Medidor({ etiqueta, valor, optimoEn, texto, formato }: {
  etiqueta: string
  valor: number | null
  optimoEn: 0 | 1
  texto?: string
  formato?: (v: number) => string
}) {
  const v = valor === null ? 0 : Math.max(0, Math.min(1, valor))
  const zonas = optimoEn === 0
    ? [{ w: 15, c: 'var(--color-online)' }, { w: 25, c: 'var(--color-caution)' }, { w: 60, c: 'var(--color-offline)' }]
    : [{ w: 60, c: 'var(--color-offline)' }, { w: 25, c: 'var(--color-caution)' }, { w: 15, c: 'var(--color-online)' }]
  const fmt = formato ?? ((x: number) => x.toFixed(3))
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
        {/* Sin versalitas: en mayúsculas, la α del acierto se ve como A y la
            β de la buclicidad como B. */}
        <span style={{ ...sectionLabel, textTransform: 'none', fontSize: '11px', letterSpacing: '0.03em' }}>{etiqueta}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700 }}>
          {valor === null ? '—' : fmt(valor)}
        </span>
      </div>
      <div style={{ position: 'relative', height: '9px', display: 'flex', borderRadius: '5px', overflow: 'hidden', margin: '6px 0 4px', opacity: valor === null ? 0.3 : 0.85 }}>
        {zonas.map((z, i) => <span key={i} style={{ width: `${z.w}%`, background: z.c }} />)}
      </div>
      {valor !== null && (
        <div style={{ position: 'relative', height: '8px', marginTop: '-7px' }}>
          <span aria-hidden="true" style={{
            position: 'absolute', left: `calc(${v * 100}% - 4px)`, top: 0,
            width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
            borderTop: '6px solid var(--color-paper)',
          }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-paper-faint)' }}>
        <span>0 · {optimoEn === 0 ? 'mejor' : 'peor'}</span>
        <span>{optimoEn === 1 ? 'mejor' : 'peor'} · 1</span>
      </div>
      {texto && <div style={{ fontSize: '11.5px', color: 'var(--color-paper-dim)', marginTop: '4px', lineHeight: 1.45 }}>{texto}</div>}
    </div>
  )
}

// ── Evolución a lo largo de los intentos ────────────────────────────────────
// Una o varias series en [0,1]. Es la gráfica que responde a la pregunta de
// la tesis: ¿mejora intento tras intento?
export type Serie = { nombre: string; color: string; puntos: (number | null)[] }

// Tramos del eje horizontal que pertenecen a lo mismo (una pestaña, un
// perfil…). Sin esto, los puntos de distinta procedencia se leen de corrido
// como si fueran comparables entre sí, que es justo lo que no son.
export type GrupoEje = { nombre: string; desde: number; hasta: number }

export function Evolucion({ etiquetas, series, alto = 132, etiquetaEjeX = 'intentos, en el orden en que ocurrieron', grupos, pie }: {
  etiquetas: string[]
  series: Serie[]
  alto?: number
  etiquetaEjeX?: string
  grupos?: GrupoEje[]
  // Qué significan las etiquetas del eje (las iniciales de cada pestaña, por
  // ejemplo): va dentro de la gráfica, no solo en el texto de al lado.
  pie?: ReactNode
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>()
  const padL = 30, padR = 10, padT = 8, padB = 6
  const w = Math.max(0, ancho - padL - padR)
  const h = alto - padT - padB
  const n = etiquetas.length
  const px = (i: number) => padL + (n <= 1 ? w / 2 : (i / (n - 1)) * w)
  const py = (v: number) => padT + (1 - Math.max(0, Math.min(1, v))) * h
  // Bordes del tramo: a mitad de camino entre el último punto de un grupo y
  // el primero del siguiente.
  const izqDe = (g: GrupoEje) => (g.desde === 0 ? padL : (px(g.desde - 1) + px(g.desde)) / 2)
  const derDe = (g: GrupoEje) => (g.hasta >= n - 1 ? padL + w : (px(g.hasta) + px(g.hasta + 1)) / 2)
  const conGrupos = !!grupos && grupos.length > 0 && ancho > 0

  return (
    <div>
      <Leyenda items={series.map(s => ({ marca: 'linea' as const, color: s.color, texto: s.nombre }))} />
      <div style={{ display: 'flex', gap: '4px' }}>
        <EtiquetaY alto={alto}>valor normalizado (0–1)</EtiquetaY>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Nombre de cada tramo, justo encima de su franja. */}
          {conGrupos && (
            <div style={{ position: 'relative', height: '15px', width: `${ancho}px` }}>
              {grupos!.map((g, i) => (
                <span key={i} title={g.nombre} style={{
                  position: 'absolute', left: `${izqDe(g)}px`, width: `${Math.max(0, derDe(g) - izqDe(g))}px`,
                  textAlign: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--color-paper-dim)',
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}>{g.nombre}</span>
              ))}
            </div>
          )}
          <div ref={ref} style={{ width: '100%' }}>
            {ancho > 0 && (
              <svg width={ancho} height={alto} role="img" aria-label="Evolución de las métricas a lo largo de los intentos">
                {/* Franjas de los tramos, bajo todo lo demás. */}
                {conGrupos && grupos!.map((g, i) => (
                  <g key={`g${i}`}>
                    {i % 2 === 1 && (
                      <rect x={izqDe(g)} y={padT} width={Math.max(0, derDe(g) - izqDe(g))} height={h}
                        fill="var(--color-panel)" opacity={0.75} />
                    )}
                    {i > 0 && (
                      <line x1={izqDe(g)} x2={izqDe(g)} y1={padT - 3} y2={padT + h + 3}
                        stroke="var(--color-line-strong)" strokeWidth={1} strokeDasharray="4 3" />
                    )}
                  </g>
                ))}
                {[0, 0.25, 0.5, 0.75, 1].map(t => (
                  <line key={t} x1={padL} x2={padL + w} y1={py(t)} y2={py(t)}
                    stroke="var(--color-line)" strokeWidth={1} strokeDasharray={t === 0 || t === 1 ? undefined : '3 3'} />
                ))}
                {[1, 0.5, 0].map(t => (
                  <text key={t} x={padL - 5} y={py(t) + 3} textAnchor="end"
                    style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', fill: 'var(--color-paper-faint)' }}>{t.toFixed(1)}</text>
                ))}
                {series.map(s => {
                  const puntos = s.puntos.map((v, i) => (v === null ? null : [px(i), py(v)] as const))
                  // Un tramo por cada secuencia de puntos con dato: lo único que
                  // corta la línea es la falta de dato (un intento sin decisiones
                  // reales), no el cambio de franja —la curva se sigue mejor
                  // entera, y el cambio de pestaña ya se ve en la franja.
                  const tramos: (readonly [number, number])[][] = []
                  let actual: (readonly [number, number])[] = []
                  puntos.forEach(q => {
                    if (q) actual.push(q)
                    else if (actual.length) { tramos.push(actual); actual = [] }
                  })
                  // El último tramo también se dibuja: si la serie termina con
                  // dato, se quedaba abierto y sus puntos salían sueltos.
                  if (actual.length) tramos.push(actual)
                  return (
                    <g key={s.nombre}>
                      {/* Puente punteado sobre los intentos sin dato: la curva se
                          sigue de un extremo a otro, pero se ve que ahí no se
                          midió nada en vez de inventar una línea continua. */}
                      {tramos.slice(0, -1).map((t, k) => {
                        const fin = t[t.length - 1]
                        const sig = tramos[k + 1][0]
                        return (
                          <line key={`p${k}`} x1={fin[0]} y1={fin[1]} x2={sig[0]} y2={sig[1]}
                            stroke={s.color} strokeWidth={1.5} strokeDasharray="3 4" opacity={0.5} />
                        )
                      })}
                      {tramos.map((t, k) => (
                        <polyline key={k} points={t.map(([x, y]) => `${x},${y}`).join(' ')}
                          fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      ))}
                      {puntos.map((q, i) => q && <circle key={i} cx={q[0]} cy={q[1]} r={3} fill={s.color} />)}
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
          <div style={{ display: 'flex', paddingLeft: `${padL}px`, paddingRight: `${padR}px`, justifyContent: n > 1 ? 'space-between' : 'center' }}>
            {etiquetas.map((e, i) => (
              <span key={i} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-paper-faint)' }}>{e}</span>
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: '10.5px', color: 'var(--color-paper-dim)', marginTop: '2px' }}>{etiquetaEjeX} →</div>
          {pie && (
            <div style={{ textAlign: 'center', fontSize: '10.5px', color: 'var(--color-paper-faint)', marginTop: '5px', lineHeight: 1.5 }}>
              {pie}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Perfil de decisiones de un intento ──────────────────────────────────────
// Una marca por punto de decisión, en orden. Verde si eligió lo mejor; más
// alta y roja cuanto peor fue la elección. Muestra en qué tramo del intento
// se concentraron los errores, que el promedio por sí solo esconde.
export function PerfilDecisiones({ perfil }: { perfil: { movimiento: number; calidad: number }[] }) {
  if (perfil.length === 0) return null
  const ALTO = 46
  return (
    <div>
      <Leyenda items={[
        { marca: 'barra', color: 'var(--color-online)', texto: 'eligió la mejor jugada (0)' },
        { marca: 'barra', color: 'var(--color-caution)', texto: 'elección intermedia' },
        { marca: 'barra', color: 'var(--color-offline)', texto: 'eligió la peor (1)' },
      ]} />
      <div style={{ display: 'flex', gap: '4px' }}>
        <EtiquetaY alto={ALTO}>calidad: 0 abajo → 1 arriba</EtiquetaY>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '2px', height: `${ALTO}px`, padding: '4px 6px',
            background: 'var(--color-panel)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', overflowX: 'auto',
          }}>
            {perfil.map((d, i) => (
              <div key={i} title={`Movimiento ${d.movimiento}: calidad ${d.calidad.toFixed(2)}`}
                style={{
                  flex: '1 0 4px', minWidth: '4px',
                  height: `${Math.max(10, d.calidad * 100)}%`,
                  background: d.calidad === 0 ? 'var(--color-online)' : d.calidad < 0.5 ? 'var(--color-caution)' : 'var(--color-offline)',
                  borderRadius: '1px',
                }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-paper-faint)', marginTop: '2px' }}>
            <span>decisión 1</span>
            <span>decisión {perfil.length}</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: '10.5px', color: 'var(--color-paper-dim)' }}>
            decisiones reales, en el orden del intento →
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Resultados de los intentos, en proporción ───────────────────────────────
export function BarraResultados({ victorias, bloqueos, reiniciados }: { victorias: number; bloqueos: number; reiniciados: number }) {
  const total = victorias + bloqueos + reiniciados
  if (total === 0) return null
  const partes = [
    { n: victorias, c: 'var(--color-online)', t: 'ganados' },
    { n: bloqueos, c: 'var(--color-offline)', t: 'bloqueados' },
    { n: reiniciados, c: 'var(--color-line-strong)', t: 'reiniciados' },
  ].filter(p => p.n > 0)
  return (
    <div>
      <div style={{ display: 'flex', height: '16px', borderRadius: '2px', overflow: 'hidden', border: '1px solid var(--color-line)' }}>
        {partes.map(p => <span key={p.t} title={`${p.n} ${p.t}`} style={{ width: `${(p.n / total) * 100}%`, background: p.c }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-paper-faint)', marginTop: '2px' }}>
        <span>0%</span><span>{total} intentos en total</span><span>100%</span>
      </div>
      <div style={{ marginTop: '6px' }}>
        <Leyenda items={partes.map(p => ({ marca: 'barra' as const, color: p.c, texto: `${p.n} ${p.t}` }))} />
      </div>
    </div>
  )
}
