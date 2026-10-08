import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, Layers, Upload } from 'lucide-react'
import { PageFrame, Panel, Badge, SectionTitle, TwoColumn, Collapsible } from '../ui/brand'
import { sectionLabel, sessionBtn, smallBtn } from '../ui/styles'
import {
  cargarArchivo, historialCsv, idDeNombre, ID_ADMIN, resumenDePerfil,
  type PerfilGuardado, type SesionArchivada,
} from '../core/session/perfiles'
import { importarBitacoras, leerBitacora, type BitacoraImportada } from '../core/session/importar'
import { NOMBRE_SECCION, faltasPorRegla, useSesion, type Seccion } from '../core/session/sesion'
import { metricasDeSesion } from '../core/simulation/metricas'
import { InformeSesion } from './informe/InformeGeneral'
import InformeMacro from './informe/InformeMacro'
import { descargarCsv } from './informe/exportar'
import { METRICAS } from './informe/fuentes'
import { n2, n3, plural, reloj } from './informe/interpretar'

// Pestaña «Informes»: lo guardado, no lo que está pasando.
//
// Hasta ahora una sesión terminada dejaba de ser consultable: el informe solo
// existía mientras la sesión estaba abierta. Aquí están todas las sesiones
// archivadas de cada perfil —se puede volver a abrir el informe de la sesión 1
// de cualquier participante—, el informe macro que las cruza todas, y la
// importación de bitácoras exportadas, para que las sesiones jugadas antes de
// que existiera este historial también tengan su informe.
//
// Cada número que aparece aquí se explica en la propia pestaña: la tabla trae
// sus columnas con nombre en palabras, cada encabezado explica qué es al
// pasar el cursor, y debajo está el significado de cada métrica sin una sola
// fórmula. Las ecuaciones y sus referencias van dentro de cada informe.

const duracionDe = (s: SesionArchivada) =>
  Math.max(0, Math.round((new Date(s.fin).getTime() - new Date(s.inicio).getTime()) / 1000))

function seccionesDe(s: SesionArchivada): Seccion[] {
  const v = new Set<Seccion>()
  s.eventos.forEach(e => v.add(e.seccion))
  s.intentos.forEach(i => v.add(i.seccion))
  return (['control', 'tutorial', 'libre', 'observador'] as Seccion[]).filter(x => v.has(x))
}

// Cada columna con el nombre que entiende cualquiera, el símbolo técnico
// cuando lo tiene y la explicación que aparece al pasar el cursor.
const COLUMNAS: { titulo: string; simbolo?: string; ayuda: string; der?: boolean }[] = [
  { titulo: 'Participante', ayuda: 'Quién jugó la sesión.' },
  { titulo: 'Fecha', ayuda: 'Cuándo empezó la sesión.' },
  { titulo: 'Duración', ayuda: 'Cuánto duró de principio a fin.', der: true },
  { titulo: 'Pestañas', ayuda: 'En qué partes de la aplicación se trabajó.' },
  { titulo: 'Niveles', ayuda: 'Con cuántos pares de fichas se jugó (de 1 a 5).' },
  { titulo: 'Intentos', ayuda: 'Cuántas partidas terminó, ganadas o no.', der: true },
  { titulo: 'Ganados', ayuda: 'En cuántas completó el intercambio de las fichas.', der: true },
  { titulo: 'Movimientos', ayuda: 'Jugadas válidas sumando todos los intentos.', der: true },
  {
    titulo: 'Eficiencia', simbolo: 'Q', der: true,
    ayuda: 'Circuidad: cuántas veces el mínimo necesario usó para ganar. 1,00 es el camino más corto posible; 1,50 son un 50 % de movimientos de más. Solo cuenta los intentos ganados.',
  },
  {
    titulo: 'Decisiones', simbolo: 'R', der: true,
    ayuda: 'Ramificación: qué tan buenas fueron las elecciones donde había más de una jugada posible. 0 es elegir siempre lo mejor; cuanto más alto, más se alejó de la mejor opción.',
  },
  { titulo: 'Faltas', ayuda: 'Jugadas prohibidas que se intentaron. La aplicación las rechaza y las cuenta.', der: true },
  { titulo: '', ayuda: '' },
]

const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', marginTop: '4px', background: 'var(--color-bg)',
  border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '7px 9px',
  color: 'var(--color-paper)', fontSize: '13px',
}

export default function InformesTab({ activo }: { activo: boolean }) {
  const { perfil, intentos: intentosEnCurso } = useSesion()
  // El archivo se vuelve a leer al entrar a la pestaña y cada vez que se
  // cierra un intento. La relectura va en un efecto a propósito: la sesión en
  // curso se archiva en un efecto del proveedor, que corre DESPUÉS de los de
  // esta pestaña; leer durante el render dejaba fuera el último intento.
  const [sello, setSello] = useState(0)
  useEffect(() => { setSello(x => x + 1) }, [activo, intentosEnCurso.length, perfil?.sesionId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const archivo = useMemo(() => cargarArchivo(), [sello])

  const [perfilSel, setPerfilSel] = useState<string | 'todos'>(perfil?.perfilId ?? 'todos')
  const [verSesion, setVerSesion] = useState<SesionArchivada | null>(null)
  const [verMacro, setVerMacro] = useState<{ perfilId?: string } | null>(null)
  const [metricasAbiertas, setMetricasAbiertas] = useState(false)

  // ── Importación de bitácoras exportadas ─────────────────────────────────
  const inputRef = useRef<HTMLInputElement>(null)
  const [partes, setPartes] = useState<BitacoraImportada[]>([])
  const [errores, setErrores] = useState<string[]>([])
  const [nombreImport, setNombreImport] = useState('')
  const [operadorImport, setOperadorImport] = useState('')
  const [unir, setUnir] = useState(true)
  const [resultado, setResultado] = useState<string | null>(null)

  async function elegirArchivos(files: FileList | null) {
    if (!files || files.length === 0) return
    const ok: BitacoraImportada[] = []
    const mal: string[] = []
    for (const f of Array.from(files)) {
      const r = leerBitacora(f.name, await f.text())
      if (r.ok) ok.push(r.datos); else mal.push(`${f.name}: ${r.error}`)
    }
    setPartes(ok)
    setErrores(mal)
    setResultado(null)
    const detectado = ok.map(x => x.participanteDetectado).find(Boolean) ?? ''
    if (detectado) setNombreImport(detectado)
  }

  function importar() {
    if (partes.length === 0 || !nombreImport.trim()) return
    const r = importarBitacoras(partes, nombreImport, operadorImport, unir)
    setResultado(`Importado en el perfil ${r.perfil}: ${plural(r.sesiones, 'sesión', 'sesiones')}, `
      + `${plural(r.intentos, 'intento reconstruido', 'intentos reconstruidos')} y ${r.eventos} eventos.`)
    setPartes([])
    setErrores([])
    if (inputRef.current) inputRef.current.value = ''
    setPerfilSel(idDeNombre(nombreImport))
    setSello(x => x + 1)
  }

  const perfilesConDatos = useMemo(() => {
    const porId = new Map<string, PerfilGuardado>(archivo.perfiles.map(p => [p.id, p]))
    const ids = new Set(archivo.sesiones.map(s => s.perfilId))
    // Se listan los perfiles con sesiones y, además, el ADMIN y el perfil en
    // curso aunque todavía no tengan ninguna.
    if (perfil) ids.add(perfil.perfilId)
    ids.add(ID_ADMIN)
    return [...ids].map(id => porId.get(id) ?? { id, nombre: id.toUpperCase(), rol: 'participante' as const, creado: '' })
      .sort((a, b) => (a.id === ID_ADMIN ? -1 : b.id === ID_ADMIN ? 1 : a.nombre.localeCompare(b.nombre)))
  }, [archivo, perfil])

  const sesiones = useMemo(
    () => archivo.sesiones
      .filter(s => perfilSel === 'todos' || s.perfilId === perfilSel)
      .slice()
      .sort((a, b) => b.inicio.localeCompare(a.inicio)), // la más reciente arriba
    [archivo, perfilSel])

  const nombreDe = (id: string) => archivo.perfiles.find(p => p.id === id)?.nombre ?? id.toUpperCase()
  const titulo = perfilSel === 'todos' ? 'Todos los perfiles' : nombreDe(perfilSel)
  const resumen = perfilSel === 'todos' ? null : resumenDePerfil(perfilSel)

  const side = (
    <>
      <Panel>
        <SectionTitle>Perfiles</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button onClick={() => setPerfilSel('todos')} style={{
            display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', cursor: 'pointer',
            background: perfilSel === 'todos' ? 'rgba(69,137,255,0.10)' : 'var(--color-bg)',
            border: `1px solid ${perfilSel === 'todos' ? 'var(--color-blue)' : 'var(--color-line)'}`,
            borderRadius: 'var(--radius)', padding: '8px 10px', color: 'var(--color-paper)', fontSize: '13px', fontWeight: 600,
          }}>
            <Layers size={14} /> Todos los perfiles
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-paper-faint)' }}>
              {archivo.sesiones.length}
            </span>
          </button>
          {perfilesConDatos.map(p => {
            const r = resumenDePerfil(p.id)
            const sel = perfilSel === p.id
            return (
              <button key={p.id} onClick={() => setPerfilSel(p.id)} style={{
                display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', cursor: 'pointer',
                background: sel ? 'rgba(69,137,255,0.10)' : 'var(--color-bg)',
                border: `1px solid ${sel ? 'var(--color-blue)' : 'var(--color-line)'}`,
                borderRadius: 'var(--radius)', padding: '8px 10px', color: 'var(--color-paper)',
              }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{p.nombre}</span>
                  <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--color-paper-faint)' }}>
                    {r.sesiones === 0 ? 'sin sesiones' : `${plural(r.sesiones, 'sesión', 'sesiones')} · ${r.intentos} intentos · ${r.victorias} ganados`}
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-paper-faint)' }}>{r.sesiones}</span>
              </button>
            )
          })}
        </div>
      </Panel>

      {resumen && resumen.sesiones > 0 && (
        <Panel>
          <SectionTitle>Acumulado de {nombreDe(perfilSel)}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px', color: 'var(--color-paper-dim)' }}>
            <div>Sesiones: <b style={{ color: 'var(--color-paper)' }}>{resumen.sesiones}</b></div>
            <div>Intentos: <b style={{ color: 'var(--color-paper)' }}>{resumen.intentos}</b> · ganados <b style={{ color: 'var(--color-online)' }}>{resumen.victorias}</b></div>
            <div>Movimientos: <b style={{ color: 'var(--color-paper)' }}>{resumen.movimientos}</b></div>
            <div>Tiempo jugado: <b style={{ color: 'var(--color-paper)' }}>{reloj(resumen.segundos)}</b></div>
            <div>Niveles: <b style={{ color: 'var(--color-paper)' }}>{resumen.niveles.map(n => n.pares).join(', ') || '—'}</b></div>
            {resumen.primera && (
              <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>
                Desde el {new Date(resumen.primera).toLocaleDateString()} hasta el {new Date(resumen.ultima!).toLocaleDateString()}
              </div>
            )}
          </div>
          <button onClick={() => descargarCsv(`historial-${nombreDe(perfilSel).toLowerCase()}`, historialCsv(perfilSel))}
            style={{ ...smallBtn, marginTop: '12px' }}>
            <Download size={11} /> Historial completo (CSV)
          </button>
        </Panel>
      )}

      {/* Traer sesiones jugadas antes de que existiera este historial. */}
      <Panel>
        <SectionTitle>Importar bitácoras</SectionTitle>
        <div style={{ fontSize: '11.5px', color: 'var(--color-paper-dim)', lineHeight: 1.55, marginBottom: '10px' }}>
          Si una sesión se jugó antes y solo quedó el archivo <b>.json</b> que se descargó entonces, aquí se vuelve a
          armar: se reconstruyen sus intentos, sus recorridos y sus métricas, y ese participante pasa a tener informe
          como cualquier otro.
        </div>
        <input ref={inputRef} type="file" accept=".json,application/json" multiple
          aria-label="Archivos de bitácora en formato JSON"
          onChange={e => elegirArchivos(e.target.files)}
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }} />
        <button onClick={() => inputRef.current?.click()} style={{ ...smallBtn, width: '100%', justifyContent: 'center', padding: '8px' }}>
          <Upload size={12} /> Elegir archivos .json
        </button>
        {partes.length === 0 && errores.length === 0 && (
          <div style={{ fontSize: '10.5px', color: 'var(--color-paper-faint)', marginTop: '6px', textAlign: 'center' }}>
            se pueden elegir varios a la vez
          </div>
        )}

        {errores.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--color-offline)', marginTop: '8px', lineHeight: 1.5 }}>
            {errores.map(e => <div key={e}>{e}</div>)}
          </div>
        )}

        {partes.length > 0 && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {partes.map(p => (
              <div key={p.archivo} style={{ fontSize: '11px', color: 'var(--color-paper-dim)', borderLeft: '2px solid var(--color-blue)', paddingLeft: '8px' }}>
                <div style={{ color: 'var(--color-paper)', fontWeight: 600 }}>{NOMBRE_SECCION[p.seccion]}</div>
                <div>{plural(p.intentos.length, 'intento', 'intentos')} · {p.eventos.length} eventos · {new Date(p.inicio).toLocaleDateString()}</div>
                {p.participanteDetectado && <div>detectado: {p.participanteDetectado}</div>}
                {p.aviso && <div style={{ color: 'var(--color-caution)' }}>{p.aviso}</div>}
              </div>
            ))}
            <label style={{ display: 'block' }}>
              <span style={{ ...sectionLabel, color: 'var(--color-blue)' }}>Participante</span>
              <input value={nombreImport} onChange={e => setNombreImport(e.target.value)}
                placeholder="nombre del perfil" style={campo} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={sectionLabel}>Operador</span>
              <input value={operadorImport} onChange={e => setOperadorImport(e.target.value)}
                placeholder="opcional" style={campo} />
            </label>
            {partes.length > 1 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: 'var(--color-paper-dim)' }}>
                <input type="checkbox" checked={unir} onChange={e => setUnir(e.target.checked)} />
                Unir los {partes.length} archivos en una sola sesión
              </label>
            )}
            <button onClick={importar} disabled={!nombreImport.trim()}
              style={{ ...sessionBtn(!!nombreImport.trim(), 'var(--color-blue)'), justifyContent: 'center', fontSize: '13px', padding: '8px' }}>
              <Upload size={14} /> Importar
            </button>
          </div>
        )}

        {resultado && (
          <div style={{ fontSize: '11.5px', color: 'var(--color-online)', marginTop: '10px', lineHeight: 1.5 }}>{resultado}</div>
        )}
      </Panel>
    </>
  )

  const main = (
    <>
      <Panel style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={sectionLabel}>Informe macro · entre sesiones</div>
          <div style={{ fontSize: '19px', fontWeight: 700, margin: '2px 0 3px' }}>{titulo}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-paper-dim)', lineHeight: 1.5 }}>
            {sesiones.length === 0
              ? 'Sin sesiones guardadas todavía.'
              : `${plural(sesiones.length, 'sesión guardada', 'sesiones guardadas')}. El informe macro las cruza todas: `
                + 'cómo cambia de una sesión a la siguiente, qué niveles ya domina y por dónde vuelve a pasar.'}
          </div>
        </div>
        <button
          onClick={() => setVerMacro({ perfilId: perfilSel === 'todos' ? undefined : perfilSel })}
          disabled={sesiones.length === 0}
          style={sessionBtn(sesiones.length > 0, 'var(--color-blue)')}>
          <Layers size={15} /> Generar informe macro
        </button>
      </Panel>

      <Panel>
        <SectionTitle right={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>
          la más reciente arriba · {plural(sesiones.length, 'sesión', 'sesiones')}
        </span>}>
          Sesiones guardadas
        </SectionTitle>

        {sesiones.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)', lineHeight: 1.6 }}>
            Todavía no hay sesiones guardadas para este perfil en este equipo. Cada sesión se archiva sola en cuanto se
            termina un intento, así que aparecerá aquí sin tener que hacer nada. Si la sesión se jugó antes y solo quedó
            su archivo .json, puedes traerla con «Importar bitácoras».
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {COLUMNAS.map((c, i) => (
                    <th key={i} title={c.ayuda} style={{
                      ...sectionLabel, textTransform: 'none', fontSize: '11px', letterSpacing: '0.04em',
                      textAlign: c.der ? 'right' : 'left', cursor: c.ayuda ? 'help' : 'default',
                      padding: '5px 7px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--color-line-strong)',
                    }}>
                      {c.titulo}
                      {c.simbolo && <span style={{ color: 'var(--color-paper-faint)', fontWeight: 400 }}> ({c.simbolo})</span>}
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {sesiones.map(ses => {
                    const m = metricasDeSesion(ses.intentos)
                    const hayDec = ses.intentos.some(i => i.metricas.puntosDecision > 0)
                    const faltas = Object.values(faltasPorRegla(ses.eventos)).reduce((a, b) => a + b, 0)
                    const niveles = [...new Set(ses.intentos.map(i => i.pares))].sort((a, b) => a - b)
                    const enCurso = perfil?.sesionId === ses.sesionId
                    const importada = ses.sesionId.startsWith('importada-')
                    const td: React.CSSProperties = {
                      textAlign: 'right', padding: '7px', fontFamily: 'var(--font-mono)', fontSize: '12px',
                      borderTop: '1px solid var(--color-line)',
                    }
                    const tdI: React.CSSProperties = { ...td, textAlign: 'left', fontFamily: 'var(--font-sans)' }
                    return (
                      <tr key={ses.sesionId}>
                        <td style={{ ...tdI, fontWeight: 600 }}>
                          {ses.participante}
                          {enCurso && <span style={{ marginLeft: '7px', fontSize: '10px', color: 'var(--color-online)' }}>· en curso</span>}
                          {importada && <span style={{ marginLeft: '7px', fontSize: '10px', color: 'var(--color-paper-faint)' }}>· importada</span>}
                        </td>
                        <td style={tdI}>{new Date(ses.inicio).toLocaleString()}</td>
                        <td style={td}>{reloj(duracionDe(ses))}</td>
                        <td style={{ ...tdI, fontSize: '11px', color: 'var(--color-paper-dim)' }}>
                          {seccionesDe(ses).map(x => NOMBRE_SECCION[x]).join(', ') || '—'}
                        </td>
                        <td style={{ ...tdI, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{niveles.join(', ') || '—'}</td>
                        <td style={td}>{m.intentos}</td>
                        <td style={{ ...td, color: m.victorias ? 'var(--color-online)' : 'var(--color-paper-faint)', fontWeight: 700 }}>{m.victorias}</td>
                        <td style={td}>{m.movimientosTotales}</td>
                        <td style={td} title={m.victorias ? `${n2(m.circuidadMedia)} veces el mínimo necesario` : 'sin intentos ganados'}>
                          {m.victorias ? n2(m.circuidadMedia) : '—'}
                        </td>
                        <td style={td} title={hayDec ? '0 sería elegir siempre la mejor jugada' : 'no hubo decisiones reales que medir'}>
                          {hayDec ? n3(m.ramificacionMedia) : '—'}
                        </td>
                        <td style={{ ...td, color: faltas ? 'var(--color-offline)' : 'var(--color-paper-faint)' }}>{faltas}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <button onClick={() => setVerSesion(ses)} style={smallBtn}>
                            <FileText size={11} /> Ver informe
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* La tabla no se deja sola: las dos columnas con símbolo llevan
                aquí su lectura, para no tener que abrir un informe. */}
            <div style={{
              marginTop: '12px', padding: '10px 12px', background: 'var(--color-bg)',
              borderLeft: '3px solid var(--color-blue)', borderRadius: '0 var(--radius) var(--radius) 0',
              fontSize: '11.5px', color: 'var(--color-paper-dim)', lineHeight: 1.6,
            }}>
              <b style={{ color: 'var(--color-paper)' }}>Cómo leer esta tabla: </b>
              <b>Eficiencia (Q)</b> es cuántas veces el mínimo necesario usó para ganar — 1,00 es el camino más corto
              posible, y solo se calcula con los intentos ganados. <b>Decisiones (R)</b> resume si eligió bien cuando
              tenía varias jugadas posibles — 0 es elegir siempre lo mejor y, cuanto más alto, más se alejó.
              Un <b>—</b> significa que esa sesión no tiene con qué calcularlo, no que el valor sea cero.
              Al pasar el cursor por cualquier encabezado se explica qué es, y justo debajo de esta tabla está la
              explicación de todas las métricas, sin fórmulas.
            </div>
          </>
        )}

        <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '12px', lineHeight: 1.55 }}>
          Las sesiones se guardan en este navegador y en este equipo: si se usa otro computador o se borran los datos del
          navegador, el historial no viaja. Para conservarlo fuera de la aplicación, descarga el historial en CSV o el
          informe macro.
        </div>
      </Panel>

      {/* La explicación completa, sin fórmulas, disponible sin abrir nada. */}
      <Collapsible
        title="¿Qué significan Q, R y las demás? — las métricas explicadas sin fórmulas"
        open={metricasAbiertas} onToggle={() => setMetricasAbiertas(o => !o)}>
        <Panel>
          <div style={{ fontSize: '12px', color: 'var(--color-paper-dim)', marginBottom: '12px', lineHeight: 1.6 }}>
            Todas las medidas salen del mismo sitio: el recorrido que hace quien juega sobre el mapa de posiciones del
            juego (el grafo de estados). Con esta tabla alcanza para leer cualquier informe; las ecuaciones, su número
            en el documento de la tesis y las referencias están dentro de cada informe, al final.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Símbolo', 'Métrica', 'Qué mide', 'Cómo se lee un valor'].map(c => (
                  <th key={c} style={{
                    ...sectionLabel, textTransform: 'none', fontSize: '11px', letterSpacing: '0.04em',
                    textAlign: 'left', padding: '5px 7px', borderBottom: '1px solid var(--color-line-strong)',
                  }}>{c}</th>
                ))}
              </tr></thead>
              <tbody>
                {METRICAS.map(m => (
                  <tr key={m.simbolo}>
                    <td style={{ padding: '6px 7px', borderTop: '1px solid var(--color-line)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px' }}>{m.simbolo}</td>
                    <td style={{ padding: '6px 7px', borderTop: '1px solid var(--color-line)', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>{m.nombre}</td>
                    <td style={{ padding: '6px 7px', borderTop: '1px solid var(--color-line)', fontSize: '12px', color: 'var(--color-paper-dim)' }}>{m.queMide}</td>
                    <td style={{ padding: '6px 7px', borderTop: '1px solid var(--color-line)', fontSize: '12px', color: 'var(--color-paper-dim)' }}>{m.ejemplo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Collapsible>
    </>
  )

  return (
    <PageFrame subtitle="Informes" traceColor="var(--color-blue)"
      badge={<Badge color="var(--color-blue)">SESIONES GUARDADAS</Badge>}>
      <TwoColumn main={main} side={side} />

      {verSesion && (
        <InformeSesion
          datos={{
            perfil: {
              participante: verSesion.participante,
              operador: verSesion.operador,
              perfilId: verSesion.perfilId,
              rol: archivo.perfiles.find(p => p.id === verSesion.perfilId)?.rol ?? 'participante',
              sesionId: verSesion.sesionId,
              inicio: verSesion.inicio,
            },
            eventos: verSesion.eventos,
            intentos: verSesion.intentos,
            duracionSeg: duracionDe(verSesion),
            archivada: true,
          }}
          onCerrar={() => setVerSesion(null)} />
      )}

      {verMacro && (
        <InformeMacro perfilId={verMacro.perfilId} onCerrar={() => setVerMacro(null)} />
      )}
    </PageFrame>
  )
}
