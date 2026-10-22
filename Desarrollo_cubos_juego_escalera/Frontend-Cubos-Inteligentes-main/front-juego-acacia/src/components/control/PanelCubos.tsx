// Estado del enlace de los 10 cubos para el operador, en palabras clave:
//   Estado   → Conectado / Lento / Sin respuesta / Sin conexión
//   Latencia → ms que tarda un mensaje en ir al cubo y volver (ping)
//   Datos/s  → mensajes por segundo que llegan del cubo
//   Señal    → calidad del WiFi del cubo
// más la latencia medida de la cadena base → pantalla. Con «¿Qué significa?»
// se despliega la explicación de cada término. La columna de batería solo
// aparece si algún cubo la mide (hoy está desactivada en el firmware).
// Solo Control: nada de esto aparece en la vista del jugador.

import { useState } from 'react'
import IndicadorBateria from './IndicadorBateria'
import {
  type TelemetriaCubo, porcentajeBateria, textoSinMedicion, motivoReinicio, reinicioAnomalo, calidadSenal,
  resumenLatencia, estadoEnlace, type EstadoEnlace, PING_LENTO_MS,
} from '../../core/control/telemetria'

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }

const ETIQUETA: Record<EstadoEnlace, { texto: string; color: string }> = {
  ok: { texto: 'Conectado', color: 'var(--color-online)' },
  lento: { texto: 'Lento', color: '#f1c21b' },
  sin_respuesta: { texto: 'Sin respuesta', color: '#f1c21b' },
  sin_conexion: { texto: 'Sin conexión', color: 'var(--color-offline)' },
}

function duracion(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}min`
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}

const AYUDA: [string, string][] = [
  ['Conectado', 'El cubo contesta al maestro. «Lento»: contesta, pero tarda más de 100 ms. «Sin respuesta»: sigue conectado pero no manda nada hace más de 5 s (revisar batería). «Sin conexión»: el maestro no lo ve.'],
  ['Latencia', 'Milisegundos que tarda un mensaje en ir del maestro al cubo y volver (ping, cada 2 s). Normal: menos de 30 ms. Más de 100 ms: los colores y señales llegarán con retraso.'],
  ['Datos/s', 'Mensajes por segundo que llegan del cubo. Normal: cerca de 0,7. Si baja a 0, el cubo dejó de comunicarse aunque figure conectado.'],
  ['Señal', 'Calidad del WiFi del cubo (entre paréntesis, dBm: más cerca de 0 es mejor). «Débil»: por debajo de −72 dBm.'],
  ['Cubo → pantalla', 'Lo que tarda en verse en la pantalla un cubo que se levanta o se apoya: incluye la lectura de la base (25 ms), el maestro, el backend y el navegador. «Mediana»: lo típico; «p95»: lo peor del 95 % de los movimientos.'],
]

export default function PanelCubos({ esclavos, telemetria, latencias, ritmo }: {
  esclavos: number[]
  telemetria: Record<number, TelemetriaCubo>
  latencias: number[]
  ritmo: Record<number, number>
}) {
  const [ayuda, setAyuda] = useState(false)
  const lat = resumenLatencia(latencias)
  const colorLat = (ms: number, lento = 120) => (ms <= lento ? 'var(--color-online)' : ms <= lento * 2 ? '#f1c21b' : 'var(--color-offline)')
  const conBateria = Object.values(telemetria).some(t => t.mv !== undefined && t.mv !== -1)
  const columnas = `24px minmax(0,1.4fr) 42px 34px ${conBateria ? '46px ' : ''}minmax(0,1fr)`
  const cab: React.CSSProperties = { fontSize: '9px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-paper-faint)' }
  const nConectados = esclavos.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--color-paper-dim)' }}>
        <span><b style={{ color: nConectados === 10 ? 'var(--color-online)' : '#f1c21b' }}>{nConectados} de 10</b> cubos conectados</span>
        <button onClick={() => setAyuda(a => !a)}
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: '11px', color: 'var(--color-blue)', textDecoration: 'underline' }}>
          {ayuda ? 'Ocultar' : '¿Qué significa?'}
        </button>
      </div>

      {ayuda && (
        <div style={{ fontSize: '11px', lineHeight: 1.45, color: 'var(--color-paper-dim)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {AYUDA.map(([t, d]) => (<div key={t}><b style={{ color: 'var(--color-paper)' }}>{t}.</b> {d}</div>))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: columnas, columnGap: '6px', rowGap: '5px', alignItems: 'center', fontSize: '11px' }}>
        <span style={cab}>Cubo</span><span style={cab}>Estado</span><span style={{ ...cab, textAlign: 'right' }} title="Ida y vuelta maestro↔cubo, en ms">Lat.</span>
        <span style={{ ...cab, textAlign: 'right' }} title="Mensajes por segundo que llegan del cubo">Dat/s</span>
        {conBateria && <span style={cab}>Bat.</span>}
        <span style={cab}>Señal</span>
        {Array.from({ length: 10 }, (_, k) => k + 1).map(id => {
          const con = esclavos.includes(id)
          const t = telemetria[id]
          const enlace = estadoEnlace(con, t)
          const et = ETIQUETA[enlace]
          const pct = t?.mv === undefined ? null : porcentajeBateria(t.mv)
          const tituloBat = !t || t.mv === undefined ? 'Sin datos del cubo'
            : pct === null ? `Batería: ${textoSinMedicion(t.mv)}${t.mv > 0 ? ` (${t.mv} mV)` : ''}`
              : `Batería ${pct}% · ${(t.mv / 1000).toFixed(2)} V`
          const senal = t?.rssi === undefined ? null : calidadSenal(t.rssi)
          const anomalo = t?.rst !== undefined && reinicioAnomalo(t.rst)
          const r = ritmo[id]
          const titulo = [
            t?.mac ? `Dispositivo ${t.mac}` : '',
            t?.up !== undefined ? `Encendido hace ${duracion(t.up)}` : '',
            t?.rst !== undefined ? `Último arranque: ${motivoReinicio(t.rst)}` : '',
          ].filter(Boolean).join(' · ')
          return (
            <div key={id} style={{ display: 'contents' }} title={titulo || undefined}>
              <span style={{ ...mono, fontWeight: 700, color: id <= 5 ? '#6f8cff' : '#ff6b6b' }}>#{id}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: et.color }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: et.color }} />
                {et.texto}
              </span>
              <span style={{ ...mono, textAlign: 'right', color: con && t?.ping !== undefined && t.ping >= 0 ? colorLat(t.ping, PING_LENTO_MS) : 'var(--color-paper-faint)' }}>
                {con && t?.ping !== undefined && t.ping >= 0 ? `${t.ping}` : '—'}
              </span>
              <span style={{ ...mono, textAlign: 'right', color: con && r !== undefined ? (r < 0.3 ? 'var(--color-offline)' : 'var(--color-paper-dim)') : 'var(--color-paper-faint)' }}>
                {con && r !== undefined ? r.toFixed(1).replace('.', ',') : '—'}
              </span>
              {conBateria && <span>{con && <IndicadorBateria pct={pct} titulo={tituloBat} />}</span>}
              <span title={t?.rssi !== undefined ? `${t.rssi} dBm` : undefined}
                style={{ fontSize: '10px', color: anomalo ? 'var(--color-offline)' : senal === 'mala' ? '#f1c21b' : 'var(--color-paper-faint)' }}>
                {!con || !t ? '' : anomalo ? `reinició: ${motivoReinicio(t.rst ?? 0)}` : senal === 'buena' ? 'Buena' : senal === 'regular' ? 'Regular' : senal === 'mala' ? 'Débil' : ''}
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--color-line)', paddingTop: '8px', fontSize: '11px' }}>
        <div style={{ color: 'var(--color-paper-dim)', marginBottom: '4px' }}>Cubo → pantalla (cuánto tarda en verse un movimiento)</div>
        {lat ? (
          <div style={{ display: 'flex', gap: '12px', ...mono }}>
            <span>última <b style={{ color: colorLat(lat.ultima) }}>{lat.ultima} ms</b></span>
            <span>mediana <b style={{ color: colorLat(lat.mediana) }}>{lat.mediana}</b></span>
            <span>p95 <b style={{ color: colorLat(lat.p95) }}>{lat.p95}</b></span>
          </div>
        ) : (
          <div style={{ color: 'var(--color-paper-faint)' }}>Se mide con cada movimiento de un cubo (requiere Maestro_v3 actualizado).</div>
        )}
        {lat && <div style={{ color: 'var(--color-paper-faint)', fontSize: '10px', marginTop: '2px' }}>{lat.n} movimientos medidos · incluye 25 ms de lectura de la base</div>}
      </div>
      {/* Los cubos se cargan en la base: apoyados, la tensión sube por la
          carga y el porcentaje se ve más alto de lo que de verdad tienen. */}
      {conBateria && (
        <div style={{ fontSize: '10px', color: 'var(--color-paper-faint)', lineHeight: 1.4 }}>
          La batería es orientativa: con el cubo apoyado en la base (cargando) se lee más alta. El dato fiel es el de un cubo que lleva un rato fuera de la base.
        </div>
      )}
    </div>
  )
}
