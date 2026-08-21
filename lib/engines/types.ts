/**
 * Contrato que todo juego de la plataforma implementa para poder montarse
 * dentro del marco CRT del reproductor.
 *
 * Invariantes que debe cumplir cualquier motor:
 *
 * - `mount` no arranca ningún trabajo antes de ser llamado: importar el módulo
 *   no tiene efectos secundarios.
 * - El motor **no** escribe en el DOM fuera de su `<canvas>` ni pinta HUD ni
 *   overlays de estado: eso es de la plataforma.
 * - Los listeners de teclado los registra `mount` y los quita `destroy`.
 * - Los eventos se emiten solo cuando el valor **cambia**, no en cada frame.
 * - Tras `onGameOver` el motor deja de simular y no vuelve a emitir hasta un
 *   `restart`.
 */

/** Acciones que el reproductor puede inyectar desde controles táctiles. */
export type GameAction = "left" | "right" | "thrust" | "fire";

/** Lo que el motor le cuenta al reproductor mientras se juega. */
export type GameEvents = {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  /** Última vida perdida, o botón FIN. El reproductor abre el modal. */
  onGameOver: (finalScore: number) => void;
};

/** Mando a distancia que el reproductor conserva mientras el juego vive. */
export type GameHandle = {
  pause: () => void;
  resume: () => void;
  /** Empieza una partida nueva desde cero sin desmontar el canvas. */
  restart: () => void;
  /** Termina la partida a voluntad: emite `onGameOver` con lo marcado. */
  end: () => void;
  /** Traduce un control táctil al mismo estado que una tecla mantenida. */
  setInput: (action: GameAction, down: boolean) => void;
  /** Para el loop y suelta los listeners. Idempotente. */
  destroy: () => void;
};

/** Una línea de la ayuda de controles que se muestra bajo el marco CRT. */
export type GameControlHint = {
  keys: string;
  label: string;
};

export type GameEngine = {
  /** Resolución interna del canvas; el reproductor la escala por CSS. */
  width: number;
  height: number;
  /** Acciones que este juego entiende: con esto se pinta el mando táctil. */
  actions: readonly GameAction[];
  /** Ayuda de teclado que se muestra bajo el marco CRT. */
  controls: readonly GameControlHint[];
  mount: (canvas: HTMLCanvasElement, events: GameEvents) => GameHandle;
};
