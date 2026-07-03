import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGuilds } from '../lib/api';

export default function GuildSelect() {
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const data = await getGuilds();
        setGuilds(data.guilds || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
          PickemBot
        </p>

        <h1 className="mt-3 text-5xl font-black">
          Select Server
        </h1>

        {loading && (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
            Loading servers...
          </div>
        )}

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {guilds.map((guild, index) => (
            <button
              key={guild.id}
              onClick={() => navigate(`/app/guilds/${guild.id}`)}
              style={{ animationDelay: `${index * 60}ms` }}
              className="card-hover animate-fade-in-up rounded-[2rem] border border-white/10 bg-white/5 p-8 text-left transition hover:border-violet-400/40 hover:bg-white/10"
            >
              <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {guild.role}
              </p>

              <h2 className="mt-3 text-3xl font-black">
                {guild.name}
              </h2>

              <p className="mt-4 text-white/40">
                ID: {guild.id}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}