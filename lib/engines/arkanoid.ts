import {
  drawFrame,
  drawSprite,
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  loadSpritesheet,
  SPRITES,
  type BrickColor,
  type SpriteFrame,
  type Spritesheet,
} from "./arkanoid-sprites";
import type { GameEngine, GameEvents, GameHandle, SkinId } from "./types";

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
// cae nada. Los colores de la cápsula ya no viven aquí: son de la skin.
type PowerupType = "life" | "long" | "multi" | "laser" | "skip";

type PowerupDef = {
  letter: string;
  chance: number;
};

const POWERUPS: Record<PowerupType, PowerupDef> = {
  life: { letter: "V", chance: 0.005 },
  long: { letter: "B", chance: 0.02 },
  multi: { letter: "M", chance: 0.02 },
  laser: { letter: "L", chance: 0.02 },
  skip: { letter: "P", chance: 0.001 },
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

// ---- Skins ----
/**
 * Una skin es solo paleta y forma de dibujo. No toca geometría, hitboxes,
 * tiempos ni puntuación: la partida se juega igual con las tres.
 *
 * El color de este juego vive dentro del PNG, así que teñir es lo caro: se
 * hace **una vez por skin** sobre una lámina fuera de pantalla (`tintSheet`) y
 * el resultado se cachea. En el frame solo se dibuja.
 */
type ArkanoidSkin = {
  /** Fondo del canvas, o `null` para dejarlo transparente (marco CRT detrás). */
  fondo: string | null;
  /** Rejilla decorativa de fondo, o `null`. No marca ninguna unidad de juego. */
  rejilla: string | null;
  /** Tinte por color de bloque, o `null` para usar la lámina tal cual. */
  tinte: Record<BrickColor, string> | null;
  /** Tinte de la barra y de la bola; `null` = sin teñir. */
  paddle: string | null;
  bola: string | null;
  /** Radio del halo. `0` en las paletas planas. */
  glow: number;
  powerup: Record<PowerupType, { color: string; text: string }>;
  powerupBorde: string;
};

const SKINS: Record<SkinId, ArkanoidSkin> = {
  // La lámina original sin teñir y las cápsulas del port, byte a byte.
  clasico: {
    fondo: null,
    rejilla: null,
    tinte: null,
    paddle: null,
    bola: null,
    glow: 0,
    powerup: {
      life: { color: "#ff5fa8", text: "#3a0018" },
      long: { color: "#12246b", text: "#dfe6ff" },
      multi: { color: "#6fd4ff", text: "#04303f" },
      laser: { color: "#9aa0a6", text: "#1a1c1e" },
      skip: { color: "#ffd21e", text: "#3a2c00" },
    },
    powerupBorde: "rgba(255, 255, 255, 0.85)",
  },
  // Fósforo ámbar: un solo tono y la lectura la da el brillo, no el matiz.
  retro: {
    fondo: "#0d0a04",
    rejilla: null,
    tinte: {
      red: "#ffb000",
      hotpink: "#ffc46b",
      magenta: "#ffd9a0",
      yellow: "#ffe9c4",
      green: "#c98a00",
      cyan: "#9a6600",
      gray: "#6f5a2e",
    },
    paddle: "#ffe9c4",
    bola: "#ffd28a",
    glow: 0,
    powerup: {
      life: { color: "#ffe9c4", text: "#3a2400" },
      long: { color: "#c98a00", text: "#ffe9c4" },
      multi: { color: "#ffb000", text: "#2a1c00" },
      laser: { color: "#8a6a1e", text: "#ffe9c4" },
      skip: { color: "#ffd28a", text: "#3a2400" },
    },
    powerupBorde: "rgba(255, 233, 196, 0.85)",
  },
  // Saturado sobre fondo casi negro, con halo y rejilla tenue.
  neon: {
    fondo: "#04040c",
    rejilla: "rgba(0, 245, 255, 0.08)",
    tinte: {
      red: "#ff006e",
      hotpink: "#ff4da6",
      magenta: "#b026ff",
      yellow: "#f5ff00",
      green: "#00ff88",
      cyan: "#00f5ff",
      gray: "#7a8cff",
    },
    paddle: "#00f5ff",
    bola: "#f5ff00",
    glow: 8,
    powerup: {
      life: { color: "#ff006e", text: "#20000c" },
      long: { color: "#00f5ff", text: "#001418" },
      multi: { color: "#00ff88", text: "#00180d" },
      laser: { color: "#b026ff", text: "#15002a" },
      skip: { color: "#f5ff00", text: "#1a1c00" },
    },
    powerupBorde: "rgba(255, 255, 255, 0.9)",
  },
};

/** Separación de la rejilla decorativa de `neon`, en px. */
const GRID_STEP = 40;

/** Margen del halo horneado en los mosaicos de bloque. Solo visual. */
const GLOW_PAD = 6;

/** Lámina teñida y mosaicos de bloque ya listos, cacheados por skin. */
type SkinAssets = {
  sheet: Spritesheet;
  /** Un mosaico por color con el halo horneado, o `null` sin halo. */
  tiles: Record<BrickColor, HTMLCanvasElement> | null;
};

/** Tamaño de la lámina: llega como canvas offscreen o como imagen. */
function sheetSize(img: CanvasImageSource): { w: number; h: number } {
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height };
  if (img instanceof HTMLImageElement)
    return { w: img.naturalWidth, h: img.naturalHeight };
  return { w: 0, h: 0 };
}

/**
 * Tiñe un recorte de la lámina al color pedido conservando el relieve del
 * sprite: primero lo pasa a gris (`saturation`), luego lo multiplica por el
 * color —así el color es el techo de luz y las sombras siguen siendo sombras—
 * y por último recupera la máscara de transparencia con `destination-in`.
 */
function tintRegion(
  o: CanvasRenderingContext2D,
  src: CanvasImageSource,
  f: SpriteFrame,
  color: string,
) {
  o.save();
  o.beginPath();
  o.rect(f.sx, f.sy, f.sw, f.sh);
  o.clip();

  o.globalCompositeOperation = "saturation";
  o.fillStyle = "#808080";
  o.fillRect(f.sx, f.sy, f.sw, f.sh);

  o.globalCompositeOperation = "multiply";
  o.fillStyle = color;
  o.fillRect(f.sx, f.sy, f.sw, f.sh);

  o.globalCompositeOperation = "destination-in";
  o.drawImage(src, f.sx, f.sy, f.sw, f.sh, f.sx, f.sy, f.sw, f.sh);

  o.restore();
}

/** Copia de la lámina con bloques, explosiones, barra y bola ya teñidos. */
function tintSheet(src: CanvasImageSource, skin: ArkanoidSkin): Spritesheet {
  const { w, h } = sheetSize(src);
  if (!w || !h) return null;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const o = off.getContext("2d");
  if (!o) return null;
  o.drawImage(src, 0, 0);

  if (skin.tinte) {
    for (const key of Object.keys(skin.tinte) as BrickColor[]) {
      const color = skin.tinte[key];
      tintRegion(o, src, SPRITES.blocks[key], color);
      // El gris comparte recortes de explosión con el rojo: teñirlos otra vez
      // pisaría los del rojo, así que se queda con la animación roja teñida.
      if (key === "gray") continue;
      for (const f of EXPLOSION_FRAMES[key]) tintRegion(o, src, f, color);
    }
  }
  if (skin.paddle) tintRegion(o, src, SPRITES.paddle, skin.paddle);
  if (skin.bola) tintRegion(o, src, SPRITES.ball, skin.bola);

  return off;
}

/**
 * Hornea un mosaico por color de bloque, ya escalado a BRICK_W×BRICK_H y con
 * el halo dibujado alrededor. Se paga una vez por skin; en el frame el bloque
 * es un solo `drawImage` sin `shadow*`, que es lo que salva los fps.
 */
function buildGlowTiles(
  sheet: CanvasImageSource,
  skin: ArkanoidSkin,
): Record<BrickColor, HTMLCanvasElement> | null {
  if (skin.glow <= 0 || !skin.tinte) return null;
  const tiles = {} as Record<BrickColor, HTMLCanvasElement>;

  for (const key of Object.keys(skin.tinte) as BrickColor[]) {
    const tile = document.createElement("canvas");
    tile.width = BRICK_W + GLOW_PAD * 2;
    tile.height = BRICK_H + GLOW_PAD * 2;
    const t = tile.getContext("2d");
    if (!t) return null;
    const f = SPRITES.blocks[key];
    t.shadowBlur = skin.glow;
    t.shadowColor = skin.tinte[key];
    t.drawImage(
      sheet,
      f.sx,
      f.sy,
      f.sw,
      f.sh,
      GLOW_PAD,
      GLOW_PAD,
      BRICK_W,
      BRICK_H,
    );
    tiles[key] = tile;
  }
  return tiles;
}

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

  // ---- Skin activa ----
  // Solo la consulta el dibujado; nada del estado de juego la mira.
  let skinId: SkinId = "clasico";
  let skin: ArkanoidSkin = SKINS.clasico;

  /** Lámina teñida y mosaicos por skin. Se construyen la primera vez que hacen falta. */
  const assets = new Map<SkinId, SkinAssets>();

  /**
   * Material de dibujo de la skin activa. Con la lámina aún sin cargar, o con
   * `clasico`, no hay nada que teñir: se usa la lámina cruda.
   */
  function skinAssets(): SkinAssets {
    if (!sheet || (!skin.tinte && !skin.paddle && !skin.bola)) {
      return { sheet, tiles: null };
    }
    const cached = assets.get(skinId);
    if (cached) return cached;

    const tinted = tintSheet(sheet, skin) ?? sheet;
    const built: SkinAssets = {
      sheet: tinted,
      tiles: buildGlowTiles(tinted, skin),
    };
    assets.set(skinId, built);
    return built;
  }

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
      const paint = skin.powerup[p.type];
      const cx = p.x + r,
        cy = p.y + r;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = paint.color;
      applyGlow(paint.color);
      ctx.fill();
      ctx.strokeStyle = skin.powerupBorde;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = paint.text;
      ctx.fillText(def.letter, cx, cy + 1);
    }
    ctx.restore();
  }

  /** Halo de la skin `neon`. En las paletas planas no hace nada. */
  function applyGlow(color: string) {
    if (skin.glow <= 0) return;
    ctx.shadowBlur = skin.glow;
    ctx.shadowColor = color;
  }

  /** Rejilla decorativa de fondo. No marca casillas ni alinea nada del juego. */
  function drawGrid() {
    if (!skin.rejilla) return;
    ctx.save();
    ctx.strokeStyle = skin.rejilla;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = GRID_STEP; x < W; x += GRID_STEP) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = GRID_STEP; y < H; y += GRID_STEP) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- Render ----
  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (skin.fondo) {
      ctx.fillStyle = skin.fondo;
      ctx.fillRect(0, 0, W, H);
    }
    drawGrid();

    const art = skinAssets();

    for (const b of bricks) {
      if (!b.alive) continue;
      const tile = art.tiles?.[b.color];
      if (tile) {
        // El halo va horneado en el mosaico: un `drawImage` y ningún `shadow*`.
        ctx.drawImage(tile, b.x - GLOW_PAD, b.y - GLOW_PAD);
      } else {
        drawSprite(
          ctx,
          art.sheet,
          `block_${b.color}`,
          b.x,
          b.y,
          BRICK_W,
          BRICK_H,
        );
      }
    }

    drawExplosions(art.sheet);
    drawPowerups();

    // Barra y bolas son pocas: aquí el halo sí se aplica en vivo.
    ctx.save();
    if (skin.paddle) applyGlow(skin.paddle);
    drawSprite(
      ctx,
      art.sheet,
      "paddle",
      paddle.x,
      PADDLE_Y,
      paddle.w,
      PADDLE_H,
    );
    if (skin.bola) applyGlow(skin.bola);
    for (const b of balls) {
      drawSprite(ctx, art.sheet, "ball", b.x, b.y, BALL_SIZE, BALL_SIZE);
    }
    ctx.restore();
  }

  /**
   * Pinta las explosiones vivas y descarta las que ya han cumplido su duración.
   * Se mide contra el reloj interno, no contra `performance.now()`: en pausa la
   * animación se queda congelada en su fotograma.
   */
  function drawExplosions(art: Spritesheet) {
    const frameTime = EXPLOSION_DURATION / 4;

    explosions = explosions.filter(
      (e) => elapsed - e.start < EXPLOSION_DURATION,
    );

    for (const e of explosions) {
      const frames = EXPLOSION_FRAMES[e.color];
      if (!frames) continue;
      const i = Math.min(3, Math.floor((elapsed - e.start) / frameTime));
      drawFrame(ctx, art, frames[i], e.x, e.y, BRICK_W, BRICK_H);
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
    setSkin(id) {
      // Solo cambia la paleta. El teñido se hace una vez y queda cacheado.
      // Repinta ya mismo para que se vea aunque el loop esté en pausa o la
      // partida haya terminado.
      skinId = SKINS[id] ? id : "clasico";
      skin = SKINS[skinId];
      draw();
    },
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
  skins: ["clasico", "retro", "neon"],
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
