import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { me } from "@/server/auth.fn";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => me(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  return (
    <Ctx.Provider value={{ user: data ?? null, loading: isLoading, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
