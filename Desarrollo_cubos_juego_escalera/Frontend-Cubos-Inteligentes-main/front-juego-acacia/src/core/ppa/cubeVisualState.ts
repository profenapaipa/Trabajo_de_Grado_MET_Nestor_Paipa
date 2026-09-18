// Resolutor único de estado visual por cubo — ver la tabla de prioridad
// completa en ESTADO_VISUAL_CUBOS.md (raíz de Desarrollo_cubos_juego_escalera/).
// Ese archivo es la referencia; este módulo es su única implementación en el
// frontend. El firmware (Cubo_Esclavo_v3.ino) no decide prioridad por su
// cuenta — solo ejecuta, de forma atómica, cualquier comando que reciba
// (EF=<n> o M=...), así que el criterio de qué gana sobre qué vive UNA sola
// vez, aquí, y tanto el comando físico como el color en pantalla salen de la
// misma función. Así se evita la clase de bug ya encontrada dos veces en la
// prueba con hardware real del 2026-09-18 (ver PENDIENTES_TESIS.md): un
// evento no relacionado pisando el estado vigente de un cubo.

import { PPA_RGB, PPA_VIBRATION, PPA_HEX, EFECTOS, BLANCO_HEX, INVALIDO_HEX, type PPAPhase } from './ppaColors'

// Mismos 6 valores que SessionState en App.tsx (no se importa el tipo para
// no crear una dependencia circular; deben mantenerse en sincronía).
export type SessionState = 'inactivo' | 'cuenta_regresiva' | 'jugando' | 'pausado' | 'bloqueado' | 'victoria'

// Nivel SESIÓN: igual para los 10 cubos a la vez, prioridad absoluta sobre
// cualquier estado individual del cubo. 'normal' agrupa inactivo/cuenta_
// regresiva/jugando porque en esos tres tramos cada cubo resuelve su propio
// estado (la cuenta regresiva es un pulso transitorio aparte, no sostenido
// — ver dispatch en App.tsx).
export type SessionVisualTier = 'bloqueado' | 'victoria' | 'pausado' | 'normal'

export function sessionVisualTier(sessionState: SessionState): SessionVisualTier {
  if (sessionState === 'bloqueado') return 'bloqueado'
  if (sessionState === 'victoria') return 'victoria'
  if (sessionState === 'pausado') return 'pausado'
  return 'normal'
}

// Estado SOSTENIDO de un cubo (se mantiene hasta que algo de prioridad
// igual o mayor lo reemplace) — no incluye los pulsos transitorios
// (movimiento inválido, cuenta regresiva), que se superponen un instante y
// luego devuelven el control aquí (ver los dos efectos de "pulso" en
// App.tsx, que reafirman este valor al terminar).
export type SustainedCubeVisual =
  | { tier: 'bloqueo' }
  | { tier: 'victoria' }
  | { tier: 'pausado' }
  | { tier: 'ppa_manual'; accion: PPAPhase }
  | { tier: 'equipo_reposo' }

// Tabla de prioridad (máxima a mínima) — validada con el autor 2026-09-18:
//   1. Bloqueo            (sesión, todos los cubos)
//   2. Victoria           (sesión, todos los cubos)
//   3. Cuenta regresiva   (pulso transitorio, todos los cubos — no sostenido)
//   4. Sesión pausada     (sesión, todos los cubos) — cancela cualquier señal
//      PPA manual en curso; al reanudar no se restaura sola (ver App.tsx,
//      reanudarJuego).
//   5. Movimiento inválido (pulso transitorio, 1 cubo — no sostenido) —
//      interrumpe una señal PPA manual 1s y luego la restaura si su propio
//      temporizador de 5s no había expirado.
//   6. Señal PPA manual   (1 cubo, la seleccionada por el operador)
//   7. Color de equipo en reposo (cualquier cubo sin lo anterior)
export function resolveSustainedVisual(sessionTier: SessionVisualTier, accionCubo?: PPAPhase): SustainedCubeVisual {
  if (sessionTier === 'bloqueado') return { tier: 'bloqueo' }
  if (sessionTier === 'victoria') return { tier: 'victoria' }
  if (sessionTier === 'pausado') return { tier: 'pausado' }
  if (accionCubo) return { tier: 'ppa_manual', accion: accionCubo }
  return { tier: 'equipo_reposo' }
}

// Frecuencia de parpadeo (F=) ya usada hoy por sendAction() en App.tsx para
// cada fase PPA — se centraliza aquí para que el estado 'ppa_manual' la use
// igual sin importar quién lo dispare (botón manual o resolutor).
function frecuenciaPpa(accion: PPAPhase): number {
  return accion === 'pensar' ? 1.00 : accion === 'actuar' ? 2.00 : 0.50
}

// Traduce el estado sostenido al comando físico real (sin el campo "id",
// que decide el llamador: un cubo puntual o "all"). Debe coincidir con lo
// que Cubo_Esclavo_v3.ino sabe interpretar (EF=<n> o M=/LR=/LG=/LB=/F=,
// construido en Maestro_v3.ino a partir de "efecto" o "color"/
// "vibrationIntensity"/"iluminationFrequency").
export function sustainedVisualToCommand(v: SustainedCubeVisual, teamRgb: [number, number, number] = [0, 0, 0]): object {
  switch (v.tier) {
    case 'bloqueo':
      return { efecto: EFECTOS.BLOQUEO }
    case 'victoria':
      return { efecto: EFECTOS.VICTORIA }
    case 'pausado':
      return { color: PPA_RGB.pausar, vibrationIntensity: PPA_VIBRATION.pausar, iluminationFrequency: 0.50 }
    case 'ppa_manual':
      return { color: PPA_RGB[v.accion], vibrationIntensity: PPA_VIBRATION[v.accion], iluminationFrequency: frecuenciaPpa(v.accion) }
    case 'equipo_reposo':
      return { color: teamRgb, vibrationIntensity: 0, iluminationFrequency: 0 }
  }
}

// Color que debe verse EN PANTALLA para un cubo, con la misma tabla de
// prioridad de arriba más el pulso transitorio de movimiento inválido
// (que si aplica se ve, pero nunca por encima de bloqueo/victoria/pausado
// — igual que en el cubo físico, donde EF=4/5 siempre reemplaza cualquier
// EF=3 en curso). `accion`, si viene, hace que Cube.tsx muestre el mismo
// indicador (icono/barras de vibración/sonido) que ya usa para las señales
// PPA — reutilizado también para 'pausado' porque físicamente es la misma
// señal (PPA_RGB.pausar/PPA_VIBRATION.pausar) aplicada a los 10 cubos.
export function resolveCubeDisplay(
  sessionTier: SessionVisualTier,
  isFlashingInvalid: boolean,
  accionCubo: PPAPhase | undefined,
  teamHex: string,
): { hex: string; accion?: PPAPhase; pulso?: true } {
  // `pulso` marca los dos estados transitorios de mayor prioridad (antes
  // "flashColor" en Cube.tsx) para que la interfaz les dé el mismo anillo
  // de brillo que ya tenían, distinto del anillo blanco de una señal PPA.
  if (sessionTier === 'bloqueado' || sessionTier === 'victoria') return { hex: BLANCO_HEX, pulso: true }
  if (sessionTier === 'pausado') return { hex: PPA_HEX.pausar, accion: 'pausar' }
  if (isFlashingInvalid) return { hex: INVALIDO_HEX, pulso: true }
  if (accionCubo) return { hex: PPA_HEX[accionCubo], accion: accionCubo }
  return { hex: teamHex }
}
