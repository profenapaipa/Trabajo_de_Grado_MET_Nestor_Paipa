// Estado de los 10 cubos para el operador: conexión, señal WiFi y último
// reinicio, más la latencia medida de la cadena base → pantalla. La columna
// de batería solo aparece si algún cubo la mide (hoy está desactivada en el
// firmware: mv = -1). Solo Control: nada de esto aparece en la vista del jugador.

import IndicadorBateria from './IndicadorBateria'
import {
  type TelemetriaCubo, porcentajeBateria, textoSinMedicion, motivoReinicio, reinicioAnomalo, calidadSenal, resumenLatencia,
} from '../../core/control/telemetria'

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }

function duracion(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}min`
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
}

export default function PanelCubos({ esclavos, telemetria, latencias }: {
  esclavos: number[]
  telemetria: Record<number, TelemetriaCubo>
  latencias: number[]
}) {
  const lat = resumenLatencia(latencias)
  const colorLat = (ms: number) => (ms <= 120 ? 'var(--color-online)' : ms <= 250 ? '#f1c21b' : 'var(--color-offline)')
  const conBateria = Object.values(telemetria).some(t => t.mv !== -1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: conBateria ? '24px 1fr 46px 1fr' : '24px 1fr 1fr', columnGap: '6px', rowGap: '4px', alignItems: 'center', fontSize: '11px' }}>
        {Array.from({ length: 10 }, (_, k) => k + 1).map(id => {
          const con = esclavos.includes(id)
          const t = telemetria[id]
          const pct = t ? porcentajeBateria(t.mv) : null
          const tituloBat = !t ? 'Sin datos del cubo (firmware anterior o sin conexión)'
            : pct === null ? `Batería: ${textoSinMedicion(t.mv)}${t.mv > 0 ? ` (${t.mv} mV)` : ''}`
              : `Batería ${pct}% · ${(t.mv / 1000).toFixed(2)} V`
          const senal = t ? calidadSenal(t.rssi) : null
          return (
            <div key={id} style={{ display: 'contents' }}>
              <span style={{ ...mono, fontWeight: 700, color: id <= 5 ? '#6f8cff' : '#ff6b6b' }}>#{id}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: con ? 'var(--color-paper-dim)' : 'var(--color-offline)' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: con ? 'var(--color-online)' : 'var(--color-offline)' }} />
                {con ? (t ? `${t.rssi} dBm` : 'conectado') : 'sin conexión'}
              </span>
              {conBateria && <span>{con && <IndicadorBateria pct={pct} titulo={tituloBat} />}</span>}
              <span title={t ? `Encendido hace ${duracion(t.up)} · último arranque: ${motivoReinicio(t.rst)}` : undefined}
                style={{ fontSize: '10px', color: t && reinicioAnomalo(t.rst) ? 'var(--color-offline)' : senal === 'mala' ? '#f1c21b' : 'var(--color-paper-faint)' }}>
                {!con || !t ? '' : reinicioAnomalo(t.rst) ? `reinició: ${motivoReinicio(t.rst)}` : senal === 'mala' ? 'señal débil' : `encendido ${duracion(t.up)}`}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ borderTop: '1px solid var(--color-line)', paddingTop: '8px', fontSize: '11px' }}>
        <div style={{ color: 'var(--color-paper-dim)', marginBottom: '4px' }}>Latencia cubo → pantalla</div>
        {lat ? (
          <div style={{ display: 'flex', gap: '12px', ...mono }}>
            <span>última <b style={{ color: colorLat(lat.ultima) }}>{lat.ultima} ms</b></span>
            <span>mediana <b style={{ color: colorLat(lat.mediana) }}>{lat.mediana}</b></span>
            <span>p95 <b style={{ color: colorLat(lat.p95) }}>{lat.p95}</b></span>
          </div>
        ) : (
          <div style={{ color: 'var(--color-paper-faint)' }}>Se mide con cada movimiento de un cubo (requiere Maestro_v3 actualizado).</div>
        )}
        {lat && <div style={{ color: 'var(--color-paper-faint)', fontSize: '10px', marginTop: '2px' }}>{lat.n} movimientos medidos · incluye 25 ms de antirrebote</div>}
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
