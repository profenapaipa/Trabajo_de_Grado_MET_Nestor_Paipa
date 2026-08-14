import express from 'express'
import logger from 'morgan';

import { Server } from 'socket.io'
import { createServer } from 'node:http'
import cors from 'cors'

const port = process.env.PORT ?? 3000

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

io.on("connection", (socket) => {
  socket.on("comandoCubo", (data) => {
    console.log("Cubo a modificar enviado desde el front:", data);
    //Se guarda el comando recibido en una variable temporal
    cuboModificado = data;
  });

  socket.on("restaurarCubos", (data) => {
    console.log("Restaurar cubos solicitado desde el front:", data);
    cubosRestaurados = data;
  });
});


app.get('/', (req, res) => {
  res.send('<h1>Hola mundo!</h1>')
})


app.get("/api/obtenerComando", (req, res) => {
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

app.post('/api/posiciones', (req, res) => {
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