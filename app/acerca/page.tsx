import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { HighlightIcon, type HighlightIconKind } from "@/components/highlight-icons";
import { Reveal } from "@/components/reveal";
import styles from "@/components/about.module.css";

export const metadata: Metadata = {
  title: "Acerca de · Arcade Vault",
  description:
    "Qué es Arcade Vault, por qué existe y cómo ponerte en contacto con el equipo.",
};

const HIGHLIGHTS: { kind: HighlightIconKind; text: string; color: string }[] = [
  { kind: "HEART", text: "HECHO CON ❤️ PARA JUGADORES", color: styles.magenta },
  {
    kind: "BROWSER",
    text: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR",
    color: styles.cyan,
  },
  { kind: "PLANT", text: "PROYECTO EN CONSTANTE CRECIMIENTO", color: styles.green },
];

const DIVIDER_PIXELS = Array.from({ length: 24 }, (_, i) => i);

export default function AcercaPage() {
  return (
    <div className={`${styles.about} fade-in`}>
      {/* ACERCA DE */}
      <section className={styles.aboutHero}>
        <div className={`${styles.kicker} pixel neon-yellow`}>▸ ACERCA DE</div>
        <h1 className={styles.aboutTitle}>ACERCA DE ARCADE VAULT</h1>
        <p className={styles.aboutMission}>
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y
          celebrar los arcades que definieron una generación, haciéndolos accesibles para todos, en
          cualquier lugar y sin costo.
        </p>

        <div className={styles.highlightRow}>
          {HIGHLIGHTS.map((highlight, i) => (
            <div
              key={highlight.kind}
              className={`${styles.highlight} ${highlight.color}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <HighlightIcon kind={highlight.kind} />
              <div className={`${styles.hlText} pixel`}>{highlight.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BANDA DIVISORIA */}
      <Reveal as="div" className={styles.aboutDivider}>
        <div className={styles.divBar} aria-hidden="true" />
        <div className={styles.divPixels} aria-hidden="true">
          {DIVIDER_PIXELS.map((i) => (
            <span key={i} style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <div className={styles.divBar} aria-hidden="true" />
      </Reveal>

      {/* CONTACTO */}
      <Reveal className={styles.aboutContact}>
        <div className={styles.contactGrid}>
          <div className={styles.contactIntro}>
            <div className={`${styles.kicker} pixel neon-cyan`}>▸ CONTACTO</div>
            <h2 className={styles.contactTitle}>CONTÁCTANOS</h2>
            <p className={styles.contactSub}>
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className={styles.contactTips}>
              <div className={styles.tip}>
                <span className={styles.tipLed} />
                RESPUESTA EN 24-48H
              </div>
              <div className={styles.tip}>
                <span className={`${styles.tipLed} ${styles.y}`} />
                SUGERENCIAS BIENVENIDAS
              </div>
              <div className={styles.tip}>
                <span className={`${styles.tipLed} ${styles.m}`} />
                SIN SPAM, JAMÁS
              </div>
            </div>
          </div>

          <ContactForm />
        </div>
      </Reveal>
    </div>
  );
}
