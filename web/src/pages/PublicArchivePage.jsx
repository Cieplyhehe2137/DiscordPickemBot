import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import { getPublicArchives } from '../lib/api';
import PublicAuthButton from '../components/public/PublicAuthButton';
import PublicFooter from '../components/public/PublicFooter';
import EmptyState from '../components/ui/EmptyState';

export default function PublicArchivePage() {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadArchives() {
      try {
        const result = await getPublicArchives();
        setArchives(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadArchives();
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <Link to="/public" className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white">
            Społeczności
          </Link>

          <div className="h-5 w-px bg-white/10" />

          <Link to="/public/leaderboard" className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white">
            Ranking
          </Link>

          <div className="h-5 w-px bg-white/10" />

          <span className="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-black text-violet-300">
            Archiwum
          </span>

          <div className="ml-auto">
            <PublicAuthButton />
          </div>
        </div>

        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
          Archiwum Pick&apos;Em
        </p>

        <h1 className="mt-3 text-4xl font-black md:text-6xl">
          Archiwum turniejów
        </h1>

        <p className="mt-4 max-w-3xl text-white/60">
          Pobierz zarchiwizowane eksporty Pick&apos;Em z zakończonych turniejów.
        </p>

        <div className="mt-10 grid gap-4">
          {loading && (
            <p className="text-white/50">
              Ładowanie archiwum...
            </p>
          )}

          {!loading && archives.length === 0 && (
            <EmptyState
              icon={Archive}
              title="Brak jeszcze zarchiwizowanych turniejów"
              description="Zakończone turnieje pojawią się tutaj po zarchiwizowaniu."
            />
          )}

          {!loading && archives.map((archive) => (
            <div
              key={archive.id}
              className="card-hover rounded-[2rem] border border-white/10 bg-white/5 p-6 transition hover:border-violet-400/30 hover:bg-violet-500/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                    Plik archiwum
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    {archive.filename}
                  </h2>

                  <p className="mt-2 text-white/40">
                    Utworzono: {archive.created_at
                      ? new Date(archive.created_at).toLocaleString()
                      : '-'}
                  </p>
                </div>

                <a
                  href={`/api/public/archives/${archive.id}/download`}
                  className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                >
                  Pobierz Excel
                </a>
              </div>
            </div>
          ))}
        </div>

        <PublicFooter />
      </div>
    </div>
  );
}
