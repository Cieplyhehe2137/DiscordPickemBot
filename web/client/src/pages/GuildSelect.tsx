import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Guild = {
  id: string;
  name: string;
  icon: string | null;
};

export default function GuildSelect() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const res = await fetch("http://localhost:3301/api/auth/me", {
        credentials: "include"
      });

      if (!res.ok) {
        navigate("/");
        return;
      }

      const json = await res.json();
      setGuilds(json.guilds || []);
    }

    load();
  }, []);

  const handleSelect = async (guildId: string) => {
    await fetch("http://localhost:3301/api/auth/select-guild", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ guildId })
    });

    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black p-12 text-white">
      <div className="max-w-5xl mx-auto space-y-12">

        <h1 className="text-4xl font-bold">
          Wybierz serwer
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">

          {guilds.map(guild => (
            <div
              key={guild.id}
              onClick={() => handleSelect(guild.id)}
              className="bg-zinc-900/70 backdrop-blur
                         border border-zinc-800
                         rounded-3xl p-10
                         flex flex-col items-center
                         cursor-pointer
                         hover:border-indigo-500
                         hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                         hover:scale-105
                         transition-all duration-300"
            >
              {guild.icon ? (
                <img
                  src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                  className="w-20 h-20 rounded-2xl mb-4"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-zinc-700 mb-4 flex items-center justify-center">
                  ?
                </div>
              )}

              <h2 className="text-lg font-semibold text-center">
                {guild.name}
              </h2>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
