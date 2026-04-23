import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

type Guild = {
  id: string;
  name: string;
  icon: string | null;
};

type MeResponse = {
  id: string;
  username: string;
  avatar?: string;
  guilds?: Guild[];
};

export default function GuildSelect() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await apiFetch<MeResponse>("/auth/me");

        if (!cancelled) {
          setGuilds(Array.isArray(res.guilds) ? res.guilds : []);
        }
      } catch {
        window.location.href = "/api/auth/discord";
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function selectGuild(guildId: string) {
    try {
      setError(null);

      const res = await fetch("/api/auth/select-guild", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ guildId }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "select-guild failed");
      }

      navigate(`/guilds/${guildId}`);
    } catch (err: any) {
      setError(err?.message || "Nie udało się wybrać serwera");
    }
  }

  if (loading) {
    return <div className="p-10 text-white">Ładowanie serwerów...</div>;
  }

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-5xl font-extrabold">Wybierz serwer</h1>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {guilds.length === 0 ? (
          <div className="rounded-2xl bg-zinc-900 p-6 text-zinc-400">
            Nie znaleziono serwerów, na których masz uprawnienia administratora.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {guilds.map((guild) => {
              const iconUrl = guild.icon
                ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
                : null;

              return (
                <button
                  key={guild.id}
                  type="button"
                  onClick={() => selectGuild(guild.id)}
                  className="flex items-center gap-5 rounded-3xl bg-zinc-900 p-6 text-left transition hover:bg-zinc-800"
                >
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={guild.name}
                      className="h-16 w-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-zinc-700" />
                  )}

                  <div className="min-w-0">
                    <div className="truncate text-2xl font-semibold">
                      {guild.name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}