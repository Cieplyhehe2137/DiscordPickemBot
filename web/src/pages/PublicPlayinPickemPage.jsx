import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPlayinPickem, savePlayinPickem } from "../lib/api";
import PublicFooter from "../components/public/PublicFooter";
import PublicAuthButton from "../components/public/PublicAuthButton";
import { usePublicAuth } from "../context/PublicAuthContext";

export default function PublicPlayinPickemPage() {
  const { slug } = useParams();
  const { isLoggedIn, user, loading } = usePublicAuth();

  const [data, setData] = useState(null);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadPickem() {
      try {
        const result = await getPlayinPickem(slug);
        setData(result);

        if (result.prediction) {
          setSelectedTeams(result.prediction.teams || []);
        }
      } catch (err) {
        console.error(err);
        setError("Nie udało się wczytać Pick'Em Play-In.");
      }
    }

    loadPickem();
  }, [slug]);

  if (!data) {
    return (
      <PageShell>
        <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
        <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />
        <div className="mt-10 h-96 animate-pulse rounded-[2rem] bg-white/10" />
      </PageShell>
    );
  }

  const teams = data.teams || [];

  const lock = data.lock || { allowed: true, message: null };
  const isLocked = !lock.allowed;

  const canSave =
    !loading && !isLocked && isLoggedIn && selectedTeams.length === 8;

  function toggleTeam(teamName) {
    setError(null);
    setSuccess(false);

    if (selectedTeams.includes(teamName)) {
      setSelectedTeams(selectedTeams.filter((team) => team !== teamName));
      return;
    }

    if (selectedTeams.length >= 8) {
      setError("Możesz wybrać tylko 8 drużyn.");
      return;
    }

    setSelectedTeams([...selectedTeams, teamName]);
  }

  async function handleSave() {
    if (!canSave) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await savePlayinPickem(slug, {
        teams: selectedTeams,
      });

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Nie udało się zapisać Pick'Em Play-In.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
        Pick&apos;Em Play-In
      </p>

      <h1 className="mt-3 text-4xl font-black md:text-6xl">
        {data.event?.name}
      </h1>

      <p className="mt-4 max-w-3xl text-white/50">
        Wybierz dokładnie 8 drużyn awansujących z Play-In.
      </p>

      {isLocked && (
        <div className="mt-6 rounded-[2rem] border border-red-400/20 bg-red-500/10 p-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-red-300">
            Pick&apos;Em zablokowane
          </p>

          <p className="mt-2 text-white/60">
            {lock.message || "Ten Pick&apos;Em jest zamknięty."}
          </p>
        </div>
      )}

      {isLoggedIn && user && (
        <div className="mt-6 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
            Zalogowano jako
          </p>

          <h2 className="mt-1 text-2xl font-black">
            {user.global_name || user.username}
          </h2>
        </div>
      )}

      {!loading && !isLoggedIn && (
        <div className="mt-6 rounded-[2rem] border border-yellow-400/20 bg-yellow-500/10 p-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-300">
            Wymagane logowanie
          </p>

          <p className="mt-2 text-white/60">
            Zaloguj się przez Discord, aby zapisać swój Pick&apos;Em Play-In.
          </p>

          <a
            href={`/api/auth/discord?returnTo=${encodeURIComponent(
              window.location.pathname + window.location.search,
            )}`}
            className="mt-4 inline-flex rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
          >
            Zaloguj przez Discord
          </a>
        </div>
      )}

      <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
              Wybrane drużyny
            </p>

            <p className="mt-2 text-white/50">
              {selectedTeams.length}/8 wybranych
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`rounded-2xl px-6 py-4 font-black transition ${
              canSave && !saving
                ? "bg-violet-500 hover:bg-violet-400"
                : "cursor-not-allowed bg-white/10 text-white/30"
            }`}
          >
            {saving ? "Zapisywanie..." : "Zapisz Pick'Em Play-In"}
          </button>
        </div>

        {success && (
          <p className="mt-4 font-black text-green-300">
            Pick&apos;Em Play-In zapisane!
          </p>
        )}

        {error && <p className="mt-4 font-black text-red-300">{error}</p>}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {teams.map((team) => {
          const isSelected = selectedTeams.includes(team.name);

          return (
            <button
              key={team.id || team.name}
              disabled={isLocked}
              onClick={() => toggleTeam(team.name)}
              className={`rounded-2xl border px-4 py-4 text-left font-black transition ${
                isLocked
                  ? "cursor-not-allowed border-white/5 bg-white/5 text-white/20"
                  : isSelected
                    ? "border-violet-400 bg-violet-500/20 text-white"
                    : "border-white/10 bg-black/30 text-white/70 hover:border-violet-400/30 hover:bg-violet-500/5"
              }`}
            >
              {team.name}
            </button>
          );
        })}
      </div>

      <div className="mt-8 rounded-[2rem] border border-white/10 bg-black/30 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
          Twoje typy Play-In
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {selectedTeams.length ? (
            selectedTeams.map((team) => (
              <span
                key={team}
                className="rounded-full bg-violet-500/20 px-3 py-1 text-sm font-black text-violet-300"
              >
                {team}
              </span>
            ))
          ) : (
            <span className="text-white/40">Brak wybranych drużyn</span>
          )}
        </div>
      </div>

      <PublicFooter />
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <Link
            to="/public"
            className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Społeczności
          </Link>

          <Link
            to="/public/leaderboard"
            className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Ranking
          </Link>

          <div className="ml-auto">
            <PublicAuthButton />
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
