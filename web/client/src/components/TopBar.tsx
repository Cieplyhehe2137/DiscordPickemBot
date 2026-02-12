import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type User = {
  id: string;
  username: string;
  avatar: string;
};

type Guild = {
  id: string;
  name: string;
  icon: string | null;
};

export default function TopBar() {
  const [user, setUser] = useState<User | null>(null);
  const [guild, setGuild] = useState<Guild | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const meRes = await fetch("/api/auth/me", {
        credentials: "include"
      });

      if (meRes.ok) {
        const me = await meRes.json();
        setUser(me);
      }

      const guildRes = await fetch("/api/auth/current-guild", {
        credentials: "include"
      });

      if (guildRes.ok) {
        const g = await guildRes.json();
        setGuild(g);
      }
    }

    load();
  }, []);

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  return (
    <div className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800 px-8 py-4 flex justify-between items-center">

      {/* LEFT */}
      <div className="flex items-center gap-4">

        {guild && (
          <>
            {guild.icon ? (
              <img
                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                className="w-10 h-10 rounded-xl"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-zinc-700" />
            )}

            <div className="text-white font-semibold">
              {guild.name}
            </div>
          </>
        )}

        <button
          onClick={() => navigate("/guilds")}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          Zmień serwer
        </button>

      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-4">

        {user && (
          <>
            <span className="text-sm text-zinc-400">
              {user.username}
            </span>

            <img
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
              className="w-10 h-10 rounded-full"
            />
          </>
        )}

        <button
          onClick={handleLogout}
          className="text-sm text-red-400 hover:text-red-300"
        >
          Logout
        </button>

      </div>
    </div>
  );
}
