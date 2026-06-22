import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPlayoffsPickem, savePlayoffsPickem } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';
import PublicAuthButton from '../components/public/PublicAuthButton';
import { usePublicAuth } from '../context/PublicAuthContext';

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
                setError("Failed to load Playoffs Pick'Em.");
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
            setError('You can only select 4 semifinalists.');
            return;
        }

        setSemifinalists([...semifinalists, teamName]);
    }

    function toggleFinalist(teamName) {
        resetFeedback();

        if (!semifinalists.includes(teamName)) {
            setError('Finalists must be selected from semifinalists.');
            return;
        }

        if (finalists.includes(teamName)) {
            setFinalists(finalists.filter((team) => team !== teamName));

            if (winner === teamName) setWinner(null);

            return;
        }

        if (finalists.length >= 2) {
            setError('You can only select 2 finalists.');
            return;
        }

        setFinalists([...finalists, teamName]);
    }

    function selectWinner(teamName) {
        resetFeedback();

        if (!finalists.includes(teamName)) {
            setError('Winner must be selected from finalists.');
            return;
        }

        if (teamName === thirdPlaceWinner) {
            setError('Winner and third place winner cannot be the same team.');
            return;
        }

        setWinner(teamName);
    }

    function selectThirdPlace(teamName) {
        resetFeedback();

        if (!semifinalists.includes(teamName)) {
            setError('Third place winner must be selected from semifinalists.');
            return;
        }

        if (teamName === winner) {
            setError('Winner and third place winner cannot be the same team.');
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
                third_place_winner: thirdPlaceWinner
            });

            setSuccess(true);
        } catch (err) {
            console.error(err);
            setError(err?.message || "Failed to save Playoffs Pick'Em.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <PageShell>
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Playoffs Pick&apos;Em
            </p>

            <h1 className="mt-3 text-4xl font-black md:text-6xl">
                {data.event?.name}
            </h1>

            <p className="mt-4 max-w-3xl text-white/50">
                Pick 4 semifinalists, 2 finalists, the champion and the third place winner.
            </p>

            {isLocked && (
                <div className="mt-6 rounded-[2rem] border border-red-400/20 bg-red-500/10 p-6">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-red-300">
                        Pick&apos;Em Locked
                    </p>

                    <p className="mt-2 text-white/60">
                        {lock.message || 'This Pick&apos;Em is closed.'}
                    </p>
                </div>
            )}

            {isLoggedIn && user && (
                <div className="mt-6 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-6">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        Signed in as
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                        {user.global_name || user.username}
                    </h2>
                </div>
            )}

            {!loading && !isLoggedIn && (
                <div className="mt-6 rounded-[2rem] border border-yellow-400/20 bg-yellow-500/10 p-6">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-300">
                        Login Required
                    </p>

                    <p className="mt-2 text-white/60">
                        Sign in with Discord to save your Playoffs Pick&apos;Em.
                    </p>

                    <a
                        href={`/api/auth/discord?returnTo=${encodeURIComponent(
                            window.location.pathname + window.location.search
                        )}`}
                        className="mt-4 inline-flex rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Login Discord
                    </a>
                </div>
            )}

            <div className="mt-10 grid gap-6 xl:grid-cols-4">
                <PickColumn
                    title="Semifinalists"
                    description="Pick exactly 4 teams."
                    teams={teams.map((team) => team.name)}
                    selected={semifinalists}
                    limit={4}
                    onToggle={toggleSemifinalist}
                    isLocked={isLocked}
                />

                <PickColumn
                    title="Finalists"
                    description="Pick exactly 2 from semifinalists."
                    teams={semifinalists}
                    selected={finalists}
                    limit={2}
                    onToggle={toggleFinalist}
                    isLocked={isLocked}
                />

                <SinglePickColumn
                    title="Winner"
                    description="Pick 1 from finalists."
                    teams={finalists}
                    selected={winner}
                    onSelect={selectWinner}
                    isLocked={isLocked}
                />

                <SinglePickColumn
                    title="Third Place"
                    description="Pick 1 from semifinalists."
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
                            Progress
                        </p>

                        <p className="mt-2 text-white/50">
                            Semifinalists: {semifinalists.length}/4 • Finalists: {finalists.length}/2 • Winner: {winner ? '1/1' : '0/1'} • Third: {thirdPlaceWinner ? '1/1' : '0/1'}
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!canSave || saving}
                        className={`rounded-2xl px-6 py-4 font-black transition ${canSave && !saving
                            ? 'bg-violet-500 hover:bg-violet-400'
                            : 'cursor-not-allowed bg-white/10 text-white/30'
                            }`}
                    >
                        {saving ? 'Saving...' : "Save Playoffs Pick'Em"}
                    </button>
                </div>

                {success && (
                    <p className="mt-4 font-black text-green-300">
                        Playoffs Pick&apos;Em saved!
                    </p>
                )}

                {error && (
                    <p className="mt-4 font-black text-red-300">
                        {error}
                    </p>
                )}
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
    isLocked
}) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        {title}
                    </p>

                    <p className="mt-2 text-white/50">
                        {description}
                    </p>
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
                            className={`rounded-2xl border px-4 py-3 text-left font-black transition ${isSelected
                                ? 'border-violet-400 bg-violet-500/20 text-white'
                                : 'border-white/10 bg-black/30 text-white/70 hover:border-violet-400/30 hover:bg-violet-500/5'
                                }`}
                        >
                            {team}
                        </button>
                    );
                })}

                {teams.length === 0 && (
                    <p className="text-white/40">
                        Select previous round first.
                    </p>
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
    isLocked
}) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <p className="mt-2 text-white/50">
                {description}
            </p>

            <div className="mt-6 grid gap-3">
                {teams.map((team) => {
                    const isSelected = selected === team;

                    return (
                        <button
                            key={team}
                            disabled={isLocked}
                            onClick={() => onSelect(team)}
                            className={`rounded-2xl border px-4 py-3 text-left font-black transition ${isSelected
                                ? 'border-violet-400 bg-violet-500/20 text-white'
                                : 'border-white/10 bg-black/30 text-white/70 hover:border-violet-400/30 hover:bg-violet-500/5'
                                }`}
                        >
                            {team}
                        </button>
                    );
                })}

                {teams.length === 0 && (
                    <p className="text-white/40">
                        Select previous round first.
                    </p>
                )}
            </div>
        </div>
    );
}

function PlayoffsSummary({
    semifinalists,
    finalists,
    winner,
    thirdPlaceWinner
}) {
    return (
        <div className="mt-8 grid gap-4 md:grid-cols-4">
            <SummaryCard title="Semifinalists" teams={semifinalists} />
            <SummaryCard title="Finalists" teams={finalists} />
            <SummaryCard title="Winner" teams={winner ? [winner] : []} />
            <SummaryCard title="Third Place" teams={thirdPlaceWinner ? [thirdPlaceWinner] : []} />
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
                    <span className="text-white/40">
                        No teams selected
                    </span>
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
                    <a
                        href="/public"
                        className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Communities
                    </a>

                    <a
                        href="/public/leaderboard"
                        className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Leaderboard
                    </a>

                    <div className="ml-auto">
                        <PublicAuthButton />
                    </div>
                </div>

                {children}
            </div>
        </div>
    );
}