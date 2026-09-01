// Colores y niveles de vibración de las 3 fases PPA, en un solo lugar para
// que Control, Control simulado, el tablero (Cube.tsx) y la simulación
// jugable usen siempre el mismo valor. Pausar se cambió de azul oscuro
// (#0000ff, igual al color de reposo del equipo A — indistinguible) a un
// celeste bien diferenciado, y su vibración se subió del 20% al 45%: el
// autor reportó que el motor de moneda no llega a girar al 20% (ver
// PENDIENTES_TESIS.md, "Frecuencia de vibración de Pausar imperceptible").
// El valor exacto sigue sin calibrar contra hardware real.

export type PPAPhase = 'pausar' | 'pensar' | 'actuar'

// Duración antes de que una señal enviada se apague sola (o vuelva al
// color de reposo del equipo). Subido de 3s a 5s a pedido del autor.
export const AUTO_OFF_MS = 5000

// Fallas consecutivas necesarias para que se acumule la sugerencia de
// Pausar (ver DECISIONES_PROYECTO.md, "Criterios de activación PPA").
export const FALLAS_PARA_PAUSAR = 2

export const PPA_RGB: Record<PPAPhase, [number, number, number]> = {
  pausar: [0, 191, 255],
  pensar: [255, 255, 102],
  actuar: [0, 255, 0],
}

export const PPA_HEX: Record<PPAPhase, string> = {
  pausar: '#00bfff',
  pensar: '#e6e600',
  actuar: '#00cc44',
}

export const PPA_TEXT: Record<PPAPhase, string> = {
  pausar: '#5fd4ff',
  pensar: '#ffff66',
  actuar: '#00ff88',
}

export const PPA_VIBRATION: Record<PPAPhase, number> = {
  pausar: 0.45,
  pensar: 0.50,
  actuar: 0.80,
}

export const PPA_LABEL: Record<PPAPhase, string> = {
  pausar: 'PAUSAR',
  pensar: 'PENSAR',
  actuar: 'ACTUAR',
}

export const PPA_FRASE: Record<PPAPhase, string> = {
  pausar: '"Detente. No respondas todavía."',
  pensar: '"Analiza y busca alternativas."',
  actuar: '"La decisión está tomada."',
}

// Patrón de vibración por fase (decisión registrada en PENDIENTES_TESIS.md,
// "Patrón de vibración de los 3 estados PPA... debe diferenciarse por
// fase"): Pausar = 2 pulsos largos e intermitentes ("llevan a la calma"),
// Pensar = 3 repeticiones más rápidas, Actuar = intensa y continua, sin
// cambios.
export const PPA_VIB_PATTERN: Record<PPAPhase, { patron: string; repeticiones: number; intervaloMs: number }> = {
  pausar: { patron: 'doble_pulso_largo', repeticiones: 2, intervaloMs: 500 },
  pensar: { patron: 'triple_pulso', repeticiones: 3, intervaloMs: 150 },
  actuar: { patron: 'pulso_unico', repeticiones: 1, intervaloMs: 0 },
}

export const PPA_SOUND_LABEL: Record<PPAPhase, string> = {
  pausar: '250 Hz',
  pensar: 'bip-bip 600 Hz',
  actuar: '600→1000 Hz',
}

// rgba(...) derivado del color real de cada fase — para que el mismo tono
// de "pausar" (celeste) se use en Control, Control simulado y la
// simulación jugable, cada uno con su propia opacidad de fondo/borde/brillo.
export function ppaRgba(a: PPAPhase, alpha: number): string {
  const [r, g, b] = PPA_RGB[a]
  return `rgba(${r},${g},${b},${alpha})`
}
