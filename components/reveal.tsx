"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import styles from "@/components/home.module.css";

type RevealProps = {
  children: ReactNode;
  /** Etiqueta a renderizar. Por defecto `section`. */
  as?: ElementType;
  className?: string;
};

/**
 * Envuelve una sección y la hace aparecer con fundido cuando entra en el
 * viewport. Solo se anima una vez: al intersectar deja de observarse.
 */
export function Reveal({ children, as: Tag = "section", className }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Sin IntersectionObserver no hay animación posible: se muestra ya.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);

    return () => io.disconnect();
  }, []);

  const classes = [styles.reveal, shown ? styles.in : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag ref={ref} className={classes}>
      {children}
    </Tag>
  );
}
