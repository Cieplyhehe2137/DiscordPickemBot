import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarX } from 'lucide-react';
import {
    getGuildEvents,
    createGuildEvent,
    updateEventStatus,
    describeActionError
} from '../lib/api';
import { useApp } from '../context/AppContext';
import { usePublicAuth } from '../context/PublicAuthContext';
import EventStatusButtons from '../components/admin/EventStatusButtons';
import PublicLinkButtons from '../components/admin/PublicLinkButtons';
import DeadlineModal from '../components/admin/DeadlineModal';
import EmptyState from '../components/ui/EmptyState';
import { translateStatus } from '../lib/labels';

const STATUS_FILTER_LABELS = {
    ALL: 'WSZYSTKIE',
    OPEN: 'OTWARTE',
    CLOSED: 'ZAMKNIĘTE',
    ARCHIVED: 'ZARCHIWIZOWANE'
};

export default function GuildDashboard() {
    const { guildId } = useParams();
    const navigate = useNavigate();
    const { setSelectedGuild } = useApp();
    const { user } = usePublicAuth();

    const [events, setEvents] = useState([]);
    const [guild, setGuild] = useState(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [stats, setStats] = useState(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [eventName, setEventName] = useState('');
    const [eventSlug, setEventSlug] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);

    const [showDeadlineModal, setShowDeadlineModal] = useState(false);

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
            // "ARCHIVED" nie jest wartością events.status (enum: UPCOMING/OPEN/
            // CLOSED/FINISHED) - archiwizacja to flaga is_archived, więc
            // porównanie po statusie nigdy nic nie zwracało.
            const matchesStatus =
                statusFilter === 'ALL'
                    ? true
                    : statusFilter === 'ARCHIVED'
                        ? Number(event.is_archived) === 1
                        : event.status === statusFilter;

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
                setAccessDenied(false);

                const known = user?.guilds?.find((g) => g.id === guildId);
                const meta = { id: guildId, name: known?.name || guildId };
                setGuild(meta);
                setSelectedGuild(meta);

                const data = await getGuildEvents(guildId);
                setEvents(data.events || []);
                setStats(data.stats || null);
            } catch (err) {
                console.error(err);

                if (err.status === 401 || err.status === 403) {
                    setAccessDenied(true);
                }
            } finally {
                setLoading(false);
            }
        }

        if (user) load();
    }, [guildId, user, setSelectedGuild]);

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
            setCreateError(describeActionError(err, 'utworzyć event'));
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
            alert(describeActionError(err, 'zaktualizować status'));
        }
    }

    async function handleArchiveEvent(event) {
        const confirmed = window.confirm(
            `Zarchiwizować event "${event.name}"?\n\nUkryje go to z widoków aktywnych eventów, ale nie usunie danych z bazy.`
        );

        if (!confirmed) return;

        await handleStatusUpdate(event.slug, 'ARCHIVED');
    }

    if (accessDenied) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center px-6">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                    <p className="text-sm uppercase tracking-[0.25em] text-red-300">
                        Brak dostępu
                    </p>

                    <h1 className="mt-3 text-2xl font-black">
                        Nie masz dostępu do tego serwera
                    </h1>

                    <p className="mt-2 text-sm text-white/50">
                        Twoje konto nie ma uprawnień Administratora na serwerze <span className="font-bold text-white/80">{guildId}</span>.
                    </p>

                    <a
                        href="/app/guilds"
                        className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                    >
                        Wróć do listy serwerów
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="px-6 py-10">
            <div className="mx-auto max-w-7xl">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Panel serwera
                </p>

                <h1 className="mt-3 text-5xl font-black">
                    {guild?.name || guildId}
                </h1>

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        onClick={() => navigate(`/app/guilds/${guildId}/teams`)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white/80 transition hover:bg-white/10"
                    >
                        Zarządzaj drużynami
                    </button>

                    <button
                        onClick={() => navigate(`/app/guilds/${guildId}/archive`)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white/80 transition hover:bg-white/10"
                    >
                        Archiwum turniejów
                    </button>

                    <button
                        onClick={() => setShowDeadlineModal(true)}
                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white/80 transition hover:bg-white/10"
                    >
                        Ustaw deadline'y
                    </button>
                </div>

                <div className="mt-10 grid gap-6 md:grid-cols-4">
                    <GuildStat title="Wszystkie eventy" value={stats?.totalEvents ?? 0} />
                    <GuildStat title="Aktywne" value={stats?.activeEvents ?? 0} />
                    <GuildStat title="Zamknięte" value={stats?.closedEvents ?? 0} />
                    <GuildStat title="Zarchiwizowane" value={stats?.archivedEvents ?? 0} />
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-black">
                            Eventy
                        </h2>

                        <p className="mt-2 text-white/50">
                            Zarządzaj eventami Pick&apos;Em dla tego serwera.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Utwórz event
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
                            {STATUS_FILTER_LABELS[status]}
                        </button>
                    ))}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-[1fr_260px]">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Szukaj eventów..."
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                    />

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition focus:border-violet-400/40"
                    >
                        <option value="newest">Najnowsze najpierw</option>
                        <option value="oldest">Najstarsze najpierw</option>
                        <option value="name">Nazwa A-Z</option>
                        <option value="status">Status</option>
                    </select>
                </div>

                {loading && (
                    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        Ładowanie eventów...
                    </div>
                )}

                {!loading && filteredEvents.length === 0 && (
                    <div className="mt-10">
                        <EmptyState
                            icon={CalendarX}
                            title={events.length === 0 ? 'Nie znaleziono eventów dla tego serwera' : 'Żaden event nie pasuje do wybranych filtrów'}
                            description={events.length === 0 ? 'Utwórz swój pierwszy event powyżej, aby zacząć.' : 'Spróbuj innego filtra statusu lub frazy wyszukiwania.'}
                        />
                    </div>
                )}

                <div className="mt-8 text-sm font-bold text-white/40">
                    Pokazano {filteredEvents.length} z {events.length} eventów
                </div>

                <div className="mt-10 grid gap-6 lg:grid-cols-2">
                    {filteredEvents.map((event, index) => (
                        <div
                            key={event.id}
                            style={{ animationDelay: `${index * 60}ms` }}
                            className="card-hover animate-fade-in-up rounded-[2rem] border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition hover:border-violet-400/30"
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
                                    {translateStatus(event.status)}
                                </span>
                            </div>

                            <div className="mt-6 grid grid-cols-3 gap-3">
                                <MiniStat
                                    label="Gracze"
                                    value={event.participants_count || 0}
                                />

                                <MiniStat
                                    label="Typy"
                                    value={event.predictions_count || 0}
                                />

                                <MiniStat
                                    label="Mecze"
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
                                    Utworzono
                                </p>

                                <p className="mt-1 text-sm font-bold text-white/70">
                                    {event.created_at || '-'}
                                </p>
                            </div>

                            <button
                                onClick={() => navigate(`/app/events/${event.slug}`)}
                                className="mt-8 w-full rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                            >
                                Otwórz panel eventu
                            </button>

                            <PublicLinkButtons eventSlug={event.slug} size="lg" stacked />

                            <div className="mt-4 grid grid-cols-3 gap-3">
                                <EventStatusButtons
                                    status={event.status}
                                    onOpen={() => handleStatusUpdate(event.slug, 'OPEN')}
                                    onClose={() => handleStatusUpdate(event.slug, 'CLOSED')}
                                    onArchive={() => handleArchiveEvent(event)}
                                    size="sm"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            Utwórz event
                        </p>

                        <h2 className="mt-2 text-3xl font-black">
                            Nowy event Pick&apos;Em
                        </h2>

                        <div className="mt-8 grid gap-5">
                            <div>
                                <label className="text-sm font-bold text-white/60">
                                    Nazwa eventu
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
                                    Ostateczny slug:{' '}
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
                                Anuluj
                            </button>

                            <button
                                onClick={handleCreateEvent}
                                disabled={creating || !eventName.trim() || !normalizedSlug}
                                className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                            >
                                {creating ? 'Tworzenie...' : 'Utwórz event'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeadlineModal && (
                <DeadlineModal guildId={guildId} onClose={() => setShowDeadlineModal(false)} />
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
