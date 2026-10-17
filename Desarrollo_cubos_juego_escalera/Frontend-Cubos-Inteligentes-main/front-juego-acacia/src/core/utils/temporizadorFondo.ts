// Temporizadores que no se frenan con la ventana en segundo plano.
//
// Chrome/Edge retrasan los setTimeout/setInterval de una pestaña oculta o
// minimizada (hasta 1 vez por segundo, y tras 5 min hasta 1 vez por minuto).
// En una sesión eso descuadra la cuenta regresiva, el apagado automático de
// las señales PPA y el cronómetro si el operador minimiza Control o pasa a
// otra ventana. Los temporizadores de un Web Worker no tienen ese freno: el
// worker solo avisa a la página cuando vence cada uno.
//
// Misma forma que setTimeout/clearTimeout para poder cambiar uno por otro.
// Si el navegador no permite workers, se usa el temporizador normal.

import { useEffect } from 'react'

type Pendiente = { fn: () => void; repetir: boolean }

const CODIGO_WORKER = `
const t = new Map();
onmessage = (e) => {
  const { op, id, ms } = e.data;
  if (op === 'poner') t.set(id, setTimeout(() => { t.delete(id); postMessage(id); }, ms));
  else if (op === 'cada') t.set(id, setInterval(() => postMessage(id), ms));
  else if (op === 'quitar') { clearTimeout(t.get(id)); clearInterval(t.get(id)); t.delete(id); }
};`

let worker: Worker | null | undefined
const pendientes = new Map<number, Pendiente>()
let siguienteId = 1

function obtenerWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    const url = URL.createObjectURL(new Blob([CODIGO_WORKER], { type: 'text/javascript' }))
    worker = new Worker(url)
    worker.onmessage = (e: MessageEvent<number>) => {
      const p = pendientes.get(e.data)
      if (!p) return
      if (!p.repetir) pendientes.delete(e.data)
      p.fn()
    }
  } catch {
    worker = null
  }
  return worker
}

export type Temporizador = number

export function ponerTemporizador(fn: () => void, ms: number): Temporizador {
  const w = obtenerWorker()
  if (!w) return window.setTimeout(fn, ms) * -1 // negativo = temporizador normal
  const id = siguienteId++
  pendientes.set(id, { fn, repetir: false })
  w.postMessage({ op: 'poner', id, ms })
  return id
}

export function ponerIntervalo(fn: () => void, ms: number): Temporizador {
  const w = obtenerWorker()
  if (!w) return window.setInterval(fn, ms) * -1
  const id = siguienteId++
  pendientes.set(id, { fn, repetir: true })
  w.postMessage({ op: 'cada', id, ms })
  return id
}

export function quitarTemporizador(id: Temporizador | null | undefined) {
  if (!id) return
  if (id < 0) { window.clearTimeout(-id); window.clearInterval(-id); return }
  pendientes.delete(id)
  worker?.postMessage({ op: 'quitar', id })
}

// Mantiene la pantalla encendida (Screen Wake Lock) mientras `activo`: sin
// esto el equipo puede apagar la pantalla o suspenderse en mitad de una
// sesión larga. El navegador suelta el bloqueo al ocultar la pestaña, así
// que se vuelve a pedir al volver a mostrarla.
export function useMantenerPantalla(activo: boolean) {
  useEffect(() => {
    if (!activo || !('wakeLock' in navigator)) return
    let bloqueo: { release: () => Promise<void> } | null = null
    let vivo = true
    const pedir = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const b = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen')
        if (vivo) bloqueo = b
        else b.release().catch(() => {})
      } catch { /* sin permiso o sin soporte: no es crítico */ }
    }
    pedir()
    document.addEventListener('visibilitychange', pedir)
    return () => {
      vivo = false
      document.removeEventListener('visibilitychange', pedir)
      bloqueo?.release().catch(() => {})
    }
  }, [activo])
}
