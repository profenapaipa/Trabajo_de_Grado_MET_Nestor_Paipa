import { useMemo, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import type { Core } from 'cytoscape'
import {
  useSesion, NOMBRE_SECCION, REGLA_DE_ERROR, faltasPorRegla, contarTipo,
  type Seccion, type IntentoSesion, type EventoSesion, type Perfil,
} from '../../core/session/sesion'
import { historialCsv, resumenDePerfil, sesionesDePerfil } from '../../core/session/perfiles'
import { metricasDeSesion } from '../../core/simulation/metricas'
import GrafoEstados from '../simulation/GrafoEstados'
import ModalInforme, {
  AYUDA, BalanceGeneral, Bloque, Sintesis, Dato, Datos, Tabla, ThM, th, thIzq, td, tdIzq, btnDoc, btnDocPrincipal,
} from './ModalInforme'
import BloqueFuentes from './BloqueFuentes'
import { BarraResultados, BarrasConReferencia, BarrasHorizontales, Evolucion, Figura, Leyenda, type GrupoEje } from './graficos'
import {
  balanceDe, n2, n3, nivelLabel, pct, plural, reloj, sintesisSesion, leerTendencia, tendencia,
} from './interpretar'
import { csvDeIntentos, descargarCsv, descargarHtml, descargarJson, nombreArchivo, type DocInforme } from './exportar'

// Informe GENERAL de la sesión: reúne en un solo documento lo trabajado en
// las cuatro pestañas y en todos los niveles — tiempos, movimientos frente al
// mínimo, faltas a cada regla, bucles, ramificación, un grafo por cada
// nivel-sección jugado y el historial del perfil.
//
// Se abre con «Terminar sesión» y es distinto del informe del nivel
// (InformeNivel.tsx), que mira un solo nivel de una sola pestaña.
//
// El mismo cuerpo sirve para la sesión en curso y para una sesión ya
// archivada (pestaña Informes): por eso recibe los datos como parámetro en
// vez de leerlos del contexto. Solo la sesión en curso ofrece cerrarla.

const COLS_INTENTO = ['Sección', 'Intento', 'Pares', 'Resultado', 'Movimientos', 'Mínimo', 'Eficiencia Q',
  'Decisiones R', 'Acierto α', 'Retornos ν', 'Bucles μ', 'Faltas', 'Tiempo']

function filaIntento(i: IntentoSesion): (string | number)[] {
  return [
    NOMBRE_SECCION[i.seccion], `#${i.numero}`, i.pares,
    i.resultado === 'victoria' ? 'Victoria' : i.resultado === 'bloqueo' ? 'Bloqueo' : 'Reiniciado',
    i.metricas.movimientos || '—', i.metricas.optimo,
    i.resultado === 'victoria' ? n2(i.metricas.circuidad) : '—',
    i.metricas.puntosDecision ? n3(i.metricas.ramificacion) : '—',
    i.metricas.puntosDecision ? pct(i.metricas.tasaAcierto) : '—',
    i.metricas.movimientos ? i.metricas.retornos : '—',
    i.metricas.movimientos ? i.metricas.ciclosIndependientes : '—',
    i.errores, reloj(i.segundos),
  ]
}

const colorResultado = (r: IntentoSesion['resultado']) =>
  r === 'victoria' ? 'var(--color-online)' : r === 'bloqueo' ? 'var(--color-offline)' : 'var(--color-paper-faint)'

const SIGLA: Record<Seccion, string> = { control: 'C', tutorial: 'T', libre: 'L', observador: 'O' }

export type DatosSesion = {
  perfil: Perfil
  eventos: EventoSesion[]
  intentos: IntentoSesion[]
  duracionSeg: number
  // Una sesión ya terminada se rotula como tal y no se puede cerrar de nuevo.
  archivada?: boolean
}

export function InformeSesion({ datos, onCerrar, onCerrarSesion }: {
  datos: DatosSesion
  onCerrar: () => void
  onCerrarSesion?: () => void
}) {
  const { perfil, eventos, intentos, duracionSeg, archivada } = datos
  const grafos = useRef<Map<string, Core>>(new Map())
  const [confirmarCierre, setConfirmarCierre] = useState(false)

  const seccionesTrabajadas = useMemo(() => {
    const vistas = new Set<Seccion>()
    eventos.forEach(e => vistas.add(e.seccion))
    intentos.forEach(i => vistas.add(i.seccion))
    return (['control', 'tutorial', 'libre', 'observador'] as Seccion[]).filter(x => vistas.has(x))
  }, [eventos, intentos])

  const global = metricasDeSesion(intentos)
  // Sin decisiones reales (p. ej. solo el nivel de 1 par) no hay ramificación
  // ni acierto que promediar: mostrar 0 % haría pensar que falló siempre.
  const conDecisiones = intentos.some(i => i.metricas.puntosDecision > 0)
  const faltas = useMemo(() => faltasPorRegla(eventos), [eventos])
  const totalFaltas = Object.values(faltas).reduce((a, b) => a + b, 0)
  const reiniciados = intentos.filter(i => i.resultado === 'reiniciado').length
  const frases = sintesisSesion(intentos, faltas, seccionesTrabajadas, duracionSeg)
  const balance = balanceDe(intentos, faltas)

  // Tramos del eje: intentos seguidos de la misma pestaña. Sin separarlos,
  // la curva se lee de corrido y parece comparar cosas que no se comparan.
  const gruposPestana = useMemo(() => {
    const out: GrupoEje[] = []
    intentos.forEach((i, k) => {
      const ult = out[out.length - 1]
      if (ult && intentos[k - 1].seccion === i.seccion) ult.hasta = k
      else out.push({ nombre: NOMBRE_SECCION[i.seccion], desde: k, hasta: k })
    })
    return out
  }, [intentos])

  // Combinaciones sección + pares efectivamente jugadas, para dibujar su grafo.
  const combos = useMemo(() => {
    const m = new Map<string, { seccion: Seccion; pares: number; recorridos: number[][] }>()
    for (const i of intentos) {
      if (i.recorrido.length < 2) continue
      const k = `${i.seccion}|${i.pares}`
      if (!m.has(k)) m.set(k, { seccion: i.seccion, pares: i.pares, recorridos: [] })
      m.get(k)!.recorridos.push(i.recorrido)
    }
    return [...m.values()].sort((a, b) => a.seccion.localeCompare(b.seccion) || a.pares - b.pares)
  }, [intentos])

  // Historial del perfil: las sesiones anteriores (la de ahora ya está
  // archivada, así que se excluye para no contarla dos veces).
  const historial = useMemo(
    () => sesionesDePerfil(perfil.perfilId).filter(s => s.sesionId !== perfil.sesionId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perfil, intentos.length])
  const resumenPerfil = useMemo(() => resumenDePerfil(perfil.perfilId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perfil, intentos.length])

  const base = nombreArchivo('informe-sesion', perfil.participante)
  // Identificación que llevan todas las figuras, para que una gráfica
  // recortada del informe siga diciendo de qué sesión habla.
  const ident = `${perfil.participante} · sesión del ${new Date(perfil.inicio).toLocaleDateString()} `
    + `${new Date(perfil.inicio).toLocaleTimeString()} · operador ${perfil.operador || '(sin asignar)'}`

  // Numeración de las figuras, saltando las que no aplican.
  let k = 0
  const figResultados = intentos.length ? ++k : 0
  const figEvolucion = intentos.length > 1 ? ++k : 0
  const figBarras = intentos.length ? ++k : 0
  const figFaltas = totalFaltas > 0 ? ++k : 0
  const primeraFigGrafo = k

  function imagenDe(k: string): string | null {
    const cy = grafos.current.get(k)
    if (!cy) return null
    try { return cy.png({ full: true, scale: 1.6, bg: '#ffffff' }) } catch { return null }
  }

  function documento(): DocInforme {
    const quien = perfil
    const porSeccion = seccionesTrabajadas.map(s => {
      const deSeccion = intentos.filter(i => i.seccion === s)
      const m = metricasDeSesion(deSeccion)
      const ev = eventos.filter(e => e.seccion === s)
      const f = faltasPorRegla(eventos, s)
      const totalF = Object.values(f).reduce((a, b) => a + b, 0)
      return {
        titulo: NOMBRE_SECCION[s],
        datos: [
          { etiqueta: 'Intentos', valor: `${m.intentos}` },
          { etiqueta: 'Ganados', valor: `${m.victorias}` },
          { etiqueta: 'Movimientos', valor: `${m.movimientosTotales}` },
          { etiqueta: 'Retornos', valor: `${m.retornosTotales}` },
          { etiqueta: 'Faltas', valor: `${totalF}` },
          { etiqueta: 'Tiempo', valor: reloj(m.segundosTotales) },
          { etiqueta: 'Eventos', valor: `${ev.length}` },
        ],
        parrafos: deSeccion.length === 0
          ? ['Se trabajó en esta sección, pero no se terminó ningún intento con movimientos.']
          : [],
        tablas: deSeccion.length === 0 ? [] : [{
          cols: COLS_INTENTO,
          alineacion: ['izq', 'izq', 'der', 'izq', 'der', 'der', 'der', 'der', 'der', 'der', 'der', 'der', 'der'] as ('izq' | 'der')[],
          filas: deSeccion.map(filaIntento),
        }],
      }
    })

    return {
      etiqueta: 'Informe general de la sesión',
      titulo: `Sesión de ${quien.participante}`,
      subtitulo: `Operador: ${quien.operador || '(sin asignar)'} · Perfil: ${quien.participante} (${quien.rol})`,
      meta: [
        { etiqueta: 'Inicio', valor: new Date(quien.inicio).toLocaleString() },
        { etiqueta: 'Duración', valor: reloj(duracionSeg) },
        { etiqueta: 'Secciones', valor: seccionesTrabajadas.map(s => NOMBRE_SECCION[s]).join(', ') || 'ninguna' },
        { etiqueta: 'Intentos', valor: `${global.intentos}` },
        { etiqueta: 'Generado', valor: new Date().toLocaleString() },
      ],
      balance,
      sintesis: frases,
      secciones: [
        {
          titulo: 'Resumen de la sesión',
          datos: [
            { etiqueta: 'Intentos', valor: `${global.intentos}` },
            { etiqueta: 'Ganados', valor: `${global.victorias}` },
            { etiqueta: 'Bloqueos', valor: `${global.bloqueos}` },
            { etiqueta: 'Movimientos', valor: `${global.movimientosTotales}` },
            { etiqueta: 'Circuidad media', valor: global.victorias ? n2(global.circuidadMedia) : '—' },
            { etiqueta: 'Ramificación media', valor: conDecisiones ? n3(global.ramificacionMedia) : '—' },
            { etiqueta: 'Buclicidad media', valor: n3(global.buclicidadMedia) },
            { etiqueta: 'Acierto medio', valor: conDecisiones ? pct(global.tasaAciertoMedia) : '—' },
            { etiqueta: 'Retornos', valor: `${global.retornosTotales}` },
            { etiqueta: 'Faltas', valor: `${totalFaltas}` },
            { etiqueta: 'Tiempo jugado', valor: reloj(global.segundosTotales) },
          ],
        },
        {
          titulo: 'Faltas a cada regla',
          parrafos: totalFaltas === 0 ? ['No hubo ninguna jugada rechazada en toda la sesión.'] : [],
          tablas: totalFaltas === 0 ? [] : [{
            cols: ['Regla infringida', 'Veces', ...seccionesTrabajadas.map(s => NOMBRE_SECCION[s])],
            alineacion: ['izq', 'der', ...seccionesTrabajadas.map(() => 'der' as const)],
            filas: Object.entries(faltas).sort((a, b) => b[1] - a[1]).map(([t, v]) => [
              REGLA_DE_ERROR[t] ?? t, v, ...seccionesTrabajadas.map(s => faltasPorRegla(eventos, s)[t] ?? 0),
            ]),
            nota: `Ayudas usadas: ${contarTipo(eventos, 'pista')} pistas, ${contarTipo(eventos, 'deshacer')} veces deshacer, ${contarTipo(eventos, 'callejon_sin_salida')} avisos de camino sin salida.`,
          }],
        },
        {
          titulo: 'Todos los intentos de la sesión',
          tablas: [{
            cols: COLS_INTENTO,
            alineacion: ['izq', 'izq', 'der', 'izq', 'der', 'der', 'der', 'der', 'der', 'der', 'der', 'der', 'der'] as ('izq' | 'der')[],
            filas: intentos.map(filaIntento),
            nota: 'Q = circuidad (movimientos / mínimo, solo en intentos ganados) · R = ramificación (0 = siempre la mejor jugada) · α = tasa de acierto · ν = retornos · μ = bucles independientes.',
          }],
        },
        ...porSeccion,
        ...(resumenPerfil && historial.length > 0 ? [{
          titulo: `Historial del perfil ${quien.participante}`,
          datos: [
            { etiqueta: 'Sesiones', valor: `${resumenPerfil.sesiones}` },
            { etiqueta: 'Intentos acumulados', valor: `${resumenPerfil.intentos}` },
            { etiqueta: 'Ganados', valor: `${resumenPerfil.victorias}` },
            { etiqueta: 'Movimientos', valor: `${resumenPerfil.movimientos}` },
            { etiqueta: 'Tiempo acumulado', valor: reloj(resumenPerfil.segundos) },
          ],
          tablas: [
            {
              cols: ['Sesión', 'Inicio', 'Intentos', 'Ganados', 'Niveles'],
              alineacion: ['izq', 'izq', 'der', 'der', 'izq'] as ('izq' | 'der')[],
              filas: historial.map(s => [
                s.sesionId, new Date(s.inicio).toLocaleString(), s.intentos.length,
                s.intentos.filter(i => i.resultado === 'victoria').length,
                [...new Set(s.intentos.map(i => i.pares))].sort((a, b) => a - b).map(nivelLabel).join(', ') || '—',
              ]),
            },
            {
              cols: ['Nivel', 'Intentos', 'Ganados', 'Movimientos'],
              alineacion: ['izq', 'der', 'der', 'der'] as ('izq' | 'der')[],
              filas: resumenPerfil.niveles.map(n => [nivelLabel(n.pares), n.intentos, n.victorias, n.movimientos]),
              nota: 'Acumulado de todas las sesiones de este perfil, incluida la de hoy.',
            },
          ],
        }] : []),
      ],
      graficos: combos.map((c, i) => ({
        titulo: `Figura ${primeraFigGrafo + 1 + i}. Grafo de estados · ${NOMBRE_SECCION[c.seccion]} · ${nivelLabel(c.pares)} · `
          + `${plural(c.recorridos.length, 'recorrido', 'recorridos')} · ${ident}`,
        dataUrl: imagenDe(`${c.seccion}|${c.pares}`),
        nota: 'verde = inicio, azul = final, amarillo = último recorrido, trazo más grueso = camino más repetido, rombo rojo = camino sin retorno',
      })),
    }
  }

  function datosJson() {
    return {
      informe: 'sesion', perfil, generado: new Date().toISOString(), duracionSegundos: duracionSeg,
      balance, sintesis: frases, resumen: global, faltasPorRegla: faltas,
      secciones: seccionesTrabajadas.map(s => ({
        seccion: s, nombre: NOMBRE_SECCION[s],
        resumen: metricasDeSesion(intentos.filter(i => i.seccion === s)),
        faltas: faltasPorRegla(eventos, s),
      })),
      intentos, eventos,
      historialPerfil: resumenPerfil,
    }
  }

  const acciones = (
    <>
      <button onClick={() => descargarHtml(base, documento())} style={btnDocPrincipal}>
        <Download size={13} /> Descargar informe
      </button>
      <button onClick={() => descargarCsv(base, csvDeIntentos(intentos.map(filaIntento), COLS_INTENTO))} style={btnDoc}>CSV</button>
      <button onClick={() => descargarJson(base, datosJson())} style={btnDoc}>JSON</button>
    </>
  )

  const tR = tendencia(intentos.map(i => (i.metricas.puntosDecision ? i.metricas.ramificacion : null)), 'menor')

  return (
    <ModalInforme
      etiqueta={archivada ? 'Informe de una sesión anterior' : 'Informe general de la sesión'}
      titulo={`Sesión de ${perfil.participante}`}
      subtitulo={`Operador: ${perfil.operador || '(sin asignar)'} · Inicio: ${new Date(perfil.inicio).toLocaleString()} · Duración: ${reloj(duracionSeg)} · `
        + `Secciones: ${seccionesTrabajadas.map(s => NOMBRE_SECCION[s]).join(', ') || 'ninguna'}`}
      acciones={acciones}
      onCerrar={onCerrar}
    >
      <BalanceGeneral balance={balance} />
      <Sintesis frases={frases} />

      <Datos>
        <Dato etiqueta="Intentos" valor={`${global.intentos}`} nota={`${global.victorias} ganados · ${global.bloqueos} bloqueos`} />
        <Dato etiqueta="Movimientos" valor={`${global.movimientosTotales}`} nota="en toda la sesión" />
        <Dato etiqueta="Circuidad media" valor={global.victorias ? n2(global.circuidadMedia) : '—'} nota="1 = ruta mínima · solo ganados" />
        <Dato etiqueta="Ramificación media" valor={conDecisiones ? n3(global.ramificacionMedia) : '—'} nota={conDecisiones ? 'R · 0 = óptimo' : 'sin decisiones reales'} />
        <Dato etiqueta="Buclicidad media" valor={n3(global.buclicidadMedia)} nota="β · retornos / movimientos" />
        <Dato etiqueta="Acierto medio" valor={conDecisiones ? pct(global.tasaAciertoMedia) : '—'} nota="en puntos de decisión" />
        <Dato etiqueta="Faltas" valor={`${totalFaltas}`} nota="jugadas rechazadas" color={totalFaltas ? 'var(--color-offline)' : 'var(--color-online)'} />
        <Dato etiqueta="Tiempo jugado" valor={reloj(global.segundosTotales)} nota={`de ${reloj(duracionSeg)} de sesión`} />
      </Datos>

      {figResultados > 0 && (
        <Figura numero={figResultados} titulo="Resultados de los intentos de la sesión" identificacion={ident}
          comoLeer={<>la barra reparte el 100 % de los intentos según cómo terminaron: ganados, bloqueados
            (solo quedaba la jugada que prohíbe la Regla 2) o reiniciados por el operador.</>}>
          <BarraResultados victorias={global.victorias} bloqueos={global.bloqueos} reiniciados={reiniciados} />
        </Figura>
      )}

      {figEvolucion > 0 && (
        <Figura numero={figEvolucion} titulo="Evolución de las métricas a lo largo de la sesión" identificacion={ident}
          derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>ramificación: {leerTendencia(tR)}</span>}
          comoLeer={<>el eje horizontal son los intentos en el orden en que ocurrieron, repartidos en franjas: cada franja
            es una pestaña y lleva su nombre encima, con una línea punteada donde empieza la siguiente. La etiqueta de cada
            punto es la inicial de la pestaña y el número de intento (C = Control Mago de Oz, T = Tutorial guiado,
            L = Simulación libre, O = Observador). El eje vertical es el valor normalizado de 0 a 1. Aprender se ve como las
            dos primeras curvas bajando y la verde subiendo, <b>dentro de una misma franja</b>: entre pestañas y entre
            niveles distintos los valores no son comparables. Los dos punteados de la gráfica están en su leyenda: el
            horizontal salta los intentos sin decisiones que medir —no es un cero— y el vertical marca dónde cambia la
            pestaña.</>}>
          <Evolucion
            etiquetas={intentos.map(i => `${SIGLA[i.seccion]}${i.numero}`)}
            etiquetaEjeX="intentos de la sesión, en orden y por pestaña"
            grupos={gruposPestana}
            pie={<>Las franjas separan las pestañas. En las etiquetas: <b>C</b> = Control Mago de Oz ·
              {' '}<b>T</b> = Tutorial guiado · <b>L</b> = Simulación libre · <b>O</b> = Vista de observador,
              {' '}seguido del número de intento.</>}
            series={[
              { nombre: 'Ramificación R (0 es mejor)', color: 'var(--color-blue)', puntos: intentos.map(i => (i.metricas.puntosDecision ? i.metricas.ramificacion : null)) },
              { nombre: 'Buclicidad β (0 es mejor)', color: 'var(--color-caution)', puntos: intentos.map(i => (i.metricas.movimientos ? i.metricas.buclicidad : null)) },
              { nombre: 'Acierto α (1 es mejor)', color: 'var(--color-online)', puntos: intentos.map(i => (i.metricas.puntosDecision ? i.metricas.tasaAcierto : null)) },
            ]} />
        </Figura>
      )}

      {figBarras > 0 && (
        <Figura numero={figBarras} titulo="Movimientos de cada intento frente al mínimo de su nivel" identificacion={ident}
          comoLeer={<>las filas están agrupadas por pestaña, con su nombre encima de cada bloque. Cada fila es un intento,
            etiquetado con la pestaña, el número de intento y el nivel (por ejemplo «T2·3p» = Tutorial, intento 2, 3 pares).
            La barra es lo recorrido y la marca vertical, el mínimo posible de ese nivel (D* = n² + 2n: 3 movimientos con
            1 par, 35 con 5 pares).</>}>
          <BarrasConReferencia
            etiquetaEjeX="movimientos del intento"
            etiquetaEjeY="intento · nivel"
            grupos={gruposPestana}
            filas={intentos.map(i => ({
              etiqueta: `${SIGLA[i.seccion]}${i.numero}·${i.pares}p`,
              valor: i.metricas.movimientos,
              referencia: i.metricas.optimo,
              color: colorResultado(i.resultado),
              nota: i.resultado === 'victoria' ? `Q ${n2(i.metricas.circuidad)}` : i.resultado === 'bloqueo' ? 'bloqueo' : 'reiniciado',
            }))} />
        </Figura>
      )}

      {totalFaltas === 0 ? (
        <Bloque titulo="Faltas a cada regla">
          <div style={{ fontSize: '13px', color: 'var(--color-online)' }}>No hubo ninguna jugada rechazada en toda la sesión.</div>
          <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '8px' }}>
            Ayudas usadas: {contarTipo(eventos, 'pista')} pistas · {contarTipo(eventos, 'deshacer')} veces deshacer ·
            {' '}{contarTipo(eventos, 'callejon_sin_salida')} avisos de camino sin salida.
          </div>
        </Bloque>
      ) : (
        <Figura numero={figFaltas} titulo="Faltas a cada regla del juego" identificacion={ident}
          derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>{plural(totalFaltas, 'falta', 'faltas')} en total</span>}
          comoLeer={<>cada fila es una de las tres reglas de La Escalera y el eje horizontal cuenta cuántas veces se intentó romperla
            en toda la sesión. La aplicación rechaza la jugada y la registra: el tablero nunca queda en una posición ilegal.
            La tabla de abajo reparte esas mismas faltas por pestaña.</>}>
          <>
            <BarrasHorizontales
              etiquetaEjeX="veces que se intentó"
              filas={Object.entries(faltas).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ etiqueta: REGLA_DE_ERROR[t] ?? t, valor: v }))}
              total={totalFaltas} />
            <div style={{ marginTop: '14px' }}>
              <Tabla nota={`Ayudas usadas: ${contarTipo(eventos, 'pista')} pistas · ${contarTipo(eventos, 'deshacer')} veces deshacer · ${contarTipo(eventos, 'callejon_sin_salida')} avisos de camino sin salida.`}>
                <thead><tr>
                  <th style={thIzq}>Regla infringida</th>
                  <th style={th}>Veces</th>
                  {seccionesTrabajadas.map(s => <th key={s} style={th}>{NOMBRE_SECCION[s]}</th>)}
                </tr></thead>
                <tbody>
                  {Object.entries(faltas).sort((a, b) => b[1] - a[1]).map(([tipo, veces]) => (
                    <tr key={tipo}>
                      <td style={tdIzq}>{REGLA_DE_ERROR[tipo] ?? tipo}</td>
                      <td style={{ ...td, color: 'var(--color-offline)', fontWeight: 700 }}>{veces}</td>
                      {seccionesTrabajadas.map(s => <td key={s} style={td}>{faltasPorRegla(eventos, s)[tipo] ?? 0}</td>)}
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </div>
          </>
        </Figura>
      )}

      {seccionesTrabajadas.map(s => {
        const deSeccion = intentos.filter(i => i.seccion === s)
        const m = metricasDeSesion(deSeccion)
        const ev = eventos.filter(e => e.seccion === s)
        const niveles = [...new Set(deSeccion.map(i => i.pares))].sort((a, b) => a - b)
        return (
          <Bloque key={s} titulo={NOMBRE_SECCION[s]}
            derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>
              {ev.length} eventos · {niveles.length ? `niveles: ${niveles.map(nivelLabel).join(', ')}` : 'sin niveles terminados'}
            </span>}>
            {deSeccion.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)' }}>
                Se trabajó en esta sección, pero no se terminó ningún intento con movimientos.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                  <Dato etiqueta="Intentos" valor={`${m.intentos}`} nota={`${m.victorias} ganados`} />
                  <Dato etiqueta="Movimientos" valor={`${m.movimientosTotales}`} />
                  <Dato etiqueta="Ramificación" valor={deSeccion.some(i => i.metricas.puntosDecision > 0) ? n3(m.ramificacionMedia) : '—'} />
                  <Dato etiqueta="Buclicidad" valor={n3(m.buclicidadMedia)} />
                  <Dato etiqueta="Retornos" valor={`${m.retornosTotales}`} />
                  <Dato etiqueta="Tiempo" valor={reloj(m.segundosTotales)} />
                </div>
                <Tabla>
                  <thead><tr>
                    <ThM izq titulo="Intento" /><ThM titulo="Pares" ayuda="Cuántos pares de fichas tenía el nivel." />
                    <ThM izq titulo="Resultado" ayuda={AYUDA.resultado} />
                    <ThM titulo="Movimientos" ayuda={AYUDA.mov} /><ThM titulo="Mínimo" ayuda={AYUDA.minimo} />
                    <ThM titulo="Eficiencia" simbolo="Q" ayuda={AYUDA.q} /><ThM titulo="Decisiones" simbolo="R" ayuda={AYUDA.r} />
                    <ThM titulo="Acierto" simbolo="α" ayuda={AYUDA.acierto} /><ThM titulo="Retornos" simbolo="ν" ayuda={AYUDA.retornos} />
                    <ThM titulo="Bucles" simbolo="μ" ayuda={AYUDA.bucles} /><ThM titulo="Faltas" ayuda={AYUDA.faltas} />
                    <ThM titulo="Tiempo" ayuda={AYUDA.tiempo} />
                  </tr></thead>
                  <tbody>
                    {deSeccion.map(i => (
                      <tr key={i.id}>
                        <td style={{ ...td, textAlign: 'left' }}>#{i.numero}</td>
                        <td style={td}>{i.pares}</td>
                        <td style={{ ...tdIzq, color: colorResultado(i.resultado), fontWeight: 600 }}>
                          {i.resultado === 'victoria' ? 'Victoria' : i.resultado === 'bloqueo' ? 'Bloqueo' : 'Reiniciado'}
                        </td>
                        <td style={td}>{i.metricas.movimientos || '—'}</td>
                        <td style={td}>{i.metricas.optimo}</td>
                        <td style={td}>{i.resultado === 'victoria' ? n2(i.metricas.circuidad) : '—'}</td>
                        <td style={td}>{i.metricas.puntosDecision ? n3(i.metricas.ramificacion) : '—'}</td>
                        <td style={td}>{i.metricas.puntosDecision ? pct(i.metricas.tasaAcierto) : '—'}</td>
                        <td style={td}>{i.metricas.movimientos ? i.metricas.retornos : '—'}</td>
                        <td style={td}>{i.metricas.movimientos ? i.metricas.ciclosIndependientes : '—'}</td>
                        <td style={td}>{i.errores}</td>
                        <td style={td}>{reloj(i.segundos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              </>
            )}
          </Bloque>
        )
      })}

      {combos.length > 0 && (
        <Bloque titulo={`Grafos de los niveles jugados · ${plural(combos.length, 'nivel', 'niveles')}`}>
          <div style={{ fontSize: '12px', color: 'var(--color-paper-dim)', marginBottom: '12px' }}>
            Un grafo por cada nivel y pestaña, con todos los recorridos de ese nivel superpuestos.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '16px' }}>
            {combos.map((c, i) => {
              const clave = `${c.seccion}|${c.pares}`
              return (
                <Figura key={clave} numero={primeraFigGrafo + 1 + i}
                  titulo={`Grafo de estados · ${NOMBRE_SECCION[c.seccion]} · ${nivelLabel(c.pares)}`}
                  identificacion={`${ident} · ${plural(c.recorridos.length, 'intento dibujado', 'intentos dibujados')}`}
                  comoLeer={<>cada punto es una posición posible del tablero y cada línea, una jugada. El trazo más grueso es
                    el camino más repetido —ahí están los bucles— y el amarillo, el último recorrido. Al pasar el cursor por un
                    punto se ve qué posición es y cuántas veces se pasó por ella.</>}>
                  <div style={{ marginBottom: '8px' }}>
                    <Leyenda items={[
                      { marca: 'punto', color: 'var(--color-online)', texto: 'Inicio' },
                      { marca: 'punto', color: 'var(--color-blue)', texto: 'Fin (objetivo)' },
                      { marca: 'linea', color: 'var(--color-caution)', texto: 'último recorrido' },
                      { marca: 'punto', color: 'var(--color-offline)', texto: 'camino sin retorno' },
                    ]} />
                  </div>
                  <GrafoEstados
                    pares={c.pares}
                    previos={c.recorridos.slice(0, -1)}
                    actual={c.recorridos[c.recorridos.length - 1]}
                    height={360} seguimiento={false} modo="informe"
                    onCy={cy => { if (cy) grafos.current.set(clave, cy); else grafos.current.delete(clave) }} />
                </Figura>
              )
            })}
          </div>
        </Bloque>
      )}

      {resumenPerfil && (
        <Bloque titulo={`Historial del perfil · ${perfil.participante}`}
          derecha={
            <button onClick={() => descargarCsv(nombreArchivo('historial-perfil', perfil.participante), historialCsv(perfil.perfilId))} style={btnDoc}>
              <Download size={12} /> Historial completo (CSV)
            </button>
          }>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '12px', marginBottom: '14px' }}>
            <Dato etiqueta="Sesiones" valor={`${resumenPerfil.sesiones}`} nota="incluida la de hoy" />
            <Dato etiqueta="Intentos" valor={`${resumenPerfil.intentos}`} nota={`${resumenPerfil.victorias} ganados`} />
            <Dato etiqueta="Movimientos" valor={`${resumenPerfil.movimientos}`} />
            <Dato etiqueta="Tiempo" valor={reloj(resumenPerfil.segundos)} nota="acumulado" />
            <Dato etiqueta="Niveles" valor={`${resumenPerfil.niveles.length}`} nota="distintos jugados" />
          </div>
          {resumenPerfil.niveles.length > 0 && (
            <Tabla nota="Acumulado de todas las sesiones de este perfil guardadas en este navegador.">
              <thead><tr>
                <th style={thIzq}>Nivel</th><th style={th}>Intentos</th><th style={th}>Ganados</th><th style={th}>Movimientos</th>
              </tr></thead>
              <tbody>
                {resumenPerfil.niveles.map(n => (
                  <tr key={n.pares}>
                    <td style={tdIzq}>{nivelLabel(n.pares)}</td>
                    <td style={td}>{n.intentos}</td>
                    <td style={td}>{n.victorias}</td>
                    <td style={td}>{n.movimientos}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
          {historial.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <Tabla>
                <thead><tr>
                  <th style={thIzq}>Sesión anterior</th><th style={thIzq}>Inicio</th>
                  <th style={th}>Intentos</th><th style={th}>Ganados</th><th style={thIzq}>Niveles</th>
                </tr></thead>
                <tbody>
                  {historial.slice().reverse().map(s => (
                    <tr key={s.sesionId}>
                      <td style={{ ...td, textAlign: 'left' }}>{s.sesionId}</td>
                      <td style={tdIzq}>{new Date(s.inicio).toLocaleString()}</td>
                      <td style={td}>{s.intentos.length}</td>
                      <td style={td}>{s.intentos.filter(i => i.resultado === 'victoria').length}</td>
                      <td style={tdIzq}>
                        {[...new Set(s.intentos.map(i => i.pares))].sort((a, b) => a - b).map(nivelLabel).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </div>
          )}
          {historial.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--color-paper-faint)', marginTop: '8px' }}>
              Esta es la primera sesión de este perfil. Las siguientes quedarán aquí para comparar.
            </div>
          )}
        </Bloque>
      )}

      <BloqueFuentes />

      {/* Cierre de la sesión: ya no borra nada — la sesión queda archivada en
          el historial del perfil, así que el aviso explica eso y no asusta.
          Una sesión archivada no se cierra: ya está cerrada. */}
      {onCerrarSesion && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', paddingTop: '4px' }}>
        <div style={{ fontSize: '11.5px', color: 'var(--color-paper-faint)', maxWidth: '640px', lineHeight: 1.5 }}>
          Al cerrar la sesión, todo lo registrado queda guardado en el historial del perfil
          <b style={{ color: 'var(--color-paper-dim)' }}> {perfil.participante}</b> y se puede volver a consultar en la próxima sesión.
          Descarga el informe si quieres conservarlo como archivo.
        </div>
        <button
          onClick={() => { if (!confirmarCierre) { setConfirmarCierre(true); return } onCerrarSesion() }}
          style={{
            background: confirmarCierre ? 'var(--color-offline)' : 'var(--color-bg)',
            border: '1px solid var(--color-offline)',
            color: confirmarCierre ? '#fff' : 'var(--color-offline)',
            borderRadius: 'var(--radius)', padding: '9px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}>
          {confirmarCierre ? '¿Confirmar? Se archiva y empieza otra' : 'Terminar y empezar otra sesión'}
        </button>
      </div>
      )}
    </ModalInforme>
  )
}

// La sesión en curso: toma los datos del contexto y permite cerrarla.
export default function InformeGeneral({ onCerrar, onCerrarSesion }: { onCerrar: () => void; onCerrarSesion: () => void }) {
  const { perfil, eventos, intentos } = useSesion()
  if (!perfil) return null
  return (
    <InformeSesion
      datos={{
        perfil, eventos, intentos,
        duracionSeg: Math.round((Date.now() - new Date(perfil.inicio).getTime()) / 1000),
      }}
      onCerrar={onCerrar}
      onCerrarSesion={onCerrarSesion} />
  )
}
