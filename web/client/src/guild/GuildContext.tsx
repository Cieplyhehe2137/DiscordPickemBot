import { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export type Guild = {
  id: string;
  name?: string;
  icon?: string;
};

type GuildContextValue = {
  guildId: string | null;
  guild: Guild | null;
};

const GuildContext = createContext<GuildContextValue>({
  guildId: null,
  guild: null,
});

export function GuildProvider({ children }: { children: React.ReactNode }) {
  const { guildId } = useParams();
  const [guild, setGuild] = useState<Guild | null>(null);

  useEffect(() => {
    if (!guildId) {
      setGuild(null);
      return;
    }

    // na razie tylko ID – dane dojdą z API
    setGuild({ id: guildId });
  }, [guildId]);

  return (
    <GuildContext.Provider value={{ guildId: guildId ?? null, guild }}>
      {children}
    </GuildContext.Provider>
  );
}

export function useGuild() {
  return useContext(GuildContext);
}
