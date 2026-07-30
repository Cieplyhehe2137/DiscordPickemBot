import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSwissPickem, saveSwissPickem, getSwissStats } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';
import PublicAuthButton from '../components/public/PublicAuthButton';
import { usePublicAuth } from '../context/PublicAuthContext';

export default function PublicSwissPickemPage() {
    const { slug, stage } = useParams();
    const { isLoggedIn, user, loading } = usePublicAuth();
    const [data, setData] = useState(null);
    const [stats, setStats] = useState(null);
    const [threeZero, setThreeZero] = useState([]);
    const [zeroThree, setZeroThree] = useState([]);
    const [advancing, setAdvancing] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        async function loadPickem() {
            try {
                const result = await getSwissPickem(slug, stage);
                setData(result);
                const statsResult = await getSwissStats(slug, stage);
                setStats(statsResult);

                if (result.prediction) {
                    setThreeZero(result.prediction.three_zero || []);
                    setZeroThree(result.prediction.zero_three || []);
                    setAdvancing(result.prediction.advancing || []);
                }
            } catch (err) {
                console.error(err);
                setError('Nie udało się wczytać Pick&apos;Em Swiss.');
            }
        }

        loadPickem();
    }, [slug, stage]);

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

    const pickedTeams = new Set([
        ...threeZero,
        ...zeroThree,
        ...advancing
    ]);

    const canSave =
        !loading &&
        !isLocked &&
        isLoggedIn &&
        threeZero.length === 2 &&
        zeroThree.length === 2 &&
        advancing.length === 6;

    function togglePick(section, teamName) {
        setError(null);
        setSuccess(false);

        const setters = {
            threeZero: setThreeZero,
            zeroThree: setZeroThree,
            advancing: setAdvancing
        };

        const values = {
            threeZero,
            zeroThree,
            advancing
        };

        const limits = {
            threeZero: 2,
            zeroThree: 2,
            advancing: 6
        };

        const current = values[section];

        if (current.includes(teamName)) {
            setters[section](current.filter((team) => team !== teamName));
            return;
        }

        if (pickedTeams.has(teamName)) {
            setError('Ta drużyna jest już wybrana w innej kategorii.');
            return;
        }

        if (current.length >= limits[section]) {
            setError(`Możesz wybrać tutaj tylko ${limits[section]} drużyn.`);
            return;
        }

        setters[section]([...current, teamName]);
    }

    async function handleSave() {
        if (!canSave) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            await saveSwissPickem(slug, stage, {
                three_zero: threeZero,
                zero_three: zeroThree,
                advancing
            });

            setSuccess(true);
        } catch (err) {
            console.error(err);
            setError(err?.message || 'Nie udało się zapisać Pick&apos;Em Swiss.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <PageShell>
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Pick&apos;Em Swiss
            </p>

            <h1 className="mt-3 text-4xl font-black md:text-6xl">
                {data.event?.name}
            </h1>

            <div className="mt-6 flex flex-wrap gap-3">
                {[
                    ['stage1', 'Etap 1'],
                    ['stage2', 'Etap 2'],
                    ['stage3', 'Etap 3']
                ].map(([value, label]) => (
                    <Link
                        key={value}
                        to={`/public/event/${slug}/pickem/${value}`}
                        className={`rounded-2xl px-5 py-3 text-sm font-black transition ${stage === value
                            ? 'bg-violet-500 text-white'
                            : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                            }`}
                    >
                        {label}
                    </Link>
                ))}
            </div>

            <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                    Aktualny etap Swiss
                </p>

                <h2 className="mt-2 text-3xl font-black">
                    {stage === 'stage1'
                        ? 'Swiss - Etap 1'
                        : stage === 'stage2'
                            ? 'Swiss - Etap 2'
                            : 'Swiss - Etap 3'}
                </h2>

                <p className="mt-2 text-white/50">
                    Twoje typy są zapisywane osobno dla każdego etapu Swiss.
                </p>
                {isLocked && (
                    <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-red-300">
                            Pick&apos;Em zablokowane
                        </p>

                        <p className="mt-2 text-white/60">
                            {lock.message || 'Ten etap Swiss jest zamknięty na typowanie.'}
                        </p>
                    </div>
                )}
            </div>

            <p className="mt-4 max-w-3xl text-white/50">
                Wybierz 2 drużyny na 3-0, 2 drużyny na 0-3 oraz 6 drużyn awansujących.
            </p>

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
                        Zaloguj się przez Discord, aby zapisać swój Pick&apos;Em Swiss.
                    </p>

                    <a
                        href={`/api/auth/discord?returnTo=${encodeURIComponent(
                            window.location.pathname + window.location.search
                        )}`}
                        className="mt-4 inline-flex rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Zaloguj przez Discord
                    </a>
                </div>
            )}

            <div className="mt-10 grid gap-6 xl:grid-cols-3">
                <PickSection
                    title="Typy 3-0"
                    description="Wybierz dokładnie 2 drużyny."
                    teams={teams}
                    selected={threeZero}
                    limit={2}
                    pickedTeams={pickedTeams}
                    onToggle={(team) => togglePick('threeZero', team)}
                    disabled={isLocked}
                />

                <PickSection
                    title="Typy 0-3"
                    description="Wybierz dokładnie 2 drużyny."
                    teams={teams}
                    selected={zeroThree}
                    limit={2}
                    pickedTeams={pickedTeams}
                    onToggle={(team) => togglePick('zeroThree', team)}
                    disabled={isLocked}
                />

                <PickSection
                    title="Drużyny awansujące"
                    description="Wybierz dokładnie 6 drużyn."
                    teams={teams}
                    selected={advancing}
                    limit={6}
                    pickedTeams={pickedTeams}
                    onToggle={(team) => togglePick('advancing', team)}
                    disabled={isLocked}
                />
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                            Postęp
                        </p>

                        <p className="mt-2 text-white/50">
                            3-0: {threeZero.length}/2 • 0-3: {zeroThree.length}/2 • Awans: {advancing.length}/6
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
                        {saving ? 'Zapisywanie...' : "Zapisz Pick'Em Swiss"}
                    </button>
                </div>

                {success && (
                    <p className="mt-4 font-black text-green-300">
                        Pick&apos;Em Swiss zapisane!
                    </p>
                )}

                {error && (
                    <p className="mt-4 font-black text-red-300">
                        {error}
                    </p>
                )}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
                <SummaryCard
                    title="Typy 3-0"
                    teams={threeZero}
                />

                <SummaryCard
                    title="Typy 0-3"
                    teams={zeroThree}
                />

                <SummaryCard
                    title="Drużyny awansujące"
                    teams={advancing}
                />
            </div>
            {stats && (
                <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Statystyki Swiss społeczności
                    </p>

                    <p className="mt-2 text-white/50">
                        Na podstawie {stats.total_predictions} zapisanych typów Pick&apos;Em.
                    </p>

                    <div className="mt-6 grid gap-6 md:grid-cols-3">
                        <StatsColumn title="Najczęściej typowane 3-0" rows={stats.stats.three_zero} />
                        <StatsColumn title="Najczęściej typowane 0-3" rows={stats.stats.zero_three} />
                        <StatsColumn title="Najczęściej typowani awansujący" rows={stats.stats.advancing} />
                    </div>
                </div>
            )}

            <PublicFooter />
        </PageShell>
    );
}

function PickSection({
    title,
    description,
    teams,
    selected,
    limit,
    pickedTeams,
    disabled,
    onToggle
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
                    const isSelected = selected.includes(team.name);
                    const isPickedElsewhere =
                        pickedTeams.has(team.name) && !isSelected;

                    return (
                        <button
                            key={team.id || team.name}
                            onClick={() => onToggle(team.name)}
                            disabled={disabled || isPickedElsewhere}
                            className={`rounded-2xl border px-4 py-3 text-left font-black transition ${disabled
                                ? 'cursor-not-allowed border-white/5 bg-white/5 text-white/20'
                                : isSelected
                                    ? 'border-violet-400 bg-violet-500/20 text-white'
                                    : isPickedElsewhere
                                        ? 'cursor-not-allowed border-white/5 bg-white/5 text-white/20'
                                        : 'border-white/10 bg-black/30 text-white/70 hover:border-violet-400/30 hover:bg-violet-500/5'
                                }`}
                        >
                            {team.name}
                        </button>
                    );
                })}
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
                        Brak wybranych drużyn
                    </span>
                )}
            </div>
        </div>
    );
}

function StatsColumn({ title, rows }) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-black/30 p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <div className="mt-4 space-y-3">
                {(rows || []).slice(0, 8).map((row) => (
                    <div
                        key={row.team}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <p className="font-black">
                                {row.team}
                            </p>

                            <p className="text-sm font-black text-violet-300">
                                {row.count} typów
                            </p>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/40">
                            <div
                                className="h-full rounded-full bg-violet-500"
                                style={{ width: `${row.percentage}%` }}
                            />
                        </div>

                        <p className="mt-2 text-xs text-white/40">
                            {row.percentage}% graczy
                        </p>
                    </div>
                ))}

                {(rows || []).length === 0 && (
                    <p className="text-white/40">
                        Brak jeszcze danych.
                    </p>
                )}
            </div>
        </div>
    );
}
