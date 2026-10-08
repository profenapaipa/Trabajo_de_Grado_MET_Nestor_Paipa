import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Info, LogOut, Users } from 'lucide-react'
import { sectionLabel } from '../ui/styles'
import { perfiles, type RolPerfil } from '../core/session/perfiles'
import type { Perfil } from '../core/session/sesion'

// Quién está usando la aplicación, en la esquina de siempre: un botón redondo
// con la inicial que abre el menú de la sesión. Antes el nombre estaba ahí
// escrito pero no se podía hacer nada con él —para cambiar de participante
// había que pasar por el informe general—, y en una sesión de trabajo el
// relevo entre dos personas es algo que ocurre.

export default function MenuPerfil({ perfil, onInforme, onCerrar, onCambiar, onCreditos }: {
  perfil: Perfil
  onInforme: () => void
  onCerrar: () => void
  onCambiar: (nombre: string, rol: RolPerfil) => void
  onCreditos: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const cajaRef = useRef<HTMLDivElement>(null)

  // Otros perfiles guardados, para relevar sin pasar por la pantalla de inicio.
  const otros = useMemo(
    () => (abierto ? perfiles().filter(p => p.id !== perfil.perfilId).slice(0, 5) : []),
    [abierto, perfil.perfilId])

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!cajaRef.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])

  const inicial = perfil.participante.trim().charAt(0).toUpperCase() || '?'

  const item: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left',
    background: 'transparent', border: 'none', cursor: 'pointer', padding: '9px 12px',
    color: 'var(--color-paper)', fontSize: '13px', fontFamily: 'var(--font-sans)',
  }

  return (
    <div ref={cajaRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setAbierto(o => !o)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={`${perfil.participante} — sesión iniciada a las ${new Date(perfil.inicio).toLocaleTimeString()}`}
        style={{
          width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer',
          background: abierto ? 'var(--color-blue)' : 'rgba(69,137,255,0.14)',
          border: `1px solid var(--color-blue)`,
          color: abierto ? '#fff' : 'var(--color-blue)',
          fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        {inicial}
      </button>

      {abierto && (
        <div role="menu" style={{
          position: 'absolute', top: '38px', right: 0, zIndex: 40, width: '262px',
          background: 'var(--color-panel)', border: '1px solid var(--color-line-strong)',
          borderRadius: 'var(--radius)', boxShadow: '0 14px 40px rgba(0,0,0,0.55)', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px', borderBottom: '1px solid var(--color-line)' }}>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>{perfil.participante}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '2px' }}>
              {perfil.rol === 'admin' ? 'Perfil de pruebas' : 'Participante'} · desde las {new Date(perfil.inicio).toLocaleTimeString()}
            </div>
            {perfil.operador && (
              <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>Opera: {perfil.operador}</div>
            )}
          </div>

          <button role="menuitem" onClick={() => { setAbierto(false); onInforme() }} style={item}>
            <FileText size={14} color="var(--color-blue)" /> Ver informe de la sesión
          </button>
          <button role="menuitem" onClick={() => { setAbierto(false); onCreditos() }} style={item}>
            <Info size={14} color="var(--color-paper-dim)" /> Créditos y fuentes
          </button>
          <button role="menuitem" onClick={() => { setAbierto(false); onCerrar() }} style={{ ...item, borderTop: '1px solid var(--color-line)' }}>
            <LogOut size={14} color="var(--color-caution)" /> Cerrar sesión y volver al inicio
          </button>

          <div style={{ borderTop: '1px solid var(--color-line)', padding: '10px 12px 4px' }}>
            <span style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={11} /> Cambiar de usuario
            </span>
          </div>
          {otros.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', padding: '0 12px 10px', lineHeight: 1.5 }}>
              No hay otros perfiles guardados. Desde el inicio puedes crear uno nuevo.
            </div>
          ) : (
            <div style={{ paddingBottom: '6px' }}>
              {otros.map(p => (
                <button key={p.id} role="menuitem" onClick={() => { setAbierto(false); onCambiar(p.nombre, p.rol) }}
                  style={{ ...item, padding: '7px 12px' }}>
                  <span aria-hidden="true" style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--color-paper-dim)',
                  }}>{p.nombre.charAt(0)}</span>
                  {p.nombre}
                </button>
              ))}
            </div>
          )}

          <div style={{ fontSize: '10.5px', color: 'var(--color-paper-faint)', padding: '8px 12px 10px', borderTop: '1px solid var(--color-line)', lineHeight: 1.5 }}>
            Al cambiar de usuario o cerrar la sesión, lo trabajado queda archivado en el historial del perfil.
          </div>
        </div>
      )}
    </div>
  )
}
