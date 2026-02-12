import { useEffect, useState } from "react";

type Guild = {
  id: string;
  name: string;
  icon: string | null;
};

export default function ServerSidebar() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [currentGuildId, setCurrentGuildId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me", {
        credentials: "include"
      });

      if (!meRes.ok) return;

      const me = await meRes.json();
      setGuilds(me.guilds || []);

      const currentRes = await fetch("/api/auth/current-guild", {
        credentials: "include"
      });

      if (currentRes.ok) {
        const g = await currentRes.json();
        setCurrentGuildId(g.id);
      }
    }

    load();
  }, []);

  const handleSwitch = async (guildId: string) => {
    await fetch("/api/auth/select-guild", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ guildId })
    });

    window.location.reload();
  };

  return (
    <div className="w-20 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-6 gap-4">

      {guilds.map(guild => {
        const isActive = guild.id === currentGuildId;

        return (
          <div
            key={guild.id}
            onClick={() => handleSwitch(guild.id)}
            className={`w-12 h-12 rounded-2xl cursor-pointer
              flex items-center justify-center
              transition-all duration-300
              ${isActive
                ? "ring-2 ring-indigo-500 scale-110"
                : "hover:scale-105 hover:ring-1 hover:ring-indigo-400"
              }
            `}
          >
            {guild.icon ? (
              <img
                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                className="w-full h-full rounded-2xl"
              />
            ) : (
              <div className="w-full h-full rounded-2xl bg-zinc-700 flex items-center justify-center text-xs text-white">
                {guild.name[0]}
              </div>
            )}
          </div>
        );
      })}

    </div>
  );
}
