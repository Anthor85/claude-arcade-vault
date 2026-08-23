/**
 * Tabla de sprites de Arkanoid, portada de
 * `references/started-games/04-claude-arkanoid/assets/spritesheet.js`.
 *
 * Invariante: importar este módulo **no** descarga nada. La primera llamada a
 * `loadSpritesheet()` es la que dispara la petición, y la promesa queda
 * cacheada a nivel de módulo para que dos montajes seguidos (Strict Mode en
 * desarrollo) no bajen el PNG dos veces.
 */

/** Recorte rectangular dentro de la lámina. */
export type SpriteFrame = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

/** Colores de bloque que tienen recorte propio en la lámina. */
export type BrickColor =
  "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

// ---- Frames de explosión ----

export const EXPLOSION_FRAMES: Record<BrickColor, readonly SpriteFrame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

/** Milisegundos que dura la animación completa de explosión. */
export const EXPLOSION_DURATION = 150;

// ---- Recortes de los elementos del juego ----

export const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
} satisfies {
  paddle: SpriteFrame;
  ball: SpriteFrame;
  blocks: Record<BrickColor, SpriteFrame>;
};

/** Nombres que acepta `drawSprite`. */
export type SpriteName = "paddle" | "ball" | `block_${BrickColor}`;

// ---- Carga de la lámina ----

const SPRITESHEET_URL = "/games/arkanoid/spritesheet-breakout.png";

/**
 * Imagen ya lista para dibujar, o `null` si la descarga falló. Un asset roto
 * no debe tirar el reproductor: el juego sigue simulando sobre fondo negro.
 */
export type Spritesheet = CanvasImageSource | null;

let pending: Promise<Spritesheet> | null = null;

/**
 * Descarga la lámina una sola vez y la pasa por un `<canvas>` intermedio, que
 * es lo que evita el reescalado suave en cada `drawImage` posterior.
 *
 * Nunca rechaza: en error resuelve `null`.
 */
export function loadSpritesheet(): Promise<Spritesheet> {
  if (pending) return pending;

  pending = new Promise<Spritesheet>((resolve) => {
    const raw = new Image();
    raw.onload = () => {
      const off = document.createElement("canvas");
      off.width = raw.width;
      off.height = raw.height;
      const octx = off.getContext("2d");
      if (!octx) {
        resolve(null);
        return;
      }
      octx.drawImage(raw, 0, 0);
      resolve(off);
    };
    raw.onerror = () => resolve(null);
    raw.src = SPRITESHEET_URL;
  });

  return pending;
}

// ---- Dibujo ----

/** Pinta un recorte arbitrario de la lámina. No hace nada sin imagen. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: Spritesheet,
  frame: SpriteFrame,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!img) return;
  ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

/** Pinta un sprite con nombre: `paddle`, `ball` o `block_<color>`. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: Spritesheet,
  name: SpriteName,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (!img) return;
  const sp: SpriteFrame = name.startsWith("block_")
    ? SPRITES.blocks[name.slice(6) as BrickColor]
    : SPRITES[name as "paddle" | "ball"];
  if (!sp) return;
  ctx.drawImage(img, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
}
