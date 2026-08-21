import Link from "next/link";

import styles from "@/components/hall.module.css";
import { GAMES } from "@/lib/games";
import type { HallRow } from "@/lib/scores-db";

/**
 * Salón de la Fama.
 *
 * Componente de servidor: las filas llegan ya resueltas desde la base de datos
 * y las pestañas por juego son enlaces (`/salon?juego=…`), no estado de
 * cliente, para que cada ranking tenga su propia URL.
 */
export function HallOfFame({
  gameId,
  rows,
}: {
  gameId: string;
  rows: HallRow[];
}) {
  const game = GAMES.find((g) => g.id === gameId);
  const [first, second, third] = rows;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <Link
            key={g.id}
            href={`/salon?juego=${g.id}`}
            scroll={false}
            className={"chip" + (gameId === g.id ? " active" : "")}
          >
            {g.title}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            NADIE HA MARCADO AÚN EN ESTE JUEGO
          </p>
          <p className={styles.emptyHint}>
            La primera partida que se guarde abre la tabla.
          </p>
          {game && (
            <Link href={`/juegos/${game.id}`} className="btn lg">
              ▶&nbsp;&nbsp;JUGAR A {game.title}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="podium">
            <div className="podium-slot silver">
              {second ? (
                <>
                  <div className="rank-num">02</div>
                  <div className="name">{second.username}</div>
                  <div className="score">
                    {second.score.toLocaleString("es-ES")}
                  </div>
                  <div className="date">{second.date}</div>
                </>
              ) : (
                <div className={styles.slotFree}>PUESTO LIBRE</div>
              )}
            </div>
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{
                  fontSize: 9,
                  color: "var(--gold)",
                  letterSpacing: "0.18em",
                }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{first.username}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {first.score.toLocaleString("es-ES")}
              </div>
              <div className="date">{first.date}</div>
            </div>
            <div className="podium-slot bronze">
              {third ? (
                <>
                  <div className="rank-num">03</div>
                  <div className="name">{third.username}</div>
                  <div className="score">
                    {third.score.toLocaleString("es-ES")}
                  </div>
                  <div className="date">{third.date}</div>
                </>
              ) : (
                <div className={styles.slotFree}>PUESTO LIBRE</div>
              )}
            </div>
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.rank}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "") +
                  (r.isMine ? " you" : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">
                  {r.username}
                  {r.isMine && <span className={styles.youTag}> · TÚ</span>}
                </div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/juegos" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
