// Dos bitácoras separadas para la pestaña de Control, según pidió el autor:
// una de eventos de los cubos (reportados por el hardware físico) y otra,
// independiente, de las decisiones del operador (los envíos manuales de
// Pausar/Pensar/Actuar desde la consola) — cada una descargable por
// separado. No incluye sugerencias automáticas de ninguna fase: Control
// solo registra lo que el operador decide y lo que el hardware reporta.

import { toCsvGeneric, downloadFile, nowIso } from '../bitacora/csv'

export type EventoCuboTipo =
  | 'posiciones' | 'esclavo_conectado' | 'esclavo_desconectado'
  | 'base_conectada' | 'base_desconectada' | 'senal_apagada_automatica' | 'falla_movimiento'
  | 'victoria' | 'derrota' | 'cubo_no_detectado'
  // Control de partida ("intentos"): agrupados por intentoId, ver App.tsx.
  | 'intento_iniciado' | 'intento_finalizado' | 'reinicio_manual' | 'tablero_reordenado'

export type EventoCubo = {
  timestamp: string
  pares: number
  tipo: EventoCuboTipo
  detalle: string
  posiciones?: (number | null)[]
  // Agrupa las filas de un mismo intento de partida (Iniciar -> victoria/
  // bloqueo/reinicio). Ausente en eventos que no pertenecen a un intento
  // en curso (p. ej. señales de conexión antes de iniciar).
  intentoId?: string
  // Correlativo legible del mismo intento (1, 2, 3…) — intentoId es un
  // timestamp interno, útil para agrupar filas pero no para leer "¿en qué
  // intento vamos?" de un vistazo al exportar y contrastar intentos.
  intentoNum?: number
}

export type DecisionOperador = {
  timestamp: string
  pares: number
  operadorId: string
  cuboId: number
  fase: 'pausar' | 'pensar' | 'actuar' | 'estado_inicial'
  detalle: string
  intentoId?: string
  intentoNum?: number
}

const EVENTO_CUBO_COLS: (keyof EventoCubo)[] = ['timestamp', 'pares', 'tipo', 'detalle', 'posiciones', 'intentoId', 'intentoNum']
const DECISION_OPERADOR_COLS: (keyof DecisionOperador)[] = ['timestamp', 'pares', 'operadorId', 'cuboId', 'fase', 'detalle', 'intentoId', 'intentoNum']

export function toCsvEventosCubo(rows: EventoCubo[]): string {
  return toCsvGeneric(rows, EVENTO_CUBO_COLS)
}
export function toCsvDecisionesOperador(rows: DecisionOperador[]): string {
  return toCsvGeneric(rows, DECISION_OPERADOR_COLS)
}

export { downloadFile, nowIso }
