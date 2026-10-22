// Comprueba el reconstructor de bitácoras contra los archivos reales de las
// sesiones de Joel y Jerónimo: que los intentos, las victorias y los errores
// que se reconstruyen coincidan con lo que dice la propia bitácora.
import { readFileSync } from 'node:fs'
import { leerBitacora } from '../src/core/session/importar'
import { metricasDeSesion } from '../src/core/simulation/metricas'

// Las mismas bitácoras que la aplicación incluye como sesiones de ejemplo
// (src/assets/sesiones), para que esta comprobación funcione en cualquier
// equipo y también en integración continua.
const ARCHIVOS = [
  'src/assets/sesiones/joel-s1-tutorial.json',
  'src/assets/sesiones/joel-s1-practica-libre.json',
  'src/assets/sesiones/jeronimo-s1-practica-libre.json',
]

let fallos = 0
const chk = (c: boolean, m: string) => { console.log((c ? '  OK   ' : '  FALLO') + ' · ' + m); if (!c) fallos++ }

// Los intentos reconstruidos, agrupados por participante: una sesión de Joel
// son dos bitácoras (tutorial y práctica libre).
type IntentoRec = ReturnType<typeof leerBitacora> extends { ok: true; datos: infer D }
  ? D extends { intentos: (infer I)[] } ? I : never : never
const PORQUIEN: Record<string, IntentoRec[][]> = { Joel: [], 'Jerónimo': [] }

for (const ruta of ARCHIVOS) {
  const nombre = ruta.split('/').pop()!
  const crudo = JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>[]
  const r = leerBitacora(nombre, readFileSync(ruta, 'utf8'))
  if (!r.ok) { chk(false, `${nombre}: ${r.error}`); continue }
  const d = r.datos
  const victoriasLog = crudo.filter(x => x.tipo === 'victoria' || x.tipo === 'nivel_superado').length
  const victoriasRec = d.intentos.filter(i => i.resultado === 'victoria').length
  const fallasLog = crudo.filter(x => x.tipo === 'falla').length
  const erroresRec = d.intentos.reduce((a, i) => a + i.errores, 0)
  const movimientosLog = crudo.filter(x => x.tipo === 'movimiento').length
  const deshacerLog = crudo.filter(x => x.tipo === 'deshacer').length
  const movimientosRec = d.intentos.reduce((a, i) => a + i.metricas.movimientos, 0)
  console.log(`\n${nombre}  [${d.seccion}]  participante detectado: ${d.participanteDetectado || '(ninguno)'}`)
  console.log(`  intentos reconstruidos: ${d.intentos.length} · victorias ${victoriasRec}/${victoriasLog} · `
    + `movimientos ${movimientosRec} (bitácora: ${movimientosLog} movimientos, ${deshacerLog} deshacer) · errores ${erroresRec}/${fallasLog}`)
  console.log('  niveles: ' + [...new Set(d.intentos.map(i => i.pares))].sort().join(', '))
  chk(d.intentos.length > 0, `${nombre}: reconstruye intentos`)
  chk(victoriasRec === victoriasLog, `${nombre}: las victorias coinciden con la bitácora (${victoriasRec}/${victoriasLog})`)
  chk(erroresRec <= fallasLog, `${nombre}: los errores no exceden las fallas registradas (${erroresRec}/${fallasLog})`)
  chk(d.intentos.every(i => i.recorrido.length === i.metricas.movimientos + 1),
    `${nombre}: cada recorrido tiene un nodo más que movimientos`)
  chk(d.intentos.every(i => i.metricas.optimo === i.pares * i.pares + 2 * i.pares),
    `${nombre}: el mínimo de cada nivel es D* = n² + 2n`)
  const ganados = d.intentos.filter(i => i.resultado === 'victoria')
  chk(ganados.every(i => i.metricas.movimientos >= i.metricas.optimo),
    `${nombre}: ninguna victoria usa menos movimientos que el mínimo teórico`)
  const quien = nombre.startsWith('joel') ? 'Joel' : 'Jerónimo'
  PORQUIEN[quien].push(d.intentos)
}

// ── Agregación ponderada frente a media por intento ──────────────────────
//
// La sección «Agregación e interpretación» de main.tex publica cuatro cifras
// concretas de estas mismas bitácoras para mostrar que las dos formas de
// agregar no son equivalentes. Si el motor cambiara, esas cifras dejarían de
// ser ciertas en el documento sin que nadie se enterara.
const PUBLICADO: Record<string, { ramMedia: string; ramPond: string; bucMedia: string; bucAgreg: string }> = {
  Joel: { ramMedia: '0.3304', ramPond: '0.3374', bucMedia: '0.0033', bucAgreg: '0.0104' },
  'Jerónimo': { ramMedia: '0.2492', ramPond: '0.1329', bucMedia: '0.0000', bucAgreg: '0.0000' },
}

console.log('')
console.log('Participante | R media por intento | R ponderada | β media por intento | β agregada')
console.log('-------------|---------------------|-------------|---------------------|-----------')
for (const [quien, partes] of Object.entries(PORQUIEN)) {
  const todos = partes.flat()
  if (!todos.length) continue
  const m = metricasDeSesion(todos.map((i, k) => ({
    numero: k + 1, pares: i.pares, resultado: i.resultado, segundos: i.segundos,
    errores: i.errores, metricas: i.metricas,
  })))
  const e = PUBLICADO[quien]
  const v = [m.ramificacionMedia, m.ramificacionPonderada, m.buclicidadMedia, m.buclicidadAgregada]
    .map(x => x.toFixed(4))
  console.log(` ${quien.padEnd(11)} |       ${v[0]}        |   ${v[1]}    |       ${v[2]}        |  ${v[3]}`)
  if (!e) continue
  chk(v[0] === e.ramMedia, `${quien}: R media por intento = ${v[0]}, el documento publica ${e.ramMedia}`)
  chk(v[1] === e.ramPond, `${quien}: R ponderada = ${v[1]}, el documento publica ${e.ramPond}`)
  chk(v[2] === e.bucMedia, `${quien}: β media por intento = ${v[2]}, el documento publica ${e.bucMedia}`)
  chk(v[3] === e.bucAgreg, `${quien}: β agregada = ${v[3]}, el documento publica ${e.bucAgreg}`)
}

console.log('')
if (fallos) { console.log(`>>> ${fallos} FALLOS en la importación`); process.exit(1) }
console.log('IMPORTACIÓN OK: las bitácoras se reconstruyen con sus intentos, recorridos y métricas,')
console.log('y las cifras de agregación que publica main.tex coinciden con el cálculo.')
