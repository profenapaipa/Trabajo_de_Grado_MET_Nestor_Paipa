import { useState } from 'react'
import { Check, ClipboardList, Download, Eye, NotebookPen } from 'lucide-react'
import { PPA_HEX, PPA_TEXT, PPA_LABEL, ppaRgba, type PPAPhase } from '../core/ppa/ppaColors'
import { toCsvGeneric, downloadFile, nowIso } from '../core/bitacora/csv'
import type { ObservedCube } from '../App'

export const OBS_ACCENT = '#14b8a6'
const OBS_BG = 'radial-gradient(ellipse at top left, #0c1b1a 0%, #081312 45%, #040807 100%)'

const obsCard: React.CSSProperties = {
  background: 'rgba(10,22,20,0.85)', border: '1px solid rgba(20,184,166,0.3)',
  borderRadius: '12px', padding: '14px 16px',
}
const obsLabel: React.CSSProperties = { fontSize: '11px', color: '#7fa39c', letterSpacing: '0.08em' }

type NotaEvento = { timestamp: string; observador: string; nota: string }

function ObservadorTab({ cubes, cubeActions }: {
  cubes: ObservedCube[]
  cubeActions: Record<number, PPAPhase>
}) {
  const [observerInput, setObserverInput] = useState('')
  const [observerId, setObserverId] = useState('')
  const [notaDraft, setNotaDraft] = useState('')
  const [notas, setNotas] = useState<NotaEvento[]>([])

  function registrarNota() {
    if (!notaDraft.trim()) return
    setNotas(prev => [...prev, { timestamp: nowIso(), observador: observerId || '(sin nombre)', nota: notaDraft.trim() }])
    setNotaDraft('')
  }

  function exportCsv() { downloadFile(`bitacora-observacion-${Date.now()}.csv`, toCsvGeneric(notas, ['timestamp', 'observador', 'nota']), 'text/csv;charset=utf-8') }
  function exportJson() { downloadFile(`bitacora-observacion-${Date.now()}.json`, JSON.stringify(notas, null, 2), 'application/json') }

  return (
    <div style={{ minHeight: '100%', background: OBS_BG, padding: '4px 2px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '900px', margin: '0 auto', padding: '12px 20px 0' }}>

        <div style={obsCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '16px' }}>
            <Eye size={18} color={OBS_ACCENT} /> Vista de observador
          </div>
          <div style={{ color: '#7fa39c', fontSize: '12px', marginTop: '2px' }}>
            Solo lectura: los cubos que ve el operador en Control Mago de Oz, en vivo. Sin controles de confirmación — el observador registra y acompaña, no decide.
          </div>
        </div>

        <div style={obsCard}>
          <div style={obsLabel}>OBSERVADOR · NOMBRE DE QUIEN REGISTRA</div>
          <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
            <input
              value={observerInput}
              onChange={e => setObserverInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && observerInput.trim()) setObserverId(observerInput.trim()) }}
              placeholder="escribe el nombre y confirma"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${observerId && observerInput.trim() === observerId ? '#22c55e77' : 'rgba(20,184,166,0.3)'}`,
                borderRadius: '6px', padding: '6px 10px', color: '#fff', fontSize: '13px', width: '200px',
              }} />
            <button
              onClick={() => observerInput.trim() && setObserverId(observerInput.trim())}
              disabled={!observerInput.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px',
                background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                color: '#22c55e', fontSize: '12px', cursor: observerInput.trim() ? 'pointer' : 'not-allowed',
                opacity: observerInput.trim() ? 1 : 0.4,
              }}>
              <Check size={13} /> Confirmar
            </button>
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px' }}>
            {observerId
              ? <span style={{ color: '#22c55e' }}>✓ Observador confirmado: {observerId}</span>
              : <span style={{ color: '#f59e0b' }}>Sin confirmar — las notas quedan como "(sin nombre)" hasta que confirmes</span>}
          </div>
        </div>

        <div style={obsCard}>
          <div style={{ ...obsLabel, marginBottom: '10px' }}>CUBOS · {cubes.length}</div>
          {cubes.length === 0 ? (
            <div style={{ color: '#557a74', fontSize: '12px' }}>Sin cubos reportados todavía — se llenan cuando Control Mago de Oz recibe posiciones de la base física.</div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {cubes.map(c => {
                const action = cubeActions[c.id]
                const teamColor = c.team === 'A' ? '#0000ff' : '#ff0000'
                return (
                  <div key={c.id} style={{
                    width: '54px', height: '62px', borderRadius: '8px',
                    background: action ? PPA_HEX[action] : teamColor,
                    border: action ? `1px solid ${PPA_HEX[action]}` : '1px solid rgba(255,255,255,0.15)',
                    boxShadow: action ? `0 0 10px ${ppaRgba(action, 0.7)}` : 'none',
                    color: action ? PPA_TEXT[action] : '#fff', fontWeight: 700, fontSize: '13px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}>
                    <span>#{c.id}</span>
                    {action && <span style={{ fontSize: '9px' }}>{PPA_LABEL[action]}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={obsCard}>
          <div style={{ ...obsLabel, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <NotebookPen size={12} /> DILIGENCIAR EVENTO
          </div>
          <textarea
            value={notaDraft}
            onChange={e => setNotaDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); registrarNota() } }}
            placeholder="Describe lo que observas (por ejemplo: señal de confusión, gesto del estudiante, incidencia técnica)... — Enter para registrar, Shift+Enter para salto de línea"
            rows={3}
            style={{
              width: '100%', resize: 'vertical', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(20,184,166,0.3)', borderRadius: '8px', padding: '8px 10px',
              color: '#fff', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box',
            }} />
          <button onClick={registrarNota} disabled={!notaDraft.trim()} style={{
            marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.4)',
            borderRadius: '8px', padding: '7px 14px', color: OBS_ACCENT, fontSize: '13px',
            cursor: notaDraft.trim() ? 'pointer' : 'not-allowed', opacity: notaDraft.trim() ? 1 : 0.4,
          }}>
            <NotebookPen size={13} /> Registrar nota
          </button>
        </div>

        <div style={obsCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ ...obsLabel, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ClipboardList size={12} /> BITÁCORA DE OBSERVACIÓN · {notas.length}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> CSV</button>
              <button onClick={exportJson} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}><Download size={11} /> JSON</button>
            </div>
          </div>
          <div style={{ maxHeight: '260px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
            {notas.length === 0 && <div style={{ color: '#557a74' }}>Sin notas todavía.</div>}
            {[...notas].reverse().map((n, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#aaa' }}>
                <span style={{ color: '#7fa39c' }}>{n.timestamp}</span> · <span style={{ color: OBS_ACCENT }}>{n.observador}</span> · {n.nota}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ObservadorTab
