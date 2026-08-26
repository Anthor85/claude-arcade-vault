import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Refresca la cookie de sesión de Supabase en cada petición.
 *
 * En Next.js 16 esto es `proxy.ts` en la raíz: el antiguo Middleware pasó a
 * llamarse Proxy. La documentación de `@supabase/ssr` sigue hablando de
 * `middleware.ts`; el contenido es el mismo, el fichero no.
 *
 * El token de acceso caduca cada hora. Sin este refresco, un server component
 * se encontraría con una sesión muerta y el jugador aparecería desconectado
 * sin haber cerrado sesión. Aquí *solo* se refresca: la autorización vive en
 * las políticas RLS, que es lo que recomienda la propia documentación de Next.
 */
export async function proxy(request: NextRequest) {
  // Esta respuesta es la que se devuelve al final: es donde `setAll` escribe
  // las cookies nuevas. Sustituirla por otra más abajo perdería el refresco.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // No quitar: es la llamada que dispara el refresco del token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Un jugador ya autenticado no necesita ver la pantalla de acceso: se le
  // devuelve a la home. Punto de partida para futuras rutas que exijan sesión.
  if (user && request.nextUrl.pathname === "/acceso") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Todas las rutas menos las que no llevan sesión encima:
     * - _next/static y _next/image: los assets del build
     * - favicon.ico
     * - imágenes
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
