import type { GameAction, GameEngine, GameEvents, GameHandle } from "./types";

/**
 * Port de `references/started-games/03-claude-tetris/game.js`.
 *
 * Se conserva el núcleo clásico tal cual: tablero 10x20, las 7 piezas,
 * rotación horaria con wall kicks, ghost piece, soft y hard drop, puntuación
 * por líneas multiplicada por el nivel y aceleración de la caída cada 10
 * líneas. Los cambios son estructurales: el canvas llega por parámetro, todo
 * el estado vive en el closure de `mount`, el HUD y el fin de partida los
 * pinta React, y el loop se arranca y se para desde fuera.
 *
 * Fuera del port, por decisión de la SPEC 06: los cuatro modos de juego, los
 * cinco power-ups, las cuatro skins, el nivel inicial configurable y la tabla
 * de récords local. La pausa también: la lleva la plataforma, así que este
 * motor no escucha `P` ni `Escape`.
 */

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
/** Columna lateral del canvas: ahí va la vista previa de la pieza siguiente. */
const PANEL = 120;

const W = COLS * BLOCK + PANEL;
const H = ROWS * BLOCK;

/** Rejilla de 4x4 celdas donde cabe cualquier pieza, incluida la I. */
const PREVIEW_CELLS = 4;
/** Esquina de esa rejilla dentro del canvas: justo a la derecha del tablero. */
const PREVIEW_X = COLS * BLOCK + (PANEL - PREVIEW_CELLS * BLOCK) / 2;
const PREVIEW_Y = BLOCK;

/** Única paleta portada: la skin `retro` del original. */
const COLORS: readonly string[] = [
  "",
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - azul pálido
  "#ffb74d", // L - orange
];

/** Rejilla del tema oscuro del original: el marco CRT siempre es oscuro. */
const GRID_LINE = "#22222e";

/** Índice = valor de la celda en el tablero; 0 es vacío y no tiene forma. */
const PIECES: readonly (readonly (readonly number[])[])[] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

/** La partida empieza siempre aquí: el nivel inicial configurable queda fuera. */
const START_LEVEL = 1;

/**
 * Cada acción táctil escribe en la tecla que usaría el teclado, con una
 * excepción: el botón de bajar suelta la pieza de golpe. Pulsar una celda a
 * la vez en una pantalla táctil no es jugable, así que `down` va a `Space` y
 * el mando no lleva un botón de soltar aparte. El teclado no cambia: la
 * flecha abajo sigue siendo soft drop.
 */
const ACTION_KEYS: Partial<Record<GameAction, string>> = {
  left: "ArrowLeft",
  right: "ArrowRight",
  down: "Space",
  rotate: "ArrowUp",
};

const SCROLL_KEYS = [
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];

type Board = number[][];

type Piece = {
  shape: number[][];
  x: number;
  y: number;
};

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

/** Transposición + reverso: el giro horario del original, sin tablas SRS. */
function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  }
  return result;
}

function dropIntervalFor(lv: number): number {
  return Math.max(100, 1000 - (lv - 1) * 90);
}

function mount(canvas: HTMLCanvasElement, events: GameEvents): GameHandle {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = context;

  canvas.width = W;
  canvas.height = H;

  // ── Estado de la partida ────────────────────────────────────────────────────
  let board: Board = createBoard();
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0;
  let level = START_LEVEL;
  let dropAccum = 0;
  let dropInterval = dropIntervalFor(level);
  let gameOver = false;
  let gameOverEmitted = false;

  let lastScore = -1;
  let lastLevel = -1;

  function emitChanges() {
    if (score !== lastScore) {
      lastScore = score;
      events.onScore(score);
    }
    if (level !== lastLevel) {
      lastLevel = level;
      events.onLevel(level);
    }
  }

  function emitGameOver() {
    if (gameOverEmitted) return;
    gameOverEmitted = true;
    gameOver = true;
    emitChanges();
    events.onGameOver(score);
  }

  // ── Reglas ──────────────────────────────────────────────────────────────────

  /** Única primitiva de validación: fuera del tablero o encima de una celda. */
  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  /** Gira y, si no cabe, prueba a desplazarse: los wall kicks del original. */
  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) {
          board[current.y + r][current.x + c] = current.shape[r][c];
        }
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = START_LEVEL + Math.floor(lines / 10);
      dropInterval = dropIntervalFor(level);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) emitGameOver();
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  // ── Input ───────────────────────────────────────────────────────────────────

  /**
   * Las cinco acciones son de flanco: se ejecutan al pulsar. La repetición al
   * mantener la tecla la pone el navegador, igual que en el original.
   */
  function handleKey(code: string) {
    if (gameOver || paused) return;
    switch (code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
      default:
        return;
    }
    emitChanges();
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // Las flechas y el espacio solo dejan de desplazar la página mientras el
    // juego tiene el control: en pausa o tras el fin de partida el teclado
    // vuelve a ser del navegador, que es quien mueve el modal.
    if (SCROLL_KEYS.includes(e.code) && !gameOver && !paused) {
      e.preventDefault();
    }
    handleKey(e.code);
  };

  window.addEventListener("keydown", onKeyDown);

  // ── Dibujo ──────────────────────────────────────────────────────────────────

  /** El bloque de la skin `retro`: relleno plano con un brillo arriba. */
  function drawBlock(
    target: CanvasRenderingContext2D,
    px: number,
    py: number,
    colorIndex: number,
    size: number,
    alpha?: number,
  ) {
    if (!colorIndex) return;
    target.save();
    target.globalAlpha = alpha ?? 1;
    target.fillStyle = COLORS[colorIndex];
    target.fillRect(px + 1, py + 1, size - 2, size - 2);
    target.fillStyle = "rgba(255,255,255,0.12)";
    target.fillRect(px + 1, py + 1, size - 2, 4);
    target.restore();
  }

  function drawGrid() {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  /**
   * Vista previa de la pieza siguiente, centrada en su rejilla de 4x4.
   * En el original vivía en un canvas aparte; aquí es la columna lateral
   * del canvas principal, con el mismo `drawBlock` y el mismo tamaño de celda.
   */
  function drawNext() {
    const shape = next.shape;
    const offX = Math.floor((PREVIEW_CELLS - shape[0].length) / 2);
    const offY = Math.floor((PREVIEW_CELLS - shape.length) / 2);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        drawBlock(
          ctx,
          PREVIEW_X + (offX + c) * BLOCK,
          PREVIEW_Y + (offY + r) * BLOCK,
          shape[r][c],
          BLOCK,
        );
      }
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    // Tablero
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawBlock(ctx, c * BLOCK, r * BLOCK, board[r][c], BLOCK);
      }
    }

    // Ghost piece: dónde va a aterrizar la pieza actual
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        drawBlock(
          ctx,
          (current.x + c) * BLOCK,
          (gy + r) * BLOCK,
          current.shape[r][c],
          BLOCK,
          0.2,
        );
      }
    }

    // Pieza actual
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        drawBlock(
          ctx,
          (current.x + c) * BLOCK,
          (current.y + r) * BLOCK,
          current.shape[r][c],
          BLOCK,
        );
      }
    }

    drawNext();
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId = 0;
  let paused = false;
  let destroyed = false;

  function update(dt: number) {
    // Tras el fin de partida el motor deja de simular: el modal es de React.
    if (gameOver) return;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }

  function loop(ts: number) {
    // La pausa es una bandera que salta el `update`, no un `rAF` cancelado:
    // así `dt` nunca acumula el tiempo que ha durado la pausa.
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 100);
    lastTime = ts;
    if (!paused) {
      update(dt);
      emitChanges();
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = START_LEVEL;
    dropInterval = dropIntervalFor(level);
    dropAccum = 0;
    gameOver = false;
    gameOverEmitted = false;
    next = randomPiece();
    spawn();
  }

  initGame();
  emitChanges();
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
    },
    resume() {
      if (destroyed) return;
      paused = false;
    },
    restart() {
      if (destroyed) return;
      initGame();
      emitChanges();
      paused = false;
    },
    end() {
      if (destroyed) return;
      emitGameOver();
    },
    setInput(action, down) {
      // Acciones de flanco: el `false` solo cierra la pulsación.
      if (!down) return;
      const code = ACTION_KEYS[action];
      if (!code) return;
      handleKey(code);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}

export const tetrisEngine: GameEngine = {
  width: W, // 300 de tablero + 120 de columna lateral
  height: H,
  hasLives: false,
  actions: ["left", "right", "down", "rotate"],
  // Solo los controles del juego: la pausa la declara el reproductor, que es
  // quien la escucha.
  controls: [
    { keys: "← →", label: "MOVER" },
    { keys: "↓", label: "BAJAR" },
    { keys: "↑ / X", label: "ROTAR" },
    { keys: "ESPACIO", label: "SOLTAR" },
  ],
  mount,
};
