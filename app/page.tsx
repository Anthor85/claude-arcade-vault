import Link from "next/link";
import { HomeSilhouettes } from "@/components/home-silhouettes";
import { MiniCard } from "@/components/mini-card";
import { PokemonCounter } from "@/components/pokemon-counter";
import { Reveal } from "@/components/reveal";
import styles from "@/components/home.module.css";
import { GAMES } from "@/lib/games";

export default function Home() {
  return (
    <div className={`${styles.home} fade-in`}>
      <PokemonCounter />
      {/* HERO */}
      <section className={styles.homeHero}>
        <HomeSilhouettes />
        <div className={styles.homeHeroInner}>
          <div className={`${styles.heroEyebrow} pixel neon-yellow`}>
            ▸ INSERTA UNA MONEDA<span className="blink">_</span>
          </div>
          <h1 className={styles.homeTitle}>
            <span className={styles.line1}>EL ARCADE</span>
            <span className={styles.line2}>CLÁSICO ESTÁ</span>
            <span className={styles.line3}>DE VUELTA</span>
          </h1>
          <p className={styles.homeSub}>
            Juega los mejores clásicos directamente en tu navegador.
            <br />
            Sin descargas. Sin costo. Solo diversión.
          </p>
          <div className={styles.homeCtas}>
            <Link href="/juegos" className="btn xl pulse">
              ▶ EXPLORAR JUEGOS
            </Link>
            <Link href="/acceso" className="btn xl magenta">
              ✦ CREAR CUENTA
            </Link>
          </div>
          <div className={styles.heroScroll} aria-hidden="true">
            <span>DESLIZA</span>
            <span className={styles.arrow}>▼</span>
          </div>
        </div>
      </section>

      {/* JUEGOS DISPONIBLES */}
      <Reveal className={styles.homeSection}>
        <div className={styles.sectionHead}>
          <div className={`${styles.kicker} pixel neon-cyan`}>{"// 02"}</div>
          <h2 className={styles.sectionTitle}>JUEGOS DISPONIBLES AHORA</h2>
          <div className={styles.sectionRule} />
        </div>
        <div className={styles.miniRail}>
          {GAMES.slice(0, 6).map((game) => (
            <MiniCard key={game.id} game={game} />
          ))}
        </div>
        <div className={styles.railFooter}>
          <Link href="/juegos" className="btn lg">
            VER TODOS LOS JUEGOS →
          </Link>
        </div>
      </Reveal>

      {/* CTA FINAL */}
      <Reveal className={styles.homeFinal}>
        <h2 className={`${styles.finalTitle} pixel`}>¿LISTO PARA JUGAR?</h2>
        <Link href="/juegos" className={`btn xl pulse ${styles.finalCta}`}>
          INSERTAR MONEDA →
        </Link>
        <div className={styles.finalTag}>
          Gratis. Sin registro obligatorio. Empieza en segundos.
        </div>
      </Reveal>
    </div>
  );
}
