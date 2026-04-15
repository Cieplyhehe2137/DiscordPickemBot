import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api/client";

export type GuildRole = "admin" | "viewer";

export type Guild = {
  id: string;
  name?: string;
  slug?: string;
  icon?: string;
  role?: GuildRole;
};

type GuildContextValue = {
  guildId: string | null;
  guild: Guild | null;
  isAdmin: boolean;
  loading: boolean;
};

const GuildContext = createContext<GuildContextValue>({
  guildId: null,
  guild: null,
  isAdmin: false,
  loading: true,
});

export function GuildProvider({ children }: { children: React.ReactNode }) {
  const { guildId } = useParams();
  const [guild, setGuild] = useState<Guild | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!guildId) {
        setGuild(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await apiFetch(`/guilds/${guildId}/meta`);
        setGuild(data);
      } catch {
        setGuild(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [guildId]);

  return (
    <GuildContext.Provider
      value={{
        guildId: guildId ?? null,
        guild, 
        isAdmin: guild?.role === "admin",
        loading,
      }}
    >
      {children}
    </GuildContext.Provider>
  );
}

export function useGuild() {
  return useContext(GuildContext);
}