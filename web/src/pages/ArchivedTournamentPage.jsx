import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Trophy, Swords } from 'lucide-react';
import { getArchivedTournament, describeActionError } from '../lib/api';
import Breadcrumbs from '../components/layout/Breadcrumbs';
import EmptyState from '../components/ui/EmptyState';
import { translateStatus, translatePhase } from '../lib/labels';

const PAGE_SIZE = 25;

export default function ArchivedTournamentPage() {
    const { guildId, slug } = useParams();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [visible, setVisible] = useState(PAGE_SIZE);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const result = await getArchivedTournament(slug);
                if (!cancelled) setData(result);
            } catch (err) {
                console.error(err);
                if (!cancelled) setError(describeActionError(err, 'wczytać wyniki turnieju'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    }, [slug]);

    const event = data?.event;
    const standings = data?.standings || [];
    const matches = data?.matches || [];
    const phaseResults = data?.phase_results;

    const filtered = standings.filter((p) => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (
            String(p.displayname || '').toLowerCase().includes(q) ||
            String(p.user_id).includes(q)
        );
    });

    return (
        <div className="px-6 py-10">
            <div className="mx-auto max-w-6xl">
                <Breadcrumbs
                    items={[
                        { label: 'Serwery', to: '/app/guilds' },
                        { label: 'Serwer', to: `/app/guilds/${guildId}` },
                        { label: 'Archiwum', to: `/app/guilds/${guildId}/archive` },
                        { label: event?.name || slug }
                    ]}
                />

                {error && (
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        Ładowanie wyników...
                    </div>
                )}

                {!loading && data && (
                    <>
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            Zarchiwizowany turniej
                        </p>

                        <h1 className="mt-3 text-5xl font-black">
                            {event.name}
                        </h1>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <span className="rounded-2xl bg-zinc-500/15 px-4 py-2 text-sm font-black text-zinc-300">
                                {translateStatus(event.status)}
                            </span>

                            <span className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-black text-white/70">
                                {translatePhase(event.phase)}
                            </span>

                            {data.mvp && (
                                <span className="rounded-2xl bg-yellow-500/15 px-4 py-2 text-sm font-black text-yellow-300">
                                    MVP: {data.mvp.nickname}
                                    {data.mvp.team_name ? ` (${data.mvp.team_name})` : ''}
                                </span>
                            )}

                            {data.archive_file && (
                                <a
                                    href={`/api/public/archives/${data.archive_file.id}/download`}
                                    className="rounded-2xl bg-violet-500 px-5 py-2 text-sm font-black transition hover:bg-violet-400"
                                >
                                    Pobierz Excel
                                </a>
                            )}
                        </div>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            <Stat label="Gracze w klasyfikacji" value={standings.length} />
                            <Stat label="Mecze" value={matches.length} />
                            <Stat
                                label="Zwycięzca"
                                value={standings[0]?.displayname || standings[0]?.user_id || '—'}
                            />
                        </div>

                        {matches.length === 0 && (
                            <p className="mt-6 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4 text-sm text-yellow-200/80">
                                Szczegóły meczów tego turnieju zostały usunięte przy jego zamykaniu
                                (opcja czyszczenia danych). Klasyfikacja końcowa i wyniki faz są
                                zachowane, pełne dane znajdziesz w eksporcie Excel.
                            </p>
                        )}

                        <PhaseResults phaseResults={phaseResults} />

                        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <h2 className="text-3xl font-black">
                                    Klasyfikacja końcowa
                                </h2>

                                <input
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
                                    placeholder="Szukaj gracza..."
                                    className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-white outline-none transition focus:border-violet-400/40"
                                />
                            </div>

                            {standings.length === 0 && (
                                <div className="mt-6">
                                    <EmptyState
                                        icon={Trophy}
                                        title="Brak klasyfikacji"
                                        description="Dla tego turnieju nie zachowały się żadne punkty graczy."
                                    />
                                </div>
                            )}

                            <div className="mt-6 grid gap-3">
                                {filtered.slice(0, visible).map((p) => (
                                    <div
                                        key={p.user_id}
                                        className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${p.rank === 1
                                            ? 'border-yellow-400/30 bg-yellow-500/10'
                                            : p.rank === 2
                                                ? 'border-zinc-300/20 bg-zinc-400/10'
                                                : p.rank === 3
                                                    ? 'border-orange-400/20 bg-orange-500/10'
                                                    : 'border-white/10 bg-black/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 font-black">
                                                {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                                            </div>

                                            <div>
                                                <Link
                                                    to={`/public/users/${p.user_id}`}
                                                    className="text-xl font-black transition hover:text-violet-300"
                                                >
                                                    {p.displayname || p.user_id}
                                                </Link>

                                                <p className="break-all text-xs text-white/40">
                                                    {p.user_id}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <PointsChip label="Swiss" value={p.swiss_points} />
                                            <PointsChip label="Mecze" value={p.match_points} />
                                            <PointsChip label="Playoffs" value={p.playoffs_points} />
                                            <PointsChip label="Play-In" value={p.playin_points} />
                                            <PointsChip label="Double" value={p.doubleelim_points} />

                                            <div className="rounded-2xl bg-green-500/15 px-4 py-2 text-right">
                                                <p className="text-xs uppercase tracking-[0.15em] text-green-300/70">
                                                    Razem
                                                </p>
                                                <p className="text-xl font-black text-green-300">
                                                    {p.total_points}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {filtered.length > visible && (
                                <button
                                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                                    className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                                >
                                    Pokaż więcej ({filtered.length - visible} pozostało)
                                </button>
                            )}

                            {search && filtered.length === 0 && (
                                <p className="mt-6 text-white/50">
                                    Nie znaleziono gracza pasującego do „{search}”.
                                </p>
                            )}
                        </div>

                        {matches.length > 0 && (
                            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                                <h2 className="text-3xl font-black">
                                    Mecze ({matches.length})
                                </h2>

                                <div className="mt-6 grid gap-3">
                                    {matches.map((m) => (
                                        <div
                                            key={m.id}
                                            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 p-4"
                                        >
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.2em] text-violet-300">
                                                    {translatePhase(m.phase)} • BO{m.best_of || 3} • #{m.match_no ?? '—'}
                                                </p>

                                                <p className="mt-1 text-lg font-black">
                                                    {m.team_a} vs {m.team_b}
                                                </p>
                                            </div>

                                            <p className="text-2xl font-black text-violet-300">
                                                {m.res_a ?? '—'} : {m.res_b ?? '—'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {matches.length === 0 && standings.length > 0 && (
                            <div className="mt-10">
                                <EmptyState
                                    icon={Swords}
                                    title="Brak zapisanych meczów"
                                    description="Mecze tego turnieju zostały usunięte przy zamykaniu."
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function PhaseResults({ phaseResults }) {
    if (!phaseResults) return null;

    const { swiss = [], playoffs, doubleelim, playin } = phaseResults;

    const hasPlayoffs = playoffs?.semifinalists?.length || playoffs?.winner?.length;
    const hasPlayin = playin?.teams?.length;
    const hasDouble = doubleelim?.upperFinalA?.length || doubleelim?.lowerFinalA?.length;

    if (!swiss.length && !hasPlayoffs && !hasPlayin && !hasDouble) return null;

    return (
        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
            <h2 className="text-3xl font-black">
                Oficjalne wyniki faz
            </h2>

            {swiss.length > 0 && (
                <div className="mt-6 grid gap-4">
                    {swiss.map((s) => (
                        <div key={s.stage} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                Swiss — {s.stage}
                            </p>

                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                <TeamList title="3-0" value={s.correct_3_0} />
                                <TeamList title="0-3" value={s.correct_0_3} />
                                <TeamList title="Awansujący" value={s.correct_advancing} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {hasPlayoffs ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        Playoffs
                    </p>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <TeamList title="Półfinaliści" value={playoffs.semifinalists} />
                        <TeamList title="Finaliści" value={playoffs.finalists} />
                        <TeamList title="Zwycięzca" value={playoffs.winner} />
                        <TeamList title="3. miejsce" value={playoffs.third} />
                    </div>
                </div>
            ) : null}

            {hasPlayin ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        Play-In
                    </p>

                    <div className="mt-4">
                        <TeamList title="Awansujący" value={playin.teams} />
                    </div>
                </div>
            ) : null}

            {hasDouble ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        Double Elimination
                    </p>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <TeamList title="Upper Final A" value={doubleelim.upperFinalA} />
                        <TeamList title="Lower Final A" value={doubleelim.lowerFinalA} />
                        <TeamList title="Upper Final B" value={doubleelim.upperFinalB} />
                        <TeamList title="Lower Final B" value={doubleelim.lowerFinalB} />
                    </div>
                </div>
            ) : null}
        </div>
    );
}

// Wyniki faz przychodzą albo jako tablica (playoffs/playin/doubleelim z
// repozytoriów), albo jako CSV ze swiss_results - normalizujemy oba kształty.
function TeamList({ title, value }) {
    const teams = Array.isArray(value)
        ? value
        : String(value || '').split(',').map((t) => t.trim()).filter(Boolean);

    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                {title}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
                {teams.length ? (
                    teams.map((t) => (
                        <span
                            key={t}
                            className="rounded-full bg-violet-500/20 px-3 py-1 text-sm font-black text-violet-300"
                        >
                            {t}
                        </span>
                    ))
                ) : (
                    <span className="text-sm text-white/30">—</span>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {label}
            </p>

            <h2 className="mt-3 truncate text-3xl font-black">
                {value}
            </h2>
        </div>
    );
}

function PointsChip({ label, value }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">
                {label}
            </p>
            <p className="text-sm font-black text-violet-300">
                {value}
            </p>
        </div>
    );
}
