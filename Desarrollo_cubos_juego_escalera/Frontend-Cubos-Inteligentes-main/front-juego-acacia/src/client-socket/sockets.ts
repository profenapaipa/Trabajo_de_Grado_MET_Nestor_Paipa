import { io } from 'socket.io-client'

const PORT = 3000
const URL = `localhost:${PORT}`

const socket = io(URL);

// client-side
socket.on("connect", () => {
    console.log(socket.id); 
});

export default socket;