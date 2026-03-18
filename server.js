const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const drawHistory = [];

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  socket.emit('init', drawHistory);

  socket.on('draw', (data) => {
    drawHistory.push({ type: 'draw', payload: data });
    socket.broadcast.emit('draw', data);
  });

  socket.on('clear', () => {
    drawHistory.length = 0;
    io.emit('clear');
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
