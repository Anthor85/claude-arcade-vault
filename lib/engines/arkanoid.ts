import {
  drawFrame,
  drawSprite,
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  loadSpritesheet,
  type BrickColor,
  type Spritesheet,
} from "./arkanoid-sprites";
import type { GameEngine, GameEvents, GameHandle } from "./types";

/**
 * Port de `references/started-games/04-claude-arkanoid/game.js`.
 *
 * Se conserva el juego entero: cinco niveles, tres vidas, bloques grises de dos
 * golpes, aceleración de la bola cada diez bloques rotos, los cinco power-ups,
 * la multibola y el láser. Los cambios son estructurales: el canvas llega por
 * parámetro, todo el estado vive en el closure de `mount`, el HUD y los
 * overlays los pinta la plataforma, y el bucle no se detiene nunca: la pausa es
 * una bandera que salta el `update`.
 *
 * Fuera del port, por decisión de la SPEC 07: el audio entero (sonidos, pool,
 * volumen, mute y su `localStorage`) y el truco `LEVEL`. La pausa también: la
 * lleva el reproductor, así que este motor no escucha `P` ni `Escape`.
 */

// ---- Constantes de layout (px) ----
const W = 800,
  H = 600;
const COLS = 10,
  ROWS = 6;
const BRICK_W = 64,
  BRICK_H = 24;
const GRID_X = 80,
  GRID_Y = 60; // 80 + 10*64 = 720 -> margen 80 a cada lado
const PADDLE_W = 96,
  PADDLE_H = 16,
  PADDLE_Y = 560;
const BALL_SIZE = 12;
const PADDLE_SPEED = 520; // px/s con teclado
const BALL_SPEED_BASE = 300; // px/s
const BALL_SPEED_STEP = 20; // +20 px/s cada 10 bloques rotos
const BALL_SPEED_MAX = 520;
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180; // desde la vertical, en los bordes del paddle
const LIVES_START = 3;
const MAX_DT = 0.05; // s: acota el delta si la pestaña estuvo en segundo plano
const LAUNCH_ANGLE = (30 * Math.PI) / 180; // desde la vertical, al sacar
const PADDLE_W_LONG = PADDLE_W * 2; // ancho con el power-up de barra larga
const POWERUP_SIZE = 22; // diámetro de la cápsula, px
const POWERUP_SPEED = 150; // px/s de caída
const LASER_TIME = 15; // s que dura el láser
const MULTIBALL_ANGLE = (30 * Math.PI) / 180; // desviación de las dos bolas nuevas

// ---- Power-ups ----
// `chance` es la probabilidad por bloque destruido; los tramos son excluyentes
// (una sola tirada por bloque), así que suman 6,6 % y en el resto de casos no
// cae nada. `text` es el color de la letra sobre el círculo.
type PowerupType = "life" | "long" | "multi" | "laser" | "skip";

type PowerupDef = {
  letter: string;
  color: string;
  text: string;
  chance: number;
};

const POWERUPS: Record<PowerupType, PowerupDef> = {
  life: { letter: "V", color: "#ff5fa8", text: "#3a0018", chance: 0.005 },
  long: { letter: "B", color: "#12246b", text: "#dfe6ff", chance: 0.02 },
  multi: { letter: "M", color: "#6fd4ff", text: "#04303f", chance: 0.02 },
  laser: { letter: "L", color: "#9aa0a6", text: "#1a1c1e", chance: 0.02 },
  skip: { letter: "P", color: "#ffd21e", text: "#3a2c00", chance: 0.001 },
};

const POWERUP_ORDER: readonly PowerupType[] = [
  "life",
  "long",
  "multi",
  "laser",
  "skip",
];

// ---- Niveles ----
// Uno por elemento, una fila por línea, un carácter por bloque. Cada matriz
// tiene exactamente ROWS strings de COLS caracteres.
// r=red  p=hotpink  m=magenta  y=yellow  g=green  c=cyan  G=gris(2 golpes)  .=vacío
// La dificultad sube por forma y por número de grises: 4, 6, 8, 10, 14.
const LEVELS: readonly (readonly string[])[] = [
  [
    // 1 — filas completas. 4 grises.
    "rrrrGGrrrr",
    "pppppppppp",
    "mmmmmmmmmm",
    "yyyyGGyyyy",
    "gggggggggg",
    "cccccccccc",
  ],
  [
    // 2 — tablero de ajedrez. 6 grises.
    "r.r.G.r.r.",
    ".p.p.p.G.p",
    "m.G.m.m.m.",
    ".y.y.G.y.y",
    "g.g.G.g.g.",
    ".c.c.c.c.G",
  ],
  [
    // 3 — paraguas: copa roja y mango magenta. 8 grises.
    "...rGGr...",
    "..rrGGrr..",
    ".GrrrrrrG.",
    "....mm....",
    "....mm....",
    "..GGm.....",
  ],
  [
    // 4 — dos nubes cian con base gris. 10 grises.
    ".cc....cc.",
    "ccGc..cGcc",
    ".GG....GG.",
    "...cccc...",
    "..cccccc..",
    "...GGGG...",
  ],
  [
    // 5 — cara de Super Mario: gorra roja, ojos y bigote grises. 14 grises.
    "..rrrrrr..",
    ".rrrrrrrr.",
    ".yyGyyGyy.",
    ".yyyyyyyy.",
    ".GGGGGGGG.",
    "..yGGGGy..",
  ],
];
const LEVEL_COUNT = LEVELS.length;

/** Carácter del nivel -> clave de color en SPRITES.blocks / EXPLOSION_FRAMES. */
const CHAR_COLORS: Record<string, BrickColor | undefined> = {
  r: "red",
  p: "hotpink",
  m: "magenta",
  y: "yellow",
  g: "green",
  c: "cyan",
  G: "gray",
};

/** Puntuación por color. */
const SCORES: Record<BrickColor, number> = {
  red: 70,
  hotpink: 60,
  magenta: 50,
  yellow: 40,
  green: 30,
  cyan: 20,
  gray: 100,
};

// ---- Tipos de estado ----
/** `hits` = golpes restantes (1, o 2 en gris). */
type Brick = {
  x: number;
  y: number;
  color: BrickColor;
  hits: number;
  alive: boolean;
};

/** Con multibola hay más de una. `stuck` = pegada al paddle, esperando saque. */
type Ball = { x: number; y: number; vx: number; vy: number; stuck: boolean };

/** `x`,`y` = esquina superior izquierda de la cápsula. */
type Powerup = { x: number; y: number; type: PowerupType };

/** `start` = instante del reloj interno en que empezó. */
type Explosion = { x: number; y: number; color: BrickColor; start: number };

function mount(canvas: HTMLCanvasElement, events: GameEvents): GameHandle {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = context;

  canvas.width = W;
  canvas.height = H;

  /** Lámina de sprites; `null` hasta que carga, y también si la carga falla. */
  let sheet: Spritesheet = null;

  // ---- Estado ----
  let bricks: Brick[] = [];
  const paddle = { x: 0, w: PADDLE_W };
  let balls: Ball[] = [];
  let powerups: Powerup[] = [];
  let laserTime = 0; // s restantes de láser; 0 = inactivo
  let explosions: Explosion[] = [];
  let level = 1; // 1..LEVEL_COUNT; el acceso al array es LEVELS[level - 1]
  let score = 0,
    lives = LIVES_START,
    broken = 0;
  let gameOver = false;
  let gameOverEmitted = false;
  const keys = { left: false, right: false };

  /**
   * Reloj interno en milisegundos. Solo avanza dentro de `update`, así que las
   * explosiones se congelan con la pausa igual que el resto de la simulación.
   */
  let elapsed = 0;

  /** Posición horizontal pedida por el ratón, pendiente de aplicar. */
  let pointerX: number | null = null;

  let lastScore = -1,
    lastLives = -1,
    lastLevel = -1;

  function emitChanges() {
    if (score !== lastScore) {
      lastScore = score;
      events.onScore(score);
    }
    if (lives !== lastLives) {
      lastLives = lives;
      events.onLives(lives);
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

  // ---- Inicialización ----
  function init() {
    paddle.x = (W - PADDLE_W) / 2;
    paddle.w = PADDLE_W;

    score = 0;
    lives = LIVES_START;
    gameOver = false;
    gameOverEmitted = false;
    keys.left = false;
    keys.right = false;
    pointerX = null;
    elapsed = 0;

    loadLevel(1);
  }

  /**
   * Monta la rejilla del nivel n (1-indexado). No toca puntuación ni vidas:
   * cambiar de nivel conserva ambas. `broken` sí se reinicia, así que cada
   * nivel empieza a la velocidad base de la bola.
   */
  function loadLevel(n: number) {
    level = n;
    const grid = LEVELS[n - 1];

    bricks = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const ch = grid[row][col];
        const color = CHAR_COLORS[ch];
        // Punto o carácter desconocido: hueco en la rejilla.
        if (!color) continue;
        bricks.push({
          x: GRID_X + col * BRICK_W,
          y: GRID_Y + row * BRICK_H,
          color,
          hits: color === "gray" ? 2 : 1,
          alive: true,
        });
      }
    }

    explosions = [];
    powerups = [];
    clearPowerupEffects();
    broken = 0;
    resetBalls();
  }

  /** Deja una única bola pegada al centro del paddle, a la espera del saque. */
  function resetBalls() {
    balls = [
      {
        x: paddle.x + paddle.w / 2 - BALL_SIZE / 2,
        y: PADDLE_Y - BALL_SIZE,
        vx: 0,
        vy: 0,
        stuck: true,
      },
    ];
  }

  /**
   * Saca hacia arriba, con una desviación aleatoria dentro de LAUNCH_ANGLE,
   * todas las bolas pegadas al paddle (normalmente una sola).
   */
  function launchBall() {
    if (paused || gameOver) return;
    for (const b of balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      const angle = (Math.random() * 2 - 1) * LAUNCH_ANGLE;
      b.vx = Math.sin(angle) * BALL_SPEED_BASE;
      b.vy = -Math.cos(angle) * BALL_SPEED_BASE;
    }
  }

  // ---- Power-ups ----
  /**
   * Una sola tirada por bloque destruido, sobre los tramos acumulados de
   * POWERUP_ORDER: los tipos son excluyentes y en el 93,4 % de los casos no cae
   * nada. Multibola se descarta mientras haya más de una bola en juego (su
   * tramo pasa a ser "no cae nada"), para que las multibolas no se encadenen.
   */
  function spawnPowerup(brick: Brick) {
    let r = Math.random();
    for (const type of POWERUP_ORDER) {
      const p = POWERUPS[type];
      if (r < p.chance) {
        if (type === "multi" && balls.length > 1) return;
        powerups.push({
          x: brick.x + BRICK_W / 2 - POWERUP_SIZE / 2,
          y: brick.y + BRICK_H / 2 - POWERUP_SIZE / 2,
          type,
        });
        return;
      }
      r -= p.chance;
    }
  }

  /** Caída, recogida por contacto con el paddle y descarte al salir por abajo. */
  function updatePowerups(dt: number) {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += POWERUP_SPEED * dt;

      const caught =
        p.y + POWERUP_SIZE >= PADDLE_Y &&
        p.y <= PADDLE_Y + PADDLE_H &&
        p.x + POWERUP_SIZE >= paddle.x &&
        p.x <= paddle.x + paddle.w;

      if (caught) {
        powerups.splice(i, 1);
        applyPowerup(p.type);
      } else if (p.y > H) {
        powerups.splice(i, 1);
      }
    }
  }

  /**
   * Apaga los efectos con estado. Recoger cualquier power-up pasa por aquí, así
   * que como mucho hay uno activo a la vez.
   */
  function clearPowerupEffects() {
    paddle.w = PADDLE_W;
    laserTime = 0;
    clampPaddle();
  }

  function applyPowerup(type: PowerupType) {
    clearPowerupEffects();

    if (type === "life") {
      lives++;
    } else if (type === "long") {
      paddle.w = PADDLE_W_LONG;
      clampPaddle();
    } else if (type === "multi") {
      splitBall();
    } else if (type === "laser") {
      laserTime = LASER_TIME;
    } else if (type === "skip") {
      completeLevel();
    }
  }

  /**
   * Multibola: dos bolas más a ±MULTIBALL_ANGLE de la primera, con su mismo
   * módulo. Si la bola estaba pegada al paddle se saca primero, para no acabar
   * con tres bolas quietas encima.
   */
  function splitBall() {
    if (balls.length === 0) return;
    const src = balls[0];
    if (src.stuck) launchBall();

    const speed = Math.hypot(src.vx, src.vy) || currentSpeed();
    const base = Math.atan2(src.vy, src.vx);
    for (const delta of [-MULTIBALL_ANGLE, MULTIBALL_ANGLE]) {
      const a = base + delta;
      balls.push({
        x: src.x,
        y: src.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        stuck: false,
      });
    }
  }

  /** Cápsula: círculo del color del tipo con su letra centrada. */
  function drawPowerups() {
    const r = POWERUP_SIZE / 2;
    ctx.save();
    ctx.font =
      "bold " + Math.round(POWERUP_SIZE * 0.72) + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 2;

    for (const p of powerups) {
      const def = POWERUPS[p.type];
      const cx = p.x + r,
        cy = p.y + r;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.stroke();

      ctx.fillStyle = def.text;
      ctx.fillText(def.letter, cx, cy + 1);
    }
    ctx.restore();
  }

  // ---- Render ----
  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (const b of bricks) {
      if (!b.alive) continue;
      drawSprite(ctx, sheet, `block_${b.color}`, b.x, b.y, BRICK_W, BRICK_H);
    }

    drawExplosions();
    drawPowerups();

    drawSprite(ctx, sheet, "paddle", paddle.x, PADDLE_Y, paddle.w, PADDLE_H);
    for (const b of balls) {
      drawSprite(ctx, sheet, "ball", b.x, b.y, BALL_SIZE, BALL_SIZE);
    }
  }

  /**
   * Pinta las explosiones vivas y descarta las que ya han cumplido su duración.
   * Se mide contra el reloj interno, no contra `performance.now()`: en pausa la
   * animación se queda congelada en su fotograma.
   */
  function drawExplosions() {
    const frameTime = EXPLOSION_DURATION / 4;

    explosions = explosions.filter(
      (e) => elapsed - e.start < EXPLOSION_DURATION,
    );

    for (const e of explosions) {
      const frames = EXPLOSION_FRAMES[e.color];
      if (!frames) continue;
      const i = Math.min(3, Math.floor((elapsed - e.start) / frameTime));
      drawFrame(ctx, sheet, frames[i], e.x, e.y, BRICK_W, BRICK_H);
    }
  }

  // ---- Input ----
  function clampPaddle() {
    paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
  }

  /**
   * El canvas se dibuja a W×H internos y se muestra a otro tamaño, encajado con
   * `object-fit: contain`. Hay que deshacer la escala y la banda lateral para
   * saber qué punto del juego está bajo el cursor.
   */
  function toInnerX(clientX: number): number {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    if (!Number.isFinite(scale) || scale <= 0) return 0;
    return (clientX - rect.left - (rect.width - W * scale) / 2) / scale;
  }

  function onMouseMove(e: MouseEvent) {
    pointerX = toInnerX(e.clientX);
  }

  function onMouseDown() {
    launchBall();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      keys.left = true;
      e.preventDefault();
    }
    if (e.key === "ArrowRight") {
      keys.right = true;
      e.preventDefault();
    }
    if (e.code === "Space") {
      launchBall();
      e.preventDefault();
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
  }

  // ---- Velocidad de la bola ----
  /** Sube un escalón por cada 10 bloques rotos, con tope en BALL_SPEED_MAX. */
  function currentSpeed(): number {
    return Math.min(
      BALL_SPEED_BASE + Math.floor(broken / 10) * BALL_SPEED_STEP,
      BALL_SPEED_MAX,
    );
  }

  /** Reescala vx/vy de todas las bolas al módulo objetivo sin tocar la dirección. */
  function applySpeed() {
    const speed = currentSpeed();
    for (const b of balls) {
      const mag = Math.hypot(b.vx, b.vy);
      if (mag === 0) continue;
      b.vx = (b.vx / mag) * speed;
      b.vy = (b.vy / mag) * speed;
    }
  }

  // ---- Colisiones ----
  /** Rebote en el paddle: el ángulo de salida depende del punto de impacto. */
  function hitPaddle(ball: Ball) {
    // Solo cuando desciende.
    if (ball.vy <= 0) return;
    if (ball.y + BALL_SIZE < PADDLE_Y || ball.y > PADDLE_Y + PADDLE_H) return;
    if (ball.x + BALL_SIZE < paddle.x || ball.x > paddle.x + paddle.w) return;

    const ballCx = ball.x + BALL_SIZE / 2;
    const paddleCx = paddle.x + paddle.w / 2;
    const offset = Math.max(
      -1,
      Math.min(1, (ballCx - paddleCx) / (paddle.w / 2)),
    );
    const angle = offset * MAX_BOUNCE_ANGLE;
    const speed = Math.hypot(ball.vx, ball.vy);

    ball.vx = Math.sin(angle) * speed;
    ball.vy = -Math.cos(angle) * speed;
    // La despega para no encadenar rebotes.
    ball.y = PADDLE_Y - BALL_SIZE;
  }

  /**
   * Colisión bola-bloque: como mucho un impacto por frame. Con el láser activo
   * la bola no rebota ni se reposiciona, así que se recorren todos los bloques
   * que solape en este frame: si saliera al primero dejaría bloques vivos
   * detrás.
   */
  function hitBricks(ball: Ball) {
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + BALL_SIZE <= b.x || ball.x >= b.x + BRICK_W) continue;
      if (ball.y + BALL_SIZE <= b.y || ball.y >= b.y + BRICK_H) continue;

      if (laserTime > 0) {
        // El láser destruye de un golpe, también el gris.
        b.hits = 0;
      } else {
        // Se refleja el eje con menor solape: es el lado por el que ha entrado.
        const overlapX =
          Math.min(ball.x + BALL_SIZE, b.x + BRICK_W) - Math.max(ball.x, b.x);
        const overlapY =
          Math.min(ball.y + BALL_SIZE, b.y + BRICK_H) - Math.max(ball.y, b.y);

        if (overlapX < overlapY) {
          ball.vx = -ball.vx;
          ball.x += ball.vx > 0 ? overlapX : -overlapX;
        } else {
          ball.vy = -ball.vy;
          ball.y += ball.vy > 0 ? overlapY : -overlapY;
        }
        b.hits--;
      }

      // Si quedan golpes es un gris al primer impacto: rebotó pero no rompió.
      if (b.hits <= 0) {
        b.alive = false;
        score += SCORES[b.color];
        broken++;
        explosions.push({ x: b.x, y: b.y, color: b.color, start: elapsed });
        spawnPowerup(b);
        applySpeed();
        if (bricks.every((br) => !br.alive)) {
          completeLevel();
          return;
        }
      }
      if (laserTime <= 0) return;
    }
  }

  // ---- Fin de partida ----
  /**
   * Solo se llama cuando ha caído la última bola. Morir corta los power-ups: se
   * vacían las cápsulas en vuelo y se apagan barra larga y láser.
   */
  function loseLife() {
    lives = Math.max(0, lives - 1);
    powerups = [];
    clearPowerupEffects();
    if (lives === 0) {
      emitGameOver();
    } else {
      resetBalls();
    }
  }

  // ---- Progresión de nivel ----
  /**
   * Rejilla despejada. En el último nivel es la victoria, y la única vía de
   * abrir el modal de fin de partida, así que sale por aquí antes de tocar las
   * vidas. En el resto se suma una vida extra (sin tope) y se carga el nivel
   * siguiente en el acto, con la bola pegada al paddle: sin overlay que
   * anunciar, esperar un gesto sería un juego congelado sin explicación.
   */
  function completeLevel() {
    if (level >= LEVEL_COUNT) {
      emitGameOver();
      return;
    }
    lives++;
    loadLevel(level + 1);
  }

  // ---- Actualización ----
  function update(dt: number) {
    // Tras el fin de partida el motor deja de simular: el modal es de React.
    if (gameOver) return;

    elapsed += dt * 1000;

    // El ratón manda una sola vez por movimiento, así que no pisa al teclado.
    if (pointerX !== null) {
      paddle.x = pointerX - paddle.w / 2;
      pointerX = null;
      clampPaddle();
    }

    if (keys.left) paddle.x -= PADDLE_SPEED * dt;
    if (keys.right) paddle.x += PADDLE_SPEED * dt;
    if (keys.left || keys.right) clampPaddle();

    if (laserTime > 0) laserTime = Math.max(0, laserTime - dt);
    updatePowerups(dt);

    // Se itera hacia atrás porque las bolas que caen se eliminan del array.
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];

      if (ball.stuck) {
        ball.x = paddle.x + paddle.w / 2 - BALL_SIZE / 2;
        ball.y = PADDLE_Y - BALL_SIZE;
        continue;
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Paredes: izquierda, derecha y techo. La inferior no rebota.
      if (ball.x <= 0) {
        ball.x = 0;
        ball.vx = -ball.vx;
      } else if (ball.x + BALL_SIZE >= W) {
        ball.x = W - BALL_SIZE;
        ball.vx = -ball.vx;
      }
      if (ball.y <= 0) {
        ball.y = 0;
        ball.vy = -ball.vy;
      }

      hitPaddle(ball);
      hitBricks(ball);

      if (ball.y > H) balls.splice(i, 1);
    }

    // Con multibola solo se pierde vida cuando cae la última bola.
    if (balls.length === 0 && !gameOver) loseLife();
  }

  // ---- Bucle ----
  let lastTime: number | null = null;
  let rafId = 0;
  let paused = false;
  let destroyed = false;

  function loop(ts: number) {
    // La pausa es una bandera que salta el `update`, no un `rAF` cancelado:
    // así `dt` nunca acumula el tiempo que ha durado la pausa.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
    lastTime = ts;
    if (!paused) {
      update(dt);
      emitChanges();
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  // ---- Arranque ----
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);

  // La lámina llega cuando llega: hasta entonces el juego simula sobre negro.
  void loadSpritesheet().then((img) => {
    if (destroyed) return;
    sheet = img;
  });

  init();
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
      init();
      emitChanges();
      paused = false;
    },
    end() {
      if (destroyed) return;
      emitGameOver();
    },
    setInput(action, down) {
      // Las dos direcciones son estado mantenido; el saque es de flanco.
      if (action === "left") keys.left = down;
      else if (action === "right") keys.right = down;
      else if (action === "fire" && down) launchBall();
    },
    /** Este motor todavía no tiene skins: solo declara `clasico`. */
    setSkin() {},
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
    },
  };
}

export const arkanoidEngine: GameEngine = {
  width: W,
  height: H,
  skins: ["clasico"],
  hasLives: true,
  actions: ["left", "right", "fire"],
  // Solo los controles del juego: la pausa la declara el reproductor, que es
  // quien la escucha.
  controls: [
    { keys: "← →", label: "MOVER" },
    { keys: "RATÓN", label: "APUNTAR" },
    { keys: "ESPACIO / CLIC", label: "SACAR" },
  ],
  mount,
};
