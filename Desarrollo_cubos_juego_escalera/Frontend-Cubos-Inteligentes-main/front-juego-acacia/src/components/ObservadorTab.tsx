import { useMemo, useState } from 'react'
import { PPA_HEX, PPA_TEXT, PPA_LABEL } from '../core/ppa/ppaColors'
import { toCsvGeneric, downloadFile, nowIso } from '../core/bitacora/csv'
import type { ControlSnapshot } from '../App'
import { PageFrame, Panel, PersonField, Badge, SectionTitle, Collapsible, LogPanel, TwoColumn, Electrode } from '../ui/brand'
import { sectionLabel, sessionBtn, TEAM_HEX } from '../ui/styles'
import GrafoEstados from './simulation/GrafoEstados'
import InformeNivel from './informe/InformeNivel'
import { BotonInformeNivel } from './informe/botones'
import { useSesion } from '../core/session/sesion'

// Vista de observador — solo lectura. Ve en espejo lo mismo que el
// operador en Control Mago de Oz (estado de la sesión, cronómetro, intento,
// tablero con señales PPA y conexión de cada cubo) y registra lo que
// observa. Cada nota queda atada al número de intento y al momento del
// cronómetro, para poder cruzarla después con las bitácoras de Control.

// Etiquetas de un toque — lo que más se repite al observar una sesión.
// Registran al instante (con el texto escrito, si lo hay), para no perder
// el momento mientras se escribe.
const TAGS = ['Confusión', 'Frustración', 'Pide ayuda', 'Distracción', 'Logro', 'Incidencia técnica'] as const

// Listas vacías estables para el grafo (ver GrafoEstados).
const SIN_RECORRIDOS: number[][] = []
const SIN_RECORRIDO: number[] = []

type Nota = {
  timestamp: string
  observador: string
  intento: number | ''
  estadoSesion: string
  cronometro: string
  etiqueta: string
  nota: string
}

function ObservadorTab({ snapshot, operatorId }: { snapshot: ControlSnapshot | null; operatorId: string }) {
  const sesion = useSesion()
  const [observerId, setObserverId] = useState('')
  const [draft, setDraft] = useState('')
  const [notas, setNotas] = useState<Nota[]>([])
  const [logOpen, setLogOpen] = useState(true)
  const [informeNivel, setInformeNivel] = useState(false)

  const connected = snapshot?.connected ?? false
  const pares = snapshot?.pares ?? 5
  // Lo que el observador mira es el intento de Control: su informe del nivel
  // es el de esa sección, en solo lectura.
  const intentosControl = useMemo(
    () => sesion.intentos.filter(i => i.seccion === 'control' && i.pares === pares),
    [sesion.intentos, pares])
  const recorridosPrevios = useMemo(
    () => (intentosControl.length ? intentosControl.map(i => i.recorrido) : SIN_RECORRIDOS),
    [intentosControl])

  function registrar(etiqueta: string) {
    const texto = draft.trim()
    if (etiqueta === 'Nota' && !texto) return
    const ts = nowIso()
    setNotas(prev => [...prev, {
      timestamp: ts,
      observador: observerId || '(sin nombre)',
      intento: snapshot?.intento || '',
      estadoSesion: snapshot?.status ?? 'sin datos',
      cronometro: snapshot?.elapsed ?? '',
      etiqueta,
      nota: texto,
    }])
    // La nota también va a la sesión: antes la bitácora de observación se
    // quedaba en esta pestaña y no aparecía en el informe general.
    sesion.registrarEvento({
      ts, seccion: 'observador', tipo: 'nota_observacion',
      detalle: `${etiqueta}${texto ? `: ${texto}` : ''}${snapshot?.elapsed ? ` · cronómetro ${snapshot.elapsed}` : ''}`,
      pares: snapshot?.pares, intentoNum: snapshot?.intento || undefined,
    })
    setDraft('')
  }

  const cols: (keyof Nota)[] = ['timestamp', 'observador', 'intento', 'estadoSesion', 'cronometro', 'etiqueta', 'nota']
  function exportCsv() { downloadFile(`bitacora-observacion-${Date.now()}.csv`, toCsvGeneric(notas, cols), 'text/csv;charset=utf-8') }
  function exportJson() { downloadFile(`bitacora-observacion-${Date.now()}.json`, JSON.stringify(notas, null, 2), 'application/json') }

  const counts = TAGS.map(t => ({ t, n: notas.filter(x => x.etiqueta === t).length }))

  const main = (
    <>
      <Panel style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={sectionLabel}>
            {snapshot ? snapshot.status : 'sin datos de Control'}{snapshot?.intento ? ` · intento ${snapshot.intento}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: '40px', fontWeight: 600, lineHeight: 1.15 }}>
            {snapshot?.elapsed ?? '0:00'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <div>
            <div style={sectionLabel}>Movimientos</div>
            <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{snapshot?.moveCount ?? 0}</div>
          </div>
          <div>
            <div style={sectionLabel}>Pares</div>
            <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{snapshot?.pares ?? '—'}</div>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionTitle right={
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {Object.entries(snapshot?.cubeActions ?? {}).map(([id, a]) => (
              <span key={id} style={{ fontSize: '11px', color: PPA_TEXT[a] }}>#{id} {PPA_LABEL[a]}</span>
            ))}
            <Badge color={connected ? 'var(--color-online)' : 'var(--color-offline)'}>
              <Electrode on={connected} colorOn="var(--color-online)" colorOff="var(--color-offline)" />
              {connected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </div>
        }>
          Tablero en vivo · {snapshot ? `${snapshot.board.length} posiciones · esclavos ${snapshot.esclavos.length}/10` : 'sin datos'}
        </SectionTitle>
        {snapshot ? (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', justifyContent: 'center' }}>
            {snapshot.board.map((id, i) => {
              const action = id ? snapshot.cubeActions[id] : undefined
              const on = id !== 0 && snapshot.esclavos.includes(id)
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <div style={{
                    width: '72px', height: '80px', borderRadius: '10px', boxSizing: 'border-box', padding: '8px 4px 6px',
                    background: id === 0 ? '#808080' : action ? PPA_HEX[action] : TEAM_HEX[id <= 5 ? 'A' : 'B'],
                    opacity: id === 0 ? 0.55 : 1, boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                    color: action ? '#10141a' : '#fff',
                  }}>
                    <span style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1 }}>{id || ''}</span>
                    {action && <span style={{ fontSize: '10px', fontWeight: 700 }}>{PPA_LABEL[action]}</span>}
                  </div>
                  {id === 0 ? <div style={{ width: '13px', height: '13px' }} /> : (
                    <div title={`Cubo #${id} — ${on ? 'conectado' : 'sin conexión'}`} style={{
                      width: '13px', height: '13px', borderRadius: '50%',
                      background: on ? 'var(--color-online)' : 'var(--color-offline)',
                      boxShadow: `0 0 0 3px ${on ? 'rgba(66,190,101,0.22)' : 'rgba(250,77,86,0.22)'}`,
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--color-paper-faint)' }}>Aún no hay datos: se llenan en cuanto Control Mago de Oz carga.</div>
        )}
        {snapshot && !connected && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-paper-faint)' }}>
            Control no está conectado a la base física — el tablero muestra la última posición conocida.
          </div>
        )}
      </Panel>

      {/* Espejo del grafo de Control: el observador sigue el recorrido real
          sobre el mapa del juego, con el mismo componente y el mismo
          comportamiento que las demás vistas (solo lectura). */}
      <Panel>
        <SectionTitle right={
          <BotonInformeNivel onClick={() => setInformeNivel(true)} pares={pares} intentos={intentosControl.length} />
        }>
          Grafo de estados · {pares} par{pares > 1 ? 'es' : ''} — recorrido de Control
        </SectionTitle>
        <GrafoEstados
          pares={pares}
          previos={recorridosPrevios}
          actual={snapshot?.recorrido ?? SIN_RECORRIDO}
          height={400}
          terminado={!!snapshot && snapshot.status.startsWith('victoria')} />
      </Panel>

      <Panel>
        <SectionTitle>Registrar observación</SectionTitle>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); registrar('Nota') } }}
          placeholder="Describe lo que observas (opcional si usas una etiqueta) — Enter registra, Shift+Enter hace salto de línea"
          rows={3}
          style={{
            width: '100%', resize: 'vertical', boxSizing: 'border-box', background: 'var(--color-bg)',
            border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '8px 10px',
            color: 'var(--color-paper)', fontSize: '13px', fontFamily: 'inherit',
          }} />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '10px' }}>
          <span style={{ ...sectionLabel, marginRight: '4px' }}>Registrar con un toque</span>
          {TAGS.map(t => (
            <button key={t} onClick={() => registrar(t)} style={{
              padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              background: 'var(--color-bg)', color: 'var(--color-paper)',
              border: `1px solid ${t === 'Logro' ? 'var(--color-online)' : t === 'Incidencia técnica' ? 'var(--color-caution)' : 'var(--color-line-strong)'}`,
            }}>{t}</button>
          ))}
          <button onClick={() => registrar('Nota')} disabled={!draft.trim()}
            style={{ ...sessionBtn(!!draft.trim(), 'var(--color-blue)'), marginLeft: 'auto' }}>Registrar nota</button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '8px' }}>
          Cada registro guarda el intento, el estado de la sesión y el momento del cronómetro de Control,
          y queda también en el informe general de la sesión.
        </div>
      </Panel>

      <Collapsible title="Histórico — bitácora de observación" open={logOpen} onToggle={() => setLogOpen(o => !o)}>
        <LogPanel
          title="Bitácora de observación"
          rows={notas.map(n => ({
            ts: n.timestamp,
            tag: `${n.intento ? `#${n.intento} · ` : ''}${n.etiqueta}`,
            text: `${n.observador} · ${n.cronometro || '—'}${n.nota ? ` · ${n.nota}` : ''}`,
          }))}
          empty="Sin notas todavía."
          onCsv={exportCsv} onJson={exportJson} maxHeight={240} />
      </Collapsible>
    </>
  )

  const side = (
    <>
      <Panel style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <PersonField label="Observador · quien registra" value={observerId} onConfirm={setObserverId} onClear={() => setObserverId('')} />
        <div>
          <div style={sectionLabel}>Operador en sesión</div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '6px', color: operatorId ? 'var(--color-paper)' : 'var(--color-paper-faint)' }}>
            {operatorId || 'sin confirmar en Control'}
          </div>
        </div>
      </Panel>
      <Panel>
        <SectionTitle right={<span style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>{notas.length}</span>}>Resumen de notas</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {counts.map(({ t, n }) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ flex: 1, color: 'var(--color-paper-dim)' }}>{t}</span>
              <span style={{ width: '70px', height: '6px', background: 'var(--color-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', width: `${notas.length ? (n / notas.length) * 100 : 0}%`, background: 'var(--color-blue)' }} />
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', width: '18px', textAlign: 'right' }}>{n}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )

  return (
    <PageFrame
      subtitle="Vista de observador"
      traceColor={connected ? 'var(--color-online)' : 'var(--color-offline)'}
      badge={<Badge color="var(--color-paper-dim)">SOLO LECTURA</Badge>}
    >
      <TwoColumn main={main} side={side} />
      {informeNivel && (
        <InformeNivel seccion="control" pares={pares} onCerrar={() => setInformeNivel(false)} />
      )}
    </PageFrame>
  )
}

export default ObservadorTab
