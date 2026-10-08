import { useMemo, useRef } from 'react'
import { Download } from 'lucide-react'
import type { Core } from 'cytoscape'
import {
  NOMBRE_SECCION, REGLA_DE_ERROR, faltasPorRegla,
  type IntentoSesion, type EventoSesion, type Seccion,
} from '../../core/session/sesion'
import {
  cargarArchivo, historialCsv, type PerfilGuardado, type SesionArchivada,
} from '../../core/session/perfiles'
import { metricasDeSesion } from '../../core/simulation/metricas'
import GrafoEstados from '../simulation/GrafoEstados'
import ModalInforme, {
  AYUDA, BalanceGeneral, Bloque, Sintesis, Dato, Datos, Tabla, ThM, td, tdIzq, btnDoc, btnDocPrincipal,
} from './ModalInforme'
import BloqueFuentes from './BloqueFuentes'
import { BarrasConReferencia, BarrasHorizontales, Evolucion, Figura, Leyenda, type GrupoEje } from './graficos'
import {
  balanceDe, leerTendencia, n2, n3, nivelLabel, plural, reloj, tendencia,
} from './interpretar'
import { csvDeIntentos, descargarCsv, descargarHtml, descargarJson, nombreArchivo, type DocInforme } from './exportar'

// Informe MACRO: todas las sesiones guardadas, de un perfil o de todos.
//
// Los informes del nivel y de la sesión miran un momento; este mira la
// trayectoria completa de quien juega: cómo cambia de una sesión a otra, qué
// niveles domina y cuáles sigue repitiendo. Es la pregunta que la tesis
// quiere responder, y hasta ahora no se podía contestar desde la aplicación
// porque una sesión terminada dejaba de ser consultable.
//
// Se alimenta del archivo de perfiles (core/session/perfiles.ts), no de la
// sesión en curso; la sesión de hoy también está ahí, porque se archiva en
// cuanto se cierra un intento.

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString()
const fechaHora = (iso: string) => new Date(iso).toLocaleString()
const duracionDe = (s: SesionArchivada) =>
  Math.max(0, Math.round((new Date(s.fin).getTime() - new Date(s.inicio).getTime()) / 1000))

const COLS_SESION = ['Sesión', 'Fecha', 'Duración', 'Pestañas', 'Niveles', 'Intentos', 'Ganados', 'Movimientos',
  'Eficiencia Q', 'Decisiones R', 'Bucles β', 'Faltas']

function seccionesDe(s: SesionArchivada): Seccion[] {
  const v = new Set<Seccion>()
  s.eventos.forEach(e => v.add(e.seccion))
  s.intentos.forEach(i => v.add(i.seccion))
  return (['control', 'tutorial', 'libre', 'observador'] as Seccion[]).filter(x => v.has(x))
}

function filaSesion(s: SesionArchivada, i: number, perfiles: Map<string, string>, conNombre: boolean): (string | number)[] {
  const m = metricasDeSesion(s.intentos)
  const conDecisiones = s.intentos.some(x => x.metricas.puntosDecision > 0)
  const faltas = Object.values(faltasPorRegla(s.eventos)).reduce((a, b) => a + b, 0)
  const niveles = [...new Set(s.intentos.map(x => x.pares))].sort((a, b) => a - b)
  return [
    conNombre ? `${perfiles.get(s.perfilId) ?? s.perfilId} · S${i + 1}` : `Sesión ${i + 1}`,
    fechaHora(s.inicio),
    reloj(duracionDe(s)),
    seccionesDe(s).map(x => NOMBRE_SECCION[x]).join(', ') || '—',
    niveles.length ? niveles.join(', ') : '—',
    m.intentos, m.victorias, m.movimientosTotales,
    m.victorias ? n2(m.circuidadMedia) : '—',
    conDecisiones ? n3(m.ramificacionMedia) : '—',
    n3(m.buclicidadMedia),
    faltas,
  ]
}

export default function InformeMacro({ perfilId, onCerrar }: { perfilId?: string; onCerrar: () => void }) {
  const grafos = useRef<Map<number, Core>>(new Map())

  const archivo = useMemo(() => cargarArchivo(), [])
  const perfilesPorId = useMemo(
    () => new Map<string, string>(archivo.perfiles.map((p: PerfilGuardado) => [p.id, p.nombre])),
    [archivo])
  const sesiones = useMemo(
    () => archivo.sesiones
      .filter(s => !perfilId || s.perfilId === perfilId)
      .slice()
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [archivo, perfilId])

  const quien = perfilId ? (perfilesPorId.get(perfilId) ?? perfilId) : 'todos los perfiles'
  const intentos: IntentoSesion[] = useMemo(() => sesiones.flatMap(s => s.intentos), [sesiones])
  const eventos: EventoSesion[] = useMemo(() => sesiones.flatMap(s => s.eventos), [sesiones])
  const faltas = useMemo(() => faltasPorRegla(eventos), [eventos])
  const totalFaltas = Object.values(faltas).reduce((a, b) => a + b, 0)
  const recortadas = sesiones.filter(s => s.eventosRecortados).length

  const global = metricasDeSesion(intentos)
  const conDecisiones = intentos.some(i => i.metricas.puntosDecision > 0)
  const balance = balanceDe(intentos, faltas)
  const niveles = useMemo(() => [...new Set(intentos.map(i => i.pares))].sort((a, b) => a - b), [intentos])
  const segundosTotales = sesiones.reduce((a, s) => a + duracionDe(s), 0)

  // Una fila por nivel, acumulando todas las sesiones.
  const porNivel = useMemo(() => niveles.map(pares => {
    const del = intentos.filter(i => i.pares === pares)
    const ganados = del.filter(i => i.resultado === 'victoria')
    const m = metricasDeSesion(del)
    const mejor = ganados.length ? Math.min(...ganados.map(i => i.metricas.movimientos)) : 0
    const masCorto = del.length ? Math.min(...del.filter(i => i.metricas.movimientos > 0).map(i => i.metricas.movimientos)) : 0
    return {
      pares, optimo: pares * pares + 2 * pares, intentos: del.length, ganados: ganados.length,
      mejor, masCorto, resumen: m,
      conDecisiones: del.some(i => i.metricas.puntosDecision > 0),
      sesionesConEseNivel: sesiones.filter(s => s.intentos.some(i => i.pares === pares)).length,
    }
  }), [niveles, intentos, sesiones])

  // Recorridos acumulados por nivel, de todas las sesiones: el mapa completo
  // de por dónde ha pasado este perfil a lo largo del tiempo.
  const recorridosPorNivel = useMemo(() => {
    const m = new Map<number, number[][]>()
    for (const i of intentos) {
      if (i.recorrido.length < 2) continue
      if (!m.has(i.pares)) m.set(i.pares, [])
      m.get(i.pares)!.push(i.recorrido)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [intentos])

  // Una métrica por sesión, para ver la evolución entre sesiones.
  const porSesion = useMemo(() => sesiones.map(s => {
    const m = metricasDeSesion(s.intentos)
    const hayDecisiones = s.intentos.some(i => i.metricas.puntosDecision > 0)
    return {
      ramificacion: hayDecisiones ? m.ramificacionMedia : null,
      buclicidad: s.intentos.length ? m.buclicidadMedia : null,
      acierto: hayDecisiones ? m.tasaAciertoMedia : null,
      circuidad: m.victorias ? m.circuidadMedia : null,
    }
  }), [sesiones])

  // Con todos los perfiles en la misma gráfica, cada uno es un tramo: las
  // sesiones de dos participantes distintos no forman una sola curva.
  const gruposPerfil = useMemo(() => {
    if (perfilId) return undefined
    const out: GrupoEje[] = []
    sesiones.forEach((s, k) => {
      const ult = out[out.length - 1]
      if (ult && sesiones[k - 1].perfilId === s.perfilId) ult.hasta = k
      else out.push({ nombre: perfilesPorId.get(s.perfilId) ?? s.perfilId, desde: k, hasta: k })
    })
    return out
  }, [sesiones, perfilId, perfilesPorId])

  const tR = tendencia(porSesion.map(x => x.ramificacion), 'menor')
  const tB = tendencia(porSesion.map(x => x.buclicidad), 'menor')

  const frases = useMemo(() => {
    if (sesiones.length === 0) {
      return ['Todavía no hay ninguna sesión guardada para este perfil. En cuanto se juegue una, aparecerá aquí con su historial completo.']
    }
    const out: string[] = []
    out.push(
      `${plural(sesiones.length, 'sesión guardada', 'sesiones guardadas')} de ${quien}, `
      + `entre el ${fechaCorta(sesiones[0].inicio)} y el ${fechaCorta(sesiones[sesiones.length - 1].fin)}: `
      + `${plural(intentos.length, 'intento terminado', 'intentos terminados')}, ${global.victorias} con el objetivo cumplido, `
      + `en ${plural(niveles.length, 'nivel', 'niveles')} (${niveles.map(nivelLabel).join(', ') || 'ninguno'}).`,
    )
    const dominados = porNivel.filter(n => n.ganados > 0 && n.mejor <= n.optimo)
    if (dominados.length) {
      out.push(`Resolvió por la ruta mínima en ${plural(dominados.length, 'nivel', 'niveles')}: `
        + `${dominados.map(n => `${nivelLabel(n.pares)} (${n.mejor} movimientos)`).join(', ')}.`)
    }
    const pendientes = porNivel.filter(n => n.ganados === 0)
    if (pendientes.length) {
      out.push(`Sin ganar todavía: ${pendientes.map(n => nivelLabel(n.pares)).join(', ')}.`)
    }
    if (sesiones.length < 2) {
      out.push('Con una sola sesión todavía no hay con qué comparar: la evolución se podrá leer a partir de la segunda.')
    } else if (tR === 'sin-datos' && tB === 'sin-datos') {
      out.push(`Con ${plural(sesiones.length, 'sesión', 'sesiones')} todavía no hay suficiente recorrido para afirmar una `
        + 'tendencia entre sesiones: la comparación se hace entre la primera y la segunda mitad del historial, y para eso '
        + 'hacen falta al menos cuatro sesiones.')
    } else {
      out.push(`Entre sesiones, la calidad de las decisiones ${leerTendencia(tR, 'sesiones')} y la buclicidad `
        + `${leerTendencia(tB, 'sesiones')}.`)
    }
    return out
  }, [sesiones, quien, intentos, global, niveles, porNivel, tR, tB])

  const base = nombreArchivo('informe-macro', perfilId ? quien : 'todos')
  const ident = `${quien} · ${plural(sesiones.length, 'sesión', 'sesiones')} · generado el ${new Date().toLocaleDateString()}`

  let k = 0
  const figEvolucion = sesiones.length > 1 ? ++k : 0
  const figNiveles = porNivel.length ? ++k : 0
  const figFaltas = totalFaltas > 0 ? ++k : 0
  const primeraFigGrafo = k

  function imagenDe(pares: number): string | null {
    const cy = grafos.current.get(pares)
    if (!cy) return null
    try { return cy.png({ full: true, scale: 1.6, bg: '#ffffff' }) } catch { return null }
  }

  function documento(): DocInforme {
    return {
      etiqueta: 'Informe macro · todas las sesiones',
      titulo: `Trayectoria de ${quien}`,
      subtitulo: sesiones.length
        ? `${plural(sesiones.length, 'sesión', 'sesiones')} entre el ${fechaCorta(sesiones[0].inicio)} y el ${fechaCorta(sesiones[sesiones.length - 1].fin)}`
        : 'Sin sesiones guardadas',
      meta: [
        { etiqueta: 'Sesiones', valor: `${sesiones.length}` },
        { etiqueta: 'Intentos', valor: `${intentos.length}` },
        { etiqueta: 'Ganados', valor: `${global.victorias}` },
        { etiqueta: 'Niveles', valor: niveles.map(nivelLabel).join(', ') || '—' },
        { etiqueta: 'Generado', valor: new Date().toLocaleString() },
      ],
      balance,
      sintesis: frases,
      secciones: [
        {
          titulo: 'Acumulado',
          datos: [
            { etiqueta: 'Sesiones', valor: `${sesiones.length}` },
            { etiqueta: 'Tiempo total', valor: reloj(segundosTotales) },
            { etiqueta: 'Intentos', valor: `${intentos.length}` },
            { etiqueta: 'Ganados', valor: `${global.victorias}` },
            { etiqueta: 'Movimientos', valor: `${global.movimientosTotales}` },
            { etiqueta: 'Circuidad media', valor: global.victorias ? n2(global.circuidadMedia) : '—' },
            { etiqueta: 'Ramificación media', valor: conDecisiones ? n3(global.ramificacionMedia) : '—' },
            { etiqueta: 'Buclicidad media', valor: n3(global.buclicidadMedia) },
            { etiqueta: 'Faltas', valor: `${totalFaltas}` },
          ],
        },
        {
          titulo: 'Sesión por sesión',
          tablas: [{
            cols: COLS_SESION,
            alineacion: ['izq', 'izq', 'der', 'izq', 'izq', 'der', 'der', 'der', 'der', 'der', 'der', 'der'],
            filas: sesiones.map((s, i) => filaSesion(s, i, perfilesPorId, !perfilId)),
            nota: 'Q = circuidad media de los intentos ganados · R = ramificación media · β = buclicidad media.',
          }],
        },
        {
          titulo: 'Nivel por nivel, acumulado',
          tablas: [{
            cols: ['Nivel', 'Mínimo', 'Sesiones', 'Intentos', 'Ganados', 'Mejor marca', 'R media', 'β media'],
            alineacion: ['izq', 'der', 'der', 'der', 'der', 'der', 'der', 'der'],
            filas: porNivel.map(n => [
              nivelLabel(n.pares), n.optimo, n.sesionesConEseNivel, n.intentos, n.ganados,
              n.ganados ? `${n.mejor} mov.` : '—',
              n.conDecisiones ? n3(n.resumen.ramificacionMedia) : '—',
              n3(n.resumen.buclicidadMedia),
            ]),
          }],
        },
        {
          titulo: 'Faltas a cada regla, acumuladas',
          parrafos: totalFaltas === 0
            ? ['No hay ninguna jugada rechazada en las sesiones guardadas.']
            : (recortadas > 0 ? [`Nota: ${plural(recortadas, 'sesión antigua', 'sesiones antiguas')} tuvieron que soltar su detalle de eventos por falta de espacio en el navegador, así que sus faltas no están contadas aquí.`] : []),
          tablas: totalFaltas === 0 ? [] : [{
            cols: ['Regla infringida', 'Veces'],
            alineacion: ['izq', 'der'] as ('izq' | 'der')[],
            filas: Object.entries(faltas).sort((a, b) => b[1] - a[1]).map(([t, v]) => [REGLA_DE_ERROR[t] ?? t, v]),
          }],
        },
      ],
      graficos: recorridosPorNivel.map(([pares, rutas], i) => ({
        titulo: `Figura ${primeraFigGrafo + 1 + i}. Grafo acumulado · ${nivelLabel(pares)} · `
          + `${plural(rutas.length, 'recorrido', 'recorridos')} de todas las sesiones · ${ident}`,
        dataUrl: imagenDe(pares),
        nota: 'verde = inicio, azul = final, trazo más grueso = camino más repetido a lo largo de las sesiones',
      })),
    }
  }

  const acciones = (
    <>
      <button onClick={() => descargarHtml(base, documento())} style={btnDocPrincipal}>
        <Download size={13} /> Descargar informe
      </button>
      <button
        onClick={() => descargarCsv(base, perfilId
          ? historialCsv(perfilId)
          : csvDeIntentos(
            sesiones.flatMap((s, i) => s.intentos.map(x => [
              perfilesPorId.get(s.perfilId) ?? s.perfilId, `S${i + 1}`, s.inicio, NOMBRE_SECCION[x.seccion], x.numero, x.pares,
              x.resultado, x.segundos, x.metricas.movimientos, x.metricas.optimo,
              x.resultado === 'victoria' ? x.metricas.circuidad.toFixed(4) : '',
              x.metricas.puntosDecision ? x.metricas.ramificacion.toFixed(4) : '',
              x.metricas.retornos, x.metricas.buclicidad.toFixed(4), x.errores, x.recorrido.join(' '),
            ])),
            ['perfil', 'sesion', 'inicio', 'seccion', 'intento', 'pares', 'resultado', 'segundos', 'movimientos',
              'optimo', 'circuidad', 'ramificacion', 'retornos', 'buclicidad', 'errores', 'recorrido']))}
        style={btnDoc}>CSV</button>
      <button onClick={() => descargarJson(base, {
        informe: 'macro', perfil: quien, generado: new Date().toISOString(),
        balance, sintesis: frases, acumulado: global, porNivel, sesiones,
      })} style={btnDoc}>JSON</button>
    </>
  )

  return (
    <ModalInforme
      etiqueta="Informe macro · todas las sesiones"
      titulo={`Trayectoria de ${quien}`}
      subtitulo={sesiones.length
        ? `${plural(sesiones.length, 'sesión guardada', 'sesiones guardadas')} · ${plural(intentos.length, 'intento', 'intentos')} · `
          + `del ${fechaCorta(sesiones[0].inicio)} al ${fechaCorta(sesiones[sesiones.length - 1].fin)}`
        : 'Sin sesiones guardadas todavía'}
      acciones={acciones}
      onCerrar={onCerrar}
    >
      <BalanceGeneral balance={balance} />
      <Sintesis frases={frases} />

      {sesiones.length === 0 ? (
        <Bloque titulo="Sin datos">
          <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)' }}>
            Este perfil todavía no tiene sesiones guardadas en este equipo.
          </div>
        </Bloque>
      ) : (
        <>
          <Datos>
            <Dato etiqueta="Sesiones" valor={`${sesiones.length}`} nota={`${reloj(segundosTotales)} en total`} />
            <Dato etiqueta="Intentos" valor={`${intentos.length}`} nota={`${global.victorias} ganados · ${global.bloqueos} bloqueos`} />
            <Dato etiqueta="Movimientos" valor={`${global.movimientosTotales}`} nota="en todas las sesiones" />
            <Dato etiqueta="Niveles" valor={`${niveles.length}`} nota={niveles.map(nivelLabel).join(', ')} />
            <Dato etiqueta="Circuidad media" valor={global.victorias ? n2(global.circuidadMedia) : '—'} nota="solo intentos ganados" />
            <Dato etiqueta="Ramificación media" valor={conDecisiones ? n3(global.ramificacionMedia) : '—'} nota="R · 0 = óptimo" />
            <Dato etiqueta="Buclicidad media" valor={n3(global.buclicidadMedia)} nota="β · retornos / movimientos" />
            <Dato etiqueta="Faltas" valor={`${totalFaltas}`} nota="jugadas rechazadas"
              color={totalFaltas ? 'var(--color-offline)' : 'var(--color-online)'} />
          </Datos>

          {figEvolucion > 0 && (
            <Figura numero={figEvolucion} titulo="Evolución entre sesiones" identificacion={ident}
              derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>decisiones: {leerTendencia(tR, 'sesiones')}</span>}
              comoLeer={<>cada punto es una sesión completa, en orden cronológico (eje horizontal); el eje vertical es el
                promedio normalizado de esa sesión, de 0 a 1. Esta es la lectura de trazabilidad entre sesiones: si las dos
                primeras curvas bajan y la verde sube, el esquema de solución se está consolidando. Donde la línea va punteada,
                esa sesión no tuvo decisiones reales que medir: el punteado salta el hueco en vez de inventar un cero.{gruposPerfil ? ' Cada franja es un participante distinto, '
                + 'separada por una línea punteada: la comparación se hace dentro de una franja, no entre participantes.' : ''}</>}>
              <Evolucion
                etiquetas={sesiones.map((_, i) => `S${i + 1}`)}
                etiquetaEjeX={perfilId ? 'sesiones guardadas, de la más antigua a la más reciente' : 'sesiones guardadas, agrupadas por participante'}
                grupos={gruposPerfil}
                series={[
                  { nombre: 'Ramificación R (0 es mejor)', color: 'var(--color-blue)', puntos: porSesion.map(x => x.ramificacion) },
                  { nombre: 'Buclicidad β (0 es mejor)', color: 'var(--color-caution)', puntos: porSesion.map(x => x.buclicidad) },
                  { nombre: 'Acierto α (1 es mejor)', color: 'var(--color-online)', puntos: porSesion.map(x => x.acierto) },
                ]} />
            </Figura>
          )}

          {figNiveles > 0 && (
            <Figura numero={figNiveles} titulo="Mejor marca de cada nivel frente al mínimo posible" identificacion={ident}
              comoLeer={<>una fila por nivel jugado. La barra es la mejor partida conseguida y la marca vertical, el mínimo
                posible de ese nivel (D* = n² + 2n). Verde = ese nivel se ha ganado; gris = todavía no, y la barra muestra el
                intento más corto hecho hasta ahora.</>}>
              <BarrasConReferencia
                etiquetaEjeX="movimientos de la mejor partida"
                etiquetaEjeY="nivel"
                leyenda={[
                  { marca: 'barra', color: 'var(--color-online)', texto: 'nivel ganado alguna vez' },
                  { marca: 'barra', color: 'var(--color-paper-faint)', texto: 'todavía sin ganar' },
                  { marca: 'regla', color: 'var(--color-paper)', texto: 'mínimo posible del nivel (D*)' },
                ]}
                filas={porNivel.map(n => ({
                  etiqueta: nivelLabel(n.pares),
                  valor: n.ganados ? n.mejor : n.masCorto,
                  referencia: n.optimo,
                  color: n.ganados ? 'var(--color-online)' : 'var(--color-paper-faint)',
                  nota: n.ganados ? `${n.ganados} de ${n.intentos}` : 'sin ganar',
                }))} />
            </Figura>
          )}

          <Bloque titulo="Sesión por sesión"
            derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>{plural(sesiones.length, 'sesión', 'sesiones')}</span>}>
            <Tabla nota="Q = circuidad media de los intentos ganados · R = ramificación media · β = buclicidad media.">
              <thead><tr>
                <ThM izq titulo="Sesión" /><ThM izq titulo="Fecha" />
                <ThM titulo="Duración" ayuda="Cuánto duró la sesión de principio a fin." />
                <ThM izq titulo="Pestañas" ayuda="En qué partes de la aplicación se trabajó." />
                <ThM izq titulo="Niveles" ayuda="Con cuántos pares de fichas se jugó." />
                <ThM titulo="Intentos" ayuda="Partidas terminadas en esa sesión." />
                <ThM titulo="Ganados" ayuda="Cuántas completaron el intercambio." />
                <ThM titulo="Movimientos" ayuda={AYUDA.mov} />
                <ThM titulo="Eficiencia" simbolo="Q" ayuda={AYUDA.q} /><ThM titulo="Decisiones" simbolo="R" ayuda={AYUDA.r} />
                <ThM titulo="Bucles" simbolo="β" ayuda="Buclicidad media: qué proporción de las jugadas terminó en una posición ya visitada." />
                <ThM titulo="Faltas" ayuda={AYUDA.faltas} />
              </tr></thead>
              <tbody>
                {sesiones.map((ses, i) => {
                  const fila = filaSesion(ses, i, perfilesPorId, !perfilId)
                  return (
                    <tr key={ses.sesionId}>
                      {fila.map((v, j) => (
                        <td key={j} style={j === 0 || j === 1 || j === 3 || j === 4 ? tdIzq : td}>{v}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </Tabla>
          </Bloque>

          <Bloque titulo="Nivel por nivel, acumulado">
            <Tabla nota="«Mejor marca» es la partida ganada más corta de todas las sesiones; el mínimo de cada nivel es D* = n² + 2n.">
              <thead><tr>
                <ThM izq titulo="Nivel" /><ThM titulo="Mínimo" ayuda={AYUDA.minimo} />
                <ThM titulo="Sesiones" ayuda="En cuántas sesiones distintas apareció este nivel." />
                <ThM titulo="Intentos" /><ThM titulo="Ganados" />
                <ThM titulo="Mejor marca" ayuda="La partida ganada más corta de todas las sesiones." />
                <ThM titulo="Decisiones" simbolo="R" ayuda={AYUDA.r} />
                <ThM titulo="Bucles" simbolo="β" ayuda="Buclicidad media del nivel." />
              </tr></thead>
              <tbody>
                {porNivel.map(n => (
                  <tr key={n.pares}>
                    <td style={tdIzq}>{nivelLabel(n.pares)}</td>
                    <td style={td}>{n.optimo}</td>
                    <td style={td}>{n.sesionesConEseNivel}</td>
                    <td style={td}>{n.intentos}</td>
                    <td style={{ ...td, color: n.ganados ? 'var(--color-online)' : 'var(--color-paper-faint)', fontWeight: 700 }}>{n.ganados}</td>
                    <td style={td}>{n.ganados ? `${n.mejor}` : '—'}</td>
                    <td style={td}>{n.conDecisiones ? n3(n.resumen.ramificacionMedia) : '—'}</td>
                    <td style={td}>{n3(n.resumen.buclicidadMedia)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </Bloque>

          {figFaltas > 0 && (
            <Figura numero={figFaltas} titulo="Faltas a cada regla, acumuladas" identificacion={ident}
              comoLeer={<>cuántas veces se intentó cada jugada prohibida en todas las sesiones guardadas. Si una regla
                concentra las faltas sesión tras sesión, es la que conviene volver a explicar.</>}>
              <BarrasHorizontales
                etiquetaEjeX="veces que se intentó"
                filas={Object.entries(faltas).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ etiqueta: REGLA_DE_ERROR[t] ?? t, valor: v }))}
                total={totalFaltas} />
              {recortadas > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '8px' }}>
                  {plural(recortadas, 'sesión antigua', 'sesiones antiguas')} soltaron su detalle de eventos por falta de espacio
                  en el navegador: sus faltas no están contadas aquí.
                </div>
              )}
            </Figura>
          )}

          {recorridosPorNivel.length > 0 && (
            <Bloque titulo={`Grafos acumulados · ${plural(recorridosPorNivel.length, 'nivel', 'niveles')}`}>
              <div style={{ fontSize: '12px', color: 'var(--color-paper-dim)', marginBottom: '12px' }}>
                Todos los recorridos de todas las sesiones, superpuestos por nivel: el mapa de por dónde ha pasado este perfil
                a lo largo del tiempo.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '16px' }}>
                {recorridosPorNivel.map(([pares, rutas], i) => (
                  <Figura key={pares} numero={primeraFigGrafo + 1 + i}
                    titulo={`Grafo acumulado · ${nivelLabel(pares)}`}
                    identificacion={`${ident} · ${plural(rutas.length, 'recorrido', 'recorridos')}`}
                    comoLeer={<>las líneas más gruesas son los caminos que este perfil repite sesión tras sesión; las finas,
                      los que recorrió una sola vez. Al pasar el cursor por un punto se ve qué posición es y cuántas veces pasó por ella.</>}>
                    <div style={{ marginBottom: '8px' }}>
                      <Leyenda items={[
                        { marca: 'punto', color: 'var(--color-online)', texto: 'Inicio' },
                        { marca: 'punto', color: 'var(--color-blue)', texto: 'Fin (objetivo)' },
                        { marca: 'punto', color: 'var(--color-offline)', texto: 'camino sin retorno' },
                      ]} />
                    </div>
                    <GrafoEstados
                      pares={pares}
                      previos={rutas.slice(0, -1)}
                      actual={rutas[rutas.length - 1]}
                      height={360} seguimiento={false} modo="informe"
                      onCy={cy => { if (cy) grafos.current.set(pares, cy); else grafos.current.delete(pares) }} />
                  </Figura>
                ))}
              </div>
            </Bloque>
          )}
        </>
      )}

      <BloqueFuentes />
    </ModalInforme>
  )
}
