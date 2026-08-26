"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

/** El jugador tal y como lo necesita la interfaz: identidad, nick y avatar. */
export type SessionUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

type SessionValue = {
  user: SessionUser | null;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Reparte la sesión al árbol de cliente.
 *
 * El usuario llega ya resuelto desde el servidor (`app/layout.tsx`), así que el
 * primer paint pinta el nick: no hay parpadeo de "no logueado" al recargar. El
 * efecto solo escucha cambios posteriores —entrar o salir en otra pestaña—.
 */
export function SessionProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  // Si el servidor cambia de opinión (navegación, revalidación), manda él.
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // El nick vive en profiles, no en el token: en vez de consultarlo aquí
      // se le pide al servidor que vuelva a renderizar con la sesión nueva.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  }, [router]);

  const value = useMemo<SessionValue>(
    () => ({ user, signOut }),
    [user, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}
