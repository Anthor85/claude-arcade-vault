import Link from "next/link";

/**
 * El 404 se presenta como salida de la propia máquina: el mueble CRT encendido
 * mostrando GAME OVER. Reutiliza las clases .crt* de globals.css; los tamaños
 * puntuales van inline para no tocar la hoja de estilos.
 */
export default function NotFound() {
  return (
    <div className="fade-in" style={{ padding: "56px 24px 72px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="crt">
          <div className="crt-screen">
            <div className="crt-content">
              <div>
                <div
                  className="pixel neon-magenta flicker"
                  style={{
                    fontSize: "clamp(18px, 5vw, 32px)",
                    letterSpacing: "0.08em",
                  }}
                >
                  GAME OVER
                </div>
                <div
                  className="pixel neon-cyan"
                  style={{
                    fontSize: "clamp(32px, 9vw, 64px)",
                    margin: "18px 0 14px",
                  }}
                >
                  404
                </div>
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    lineHeight: 2,
                    color: "var(--ink-dim)",
                    letterSpacing: "0.18em",
                  }}
                >
                  ESTE CARTUCHO NO ESTÁ EN EL VAULT
                  <span className="blink">_</span>
                </div>
              </div>
            </div>
          </div>
          <div className="crt-bottom">
            <span className="led">CABINA 07</span>
            <span>CARTUCHO NO ENCONTRADO</span>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 28 }}>
          <Link href="/juegos" className="btn lg">
            VOLVER AL VAULT
          </Link>
        </div>
      </div>
    </div>
  );
}
