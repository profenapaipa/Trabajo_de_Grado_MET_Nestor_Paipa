import express from 'express'
import logger from 'morgan';

import { Server } from 'socket.io'
import { createServer } from 'node:http'
import cors from 'cors'
import dgram from 'node:dgram'
import { networkInterfaces } from 'node:os'
import { appendFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const port = process.env.PORT ?? 3000
// tiempo máximo sin recibir peticiones de la base física antes de considerarla desconectada
const BASE_TIMEOUT_MS = 5000

// Bitácora continua en disco: cada evento que registra Control se agrega
// como una línea JSON a bitacoras/<sesion>.jsonl. Así, si el navegador se
// cierra o se cuelga a mitad de sesión, lo registrado hasta ese momento no
// se pierde (antes solo existía en memoria hasta exportar el CSV). Son datos
// de participantes: la carpeta está en .gitignore.
const DIR_BITACORAS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bitacoras')
let colaDisco = Promise.resolve()
function guardarEnDisco(sesion, registro) {
  const nombre = String(sesion || 'sin_sesion').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80)
  const linea = JSON.stringify({ tsBackend: Date.now(), ...registro }) + '\n'
  // En serie: las líneas quedan en el orden en que llegaron.
  colaDisco = colaDisco
    .then(() => mkdir(DIR_BITACORAS, { recursive: true }))
    .then(() => appendFile(path.join(DIR_BITACORAS, `${nombre}.jsonl`), linea, 'utf8'))
    .catch(err => console.error('No se pudo guardar la bitácora en disco:', err.message))
}

// Marcadores para el EEG por UDP (opcional, apagado por defecto). Si se
// define OPENBCI_MARCADORES=host:puerto (p. ej. el puerto UDP del widget de
// marcadores del OpenBCI GUI, si la versión instalada lo tiene), cada
// marcador se manda también como texto con su código numérico. La sincronización principal NO depende de esto: se hace
// después por la hora del reloj (columna Timestamp del archivo de OpenBCI),
// ver herramientas/sincronizar_eeg.py.
const destinoMarcadores = (() => {
  const v = process.env.OPENBCI_MARCADORES
  if (!v) return null
  const [host, puerto] = v.split(':')
  const port = Number(puerto)
  return host && port ? { host, port } : null
})()
const udpMarcadores = destinoMarcadores ? dgram.createSocket('udp4') : null
if (destinoMarcadores) console.log(`[EEG] Marcadores UDP -> ${destinoMarcadores.host}:${destinoMarcadores.port}`)

const app = express();
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*', // Permitir acceso desde cualquier origen
    methods: ['GET', 'POST']
  }
});

app.use(express.json())
app.use(logger('dev'))
app.use(cors())

// Cola de comandos pendientes para el maestro. Antes era un único objeto
// (cuboModificado) que se sobrescribía en cada emit — si el frontend
// mandaba varios comandos casi seguidos (p. ej. una señal a "todos los
// cubos"), los anteriores se perdían antes de que el maestro llegara a
// pedirlos. /api/obtenerComando ahora drena la cola completa en cada
// llamada, así que ningún comando se pierde por una ráfaga.
let comandoQueue = [];
let comandoGlobal = null;

let lastBaseSeen = 0;
let baseConnected = false;
let esclavosConectados = [];
// Telemetría de cada cubo (batería, señal WiFi, motivo del último reinicio,
// tiempo encendido), tal como la reenvía el maestro cada pocos segundos.
let telemetriaCubos = [];
// Último estado del tablero reportado por el maestro. Una pestaña que se
// conecta (o recarga) lo recibe de inmediato, en vez de suponer el orden
// inicial — antes de esto el frontend arrancaba siempre con [1..5,0,6..10]
// aunque los cubos estuvieran en desorden.
let ultimasPosiciones = null;

// se llama cada vez que la base física hace una petición a la API
function markBaseActivity() {
  lastBaseSeen = Date.now();
  if (!baseConnected) {
    baseConnected = true;
    io.emit('baseStatus', { connected: true });
    console.log('Base física conectada');
  }
}

setInterval(() => {
  if (baseConnected && Date.now() - lastBaseSeen > BASE_TIMEOUT_MS) {
    baseConnected = false;
    io.emit('baseStatus', { connected: false });
    console.log('Base física desconectada');
  }
}, 1000);

io.on("connection", (socket) => {
  socket.emit('baseStatus', { connected: baseConnected });
  socket.emit('esclavosConectados', { esclavos: esclavosConectados, telemetria: telemetriaCubos });
  if (ultimasPosiciones) socket.emit('actualizarPosiciones', { ...ultimasPosiciones, origen: 'cache' });

  // El frontend pide el estado vigente (al cargar): se le manda lo que haya
  // en caché y se le pide al maestro que lo reporte de nuevo, por si el
  // backend se reinició y la caché quedó vacía o vieja.
  socket.on("solicitarEstado", () => {
    // También el estado de conexión: el socket del frontend se conecta al
    // cargar la app, ANTES de que Control se monte (tras la pantalla de
    // perfiles), así que los avisos que llegan al conectar se perdían y
    // Control quedaba mostrando "Desconectado" con la base activa.
    socket.emit('baseStatus', { connected: baseConnected });
    socket.emit('esclavosConectados', { esclavos: esclavosConectados, telemetria: telemetriaCubos });
    if (ultimasPosiciones) socket.emit('actualizarPosiciones', { ...ultimasPosiciones, origen: 'cache' });
    comandoQueue.push({ mensaje: "reportarPosiciones" });
  });

  // Ronda de identificación real (cada cubo baja su pin de presencia por
  // turnos, ver Maestro_v3.ino/identificarCubos).
  socket.on("identificarCubos", () => {
    console.log("Identificación de cubos solicitada desde el front");
    comandoQueue.push({ mensaje: "identificar" });
  });

  socket.on("comandoCubo", (data) => {
    console.log("Cubo a modificar enviado desde el front:", data);
    comandoQueue.push(data);
  });

  socket.on("restaurarCubos", (data) => {
    console.log("Restaurar cubos solicitado desde el front:", data);
    comandoQueue.push({ mensaje: "restaurar" });
  });

  // Un evento de bitácora de Control → una línea en disco (y, si es un
  // marcador para el EEG y hay destino UDP configurado, también al OpenBCI GUI).
  socket.on("bitacoraEvento", (data) => {
    if (!data || typeof data !== 'object') return
    guardarEnDisco(data.sesion, data)
    if (udpMarcadores && data.marcador?.codigo != null) {
      udpMarcadores.send(Buffer.from(String(data.marcador.codigo)), destinoMarcadores.port, destinoMarcadores.host)
    }
  });

  socket.on("comandoGlobal", (data) => {
    console.log("Comando global recibido:", data);
    comandoGlobal = data;
  });
});


app.get('/', (req, res) => {
  markBaseActivity();
  res.send('<h1>Hola mundo!</h1>')
})


app.get("/api/obtenerComando", (req, res) => {
  markBaseActivity();
  // Drena toda la cola de una vez (Node es de un solo hilo: no hay
  // condición de carrera entre este drenado y los push() de comandoCubo).
  const comandos = comandoQueue;
  comandoQueue = [];
  res.json({ comandos });
});

app.get("/api/obtenerComandoGlobal", (req, res) => {
  markBaseActivity();
  if (comandoGlobal) {
    res.json(comandoGlobal);
    comandoGlobal = null;
  } else {
    res.json({ mensaje: "sin_comando" });
  }
});

app.post('/api/esclavosConectados', (req, res) => {
  markBaseActivity();
  const antes = esclavosConectados.join(',');
  esclavosConectados = req.body.esclavos ?? [];
  telemetriaCubos = Array.isArray(req.body.telemetria) ? req.body.telemetria : [];
  io.emit('esclavosConectados', { esclavos: esclavosConectados, telemetria: telemetriaCubos, tsBackend: Date.now() });
  // Este reporte llega cada pocos segundos: solo se anota cuando cambia.
  if (esclavosConectados.join(',') !== antes) console.log(`Esclavos conectados: [${esclavosConectados.join(',')}]`);
  res.status(200).json({ mensaje: 'OK' });
});

app.post('/api/posiciones', (req, res) => {
  markBaseActivity();
  // tsBackend: hora de llegada al backend. Con edadMs (cuánto esperó el
  // evento en el maestro) y rttMs (lo que tardó el POST anterior), el
  // frontend estima la latencia completa y la hora real de cada jugada.
  const posiciones = { ...req.body, tsBackend: Date.now() };
  console.log('Posiciones recibidas:')
  console.log(posiciones)
  if (Array.isArray(posiciones?.posiciones)) {
    ultimasPosiciones = { posiciones: posiciones.posiciones }
    if (Array.isArray(posiciones.presencia)) ultimasPosiciones.presencia = posiciones.presencia
  }

  io.emit('actualizarPosiciones', posiciones)

  res.status(200).json({ mensaje: 'Posiciones actualizadas' });

})


server.listen(port, () => {
  console.log('Servidor corriendo en el puerto: ', port)
  console.log(`Dirección del servidor -> localhost:${port}`)
})

// --- Auto-descubrimiento UDP para el ESP32 Maestro ---
function getLocalIP() {
  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

const udpServer = dgram.createSocket('udp4')

udpServer.on('message', (msg, rinfo) => {
  if (msg.toString().trim() === 'CUBOS_DISCOVER') {
    const myIP = getLocalIP()
    const reply = Buffer.from(`CUBOS_BACKEND:${myIP}`)
    udpServer.send(reply, rinfo.port, rinfo.address, () => {
      console.log(`[UDP] ESP32 en ${rinfo.address} descubrió este backend -> ${myIP}`)
    })
  }
})

udpServer.bind(4210, () => {
  console.log(`[UDP] Escuchando descubrimiento en puerto 4210 | IP: ${getLocalIP()}`)
})