import {
  FRUIT_NAMES,
  drawFruit,
  loadFruitSheet,
  type FruitName,
  type FruitSheet,
} from "./serpentina-sprites";
import type { GameAction, GameEngine, GameEvents, GameHandle } from "./types";

/**
 * Serpentina — la serpiente de los Nokia, escrita desde cero contra el
 * contrato `GameEngine`. A diferencia de Asteroides, Caída y Arkanoid aquí no
 * hay port: `references/started-games/` no trae ningún Snake y lo único que
 * aporta el material de partida es la lámina de frutas.
 *
 * Reglas, según la SPEC 08: rejilla de 24x24 sobre un canvas de 600x600, tres
 * vidas, muros mortales, +10 puntos y +1 segmento por fruta, nivel
 * `1 + floor(frutas / 5)` con tope en 9 y paso que baja 10 ms por nivel desde
 * 140 ms hasta un suelo de 60 ms.
 *
 * Fuera, por decisión de la misma spec: audio, obstáculos, récord local,
 * dificultad seleccionable, sprites para la serpiente y frutas que valgan
 * distinto según la especie. La pausa también la lleva la plataforma, así que
 * este motor no escucha `P` ni `Escape`.
 */

const CELLS = 24;
const CELL = 25;
const W = CELLS * CELL;
const H = CELLS * CELL;

/** Segmentos con los que nace la serpiente, al principio y en cada vida. */
const START_LENGTH = 4;

const LIVES_START = 3;

/** Milisegundos entre pasos en el nivel 1, y cuánto baja por cada nivel. */
const STEP_BASE = 140;
const STEP_PER_LEVEL = 10;
const STEP_FLOOR = 60;

/** Frutas que hacen falta para subir de nivel, y último nivel alcanzable. */
const FRUITS_PER_LEVEL = 5;
const MAX_LEVEL = 9;

const POINTS_PER_FRUIT = 10;

/** Tope de `dt` (ms): una pestaña en segundo plano no encadena pasos al volver. */
const MAX_DT = 100;

/** Giros que caben en la cola. Ver `enqueueTurn`. */
const TURN_QUEUE_MAX = 2;

const BACKGROUND = "#000";
const GRID_LINE = "#101820";
const SNAKE_BODY = "#39ff88";
const SNAKE_HEAD = "#c8ffdd";
const SNAKE_EDGE = "#0b3d24";

/**
 * Cada acción táctil escribe en la tecla que usaría el teclado: `setInput` y
 * el `keydown` entran por la misma puerta, así que no hay un segundo camino
 * de input que probar.
 */
const ACTION_KEYS: Partial<Record<GameAction, string>> = {
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
};

const SCROLL_KEYS = [
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];

type Cell = { x: number; y: number };
type Direction = { dx: number; dy: number };

const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
} satisfies Record<string, Direction>;

/** Paso del nivel, en milisegundos. Nunca por debajo del suelo. */
function stepFor(level: number): number {
  return Math.max(STEP_FLOOR, STEP_BASE - (level - 1) * STEP_PER_LEVEL);
}

/** El nivel se deduce de las frutas comidas y se estanca en `MAX_LEVEL`. */
function levelFor(eaten: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(eaten / FRUITS_PER_LEVEL));
}

function randomFruitName(): FruitName {
  return FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
}

function mount(canvas: HTMLCanvasElement, events: GameEvents): GameHandle {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = context;

  canvas.width = W;
  canvas.height = H;

  // ---- Estado de la partida ----
  /** Cabeza en el índice 0, cola al final. */
  let snake: Cell[] = [];
  let dir: Direction = DIRECTIONS.right;
  /** Giros pendientes: se consume uno por paso. Ver `enqueueTurn`. */
  let turns: Direction[] = [];
  let fruit: (Cell & { name: FruitName }) | null = null;
  let score = 0;
  let eaten = 0;
  let level = 1;
  let lives = LIVES_START;
  /** Segmentos que aún quedan por crecer: uno por fruta, uno por paso. */
  let pendingGrowth = 0;
  let stepAccum = 0;
  let gameOver = false;
  let gameOverEmitted = false;

  let sheet: FruitSheet = null;

  let lastScore = -1;
  let lastLevel = -1;
  let lastLives = -1;

  function emitChanges() {
    if (score !== lastScore) {
      lastScore = score;
      events.onScore(score);
    }
    if (level !== lastLevel) {
      lastLevel = level;
      events.onLevel(level);
    }
    if (lives !== lastLives) {
      lastLives = lives;
      events.onLives(lives);
    }
  }

  function emitGameOver() {
    if (gameOverEmitted) return;
    gameOverEmitted = true;
    gameOver = true;
    emitChanges();
    events.onGameOver(score);
  }

  // ---- Reglas ----

  function occupies(x: number, y: number): boolean {
    return snake.some((s) => s.x === x && s.y === y);
  }

  /**
   * Sortea sobre la lista de celdas libres, no por reintentos: con la rejilla
   * casi llena un sorteo ciego se volvería lento y aquí el coste es fijo.
   */
  function placeFruit() {
    const free: Cell[] = [];
    for (let y = 0; y < CELLS; y++) {
      for (let x = 0; x < CELLS; x++) {
        if (!occupies(x, y)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      fruit = null;
      return;
    }
    const spot = free[Math.floor(Math.random() * free.length)];
    fruit = { x: spot.x, y: spot.y, name: randomFruitName() };
  }

  /** Deja la serpiente en el centro mirando a la derecha. */
  function resetSnake() {
    const cy = Math.floor(CELLS / 2);
    const cx = Math.floor(CELLS / 2);
    snake = [];
    for (let i = 0; i < START_LENGTH; i++) snake.push({ x: cx - i, y: cy });
    dir = DIRECTIONS.right;
    turns = [];
    pendingGrowth = 0;
    stepAccum = 0;
  }

  /**
   * Los giros se encolan en vez de escribirse sobre `dir`. Sin la cola,
   * pulsar la flecha arriba y la izquierda dentro de un mismo paso invertiría
   * el rumbo 180º y la serpiente se mordería sola. Un giro que invierta la
   * dirección vigente —o la última encolada— se descarta aquí mismo.
   */
  function enqueueTurn(next: Direction) {
    if (turns.length >= TURN_QUEUE_MAX) return;
    const ref = turns.length > 0 ? turns[turns.length - 1] : dir;
    if (next.dx === -ref.dx && next.dy === -ref.dy) return;
    if (next.dx === ref.dx && next.dy === ref.dy) return;
    turns.push(next);
  }

  /** Una vida menos. La puntuación y el nivel se conservan. */
  function loseLife() {
    lives = Math.max(0, lives - 1);
    if (lives === 0) {
      emitGameOver();
      return;
    }
    resetSnake();
    placeFruit();
  }

  /** Un paso de rejilla: consume un giro, avanza, come o muere. */
  function advance() {
    const turn = turns.shift();
    if (turn) dir = turn;

    const head = snake[0];
    const nx = head.x + dir.dx;
    const ny = head.y + dir.dy;

    // Muros mortales: es la regla del Snake de Nokia y lo que hace que la
    // rejilla se estreche a medida que la serpiente crece.
    if (nx < 0 || nx >= CELLS || ny < 0 || ny >= CELLS) {
      loseLife();
      return;
    }

    // La cola libera su celda en este mismo paso, salvo que toque crecer: por
    // eso se compara contra el cuerpo sin el último segmento.
    const body = pendingGrowth > 0 ? snake : snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) {
      loseLife();
      return;
    }

    snake.unshift({ x: nx, y: ny });

    if (fruit && fruit.x === nx && fruit.y === ny) {
      score += POINTS_PER_FRUIT;
      eaten += 1;
      level = levelFor(eaten);
      pendingGrowth += 1;
      placeFruit();
    }

    if (pendingGrowth > 0) {
      pendingGrowth -= 1;
    } else {
      snake.pop();
    }
  }

  // ---- Input ----

  /** Los cuatro giros son de flanco: se ejecutan al pulsar. */
  function handleKey(code: string) {
    if (gameOver || paused) return;
    switch (code) {
      case "ArrowUp":
      case "KeyW":
        enqueueTurn(DIRECTIONS.up);
        break;
      case "ArrowDown":
      case "KeyS":
        enqueueTurn(DIRECTIONS.down);
        break;
      case "ArrowLeft":
      case "KeyA":
        enqueueTurn(DIRECTIONS.left);
        break;
      case "ArrowRight":
      case "KeyD":
        enqueueTurn(DIRECTIONS.right);
        break;
      default:
        break;
    }
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

  // ---- Dibujo ----

  function drawGrid() {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    for (let i = 1; i < CELLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(W, i * CELL + 0.5);
      ctx.stroke();
    }
  }

  /** La serpiente va con primitivas en verde neón: la lámina es solo fruta. */
  function drawSnake() {
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i];
      const px = seg.x * CELL;
      const py = seg.y * CELL;
      ctx.fillStyle = i === 0 ? SNAKE_HEAD : SNAKE_BODY;
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      ctx.strokeStyle = SNAKE_EDGE;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
    }
  }

  function draw() {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    if (fruit) {
      drawFruit(
        ctx,
        sheet,
        fruit.name,
        fruit.x * CELL + CELL / 2,
        fruit.y * CELL + CELL / 2,
        CELL,
      );
    }
    drawSnake();
  }

  // ---- Bucle ----
  let lastTime: number | null = null;
  let rafId = 0;
  let paused = false;
  let destroyed = false;

  function update(dt: number) {
    // Tras el fin de partida el motor deja de simular: el modal es de React.
    if (gameOver) return;
    stepAccum += dt;
    const stepMs = stepFor(level);
    if (stepAccum >= stepMs) {
      // Un solo paso por frame, y el sobrante se acota a un paso: ni una
      // pausa larga ni una pestaña en segundo plano encadenan una ráfaga.
      stepAccum = Math.min(stepAccum - stepMs, stepMs);
      advance();
    }
  }

  function loop(ts: number) {
    // La pausa es una bandera que salta el `update`, no un `rAF` cancelado:
    // así `dt` nunca acumula el tiempo que ha durado la pausa.
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    if (!paused) {
      update(dt);
      emitChanges();
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function initGame() {
    score = 0;
    eaten = 0;
    level = 1;
    lives = LIVES_START;
    gameOver = false;
    gameOverEmitted = false;
    resetSnake();
    placeFruit();
  }

  // ---- Arranque ----
  window.addEventListener("keydown", onKeyDown);

  // La lámina llega cuando llega: hasta entonces la fruta es un cuadro liso.
  void loadFruitSheet().then((img) => {
    if (destroyed) return;
    sheet = img;
  });

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
      // Giros de flanco: el `false` solo cierra la pulsación.
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

export const serpentinaEngine: GameEngine = {
  width: W,
  height: H,
  hasLives: true,
  // El orden manda el de la cruceta táctil: `TouchPad` respeta este array.
  actions: ["left", "up", "down", "right"],
  // Solo los controles del juego: la pausa la declara el reproductor, que es
  // quien la escucha.
  controls: [{ keys: "← ↑ ↓ →", label: "GIRAR" }],
  mount,
};
