const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const drawHistory = [];
const images = new Map();
const participants = new Map();
const cursors = new Map();

function broadcastParticipants() {
  io.emit('participants', Array.from(participants.entries()).map(([id, name]) => ({ id, name })));
}

function broadcastCursors() {
  io.emit('cursors', Array.from(cursors.values()));
}

io.on('connection', (socket) => {
  console.log('client connected', socket.id);

  socket.on('join', (name) => {
    const safeName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : '名無し';
    participants.set(socket.id, safeName);
    socket.emit('init', {
      history: drawHistory,
      images: Array.from(images.values()),
      participants: Array.from(participants.entries()).map(([id, name]) => ({ id, name })),
      cursors: Array.from(cursors.values()),
    });
    broadcastParticipants();
    broadcastCursors();
  });

  socket.on('draw', (data) => {
    drawHistory.push({ type: 'draw', payload: data });
    socket.broadcast.emit('draw', data);
  });

  socket.on('image', (data) => {
    images.set(data.id, data);
    io.emit('image', data);
  });

  socket.on('cursor', (data) => {
    const name = participants.get(socket.id) || '名無し';
    if (data && typeof data.x === 'number' && typeof data.y === 'number') {
      cursors.set(socket.id, { id: socket.id, name, x: data.x, y: data.y });
    } else {
      cursors.delete(socket.id);
    }
    socket.broadcast.emit('cursors', Array.from(cursors.values()));
  });

  socket.on('clear', () => {
    drawHistory.length = 0;
    images.clear();
    io.emit('clear');
  });

  socket.on('disconnect', () => {
    participants.delete(socket.id);
    cursors.delete(socket.id);
    broadcastParticipants();
    broadcastCursors();
    console.log('client disconnected', socket.id);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
