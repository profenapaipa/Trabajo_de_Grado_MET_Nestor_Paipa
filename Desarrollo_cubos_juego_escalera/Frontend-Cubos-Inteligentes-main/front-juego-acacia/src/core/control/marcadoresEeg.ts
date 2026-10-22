// Marcadores para sincronizar la sesión con el EEG (OpenBCI Cyton+Daisy).
//
// El archivo crudo del OpenBCI GUI trae en cada muestra la hora del PC
// (columna "Timestamp", segundos Unix). Cada marcador lleva la hora del
// mismo reloj en que ocurrió el evento, así que basta con buscar la muestra
// más cercana — lo hace herramientas/sincronizar_eeg.py, que además deja un
// archivo de eventos listo para importar en EEGLAB.
//
// Para las jugadas del tablero la hora no es la de llegada a la pantalla
// sino la estimada del momento físico (telemetria.ts/estimarLatencia): se
// le restan la espera en el maestro, el viaje por la red y el antirrebote.
//
// Los códigos son fijos (no cambiarlos entre sesiones: el análisis los usa).

export const CODIGOS_MARCADOR = {
  intento_iniciado: 10,   // se pulsó Iniciar (empieza la cuenta regresiva)
  inicio_juego: 11,       // "¡YA!": el participante puede mover
  cubo_levantado: 20,     // un cubo deja su casilla (inicio del movimiento)
  jugada_valida: 21,      // un cubo apoyado en una casilla permitida
  falla_movimiento: 22,   // jugada inválida
  pausa_automatica: 23,
  correccion_completada: 24,
  pausa_operador: 30,
  reanudar_operador: 31,
  senal_pausar: 32,       // señal PPA manual a un cubo
  senal_pensar: 33,
  senal_actuar: 34,
  senal_estado_inicial: 35,
  victoria: 40,
  derrota: 41,
  reinicio_manual: 42,
  terminar_operador: 44,  // «Terminar»: intento cerrado y guardado como interrumpido
  tablero_reordenado: 43,
} as const

export type TipoMarcador = keyof typeof CODIGOS_MARCADOR

export type MarcadorEeg = {
  tsMs: number          // hora Unix en ms (reloj del PC)
  codigo: number
  evento: TipoMarcador
  detalle: string
  intentoNum?: number
  origen: 'tablero' | 'operador' | 'sistema'
  latenciaMs?: number   // solo jugadas del tablero: cuánto tardó en llegar a la pantalla
}

export function crearMarcador(evento: TipoMarcador, detalle: string, extra: Partial<MarcadorEeg> = {}): MarcadorEeg {
  return { tsMs: Date.now(), codigo: CODIGOS_MARCADOR[evento], evento, detalle, origen: 'sistema', ...extra }
}

const esc = (s: string) => `"${s.replace(/"/g, '""')}"`

// CSV con la hora en segundos Unix (con milisegundos), la misma unidad de
// la columna Timestamp del OpenBCI GUI.
export function toCsvMarcadores(rows: MarcadorEeg[]): string {
  const cab = 'timestamp_unix,hora_iso,codigo,evento,detalle,intento,origen,latencia_ms'
  const lineas = rows.map(m => [
    (m.tsMs / 1000).toFixed(3), new Date(m.tsMs).toISOString(), m.codigo, m.evento, esc(m.detalle),
    m.intentoNum ?? '', m.origen, m.latenciaMs ?? '',
  ].join(','))
  return [cab, ...lineas].join('\n')
}
