const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');
const clearBtn = document.getElementById('clear');
const socket = io();

function resizeCanvas() {
  const imageData = ctx.getImageData(0, 0, canvas.width || 1, canvas.height || 1);
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.putImageData(imageData, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let drawing = false;
let lastPoint = null;

function drawLine({ from, to, color, size }) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

canvas.addEventListener('pointerdown', (e) => {
  drawing = true;
  lastPoint = { x: e.offsetX, y: e.offsetY };
});

canvas.addEventListener('pointerup', () => { drawing = false; lastPoint = null; });
canvas.addEventListener('pointerleave', () => { drawing = false; lastPoint = null; });

canvas.addEventListener('pointermove', (e) => {
  if (!drawing || !lastPoint) return;
  const newPoint = { x: e.offsetX, y: e.offsetY };
  const line = { from: lastPoint, to: newPoint, color: colorInput.value, size: Number(sizeInput.value) };
  drawLine(line);
  socket.emit('draw', line);
  lastPoint = newPoint;
});

socket.on('draw', drawLine);
clearBtn.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('clear');
});
socket.on('clear', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
