const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const drawHistory = [];
const participants = new Map();

function broadcastParticipants() {
  io.emit('participants', Array.from(participants.values()));
}

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  socket.on('join', (name) => {
    const safeName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : '名無し';
    participants.set(socket.id, safeName);
    socket.emit('init', { history: drawHistory, participants: Array.from(participants.values()) });
    broadcastParticipants();
  });

  socket.on('draw', (data) => {
    drawHistory.push({ type: 'draw', payload: data });
    socket.broadcast.emit('draw', data);
  });

  socket.on('image', (data) => {
    drawHistory.push({ type: 'image', payload: data });
    socket.broadcast.emit('image', data);
  });

  socket.on('clear', () => {
    drawHistory.length = 0;
    io.emit('clear');
  });

  socket.on('disconnect', () => {
    participants.delete(socket.id);
    broadcastParticipants();
    console.log('client disconnected', socket.id);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
