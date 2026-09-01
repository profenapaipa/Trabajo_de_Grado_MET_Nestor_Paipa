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
  | 'victoria' | 'derrota'

export type EventoCubo = {
  timestamp: string
  pares: number
  tipo: EventoCuboTipo
  detalle: string
  posiciones?: (number | null)[]
}

export type DecisionOperador = {
  timestamp: string
  pares: number
  operadorId: string
  cuboId: number
  fase: 'pausar' | 'pensar' | 'actuar' | 'estado_inicial'
  detalle: string
}

const EVENTO_CUBO_COLS: (keyof EventoCubo)[] = ['timestamp', 'pares', 'tipo', 'detalle', 'posiciones']
const DECISION_OPERADOR_COLS: (keyof DecisionOperador)[] = ['timestamp', 'pares', 'operadorId', 'cuboId', 'fase', 'detalle']

export function toCsvEventosCubo(rows: EventoCubo[]): string {
  return toCsvGeneric(rows, EVENTO_CUBO_COLS)
}
export function toCsvDecisionesOperador(rows: DecisionOperador[]): string {
  return toCsvGeneric(rows, DECISION_OPERADOR_COLS)
}

export { downloadFile, nowIso }
