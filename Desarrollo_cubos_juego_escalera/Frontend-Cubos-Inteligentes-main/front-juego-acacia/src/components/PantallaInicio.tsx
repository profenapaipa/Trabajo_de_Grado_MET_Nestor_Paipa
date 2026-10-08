import { useMemo, useState } from 'react'
import { Zap, UserPlus } from 'lucide-react'
import { Logo, EegTrace } from '../ui/brand'
import LogosFondo from '../ui/LogosFondo'
import { sectionLabel, sessionBtn, panel } from '../ui/styles'
import { ID_ADMIN, perfiles, resumenDePerfil, type RolPerfil } from '../core/session/perfiles'

// Puerta de entrada de la sesión: sin participante no se abre la aplicación.
// Antes el nombre se escribía dentro de cada pestaña, así que un mismo
// ejercicio podía quedar registrado como "(sin nombre)" en una pestaña y con
// nombre en otra —ocurrió en la sesión 1 de Joel—, y no había forma de
// reconstruir qué pertenecía a quién. Ahora el perfil se pide una vez y
// acompaña a todos los registros de la sesión.
//
// Los perfiles ya usados quedan a un clic, con el resumen de lo que llevan
// acumulado (ver core/session/perfiles.ts), y ADMIN es el perfil de entrada
// rápida para probar sin escribir nada — y aun así todo queda registrado.

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export default function PantallaInicio({ onAbrir }: { onAbrir: (participante: string, operador: string, rol?: RolPerfil) => void }) {
  const [participante, setParticipante] = useState('')
  const [operador, setOperador] = useState('')
  const lista = useMemo(() => perfiles().map(p => ({ perfil: p, resumen: resumenDePerfil(p.id) })), [])

  const listo = participante.trim().length > 0
  const abrir = () => { if (listo) onAbrir(participante, operador) }

  const campo: React.CSSProperties = {
    background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)',
    borderRadius: 'var(--radius)', padding: '11px 12px', color: 'var(--color-paper)',
    fontSize: '15px', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', color: 'var(--color-paper)', fontFamily: 'var(--font-sans)',
      backgroundImage: 'radial-gradient(circle, var(--color-line) 1px, transparent 1px)',
      backgroundSize: '22px 22px', padding: '20px', overflowY: 'auto', position: 'relative',
    }}>
      {/* La misma marca de agua de las cinco secciones, pero viva: aquí los
          logos se mueven y cambian de tamaño en vez de recolocarse al
          recargar. */}
      <LogosFondo />
      <div style={{ ...panel, width: '100%', maxWidth: '540px', padding: '26px 28px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <Logo size={42} />
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>Escalera Inteligente</div>
            <div style={{ ...sectionLabel, fontWeight: 500 }}>Nueva sesión</div>
          </div>
        </div>
        <div style={{ margin: '10px 0 18px' }}><EegTrace color="var(--color-blue)" /></div>

        <label style={{ display: 'block', marginBottom: '16px' }}>
          <span style={sectionLabel}>Quién opera (mago de Oz)</span>
          <input value={operador} onChange={e => setOperador(e.target.value)}
            placeholder="opcional — queda en todos los registros de la sesión"
            style={{ ...campo, marginTop: '7px' }} />
        </label>

        {/* Perfiles ya conocidos: continuar con uno es un clic, y su
            historial de sesiones y niveles se conserva. */}
        <div style={{ ...sectionLabel, marginBottom: '8px' }}>Perfiles guardados en este equipo</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '18px' }}>
          {lista.map(({ perfil, resumen }) => {
            const esAdmin = perfil.id === ID_ADMIN
            return (
              <button key={perfil.id}
                onClick={() => onAbrir(perfil.nombre, operador, perfil.rol)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', cursor: 'pointer',
                  background: esAdmin ? 'rgba(69,137,255,0.10)' : 'var(--color-bg)',
                  border: `1px solid ${esAdmin ? 'var(--color-blue)' : 'var(--color-line-strong)'}`,
                  borderRadius: 'var(--radius)', padding: '10px 12px', color: 'var(--color-paper)',
                }}>
                {esAdmin
                  ? <Zap size={16} color="var(--color-blue)" />
                  : <span aria-hidden="true" style={{
                    width: '22px', height: '22px', flexShrink: 0, borderRadius: '50%',
                    background: 'var(--color-line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                  }}>{perfil.nombre.slice(0, 2)}</span>}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>
                    {perfil.nombre}{esAdmin ? ' — entrada rápida' : ''}
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '2px' }}>
                    {resumen.sesiones === 0
                      ? (esAdmin ? 'para probar sin escribir nada; todo queda registrado igual' : 'perfil sin sesiones todavía')
                      : `${resumen.sesiones} ${resumen.sesiones === 1 ? 'sesión' : 'sesiones'} · ${resumen.intentos} intentos `
                        + `(${resumen.victorias} ganados) · ${reloj(resumen.segundos)} jugados`
                        + (resumen.niveles.length ? ` · niveles ${resumen.niveles.map(n => n.pares).join(', ')}` : '')}
                  </span>
                </span>
                <span style={{ ...sectionLabel, color: 'var(--color-blue)' }}>Entrar</span>
              </button>
            )
          })}
        </div>

        {lista.length <= 1 && (
          <div style={{
            fontSize: '11px', color: 'var(--color-paper-faint)', lineHeight: 1.55,
            borderLeft: '2px solid var(--color-line-strong)', paddingLeft: '9px', margin: '-8px 0 18px',
          }}>
            Todavía no hay perfiles guardados aquí. Si ya jugaste antes y no aparecen, comprueba que estés abriendo la
            aplicación en la misma dirección de siempre: el historial se guarda por navegador <b>y por dirección</b>{' '}
            (no es lo mismo <span style={{ fontFamily: 'var(--font-mono)' }}>localhost:5173</span> que otro puerto).
            También puedes recuperar una sesión antigua desde «5 · Informes → Importar bitácoras» con su archivo .json.
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--color-line)', paddingTop: '16px' }}>
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <span style={{ ...sectionLabel, color: 'var(--color-blue)' }}>Nuevo participante</span>
            <input autoFocus value={participante} onChange={e => setParticipante(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') abrir() }}
              placeholder="nombre de quien juega la sesión" style={{ ...campo, marginTop: '7px' }} />
          </label>
          <button onClick={abrir} disabled={!listo}
            style={{ ...sessionBtn(listo, 'var(--color-blue)'), width: '100%', justifyContent: 'center', fontSize: '15px', padding: '12px' }}>
            <UserPlus size={15} /> Empezar sesión
          </button>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginTop: '14px', lineHeight: 1.55 }}>
          El nombre queda en cada registro de las cuatro pestañas y permite generar el informe general al terminar.
          La sesión se conserva aunque se recargue la página, y al cerrarla queda archivada en el historial del perfil
          (no se borra): la próxima sesión del mismo perfil puede comparar con las anteriores.
        </div>
      </div>
    </div>
  )
}
