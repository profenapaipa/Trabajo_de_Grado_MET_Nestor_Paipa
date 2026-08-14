import express from 'express'
import logger from 'morgan';

import { Server } from 'socket.io'
import { createServer } from 'node:http'
import cors from 'cors'
import dgram from 'node:dgram'
import { networkInterfaces } from 'node:os'

const port = process.env.PORT ?? 3000
// tiempo máximo sin recibir peticiones de la base física antes de considerarla desconectada
const BASE_TIMEOUT_MS = 5000

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

let cuboModificado = null;
let cubosRestaurados = null;
let comandoGlobal = null;

let lastBaseSeen = 0;
let baseConnected = false;
let esclavosConectados = [];

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
  socket.emit('esclavosConectados', { esclavos: esclavosConectados });

  socket.on("comandoCubo", (data) => {
    console.log("Cubo a modificar enviado desde el front:", data);
    cuboModificado = data;
  });

  socket.on("restaurarCubos", (data) => {
    console.log("Restaurar cubos solicitado desde el front:", data);
    cubosRestaurados = data;
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
  if (cuboModificado) {
    res.json(cuboModificado);
    //el comando se borre una vez entregado
    cuboModificado = null;
  } else if (cubosRestaurados) {
    res.json(cubosRestaurados);
    cubosRestaurados = null;
  } else {
    res.json({ mensaje: "sin_comando" });
  }
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
  esclavosConectados = req.body.esclavos ?? [];
  io.emit('esclavosConectados', { esclavos: esclavosConectados });
  console.log(`Esclavos conectados: [${esclavosConectados.join(',')}]`);
  res.status(200).json({ mensaje: 'OK' });
});

app.post('/api/posiciones', (req, res) => {
  markBaseActivity();
  const posiciones = req.body;
  console.log('Posiciones recibidas:')
  console.log(posiciones)

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