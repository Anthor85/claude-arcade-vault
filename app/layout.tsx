import type { Metadata } from "next";
import {
  Press_Start_2P,
  JetBrains_Mono,
  Courier_Prime,
} from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { SessionProvider } from "@/components/session-provider";
import { SiteFooter } from "@/components/site-footer";
import { getSessionUser } from "@/lib/supabase/session";

const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const courierPrime = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Juega online y compite por la puntuación más alta.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // La sesión se resuelve en servidor para que el nav pinte el nick ya en el
  // primer paint, en vez de aparecer "Iniciar Sesión" y corregirse después.
  const user = await getSessionUser();

  return (
    <html
      lang="es"
      className={`${pressStart.variable} ${jetbrainsMono.variable} ${courierPrime.variable}`}
    >
      <body>
        <div className="av-bg" aria-hidden />
        <div className="av-noise" aria-hidden />
        <SessionProvider initialUser={user}>
          <div className="av-root">
            <Nav />
            <main className="av-main">{children}</main>
            <SiteFooter />
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
