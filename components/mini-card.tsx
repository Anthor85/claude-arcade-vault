import Link from "next/link";
import styles from "@/components/home.module.css";
import type { Game } from "@/lib/games";

/** Tarjeta compacta del rail de la landing. Enlaza al detalle del juego. */
export function MiniCard({ game }: { game: Game }) {
  return (
    <Link href={`/juegos/${game.id}`} className={styles.miniCard}>
      <div className={styles.miniCover}>
        <div className={`cover-bg ${game.cover}`} />
      </div>
      <div className={styles.miniMeta}>
        <div className={styles.miniTitle}>{game.title}</div>
        <div className={styles.miniCat}>{game.cat}</div>
      </div>
    </Link>
  );
}
