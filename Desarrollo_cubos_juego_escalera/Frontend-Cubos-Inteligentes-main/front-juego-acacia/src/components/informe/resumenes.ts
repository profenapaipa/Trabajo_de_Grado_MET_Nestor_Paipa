import type { MetricasSesion } from '../../core/simulation/metricas'
import type { EfectoMediacion } from '../../core/session/mediacion'
import type { SeccionDoc } from './exportar'
import { n2, n3, pct } from './interpretar'

// Las cifras de encabezado de un informe y su sección de mediación, definidas
// UNA vez.
//
// Existe porque el informe en pantalla y el archivo que se descarga se
// construían por caminos separados, y divergieron: el archivo seguía con las
// medias por intento y sin eficiencia, tiempos ni mediación mientras la
// pantalla ya traía el análisis nuevo. Un archivo que contradice lo que se ve
// es peor que uno sin análisis, porque es el que se envía. Ahora los dos leen
// de aquí.

export type CifraResumen = { etiqueta: string; valor: string; nota?: string }

type Opciones = {
  conDecisiones: boolean
  // Milisegundos medios antes de decidir y antes de una jugada forzada, si la
  // bitácora trae tiempos.
  tiempos?: { decision: number | null; forzada: number | null }
  incluirAcierto?: boolean
}

const seg = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

export function cifrasTitulares(m: MetricasSesion, o: Opciones): CifraResumen[] {
  const out: CifraResumen[] = [
    {
      etiqueta: 'Eficiencia media (E)',
      valor: m.victorias ? n2(m.eficienciaMedia) : '—',
      // Equivale a usar 1/E veces el mínimo. No se escribe «Q media»: la media de las
      // eficiencias no es la inversa de la media de las circuidades, y poner las dos
      // juntas haría pensar que una de las dos está mal.
      nota: m.victorias ? `1 = ruta mínima · equivale a usar ${n2(1 / m.eficienciaMedia)} veces el mínimo` : 'sin intentos ganados',
    },
    {
      etiqueta: 'Ramificación (R)',
      valor: o.conDecisiones ? n3(m.ramificacionPonderada) : '—',
      nota: o.conDecisiones
        ? `ponderada sobre ${m.puntosDecisionTotales} decisiones · media por intento ${n3(m.ramificacionMedia)}`
        : 'sin decisiones reales',
    },
    {
      etiqueta: 'Buclicidad (β)',
      valor: n3(m.buclicidadAgregada),
      nota: `agregada · media por intento ${n3(m.buclicidadMedia)}`,
    },
  ]
  if (o.incluirAcierto) {
    out.push({
      etiqueta: 'Acierto (α)',
      valor: o.conDecisiones ? pct(m.tasaAciertoPonderada) : '—',
      nota: o.conDecisiones ? `en ${m.puntosDecisionTotales} decisiones reales` : 'en puntos de decisión',
    })
  }
  if (o.tiempos) {
    const { decision, forzada } = o.tiempos
    out.push({
      etiqueta: 'Antes de decidir',
      valor: decision === null ? '—' : seg(decision),
      nota: forzada === null ? 'sin tiempos en la bitácora' : `frente a ${seg(forzada)} en jugadas forzadas`,
    })
  }
  return out
}

// Para el archivo: pares etiqueta/valor con la nota como línea pequeña.
export const comoDatosDoc = (cs: CifraResumen[]) => cs.map(c => ({ etiqueta: c.etiqueta, valor: c.valor, nota: c.nota }))

// La sección de mediación del archivo, con las mismas cifras que el bloque en
// pantalla (BloqueMediacion) y el mismo cuidado: con pocas decisiones tras
// señal dice que es una observación y no una medida.
const MINIMO_PARA_LEER = 5

export function seccionMediacion(e: EfectoMediacion): SeccionDoc {
  const titulo = 'Efecto de la mediación'
  if (e.activaciones === 0) {
    return {
      titulo,
      parrafos: ['No se activó ninguna señal del ciclo Pausar–Pensar–Actuar, de modo que no hay efecto que medir. El resto del informe describe el desempeño sin mediación.'],
    }
  }
  const t = (ms: number | null) => (ms === null ? '—' : seg(ms))
  const c = (x: number | null) => (x === null ? '—' : n3(x))
  const partes: string[] = [
    `Se activaron ${e.activaciones} señales: ${e.porFase.pausar} de Pausar, ${e.porFase.pensar} de Pensar y ${e.porFase.actuar} de Actuar. `
    + 'La tabla compara las decisiones que vinieron después de una señal con las demás decisiones del mismo aprendiz en la misma sesión.',
  ]
  if (!e.comparable) {
    partes.push('Hubo señales, pero ninguna llegó a ir seguida de una decisión real en los tres movimientos siguientes: las jugadas que vinieron después estaban forzadas. No hay comparación posible con esta sesión.')
  } else if (e.conSenal.calidad !== null && e.sinSenal.calidad !== null) {
    const d = e.conSenal.calidad - e.sinSenal.calidad
    partes.push(d < 0
      ? `Tras una señal eligió mejor: la calidad baja ${n3(Math.abs(d))} respecto del resto de sus decisiones.`
      : d > 0
        ? `Tras una señal eligió peor: la calidad sube ${n3(d)} respecto del resto de sus decisiones.`
        : 'La calidad de sus decisiones no cambió tras la señal.')
    if (e.conSenal.n < MINIMO_PARA_LEER) {
      partes.push(
        `Atención: ${e.conSenal.n === 1 ? 'es solo 1 decisión' : `son solo ${e.conSenal.n} decisiones`} tras señal. `
        + 'Esto es una observación del caso, no una medida del efecto: con tan pocas, la diferencia puede deberse por completo al azar.',
      )
    }
  }
  return {
    titulo,
    parrafos: partes,
    tablas: [{
      cols: ['Grupo', 'Decisiones', 'Calidad (C)', 'Tiempo antes de decidir'],
      alineacion: ['izq', 'der', 'der', 'der'],
      filas: [
        ['Tras una señal', e.conSenal.n, c(e.conSenal.calidad), t(e.conSenal.latencia)],
        ['Sin señal', e.sinSenal.n, c(e.sinSenal.calidad), t(e.sinSenal.latencia)],
      ],
      nota: '«Decisiones» cuenta solo las jugadas en que había algo que elegir. Una señal se atribuye a la primera decisión real que llega en los tres movimientos siguientes; calidad 0 = eligió la mejor jugada disponible, 1 = la peor.',
    }],
  }
}
