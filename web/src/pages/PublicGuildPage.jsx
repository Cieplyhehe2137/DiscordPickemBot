import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, CalendarX } from 'lucide-react';
import { getPublicGuild } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';
import PublicAuthButton from '../components/public/PublicAuthButton';
import EmptyState from '../components/ui/EmptyState';

export default function PublicGuildPage() {
    const { guildSlug } = useParams();

    const [data, setData] = useState(null);

    useEffect(() => {
        async function loadGuild() {
            try {
                const result = await getPublicGuild(guildSlug);
                setData(result);
            } catch (err) {
                console.error(err);
            }
        }

        loadGuild();
    }, [guildSlug]);

    if (!data) {
        return (
            <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />

                <div className="relative z-10 mx-auto max-w-7xl">
                    <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />
                    <div className="mt-10 h-72 animate-pulse rounded-[2rem] bg-white/10" />
                </div>
            </div>
        );
    }

    const guild = data.guild;
    const featuredEvent = data.featured_event;

    return (
        <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 pb-28 text-white xl:pb-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />

            <div className="relative z-10 mx-auto max-w-7xl">
                <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <a
                        href="/public"
                        className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Communities
                    </a>

                    <div className="h-5 w-px bg-white/10" />

                    <span className="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-black text-violet-300">
                        {guild.name}
                    </span>

                    {featuredEvent && (
                        <>
                            <div className="h-5 w-px bg-white/10" />

                            <a
                                href={`/public/event/${featuredEvent.slug}`}
                                className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                            >
                                Featured Event
                            </a>
                        </>
                    )}
                    <div className="ml-auto">
                        <PublicAuthButton />
                    </div>
                </div>

                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Community Hub
                </p>

                <h1 className="mt-3 text-4xl font-black md:text-6xl">
                    {guild.name}
                </h1>

                <p className="mt-4 max-w-2xl text-white/50">
                    Follow active Pick&apos;Em events, live matches and community leaderboards.
                </p>

                <div className="mt-6 flex flex-wrap gap-4">
                    {guild.discord_url && (
                        <a
                            href={guild.discord_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                        >
                            Join Discord
                        </a>
                    )}

                    {featuredEvent && (
                        <a
                            href={`/public/event/${featuredEvent.slug}`}
                            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                        >
                            Open Featured Event
                        </a>
                    )}
                </div>

                <div className="mt-10 grid gap-6 md:grid-cols-3">
                    <CommunityStat title="Events" value={data?.stats?.events ?? 0} />
                    <CommunityStat title="Players" value={data?.stats?.participants ?? 0} />
                    <CommunityStat title="Predictions" value={data?.stats?.predictions ?? 0} />
                </div>

                {featuredEvent && (
                    <div className="relative mt-10 overflow-hidden rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-8 shadow-[0_0_60px_rgba(139,92,246,0.15)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.25),transparent_45%)]" />

                        <div className="relative z-10">
                            <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">
                                Featured Event
                            </p>

                            <h2 className="mt-4 text-4xl font-black md:text-5xl">
                                {featuredEvent.name}
                            </h2>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <span className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-white/70">
                                    {featuredEvent.phase}
                                </span>

                                <span
                                    className={`rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.15em] ${featuredEvent.status === 'OPEN'
                                            ? 'bg-green-500/20 text-green-300'
                                            : featuredEvent.status === 'CLOSED'
                                                ? 'bg-red-500/20 text-red-300'
                                                : 'bg-zinc-500/20 text-zinc-300'
                                        }`}
                                >
                                    {featuredEvent.status}
                                </span>
                            </div>

                            <a
                                href={`/public/event/${featuredEvent.slug}`}
                                className="mt-8 inline-flex rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                            >
                                Open Event
                            </a>
                        </div>
                    </div>
                )}

                <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Top Community Players
                    </p>

                    <div className="mt-6 grid gap-4">
                        {(data.top_players || []).map((player, index) => (
                            <a
                                key={player.user_id}
                                href={`/public/users/${player.user_id}`}
                                className="card-hover flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-violet-400/30 hover:bg-violet-500/5"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 font-black">
                                        #{index + 1}
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-black">
                                            {player.user_id}
                                        </h3>

                                        <p className="text-sm text-white/40">
                                            Community Player
                                        </p>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-2xl font-black text-green-300">
                                        {player.total_points}
                                    </p>

                                    <p className="text-sm text-white/40">
                                        points
                                    </p>
                                </div>
                            </a>
                        ))}

                        {(data.top_players || []).length === 0 && (
                            <EmptyState
                                icon={Trophy}
                                title="No community leaderboard yet"
                                description="Points will show up here once members start predicting."
                            />
                        )}
                    </div>
                </div>

                <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Events
                    </p>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {(data.events || []).map((event) => (
                            <a
                                key={event.id}
                                href={`/public/event/${event.slug}`}
                                className="card-hover rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-violet-400/30 hover:bg-violet-500/5"
                            >
                                <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                    {event.phase}
                                </p>

                                <h3 className="mt-2 text-2xl font-black">
                                    {event.name}
                                </h3>

                                <span
                                    className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${event.status === 'OPEN'
                                            ? 'bg-green-500/20 text-green-300'
                                            : event.status === 'CLOSED'
                                                ? 'bg-red-500/20 text-red-300'
                                                : 'bg-zinc-500/20 text-zinc-300'
                                        }`}
                                >
                                    {event.status}
                                </span>
                            </a>
                        ))}

                        {(data.events || []).length === 0 && (
                            <EmptyState
                                icon={CalendarX}
                                title="No public events yet"
                                description="This community hasn't opened a Pick'Em event yet."
                            />
                        )}
                    </div>
                </div>

                <PublicFooter />
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-zinc-950/90 p-4 backdrop-blur xl:hidden">
                <div className="flex gap-3">
                    {guild.discord_url && (
                        <a
                            href={guild.discord_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 rounded-2xl bg-violet-500 px-5 py-4 text-center font-black transition hover:bg-violet-400"
                        >
                            Join Discord
                        </a>
                    )}

                    {featuredEvent && (
                        <a
                            href={`/public/event/${featuredEvent.slug}`}
                            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center font-black text-white/80 transition hover:bg-white/10"
                        >
                            Open Event
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

function CommunityStat({ title, value }) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <h2 className="mt-3 text-4xl font-black">
                {value}
            </h2>
        </div>
    );
}