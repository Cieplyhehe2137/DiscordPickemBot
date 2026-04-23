import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

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
      try {
        const res = await apiFetch<{ guilds: Guild[] }>("/auth/me");
        setGuilds(res.guilds || []);
      } catch {
        navigate("/");
      }
    }

    load();
  }, [navigate]);

  async function selectGuild(guildId: string) {
  // console.log("SELECT GUILD CLICK:", guildId);

  const res = await fetch("/api/auth/select-guild", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ guildId }),
  });

  const text = await res.text();
  // console.log("SELECT GUILD RESPONSE:", res.status, text);

  if (!res.ok) {
    throw new Error(text || "select-guild failed");
  }

  navigate(`/guilds/#{guildId}`);
}

  return (
    <div className="min-h-screen bg-black text-white p-12">
      <div className="max-w-5xl mx-auto space-y-10">
        <h1 className="text-4xl font-bold">Wybierz serwer</h1>

        <div className="grid md:grid-cols-3 gap-6">
          {guilds.map((g) => (
            <div
              key={g.id}
              onClick={() => selectGuild(g.id)}
              className="p-6 rounded-2xl bg-zinc-900 hover:bg-zinc-800 cursor-pointer transition"
            >
              <div className="flex items-center gap-4">
                {g.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`}
                    className="w-12 h-12 rounded-xl"
                  />
                ) : (
                  <div className="w-12 h-12 bg-zinc-700 rounded-xl" />
                )}

                <div>{g.name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}