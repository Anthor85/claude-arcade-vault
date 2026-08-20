"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import type { Game } from "@/lib/games";

const TICK_MS = 220; // cada cuánto sube el marcador
const LIFE_MS = 7000; // cada cuánto se pierde una vida
const POINTS_PER_LEVEL = 2500;
const START_LIVES = 3;

export function GamePlayer({ game }: { game: Game }) {
  const { user, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  // null = todavía sigue al nombre de la sesión; en cuanto se teclea, manda lo tecleado.
  const [typedName, setTypedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Derivados: no necesitan estado propio ni efectos que los sincronicen.
  const level = Math.floor(score / POINTS_PER_LEVEL) + 1;
  const over = ended || lives <= 0;

  // El nombre del HUD sigue a la sesión, que se hidrata después del primer paint.
  const playerName = user ? user.name : "INVITADO";
  const name = typedName ?? playerName;

  useEffect(() => {
    if (over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      TICK_MS,
    );
    return () => clearInterval(t);
  }, [over, paused]);

  useEffect(() => {
    if (over || paused) return;
    const t = setInterval(() => setLives((l) => Math.max(l - 1, 0)), LIFE_MS);
    return () => clearInterval(t);
  }, [over, paused]);

  const restart = () => {
    setScore(0);
    setLives(START_LIVES);
    setPaused(false);
    setEnded(false);
    setSaved(false);
  };

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
            onClick={() => setPaused((p) => !p)}
            disabled={over}
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            type="button"
            className="btn magenta"
            onClick={() => setEnded(true)}
            disabled={over}
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
          <div className="game-arena">
            <div className="grid-floor" />
            <div className="enemy e1" />
            <div className="enemy e2" />
            <div className="enemy e3" />
            <div className="player-ship" />
          </div>
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

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setTypedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                  maxLength={10}
                  aria-label="Nombre para la tabla de puntuaciones"
                />
                <button
                  type="button"
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, name, score });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
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
