import { useEffect, useState } from 'react'
import App, { type ControlSnapshot } from './App'
import PantallaInicio from './components/PantallaInicio'
import InformeGeneral from './components/informe/InformeGeneral'
import { BotonTerminarSesion } from './components/informe/botones'
import MenuPerfil from './components/MenuPerfil'
import { SesionProvider, useSesion } from './core/session/sesion'
import { sembrarSesionesDeEjemplo } from './core/session/semilla'
import TutorialTab from './components/TutorialTab'
import SimulacionLibreTab from './components/SimulacionLibreTab'
import ObservadorTab from './components/ObservadorTab'
import InformesTab from './components/InformesTab'
import { StepMark, WIDE_MAX } from './ui/brand'

type Tab = 'control' | 'tutorial' | 'libre' | 'observador' | 'informes'

const TABS: { id: Tab; label: string; mode: string; modeColor: string }[] = [
  { id: 'control', label: '1 · Control Mago de Oz', mode: 'Hardware real', modeColor: 'var(--color-online)' },
  { id: 'tutorial', label: '2 · Tutorial guiado', mode: 'Sin hardware — aprendizaje', modeColor: 'var(--color-blue)' },
  { id: 'libre', label: '3 · Simulación libre', mode: 'Sin hardware — práctica', modeColor: 'var(--color-blue)' },
  { id: 'observador', label: '4 · Vista de observador', mode: 'Solo lectura', modeColor: 'var(--color-paper-dim)' },
  { id: 'informes', label: '5 · Informes', mode: 'Sesiones guardadas', modeColor: 'var(--color-blue)' },
]

function Shell() {
  const { perfil, abrirSesion, cerrarSesion } = useSesion()
  const [informeAbierto, setInformeAbierto] = useState(false)
  const [tab, setTab] = useState<Tab>('control')
  // Estado de Control que la Vista de observador ve en espejo (solo lectura).
  const [snapshot, setSnapshot] = useState<ControlSnapshot | null>(null)
  const [simPares, setSimPares] = useState(1)
  // Las sesiones de ejemplo que vienen con la aplicación se cargan una sola
  // vez; al terminar se vuelve a pintar la pantalla de inicio para que sus
  // perfiles aparezcan sin recargar.
  const [semilla, setSemilla] = useState(0)
  useEffect(() => { sembrarSesionesDeEjemplo().then(hecha => { if (hecha) setSemilla(x => x + 1) }) }, [])

  // El operador y el participante son los del perfil de la sesión: se piden
  // una sola vez al entrar y acompañan a todos los registros, de modo que la
  // trazabilidad no dependa de reescribirlos en cada pestaña.
  const operatorId = perfil?.operador ?? ''
  const participante = perfil?.participante ?? ''
  const noop = () => { /* el perfil se fija al abrir la sesión */ }

  const current = TABS.find(t => t.id === tab)!

  if (!perfil) return <PantallaInicio key={semilla} onAbrir={abrirSesion} />

  return (
    <div style={{
      height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: 'var(--color-bg)', color: 'var(--color-paper)', fontFamily: 'var(--font-sans)',
    }}>
      {/* Pestañas con el mismo lenguaje del resto: etiqueta mono en
          mayúsculas, la activa marcada con el medio escalón azul y un filo
          inferior — no botones redondeados de colores sueltos. */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-line)' }}>
        <div style={{
          display: 'flex', alignItems: 'stretch', gap: '4px', maxWidth: tab === 'tutorial' || tab === 'libre' ? WIDE_MAX : '1400px', margin: '0 auto',
          padding: '0 20px', boxSizing: 'border-box',
        }}>
          {TABS.map(t => {
            const active = t.id === tab
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: '7px', padding: '12px 14px 10px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${active ? 'var(--color-blue)' : 'transparent'}`,
                color: active ? 'var(--color-paper)' : 'var(--color-paper-faint)',
                fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                <StepMark color={active ? 'var(--color-blue)' : 'var(--color-line-strong)'} size={11} />
                {t.label}
              </button>
            )
          })}
          <span style={{
            marginLeft: 'auto', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
            color: current.modeColor,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: current.modeColor }} />
            {current.mode}
          </span>
          <span style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '14px' }}>
            <BotonTerminarSesion onClick={() => setInformeAbierto(true)} />
            {/* Quién está usando la aplicación, y desde aquí se releva. */}
            <MenuPerfil
              perfil={perfil}
              onInforme={() => setInformeAbierto(true)}
              onCerrar={() => { setInformeAbierto(false); cerrarSesion() }}
              onCambiar={(nombre, rol) => { setInformeAbierto(false); cerrarSesion(); abrirSesion(nombre, operatorId, rol) }} />
          </span>
        </div>
      </div>

      {/* Cada pestaña maneja su propio scroll interno dentro de esta región
          de altura fija — un único scrollbar visible por pestaña. Las cuatro
          quedan montadas aunque no se vean: antes se desmontaban al cambiar
          de pestaña y se perdía su bitácora. El informe general ya no
          reemplaza la pestaña: se abre encima, en una ventana emergente. */}
      <div style={{ display: tab === 'control' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <App
          operatorId={operatorId} setOperatorId={noop}
          onSnapshot={setSnapshot} />
      </div>
      <div style={{ display: tab === 'tutorial' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TutorialTab operatorId={operatorId} participante={participante} setParticipante={noop}
          onGoToFreeSim={() => { setSimPares(5); setTab('libre') }} />
      </div>
      <div style={{ display: tab === 'libre' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SimulacionLibreTab operatorId={operatorId} participante={participante} setParticipante={noop}
          pares={simPares} setPares={setSimPares} />
      </div>
      <div style={{ display: tab === 'observador' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <ObservadorTab snapshot={snapshot} operatorId={operatorId} />
      </div>
      {/* Los informes guardados: la única pestaña que no mira la sesión en
          curso sino el archivo de todas las anteriores. */}
      <div style={{ display: tab === 'informes' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <InformesTab activo={tab === 'informes'} />
      </div>

      {informeAbierto && (
        <InformeGeneral
          onCerrar={() => setInformeAbierto(false)}
          onCerrarSesion={() => { cerrarSesion(); setInformeAbierto(false) }} />
      )}
    </div>
  )
}

function AppShell() {
  return <SesionProvider><Shell /></SesionProvider>
}

export default AppShell
