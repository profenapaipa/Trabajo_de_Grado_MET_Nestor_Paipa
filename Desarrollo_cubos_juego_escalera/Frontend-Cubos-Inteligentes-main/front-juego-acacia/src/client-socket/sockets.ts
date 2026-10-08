import { io } from 'socket.io-client'

// Dirección del backend de los cubos. Se puede fijar al compilar con
// VITE_BACKEND_URL; si no, se asume el servidor local de siempre. En la
// versión publicada en la web no hay backend: Control Mago de Oz aparece como
// «Desconectado» —que es lo correcto, no hay hardware al otro lado— y las
// pestañas de simulación e informes funcionan igual.
const PORT = 3000
const URL = import.meta.env.VITE_BACKEND_URL ?? `localhost:${PORT}`

// `autoConnect` sigue activo, pero sin reintentos infinitos: en la web eso
// solo llenaría la consola de errores.
const socket = io(URL, { reconnectionAttempts: 5, timeout: 4000 });

// client-side
socket.on("connect", () => {
    console.log(socket.id); 
});

export default socket;