import { useEffect, useState } from 'react';
import { getPublicServers } from '../lib/api';

export default function PublicServersPage() {
    const [data, setData] = useState(null);

    useEffect(() => {
        async function loadServers() {
            try {
                const result = await getPublicServers();
                setData(result);
            } catch (err) {
                console.error(err);
            }
        }

        loadServers();
    }, []);

    if (!data) {
        return (
            <div className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
                <div className="mx-auto max-w-7xl">
                    <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />
                    <div className="mt-10 grid gap-6 md:grid-cols-2">
                        <div className="h-56 animate-pulse rounded-[2rem] bg-white/10" />
                        <div className="h-56 animate-pulse rounded-[2rem] bg-white/10" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
            <div className="mx-auto max-w-7xl">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Pick&apos;Em Platform
                </p>

                <h1 className="mt-3 text-4xl font-black md:text-6xl">
                    Choose your community
                </h1>

                <p className="mt-4 max-w-2xl text-white/50">

                    <div className="mt-6 flex flex-wrap gap-4">
                        <a
                            href="/public/hyperland"
                            className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                        >
                            Open Hyperland Hub
                        </a>

                        <a
                            href="https://discord.gg/NJhspKrXNK"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                        >
                            Join Discord
                        </a>
                    </div>
                    Browse active Pick&apos;Em communities, join Discord and follow live events.
                </p>

                <div className="mt-10 grid gap-6 md:grid-cols-2">
                    {(data.servers || []).map((server) => (
                        <div
                            key={server.guild_id}
                            className="rounded-[2rem] border border-white/10 bg-white/5 p-8 transition hover:border-violet-400/30 hover:bg-violet-500/5"
                        >
                            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                                Community
                            </p>

                            <h2 className="mt-3 text-4xl font-black">
                                {server.name}
                            </h2>

                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                <PublicMiniStat title="Events" value={server.events_count} />
                                <PublicMiniStat title="Open Events" value={server.open_events} />
                            </div>

                            <div className="mt-6 flex flex-wrap gap-4">
                                <a
                                    href={`/public/${server.slug}`}
                                    className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                                >
                                    Open Hub
                                </a>

                                <a
                                    href={server.discord_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                                >
                                    Join Discord
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function PublicMiniStat({ title, value }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                {title}
            </p>

            <p className="mt-2 text-3xl font-black text-violet-300">
                {value}
            </p>
        </div>
    );
}