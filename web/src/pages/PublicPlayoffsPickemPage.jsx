import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPlayoffsPickem, savePlayoffsPickem } from "../lib/api";
import PublicFooter from "../components/public/PublicFooter";
import PublicAuthButton from "../components/public/PublicAuthButton";
import { usePublicAuth } from "../context/PublicAuthContext";

export default function PublicPlayoffsPickemPage() {
  const { slug } = useParams();
  const { isLoggedIn, user, loading } = usePublicAuth();

  const [data, setData] = useState(null);
  const [semifinalists, setSemifinalists] = useState([]);
  const [finalists, setFinalists] = useState([]);
  const [winner, setWinner] = useState(null);
  const [thirdPlaceWinner, setThirdPlaceWinner] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadPickem() {
      try {
        const result = await getPlayoffsPickem(slug);
        setData(result);

        if (result.prediction) {
          setSemifinalists(result.prediction.semifinalists || []);
          setFinalists(result.prediction.finalists || []);
          setWinner(result.prediction.winner || null);
          setThirdPlaceWinner(result.prediction.third_place_winner || null);
        }
      } catch (err) {
        console.error(err);
        setError("Nie udało się wczytać Pick'Em Playoffs.");
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
    !loading &&
    !isLocked &&
    isLoggedIn &&
    semifinalists.length === 4 &&
    finalists.length === 2 &&
    winner &&
    thirdPlaceWinner;

  function resetFeedback() {
    setError(null);
    setSuccess(false);
  }

  function toggleSemifinalist(teamName) {
    resetFeedback();

    if (semifinalists.includes(teamName)) {
      setSemifinalists(semifinalists.filter((team) => team !== teamName));
      setFinalists(finalists.filter((team) => team !== teamName));

      if (winner === teamName) setWinner(null);
      if (thirdPlaceWinner === teamName) setThirdPlaceWinner(null);

      return;
    }

    if (semifinalists.length >= 4) {
      setError("Możesz wybrać tylko 4 półfinalistów.");
      return;
    }

    setSemifinalists([...semifinalists, teamName]);
  }

  function toggleFinalist(teamName) {
    resetFeedback();

    if (!semifinalists.includes(teamName)) {
      setError("Finaliści muszą być wybrani spośród półfinalistów.");
      return;
    }

    if (finalists.includes(teamName)) {
      setFinalists(finalists.filter((team) => team !== teamName));

      if (winner === teamName) setWinner(null);

      return;
    }

    if (finalists.length >= 2) {
      setError("Możesz wybrać tylko 2 finalistów.");
      return;
    }

    setFinalists([...finalists, teamName]);
  }

  function selectWinner(teamName) {
    resetFeedback();

    if (!finalists.includes(teamName)) {
      setError("Zwycięzca musi być wybrany spośród finalistów.");
      return;
    }

    if (teamName === thirdPlaceWinner) {
      setError("Zwycięzca i zdobywca 3. miejsca nie mogą być tą samą drużyną.");
      return;
    }

    setWinner(teamName);
  }

  function selectThirdPlace(teamName) {
    resetFeedback();

    if (!semifinalists.includes(teamName)) {
      setError("Zdobywca 3. miejsca musi być wybrany spośród półfinalistów.");
      return;
    }

    if (teamName === winner) {
      setError("Zwycięzca i zdobywca 3. miejsca nie mogą być tą samą drużyną.");
      return;
    }

    setThirdPlaceWinner(teamName);
  }

  async function handleSave() {
    if (!canSave) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await savePlayoffsPickem(slug, {
        semifinalists,
        finalists,
        winner,
        third_place_winner: thirdPlaceWinner,
      });

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Nie udało się zapisać Pick'Em Playoffs.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
        Pick&apos;Em Playoffs
      </p>

      <h1 className="mt-3 text-4xl font-black md:text-6xl">
        {data.event?.name}
      </h1>

      <p className="mt-4 max-w-3xl text-white/50">
        Wybierz 4 półfinalistów, 2 finalistów, mistrza oraz zdobywcę 3. miejsca.
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
            Zaloguj się przez Discord, aby zapisać swój Pick&apos;Em Playoffs.
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

      <div className="mt-10 grid gap-6 xl:grid-cols-4">
        <PickColumn
          title="Półfinaliści"
          description="Wybierz dokładnie 4 drużyny."
          teams={teams.map((team) => team.name)}
          selected={semifinalists}
          limit={4}
          onToggle={toggleSemifinalist}
          isLocked={isLocked}
        />

        <PickColumn
          title="Finaliści"
          description="Wybierz dokładnie 2 spośród półfinalistów."
          teams={semifinalists}
          selected={finalists}
          limit={2}
          onToggle={toggleFinalist}
          isLocked={isLocked}
        />

        <SinglePickColumn
          title="Zwycięzca"
          description="Wybierz 1 spośród finalistów."
          teams={finalists}
          selected={winner}
          onSelect={selectWinner}
          isLocked={isLocked}
        />

        <SinglePickColumn
          title="3. miejsce"
          description="Wybierz 1 spośród półfinalistów."
          teams={semifinalists}
          selected={thirdPlaceWinner}
          onSelect={selectThirdPlace}
          isLocked={isLocked}
        />
      </div>

      <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
              Postęp
            </p>

            <p className="mt-2 text-white/50">
              Półfinaliści: {semifinalists.length}/4 • Finaliści:{" "}
              {finalists.length}/2 • Zwycięzca: {winner ? "1/1" : "0/1"} • 3.
              miejsce: {thirdPlaceWinner ? "1/1" : "0/1"}
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
            {saving ? "Zapisywanie..." : "Zapisz Pick'Em Playoffs"}
          </button>
        </div>

        {success && (
          <p className="mt-4 font-black text-green-300">
            Pick&apos;Em Playoffs zapisane!
          </p>
        )}

        {error && <p className="mt-4 font-black text-red-300">{error}</p>}
      </div>

      <PlayoffsSummary
        semifinalists={semifinalists}
        finalists={finalists}
        winner={winner}
        thirdPlaceWinner={thirdPlaceWinner}
      />

      <PublicFooter />
    </PageShell>
  );
}

function PickColumn({
  title,
  description,
  teams,
  selected,
  limit,
  onToggle,
  isLocked,
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
            {title}
          </p>

          <p className="mt-2 text-white/50">{description}</p>
        </div>

        <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black text-violet-300">
          {selected.length}/{limit}
        </span>
      </div>

      <div className="mt-6 grid gap-3">
        {teams.map((team) => {
          const isSelected = selected.includes(team);

          return (
            <button
              key={team}
              disabled={isLocked}
              onClick={() => onToggle(team)}
              className={`rounded-2xl border px-4 py-3 text-left font-black transition ${
                isSelected
                  ? "border-violet-400 bg-violet-500/20 text-white"
                  : "border-white/10 bg-black/30 text-white/70 hover:border-violet-400/30 hover:bg-violet-500/5"
              }`}
            >
              {team}
            </button>
          );
        })}

        {teams.length === 0 && (
          <p className="text-white/40">Najpierw wybierz poprzednią rundę.</p>
        )}
      </div>
    </div>
  );
}

function SinglePickColumn({
  title,
  description,
  teams,
  selected,
  onSelect,
  isLocked,
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
        {title}
      </p>

      <p className="mt-2 text-white/50">{description}</p>

      <div className="mt-6 grid gap-3">
        {teams.map((team) => {
          const isSelected = selected === team;

          return (
            <button
              key={team}
              disabled={isLocked}
              onClick={() => onSelect(team)}
              className={`rounded-2xl border px-4 py-3 text-left font-black transition ${
                isSelected
                  ? "border-violet-400 bg-violet-500/20 text-white"
                  : "border-white/10 bg-black/30 text-white/70 hover:border-violet-400/30 hover:bg-violet-500/5"
              }`}
            >
              {team}
            </button>
          );
        })}

        {teams.length === 0 && (
          <p className="text-white/40">Najpierw wybierz poprzednią rundę.</p>
        )}
      </div>
    </div>
  );
}

function PlayoffsSummary({
  semifinalists,
  finalists,
  winner,
  thirdPlaceWinner,
}) {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-4">
      <SummaryCard title="Półfinaliści" teams={semifinalists} />
      <SummaryCard title="Finaliści" teams={finalists} />
      <SummaryCard title="Zwycięzca" teams={winner ? [winner] : []} />
      <SummaryCard
        title="3. miejsce"
        teams={thirdPlaceWinner ? [thirdPlaceWinner] : []}
      />
    </div>
  );
}

function SummaryCard({ title, teams }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-black/30 p-5">
      <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
        {title}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {teams.length ? (
          teams.map((team) => (
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
