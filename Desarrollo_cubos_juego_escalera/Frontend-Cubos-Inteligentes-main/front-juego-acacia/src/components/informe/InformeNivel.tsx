import { useMemo, useRef } from 'react'
import { Download } from 'lucide-react'
import type { Core } from 'cytoscape'
import {
  useSesion, NOMBRE_SECCION, REGLA_DE_ERROR, faltasPorRegla, contarTipo,
  type Seccion, type IntentoSesion,
} from '../../core/session/sesion'
import { metricasDeSesion } from '../../core/simulation/metricas'
import GrafoEstados from '../simulation/GrafoEstados'
import ModalInforme, {
  AYUDA, BalanceGeneral, Bloque, Sintesis, Dato, Datos, Tabla, ThM, th, thIzq, td, tdIzq, btnDoc, btnDocPrincipal,
} from './ModalInforme'
import BloqueFuentes from './BloqueFuentes'
import { NOTA_ECUACIONES } from './fuentes'
import { BarrasConReferencia, BarrasHorizontales, Evolucion, Figura, Leyenda, Medidor, PerfilDecisiones } from './graficos'
import {
  balanceDe, filasMetricas, leerFaltas, n2, n3, nivelLabel, pct, plural, reloj, sintesisNivel,
} from './interpretar'
import { descargarCsv, descargarHtml, descargarJson, csvDeIntentos, nombreArchivo, type DocInforme } from './exportar'

// Informe DEL NIVEL: lo que pasó en un nivel concreto (una cantidad de pares)
// de una sección concreta. Es el informe corto, el que se mira al terminar un
// intento: primero el balance con semáforo, luego la síntesis en palabras y
// después el detalle —movimientos frente al mínimo, decisiones, bucles,
// faltas y el grafo del nivel con todos sus recorridos.
//
// Se diferencia del informe general de la sesión (InformeGeneral.tsx), que
// reúne las cuatro pestañas y todos los niveles jugados.

const COLS_INTENTO = ['Intento', 'Resultado', 'Movimientos', 'Mínimo', 'Eficiencia Q', 'Decisiones R',
  'Acierto α', 'Retornos ν', 'Bucles μ', 'Faltas', 'Tiempo']

function filaIntento(i: IntentoSesion): (string | number)[] {
  return [
    `#${i.numero}`,
    i.resultado === 'victoria' ? 'Victoria' : i.resultado === 'bloqueo' ? 'Bloqueo' : 'Reiniciado',
    i.metricas.movimientos || '—',
    i.metricas.optimo,
    i.resultado === 'victoria' ? n2(i.metricas.circuidad) : '—',
    i.metricas.puntosDecision ? n3(i.metricas.ramificacion) : '—',
    i.metricas.puntosDecision ? pct(i.metricas.tasaAcierto) : '—',
    i.metricas.movimientos ? i.metricas.retornos : '—',
    i.metricas.movimientos ? i.metricas.ciclosIndependientes : '—',
    i.errores,
    reloj(i.segundos),
  ]
}

const colorResultado = (r: IntentoSesion['resultado']) =>
  r === 'victoria' ? 'var(--color-online)' : r === 'bloqueo' ? 'var(--color-offline)' : 'var(--color-paper-faint)'

export default function InformeNivel({ seccion, pares, onCerrar }: { seccion: Seccion; pares: number; onCerrar: () => void }) {
  const { perfil, eventos, intentos } = useSesion()
  const cyRef = useRef<Core | null>(null)

  const delNivel = useMemo(
    () => intentos.filter(i => i.seccion === seccion && i.pares === pares),
    [intentos, seccion, pares],
  )
  const eventosNivel = useMemo(
    () => eventos.filter(e => e.seccion === seccion && (e.pares ?? e.nivel) === pares),
    [eventos, seccion, pares],
  )
  const faltas = useMemo(() => faltasPorRegla(eventosNivel), [eventosNivel])
  const totalFaltas = Object.values(faltas).reduce((a, b) => a + b, 0)

  const resumen = metricasDeSesion(delNivel)
  const ultimo = delNivel.length ? delNivel[delNivel.length - 1] : null
  const ganados = delNivel.filter(i => i.resultado === 'victoria')
  const mejor = ganados.length ? ganados.reduce((a, b) => (a.metricas.movimientos <= b.metricas.movimientos ? a : b)) : null
  const optimo = pares * pares + 2 * pares
  const recorridos = delNivel.map(i => i.recorrido).filter(r => r.length > 1)
  const frases = sintesisNivel(delNivel, seccion, pares, faltas)
  const balance = balanceDe(delNivel, faltas)

  const titulo = `Nivel de ${nivelLabel(pares)} · ${NOMBRE_SECCION[seccion]}`
  const quien = perfil?.participante ?? '(sin nombre)'
  // Identificación que llevan todas las figuras: una gráfica recortada del
  // informe tiene que seguir diciendo de quién y de qué nivel habla.
  const ident = `${quien} · ${NOMBRE_SECCION[seccion]} · nivel de ${nivelLabel(pares)} · ${new Date().toLocaleDateString()}`
  const base = nombreArchivo(`informe-nivel-${pares}p`, perfil?.participante ?? '')

  // Numeración de las figuras, saltando las que no aplican en este informe.
  let k = 0
  const figBarras = delNivel.length ? ++k : 0
  const figCalidad = ultimo ? ++k : 0
  const figEvolucion = delNivel.length > 1 ? ++k : 0
  const figFaltas = totalFaltas > 0 ? ++k : 0
  const figGrafo = ++k

  function documento(): DocInforme {
    let imagen: string | null = null
    try { imagen = cyRef.current ? cyRef.current.png({ full: true, scale: 1.6, bg: '#ffffff' }) : null } catch { imagen = null }
    return {
      etiqueta: 'Informe del nivel',
      titulo,
      subtitulo: `Participante: ${quien} · Operador: ${perfil?.operador || '(sin asignar)'}`,
      meta: [
        { etiqueta: 'Intentos', valor: `${delNivel.length}` },
        { etiqueta: 'Ganados', valor: `${ganados.length}` },
        { etiqueta: 'Mínimo del nivel', valor: `${optimo} movimientos` },
        { etiqueta: 'Tiempo jugado', valor: reloj(resumen.segundosTotales) },
        { etiqueta: 'Generado', valor: new Date().toLocaleString() },
      ],
      balance,
      sintesis: frases,
      secciones: [
        {
          titulo: 'Intentos del nivel',
          tablas: [{
            cols: COLS_INTENTO,
            alineacion: ['izq', 'izq', 'der', 'der', 'der', 'der', 'der', 'der', 'der', 'der', 'der'],
            filas: delNivel.map(filaIntento),
            nota: 'Q = circuidad (movimientos / mínimo, solo en intentos ganados) · R = ramificación (0 = siempre la mejor jugada) · ν = retornos · μ = bucles independientes.',
          }],
        },
        ...(ultimo ? [{
          titulo: `Detalle del último intento (#${ultimo.numero})`,
          tablas: [{
            cols: ['Métrica', 'Símbolo', 'Valor', 'Qué significa'],
            alineacion: ['izq', 'izq', 'der', 'izq'] as ('izq' | 'der')[],
            filas: filasMetricas(ultimo.metricas, ultimo.resultado).map(f => [f.metrica, f.simbolo, f.valor, f.significado]),
          }],
        }] : []),
        {
          titulo: 'Faltas a las reglas en este nivel',
          parrafos: [leerFaltas(totalFaltas, faltas)],
          tablas: totalFaltas === 0 ? [] : [{
            cols: ['Regla infringida', 'Veces'],
            alineacion: ['izq', 'der'] as ('izq' | 'der')[],
            filas: Object.entries(faltas).sort((a, b) => b[1] - a[1]).map(([t, v]) => [REGLA_DE_ERROR[t] ?? t, v]),
          }],
        },
        {
          titulo: 'Ayudas y avisos',
          datos: [
            { etiqueta: 'Pistas', valor: `${contarTipo(eventosNivel, 'pista')}` },
            { etiqueta: 'Deshacer', valor: `${contarTipo(eventosNivel, 'deshacer')}` },
            { etiqueta: 'Avisos de camino sin salida', valor: `${contarTipo(eventosNivel, 'callejon_sin_salida')}` },
            { etiqueta: 'Eventos registrados', valor: `${eventosNivel.length}` },
          ],
        },
      ],
      graficos: [{
        titulo: `Figura ${figGrafo}. Grafo de estados · ${ident} · ${plural(recorridos.length, 'recorrido', 'recorridos')}`,
        dataUrl: imagen,
        nota: 'verde = inicio, azul = final, amarillo = último recorrido, trazo más grueso = camino más repetido, rombo rojo = camino sin retorno',
      }],
    }
  }

  function datosJson() {
    return {
      informe: 'nivel', seccion: NOMBRE_SECCION[seccion], pares, perfil,
      generado: new Date().toISOString(), balance, sintesis: frases,
      resumen, faltasPorRegla: faltas, intentos: delNivel, eventos: eventosNivel,
    }
  }

  const acciones = (
    <>
      <button onClick={() => descargarHtml(base, documento())} style={btnDocPrincipal}>
        <Download size={13} /> Descargar informe
      </button>
      <button onClick={() => descargarCsv(base, csvDeIntentos(delNivel.map(filaIntento), COLS_INTENTO))} style={btnDoc}>CSV</button>
      <button onClick={() => descargarJson(base, datosJson())} style={btnDoc}>JSON</button>
    </>
  )

  return (
    <ModalInforme
      etiqueta="Informe del nivel"
      titulo={titulo}
      subtitulo={`${quien} · mínimo para ganar: ${optimo} movimientos · ${plural(delNivel.length, 'intento terminado', 'intentos terminados')}`}
      acciones={acciones}
      onCerrar={onCerrar}
    >
      <BalanceGeneral balance={balance} />
      <Sintesis frases={frases} />

      <Datos>
        <Dato etiqueta="Intentos" valor={`${delNivel.length}`} nota={`${ganados.length} ${ganados.length === 1 ? 'ganado' : 'ganados'}`} />
        <Dato etiqueta="Último intento"
          valor={ultimo ? `${ultimo.metricas.movimientos}` : '—'}
          nota={ultimo ? `movimientos · mínimo ${optimo}` : 'sin intentos'}
          color={ultimo && ultimo.resultado === 'victoria' ? 'var(--color-online)' : undefined} />
        <Dato etiqueta="Mejor ganado" valor={mejor ? `${mejor.metricas.movimientos}` : '—'}
          nota={mejor ? `intento #${mejor.numero} · Q ${n2(mejor.metricas.circuidad)}` : 'ninguno todavía'} />
        <Dato etiqueta="Tiempo jugado" valor={reloj(resumen.segundosTotales)} nota="suma de los intentos" />
        <Dato etiqueta="Retornos" valor={`${resumen.retornosTotales}`} nota="posiciones repetidas"
          color={resumen.retornosTotales ? 'var(--color-caution)' : 'var(--color-online)'} />
        <Dato etiqueta="Faltas" valor={`${totalFaltas}`} nota="jugadas rechazadas"
          color={totalFaltas ? 'var(--color-offline)' : 'var(--color-online)'} />
      </Datos>

      {figBarras > 0 && (
        <Figura numero={figBarras} titulo="Movimientos de cada intento frente al mínimo del nivel" identificacion={ident}
          derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>mínimo del nivel: {optimo}</span>}
          comoLeer={<>la barra es lo que recorrió y la marca vertical, el mínimo posible ({optimo} movimientos para {nivelLabel(pares)}).
            Cuanto más cerca de la marca, más directa fue la ruta. El eje horizontal cuenta movimientos; cada fila es un intento.</>}>
          <BarrasConReferencia
            etiquetaEjeX="movimientos del intento"
            etiquetaEjeY="intento"
            filas={delNivel.map(i => ({
              etiqueta: `#${i.numero}`,
              valor: i.metricas.movimientos,
              referencia: i.metricas.optimo,
              color: colorResultado(i.resultado),
              nota: i.resultado === 'victoria' ? `Q ${n2(i.metricas.circuidad)}` : i.resultado === 'bloqueo' ? 'bloqueo' : 'reiniciado',
            }))} />
        </Figura>
      )}

      {ultimo && figCalidad > 0 && (
        <Figura numero={figCalidad} titulo={`Calidad del último intento (#${ultimo.numero})`} identificacion={ident}
          comoLeer={<>los tres medidores van de 0 a 1 y la punta blanca marca el valor obtenido; el extremo bueno está indicado
            debajo de cada uno. La franja de abajo es el perfil: una marca por decisión, en el orden del intento.</>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px' }}>
            <Medidor etiqueta="Ramificación (R)" optimoEn={0}
              valor={ultimo.metricas.puntosDecision ? ultimo.metricas.ramificacion : null}
              texto={ultimo.metricas.puntosDecision
                ? `0 sería elegir siempre la mejor jugada. Hubo ${plural(ultimo.metricas.puntosDecision, 'decisión real', 'decisiones reales')}.`
                : 'No hubo decisiones reales: todas las jugadas eran forzadas o equivalentes.'} />
            <Medidor etiqueta="Tasa de acierto (α)" optimoEn={1}
              valor={ultimo.metricas.puntosDecision ? ultimo.metricas.tasaAcierto : null}
              formato={v => pct(v)}
              texto={ultimo.metricas.puntosDecision
                ? `Eligió la mejor jugada en ${ultimo.metricas.aciertos} de ${ultimo.metricas.puntosDecision}.`
                : 'Sin puntos de decisión que medir.'} />
            <Medidor etiqueta="Buclicidad (β)" optimoEn={0}
              valor={ultimo.metricas.movimientos ? ultimo.metricas.buclicidad : null}
              texto={ultimo.metricas.retornos === 0
                ? 'No volvió a ninguna posición ya visitada.'
                : `${plural(ultimo.metricas.retornos, 'retorno', 'retornos')} en ${plural(ultimo.metricas.ciclosIndependientes, 'bucle distinto', 'bucles distintos')}.`} />
          </div>
          <div style={{ marginTop: '16px' }}>
            {ultimo.metricas.perfil.length > 0
              ? <PerfilDecisiones perfil={ultimo.metricas.perfil} />
              : <div style={{ fontSize: '12px', color: 'var(--color-paper-faint)' }}>Este intento no tuvo puntos de decisión: no hay perfil que dibujar.</div>}
          </div>
        </Figura>
      )}

      {figEvolucion > 0 && (
        <Figura numero={figEvolucion} titulo="Evolución dentro del nivel, intento a intento" identificacion={ident}
          derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>{plural(delNivel.length, 'intento', 'intentos')}</span>}
          comoLeer={<>cada punto es un intento, en orden (eje horizontal); el eje vertical es el valor normalizado de 0 a 1.
            Aprender se ve como las dos primeras curvas bajando y la verde subiendo. Un intento sin decisiones reales deja un hueco
            en la línea en vez de inventar un valor.</>}>
          <Evolucion
            etiquetas={delNivel.map(i => `#${i.numero}`)}
            etiquetaEjeX="intentos de este nivel, en orden"
            series={[
              { nombre: 'Ramificación R (0 es mejor)', color: 'var(--color-blue)', puntos: delNivel.map(i => (i.metricas.puntosDecision ? i.metricas.ramificacion : null)) },
              { nombre: 'Buclicidad β (0 es mejor)', color: 'var(--color-caution)', puntos: delNivel.map(i => (i.metricas.movimientos ? i.metricas.buclicidad : null)) },
              { nombre: 'Acierto α (1 es mejor)', color: 'var(--color-online)', puntos: delNivel.map(i => (i.metricas.puntosDecision ? i.metricas.tasaAcierto : null)) },
            ]} />
        </Figura>
      )}

      {ultimo && (
        <Bloque titulo={`Detalle del último intento (#${ultimo.numero})`}>
          <Tabla nota={NOTA_ECUACIONES}>
            <thead><tr>
              <th style={thIzq}>Métrica</th><th style={thIzq}>Símbolo</th><th style={th}>Valor</th><th style={thIzq}>Qué significa</th>
            </tr></thead>
            <tbody>
              {filasMetricas(ultimo.metricas, ultimo.resultado).map(f => (
                <tr key={f.metrica}>
                  <td style={{ ...tdIzq, fontWeight: 600 }}>{f.metrica}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{f.simbolo}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{f.valor}</td>
                  <td style={{ ...tdIzq, color: 'var(--color-paper-dim)', fontSize: '12px' }}>{f.significado}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Bloque>
      )}

      <Bloque titulo="Intentos de este nivel" derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>{eventosNivel.length} eventos registrados</span>}>
        {delNivel.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--color-paper-dim)' }}>
            Todavía no se ha terminado ningún intento en este nivel. El grafo de abajo muestra el mapa completo del nivel.
          </div>
        ) : (
          <Tabla nota="Q = circuidad (solo en intentos ganados) · R = ramificación · ν = retornos · μ = bucles independientes.">
            <thead><tr>
              <ThM izq titulo="Intento" /><ThM izq titulo="Resultado" ayuda={AYUDA.resultado} />
              <ThM titulo="Movimientos" ayuda={AYUDA.mov} /><ThM titulo="Mínimo" ayuda={AYUDA.minimo} />
              <ThM titulo="Eficiencia" simbolo="Q" ayuda={AYUDA.q} /><ThM titulo="Decisiones" simbolo="R" ayuda={AYUDA.r} />
              <ThM titulo="Acierto" simbolo="α" ayuda={AYUDA.acierto} /><ThM titulo="Retornos" simbolo="ν" ayuda={AYUDA.retornos} />
              <ThM titulo="Bucles" simbolo="μ" ayuda={AYUDA.bucles} /><ThM titulo="Faltas" ayuda={AYUDA.faltas} />
              <ThM titulo="Tiempo" ayuda={AYUDA.tiempo} />
            </tr></thead>
            <tbody>
              {delNivel.map(i => (
                <tr key={i.id}>
                  <td style={{ ...td, textAlign: 'left' }}>#{i.numero}</td>
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
        )}
      </Bloque>

      {figFaltas > 0 ? (
        <Figura numero={figFaltas} titulo="Faltas a cada regla en este nivel" identificacion={ident}
          comoLeer={<>cada barra es una de las tres reglas de La Escalera; el eje horizontal cuenta cuántas veces se intentó romperla.
            La jugada se rechaza y se registra, así que el tablero nunca queda en una posición ilegal. La barra más larga indica qué regla conviene repasar.</>}>
          <BarrasHorizontales
            etiquetaEjeX="veces que se intentó"
            filas={Object.entries(faltas).sort((a, b) => b[1] - a[1]).map(([t, v]) => ({ etiqueta: REGLA_DE_ERROR[t] ?? t, valor: v }))}
            total={totalFaltas} />
          <div style={{ fontSize: '11.5px', color: 'var(--color-paper-faint)', marginTop: '10px' }}>
            Ayudas en este nivel: {contarTipo(eventosNivel, 'pista')} pistas · {contarTipo(eventosNivel, 'deshacer')} veces deshacer ·
            {' '}{contarTipo(eventosNivel, 'callejon_sin_salida')} avisos de camino sin salida.
          </div>
        </Figura>
      ) : (
        <Bloque titulo="Faltas a las reglas en este nivel">
          <div style={{ fontSize: '13px', color: 'var(--color-online)' }}>No se intentó ninguna jugada prohibida en este nivel.</div>
          <div style={{ fontSize: '11.5px', color: 'var(--color-paper-faint)', marginTop: '10px' }}>
            Ayudas en este nivel: {contarTipo(eventosNivel, 'pista')} pistas · {contarTipo(eventosNivel, 'deshacer')} veces deshacer ·
            {' '}{contarTipo(eventosNivel, 'callejon_sin_salida')} avisos de camino sin salida.
          </div>
        </Bloque>
      )}

      <Figura numero={figGrafo} titulo={`Grafo de estados del nivel de ${nivelLabel(pares)}`} identificacion={ident}
        derecha={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>{plural(recorridos.length, 'recorrido dibujado', 'recorridos dibujados')}</span>}
        comoLeer={<>cada punto es una posición posible del tablero y cada línea, una jugada. El camino amarillo es el último
          intento; las líneas más gruesas son los caminos que más se repitieron (ahí están los bucles). Los rombos rojos son
          «caminos sin retorno»: posiciones desde donde ya no se puede ganar. Al pasar el cursor por un punto se ve qué posición
          es y cuántas veces se pasó por ella.</>}>
        <div style={{ marginBottom: '8px' }}>
          <Leyenda items={[
            { marca: 'punto', color: 'var(--color-online)', texto: 'Inicio' },
            { marca: 'punto', color: 'var(--color-blue)', texto: 'Fin (objetivo)' },
            { marca: 'linea', color: 'var(--color-caution)', texto: 'último recorrido' },
            { marca: 'punto', color: 'var(--color-offline)', texto: 'camino sin retorno' },
          ]} />
        </div>
        <GrafoEstados
          pares={pares}
          previos={recorridos.slice(0, -1)}
          actual={recorridos.length ? recorridos[recorridos.length - 1] : []}
          height={420} seguimiento={false} modo="informe" onCy={cy => { cyRef.current = cy }} />
      </Figura>

      <BloqueFuentes />
    </ModalInforme>
  )
}
