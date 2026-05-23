import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getPublicOverview } from '../lib/api';

export default function PublicEventPage() {
    const { slug } = useParams();

    const [data, setData] = useState(null);
    const publicUrl = `${window.location.origin}/public/${slug}`;

    async function copyPublicUrl() {
        try {
            await navigator.clipboard.writeText(publicUrl);
            alert('Public link copied!');
        } catch (err) {
            console.error(err);
        }
    }


    useEffect(() => {
        async function load() {
            try {
                const result = await getPublicOverview(slug);
                setData(result);
            } catch (err) {
                console.error(err);
            }
        }

        load();
    }, [slug]);

    const event = data?.event;

    return (
        <div className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
            <div className="mx-auto max-w-7xl">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Public Event
                </p>

                <h1 className="mt-3 text-6xl font-black">
                    {event?.name || slug}
                </h1>
                <div className="mt-6 flex flex-wrap gap-4">
                    <button
                        onClick={copyPublicUrl}
                        className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Copy Public Link
                    </button>
                    <a
                        href="https://discord.gg/TWOJ-LINK"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                    >
                        Join Discord
                    </a>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-white/60">
                        {publicUrl}
                    </div>
                </div>

                <div className="mt-10 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
                        <h2 className="text-3xl font-black">
                            Top Players
                        </h2>

                        <div className="mt-6 grid gap-4">
                            {data?.leaderboard?.map((player, index) => {
                                const isTop1 = index === 0;
                                const isTop2 = index === 1;
                                const isTop3 = index === 2;

                                return (
                                    <div
                                        key={player.user_id}
                                        className={`flex items-center justify-between rounded-2xl border p-5 transition
      ${isTop1
                                                ? 'border-yellow-400/30 bg-yellow-500/10'
                                                : isTop2
                                                    ? 'border-zinc-300/20 bg-zinc-400/10'
                                                    : isTop3
                                                        ? 'border-orange-400/20 bg-orange-500/10'
                                                        : 'border-white/10 bg-black/30'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black
          ${isTop1
                                                        ? 'bg-yellow-400/20 text-yellow-200'
                                                        : isTop2
                                                            ? 'bg-zinc-300/20 text-zinc-100'
                                                            : isTop3
                                                                ? 'bg-orange-400/20 text-orange-200'
                                                                : 'bg-violet-500/20'
                                                    }`}
                                            >
                                                #{index + 1}
                                            </div>

                                            <div>
                                                <h3 className="text-2xl font-black">
                                                    {player.user_id}
                                                </h3>

                                                <p className="text-sm text-white/40">
                                                    Pick&apos;Em Player
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-3xl font-black text-green-300">
                                                {player.total_points}
                                            </p>

                                            <p className="text-sm text-white/40">
                                                points
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
                        <h2 className="text-3xl font-black">
                            Matches
                        </h2>

                        <div className="mt-6 grid gap-4">
                            {data?.matches?.map((match) => (
                                <div
                                    key={match.id}
                                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                                {match.phase} • BO{match.best_of || 3}
                                            </p>

                                            <h3 className="mt-2 text-2xl font-black">
                                                {match.team_a} vs {match.team_b}
                                            </h3>

                                            <p className="mt-2 text-sm text-white/40">
                                                Match #{match.match_no || '-'}
                                            </p>
                                        </div>

                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${match.ui_status === 'LOCKED'
                                                ? 'bg-red-500/20 text-red-300'
                                                : 'bg-green-500/20 text-green-300'
                                                }`}
                                        >
                                            {match.ui_status}
                                        </span>
                                    </div>

                                    <p className="mt-4 text-sm text-white/40">
                                        {match.start_time_utc || 'Start time TBA'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}