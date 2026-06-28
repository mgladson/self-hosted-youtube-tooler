"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ViewerUser = {
  email: string;
  name: string;
  picture: string;
  role: "admin" | "customer";
};

type ViewerAuthValue = {
  user: ViewerUser | null;
  loading: boolean;
};

const ViewerAuthContext = createContext<ViewerAuthValue>({
  user: null,
  loading: true,
});

// Reads the current session once on mount via the same-origin api (the
// session cookie rides along). Either a 'customer' or an 'admin' session
// counts as logged-in for the purpose of unlocking gated profile content —
// the private api route accepts both. Rendered inside the root layout so the
// header and every page can read viewer state.
export function ViewerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ViewerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (active) setUser((data?.user as ViewerUser | null) ?? null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ViewerAuthContext.Provider value={{ user, loading }}>
      {children}
    </ViewerAuthContext.Provider>
  );
}

export function useViewerAuth(): ViewerAuthValue {
  return useContext(ViewerAuthContext);
}
