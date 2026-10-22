// Guía de encendido y conexiones, en diapositivas, al alcance del operador
// dentro de Control Mago de Oz. Es la versión concisa de
// MANUAL_ENCENDIDO_Y_CONEXIONES.md (que tiene el detalle): el orden en que se
// energizan el router, el PC, el backend, el maestro y los cubos, qué se debe
// ver en cada paso y qué hacer si no. Flechas del teclado para avanzar, Esc
// para cerrar.

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type Diapositiva = {
  titulo: string
  paso?: string
  puntos: string[]
  ver?: string   // qué debe verse si todo va bien
  si?: string    // qué hacer si no
  esquema?: boolean
}

const DIAPOSITIVAS: Diapositiva[] = [
  {
    titulo: 'Cómo se conecta todo', esquema: true,
    puntos: [
      'El PC y el maestro se conectan al router (red DIE-ACACIA, sin internet).',
      'Los cubos NO usan el router: se conectan a la red propia del maestro.',
      'El maestro crea esa red en el mismo canal que el router: por eso el router va primero.',
    ],
  },
  {
    titulo: 'Antes de empezar', paso: '0',
    puntos: [
      'Cubos cargados: apoyados en la base al menos 30 min.',
      'Maestro y los 10 cubos con el firmware de la misma fecha; cada cubo con su NUMERO_CUBO (1–10, el de su etiqueta).',
      'Un solo Control abierto (dos ventanas duplican la bitácora). La Vista del jugador sí puede ir aparte.',
    ],
  },
  {
    titulo: 'Router', paso: '1',
    puntos: ['Enchufarlo y esperar a que termine de arrancar (1–2 min).', 'Dejarlo en un canal fijo, no en «automático».'],
    ver: 'Luces de WiFi estables.',
    si: 'No sigas: sin router el maestro arranca sin red y los cubos quedan saltando de canal.',
  },
  {
    titulo: 'Computador y backend', paso: '2–3',
    puntos: [
      'Conectar el PC a DIE-ACACIA (red Privada; «sin internet» es normal).',
      'En Backend-Cubos-Inteligentes-main: npm run dev.',
      'Abrir Control en el navegador. «Desconectado» es normal por ahora.',
    ],
    ver: 'Backend: «Servidor corriendo en el puerto 3000» y «Escuchando descubrimiento en puerto 4210».',
    si: 'Puerto ocupado: cerrar el backend anterior. Firewall: abrir 3000 y UDP 4210.',
  },
  {
    titulo: 'Maestro', paso: '4',
    puntos: [
      'Banco de energía por USB y los tres interruptores (I, D, M) hacia la derecha.',
      'Esperar unos 15 s a que levante su red. No encender los cubos antes.',
    ],
    ver: 'LED rojo del maestro. En el backend: «ESP32 … descubrió este backend» y «Base física conectada».',
    si: 'Sin descubrimiento: PC en otra red o firewall en el 4210. Arreglarlo y reiniciar el maestro después.',
  },
  {
    titulo: 'Cubos, uno por uno', paso: '5',
    puntos: [
      'Interruptor lateral, con una punta, por el orificio de la pared izquierda.',
      'Esperar a que cada cubo termine antes de encender el siguiente.',
    ],
    ver: 'Parpadea en blanco su número (comprueba la etiqueta) y queda azul (1–5) o rojo (6–10).',
    si: 'Magenta fijo: no halla la red del maestro (espera: reintenta solo). Luz muy tenue: batería, cargarlo.',
  },
  {
    titulo: 'Comprobar antes de jugar', paso: '6',
    puntos: [
      'Control: «Conectado» y 10 de 10 cubos; panel de enlace con latencia baja.',
      '«Probar base»: levantar y apoyar cada casilla hasta 11/11.',
      '«Reidentificar cubos (IP)»: el tablero de pantalla debe igualar al físico.',
    ],
    ver: 'Todos los cubos «Conectado», latencia menor de 30 ms, 11 casillas con ✓.',
    si: 'Una casilla no detecta que el cubo sale: intercambia dos cubos de casilla; si la falla se queda en la casilla, es la base.',
  },
  {
    titulo: 'Durante la sesión', paso: '7',
    puntos: [
      'No apagar ni reiniciar el maestro con un intento en curso.',
      'Si se reinicia el maestro: los cubos vuelven solos en unos 10 s; luego «Reidentificar cubos (IP)».',
      'Si cambió la IP del PC: reiniciar el maestro. Si se reinicia el backend con la misma IP: Control se reconecta solo.',
      'Un cubo en magenta perdió la red: revisar batería y distancia.',
    ],
  },
  {
    titulo: 'Apagado', paso: '8',
    puntos: [
      '1. Terminar o reiniciar el intento y descargar bitácoras.',
      '2. Cerrar Control y la Vista del jugador.',
      '3. Apagar los cubos y apoyarlos en la base para cargar.',
      '4. Apagar el maestro (I, D, M).',
      '5. Detener el backend (Ctrl + C). El router, al final.',
    ],
    si: 'Apagar el maestro con los cubos encendidos los deja en magenta buscando red y gasta su batería.',
  },
  {
    titulo: 'Problemas frecuentes',
    puntos: [
      'Control «Desconectado» con el maestro encendido → backend y red primero; reiniciar el maestro.',
      'Cubos magenta con el maestro encendido → el maestro arrancó antes que el router, o firmware de fechas distintas.',
      'Pantalla desordenada y los cubos están en orden → «Reidentificar cubos (IP)».',
      'Dos cubos con el mismo número → se disputan la IP; el panel anota «cubo_distinto».',
      'Cubo que se reinicia solo → sin batería o contacto flojo.',
    ],
  },
]

function Esquema() {
  const caja = { fill: 'none', stroke: 'var(--color-line-strong)', strokeWidth: 1.2, rx: 6 }
  const t = { fill: 'var(--color-paper)', fontSize: 11, textAnchor: 'middle' as const, fontFamily: 'var(--font-sans)' }
  const l = { stroke: 'var(--color-blue)', strokeWidth: 1.4 }
  return (
    <svg viewBox="0 0 420 150" style={{ width: '100%', maxWidth: '460px', display: 'block', margin: '4px auto 12px' }} role="img"
      aria-label="El PC y el maestro se conectan al router; los cubos, a la red del maestro">
      <rect x="150" y="6" width="120" height="30" {...caja} /><text x="210" y="25" {...t}>Router</text>
      <rect x="10" y="60" width="130" height="38" {...caja} />
      <text x="75" y="76" {...t}>PC</text><text x="75" y="90" {...t} style={{ fontSize: 9 }}>navegador + backend</text>
      <rect x="280" y="60" width="130" height="38" {...caja} />
      <text x="345" y="76" {...t}>Maestro</text><text x="345" y="90" {...t} style={{ fontSize: 9 }}>ESP32 + base</text>
      <rect x="250" y="116" width="170" height="28" {...caja} /><text x="335" y="134" {...t}>Cubos 1 a 10</text>
      <line x1="75" y1="60" x2="170" y2="36" {...l} /><line x1="345" y1="60" x2="250" y2="36" {...l} />
      <line x1="345" y1="98" x2="345" y2="116" {...l} strokeDasharray="4 3" />
      <text x="200" y="106" {...t} style={{ fontSize: 9, fill: 'var(--color-paper-faint)' }}>WiFi DIE-ACACIA</text>
      <text x="395" y="110" {...t} style={{ fontSize: 9, fill: 'var(--color-paper-faint)' }}>red propia</text>
    </svg>
  )
}

export default function GuiaEncendido({ onCerrar }: { onCerrar: () => void }) {
  const [i, setI] = useState(0)
  const d = DIAPOSITIVAS[i]
  const ultima = i === DIAPOSITIVAS.length - 1

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      else if (e.key === 'ArrowRight') setI(k => Math.min(DIAPOSITIVAS.length - 1, k + 1))
      else if (e.key === 'ArrowLeft') setI(k => Math.max(0, k - 1))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const nav: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', borderRadius: '999px',
    border: '1px solid var(--color-line-strong)', background: 'var(--color-bg)', color: 'var(--color-paper)',
    fontSize: '13px', cursor: 'pointer',
  }

  return (
    <div onClick={onCerrar} role="dialog" aria-modal="true" aria-label="Guía de encendido y conexiones" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 'min(640px, 100%)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--color-panel)',
        border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-paper-faint)' }}>
            Guía de encendido · {i + 1} de {DIAPOSITIVAS.length}
          </span>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', color: 'var(--color-paper-dim)', cursor: 'pointer', padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {d.paso && (
            <span style={{
              minWidth: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-blue)', color: '#fff', fontWeight: 700, fontSize: '14px', padding: '0 6px', boxSizing: 'border-box',
            }}>{d.paso}</span>
          )}
          <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--color-paper)' }}>{d.titulo}</h2>
        </div>

        {d.esquema && <Esquema />}

        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '15px', lineHeight: 1.5, color: 'var(--color-paper)' }}>
          {d.puntos.map(p => <li key={p}>{p}</li>)}
        </ul>

        {d.ver && (
          <div style={{ borderLeft: '3px solid var(--color-online)', padding: '6px 12px', fontSize: '13.5px', lineHeight: 1.5, color: 'var(--color-paper-dim)' }}>
            <b style={{ color: 'var(--color-online)' }}>Debes ver:</b> {d.ver}
          </div>
        )}
        {d.si && (
          <div style={{ borderLeft: '3px solid #f1c21b', padding: '6px 12px', fontSize: '13.5px', lineHeight: 1.5, color: 'var(--color-paper-dim)' }}>
            <b style={{ color: '#f1c21b' }}>Si no:</b> {d.si}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <button onClick={() => setI(k => Math.max(0, k - 1))} disabled={i === 0} style={{ ...nav, opacity: i === 0 ? 0.4 : 1, cursor: i === 0 ? 'not-allowed' : 'pointer' }}>
            <ChevronLeft size={15} /> Anterior
          </button>
          <div style={{ display: 'flex', gap: '6px' }}>
            {DIAPOSITIVAS.map((_, k) => (
              <button key={k} onClick={() => setI(k)} aria-label={`Diapositiva ${k + 1}`} style={{
                width: '9px', height: '9px', borderRadius: '50%', padding: 0, cursor: 'pointer',
                border: 'none', background: k === i ? 'var(--color-blue)' : 'var(--color-line-strong)',
              }} />
            ))}
          </div>
          {ultima
            ? <button onClick={onCerrar} style={{ ...nav, background: 'var(--color-blue)', borderColor: 'var(--color-blue)', color: '#fff' }}>Cerrar</button>
            : <button onClick={() => setI(k => Math.min(DIAPOSITIVAS.length - 1, k + 1))} style={nav}>Siguiente <ChevronRight size={15} /></button>}
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--color-paper-faint)' }}>
          Flechas ← → para avanzar · Esc para cerrar · Detalle completo en MANUAL_ENCENDIDO_Y_CONEXIONES.md
        </div>
      </div>
    </div>
  )
}
