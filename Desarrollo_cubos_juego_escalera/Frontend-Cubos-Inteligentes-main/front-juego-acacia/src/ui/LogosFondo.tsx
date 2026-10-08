import { useEffect, useRef } from 'react'
import { Logo } from './brand'

// Fondo vivo de la pantalla de inicio: los mismos logos que la marca de agua
// de las cinco secciones (misma cantidad y misma transparencia), pero en vez
// de recolocarse al recargar la página, se mueven y cambian de tamaño
// continuamente sin llegar a tocarse.
//
// Cada logo es un círculo con posición, velocidad y un tamaño que tiende
// despacio hacia otro tamaño; en cada cuadro se resuelven los choques entre
// ellos y contra los bordes, así que nunca se superponen. La animación se
// escribe directamente sobre el nodo del DOM: React no vuelve a dibujar nada
// sesenta veces por segundo.

const GAP = 20 // separación mínima entre dos logos, en píxeles
const MIN = 26
const MAX = 86
// Lento pero perceptible: a 18 px/s un logo cruza una pantalla ancha en poco
// más de un minuto.
const VEL_MIN = 10
const VEL_MAX = 22

// Media diagonal del logo: su radio una vez girado.
export function radioLogo(size: number): number {
  const h = size * (20 / 32)
  return Math.sqrt(size * size + h * h) / 2
}

type Pieza = {
  x: number; y: number
  vx: number; vy: number
  size: number; objetivo: number
  giro: number; vgiro: number
  cambio: number // segundos que faltan para elegir otro tamaño
}

const azar = (a: number, b: number) => a + Math.random() * (b - a)

function nuevaVelocidad(): { vx: number; vy: number } {
  const ang = Math.random() * Math.PI * 2
  const v = azar(VEL_MIN, VEL_MAX)
  return { vx: Math.cos(ang) * v, vy: Math.sin(ang) * v }
}

// Colocación inicial por muestreo con rechazo: igual que la marca de agua
// estática, para que nadie empiece encima de otro.
function sembrar(cantidad: number, ancho: number, alto: number): Pieza[] {
  const out: Pieza[] = []
  for (let i = 0; i < cantidad; i++) {
    const size = azar(MIN, MAX)
    const r = radioLogo(size)
    for (let intento = 0; intento < 400; intento++) {
      const x = azar(r, Math.max(r, ancho - r))
      const y = azar(r, Math.max(r, alto - r))
      if (out.some(p => Math.hypot(p.x - x, p.y - y) < radioLogo(p.size) + r + GAP)) continue
      out.push({
        x, y, ...nuevaVelocidad(), size, objetivo: azar(MIN, MAX),
        giro: Math.random() * 360, vgiro: azar(-4, 4), cambio: azar(4, 14),
      })
      break
    }
  }
  return out
}

export default function LogosFondo({ cantidad = 38, opacidad = 0.16 }: { cantidad?: number; opacidad?: number }) {
  const cajaRef = useRef<HTMLDivElement>(null)
  const nodosRef = useRef<(HTMLDivElement | null)[]>([])
  const piezasRef = useRef<Pieza[]>([])

  useEffect(() => {
    const caja = cajaRef.current
    if (!caja) return
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let ancho = caja.clientWidth, alto = caja.clientHeight
    piezasRef.current = sembrar(cantidad, ancho, alto)

    const pintar = () => {
      piezasRef.current.forEach((p, i) => {
        const n = nodosRef.current[i]
        if (!n) return
        n.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) rotate(${p.giro}deg) scale(${p.size / MAX})`
      })
    }
    pintar()
    if (quieto) return

    let anterior = performance.now()
    let raf = 0
    const paso = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - anterior) / 1000) // sin saltos al volver de otra pestaña
      anterior = ahora
      const ps = piezasRef.current

      for (const p of ps) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.giro += p.vgiro * dt
        // El tamaño tiende despacio al objetivo, y cada tanto se elige otro.
        p.size += (p.objetivo - p.size) * Math.min(1, dt * 0.35)
        p.cambio -= dt
        if (p.cambio <= 0) { p.objetivo = azar(MIN, MAX); p.cambio = azar(5, 15) }
        // Rebote contra los bordes.
        const r = radioLogo(p.size)
        if (p.x < r) { p.x = r; p.vx = Math.abs(p.vx) }
        if (p.x > ancho - r) { p.x = ancho - r; p.vx = -Math.abs(p.vx) }
        if (p.y < r) { p.y = r; p.vy = Math.abs(p.vy) }
        if (p.y > alto - r) { p.y = alto - r; p.vy = -Math.abs(p.vy) }
      }

      // Choques entre logos: se separan y se intercambian la componente de
      // velocidad en el eje que los une, de modo que nunca se superponen. Se
      // repasa dos veces porque separar una pareja puede meter a uno de los
      // dos en un tercero (y una vez más contra los bordes al final).
      for (let pasada = 0; pasada < 2; pasada++) {
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            const a = ps[i], b = ps[j]
            const dx = b.x - a.x, dy = b.y - a.y
            const d = Math.hypot(dx, dy) || 0.001
            const min = radioLogo(a.size) + radioLogo(b.size) + GAP
            if (d >= min) continue
            const nx = dx / d, ny = dy / d
            const empuje = (min - d) / 2
            a.x -= nx * empuje; a.y -= ny * empuje
            b.x += nx * empuje; b.y += ny * empuje
            if (pasada === 0) {
              const va = a.vx * nx + a.vy * ny
              const vb = b.vx * nx + b.vy * ny
              const delta = vb - va
              a.vx += nx * delta; a.vy += ny * delta
              b.vx -= nx * delta; b.vy -= ny * delta
            }
            // Apretados, dejan de crecer: el tamaño no puede forzar una
            // superposición.
            a.objetivo = Math.min(a.objetivo, a.size)
            b.objetivo = Math.min(b.objetivo, b.size)
          }
        }
      }
      for (const p of ps) {
        const r = radioLogo(p.size)
        p.x = Math.min(Math.max(p.x, r), Math.max(r, ancho - r))
        p.y = Math.min(Math.max(p.y, r), Math.max(r, alto - r))
      }

      pintar()
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)

    const ro = new ResizeObserver(() => {
      if (!cajaRef.current) return
      ancho = cajaRef.current.clientWidth
      alto = cajaRef.current.clientHeight
    })
    ro.observe(caja)

    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [cantidad])

  return (
    <div ref={cajaRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} ref={n => { nodosRef.current[i] = n }} style={{ position: 'absolute', left: 0, top: 0, opacity: opacidad, willChange: 'transform' }}>
          <Logo size={MAX} />
        </div>
      ))}
    </div>
  )
}
