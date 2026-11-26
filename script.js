
// =========================
// 基本設定
// =========================
const canvas = document.getElementById("pixelCanvas");
const ctx = canvas.getContext("2d");

const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const hotspotOverlay = document.getElementById("hotspotOverlay");
const hotspotCtx = hotspotOverlay.getContext("2d");

const GRID_SIZE = 32;
const CELL_SIZE = canvas.width / GRID_SIZE;

// 32×32のドットデータ（nullは透明）
let pixels = Array.from(
  { length: GRID_SIZE },
  () => Array(GRID_SIZE).fill(null)
);

let currentColor = "#2563eb";
let currentTool = "pen";
let isDrawing = false;
let previousCell = null;

let undoStack = [];
let redoStack = [];

// =========================
// 描画処理
// =========================
function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ドットを描画
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const color = pixels[y][x];

      if (color !== null) {
        ctx.fillStyle = color;
        ctx.fillRect(
          x * CELL_SIZE,
          y * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE
        );
      }
    }
  }

  // グリッド線を描画
  ctx.beginPath();
  ctx.strokeStyle = "#dce3ed";
  ctx.lineWidth = 0.5;

  for (let i = 0; i <= GRID_SIZE; i++) {
    const position = i * CELL_SIZE;

    ctx.moveTo(position, 0);
    ctx.lineTo(position, canvas.height);

    ctx.moveTo(0, position);
    ctx.lineTo(canvas.width, position);
  }

  ctx.stroke();

  drawPreview();

// =========================
// ホットスポット表示
// =========================
function drawHotspot() {
  const x = Math.max(
    0,
    Math.min(31, Number(document.getElementById("hotspotX").value) || 0)
  );

  const y = Math.max(
    0,
    Math.min(31, Number(document.getElementById("hotspotY").value) || 0)
  );

  const cellSize = canvas.width / GRID_SIZE;

  const centerX = (x + 0.5) * cellSize;
  const centerY = (y + 0.5) * cellSize;

  hotspotCtx.clearRect(
    0,
    0,
    hotspotOverlay.width,
    hotspotOverlay.height
  );

  // 十字マークの設定
  hotspotCtx.strokeStyle = "#ef4444";
  hotspotCtx.lineWidth = 2;
  hotspotCtx.lineCap = "round";

  // 横線
  hotspotCtx.beginPath();
  hotspotCtx.moveTo(centerX - 7, centerY);
  hotspotCtx.lineTo(centerX + 7, centerY);
  hotspotCtx.stroke();

  // 縦線
  hotspotCtx.beginPath();
  hotspotCtx.moveTo(centerX, centerY - 7);
  hotspotCtx.lineTo(centerX, centerY + 7);
  hotspotCtx.stroke();

  // 中心の円
  hotspotCtx.beginPath();
  hotspotCtx.arc(centerX, centerY, 3, 0, Math.PI * 2);
  hotspotCtx.stroke();
}

// =========================
// ホットスポット座標の変更
// =========================
document.getElementById("hotspotX").addEventListener("input", drawHotspot);
document.getElementById("hotspotY").addEventListener("input", drawHotspot);

  drawHotspot();
}

// =========================
// プレビュー更新
// =========================
function drawPreview() {
  const image = previewCtx.createImageData(
    GRID_SIZE,
    GRID_SIZE
  );

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const color = pixels[y][x];

      if (color === null) continue;

      const index = (y * GRID_SIZE + x) * 4;

      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      image.data[index] = r;
      image.data[index + 1] = g;
      image.data[index + 2] = b;
      image.data[index + 3] = 255;
    }
  }

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = GRID_SIZE;
  tempCanvas.height = GRID_SIZE;

  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.putImageData(image, 0, 0);

  previewCtx.clearRect(
    0,
    0,
    previewCanvas.width,
    previewCanvas.height
  );

  previewCtx.imageSmoothingEnabled = false;
  previewCtx.drawImage(
    tempCanvas,
    0,
    0,
    previewCanvas.width,
    previewCanvas.height
  );
}

// =========================
// 履歴管理
// =========================
function saveHistory() {
  undoStack.push(pixels.map(row => [...row]));

  if (undoStack.length > 50) {
    undoStack.shift();
  }

  redoStack = [];
}

function undo() {
  if (undoStack.length === 0) return;

  redoStack.push(pixels.map(row => [...row]));
  pixels = undoStack.pop();

  drawCanvas();
}

function redo() {
  if (redoStack.length === 0) return;

  undoStack.push(pixels.map(row => [...row]));
  pixels = redoStack.pop();

  drawCanvas();
}

// =========================
// セルの位置を取得
// =========================
function getCellPosition(event) {
  const rect = canvas.getBoundingClientRect();

  const x = Math.floor(
    ((event.clientX - rect.left) / rect.width) * GRID_SIZE
  );

  const y = Math.floor(
    ((event.clientY - rect.top) / rect.height) * GRID_SIZE
  );

  if (
    x < 0 || x >= GRID_SIZE ||
    y < 0 || y >= GRID_SIZE
  ) {
    return null;
  }

  return { x, y };
}

// =========================
// ドットを変更
// =========================
function paintCell(x, y) {
  if (currentTool === "pen") {
    pixels[y][x] = currentColor;
  } else if (currentTool === "eraser") {
    pixels[y][x] = null;
  }

  drawCanvas();
}

// =========================
// 塗りつぶし
// =========================
function fillArea(startX, startY) {
  const targetColor = pixels[startY][startX];

  if (targetColor === currentColor) return;

  const stack = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop();

    if (
      x < 0 || x >= GRID_SIZE ||
      y < 0 || y >= GRID_SIZE
    ) {
      continue;
    }

    if (pixels[y][x] !== targetColor) continue;

    pixels[y][x] = currentColor;

    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  drawCanvas();
}

// =========================
// マウス・タッチ操作
// =========================
canvas.addEventListener("pointerdown", event => {
  event.preventDefault();

  const cell = getCellPosition(event);
  if (!cell) return;

  saveHistory();

  if (currentTool === "fill") {
    fillArea(cell.x, cell.y);
    return;
  }

  isDrawing = true;
  previousCell = null;

  canvas.setPointerCapture(event.pointerId);

  paintCell(cell.x, cell.y);
  previousCell = cell;
});

canvas.addEventListener("pointermove", event => {
  if (!isDrawing) return;

  const cell = getCellPosition(event);
  if (!cell) {
    previousCell = null;
    return;
  }

  if (
    previousCell &&
    previousCell.x === cell.x &&
    previousCell.y === cell.y
  ) {
    return;
  }

  paintCell(cell.x, cell.y);
  previousCell = cell;
});

function stopDrawing() {
  isDrawing = false;
  previousCell = null;
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("lostpointercapture", stopDrawing);

// =========================
// ツール切り替え
// =========================
const toolButtons = {
  pen: document.getElementById("penTool"),
  eraser: document.getElementById("eraserTool"),
  fill: document.getElementById("fillTool")
};

Object.entries(toolButtons).forEach(([tool, button]) => {
  button.addEventListener("click", () => {
    currentTool = tool;

    Object.values(toolButtons).forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");
  });
});

// =========================
// カラー選択
// =========================
const colorPicker = document.getElementById("colorPicker");

colorPicker.addEventListener("input", event => {
  currentColor = event.target.value;
});

document.querySelectorAll("#palette button").forEach(button => {
  button.addEventListener("click", () => {
    currentColor = button.dataset.color;
    colorPicker.value = currentColor;
  });
});

// =========================
// 元に戻す・やり直す
// =========================
document
  .getElementById("undoButton")
  .addEventListener("click", undo);

document
  .getElementById("redoButton")
  .addEventListener("click", redo);

// =========================
// 全消去
// =========================
document
  .getElementById("clearButton")
  .addEventListener("click", () => {
    const hasDrawing = pixels.some(row =>
      row.some(color => color !== null)
    );

    if (!hasDrawing) return;

    saveHistory();

    pixels = Array.from(
      { length: GRID_SIZE },
      () => Array(GRID_SIZE).fill(null)
    );

    drawCanvas();
  });

// =========================
// PNG保存
// =========================
document
  .getElementById("pngButton")
  .addEventListener("click", () => {
    const exportCanvas = document.createElement("canvas");

    exportCanvas.width = GRID_SIZE;
    exportCanvas.height = GRID_SIZE;

    const exportCtx = exportCanvas.getContext("2d");
    const image = exportCtx.createImageData(
      GRID_SIZE,
      GRID_SIZE
    );

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const color = pixels[y][x];

        if (color === null) continue;

        const index = (y * GRID_SIZE + x) * 4;

        image.data[index] = parseInt(color.slice(1, 3), 16);
        image.data[index + 1] = parseInt(color.slice(3, 5), 16);
        image.data[index + 2] = parseInt(color.slice(5, 7), 16);
        image.data[index + 3] = 255;
      }
    }

    exportCtx.putImageData(image, 0, 0);

    const link = document.createElement("a");
    link.download = "my-pixel-cursor.png";
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  });

// =========================
// 初期表示
// =========================
drawCanvas();

// =========================
// CUR形式で保存
// =========================
document.getElementById("curButton").addEventListener("click", () => {
  const width = GRID_SIZE;
  const height = GRID_SIZE;

  // ホットスポットの取得
  const hotspotX = Math.max(
    0,
    Math.min(31, Number(document.getElementById("hotspotX").value) || 0)
  );

  const hotspotY = Math.max(
    0,
    Math.min(31, Number(document.getElementById("hotspotY").value) || 0)
  );

  // 32bitカラーの画像データと透明マスク
  const dibHeaderSize = 40;
  const xorSize = width * height * 4;
  const maskRowSize = Math.ceil(width / 32) * 4;
  const andSize = maskRowSize * height;
  const imageSize = dibHeaderSize + xorSize + andSize;

  // CURヘッダー + ディレクトリエントリ
  const headerSize = 6;
  const entrySize = 16;
  const imageOffset = headerSize + entrySize;

  const buffer = new ArrayBuffer(imageOffset + imageSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // CURファイルヘッダー
  view.setUint16(0, 0, true);
  view.setUint16(2, 2, true);
  view.setUint16(4, 1, true);

  // 画像ディレクトリエントリ
  bytes[6] = width;
  bytes[7] = height;
  bytes[8] = 0;
  bytes[9] = 0;

  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, imageSize, true);
  view.setUint32(18, imageOffset, true);

  // BITMAPINFOHEADER
  const dib = imageOffset;

  view.setUint32(dib, dibHeaderSize, true);
  view.setInt32(dib + 4, width, true);
  view.setInt32(dib + 8, height * 2, true);
  view.setUint16(dib + 12, 1, true);
  view.setUint16(dib + 14, 32, true);
  view.setUint32(dib + 16, 0, true);
  view.setUint32(dib + 20, xorSize + andSize, true);
  view.setInt32(dib + 24, 0, true);
  view.setInt32(dib + 28, 0, true);
  view.setUint32(dib + 32, 0, true);
  view.setUint32(dib + 36, 0, true);

  // XOR画像データ（下から上へ、BGRA形式）
  const xorStart = dib + dibHeaderSize;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = pixels[height - 1 - y][x];

      const index = xorStart + (y * width + x) * 4;

      if (color === null) {
        bytes[index] = 0;
        bytes[index + 1] = 0;
        bytes[index + 2] = 0;
        bytes[index + 3] = 0;
      } else {
        bytes[index] = parseInt(color.slice(5, 7), 16);
        bytes[index + 1] = parseInt(color.slice(3, 5), 16);
        bytes[index + 2] = parseInt(color.slice(1, 3), 16);
        bytes[index + 3] = 255;
      }
    }
  }

  // AND透明マスク（透明ピクセルを1にする）
  const maskStart = xorStart + xorSize;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = pixels[height - 1 - y][x];

      if (color === null) {
        const byteIndex =
          maskStart + y * maskRowSize + Math.floor(x / 8);

        bytes[byteIndex] |= 1 << (7 - (x % 8));
      }
    }
  }

  // ホットスポットを設定
view.setUint16(10, hotspotX, true);
view.setUint16(12, hotspotY, true);

  // CURファイルをダウンロード
  const blob = new Blob([buffer], {
    type: "application/octet-stream"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "my-pixel-cursor.cur";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
