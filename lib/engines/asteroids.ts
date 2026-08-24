import type {
  GameAction,
  GameEngine,
  GameEvents,
  GameHandle,
  SkinId,
} from "./types";

/**
 * Port de `references/started-games/02-claude-asteroids/game.js`.
 *
 * Se conserva la lógica de juego tal cual (constantes de tuning, física,
 * espacio toroidal, power-ups, 3 vidas). Los cambios son estructurales:
 * el canvas llega por parámetro, todo el estado vive en el closure de `mount`,
 * el HUD y el overlay de fin de partida los pinta React, y el loop se arranca
 * y se para desde fuera.
 */

const W = 800;
const H = 600;

/**
 * Cada acción táctil escribe en la misma tecla que usaría el teclado. Solo
 * cubre las acciones que este juego declara en `actions`; el resto de
 * `GameAction` pertenece a otros motores.
 */
const ACTION_KEYS: Partial<Record<GameAction, string>> = {
  left: "ArrowLeft",
  right: "ArrowRight",
  thrust: "ArrowUp",
  fire: "Space",
};

const SCROLL_KEYS = [
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];

type Point = { x: number; y: number };
type PowerUpType = "triple" | "shield";
type GameState = "playing" | "dead" | "gameover";

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// ── Asteroides ────────────────────────────────────────────────────────────────
const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

// ── PowerUps ──────────────────────────────────────────────────────────────────
const TRIPLE_SHOT_TIME = 10; // segundos que dura el disparo triple
const SHIELD_TIME = 5; // segundos que dura el escudo
const SHIELD_GRACE = 1; // invencibilidad tras absorber un impacto
const POWERUP_DROP = 0.25; // probabilidad por tipo al destruir un asteroide

const POWERUP_TYPES: readonly PowerUpType[] = ["triple", "shield"];

// ── Skins ─────────────────────────────────────────────────────────────────────
/**
 * Una skin es solo paleta y forma de trazo. No toca geometría, hitboxes,
 * tiempos ni puntuación: la partida se juega igual con cualquiera de las tres.
 */
type AsteroidsSkin = {
  fondo: string;
  nave: string;
  asteroide: string;
  bala: string;
  llama: string;
  escudo: string;
  /** El rastro de partícula se apaga solo: el alfa lo pone quien dibuja. */
  particula: (alpha: number) => string;
  powerup: Record<PowerUpType, string>;
  /** Radio del halo de trazo. `0` en las paletas planas. */
  glow: number;
  /** Rejilla de fondo, o `null` si esta skin no la pinta. */
  rejilla: string | null;
};

const SKINS: Record<SkinId, AsteroidsSkin> = {
  // La paleta original del prototipo, byte a byte: vector blanco sobre negro.
  clasico: {
    fondo: "#000",
    nave: "#fff",
    asteroide: "#fff",
    bala: "#fff",
    llama: "rgba(255, 130, 0, 0.85)",
    escudo: "rgba(255, 210, 77, 0.8)",
    particula: (a) => `rgba(255,255,255,${a.toFixed(2)})`,
    powerup: { triple: "#4df3ff", shield: "#ffd24d" },
    glow: 0,
    rejilla: null,
  },
  // Fósforo ámbar de monitor CRT: un solo tono, la lectura la da el brillo.
  retro: {
    fondo: "#0d0a04",
    nave: "#ffd28a",
    asteroide: "#ffb000",
    bala: "#ffe9c4",
    llama: "rgba(255, 176, 0, 0.85)",
    escudo: "rgba(255, 210, 138, 0.8)",
    particula: (a) => `rgba(255,176,0,${a.toFixed(2)})`,
    powerup: { triple: "#ffd28a", shield: "#c98a00" },
    glow: 0,
    rejilla: null,
  },
  // Saturado sobre fondo casi negro, con halo en los trazos y rejilla tenue.
  neon: {
    fondo: "#04040c",
    nave: "#00f5ff",
    asteroide: "#ff006e",
    bala: "#f5ff00",
    llama: "rgba(245, 255, 0, 0.9)",
    escudo: "rgba(0, 255, 136, 0.85)",
    particula: (a) => `rgba(0,245,255,${a.toFixed(2)})`,
    powerup: { triple: "#00ff88", shield: "#ff006e" },
    glow: 8,
    rejilla: "rgba(0, 245, 255, 0.08)",
  },
};

/** Separación de la rejilla decorativa de `neon`. No es una unidad de juego. */
const GRID_STEP = 40;

function mount(canvas: HTMLCanvasElement, events: GameEvents): GameHandle {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo obtener el contexto 2D del canvas");
  const ctx: CanvasRenderingContext2D = context;

  canvas.width = W;
  canvas.height = H;

  // ── Skin activa ─────────────────────────────────────────────────────────────
  // Solo la consulta el dibujado; nada del estado de juego la mira.
  let skin: AsteroidsSkin = SKINS.clasico;

  // ── Input ───────────────────────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    justPressed[e.code] = !keys[e.code];
    keys[e.code] = true;
    // Las flechas y el espacio solo dejan de desplazar la página mientras el
    // juego tiene el control: en pausa o tras el fin de partida el teclado
    // vuelve a ser del navegador, que es quien mueve el modal.
    if (SCROLL_KEYS.includes(e.code) && state !== "gameover" && !paused) {
      e.preventDefault();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function pressed(code: string): boolean {
    const val = justPressed[code] ?? false;
    justPressed[code] = false;
    return val;
  }

  /**
   * Halo de la skin `neon`. Se llama una vez por entidad, siempre dentro de un
   * `save()`/`restore()`, para no reasignar `shadow*` por vértice.
   */
  function applyGlow(color: string) {
    if (skin.glow <= 0) return;
    ctx.shadowBlur = skin.glow;
    ctx.shadowColor = color;
  }

  // ── Bullet ──────────────────────────────────────────────────────────────────
  class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl = 1.1;
    radius = 2;
    dead = false;

    constructor(x: number, y: number, angle: number) {
      this.x = x;
      this.y = y;
      const SPEED = 520;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      ctx.save();
      ctx.fillStyle = skin.bala;
      applyGlow(skin.bala);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Asteroid ────────────────────────────────────────────────────────────────
  class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    dead = false;
    vx: number;
    vy: number;
    rotSpeed: number;
    rot: number;
    verts: [number, number][] = [];

    constructor(x: number, y: number, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];

      const angle = rand(0, Math.PI * 2);
      const speed = SPEEDS[size] + rand(-15, 15);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.rotSpeed = rand(-1.2, 1.2);
      this.rot = rand(0, Math.PI * 2);

      // Polígono irregular
      const n = randInt(8, 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }

    split(): Asteroid[] {
      if (this.size <= 1) return [];
      return [
        new Asteroid(this.x, this.y, this.size - 1),
        new Asteroid(this.x, this.y, this.size - 1),
      ];
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.strokeStyle = skin.asteroide;
      applyGlow(skin.asteroide);
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++)
        ctx.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Ship ────────────────────────────────────────────────────────────────────
  class Ship {
    x = W / 2;
    y = H / 2;
    angle = -Math.PI / 2;
    vx = 0;
    vy = 0;
    radius = 12;
    thrusting = false;
    invincible = 3;
    shootCooldown = 0;
    tripleShot = 0; // segundos restantes de disparo triple
    shield = 0; // segundos restantes de escudo
    dead = false;

    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.radius = 12;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.tripleShot = 0;
      this.shield = 0;
      this.dead = false;
    }

    update(dt: number) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.tripleShot > 0) this.tripleShot -= dt;
      if (this.shield > 0) this.shield -= dt;

      const ROT = 3.5; // rad/s
      const THRUST = 260; // px/s²
      const DRAG = 0.987;

      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;

      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }

      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }

    tryShoot(): Bullet[] {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const ox = this.x + Math.cos(this.angle) * NOSE;
      const oy = this.y + Math.sin(this.angle) * NOSE;
      if (this.tripleShot > 0) {
        const SPREAD = 0.22; // rad entre balas del abanico
        return [
          new Bullet(ox, oy, this.angle - SPREAD),
          new Bullet(ox, oy, this.angle),
          new Bullet(ox, oy, this.angle + SPREAD),
        ];
      }
      return [new Bullet(ox, oy, this.angle)];
    }

    draw() {
      if (this.dead) return;

      // Burbuja de escudo: no rota con la nave y se dibuja aunque la nave parpadee
      if (this.shield > 0) this.drawShield();

      // Parpadeo durante invencibilidad de reaparición
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
        return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.strokeStyle = skin.nave;
      applyGlow(skin.nave);
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";

      // Silueta clásica: triángulo con muesca trasera
      ctx.beginPath();
      ctx.moveTo(20, 0); // nariz
      ctx.lineTo(-12, -9); // ala izquierda
      ctx.lineTo(-7, 0); // muesca trasera
      ctx.lineTo(-12, 9); // ala derecha
      ctx.closePath();
      ctx.stroke();

      // Llama del propulsor
      if (this.thrusting && Math.random() > 0.35) {
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - rand(6, 14), 0);
        ctx.lineTo(-8, 4);
        ctx.strokeStyle = skin.llama;
        applyGlow(skin.llama);
        ctx.stroke();
      }

      ctx.restore();
    }

    drawShield() {
      // Parpadea en el último segundo para avisar de que se agota
      if (this.shield < 1 && Math.floor(this.shield * 10) % 2 === 0) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = skin.escudo;
      applyGlow(skin.escudo);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Partículas (explosión) ──────────────────────────────────────────────────
  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    dead = false;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = rand(0.4, 1.1);
      this.ttl = this.life;
    }

    update(dt: number) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      const alpha = this.ttl / this.life;
      ctx.strokeStyle = skin.particula(alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx.stroke();
    }
  }

  // ── PowerUp ─────────────────────────────────────────────────────────────────
  class PowerUp {
    x: number;
    y: number;
    type: PowerUpType;
    vx: number;
    vy: number;
    radius = 13;
    rot = 0;
    ttl = 12; // desaparece si no se recoge
    dead = false;

    constructor(x: number, y: number, type: PowerUpType) {
      this.x = x;
      this.y = y;
      this.type = type;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(15, 40);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += 1.6 * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      // Parpadeo en los últimos segundos antes de expirar
      if (this.ttl < 3 && Math.floor(this.ttl * 6) % 2 === 0) return;

      const color = skin.powerup[this.type];

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.strokeStyle = color;
      applyGlow(color);
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";

      // Rombo contenedor
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius, 0);
      ctx.lineTo(0, this.radius);
      ctx.lineTo(-this.radius, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Icono interior (sin rotar, para que se lea)
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = color;
      applyGlow(color);
      ctx.lineWidth = 1.5;
      if (this.type === "triple") this.drawIconTriple();
      else this.drawIconShield();
      ctx.restore();
    }

    // Abanico de tres trazos apuntando hacia arriba
    drawIconTriple() {
      ctx.rotate(-Math.PI / 2);
      for (const a of [-0.45, 0, 0.45]) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
        ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.stroke();
      }
    }

    // Dos arcos concéntricos: la idea de "burbuja"
    drawIconShield() {
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, -Math.PI * 0.9, Math.PI * 0.1);
      ctx.stroke();
    }
  }

  // ── Estado del juego ────────────────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerups: PowerUp[] = [];
  /** Por tipo: true si ese power-up ya salió en el nivel actual. */
  let dropped: Record<PowerUpType, boolean> = { triple: false, shield: false };
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: GameState = "playing";
  let deadTimer = 0;

  // Solo se avisa al reproductor cuando el valor cambia, no en cada frame.
  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;
  let gameOverEmitted = false;

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
    state = "gameover";
    events.onGameOver(score);
  }

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerups = [];
    dropped = { triple: false, shield: false };
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    deadTimer = 0;
    gameOverEmitted = false;
    spawnAsteroids(4);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerups = [];
    dropped = { triple: false, shield: false };
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      emitGameOver();
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    // Tras el fin de partida el motor deja de simular: el overlay es de React.
    if (state === "gameover") return;

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      powerups.forEach((p) => p.update(dt));
      powerups = powerups.filter((p) => !p.dead);
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerups.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerups = powerups.filter((p) => !p.dead);

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          // Suelta power-ups al azar, como mucho uno de cada tipo por nivel
          for (const t of POWERUP_TYPES) {
            if (!dropped[t] && Math.random() < POWERUP_DROP) {
              dropped[t] = true;
              powerups.push(new PowerUp(a.x, a.y, t));
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs power-up
    for (const p of powerups) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        if (p.type === "triple") ship.tripleShot = TRIPLE_SHOT_TIME;
        else ship.shield = SHIELD_TIME;
      }
    }
    powerups = powerups.filter((p) => !p.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          if (ship.shield > 0) {
            // El escudo absorbe el impacto: revienta el asteroide, sin puntos
            ship.shield = 0;
            ship.invincible = SHIELD_GRACE;
            a.dead = true;
            explode(a.x, a.y, a.size * 6);
            asteroids.push(...a.split());
          } else {
            killShip();
          }
          break;
        }
      }
      asteroids = asteroids.filter((a) => !a.dead);
    }

    // Nivel completado
    if (state === "playing" && asteroids.length === 0) nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = skin.fondo;
    ctx.fillRect(0, 0, W, H);
    drawGrid();

    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    powerups.forEach((p) => p.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();
  }

  /**
   * Rejilla decorativa de fondo. Es puro adorno de la skin `neon`: no marca
   * casillas ni alinea nada del juego.
   */
  function drawGrid() {
    if (!skin.rejilla) return;
    ctx.save();
    ctx.strokeStyle = skin.rejilla;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = GRID_STEP; x < W; x += GRID_STEP) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let y = GRID_STEP; y < H; y += GRID_STEP) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  let lastTime: number | null = null;
  let rafId = 0;
  let paused = false;
  let destroyed = false;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) {
      update(dt);
      emitChanges();
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  /** Suelta todas las teclas: evita que una acción se quede "pegada". */
  function releaseAllKeys() {
    for (const code of Object.keys(keys)) keys[code] = false;
    for (const code of Object.keys(justPressed)) justPressed[code] = false;
  }

  initGame();
  emitChanges();
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
      releaseAllKeys();
    },
    resume() {
      if (destroyed) return;
      paused = false;
    },
    restart() {
      if (destroyed) return;
      releaseAllKeys();
      initGame();
      emitChanges();
      paused = false;
    },
    end() {
      if (destroyed) return;
      emitGameOver();
      releaseAllKeys();
    },
    setInput(action, down) {
      const code = ACTION_KEYS[action];
      if (!code) return;
      if (down) {
        justPressed[code] = !keys[code];
        keys[code] = true;
      } else {
        keys[code] = false;
      }
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
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}

export const asteroidsEngine: GameEngine = {
  width: W,
  height: H,
  hasLives: true,
  actions: ["left", "right", "thrust", "fire"],
  skins: ["clasico", "retro", "neon"],
  // Solo los controles del juego: la pausa la declara el reproductor, que es
  // quien la escucha.
  controls: [
    { keys: "← →", label: "ROTAR" },
    { keys: "↑", label: "PROPULSAR" },
    { keys: "ESPACIO", label: "DISPARAR" },
  ],
  mount,
};
