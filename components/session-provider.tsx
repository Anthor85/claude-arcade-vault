"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearUser,
  normalizeName,
  readScores,
  readUser,
  writeScores,
  writeUser,
  type SavedScore,
  type User,
} from "@/lib/session";

type SessionValue = {
  user: User | null;
  signIn: (name: string) => User;
  signOut: () => void;
  saveScore: (entry: { game: string; name: string; score: number }) => void;
  scoresFor: (gameId: string) => SavedScore[];
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Arranca en null en servidor y en el primer paint: se hidrata en el efecto.
  const [user, setUser] = useState<User | null>(null);
  const [scores, setScores] = useState<SavedScore[]>([]);

  useEffect(() => {
    setUser(readUser());
    setScores(readScores());
  }, []);

  const signIn = useCallback((name: string) => {
    const next: User = { name: normalizeName(name) };
    setUser(next);
    writeUser(next);
    return next;
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    clearUser();
  }, []);

  const saveScore = useCallback(
    (entry: { game: string; name: string; score: number }) => {
      const row: SavedScore = { ...entry, at: Date.now() };
      // Relee de localStorage por si otra pestaña escribió mientras tanto.
      const next = [...readScores(), row];
      setScores(next);
      writeScores(next);
    },
    [],
  );

  const scoresFor = useCallback(
    (gameId: string) => scores.filter((s) => s.game === gameId),
    [scores],
  );

  const value = useMemo<SessionValue>(
    () => ({ user, signIn, signOut, saveScore, scoresFor }),
    [user, signIn, signOut, saveScore, scoresFor],
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
