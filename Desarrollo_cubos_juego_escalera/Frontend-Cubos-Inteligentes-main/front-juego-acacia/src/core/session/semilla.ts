import { cargarArchivo, idDeNombre } from './perfiles'
import { importarBitacoras, leerBitacora, type BitacoraImportada } from './importar'

// Sesiones de ejemplo que vienen con la aplicación.
//
// Las dos primeras sesiones reales del estudio —Joel (tutorial completo más
// práctica libre) y Jerónimo (práctica libre)— se jugaron antes de que
// existiera el historial, así que solo quedaban como las bitácoras .json que
// se descargaron entonces. Se incluyen con la aplicación y se cargan solas la
// primera vez que se abre, para que el panel de informes tenga datos reales
// desde el primer momento: en el equipo de quien revise esto, y también en la
// versión publicada en la web, donde cada visitante empieza con el
// almacenamiento vacío.
//
// Condiciones: se hace UNA sola vez por navegador (queda una marca), nunca
// sobrescribe nada de quien use la aplicación, y las sesiones quedan
// señaladas como importadas. Si se borran, no vuelven.

const MARCA = 'escalera.semilla.v1'

type Semilla = { archivo: string; participante: string; cargar: () => Promise<unknown> }

const SEMILLAS: Semilla[][] = [
  // Cada grupo es una sesión: los dos archivos de Joel son del mismo día.
  [
    {
      archivo: 'joel-s1-tutorial.json', participante: 'JOEL',
      cargar: () => import('../../assets/sesiones/joel-s1-tutorial.json'),
    },
    {
      archivo: 'joel-s1-practica-libre.json', participante: 'JOEL',
      cargar: () => import('../../assets/sesiones/joel-s1-practica-libre.json'),
    },
  ],
  [
    {
      archivo: 'jeronimo-s1-practica-libre.json', participante: 'JERÓNIMO',
      cargar: () => import('../../assets/sesiones/jeronimo-s1-practica-libre.json'),
    },
  ],
]

// Devuelve true si cargó algo (y por tanto hay que volver a pintar la lista
// de perfiles).
export async function sembrarSesionesDeEjemplo(): Promise<boolean> {
  try {
    if (localStorage.getItem(MARCA)) return false
  } catch {
    return false // sin almacenamiento no hay nada que sembrar
  }

  let algo = false
  try {
    const yaEstan = new Set(cargarArchivo().sesiones.map(s => s.sesionId))
    for (const grupo of SEMILLAS) {
      const partes: BitacoraImportada[] = []
      for (const s of grupo) {
        const mod = await s.cargar()
        const datos = (mod as { default?: unknown }).default ?? mod
        const r = leerBitacora(s.archivo, JSON.stringify(datos))
        if (r.ok) partes.push(r.datos)
      }
      if (partes.length === 0) continue
      // Si esa sesión ya está (porque alguien la importó a mano), no se toca.
      const id = `importada-${idDeNombre(grupo[0].participante)}`
      if ([...yaEstan].some(x => x.startsWith(id))) continue
      importarBitacoras(partes, grupo[0].participante, '', true)
      algo = true
    }
  } catch { /* si algo falla, la aplicación arranca igual, solo sin ejemplos */ }

  try { localStorage.setItem(MARCA, new Date().toISOString()) } catch { /* sin almacenamiento */ }
  return algo
}
