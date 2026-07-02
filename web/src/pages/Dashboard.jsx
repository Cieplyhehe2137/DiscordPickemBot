import { useEffect, useState } from 'react';
import { Trophy, Users, CalendarDays } from 'lucide-react';
import { getActiveEvents } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await getActiveEvents();

                setEvents(data.events || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* TOPBAR */}
            <header className="border-b border-white/10 bg-black/30 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
                    <div>
                        <h1 className="text-3xl font-black tracking-widest">
                            PICKEMBOT
                        </h1>

                        <p className="text-sm text-white/40">
                            Pick&apos;Em Dashboard
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3">
                        Admin Panel
                    </div>
                </div>
            </header>

            {/* CONTENT */}
            <main className="mx-auto max-w-7xl px-6 py-10">
                <div className="mb-10">
                    <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-300">
                        Dashboard
                    </p>

                    <h2 className="mt-2 text-5xl font-black">
                        Active Events
                    </h2>
                </div>

                {loading && (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        Loading events...
                    </div>
                )}

                {!loading && events.length === 0 && (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        No active events found.
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    {events.map((event) => (
                        <div
                            key={event.id}
                            className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition hover:border-violet-400/30 hover:bg-white/10"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                                        {event.phase}
                                    </p>

                                    <h3 className="mt-3 text-4xl font-black">
                                        {event.name}
                                    </h3>
                                </div>

                                <div className="rounded-2xl bg-green-500/15 px-4 py-2 text-sm font-black text-green-300">
                                    ACTIVE
                                </div>
                            </div>

                            <div className="mt-8 grid gap-4">
                                <InfoCard
                                    icon={<Users size={18} />}
                                    label="Participants"
                                    value="124"
                                />

                                <InfoCard
                                    icon={<Trophy size={18} />}
                                    label="Predictions"
                                    value="981"
                                />

                                <InfoCard
                                    icon={<CalendarDays size={18} />}
                                    label="Deadline"
                                    value="5 days left"
                                />
                            </div>

                            <button
                                onClick={() => navigate(`/app/events/${event.slug || event.id}`)}
                                className="mt-8 w-full rounded-2xl bg-violet-500 px-6 py-4 text-lg font-black transition hover:bg-violet-400"
                            >
                                Open Event
                            </button>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

function InfoCard({ icon, label, value }) {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-center gap-3 text-white/60">
                {icon}
                <span>{label}</span>
            </div>

            <strong>{value}</strong>
        </div>
    );
}