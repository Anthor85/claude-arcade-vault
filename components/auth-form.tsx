"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  signIn,
  signInWithOAuth,
  signUp,
  type AuthState,
} from "@/app/acceso/actions";
import styles from "@/components/auth.module.css";

type Tab = "in" | "up";

const IDLE: AuthState = { status: "idle" };

export function AuthForm() {
  const [tab, setTab] = useState<Tab>("in");
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(
    signIn,
    IDLE,
  );
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(
    signUp,
    IDLE,
  );

  // Los campos son controlados para que un error del servidor no vacíe lo
  // escrito: `useActionState` vuelve a renderizar el formulario entero.
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const isSignUp = tab === "up";
  const state = isSignUp ? upState : inState;
  const pending = isSignUp ? upPending : inPending;
  const error = state.status === "error" && !pending ? state : null;

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            onClick={() => setTab("in")}
            disabled={pending}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            onClick={() => setTab("up")}
            disabled={pending}
          >
            CREAR CUENTA
          </button>
        </div>

        {/* Un formulario por pestaña: cada uno tiene su propio Server Action y
            su propio estado de error. */}
        <form key={tab} action={isSignUp ? upAction : inAction}>
          {isSignUp && (
            <div className="field slide-in">
              <label htmlFor="av-user">Usuario</label>
              <input
                id="av-user"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="PX_KAI"
                maxLength={10}
                autoComplete="username"
                disabled={pending}
                aria-invalid={error?.field === "username" || undefined}
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="av-email">Correo electrónico</label>
            <input
              id="av-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
              disabled={pending}
              aria-invalid={error?.field === "email" || undefined}
            />
          </div>

          <div className="field">
            <label htmlFor="av-pass">Contraseña</label>
            <input
              id="av-pass"
              name="password"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              disabled={pending}
              aria-invalid={error?.field === "pass" || undefined}
            />
          </div>

          {error && (
            <p role="alert" className={styles.formError}>
              {error.message}
            </p>
          )}

          <button
            className="btn lg"
            type="submit"
            style={{ width: "100%", marginTop: 8 }}
            disabled={pending}
          >
            {pending
              ? isSignUp
                ? "CREANDO…"
                : "ENTRANDO…"
              : isSignUp
                ? "CREAR Y JUGAR"
                : "ENTRAR AL VAULT"}
          </button>
        </form>

        <Link
          href="/"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
        >
          JUGAR COMO INVITADO
        </Link>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <form
            action={() => signInWithOAuth("google")}
            style={{ display: "contents" }}
          >
            <button className="btn ghost" type="submit" disabled={pending}>
              ◆&nbsp;&nbsp;GOOGLE
            </button>
          </form>
          <form
            action={() => signInWithOAuth("github")}
            style={{ display: "contents" }}
          >
            <button className="btn ghost" type="submit" disabled={pending}>
              ▣&nbsp;&nbsp;GITHUB
            </button>
          </form>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
