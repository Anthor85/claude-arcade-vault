"use client";

import { useActionState, useRef, useState } from "react";
import { sendContactMessage } from "@/app/acerca/actions";
import type { ContactState } from "@/app/acerca/actions";
import styles from "@/components/about.module.css";

const EMPTY = { name: "", email: "", msg: "" };

export function ContactForm() {
  const [state, formAction, isPending] = useActionState<ContactState, FormData>(
    sendContactMessage,
    { status: "idle" },
  );
  const [form, setForm] = useState(EMPTY);
  const [shake, setShake] = useState(false);
  /** Tras "ENVIAR OTRO MENSAJE" el `ok` sigue en `state`: esto lo tapa. */
  const [dismissed, setDismissed] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = state.status === "ok" && !dismissed;
  const error = state.status === "error" && !isPending ? state.message : null;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Validación de cliente: si falta algo, ni se llama al servidor.
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      e.preventDefault();
      setShake(true);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShake(false), 400);
      return;
    }
    setDismissed(false);
  };

  const startOver = () => {
    setForm(EMPTY);
    setDismissed(true);
  };

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      className={`${styles.contactForm} ${shake ? styles.shake : ""}`}
      noValidate
    >
      {!showSuccess ? (
        <>
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
              maxLength={60}
              disabled={isPending}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jugador@vault.gg"
              maxLength={120}
              disabled={isPending}
            />
          </div>
          <div className="field">
            <label htmlFor="contact-msg">MENSAJE</label>
            <textarea
              id="contact-msg"
              name="msg"
              rows={5}
              value={form.msg}
              onChange={(e) => setForm({ ...form, msg: e.target.value })}
              placeholder="Cuéntanos qué tienes en mente…"
              maxLength={2000}
              disabled={isPending}
            />
          </div>

          {/* Honeypot: invisible para personas, irresistible para bots. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
            <label htmlFor="contact-website">No rellenes este campo</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          {error ? (
            <p className={`${styles.formError} pixel`} role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="btn xl press"
            type="submit"
            style={{ width: "100%" }}
            disabled={isPending}
          >
            {isPending ? "▶  ENVIANDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      ) : (
        <div className={styles.terminalSuccess}>
          <div className={styles.termBar}>
            <span className={`${styles.dot} ${styles.r}`} />
            <span className={`${styles.dot} ${styles.y}`} />
            <span className={`${styles.dot} ${styles.g}`} />
            <span className={styles.termTitle}>VAULT-OS // TERMINAL</span>
          </div>
          <div className={styles.termBody}>
            <div className={styles.line}>
              <span className={styles.prompt}>vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className={`${styles.line} ${styles.dim}`}>[OK] Conectando con servidor…</div>
            <div className={`${styles.line} ${styles.dim}`}>[OK] Validando contenido…</div>
            <div className={`${styles.line} ${styles.dim}`}>[OK] Transmitiendo paquete…</div>
            <div className={`${styles.line} ${styles.success}`}>
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS,{" "}
              {state.status === "ok" ? state.name.toUpperCase() : ""}.
              <span className={styles.caret}>_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={startOver}>
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
