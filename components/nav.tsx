"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, type SessionUser } from "@/components/session-provider";

/** Icono de recambio cuando el jugador no trae foto (login por email+contraseña). */
function GenericAvatarIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <g fill="currentColor">
        <rect x="6" y="1" width="4" height="2" />
        <rect x="7" y="3" width="2" height="4" />
        <rect x="4" y="7" width="8" height="2" />
        <rect x="3" y="9" width="2" height="2" />
        <rect x="11" y="9" width="2" height="2" />
        <rect x="5" y="11" width="6" height="2" />
        <rect x="6" y="13" width="4" height="2" />
      </g>
    </svg>
  );
}

/**
 * Bloque decorativo avatar+nombre, no clicable. Se reutiliza tal cual en la
 * vista web y en el panel móvil: mismo dato, misma regla de fallback.
 */
function UserBadge({
  user,
  className,
}: {
  user: SessionUser;
  className: string;
}) {
  return (
    <div className={className}>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="user-avatar" />
      ) : (
        <span className="user-avatar user-avatar-fallback">
          <GenericAvatarIcon />
        </span>
      )}
      <span className="user-name">{user.username}</span>
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const isHome = pathname === "/";
  // La biblioteca queda activa también en detalle y reproductor, como el prototipo.
  const isLibrary = pathname.startsWith("/juegos");
  const isSalon = pathname.startsWith("/salon");
  const isAbout = pathname.startsWith("/acerca");
  const isAuth = pathname.startsWith("/acceso");

  const close = () => setOpen(false);

  const leave = async () => {
    setLeaving(true);
    close();
    try {
      await signOut();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>

        <div className="links">
          <Link href="/" className={isHome ? "active" : ""} onClick={close}>
            Inicio
          </Link>
          <Link
            href="/juegos"
            className={isLibrary ? "active" : ""}
            onClick={close}
          >
            Biblioteca
          </Link>
          <Link
            href="/salon"
            className={isSalon ? "active" : ""}
            onClick={close}
          >
            Salón de la Fama
          </Link>
          <Link
            href="/acerca"
            className={isAbout ? "active" : ""}
            onClick={close}
          >
            Acerca de
          </Link>
        </div>

        <div className="spacer" />

        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>

        {user ? (
          <>
            <UserBadge user={user} className="nav-user" />
            <button
              type="button"
              className="btn ghost auth-btn nav-signout"
              onClick={leave}
              disabled={leaving}
            >
              Cerrar Sesión
            </button>
          </>
        ) : (
          <Link href="/acceso" className="btn auth-btn" onClick={close}>
            Iniciar Sesión
          </Link>
        )}

        <button
          type="button"
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
          aria-expanded={open}
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
        aria-hidden
      />

      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link href="/" className={isHome ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link
          href="/juegos"
          className={isLibrary ? "active" : ""}
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link href="/salon" className={isSalon ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link
          href="/acerca"
          className={isAbout ? "active" : ""}
          onClick={close}
        >
          Acerca de
        </Link>
        {user ? (
          <>
            <UserBadge user={user} className="mobile-user" />
            <button
              type="button"
              className="mobile-signout"
              onClick={leave}
              disabled={leaving}
            >
              Cerrar Sesión
            </button>
          </>
        ) : (
          <Link
            href="/acceso"
            className={isAuth ? "active" : ""}
            onClick={close}
          >
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
