// Bitácora de sesión, según las decisiones registradas en
// DECISIONES_PROYECTO.md (2026-09-01): marca de tiempo ISO 8601 con
// milisegundos, exportable a CSV y a JSON; para cada evento de PPA se
// registra la secuencia completa (sugerencia, motivo, decisión del
// operador, motivo del descarte, activación efectiva); cada sesión lleva
// el identificador del operador y la versión de configuración vigente;
// toda sesión de simulación queda marcada como tal (esSimulacion) para no
// poder confundirse con una sesión real.
//
// "Desconexiones" (uno de los mínimos pedidos en DECISIONES_PROYECTO.md)
// no aplica aquí: la simulación no tiene cubos físicos que puedan
// desconectarse.

export type PPAPhase = 'pausar' | 'pensar' | 'actuar'

export type BitacoraEventType =
  | 'movimiento'
  | 'falla'
  | 'sugerencia_ppa'
  | 'decision_ppa'
  | 'victoria'
  | 'derrota'
  | 'reinicio'

export type BitacoraEvent = {
  timestamp: string
  esSimulacion: true
  operadorId: string
  versionConfiguracion: string
  pares: number
  tipo: BitacoraEventType
  detalle: string
  fase?: PPAPhase
  motivo?: string
  decision?: 'confirmada' | 'descartada'
  motivoDescarte?: string
  activacionEfectiva?: boolean
  posiciones: (number | null)[]
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function toCsv(events: BitacoraEvent[]): string {
  const cols: (keyof BitacoraEvent)[] = [
    'timestamp', 'esSimulacion', 'operadorId', 'versionConfiguracion', 'pares',
    'tipo', 'detalle', 'fase', 'motivo', 'decision', 'motivoDescarte',
    'activacionEfectiva', 'posiciones',
  ]
  const esc = (v: unknown) => {
    if (v === undefined || v === null) return ''
    const s = Array.isArray(v) ? JSON.stringify(v) : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const header = cols.join(',')
  const rows = events.map(ev => cols.map(c => esc(ev[c])).join(','))
  return [header, ...rows].join('\n')
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
