import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSwissPickem, saveSwissPickem } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';
import PublicAuthButton from '../components/public/PublicAuthButton';
import { usePublicAuth } from '../context/PublicAuthContext';

export default function PublicSwissPickemPage() {
    const { slug } = useParams();
    const { isLoggedIn, user, loading } = usePublicAuth();
    console.log({
        isLoggedIn,
        user
    });

    const [data, setData] = useState(null);
    const [threeZero, setThreeZero] = useState([]);
    const [zeroThree, setZeroThree] = useState([]);
    const [advancing, setAdvancing] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        async function loadPickem() {
            try {
                const result = await getSwissPickem(slug);
                setData(result);

                if (result.prediction) {
                    setThreeZero(result.prediction.three_zero || []);
                    setZeroThree(result.prediction.zero_three || []);
                    setAdvancing(result.prediction.advancing || []);
                }
            } catch (err) {
                console.error(err);
                setError('Failed to load Swiss Pick&apos;Em.');
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

    const pickedTeams = new Set([
        ...threeZero,
        ...zeroThree,
        ...advancing
    ]);

    const canSave =
        !loading &&
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
            setError('This team is already selected in another category.');
            return;
        }

        if (current.length >= limits[section]) {
            setError(`You can only select ${limits[section]} teams here.`);
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

            await saveSwissPickem(slug, {
                three_zero: threeZero,
                zero_three: zeroThree,
                advancing
            });

            setSuccess(true);
        } catch (err) {
            console.error(err);
            setError(err?.message || 'Failed to save Swiss Pick&apos;Em.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <PageShell>
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Swiss Pick&apos;Em
            </p>

            <h1 className="mt-3 text-4xl font-black md:text-6xl">
                {data.event?.name}
            </h1>

            <p className="mt-4 max-w-3xl text-white/50">
                Pick 2 teams for 3-0, 2 teams for 0-3 and 8 teams to advance.
            </p>

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
                        Sign in with Discord to save your Swiss Pick&apos;Em.
                    </p>

                    <a
                        href="/api/auth/discord"
                        className="mt-4 inline-flex rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Login Discord
                    </a>
                </div>
            )}

            <div className="mt-10 grid gap-6 xl:grid-cols-3">
                <PickSection
                    title="3-0 Picks"
                    description="Pick exactly 2 teams."
                    teams={teams}
                    selected={threeZero}
                    limit={2}
                    pickedTeams={pickedTeams}
                    onToggle={(team) => togglePick('threeZero', team)}
                />

                <PickSection
                    title="0-3 Picks"
                    description="Pick exactly 2 teams."
                    teams={teams}
                    selected={zeroThree}
                    limit={2}
                    pickedTeams={pickedTeams}
                    onToggle={(team) => togglePick('zeroThree', team)}
                />

                <PickSection
                    title="Advancing Teams"
                    description="Pick exactly 6 teams."
                    teams={teams}
                    selected={advancing}
                    limit={8}
                    pickedTeams={pickedTeams}
                    onToggle={(team) => togglePick('advancing', team)}
                />
            </div>

            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                            Progress
                        </p>

                        <p className="mt-2 text-white/50">
                            3-0: {threeZero.length}/2 • 0-3: {zeroThree.length}/2 • Advancing: {advancing.length}/6
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
                        {saving ? 'Saving...' : 'Save Swiss Pick&apos;Em'}
                    </button>
                </div>

                {success && (
                    <p className="mt-4 font-black text-green-300">
                        Swiss Pick&apos;Em saved!
                    </p>
                )}

                {error && (
                    <p className="mt-4 font-black text-red-300">
                        {error}
                    </p>
                )}
            </div>

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
                            disabled={isPickedElsewhere}
                            className={`rounded-2xl border px-4 py-3 text-left font-black transition ${isSelected
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