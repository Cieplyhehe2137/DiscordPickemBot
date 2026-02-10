import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../api/useApi";

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
};

const GuildContext = createContext<GuildContextValue>({
  guildId: null,
  guild: null,
  isAdmin: false,
});

export function GuildProvider({ children }: { children: React.ReactNode }) {
  const { guildId } = useParams();
  const api = useApi();

  const [guild, setGuild] = useState<Guild | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guildId) {
      setGuild(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    api.get("/meta")
      .then((data) => {
        setGuild(data);
      })
      .catch(() => {
        setGuild(null);
      })
      .finally(() => {
        setLoading(false);
      });

  }, [guildId]);

  const isAdmin = guild?.role === "admin";

  if (loading) {
    return <div>Ładowanie serwera…</div>;
  }

  return (
    <GuildContext.Provider
      value={{
        guildId: guildId ?? null,
        guild,
        isAdmin,
      }}
    >
      {children}
    </GuildContext.Provider>
  );
}


export function useGuild() {
  return useContext(GuildContext);
}
