"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api";

export type Me = {
  id: string;
  email: string | null;
  is_anonymous: boolean;
  is_admin: boolean;
  remaining_messages: number;
  limit: number;
};

type MeState = {
  me: Me | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setRemaining: (n: number) => void;
};

const MeContext = createContext<MeState | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      apiFetch<Me>("/me")
        .then((m) => {
          setMe(m);
          setError(null);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load your account."))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setRemaining = useCallback(
    (n: number) => setMe((m) => (m ? { ...m, remaining_messages: n } : m)),
    [],
  );

  return (
    <MeContext.Provider value={{ me, loading, error, refresh, setRemaining }}>{children}</MeContext.Provider>
  );
}

export function useMe(): MeState {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe must be used inside MeProvider");
  return ctx;
}
