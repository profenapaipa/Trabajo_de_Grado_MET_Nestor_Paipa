import type { MetricasIntento } from '../../core/simulation/metricas'
import { NOMBRE_SECCION, REGLA_DE_ERROR, type IntentoSesion, type Seccion } from '../../core/session/sesion'

// Lectura en lenguaje llano de las métricas del informe.
//
// Un número suelto (R = 0,214) no le dice nada a quien acompaña la sesión, y
// el informe lo tiene que leer el tutor, el observador y la familia, no solo
// quien escribió las ecuaciones. Aquí se traduce cada métrica a una frase, y
// el conjunto a una síntesis de dos o tres líneas.
//
// Las ecuaciones viven en main.tex, sección «Fundamento matemático de las
// métricas de análisis» (3.1 a 3.11) y se calculan en core/simulation/metricas.ts.

export const n2 = (x: number) => x.toFixed(2)
export const n3 = (x: number) => x.toFixed(3)
export const pct = (x: number) => `${Math.round(x * 100)}%`
export const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

export function nivelLabel(pares: number): string {
  return `${pares} par${pares > 1 ? 'es' : ''}`
}

// ── Lectura de cada métrica ────────────────────────────────────────────────

export function leerCircuidad(q: number, gano: boolean): string {
  if (!gano) return 'Solo se mide en un intento que llegó a la meta: este no llegó, así que el cociente no es comparable.'
  if (q <= 1.01) return 'Ganó por la ruta mínima: no dio ni un paso de más.'
  const extra = Math.round((q - 1) * 100)
  if (q < 1.3) return `Recorrió un ${extra}% más de lo mínimo: ruta casi directa.`
  if (q < 2) return `Recorrió un ${extra}% más de lo mínimo: dio vueltas, pero llegó.`
  return `Recorrió ${n2(q)} veces la ruta mínima: llegó explorando mucho.`
}

export function leerRamificacion(r: number, puntos: number): string {
  if (puntos === 0) return 'No hubo decisiones reales: todas las jugadas eran forzadas o equivalentes.'
  if (r === 0) return `En las ${plural(puntos, 'decisión real', 'decisiones reales')} eligió siempre la mejor jugada disponible.`
  if (r < 0.15) return `Decisiones muy buenas: en promedio se desvió un ${pct(r)} de la mejor opción disponible.`
  if (r < 0.35) return `Decisiones aceptables: en promedio se desvió un ${pct(r)} de la mejor opción.`
  return `Decisiones alejadas de lo óptimo: en promedio se desvió un ${pct(r)} de la mejor opción disponible.`
}

export function leerAcierto(a: number, puntos: number): string {
  if (puntos === 0) return 'Sin puntos de decisión que medir.'
  const aciertos = Math.round(a * puntos)
  return `Acertó la mejor jugada en ${aciertos} de ${puntos} ${puntos === 1 ? 'decisión' : 'decisiones'} (${pct(a)}).`
}

export function leerBuclicidad(m: MetricasIntento): string {
  if (m.movimientos === 0) return 'Sin movimientos registrados.'
  if (m.retornos === 0) return 'No volvió a ninguna posición ya visitada: avanzó sin repetir.'
  const t = m.tamanosBucle.length ? ` Los bucles midieron ${m.tamanosBucle.join(', ')} movimientos.` : ''
  return `Volvió ${plural(m.retornos, 'vez', 'veces')} a una posición en la que ya había estado `
    + `(${pct(m.buclicidad)} de sus jugadas), formando ${plural(m.ciclosIndependientes, 'bucle distinto', 'bucles distintos')}.${t}`
}

export function leerGradoLibertad(g: number): string {
  if (g === 0) return 'Sin datos.'
  return `En promedio tuvo ${n2(g)} jugadas posibles por turno: ese es el margen real de elección del nivel.`
}

export function leerFaltas(total: number, porRegla: Record<string, number>): string {
  if (total === 0) return 'No intentó ninguna jugada prohibida.'
  const orden = Object.entries(porRegla).sort((a, b) => b[1] - a[1])
  const [tipo, veces] = orden[0]
  const nombre = REGLA_DE_ERROR[tipo] ?? tipo
  return `${plural(total, 'jugada rechazada', 'jugadas rechazadas')}. La regla que más se intentó romper fue «${nombre}» `
    + `(${plural(veces, 'vez', 'veces')}).`
}

// ── Tabla detallada de un intento ──────────────────────────────────────────
// La misma definición alimenta la tabla en pantalla y el informe descargado.

export type FilaMetrica = { metrica: string; simbolo: string; valor: string; significado: string }

export function filasMetricas(m: MetricasIntento, resultado: IntentoSesion['resultado']): FilaMetrica[] {
  const gano = resultado === 'victoria'
  return [
    {
      metrica: 'Movimientos', simbolo: 'L',
      valor: `${m.movimientos}`,
      significado: `Mínimo posible para ${nivelLabel(m.pares)}: ${m.optimo} movimientos (D* = n² + 2n).`,
    },
    {
      metrica: 'Circuidad', simbolo: 'Q',
      valor: gano ? n2(m.circuidad) : '—',
      significado: leerCircuidad(m.circuidad, gano),
    },
    {
      metrica: 'Ramificación', simbolo: 'R',
      valor: m.puntosDecision ? n3(m.ramificacion) : '—',
      significado: leerRamificacion(m.ramificacion, m.puntosDecision),
    },
    {
      metrica: 'Tasa de acierto', simbolo: 'α',
      valor: m.puntosDecision ? pct(m.tasaAcierto) : '—',
      significado: leerAcierto(m.tasaAcierto, m.puntosDecision),
    },
    {
      metrica: 'Retornos', simbolo: 'ν',
      valor: `${m.retornos}`,
      significado: leerBuclicidad(m),
    },
    {
      metrica: 'Buclicidad', simbolo: 'β',
      valor: m.movimientos ? n3(m.buclicidad) : '—',
      significado: 'Proporción de jugadas que terminaron en una posición ya visitada (ν / L).',
    },
    {
      metrica: 'Bucles independientes', simbolo: 'μ',
      valor: `${m.ciclosIndependientes}`,
      significado: 'Número ciclomático del recorrido: cuántos bucles distintos hizo, no cuántas veces los repitió.',
    },
    {
      metrica: 'Grado de libertad medio', simbolo: 'δ media',
      valor: m.movimientos ? n2(m.gradoLibertadMedio) : '—',
      significado: leerGradoLibertad(m.gradoLibertadMedio),
    },
    {
      metrica: 'Posiciones distintas', simbolo: '|V(W)|',
      valor: `${m.estadosDistintos}`,
      significado: 'Cuántos estados diferentes del grafo visitó durante el intento.',
    },
  ]
}

// ── Tendencia entre intentos ───────────────────────────────────────────────
// Compara la primera mitad de los intentos con la segunda. Con menos de 4
// intentos no se afirma nada: no hay con qué.

export type Tendencia = 'mejora' | 'empeora' | 'estable' | 'sin-datos'

export function tendencia(valores: (number | null)[], mejorEs: 'menor' | 'mayor'): Tendencia {
  const v = valores.filter((x): x is number => x !== null)
  if (v.length < 4) return 'sin-datos'
  const corte = Math.floor(v.length / 2)
  const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const antes = prom(v.slice(0, corte))
  const despues = prom(v.slice(corte))
  const delta = despues - antes
  const umbral = 0.05
  if (Math.abs(delta) < umbral) return 'estable'
  const bajo = delta < 0
  return (mejorEs === 'menor') === bajo ? 'mejora' : 'empeora'
}

const FRASE_TENDENCIA: Record<'intentos' | 'sesiones', Record<Tendencia, string>> = {
  intentos: {
    mejora: 'mejoró en la segunda mitad de la sesión',
    empeora: 'empeoró en la segunda mitad de la sesión',
    estable: 'se mantuvo estable a lo largo de la sesión',
    'sin-datos': 'todavía no tiene suficientes intentos para afirmar una tendencia',
  },
  sesiones: {
    mejora: 'mejoró en las sesiones más recientes',
    empeora: 'empeoró en las sesiones más recientes',
    estable: 'se mantuvo estable entre sesiones',
    'sin-datos': 'todavía no tiene suficientes sesiones para afirmar una tendencia',
  },
}

export function leerTendencia(t: Tendencia, ambito: 'intentos' | 'sesiones' = 'intentos'): string {
  return FRASE_TENDENCIA[ambito][t]
}

// ── Síntesis ───────────────────────────────────────────────────────────────

// Dos o tres frases con lo esencial de un nivel: qué hizo, qué tan lejos
// quedó del mínimo, dónde estuvo la dificultad.
export function sintesisNivel(intentos: IntentoSesion[], seccion: Seccion, pares: number, faltas: Record<string, number>): string[] {
  if (intentos.length === 0) return ['Todavía no hay intentos terminados en este nivel.']
  const victorias = intentos.filter(i => i.resultado === 'victoria')
  const optimo = pares * pares + 2 * pares
  const out: string[] = []

  out.push(
    `En ${NOMBRE_SECCION[seccion]}, nivel de ${nivelLabel(pares)}, se jugaron `
    + `${plural(intentos.length, 'intento', 'intentos')} y se ganaron ${victorias.length}. `
    + `El mínimo para ganar este nivel es ${optimo} movimientos.`,
  )

  if (victorias.length > 0) {
    const mejor = victorias.reduce((a, b) => (a.metricas.movimientos <= b.metricas.movimientos ? a : b))
    out.push(
      `El mejor intento ganado fue el #${mejor.numero}, con ${mejor.metricas.movimientos} movimientos `
      + `en ${reloj(mejor.segundos)} — ${leerCircuidad(mejor.metricas.circuidad, true).toLowerCase()}`,
    )
  } else {
    out.push('Ningún intento llegó a la meta todavía, así que la circuidad no se puede comparar: lo que sí se puede leer es la calidad de las decisiones y los bucles.')
  }

  const conDecisiones = intentos.filter(i => i.metricas.puntosDecision > 0)
  if (conDecisiones.length > 0) {
    const r = conDecisiones.reduce((a, i) => a + i.metricas.ramificacion, 0) / conDecisiones.length
    const retornos = intentos.reduce((a, i) => a + i.metricas.retornos, 0)
    out.push(
      `${leerRamificacion(r, conDecisiones.reduce((a, i) => a + i.metricas.puntosDecision, 0))} `
      + (retornos === 0 ? 'No repitió ninguna posición.' : `Volvió ${plural(retornos, 'vez', 'veces')} a posiciones ya visitadas.`),
    )
  }

  const total = Object.values(faltas).reduce((a, b) => a + b, 0)
  out.push(leerFaltas(total, faltas))
  return out
}

// Lo mismo para toda la sesión, cruzando las cuatro pestañas.
export function sintesisSesion(intentos: IntentoSesion[], faltas: Record<string, number>, secciones: Seccion[], duracionSeg: number): string[] {
  const out: string[] = []
  const victorias = intentos.filter(i => i.resultado === 'victoria').length
  const niveles = [...new Set(intentos.map(i => i.pares))].sort((a, b) => a - b)

  if (intentos.length === 0) {
    return [
      `La sesión duró ${reloj(duracionSeg)} y se trabajó en ${secciones.length ? secciones.map(s => NOMBRE_SECCION[s]).join(', ') : 'ninguna sección'}, `
      + 'pero no se terminó ningún intento con movimientos, así que no hay métricas de trayectoria que informar.',
    ]
  }

  out.push(
    `En ${reloj(duracionSeg)} de sesión se completaron ${plural(intentos.length, 'intento', 'intentos')} `
    + `(${victorias} ${victorias === 1 ? 'ganado' : 'ganados'}) repartidos en `
    + `${plural(secciones.length, 'sección', 'secciones')} y ${plural(niveles.length, 'nivel', 'niveles')} `
    + `(${niveles.map(nivelLabel).join(', ')}).`,
  )

  const conDecisiones = intentos.filter(i => i.metricas.puntosDecision > 0)
  if (conDecisiones.length > 0) {
    const tR = tendencia(intentos.map(i => (i.metricas.puntosDecision ? i.metricas.ramificacion : null)), 'menor')
    const r = conDecisiones.reduce((a, i) => a + i.metricas.ramificacion, 0) / conDecisiones.length
    out.push(`Calidad de las decisiones: R media ${n3(r)} — ${leerTendencia(tR)}.`)
  }

  const tB = tendencia(intentos.map(i => (i.metricas.movimientos ? i.metricas.buclicidad : null)), 'menor')
  const retornos = intentos.reduce((a, i) => a + i.metricas.retornos, 0)
  out.push(
    retornos === 0
      ? 'No hubo retornos a posiciones ya visitadas en toda la sesión.'
      : `Bucles: ${plural(retornos, 'retorno', 'retornos')} a posiciones ya visitadas en total — ${leerTendencia(tB)}.`,
  )

  const total = Object.values(faltas).reduce((a, b) => a + b, 0)
  out.push(leerFaltas(total, faltas))
  return out
}

// ── Balance general ────────────────────────────────────────────────────────
// Lo primero del informe: cinco indicadores con semáforo y una frase, para
// que cualquier persona sepa cómo le fue sin leer una sola ecuación. El
// detalle viene después.

export type NivelBalance = 'bien' | 'medio' | 'bajo' | 'nd'

export type Indicador = {
  nombre: string
  valor: string
  nivel: NivelBalance
  lectura: string
}

export type Balance = { titular: string; indicadores: Indicador[] }

export const COLOR_BALANCE: Record<NivelBalance, string> = {
  bien: 'var(--color-online)',
  medio: 'var(--color-caution)',
  bajo: 'var(--color-offline)',
  nd: 'var(--color-line-strong)',
}

export const PALABRA_BALANCE: Record<NivelBalance, string> = {
  bien: 'bien', medio: 'regular', bajo: 'por trabajar', nd: 'sin datos',
}

export function balanceDe(intentos: IntentoSesion[], faltas: Record<string, number>): Balance {
  const n = intentos.length
  const victorias = intentos.filter(i => i.resultado === 'victoria')
  const conDecisiones = intentos.filter(i => i.metricas.puntosDecision > 0)
  const jugados = intentos.filter(i => i.metricas.movimientos > 0)
  const totalFaltas = Object.values(faltas).reduce((a, b) => a + b, 0)
  const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

  if (n === 0) {
    return {
      titular: 'Todavía no hay ningún intento terminado, así que no hay balance que mostrar. En cuanto se complete un intento, aquí aparecerá el resumen.',
      indicadores: [],
    }
  }

  const q = prom(victorias.map(i => i.metricas.circuidad))
  const r = prom(conDecisiones.map(i => i.metricas.ramificacion))
  const b = prom(jugados.map(i => i.metricas.buclicidad))
  const retornos = jugados.reduce((a, i) => a + i.metricas.retornos, 0)
  const faltasPorIntento = totalFaltas / n

  const indicadores: Indicador[] = [
    {
      nombre: 'Objetivo cumplido',
      valor: `${victorias.length} de ${n}`,
      nivel: victorias.length === 0 ? 'bajo' : victorias.length / n >= 0.5 ? 'bien' : 'medio',
      lectura: victorias.length === 0
        ? 'Ningún intento llegó a intercambiar los dos grupos de fichas.'
        : `Terminó el intercambio completo en ${plural(victorias.length, 'intento', 'intentos')} de ${n}.`,
    },
    {
      nombre: 'Eficiencia de la ruta',
      valor: victorias.length ? `${n2(q)}×` : '—',
      nivel: victorias.length === 0 ? 'nd' : q <= 1.2 ? 'bien' : q <= 2 ? 'medio' : 'bajo',
      lectura: victorias.length === 0
        ? 'Se mide solo en los intentos que llegaron a la meta.'
        : q <= 1.01
          ? 'Ganó por el camino más corto posible.'
          : `Usó ${n2(q)} veces los movimientos mínimos necesarios (${pct(q - 1)} de más).`,
    },
    {
      nombre: 'Calidad de las decisiones',
      valor: conDecisiones.length ? n2(r) : '—',
      nivel: conDecisiones.length === 0 ? 'nd' : r <= 0.15 ? 'bien' : r <= 0.35 ? 'medio' : 'bajo',
      lectura: conDecisiones.length === 0
        ? 'En estos intentos no hubo jugadas donde hubiera algo que elegir.'
        : r === 0
          ? 'Siempre eligió la mejor jugada disponible.'
          : `Donde había que elegir, se desvió en promedio un ${pct(r)} de la mejor opción (0 sería perfecto).`,
    },
    {
      nombre: 'Vueltas sobre lo andado',
      valor: `${retornos}`,
      nivel: retornos === 0 ? 'bien' : b <= 0.15 ? 'medio' : 'bajo',
      lectura: retornos === 0
        ? 'No volvió a ninguna posición por la que ya había pasado.'
        : `Volvió ${plural(retornos, 'vez', 'veces')} a posiciones ya visitadas (${pct(b)} de las jugadas).`,
    },
    {
      nombre: 'Respeto de las reglas',
      valor: `${totalFaltas}`,
      nivel: totalFaltas === 0 ? 'bien' : faltasPorIntento <= 1 ? 'medio' : 'bajo',
      lectura: totalFaltas === 0
        ? 'No intentó ninguna jugada prohibida.'
        : `${plural(totalFaltas, 'jugada rechazada', 'jugadas rechazadas')}: ${n2(faltasPorIntento)} por intento en promedio.`,
    },
  ]

  const buenos = indicadores.filter(i => i.nivel === 'bien').map(i => i.nombre.toLowerCase())
  const flojos = indicadores.filter(i => i.nivel === 'bajo').map(i => i.nombre.toLowerCase())
  const medibles = indicadores.filter(i => i.nivel !== 'nd').length
  // Dos nombres bastan: una lista de cinco no se lee, se saltea.
  const lista = (xs: string[]) => (xs.length > 2 ? `${xs[0]}, ${xs[1]} y ${xs.length - 2} más` : xs.join(' y '))
  const titular = `De ${plural(n, 'intento terminado', 'intentos terminados')}, ${victorias.length} `
    + `${victorias.length === 1 ? 'alcanzó' : 'alcanzaron'} el objetivo.`
    + (buenos.length === medibles && medibles > 0
      ? ' Todos los indicadores quedaron en verde.'
      : buenos.length ? ` Lo más sólido: ${lista(buenos)}.` : '')
    + (flojos.length ? ` Lo que conviene trabajar: ${lista(flojos)}.` : '')

  return { titular, indicadores }
}
