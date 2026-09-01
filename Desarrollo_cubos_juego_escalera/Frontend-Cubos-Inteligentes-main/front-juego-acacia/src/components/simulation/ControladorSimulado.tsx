import { useState } from 'react'
import { Pause, Lightbulb, Zap, Download, ClipboardList, TriangleAlert, Eye } from 'lucide-react'
import { simCard, simLabel, SIM_ACCENT } from '../../core/simulation/theme'
import { type DecisionOperador, toCsvDecisionesOperador, downloadFile, nowIso } from '../../core/control/bitacoraControl'

type CubeAction = 'pausar' | 'pensar' | 'actuar'

const ACTION_META: Record<CubeAction, { label: string; rgb: string; text: string; icon: React.ReactNode; vib: string; sound: string }> = {
  pausar: { label: 'PAUSAR', rgb: 'rgb(0,0,150)', text: '#6699ff', icon: <Pause size={20} />, vib: '20% vibr.', sound: '250 Hz' },
  pensar: { label: 'PENSAR', rgb: 'rgb(255,255,102)', text: '#ffff66', icon: <Lightbulb size={20} />, vib: '50% vibr.', sound: 'bip-bip 600 Hz' },
  actuar: { label: 'ACTUAR', rgb: 'rgb(0,255,0)', text: '#00ff88', icon: <Zap size={20} />, vib: '80% vibr.', sound: '600→1000 Hz' },
}

function playTone(freq: number, duration: number) {
  try {
    const ctx = new AudioContext(), osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.35, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(); osc.stop(ctx.currentTime + duration)
  } catch { /* audio no disponible */ }
}
function playBipBip(freq: number) {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination); osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.30
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.01)
      g.gain.setValueAtTime(0.35, t + 0.12); g.gain.linearRampToValueAtTime(0, t + 0.15)
      osc.start(t); osc.stop(t + 0.16)
    }
  } catch { /* audio no disponible */ }
}
function playAscending(s: number, e: number, d: number) {
  try {
    const ctx = new AudioContext(), osc = ctx.createOscillator(), g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.setValueAtTime(s, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(e, ctx.currentTime + d)
    g.gain.setValueAtTime(0.35, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d)
    osc.start(); osc.stop(ctx.currentTime + d)
  } catch { /* audio no disponible */ }
}

function ControladorSimulado({ pares, role, operatorId }: {
  pares: number
  role: 'operador' | 'observador'
  operatorId: string
}) {
  const [selectedCubeId, setSelectedCubeId] = useState<number | null>(null)
  const [lastAction, setLastAction] = useState<CubeAction | null>(null)
  const [events, setEvents] = useState<DecisionOperador[]>([])

  const cubeIds = Array.from({ length: pares * 2 }, (_, i) => i + 1)

  function send(a: CubeAction) {
    if (role === 'observador' || selectedCubeId === null) return
    setLastAction(a)
    if (a === 'pausar') playTone(250, 0.5)
    if (a === 'pensar') playBipBip(600)
    if (a === 'actuar') playAscending(600, 1000, 0.5)
    setEvents(prev => [...prev, {
      timestamp: nowIso(), pares, operadorId: operatorId || '(sin asignar)',
      cuboId: selectedCubeId, fase: a,
      detalle: `Operador envió ${a.toUpperCase()} (simulado) al cubo #${selectedCubeId}`,
    }])
  }

  function exportCsv() { downloadFile(`bitacora-controlador-simulado-${Date.now()}.csv`, toCsvDecisionesOperador(events), 'text/csv;charset=utf-8') }
  function exportJson() { downloadFile(`bitacora-controlador-simulado-${Date.now()}.json`, JSON.stringify(events, null, 2), 'application/json') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={simCard}>
        <div style={{ ...simLabel, marginBottom: '10px' }}>CUBOS (SIMULADOS) · {cubeIds.length}</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {cubeIds.map(id => {
            const team = id <= pares ? 'A' : 'B'
            const color = team === 'A' ? '#0000ff' : '#ff0000'
            const isSelected = selectedCubeId === id
            return (
              <button key={id} onClick={() => setSelectedCubeId(id)} style={{
                width: '52px', height: '58px', borderRadius: '8px', background: color, cursor: 'pointer',
                border: isSelected ? '3px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontWeight: 700, fontSize: '14px',
              }}>#{id}</button>
            )
          })}
        </div>
      </div>

      {role === 'observador' && (
        <div style={{ ...simCard, display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontSize: '12px', fontStyle: 'italic' }}>
          <Eye size={12} /> Vista de observador — puedes ver el estado, no enviar señales.
        </div>
      )}

      <div style={{ ...simCard, opacity: role === 'observador' ? 0.5 : 1 }}>
        {selectedCubeId === null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#f59e0b', fontSize: '12px' }}>
            <TriangleAlert size={13} /> Selecciona un cubo antes de enviar una señal.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
          {(['pausar', 'pensar', 'actuar'] as const).map(a => (
            <button key={a} disabled={role === 'observador' || selectedCubeId === null} onClick={() => send(a)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
              padding: '14px 12px', borderRadius: '12px', cursor: role === 'observador' || selectedCubeId === null ? 'not-allowed' : 'pointer',
              background: lastAction === a ? SIM_ACCENT + '33' : 'rgba(0,0,0,0.25)',
              border: `1px solid ${lastAction === a ? SIM_ACCENT : 'rgba(255,255,255,0.1)'}`,
              color: ACTION_META[a].text,
            }}>
              {ACTION_META[a].icon}
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{ACTION_META[a].label}</div>
              <div style={{ fontSize: '10px', color: '#888' }}>{ACTION_META[a].vib} · {ACTION_META[a].sound}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={simCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ ...simLabel, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ClipboardList size={12} /> BITÁCORA DEL OPERADOR (CONTROLADOR SIMULADO) · {events.length}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> CSV</button>
            <button onClick={exportJson} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> JSON</button>
          </div>
        </div>
        <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '10px', fontFamily: 'monospace' }}>
          {events.length === 0 && <div style={{ color: '#555' }}>Sin envíos todavía.</div>}
          {[...events].reverse().map((ev, i) => (
            <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#aaa' }}>
              <span style={{ color: '#666' }}>{ev.timestamp}</span> · <span style={{ color: SIM_ACCENT }}>{ev.operadorId}</span> · {ev.detalle}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ControladorSimulado
