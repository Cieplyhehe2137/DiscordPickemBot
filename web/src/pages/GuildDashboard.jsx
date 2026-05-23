import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    getGuildEvents,
    getGuildMeta,
    createGuildEvent,
    updateEventStatus
} from '../lib/api';
import { useApp } from '../context/AppContext';

export default function GuildDashboard() {
    const { guildId } = useParams();
    const navigate = useNavigate();
    const { setSelectedGuild } = useApp();

    const [events, setEvents] = useState([]);
    const [guild, setGuild] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [eventName, setEventName] = useState('');
    const [eventSlug, setEventSlug] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);

    const [statusFilter, setStatusFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    const normalizedSlug = eventSlug
        .toLowerCase()
        .trim()
        .replaceAll(/[^a-z0-9-]/g, '-')
        .replaceAll(/-+/g, '-')
        .replace(/^-|-$/g, '');

    const filteredEvents = events
        .filter((event) => {
            const matchesStatus =
                statusFilter === 'ALL' || event.status === statusFilter;

            const matchesSearch =
                event.name.toLowerCase().includes(search.toLowerCase()) ||
                event.slug.toLowerCase().includes(search.toLowerCase());

            return matchesStatus && matchesSearch;
        })
        .sort((a, b) => {
            if (sortBy === 'newest') return b.id - a.id;
            if (sortBy === 'oldest') return a.id - b.id;
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'status') return a.status.localeCompare(b.status);

            return 0;
        });

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);

                const meta = await getGuildMeta(guildId);
                setGuild(meta.guild);
                setSelectedGuild(meta.guild);

                const data = await getGuildEvents(guildId);
                setEvents(data.events || []);
                setStats(data.stats || null);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, [guildId, setSelectedGuild]);

    async function refreshEvents() {
        const data = await getGuildEvents(guildId);

        setEvents(data.events || []);
        setStats(data.stats || null);
    }

    async function handleCreateEvent() {
        try {
            setCreating(true);
            setCreateError(null);

            await createGuildEvent(guildId, {
                name: eventName.trim(),
                slug: normalizedSlug
            });

            await refreshEvents();

            setEventName('');
            setEventSlug('');
            setShowCreateModal(false);
        } catch (err) {
            console.error(err);
            setCreateError(err.message || 'Could not create event');
        } finally {
            setCreating(false);
        }
    }

    async function handleStatusUpdate(slug, status) {
        try {
            await updateEventStatus(slug, status);
            await refreshEvents();
        } catch (err) {
            console.error(err);
        }
    }

    async function handleArchiveEvent(event) {
        const confirmed = window.confirm(
            `Archive event "${event.name}"?\n\nThis will hide it from active views, but it will not delete data from the database.`
        );

        if (!confirmed) return;

        await handleStatusUpdate(event.slug, 'ARCHIVED');
    }

    async function handleCopyPublicLink(slug) {
        const url = `${window.location.origin}/public/${slug}`;

        try {
            await navigator.clipboard.writeText(url);
            alert('Public link copied!');
        } catch (err) {
            console.error(err);
        }
    }

    return (
        <div className="px-6 py-10">
            <div className="mx-auto max-w-7xl">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Guild Dashboard
                </p>

                <h1 className="mt-3 text-5xl font-black">
                    {guild?.name || guildId}
                </h1>

                <p className="mt-4 max-w-2xl text-lg text-white/50">
                    {guild?.description}
                </p>

                <div className="mt-10 grid gap-6 md:grid-cols-4">
                    <GuildStat title="Total Events" value={stats?.totalEvents ?? 0} />
                    <GuildStat title="Active" value={stats?.activeEvents ?? 0} />
                    <GuildStat title="Closed" value={stats?.closedEvents ?? 0} />
                    <GuildStat title="Archived" value={stats?.archivedEvents ?? 0} />
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black">
                            Events
                        </h2>

                        <p className="mt-2 text-white/50">
                            Manage Pick&apos;Em events for this server.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Create Event
                    </button>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                    {['ALL', 'OPEN', 'CLOSED', 'ARCHIVED'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`rounded-2xl border px-5 py-3 text-sm font-black transition ${statusFilter === status
                                    ? 'border-violet-400/40 bg-violet-500/20 text-violet-200'
                                    : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-[1fr_260px]">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search events..."
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                    />

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="name">Name A-Z</option>
                        <option value="status">Status</option>
                    </select>
                </div>

                {loading && (
                    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        Loading events...
                    </div>
                )}

                {!loading && filteredEvents.length === 0 && (
                    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        {events.length === 0
                            ? 'No events found for this server.'
                            : 'No events match your current filters.'}
                    </div>
                )}

                <div className="mt-8 text-sm font-bold text-white/40">
                    Showing {filteredEvents.length} of {events.length} events
                </div>

                <div className="mt-10 grid gap-6 lg:grid-cols-2">
                    {filteredEvents.map((event) => (
                        <div
                            key={event.id}
                            className="rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                        {event.phase}
                                    </p>

                                    <h2 className="mt-3 text-3xl font-black">
                                        {event.name}
                                    </h2>
                                </div>

                                <span
                                    className={`rounded-2xl px-4 py-2 text-sm font-black ${event.status === 'OPEN'
                                            ? 'bg-green-500/15 text-green-300'
                                            : event.status === 'CLOSED'
                                                ? 'bg-red-500/15 text-red-300'
                                                : 'bg-zinc-500/15 text-zinc-300'
                                        }`}
                                >
                                    {event.status}
                                </span>
                            </div>

                            <div className="mt-6 grid grid-cols-3 gap-3">
                                <MiniStat
                                    label="Players"
                                    value={event.participants_count || 0}
                                />

                                <MiniStat
                                    label="Predictions"
                                    value={event.predictions_count || 0}
                                />

                                <MiniStat
                                    label="Matches"
                                    value={event.matches_count || 0}
                                />
                            </div>

                            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-sm text-white/40">
                                    Slug
                                </p>

                                <p className="mt-1 font-mono text-sm text-violet-200">
                                    {event.slug}
                                </p>

                                <p className="mt-4 text-sm text-white/40">
                                    Created
                                </p>

                                <p className="mt-1 text-sm font-bold text-white/70">
                                    {event.created_at || '-'}
                                </p>
                            </div>

                            <button
                                onClick={() => navigate(`/app/events/${event.slug}`)}
                                className="mt-8 w-full rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                            >
                                Open Event Dashboard
                            </button>

                            <button
                                onClick={() => window.open(`/public/${event.slug}`, '_blank')}
                                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                            >
                                Open Public Page
                            </button>

                            <button
                                onClick={() => handleCopyPublicLink(event.slug)}
                                className="mt-3 w-full rounded-2xl border border-violet-400/20 bg-violet-500/10 px-6 py-4 font-black text-violet-200 transition hover:bg-violet-500/20"
                            >
                                Copy Public Link
                            </button>

                            <div className="mt-4 grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => handleStatusUpdate(event.slug, 'OPEN')}
                                    disabled={event.status === 'OPEN'}
                                    className="rounded-2xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-sm font-black text-green-300 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Open
                                </button>

                                <button
                                    onClick={() => handleStatusUpdate(event.slug, 'CLOSED')}
                                    disabled={event.status === 'CLOSED'}
                                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Close
                                </button>

                                <button
                                    onClick={() => handleArchiveEvent(event)}
                                    disabled={event.status === 'ARCHIVED'}
                                    className="rounded-2xl border border-zinc-400/20 bg-zinc-500/10 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Archive
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            Create Event
                        </p>

                        <h2 className="mt-2 text-3xl font-black">
                            New Pick&apos;Em Event
                        </h2>

                        <div className="mt-8 grid gap-5">
                            <div>
                                <label className="text-sm font-bold text-white/60">
                                    Event Name
                                </label>

                                <input
                                    value={eventName}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        setEventName(value);

                                        setEventSlug(
                                            value
                                                .toLowerCase()
                                                .replaceAll(/[^a-z0-9\s-]/g, '')
                                                .replaceAll(/\s+/g, '-')
                                        );
                                    }}
                                    placeholder="IEM Cologne 2026"
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-white/60">
                                    Slug
                                </label>

                                <input
                                    value={eventSlug}
                                    onChange={(e) => setEventSlug(e.target.value)}
                                    placeholder="iem-cologne-2026"
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                                />

                                <p className="mt-2 text-sm text-white/40">
                                    Final slug:{' '}
                                    <span className="text-violet-300">
                                        {normalizedSlug || '-'}
                                    </span>
                                </p>
                            </div>
                        </div>

                        {createError && (
                            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                                {createError}
                            </div>
                        )}

                        <div className="mt-8 flex justify-end gap-4">
                            <button
                                onClick={() => {
                                    setCreateError(null);
                                    setShowCreateModal(false);
                                }}
                                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleCreateEvent}
                                disabled={creating || !eventName.trim() || !normalizedSlug}
                                className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                            >
                                {creating ? 'Creating...' : 'Create Event'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function GuildStat({ title, value }) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <h2 className="mt-3 text-3xl font-black">
                {value}
            </h2>
        </div>
    );
}

function MiniStat({ label, value }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                {label}
            </p>

            <h3 className="mt-2 text-2xl font-black">
                {value}
            </h3>
        </div>
    );
}