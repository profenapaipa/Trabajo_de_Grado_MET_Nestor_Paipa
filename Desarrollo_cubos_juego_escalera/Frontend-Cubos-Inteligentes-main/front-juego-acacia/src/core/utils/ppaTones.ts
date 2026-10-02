// Un solo AudioContext para toda la aplicación. Antes cada tono creaba uno
// nuevo y nunca lo cerraba: en una sesión larga (cada movimiento, error y señal
// suena) se acumulaban cientos hasta que el navegador dejaba de responder.
let sharedCtx: AudioContext | null = null
function getCtx(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AudioContext()
  if (sharedCtx.state === 'suspended') void sharedCtx.resume()
  return sharedCtx
}

export function playTone(freq: number, duration: number, gain = 0.35) {
  try {
    const ctx = getCtx(), osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(); osc.stop(ctx.currentTime + duration)
  } catch { /* audio no disponible */ }
}
export function playBipBip(freq: number, reps = 2, gain = 0.35) {
  try {
    const ctx = getCtx()
    for (let i = 0; i < reps; i++) {
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination); osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.30
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01)
      g.gain.setValueAtTime(gain, t + 0.12); g.gain.linearRampToValueAtTime(0, t + 0.15)
      osc.start(t); osc.stop(t + 0.16)
    }
  } catch { /* audio no disponible */ }
}
export function playAscending(s: number, e: number, d: number) {
  try {
    const ctx = getCtx(), osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.setValueAtTime(s, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(e, ctx.currentTime + d)
    g.gain.setValueAtTime(0.35, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d)
    osc.start(); osc.stop(ctx.currentTime + d)
  } catch { /* audio no disponible */ }
}
// 2 pulsos largos y graves — misma idea "de calma" del patrón de
// vibración de Pausar, con más ganancia porque a igual volumen un tono
// grave se percibe más bajo que uno agudo (curvas isofónicas).
export function playLongDoublePulse(freq: number, pulseDur: number, gapDur: number, gain = 0.55) {
  try {
    const ctx = getCtx()
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination); osc.frequency.value = freq
      const t = ctx.currentTime + i * (pulseDur + gapDur)
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.03)
      g.gain.setValueAtTime(gain, t + pulseDur - 0.05); g.gain.linearRampToValueAtTime(0, t + pulseDur)
      osc.start(t); osc.stop(t + pulseDur + 0.02)
    }
  } catch { /* audio no disponible */ }
}

// La señal enviada a un cubo dura AUTO_OFF_MS completos (apagado
// automático) — el sonido/vibración simulados deben sonar durante toda
// esa ventana, no solo al principio, manteniendo el mismo carácter de
// cada fase (Pausar intermitente y grave, Pensar intermitente y más
// rápido, Actuar continuo e intenso, sin cambios).
export function playPpaFeedback(fase: 'pausar' | 'pensar' | 'actuar', totalDurationSec: number) {
  try {
    const ctx = getCtx()
    if (fase === 'pausar') {
      const pulseDur = 0.55, gapDur = 0.35, restAfterPair = 1.2
      const cycle = pulseDur * 2 + gapDur + restAfterPair
      for (let t = 0; t < totalDurationSec; t += cycle) {
        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator(), g = ctx.createGain()
          osc.connect(g); g.connect(ctx.destination); osc.frequency.value = 250
          const start = ctx.currentTime + t + i * (pulseDur + gapDur)
          g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(0.55, start + 0.03)
          g.gain.setValueAtTime(0.55, start + pulseDur - 0.05); g.gain.linearRampToValueAtTime(0, start + pulseDur)
          osc.start(start); osc.stop(start + pulseDur + 0.02)
        }
      }
    }
    if (fase === 'pensar') {
      const beepDur = 0.15, beepGap = 0.15, restAfterBurst = 0.65
      const burst = beepDur * 3 + beepGap * 2
      const cycle = burst + restAfterBurst
      for (let t = 0; t < totalDurationSec; t += cycle) {
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator(), g = ctx.createGain()
          osc.connect(g); g.connect(ctx.destination); osc.frequency.value = 600
          const start = ctx.currentTime + t + i * (beepDur + beepGap)
          g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(0.35, start + 0.01)
          g.gain.setValueAtTime(0.35, start + beepDur - 0.03); g.gain.linearRampToValueAtTime(0, start + beepDur)
          osc.start(start); osc.stop(start + beepDur + 0.02)
        }
      }
    }
    if (fase === 'actuar') {
      // Continua e intensa, sin huecos: barrido ascendente/descendente
      // encadenado durante toda la ventana.
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      const segDur = 0.5
      let t = ctx.currentTime, up = true
      osc.frequency.setValueAtTime(600, t)
      let elapsed = 0
      while (elapsed < totalDurationSec) {
        osc.frequency.linearRampToValueAtTime(up ? 1000 : 600, t + segDur)
        t += segDur; elapsed += segDur; up = !up
      }
      g.gain.setValueAtTime(0.35, ctx.currentTime)
      g.gain.setValueAtTime(0.35, t)
      g.gain.linearRampToValueAtTime(0, t + 0.08)
      osc.start(); osc.stop(t + 0.1)
    }
  } catch { /* audio no disponible */ }
}

// Beep de la cuenta regresiva sincronizada (3, 2, 1, ¡Inicia!): tono
// corto de tono ascendente por tick, más largo/agudo en el último para
// que se distinga claramente del resto.
export function playCountdownBeep(tick: 3 | 2 | 1 | 0) {
  const freqs: Record<3 | 2 | 1 | 0, number> = { 3: 440, 2: 550, 1: 660, 0: 880 }
  const duration = tick === 0 ? 0.35 : 0.18
  playTone(freqs[tick], duration, tick === 0 ? 0.5 : 0.35)
}

// Zumbido corto y grave para movimientos ilegales — distinto de los 3
// tonos de PPA para no confundirse con una fase real.
export function playError() {
  try {
    const ctx = getCtx()
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.type = 'square'
      osc.connect(g); g.connect(ctx.destination)
      osc.frequency.value = 140
      const t = ctx.currentTime + i * 0.14
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.01)
      g.gain.setValueAtTime(0.25, t + 0.08); g.gain.linearRampToValueAtTime(0, t + 0.11)
      osc.start(t); osc.stop(t + 0.12)
    }
  } catch { /* audio no disponible */ }
}
