// Comprueba el reconstructor de bitácoras contra los archivos reales de las
// sesiones de Joel y Jerónimo: que los intentos, las victorias y los errores
// que se reconstruyen coincidan con lo que dice la propia bitácora.
import { readFileSync } from 'node:fs'
import { leerBitacora } from '../src/core/session/importar'

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
}

console.log('')
if (fallos) { console.log(`>>> ${fallos} FALLOS en la importación`); process.exit(1) }
console.log('IMPORTACIÓN OK: las bitácoras exportadas se reconstruyen con sus intentos, recorridos y métricas.')
