"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useSession } from "@/components/session-provider";
import styles from "@/components/player.module.css";
import {
  saveScore,
  type SaveScoreState,
} from "@/app/juegos/[id]/jugar/actions";
import type { Game } from "@/lib/games";
import { hasEngine, loadEngine } from "@/lib/engines";
import type {
  GameControlHint,
  GameEvents,
  GameHandle,
} from "@/lib/engines/types";

const START_LIVES = 3;

/** La pausa es de la plataforma, no del juego: la declara el reproductor. */
const PAUSE_HINT: GameControlHint = { keys: "P / ESC", label: "PAUSA" };

type PlayerStatus = "loading" | "playing" | "paused" | "over";

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const engine = hasEngine(game.id);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  /** Solo lo usa la rama con motor: la maqueta deriva el nivel del marcador. */
  const [engineLevel, setEngineLevel] = useState(1);
  const [status, setStatus] = useState<PlayerStatus>(
    engine ? "loading" : "playing",
  );
  /** Cambia en cada partida: reinicia el bloque de guardado. */
  const [run, setRun] = useState(0);
  /** Ayuda de teclado que declara el motor, ya cargado. */
  const [controls, setControls] = useState<readonly GameControlHint[]>([]);

  /** Mando a distancia del motor mientras el juego vive. */
  const handleRef = useRef<GameHandle | null>(null);

  const over = status === "over" || (!engine && lives <= 0);
  const paused = status === "paused";
  const level = engine ? engineLevel : mockLevel(score);

  // El nombre del HUD sale de la sesión: ya no es un campo escribible.
  const playerName = user ? user.username : "INVITADO";

  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    setStatus("over");
  }, []);

  const handleReady = useCallback((hints: readonly GameControlHint[]) => {
    // Si el motor termina de cargar con la pestaña en segundo plano, la partida
    // no empieza a correr sin que nadie la mire.
    const hidden = document.hidden;
    setControls(hints);
    setStatus((s) => (s === "loading" ? (hidden ? "paused" : "playing") : s));
  }, []);

  const restart = () => {
    setRun((r) => r + 1);
    setScore(0);
    setLives(START_LIVES);
    setEngineLevel(1);
    setStatus("playing");
    // Partida nueva sobre el mismo canvas: no hace falta desmontar nada.
    handleRef.current?.restart();
  };

  /** Abandonar a voluntad: el motor emite su marca y el modal la recoge. */
  const endGame = () => {
    const handle = handleRef.current;
    if (handle) handle.end();
    else setStatus("over");
  };

  const togglePause = () =>
    setStatus((s) =>
      s === "playing" ? "paused" : s === "paused" ? "playing" : s,
    );

  // El estado del reproductor manda sobre el loop del motor.
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    if (status === "paused") handle.pause();
    else if (status === "playing") handle.resume();
  }, [status]);

  // Salir de la pestaña no debe costar vidas: al volver, sigue en pausa.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setStatus((s) => (s === "playing" ? "paused" : s));
      }
    };
    // `visibilitychange` solo avisa de los cambios: si se entra con la pestaña
    // ya oculta, hay que mirarlo una vez.
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // `P` y `Escape` hacen lo mismo que el botón: son de la plataforma, no del
  // juego, y por eso los escucha el reproductor.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "KeyP" && e.code !== "Escape") return;
      e.preventDefault();
      togglePause();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {playerName}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="btn yellow"
            onClick={togglePause}
            disabled={over || status === "loading"}
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            type="button"
            className="btn magenta"
            onClick={endGame}
            disabled={over || status === "loading"}
          >
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {engine ? (
            <CanvasArena
              gameId={game.id}
              handleRef={handleRef}
              onScore={setScore}
              onLives={setLives}
              onLevel={setEngineLevel}
              onGameOver={handleGameOver}
              onReady={handleReady}
            />
          ) : (
            <MockArena
              running={!over && !paused}
              onScore={setScore}
              onLives={setLives}
            />
          )}
          {status === "loading" && (
            <div className="crt-content" style={{ zIndex: 5 }}>
              <div className="pixel neon-cyan" style={{ fontSize: 16 }}>
                CARGANDO…
              </div>
            </div>
          )}
          {paused && !over && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {controls.length > 0 && <ControlPanel controls={controls} />}

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {user ? (
              // `key`: cada partida estrena su propio estado de guardado.
              <SaveScore key={run} gameId={game.id} score={score} />
            ) : (
              // Sin cuenta se juega, pero no se compite: la marca no tendría a
              // quién atribuirse.
              <div className={styles.guestNotice}>
                <p>ENTRA PARA INSCRIBIR TU MARCA EN EL SALÓN DE LA FAMA.</p>
                <Link href="/acceso" className="btn yellow">
                  INICIAR SESIÓN
                </Link>
              </div>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/juegos" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Arena real: el motor pintando sobre su canvas ─────────────────────────────

type CanvasArenaProps = {
  gameId: string;
  handleRef: RefObject<GameHandle | null>;
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  onReady: (controls: readonly GameControlHint[]) => void;
};

function CanvasArena({
  gameId,
  handleRef,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  onReady,
}: CanvasArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Todos estos callbacks son estables (`setState` o `useCallback` sin deps),
  // así que el efecto solo se vuelve a ejecutar si cambia el juego: el motor no
  // se remonta por un simple render del reproductor.
  useEffect(() => {
    let cancelled = false;
    const pending = loadEngine(gameId);
    if (!pending) return;

    const events: GameEvents = { onScore, onLives, onLevel, onGameOver };

    pending.then((engine) => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      handleRef.current = engine.mount(canvas, events);
      onReady(engine.controls);
    });

    return () => {
      cancelled = true;
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [gameId, handleRef, onScore, onLives, onLevel, onGameOver, onReady]);

  return <canvas ref={canvasRef} className="game-canvas" />;
}

// ── Bisel del panel de control ────────────────────────────────────────────────

/**
 * La leyenda de movimientos, como la serigrafía de la plancha de una máquina
 * real. Los controles del juego los declara el motor; la pausa la pone el
 * reproductor, y se distingue en amarillo porque la escucha él.
 */
function ControlPanel({ controls }: { controls: readonly GameControlHint[] }) {
  return (
    <ul className={styles.panel}>
      {controls.map((hint) => (
        <li key={hint.keys} className={styles.panelItem}>
          <kbd className={styles.cap}>{hint.keys}</kbd>
          <span className={styles.capLabel}>{hint.label}</span>
        </li>
      ))}
      <li className={`${styles.panelItem} ${styles.platform}`}>
        <kbd className={styles.cap}>{PAUSE_HINT.keys}</kbd>
        <span className={styles.capLabel}>{PAUSE_HINT.label}</span>
      </li>
    </ul>
  );
}

// ── Arena de maqueta: la simulación de siempre ────────────────────────────────

const TICK_MS = 220; // cada cuánto sube el marcador
const LIFE_MS = 7000; // cada cuánto se pierde una vida
const POINTS_PER_LEVEL = 2500;

const mockLevel = (score: number) => Math.floor(score / POINTS_PER_LEVEL) + 1;

type MockArenaProps = {
  running: boolean;
  onScore: (update: (score: number) => number) => void;
  onLives: (update: (lives: number) => number) => void;
};

/** Los 7 juegos sin motor siguen enseñando la simulación de siempre. */
function MockArena({ running, onScore, onLives }: MockArenaProps) {
  useEffect(() => {
    if (!running) return;
    const t = setInterval(
      () => onScore((s) => s + Math.floor(10 + Math.random() * 90)),
      TICK_MS,
    );
    return () => clearInterval(t);
  }, [running, onScore]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => onLives((l) => Math.max(l - 1, 0)), LIFE_MS);
    return () => clearInterval(t);
  }, [running, onLives]);

  return (
    <div className="game-arena">
      <div className="grid-floor" />
      <div className="enemy e1" />
      <div className="enemy e2" />
      <div className="enemy e3" />
      <div className="player-ship" />
    </div>
  );
}

/** Botón de guardar de la pantalla final, con su propio estado de envío. */
function SaveScore({ gameId, score }: { gameId: string; score: number }) {
  const [state, action, pending] = useActionState<SaveScoreState, FormData>(
    saveScore,
    { status: "idle" },
  );

  if (state.status === "ok") {
    return <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>;
  }

  return (
    <>
      <form action={action} className={styles.saveRow}>
        <input type="hidden" name="gameId" value={gameId} />
        <input type="hidden" name="score" value={score} />
        <button type="submit" className="btn yellow" disabled={pending}>
          {pending ? "▶ GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
        </button>
      </form>
      {state.status === "unauthenticated" && (
        <p role="alert" className={styles.saveError}>
          LA SESIÓN HA CADUCADO. VUELVE A ENTRAR PARA GUARDAR.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className={styles.saveError}>
          {state.message}
        </p>
      )}
    </>
  );
}
