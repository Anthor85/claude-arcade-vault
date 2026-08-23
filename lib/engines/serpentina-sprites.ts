/**
 * Atlas de frutas de Serpentina, portado de
 * `references/source-assets/snake-assets/sprites.js`, que escribía en
 * `window.SPRITE_ATLAS` y apuntaba al PNG con una ruta relativa.
 *
 * Invariante: importar este módulo **no** descarga nada. La primera llamada a
 * `loadFruitSheet()` es la que dispara la petición, y la promesa queda cacheada
 * a nivel de módulo para que dos montajes seguidos (Strict Mode en desarrollo)
 * no bajen la lámina dos veces.
 */

/** Recorte rectangular dentro de la lámina. */
export type SpriteFrame = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

/**
 * Las 22 frutas de la fila mediana de `fruits.png` (hoja de 3790×442 px,
 * fondo transparente, fila `y = 136–295`). Coordenadas copiadas literalmente
 * del original, que las obtuvo por análisis de píxeles.
 */
export const FRUITS = {
  banana: { sx: 34, sy: 136, sw: 110, sh: 160 },
  orange: { sx: 186, sy: 136, sw: 150, sh: 160 },
  grape: { sx: 378, sy: 136, sw: 110, sh: 160 },
  garlic: { sx: 540, sy: 136, sw: 130, sh: 160 },
  eggplant: { sx: 712, sy: 136, sw: 130, sh: 160 },
  strawberry: { sx: 894, sy: 136, sw: 110, sh: 160 },
  cherry: { sx: 1066, sy: 136, sw: 110, sh: 160 },
  carrot: { sx: 1228, sy: 136, sw: 130, sh: 160 },
  mushroom: { sx: 1400, sy: 136, sw: 130, sh: 160 },
  broccoli: { sx: 1582, sy: 136, sw: 110, sh: 160 },
  watermelon: { sx: 1734, sy: 136, sw: 150, sh: 160 },
  pepper: { sx: 1906, sy: 136, sw: 150, sh: 160 },
  kiwi: { sx: 2068, sy: 136, sw: 170, sh: 160 },
  lemon: { sx: 2250, sy: 136, sw: 140, sh: 160 },
  peach: { sx: 2432, sy: 136, sw: 130, sh: 160 },
  peanut: { sx: 2604, sy: 136, sw: 130, sh: 160 },
  apple: { sx: 2786, sy: 136, sw: 110, sh: 160 },
  tomato: { sx: 2948, sy: 136, sw: 130, sh: 160 },
  berries: { sx: 3110, sy: 136, sw: 150, sh: 160 },
  grapes2: { sx: 3302, sy: 136, sw: 110, sh: 160 },
  pineapple: { sx: 3454, sy: 136, sw: 150, sh: 160 },
  melon: { sx: 3637, sy: 136, sw: 130, sh: 160 },
} satisfies Record<string, SpriteFrame>;

/** Especie de fruta que acepta `drawFruit`. */
export type FruitName = keyof typeof FRUITS;

/** Las 22 especies, para sortear una en cada bocado. */
export const FRUIT_NAMES = Object.keys(FRUITS) as readonly FruitName[];

// ---- Carga de la lámina ----

const SHEET_URL = "/games/serpentina/fruits.png";

/**
 * Lámina lista para dibujar, o `null` si la descarga falló. Un asset roto no
 * debe tirar el reproductor: la partida sigue y la fruta se pinta como un
 * cuadro liso.
 */
export type FruitSheet = CanvasImageSource | null;

let pending: Promise<FruitSheet> | null = null;

/**
 * Descarga la lámina una sola vez y la pasa por un `<canvas>` intermedio.
 * Nunca rechaza: en error resuelve `null`.
 */
export function loadFruitSheet(): Promise<FruitSheet> {
  if (pending) return pending;

  pending = new Promise<FruitSheet>((resolve) => {
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
    raw.src = SHEET_URL;
  });

  return pending;
}

// ---- Dibujo ----

/** Color del cuadro liso que sustituye a la fruta cuando no hay lámina. */
const FALLBACK_FILL = "#ff2d95";

/**
 * Pinta una fruta centrada en `(cx, cy)`, escalada por el alto: `size` es su
 * altura y el ancho se deduce de la proporción del recorte, así que una banana
 * estrecha y un kiwi ancho miden lo mismo de alto y ninguno se deforma.
 *
 * Sin lámina dibuja un cuadro liso de `size × size`, para que la partida siga
 * siendo jugable con el PNG bloqueado.
 */
export function drawFruit(
  ctx: CanvasRenderingContext2D,
  sheet: FruitSheet,
  name: FruitName,
  cx: number,
  cy: number,
  size: number,
): void {
  if (!sheet) {
    ctx.fillStyle = FALLBACK_FILL;
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    return;
  }

  const frame = FRUITS[name];
  const dh = size;
  const dw = (frame.sw / frame.sh) * size;
  ctx.drawImage(
    sheet,
    frame.sx,
    frame.sy,
    frame.sw,
    frame.sh,
    cx - dw / 2,
    cy - dh / 2,
    dw,
    dh,
  );
}
