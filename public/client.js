const canvas = document.getElementById('canvas');
const canvasWrap = document.querySelector('.canvas-wrap');
const ctx = canvas.getContext('2d');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');
const clearBtn = document.getElementById('clear');
const eraserBtn = document.getElementById('eraser');
const participantsEl = document.getElementById('participants');
const cursorLabel = document.getElementById('cursorLabel');
const remoteCursors = document.getElementById('remoteCursors');
const myNameEl = document.getElementById('myName');
const socket = io();

let mode = 'draw';
let drawing = false;
let lastPoint = null;
let touchCount = 0;
let userName = sessionStorage.getItem('myName') || '';
if (!userName) {
  userName = window.prompt('参加者名を入力してください', '名無しさん') || '名無しさん';
  sessionStorage.setItem('myName', userName);
}
myNameEl.textContent = userName;

function resizeCanvas() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const image = ctx.getImageData(0, 0, canvas.width || 1, canvas.height || 1);
  canvas.width = w;
  canvas.height = h;
  ctx.putImageData(image, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawLine(event) {
  const { from, to, color, size, mode } = event;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = size;
  if (mode === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function applyImage(data) {
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, data.x, data.y, data.w, data.h);
  };
  img.src = data.dataURL;
}

function updateParticipants(list) {
  participantsEl.innerHTML = '';
  list.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item.name;
    participantsEl.appendChild(li);
  });
}

function updateRemoteCursors(cursors) {
  remoteCursors.innerHTML = '';
  cursors.forEach((cursor) => {
    if (cursor.id === socket.id) return;
    const div = document.createElement('div');
    div.className = 'remote-cursor';
    div.style.left = `${cursor.x}px`;
    div.style.top = `${cursor.y}px`;
    div.textContent = cursor.name;
    remoteCursors.appendChild(div);
  });
}

function canvasToCanvasPosition(x, y) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: x * scaleX,
    y: y * scaleY,
    pageX: rect.left + x / scaleX,
    pageY: rect.top + y / scaleY
  };
}

function setCursorLabel(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  cursorLabel.style.left = `${x}px`;
  cursorLabel.style.top = `${y}px`;
  cursorLabel.style.display = 'block';
  cursorLabel.textContent = userName;
}

function hideCursorLabel() {
  cursorLabel.style.display = 'none';
}

function emitDraw(from, to) {
  const payload = { from, to, color: colorInput.value, size: Number(sizeInput.value), mode };
  drawLine(payload);
  socket.emit('draw', payload);
}

socket.on('connect', () => {
  socket.emit('join', userName);
});

socket.on('init', (payload) => {
  const { history, participants, cursors } = payload;
  if (Array.isArray(history)) {
    history.forEach((item) => {
      if (item.type === 'draw') drawLine(item.payload);
      if (item.type === 'image') applyImage(item.payload);
      if (item.type === 'clear') ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }
  if (Array.isArray(participants)) {
    updateParticipants(participants);
  }
  if (Array.isArray(cursors)) {
    updateRemoteCursors(cursors);
  }
});

socket.on('draw', drawLine);
socket.on('image', applyImage);
socket.on('clear', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
socket.on('participants', updateParticipants);
socket.on('cursors', updateRemoteCursors);

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') {
    touchCount += 1;
    if (touchCount > 1) {
      drawing = false;
      return;
    }
    e.preventDefault();
  }
  drawing = true;
  lastPoint = { x: e.offsetX, y: e.offsetY };
  setCursorLabel(e.clientX, e.clientY);
});

canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch') {
    touchCount = Math.max(0, touchCount - 1);
    if (touchCount > 0) return;
  }
  drawing = false;
  lastPoint = null;
  hideCursorLabel();
  socket.emit('cursor', null);
});

canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'touch') {
    touchCount = Math.max(0, touchCount - 1);
    if (touchCount > 0) return;
  }
  drawing = false;
  lastPoint = null;
  hideCursorLabel();
  socket.emit('cursor', null);
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' && touchCount > 1) {
    return;
  }
  if (drawing && lastPoint) {
    if (e.pointerType === 'touch') e.preventDefault();
    const point = { x: e.offsetX, y: e.offsetY };
    emitDraw(lastPoint, point);
    lastPoint = point;
  }
  if (e.pointerType === 'touch' && touchCount > 1) {
    return;
  }
  socket.emit('cursor', { x: e.offsetX, y: e.offsetY });
  setCursorLabel(e.clientX, e.clientY);
});

eraserBtn.addEventListener('click', () => {
  mode = mode === 'draw' ? 'erase' : 'draw';
  eraserBtn.classList.toggle('active', mode === 'erase');
  eraserBtn.textContent = mode === 'erase' ? 'ペン' : '消しゴム';
});

clearBtn.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit('clear');
});

window.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (!blob) continue;
      const dataURL = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(blob);
      });
      const w = canvas.width * 0.7;
      const h = canvas.height * 0.7;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      const payload = { dataURL, x, y, w, h };
      applyImage(payload);
      socket.emit('image', payload);
      break;
    }
  }
});
