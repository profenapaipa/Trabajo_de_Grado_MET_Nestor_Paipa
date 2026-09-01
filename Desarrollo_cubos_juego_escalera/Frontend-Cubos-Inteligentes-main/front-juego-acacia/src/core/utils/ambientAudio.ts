// Música de fondo sintetizada con Web Audio API (mismo enfoque que ya usan
// los tonos de PPA en App.tsx) en vez de archivos de audio: el proyecto solo
// tiene un mp3 real (loop.mp3), así que ofrecer "varias pistas" mapeadas al
// mismo archivo habría sido engañoso. Estos 3 ambientes son genuinamente
// distintos entre sí (forma de onda, acordes e intensidad de modulación).

export type AmbienteId = 'calma' | 'enfoque' | 'energia'

export const AMBIENTES: { id: AmbienteId; label: string; descripcion: string }[] = [
  { id: 'calma', label: 'Calma', descripcion: 'Pad lento y grave, para bajar la activación entre ejercicios.' },
  { id: 'enfoque', label: 'Enfoque', descripcion: 'Tono medio, estable, para sostener la atención durante el juego.' },
  { id: 'energia', label: 'Energía', descripcion: 'Más brillante y con más movimiento, para transiciones o cierre.' },
]

type Preset = { freqs: number[]; wave: OscillatorType; lfoRate: number; gain: number }

const PRESETS: Record<AmbienteId, Preset> = {
  calma:   { freqs: [110, 164.8, 220], wave: 'sine', lfoRate: 0.08, gain: 0.05 },
  enfoque: { freqs: [130.8, 196, 261.6], wave: 'triangle', lfoRate: 0.16, gain: 0.045 },
  energia: { freqs: [196, 246.9, 329.6], wave: 'sawtooth', lfoRate: 0.35, gain: 0.03 },
}

export type AmbienteHandle = { stop: () => void }

export function playAmbiente(id: AmbienteId): AmbienteHandle {
  const ctx = new AudioContext()
  const preset = PRESETS[id]
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  master.gain.linearRampToValueAtTime(preset.gain, ctx.currentTime + 1.2)

  const nodes: OscillatorNode[] = []
  preset.freqs.forEach((f, i) => {
    const osc = ctx.createOscillator()
    osc.type = preset.wave
    osc.frequency.value = f

    const lfo = ctx.createOscillator()
    lfo.frequency.value = preset.lfoRate + i * 0.015
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = (preset.gain / preset.freqs.length) * 0.5
    lfo.connect(lfoGain)

    const voiceGain = ctx.createGain()
    voiceGain.gain.value = preset.gain / preset.freqs.length
    lfoGain.connect(voiceGain.gain)

    osc.connect(voiceGain)
    voiceGain.connect(master)
    osc.start()
    lfo.start()
    nodes.push(osc, lfo)
  })

  return {
    stop: () => {
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + 0.6)
      setTimeout(() => {
        nodes.forEach(n => { try { n.stop() } catch { /* ya detenido */ } })
        ctx.close().catch(() => { /* contexto ya cerrado */ })
      }, 700)
    },
  }
}
