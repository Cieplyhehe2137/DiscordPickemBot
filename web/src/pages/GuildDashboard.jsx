import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGuildEvents } from '../lib/api';
import { useApp } from '../context/AppContext';

export default function GuildDashboard() {
    const { guildId } = useParams();
    const navigate = useNavigate();
    const { setSelectedGuild } = useApp();

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                setSelectedGuild({
                    id: guildId,
                    name: 'Hyperland'
                });

                const data = await getGuildEvents(guildId);

                setEvents(data.events || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [guildId]);

    return (
        <div className="px-6 py-10">
            <div className="mx-auto max-w-7xl">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Guild Dashboard
                </p>

                <h1 className="mt-3 text-5xl font-black">
                    Server {guildId}
                </h1>

                {loading && (
                    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        Loading events...
                    </div>
                )}

                {!loading && events.length === 0 && (
                    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        No events found for this server.
                    </div>
                )}

                <div className="mt-10 grid gap-6 lg:grid-cols-2">
                    {events.map((event) => (
                        <div
                            key={event.id}
                            className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                        {event.phase}
                                    </p>

                                    <h2 className="mt-3 text-3xl font-black">
                                        {event.name}
                                    </h2>
                                </div>

                                <span className="rounded-2xl bg-green-500/15 px-4 py-2 text-sm font-black text-green-300">
                                    {event.status}
                                </span>
                            </div>

                            <button
                                onClick={() => navigate(`/app/events/${event.slug}`)}
                                className="mt-8 w-full rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                            >
                                Open Event Dashboard
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}