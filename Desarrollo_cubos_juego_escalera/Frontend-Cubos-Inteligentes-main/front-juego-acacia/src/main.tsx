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
  import('./AppShell.tsx').then(({ default: AppShell }) => {
    root.render(<StrictMode><AppShell /></StrictMode>)
  })
}
