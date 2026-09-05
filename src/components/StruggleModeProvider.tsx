"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Ctx = {
  struggleMode: boolean;
  setStruggleMode: (v: boolean) => void;
  toggle: () => void;
};

const StruggleModeContext = createContext<Ctx | null>(null);
const KEY = "fridgeforge-struggle-mode";

export function StruggleModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [struggleMode, setStruggleModeState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "1") setStruggleModeState(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setStruggleMode = useCallback((v: boolean) => {
    setStruggleModeState(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    () => setStruggleMode(!struggleMode),
    [setStruggleMode, struggleMode]
  );

  const value = useMemo(
    () => ({ struggleMode, setStruggleMode, toggle }),
    [struggleMode, setStruggleMode, toggle]
  );

  // Avoid hydration mismatch flash by rendering children once mounted prefs applied
  if (!ready) {
    return (
      <StruggleModeContext.Provider value={value}>
        {children}
      </StruggleModeContext.Provider>
    );
  }

  return (
    <StruggleModeContext.Provider value={value}>
      {children}
    </StruggleModeContext.Provider>
  );
}

export function useStruggleMode() {
  const ctx = useContext(StruggleModeContext);
  if (!ctx) throw new Error("useStruggleMode must be used within provider");
  return ctx;
}
