const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');
const clearBtn = document.getElementById('clear');
const eraserBtn = document.getElementById('eraser');
const imageModeBtn = document.getElementById('imageMode');
const participantsEl = document.getElementById('participants');
const cursorLabel = document.getElementById('cursorLabel');
const remoteCursors = document.getElementById('remoteCursors');
const myNameEl = document.getElementById('myName');
const socket = io();

let mode = 'draw';
let drawing = false;
let lastPoint = null;
let touchCount = 0;
let imageMode = false;
let imageDragId = null;
let dragOffset = { x: 0, y: 0 };
let pendingImage = null;
let userName = sessionStorage.getItem('myName') || '';
const drawHistory = [];
const imageMap = new Map();

if (!userName) {
  userName = window.prompt('参加者名を入力してください', '名無しさん') || '名無しさん';
  sessionStorage.setItem('myName', userName);
}
myNameEl.textContent = userName;

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;

function resizeCanvas() {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  renderAll();
}

window.addEventListener('resize', () => {
  renderAll();
});
resizeCanvas();

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

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

function renderAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawHistory.forEach((item) => {
    if (item.type === 'draw') drawLine(item.payload);
  });
  imageMap.forEach((imgData) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, imgData.x, imgData.y, imgData.w, imgData.h);
    };
    img.src = imgData.dataURL;
  });
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
  const rect = canvas.getBoundingClientRect();
  remoteCursors.innerHTML = '';
  cursors.forEach((cursor) => {
    if (cursor.id === socket.id) return;
    const div = document.createElement('div');
    div.className = 'remote-cursor';
    div.style.left = `${(cursor.x / canvas.width) * rect.width}px`;
    div.style.top = `${(cursor.y / canvas.height) * rect.height}px`;
    div.textContent = cursor.name;
    remoteCursors.appendChild(div);
  });
}

function setCursorLabel() {
  // Do not show local self cursor label to avoid clutter; remote labels are shown by remote cursor elements.
}

function hideCursorLabel() {
  cursorLabel.style.display = 'none';
}

function pushDraw(from, to) {
  const payload = { from, to, color: colorInput.value, size: Number(sizeInput.value), mode };
  drawHistory.push({ type: 'draw', payload });
  drawLine(payload);
  socket.emit('draw', payload);
}

function addOrUpdateImage(imgData, emit = true) {
  imageMap.set(imgData.id, imgData);
  renderAll();
  if (emit) socket.emit('image', imgData);
}

function findImageAt(x, y) {
  return [...imageMap.values()].reverse().find((img) => x >= img.x && x <= img.x + img.w && y >= img.y && y <= img.y + img.h);
}

socket.on('connect', () => {
  socket.emit('join', userName);
});

socket.on('init', (payload) => {
  const { history, participants, cursors, images } = payload;
  drawHistory.length = 0;
  imageMap.clear();
  if (Array.isArray(history)) {
    history.forEach((item) => {
      if (item.type === 'draw') drawHistory.push(item);
    });
  }
  if (Array.isArray(images)) {
    images.forEach((img) => imageMap.set(img.id, img));
  }
  renderAll();
  if (Array.isArray(participants)) updateParticipants(participants);
  if (Array.isArray(cursors)) updateRemoteCursors(cursors);
});

socket.on('draw', (payload) => {
  drawHistory.push({ type: 'draw', payload });
  drawLine(payload);
});

socket.on('image', (payload) => {
  imageMap.set(payload.id, payload);
  renderAll();
});

socket.on('clear', () => {
  drawHistory.length = 0;
  imageMap.clear();
  renderAll();
});

socket.on('participants', updateParticipants);
socket.on('cursors', updateRemoteCursors);

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && !e.isPrimary) return;

  const pos = getCanvasPoint(e);
  if (e.pointerType === 'touch') {
    e.preventDefault();
  }

  if (imageMode && pendingImage) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const w = canvas.width * 0.6;
    const h = (pendingImage.height / pendingImage.width) * w;
    addOrUpdateImage({ id, dataURL: pendingImage.dataURL, x: pos.x - w / 2, y: pos.y - h / 2, w, h });
    pendingImage = null;
    imageMode = false;
    imageModeBtn.classList.remove('active');
    imageModeBtn.textContent = '画像移動';
    return;
  }

  if (imageMode) {
    const img = findImageAt(pos.x, pos.y);
    if (img) {
      imageDragId = img.id;
      dragOffset = { x: pos.x - img.x, y: pos.y - img.y };
      return;
    }
  }

  drawing = true;
  lastPoint = pos;
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' && !e.isPrimary) return;
  const pos = getCanvasPoint(e);

  if (imageDragId) {
    const img = imageMap.get(imageDragId);
    if (img) {
      img.x = pos.x - dragOffset.x;
      img.y = pos.y - dragOffset.y;
      addOrUpdateImage(img);
    }
    return;
  }

  if (drawing && lastPoint) {
    pushDraw(lastPoint, pos);
    lastPoint = pos;
  }

  socket.emit('cursor', pos);
});

canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'touch' && !e.isPrimary) return;
  drawing = false;
  lastPoint = null;
  imageDragId = null;
  hideCursorLabel();
  socket.emit('cursor', null);
});

canvas.addEventListener('pointerleave', () => {
  drawing = false;
  lastPoint = null;
  imageDragId = null;
  hideCursorLabel();
  socket.emit('cursor', null);
});

eraserBtn.addEventListener('click', () => {
  mode = mode === 'draw' ? 'erase' : 'draw';
  eraserBtn.classList.toggle('active', mode === 'erase');
  eraserBtn.textContent = mode === 'erase' ? 'ペン' : '消しゴム';
});

imageModeBtn.addEventListener('click', () => {
  imageMode = !imageMode;
  imageModeBtn.classList.toggle('active', imageMode);
  imageModeBtn.textContent = imageMode ? '画像配置中...' : '画像移動';
});

clearBtn.addEventListener('click', () => {
  drawHistory.length = 0;
  imageMap.clear();
  renderAll();
  socket.emit('clear');
});

window.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (!blob) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const dataURL = reader.result;
        const img = new Image();
        img.onload = () => {
          pendingImage = { dataURL, width: img.width, height: img.height };
          imageMode = true;
          imageModeBtn.classList.add('active');
          imageModeBtn.textContent = '画像配置中...';
        };
        img.src = dataURL;
      };
      reader.readAsDataURL(blob);
      break;
    }
  }
});
