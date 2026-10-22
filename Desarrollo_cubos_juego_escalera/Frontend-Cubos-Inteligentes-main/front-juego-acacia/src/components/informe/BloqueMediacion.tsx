import { Bloque, Tabla, ThM, td, tdIzq } from './ModalInforme'
import { Medidor } from './graficos'
import type { EfectoMediacion } from '../../core/session/mediacion'

// Efecto de la mediación Pausar–Pensar–Actuar sobre la decisión siguiente.
//
// Es la pregunta de la investigación, así que el bloque está escrito para no
// prometer más de lo que los datos dan: con pocas decisiones tras señal dice
// que es una observación y no una medida, y cuando no hay con qué comparar lo
// dice en lugar de dibujar una diferencia.

const n3 = (x: number | null) => (x === null ? '—' : x.toFixed(3).replace('.', ','))
const seg = (ms: number | null) => (ms === null ? '—' : (ms / 1000).toFixed(1).replace('.', ',') + ' s')

// Por debajo de esto, una diferencia puede ser casualidad de un puñado de
// jugadas. No es un contraste estadístico: es una señal de prudencia.
const MINIMO_PARA_LEER = 5

export default function BloqueMediacion({ efecto }: { efecto: EfectoMediacion }) {
  const { activaciones, porFase, conSenal, sinSenal, comparable } = efecto

  if (activaciones === 0) {
    return (
      <Bloque titulo="Efecto de la mediación">
        <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--color-paper-dim)', margin: 0 }}>
          No se activó ninguna señal del ciclo Pausar–Pensar–Actuar en esta sesión, de modo que no hay
          efecto que medir. El resto del informe describe el desempeño sin mediación.
        </p>
      </Bloque>
    )
  }

  const difC = comparable && conSenal.calidad !== null && sinSenal.calidad !== null
    ? conSenal.calidad - sinSenal.calidad : null
  const difT = comparable && conSenal.latencia !== null && sinSenal.latencia !== null
    ? conSenal.latencia - sinSenal.latencia : null
  const pocas = conSenal.n > 0 && conSenal.n < MINIMO_PARA_LEER

  return (
    <Bloque titulo="Efecto de la mediación">
      <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--color-paper)', margin: '0 0 12px' }}>
        Se activaron <b>{activaciones}</b> señales: {porFase.pausar} de Pausar, {porFase.pensar} de
        Pensar y {porFase.actuar} de Actuar. La tabla compara las decisiones que vinieron después de
        una señal con las demás decisiones del mismo aprendiz en la misma sesión.
      </p>

      <Tabla nota="«Decisiones» cuenta solo las jugadas en que había algo que elegir. Una señal se atribuye a la primera decisión real que llega en los tres movimientos siguientes; si antes de eso todas las jugadas estaban forzadas, la señal no se contabiliza.">
        <thead><tr>
          <ThM izq titulo="Grupo" />
          <ThM titulo="Decisiones" ayuda="Cuántas decisiones reales hay en el grupo." />
          <ThM titulo="Calidad" simbolo="C" ayuda="0 = eligió la mejor jugada disponible; 1 = la peor. Más bajo es mejor." />
          <ThM titulo="Tiempo antes de decidir" ayuda="Segundos transcurridos desde la jugada anterior." />
        </tr></thead>
        <tbody>
          <tr>
            <td style={tdIzq}>Tras una señal</td>
            <td style={td}>{conSenal.n}</td>
            <td style={td}>{n3(conSenal.calidad)}</td>
            <td style={td}>{seg(conSenal.latencia)}</td>
          </tr>
          <tr>
            <td style={tdIzq}>Sin señal</td>
            <td style={td}>{sinSenal.n}</td>
            <td style={td}>{n3(sinSenal.calidad)}</td>
            <td style={td}>{seg(sinSenal.latencia)}</td>
          </tr>
        </tbody>
      </Tabla>

      {!comparable && (
        <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-paper-dim)', margin: '12px 0 0' }}>
          Hubo señales, pero ninguna llegó a ir seguida de una decisión real en los tres movimientos
          siguientes: las jugadas que vinieron después estaban forzadas. No hay comparación posible
          con esta sesión.
        </p>
      )}

      {comparable && conSenal.calidad !== null && sinSenal.calidad !== null && (
        <div style={{ display: 'flex', gap: '16px', margin: '14px 0 0' }}>
          <div style={{ flex: 1 }}>
            <Medidor etiqueta={`Tras una señal · ${conSenal.n} ${conSenal.n === 1 ? 'decisión' : 'decisiones'}`}
              valor={conSenal.calidad} optimoEn={0}
              texto="calidad media de las decisiones que siguieron a una señal del ciclo" />
          </div>
          <div style={{ flex: 1 }}>
            <Medidor etiqueta={`Sin señal · ${sinSenal.n} decisiones`}
              valor={sinSenal.calidad} optimoEn={0}
              texto="calidad media del resto de decisiones del mismo aprendiz" />
          </div>
        </div>
      )}

      {comparable && (
        <div style={{ margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--color-paper)', margin: 0 }}>
            {difC !== null && difC < 0
              ? <>Tras una señal eligió <b>mejor</b>: la calidad baja {n3(Math.abs(difC))} respecto del resto de sus decisiones.</>
              : difC !== null && difC > 0
                ? <>Tras una señal eligió <b>peor</b>: la calidad sube {n3(difC)} respecto del resto de sus decisiones.</>
                : <>La calidad de sus decisiones no cambió tras la señal.</>}
            {difT !== null && (difT > 0
              ? <> Y se tomó <b>{seg(Math.abs(difT))} más</b> antes de decidir.</>
              : <> Y se tomó {seg(Math.abs(difT))} menos antes de decidir.</>)}
          </p>
          {pocas && (
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-caution)', margin: 0 }}>
              Atención: {conSenal.n === 1 ? 'es solo 1 decisión' : `son solo ${conSenal.n} decisiones`} tras señal.
              Esto es una observación del caso, no una medida del efecto: con tan pocas, la diferencia
              puede deberse por completo al azar.
            </p>
          )}
        </div>
      )}
    </Bloque>
  )
}
