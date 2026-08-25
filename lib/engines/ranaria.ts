import type {
  GameAction,
  GameEngine,
  GameEvents,
  GameHandle,
  SkinId,
} from "./types";

/**
 * Ranaria — un Frogger de rejilla escrito desde cero contra el contrato
 * `GameEngine`. Como en Serpentina, aquí no hay port: `references/started-games/`
 * no trae ningún Frogger y la lógica se escribe entera.
 *
 * Reglas, según la SPEC 11: rejilla de 16x14 celdas de 40 px sobre un canvas de
 * 640x600 —las 14 filas jugables más una franja inferior para el cronómetro—,
 * tres vidas, salto discreto de una celda con animación de 120 ms, cinco
 * carriles de carretera y seis de río, cinco nenúfares que cierran la ronda y
 * un cronómetro que empieza en 15 s y pierde uno por nivel con suelo en 8 s.
 *
 * Fuera, por decisión de la misma spec: sprites bitmap, audio, mosca bonus,
 * cocodrilo y rana acompañante. Las tres skins (`clasico`, `retro`, `neon`) las
 * añadió el subagente `skin-designer`. La pausa es de la plataforma, así que
 * este motor no escucha `P` ni `Escape`, y dentro del canvas no se pinta más HUD que el
 * cronómetro: puntuación, vidas y nivel son de React.
 */

// ---- Medidas del tablero ----

const COLS = 16;
const CELL = 40;
/** Filas jugables. La 14 es la franja del cronómetro, y no se juega. */
const BOARD_ROWS = 14;
const TIMER_H = CELL;
const W = COLS * CELL; // 640
const H = BOARD_ROWS * CELL + TIMER_H; // 600

// Filas, 0 = arriba.
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_MEDIAN = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

/**
 * Columna izquierda de la boca de cada nenúfar; cada boca ocupa dos columnas.
 * Lo que queda entre bocas (0, 3, 6, 9, 12, 15) es orilla, y aterrizar ahí mata.
 */
const GOAL_COLS = [1, 4, 7, 10, 13];

// ---- Reglas ----

const LIVES_START = 3;

/** Duración de la animación de salto, en segundos. */
const JUMP_TIME = 0.12;

/** Cronómetro del nivel 1, cuánto pierde por nivel y su suelo, en segundos. */
const TIMER_BASE = 15;
const TIMER_PER_LEVEL = 1;
const TIMER_FLOOR = 8;

/** Cada nivel multiplica todas las velocidades por esto. */
const SPEED_PER_LEVEL = 1.15;

/** Ciclo de las tortugas: segundos emergidas y segundos sumergidas. */
const TURTLE_UP = 3;
const TURTLE_DOWN = 1.5;
const TURTLE_CYCLE = TURTLE_UP + TURTLE_DOWN;

const POINTS_ROW = 10;
const POINTS_GOAL = 50;
const POINTS_TIME = 10;
const POINTS_ROUND = 200;

/** Tope de `dt` (s): una pestaña en segundo plano no encadena simulación. */
const MAX_DT = 0.05;

/** Holgura de la caja de choque de los vehículos: el roce de píxel no mata. */
const HIT_INSET = 6;

// ---- Skins ----
/**
 * Una skin es solo paleta. No toca geometría, hitboxes, tiempos ni puntuación:
 * la partida se juega igual con cualquiera de ellas.
 */
type RanariaSkin = {
  orilla: string;
  rio: string;
  /** Franja segura entre el río y la carretera. */
  mediana: string;
  asfalto: string;
  /** Línea discontinua entre carriles de carretera. */
  carril: string;
  nenufar: string;
  nenufarBorde: string;
  coche: string;
  camion: string;
  tronco: string;
  troncoBorde: string;
  tortuga: string;
  tortugaCaparazon: string;
  /** Tortuga a punto de sumergirse o ya sumergida. */
  tortugaHundida: string;
  rana: string;
  ranaBorde: string;
  ranaOjo: string;
  timerFondo: string;
  timerAlto: string;
  timerMedio: string;
  timerBajo: string;
  /** Rejilla decorativa sobre el tablero, o `null` si esta skin no la pinta. */
  rejilla: string | null;
  /** Radio del halo (`shadowBlur`). `0` = relleno plano, sin sombras. */
  glow: number;
};

/**
 * La única paleta de verdad: verde lima sobre asfalto negro y río azul oscuro,
 * en línea con el color `green` de la ficha del catálogo.
 */
const CLASICO: RanariaSkin = {
  orilla: "#123d1f",
  rio: "#06203f",
  mediana: "#1c5c2b",
  asfalto: "#111111",
  carril: "#e8e8e8",
  nenufar: "#1f7a3a",
  nenufarBorde: "#8bff6a",
  coche: "#ffd400",
  camion: "#ff5c3a",
  tronco: "#7a4a1e",
  troncoBorde: "#4a2b10",
  tortuga: "#2fbf71",
  tortugaCaparazon: "#166b3c",
  tortugaHundida: "#0b3a5c",
  rana: "#8bff3a",
  ranaBorde: "#2c5c12",
  ranaOjo: "#0b0b0b",
  timerFondo: "#0b0b0b",
  timerAlto: "#39ff88",
  timerMedio: "#ffc23a",
  timerBajo: "#ff3a3a",
  rejilla: null,
  glow: 0,
};

/**
 * Fósforo ámbar de CRT, el mismo tono de referencia que las skins `retro` del
 * resto del arcade (`#ffb000`). Un solo matiz: lo que separa un elemento de
 * otro es la luminosidad, no el color. La rana es lo más brillante de la
 * pantalla porque es lo que hay que seguir con la vista.
 */
const RETRO: RanariaSkin = {
  orilla: "#2a1d06",
  rio: "#0d0a04",
  mediana: "#4a3208",
  asfalto: "#1a1204",
  carril: "#ffe9c4",
  nenufar: "#4a3208",
  nenufarBorde: "#ffb000",
  coche: "#ffb000",
  camion: "#ffd28a",
  tronco: "#c98a00",
  troncoBorde: "#7a5200",
  tortuga: "#ffb000",
  tortugaCaparazon: "#c98a00",
  tortugaHundida: "#4a3208",
  rana: "#ffe9c4",
  ranaBorde: "#7a5200",
  ranaOjo: "#0d0a04",
  timerFondo: "#0d0a04",
  // El cronómetro se lee al revés que en color: cuanto menos queda, más brilla.
  timerAlto: "#c98a00",
  timerMedio: "#ffb000",
  timerBajo: "#ffe9c4",
  rejilla: null,
  glow: 0,
};

/**
 * Saturado sobre fondo casi negro, con los tokens del tema arcade de
 * `app/globals.css` para que el canvas hable el mismo idioma que el marco CRT.
 */
const NEON: RanariaSkin = {
  orilla: "#06120a",
  rio: "#040a1c",
  mediana: "#0a2a16",
  asfalto: "#04040c",
  carril: "#00f5ff",
  nenufar: "#052a1a",
  nenufarBorde: "#00ff88",
  coche: "#f5ff00",
  camion: "#ff006e",
  tronco: "#b026ff",
  troncoBorde: "#4a0a7a",
  tortuga: "#00f5ff",
  tortugaCaparazon: "#00666f",
  tortugaHundida: "#0a1630",
  rana: "#00ff88",
  ranaBorde: "#00331a",
  ranaOjo: "#04040c",
  timerFondo: "#04040c",
  timerAlto: "#00ff88",
  timerMedio: "#f5ff00",
  timerBajo: "#ff006e",
  rejilla: "rgba(0, 245, 255, 0.08)",
  glow: 8,
};

const SKINS: Record<SkinId, RanariaSkin> = {
  clasico: CLASICO,
  retro: RETRO,
  neon: NEON,
};

// ---- Entrada ----

/**
 * Cada acción táctil escribe en la tecla que usaría el teclado: `setInput` y el
 * `keydown` entran por la misma puerta, así que no hay un segundo camino de
 * input que probar.
 */
const ACTION_KEYS: Partial<Record<GameAction, string>> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

type Direction = "up" | "down" | "left" | "right";

const KEY_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

// ---- Carriles ----

type LaneKind = "car" | "truck" | "log" | "turtle";

/** Una entidad de carril: `x` es su borde izquierdo dentro de la pista. */
type Entity = {
  x: number;
  /** Fase inicial del ciclo de inmersión. Solo la miran las tortugas. */
  phase: number;
};

type Lane = {
  row: number;
  /** `1` hacia la derecha, `-1` hacia la izquierda. */
  dir: 1 | -1;
  /** Píxeles por segundo, ya escalados por el nivel. */
  speed: number;
  kind: LaneKind;
  /** Longitud de cada entidad, en celdas. */
  len: number;
  /**
   * Longitud de la pista, mayor que el canvas: lo que sobra por la derecha es
   * el hueco que hace que las entidades no formen una cinta continua.
   */
  trackLen: number;
  entities: Entity[];
};

/** Receta de un carril, antes de escalarla por el nivel y sembrar entidades. */
type LaneSpec = {
  row: number;
  dir: 1 | -1;
  /** Velocidad base en píxeles por segundo (nivel 1). */
  speed: number;
  kind: LaneKind;
  len: number;
  /** Hueco entre entidades, en celdas. Nunca menos de una. */
  gap: number;
  count: number;
};

/**
 * Los once carriles: cinco de carretera y seis de río, de sentido alterno.
 * `count * (len + gap) * CELL` es siempre mayor que el ancho del canvas más una
 * entidad, así que la pista da la vuelta sin solapar consigo misma.
 */
const LANE_SPECS: readonly LaneSpec[] = [
  // Río, de arriba abajo.
  { row: 1, dir: 1, speed: 105, kind: "log", len: 3, gap: 2, count: 4 },
  { row: 2, dir: -1, speed: 95, kind: "turtle", len: 2, gap: 3, count: 4 },
  { row: 3, dir: 1, speed: 140, kind: "log", len: 2, gap: 2, count: 5 },
  { row: 4, dir: 1, speed: 65, kind: "log", len: 4, gap: 3, count: 3 },
  { row: 5, dir: -1, speed: 110, kind: "turtle", len: 3, gap: 3, count: 4 },
  { row: 6, dir: 1, speed: 80, kind: "log", len: 3, gap: 2, count: 4 },
  // Carretera, de arriba abajo.
  { row: 8, dir: -1, speed: 200, kind: "car", len: 1, gap: 4, count: 4 },
  { row: 9, dir: 1, speed: 95, kind: "truck", len: 3, gap: 5, count: 3 },
  { row: 10, dir: -1, speed: 160, kind: "car", len: 1, gap: 2, count: 6 },
  { row: 11, dir: 1, speed: 130, kind: "truck", len: 2, gap: 4, count: 4 },
  { row: 12, dir: -1, speed: 100, kind: "car", len: 1, gap: 3, count: 5 },
];

function isRiverLane(lane: Lane): boolean {
  return lane.kind === "log" || lane.kind === "turtle";
}

/** Construye los once carriles del nivel, con las velocidades ya escaladas. */
function buildLanes(level: number): Lane[] {
  const factor = SPEED_PER_LEVEL ** (level - 1);
  return LANE_SPECS.map((spec) => {
    const spacing = (spec.len + spec.gap) * CELL;
    const trackLen = spacing * spec.count;
    const offset = Math.random() * spacing;
    const entities: Entity[] = [];
    for (let i = 0; i < spec.count; i++) {
      entities.push({
        x: (offset + i * spacing) % trackLen,
        // Cada grupo de tortugas nace con su inmersión desfasada de los demás.
        phase: Math.random() * TURTLE_CYCLE,
      });
    }
    return {
      row: spec.row,
      dir: spec.dir,
      speed: spec.speed * factor,
      kind: spec.kind,
      len: spec.len,
      trackLen,
      entities,
    };
  });
}

/** Segundos del cronómetro en este nivel, nunca por debajo del suelo. */
function timerFor(level: number): number {
  return Math.max(TIMER_FLOOR, TIMER_BASE - (level - 1) * TIMER_PER_LEVEL);
}

/** ¿Está sumergida esta tortuga ahora mismo? */
function isSubmerged(entity: Entity, elapsed: number): boolean {
  const t = (entity.phase + elapsed) % TURTLE_CYCLE;
  return t >= TURTLE_UP;
}

type Frog = {
  /** Borde izquierdo en píxeles: en el río no cae en celda entera. */
  x: number;
  row: number;
  /** Salto en curso, o `null` si la rana está posada. */
  jump: {
    fromX: number;
    fromRow: number;
    toX: number;
    toRow: number;
    t: number;
  } | null;
};

function mount(canvas: HTMLCanvasElement, events: GameEvents): GameHandle {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = context;

  canvas.width = W;
  canvas.height = H;

  // ---- Skin activa ----
  // Solo la consulta el dibujado; nada del estado de juego la mira.
  let skin: RanariaSkin = SKINS.clasico;

  // ---- Estado de la partida ----
  let lanes: Lane[] = [];
  let frog: Frog = { x: 0, row: ROW_START, jump: null };
  /** Nenúfares ocupados, uno por boca. */
  let goals: boolean[] = GOAL_COLS.map(() => false);
  let score = 0;
  let level = 1;
  let lives = LIVES_START;
  /** Fila más alta alcanzada en esta vida: la que decide el `+10`. */
  let bestRow = ROW_START;
  let timeLeft = TIMER_BASE;
  /** Reloj del ciclo de las tortugas, en segundos de partida. */
  let elapsed = 0;
  let gameOver = false;
  let gameOverEmitted = false;

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

  /** Deja la rana centrada en la orilla de salida y reinicia el cronómetro. */
  function resetFrog() {
    frog = { x: 7 * CELL, row: ROW_START, jump: null };
    bestRow = ROW_START;
    timeLeft = timerFor(level);
  }

  function startJump(dir: Direction) {
    // Mientras dura el salto no se acepta otra pulsación.
    if (gameOver || frog.jump) return;
    let toX = frog.x;
    let toRow = frog.row;
    if (dir === "up") toRow -= 1;
    else if (dir === "down") toRow += 1;
    else if (dir === "left") toX -= CELL;
    else toX += CELL;
    // Ni por los lados ni por debajo de la orilla de salida.
    if (toRow > ROW_START || toRow < ROW_GOALS) return;
    if (toX < 0 || toX > W - CELL) return;
    frog.jump = { fromX: frog.x, fromRow: frog.row, toX, toRow, t: 0 };
  }

  /** Columna sobre la que se posa la rana, redondeando su posición continua. */
  function frogCol(): number {
    return Math.round(frog.x / CELL);
  }

  /** Entidad del carril que pisa la rana, o `null` si no hay ninguna debajo. */
  function supportOf(lane: Lane): Entity | null {
    const center = frog.x + CELL / 2;
    for (const entity of lane.entities) {
      const left = entity.x;
      const right = entity.x + lane.len * CELL;
      if (center < left || center > right) continue;
      // Una tortuga sumergida no da apoyo: es agua.
      if (lane.kind === "turtle" && isSubmerged(entity, elapsed)) return null;
      return entity;
    }
    return null;
  }

  /** ¿Toca la rana algún vehículo de este carril? */
  function hitsVehicle(lane: Lane): boolean {
    const left = frog.x + HIT_INSET;
    const right = frog.x + CELL - HIT_INSET;
    for (const entity of lane.entities) {
      if (right > entity.x && left < entity.x + lane.len * CELL) return true;
    }
    return false;
  }

  function laneAt(row: number): Lane | undefined {
    return lanes.find((lane) => lane.row === row);
  }

  function killFrog() {
    if (gameOver) return;
    lives -= 1;
    if (lives <= 0) {
      lives = 0;
      emitGameOver();
      return;
    }
    resetFrog();
  }

  function completeRound() {
    score += POINTS_ROUND;
    level += 1;
    goals = GOAL_COLS.map(() => false);
    lanes = buildLanes(level);
    resetFrog();
  }

  /** Resuelve el aterrizaje en la fila de nenúfares. */
  function resolveGoal() {
    const col = frogCol();
    const index = GOAL_COLS.findIndex(
      (start) => col === start || col === start + 1,
    );
    // La orilla entre bocas, y la boca ya ocupada, matan igual.
    if (index === -1 || goals[index]) {
      killFrog();
      return;
    }
    goals[index] = true;
    score += POINTS_GOAL + Math.floor(timeLeft) * POINTS_TIME;
    if (goals.every(Boolean)) {
      completeRound();
      return;
    }
    resetFrog();
  }

  /** Puntúa la fila recién alcanzada, si es la más alta de esta vida. */
  function scoreRow(row: number) {
    if (row >= bestRow) return;
    score += (bestRow - row) * POINTS_ROW;
    bestRow = row;
  }

  // ---- Simulación ----

  function moveEntities(dt: number) {
    for (const lane of lanes) {
      const step = lane.speed * lane.dir * dt;
      for (const entity of lane.entities) {
        entity.x += step;
        // La pista es circular: lo que sale por un borde entra por el opuesto.
        if (entity.x >= lane.trackLen) entity.x -= lane.trackLen;
        else if (entity.x < 0) entity.x += lane.trackLen;
      }
    }
  }

  function advanceJump(dt: number): boolean {
    const jump = frog.jump;
    if (!jump) return false;
    jump.t += dt;
    if (jump.t < JUMP_TIME) return true;
    frog.x = jump.toX;
    frog.row = jump.toRow;
    frog.jump = null;
    scoreRow(frog.row);
    if (frog.row === ROW_GOALS) resolveGoal();
    return false;
  }

  function update(dt: number) {
    // Tras el fin de partida el motor deja de simular: el modal es de React.
    if (gameOver) return;

    elapsed += dt;
    moveEntities(dt);

    // Mientras dura el salto la rana está en el aire: ni choca ni se ahoga.
    if (advanceJump(dt)) return;
    // Un aterrizaje puede haber matado o cerrado ronda: el resto espera al
    // siguiente frame para no resolver dos veces la misma celda.
    if (gameOver || frog.jump) return;

    const lane = laneAt(frog.row);
    if (lane && isRiverLane(lane)) {
      const support = supportOf(lane);
      if (!support) {
        killFrog();
        return;
      }
      // Arrastrada por el apoyo a su velocidad real.
      frog.x += lane.speed * lane.dir * dt;
      if (frog.x < 0 || frog.x > W - CELL) {
        killFrog();
        return;
      }
    } else if (lane) {
      if (hitsVehicle(lane)) {
        killFrog();
        return;
      }
    }

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      killFrog();
    }
  }

  // ---- Dibujo ----

  function rowY(row: number): number {
    return row * CELL;
  }

  /**
   * Enciende el halo de la skin activa. Se llama **una vez por elemento**, y
   * siempre dentro de un `save()`/`restore()`: una sombra por vértice hundiría
   * los fps sin aportar lectura.
   */
  function applyGlow(color: string) {
    if (!skin.glow) return;
    ctx.shadowBlur = skin.glow;
    ctx.shadowColor = color;
  }

  function drawBoard() {
    // Orilla de fondo: las zonas de agua y asfalto se pintan encima.
    ctx.fillStyle = skin.orilla;
    ctx.fillRect(0, 0, W, BOARD_ROWS * CELL);

    ctx.fillStyle = skin.rio;
    ctx.fillRect(
      0,
      rowY(ROW_RIVER_TOP),
      W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
    );

    // La mediana es orilla, pero de otro verde: se lee como zona de descanso.
    ctx.fillStyle = skin.mediana;
    ctx.fillRect(0, rowY(ROW_MEDIAN), W, CELL);

    ctx.fillStyle = skin.asfalto;
    ctx.fillRect(
      0,
      rowY(ROW_ROAD_TOP),
      W,
      (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
    );

    // Líneas discontinuas entre carriles de carretera.
    ctx.strokeStyle = skin.carril;
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
      ctx.beginPath();
      ctx.moveTo(0, rowY(row));
      ctx.lineTo(W, rowY(row));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Rejilla decorativa: usa el paso de celda que ya existe (40 px), así que
    // no marca ninguna casilla nueva ni cambia dónde cae nada.
    if (skin.rejilla) {
      ctx.strokeStyle = skin.rejilla;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let col = 1; col < COLS; col++) {
        ctx.moveTo(col * CELL, 0);
        ctx.lineTo(col * CELL, BOARD_ROWS * CELL);
      }
      for (let row = 1; row < BOARD_ROWS; row++) {
        ctx.moveTo(0, rowY(row));
        ctx.lineTo(W, rowY(row));
      }
      ctx.stroke();
    }
  }

  function drawGoals() {
    const y = rowY(ROW_GOALS);
    for (let i = 0; i < GOAL_COLS.length; i++) {
      const x = GOAL_COLS[i] * CELL;
      ctx.fillStyle = skin.nenufar;
      ctx.fillRect(x + 3, y + 6, CELL * 2 - 6, CELL - 12);
      ctx.save();
      applyGlow(skin.nenufarBorde);
      ctx.strokeStyle = skin.nenufarBorde;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 6, CELL * 2 - 6, CELL - 12);
      ctx.restore();
      // Silueta de la rana en el nenúfar ya ocupado.
      if (goals[i]) drawFrogShape(x + CELL / 2, y, 0.7);
    }
  }

  function drawEntity(lane: Lane, entity: Entity) {
    const y = rowY(lane.row);
    const w = lane.len * CELL;
    // La pista es más larga que el canvas: lo que cae fuera no se pinta.
    if (entity.x > W || entity.x + w < 0) return;

    if (lane.kind === "car" || lane.kind === "truck") {
      const body = lane.kind === "car" ? skin.coche : skin.camion;
      ctx.save();
      applyGlow(body);
      ctx.fillStyle = body;
      ctx.fillRect(entity.x + 2, y + 6, w - 4, CELL - 12);
      ctx.restore();
      // Morro: una muesca clara en el lado hacia el que avanza.
      ctx.fillStyle = skin.carril;
      const noseX = lane.dir === 1 ? entity.x + w - 8 : entity.x + 2;
      ctx.fillRect(noseX, y + 10, 6, CELL - 20);
      return;
    }

    if (lane.kind === "log") {
      ctx.fillStyle = skin.tronco;
      ctx.fillRect(entity.x, y + 5, w, CELL - 10);
      ctx.strokeStyle = skin.troncoBorde;
      ctx.lineWidth = 2;
      ctx.strokeRect(entity.x + 1, y + 6, w - 2, CELL - 12);
      // Vetas: una línea por celda de tronco.
      ctx.beginPath();
      for (let i = 1; i < lane.len; i++) {
        ctx.moveTo(entity.x + i * CELL, y + 7);
        ctx.lineTo(entity.x + i * CELL, y + CELL - 7);
      }
      ctx.stroke();
      return;
    }

    // Tortugas: un círculo por celda, apagadas cuando están sumergidas.
    const under = isSubmerged(entity, elapsed);
    for (let i = 0; i < lane.len; i++) {
      const cx = entity.x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      ctx.fillStyle = under ? skin.tortugaHundida : skin.tortuga;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      if (under) continue;
      ctx.fillStyle = skin.tortugaCaparazon;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL / 2 - 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** La rana, centrada en `cx` y con la fila que empieza en `y`. */
  function drawFrogShape(cx: number, y: number, scale: number) {
    const size = (CELL - 10) * scale;
    const half = size / 2;
    const cy = y + CELL / 2;
    ctx.save();
    applyGlow(skin.rana);
    ctx.fillStyle = skin.rana;
    ctx.strokeStyle = skin.ranaBorde;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - half, cy - half, size, size, 6 * scale);
    ctx.fill();
    ctx.stroke();
    // Patas: dos muñones a cada lado.
    ctx.fillRect(cx - half - 4 * scale, cy - half + 2, 4 * scale, size / 3);
    ctx.fillRect(cx + half, cy - half + 2, 4 * scale, size / 3);
    // Fuera el halo: los ojos son oscuros y su sombra solo ensuciaría la cara.
    ctx.restore();
    // Ojos.
    ctx.fillStyle = skin.ranaOjo;
    const eye = 3 * scale;
    ctx.fillRect(cx - half + 4 * scale, cy - half + 4 * scale, eye, eye);
    ctx.fillRect(cx + half - (4 + 3) * scale, cy - half + 4 * scale, eye, eye);
  }

  function drawFrog() {
    const jump = frog.jump;
    let x = frog.x;
    let y = rowY(frog.row);
    if (jump) {
      const k = Math.min(1, jump.t / JUMP_TIME);
      x = jump.fromX + (jump.toX - jump.fromX) * k;
      y = rowY(jump.fromRow) + (rowY(jump.toRow) - rowY(jump.fromRow)) * k;
    }
    // Un pelín más grande a media zancada: es todo el "salto" que hay.
    const scale = jump
      ? 1 + 0.25 * Math.sin(Math.PI * (jump.t / JUMP_TIME))
      : 1;
    drawFrogShape(x + CELL / 2, y, scale);
  }

  function drawTimer() {
    const y = BOARD_ROWS * CELL;
    ctx.fillStyle = skin.timerFondo;
    ctx.fillRect(0, y, W, TIMER_H);

    const total = timerFor(level);
    const ratio = Math.max(0, Math.min(1, timeLeft / total));
    const barra =
      ratio > 0.5
        ? skin.timerAlto
        : ratio > 0.25
          ? skin.timerMedio
          : skin.timerBajo;
    ctx.save();
    applyGlow(barra);
    ctx.fillStyle = barra;
    ctx.fillRect(8, y + 10, (W - 16) * ratio, TIMER_H - 20);
    ctx.restore();
    ctx.strokeStyle = skin.carril;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, y + 10, W - 16, TIMER_H - 20);
  }

  function draw() {
    drawBoard();
    drawGoals();
    for (const lane of lanes) {
      for (const entity of lane.entities) drawEntity(lane, entity);
    }
    drawFrog();
    drawTimer();
  }

  // ---- Entrada ----

  function handleKey(code: string) {
    const dir = KEY_DIRECTION[code];
    if (!dir || paused) return;
    startJump(dir);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // Las flechas solo dejan de desplazar la página mientras el juego tiene el
    // control: en pausa o tras el fin de partida el teclado vuelve a ser del
    // navegador, que es quien mueve el modal.
    if (SCROLL_KEYS.includes(e.code) && !gameOver && !paused) {
      e.preventDefault();
    }
    handleKey(e.code);
  };

  // ---- Bucle ----
  let lastTime: number | null = null;
  let rafId = 0;
  let paused = false;
  let destroyed = false;

  function loop(ts: number) {
    // La pausa es una bandera que salta el `update`, no un `rAF` cancelado: así
    // `dt` nunca acumula el tiempo que ha durado la pausa.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, MAX_DT);
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
    level = 1;
    lives = LIVES_START;
    gameOver = false;
    gameOverEmitted = false;
    elapsed = 0;
    goals = GOAL_COLS.map(() => false);
    lanes = buildLanes(level);
    resetFrog();
  }

  // ---- Arranque ----
  window.addEventListener("keydown", onKeyDown);

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
      // El salto es de flanco: el `false` solo cierra la pulsación.
      if (!down) return;
      const code = ACTION_KEYS[action];
      if (!code) return;
      handleKey(code);
    },
    setSkin(id) {
      // Solo cambia la paleta. Repinta ya mismo para que el cambio se vea
      // aunque el loop esté en pausa o la partida haya terminado.
      skin = SKINS[id] ?? SKINS.clasico;
      draw();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}

export const ranariaEngine: GameEngine = {
  width: W,
  height: H,
  skins: ["clasico", "retro", "neon"],
  hasLives: true,
  actions: ["up", "left", "right", "down"],
  // Solo los controles del juego: la pausa la declara el reproductor, que es
  // quien la escucha.
  controls: [
    { keys: "↑ ↓ ← →", label: "SALTAR DE CELDA" },
    { keys: "W A S D", label: "LO MISMO" },
  ],
  mount,
};
