import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root')!)

// ?vista=jugador: solo la pantalla del participante (ventana aparte, segundo
// monitor). Se carga sin la aplicación completa: sin perfiles, sin pestañas
// y sin abrir otra conexión con el backend — el estado le llega de Control.
if (new URLSearchParams(location.search).get('vista') === 'jugador') {
  import('./components/jugador/VistaJugador').then(({ default: VistaJugador }) => {
    document.title = 'Escalera — Vista del jugador'
    root.render(<StrictMode><VistaJugador enVentana /></StrictMode>)
  })
} else {
  // Antes de pintar se hidrata el almacenamiento: perfiles, sesiones y la
  // sesión en curso se leen de IndexedDB una sola vez y desde entonces se
  // consultan de memoria (ver core/session/almacen.ts). Si IndexedDB no
  // responde, la aplicación arranca igual con lo que haya en localStorage.
  Promise.all([import('./core/session/almacen'), import('./core/session/perfiles'), import('./core/session/carpeta')])
    .then(async ([almacen, perfiles, carpeta]) => {
      try { await almacen.hidratar(); perfiles.hidratarArchivo(); await carpeta.cargarCarpeta() } catch { /* se sigue con localStorage */ }
      const { default: AppShell } = await import('./AppShell.tsx')
      root.render(<StrictMode><AppShell /></StrictMode>)
    })
}
