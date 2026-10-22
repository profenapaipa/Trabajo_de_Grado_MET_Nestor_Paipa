// Telemetría de los cubos (señal WiFi, reinicios, batería) y latencia de
// la cadena base → pantalla. Los datos los manda cada cubo ("EST=…", cada
// 5 s) y responde a los "PG" del maestro (ping, cada 2 s); el maestro los
// junta en su reporte de esclavos y el backend los reenvía tal cual.

export type TelemetriaCubo = {
  id: number
  // Medidos por el maestro en cada cubo conectado:
  ping?: number   // ida y vuelta maestro↔cubo, ms (-1 = aún sin medir)
  dato?: number   // ms desde la última línea recibida del cubo
  rx?: number     // líneas recibidas del cubo desde que arrancó el maestro
  // Telemetría del propio cubo (puede faltar si aún no llegó):
  mv?: number     // batería en mV; -1 = medición desactivada, -2 = sin divisor
  rssi?: number   // señal WiFi, dBm
  rst?: number    // esp_reset_reason() del último arranque
  up?: number     // segundos encendido
  mac?: string    // últimos 3 bytes de la MAC del chip (identifica el dispositivo)
}

// Curva aproximada de una LiPo de una celda en reposo (mV → %). No es una
// medición exacta de carga: bajo consumo (LED + vibración) la tensión cae
// unos cientos de mV, así que se toma como orientación, no como reloj.
const CURVA_LIPO: [number, number][] = [
  [4200, 100], [4100, 90], [4000, 80], [3900, 65], [3800, 50],
  [3750, 40], [3700, 30], [3650, 20], [3600, 12], [3500, 5], [3300, 0],
]

// Fuera de este rango la lectura no es de una batería (sin divisor, pin
// suelto o alimentado por USB sin batería).
const MV_MIN_VALIDO = 2900, MV_MAX_VALIDO = 4400

export const BATERIA_BAJA_PCT = 20

export function porcentajeBateria(mv: number): number | null {
  if (mv < MV_MIN_VALIDO || mv > MV_MAX_VALIDO) return null
  if (mv >= CURVA_LIPO[0][0]) return 100
  for (let i = 1; i < CURVA_LIPO.length; i++) {
    const [v1, p1] = CURVA_LIPO[i - 1], [v2, p2] = CURVA_LIPO[i]
    if (mv >= v2) return Math.round(p2 + ((mv - v2) / (v1 - v2)) * (p1 - p2))
  }
  return 0
}

export function textoSinMedicion(mv: number): string {
  if (mv === -1) return 'medición desactivada'
  if (mv === -2) return 'sin divisor de tensión'
  return 'lectura fuera de rango'
}

// esp_reset_reason_t (ESP-IDF 5): solo los motivos que importan en sesión.
const MOTIVOS_REINICIO: Record<number, string> = {
  1: 'encendido', 2: 'botón de reset', 3: 'reinicio por software', 4: 'fallo del programa',
  5: 'vigilante (interrupción)', 6: 'vigilante (tarea)', 7: 'vigilante', 9: 'caída de tensión (brownout)',
  11: 'USB', 14: 'pico de tensión',
}
export function motivoReinicio(rst: number): string {
  return MOTIVOS_REINICIO[rst] ?? `motivo ${rst}`
}
// Reinicios que indican un problema de alimentación o de firmware (no un
// encendido normal ni una carga de programa por USB).
export function reinicioAnomalo(rst: number): boolean {
  return rst === 4 || rst === 5 || rst === 6 || rst === 7 || rst === 9 || rst === 14
}

export function calidadSenal(rssi: number): 'buena' | 'regular' | 'mala' {
  return rssi >= -60 ? 'buena' : rssi >= -72 ? 'regular' : 'mala'
}

// ── Estado del enlace de un cubo, en una palabra ───────────────────────────
// Se deduce de lo que el maestro mide: si el cubo contesta a los ping (cada
// 2 s) y cuánto hace de su último dato.
export type EstadoEnlace = 'ok' | 'lento' | 'sin_respuesta' | 'sin_conexion'
export const SIN_RESPUESTA_MS = 5000 // más de esto sin ningún dato = «Sin respuesta»
export const PING_LENTO_MS = 100

export function estadoEnlace(conectado: boolean, t: TelemetriaCubo | undefined): EstadoEnlace {
  if (!conectado) return 'sin_conexion'
  if (t?.dato !== undefined && t.dato > SIN_RESPUESTA_MS) return 'sin_respuesta'
  if (t?.ping !== undefined && t.ping > PING_LENTO_MS) return 'lento'
  return 'ok'
}

// ── Latencia ───────────────────────────────────────────────────────────────
// La base filtra cada casilla durante 25 ms (antirrebote) antes de dar por
// hecho un cambio: ese tiempo también es parte de lo que se tarda en verse.
export const ANTIRREBOTE_MS = 25

export type MarcaLatencia = { edadMs?: number; rttMs?: number; tsBackend?: number }

// Latencia estimada desde que el cubo se levantó/apoyó hasta que llega a
// esta pantalla, y la hora real (reloj del PC) en que ocurrió. Supone que
// backend y navegador corren en el mismo equipo (mismo reloj), que es como
// se monta la sesión; si no, la parte "backend → pantalla" se descarta.
export function estimarLatencia(m: MarcaLatencia, ahora = Date.now()): { totalMs: number; tReal: number } | null {
  if (typeof m.edadMs !== 'number' || typeof m.tsBackend !== 'number') return null
  const red = typeof m.rttMs === 'number' && m.rttMs > 0 ? m.rttMs / 2 : 0
  const backendAPantalla = ahora - m.tsBackend
  const pantalla = backendAPantalla >= 0 && backendAPantalla < 5000 ? backendAPantalla : 0
  const tReal = m.tsBackend - red - m.edadMs - ANTIRREBOTE_MS
  return { totalMs: Math.round(ANTIRREBOTE_MS + m.edadMs + red + pantalla), tReal: Math.round(tReal) }
}

export function resumenLatencia(muestras: number[]): { ultima: number; mediana: number; p95: number; n: number } | null {
  if (!muestras.length) return null
  const orden = [...muestras].sort((a, b) => a - b)
  const q = (p: number) => orden[Math.min(orden.length - 1, Math.floor(p * orden.length))]
  return { ultima: muestras[muestras.length - 1], mediana: q(0.5), p95: q(0.95), n: muestras.length }
}
