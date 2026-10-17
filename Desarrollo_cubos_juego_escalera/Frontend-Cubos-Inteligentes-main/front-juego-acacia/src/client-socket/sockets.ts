import { io } from 'socket.io-client'

// Dirección del backend de los cubos. Se puede fijar al compilar con
// VITE_BACKEND_URL; si no, se asume el servidor local de siempre. En la
// versión publicada en la web no hay backend: Control Mago de Oz aparece como
// «Desconectado» —que es lo correcto, no hay hardware al otro lado— y las
// pestañas de simulación e informes funcionan igual.
const PORT = 3000
const URL = import.meta.env.VITE_BACKEND_URL ?? `localhost:${PORT}`

// Reintentos (2026-10-16): con los cubos (aplicación servida en local) se
// reintenta SIEMPRE — antes, tras 5 intentos fallidos (backend reiniciado,
// portátil en reposo, corte de WiFi) el socket se rendía para siempre y
// Control dejaba de recibir posiciones hasta recargar. Solo la versión
// publicada en la web, donde no hay backend, mantiene el límite de 5 para no
// llenar la consola de errores.
const enLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname) || /^(192\.168|10)\./.test(location.hostname)

// Solo websocket: por defecto socket.io empieza con long-polling HTTP y luego
// se pasa a websocket; en ese cambio el backend a veces respondía 400 y la
// conexión se caía 1-3 s justo al cargar — lo que llegara en ese hueco (un
// cubo levantado, por ejemplo) se perdía. Directo por websocket no hay
// cambio de transporte y cada mensaje llega antes.
const socket = io(URL, {
  transports: ['websocket'],
  reconnectionAttempts: enLocal ? Infinity : 5,
  // Reintento casi inmediato: al reconectar, Control pide de nuevo el
  // tablero (solicitarEstado), así que un corte breve no deja nada atrás.
  reconnectionDelay: 300,
  reconnectionDelayMax: 2000,
  timeout: 4000,
});

// client-side
socket.on("connect", () => {
    console.log(socket.id); 
});

export default socket;