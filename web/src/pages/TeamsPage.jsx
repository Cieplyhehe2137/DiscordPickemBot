import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import {
    getTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    reorderTeams,
    importTeams,
    describeActionError
} from '../lib/api';
import { usePublicAuth } from '../context/PublicAuthContext';
import Breadcrumbs from '../components/layout/Breadcrumbs';
import EmptyState from '../components/ui/EmptyState';

export default function TeamsPage() {
    const { guildId } = useParams();
    const { user } = usePublicAuth();

    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [modal, setModal] = useState(null); // null | 'add' | 'import' | { team }
    const [formName, setFormName] = useState('');
    const [formShortName, setFormShortName] = useState('');
    const [formExternalName, setFormExternalName] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    const [importJson, setImportJson] = useState('');
    const [importConfirmText, setImportConfirmText] = useState('');
    const [importSaving, setImportSaving] = useState(false);
    const [importError, setImportError] = useState(null);

    const guildName = user?.guilds?.find((g) => g.id === guildId)?.name || guildId;

    // Pobieranie listy należy do efektu, a akcje (dodanie, usunięcie, zmiana
    // kolejności) proszą o odświeżenie podbijając ten licznik. Wcześniej
    // wołały `load()` zadeklarowane obok efektu, przez co ta sama funkcja
    // miała dwóch właścicieli i nie dało się jej uczciwie wpisać w zależności.
    const [reloadToken, setReloadToken] = useState(0);
    const reloadTeams = () => setReloadToken((n) => n + 1);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError(null);

                const data = await getTeams(guildId, { includeInactive: true });
                if (!cancelled) setTeams(data.teams || []);
            } catch (err) {
                console.error(err);
                if (!cancelled) setError(describeActionError(err, 'wczytać drużyny'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => { cancelled = true; };
    }, [guildId, reloadToken]);

    function openAddModal() {
        setFormName('');
        setFormShortName('');
        setFormExternalName('');
        setFormError(null);
        setModal('add');
    }

    function openImportModal() {
        setImportJson('');
        setImportConfirmText('');
        setImportError(null);
        setModal('import');
    }

    async function handleImport() {
        try {
            setImportSaving(true);
            setImportError(null);

            await importTeams(guildId, importJson);

            reloadTeams();
            setModal(null);
        } catch (err) {
            console.error(err);
            setImportError(err?.status === 400 ? err.message : describeActionError(err, 'zaimportować drużyny'));
        } finally {
            setImportSaving(false);
        }
    }

    function openEditModal(team) {
        setFormName(team.name);
        setFormShortName(team.short_name || '');
        setFormExternalName(team.external_name || '');
        setFormError(null);
        setModal({ team });
    }

    async function handleSave() {
        try {
            setSaving(true);
            setFormError(null);

            if (modal === 'add') {
                await createTeam(guildId, {
                    name: formName.trim(),
                    shortName: formShortName.trim() || null
                });
            } else {
                await updateTeam(guildId, modal.team.id, {
                    name: formName.trim(),
                    shortName: formShortName.trim() || null,
                    externalName: formExternalName.trim()
                });
            }

            reloadTeams();
            setModal(null);
        } catch (err) {
            console.error(err);
            setFormError(err?.status === 409 ? err.message : describeActionError(err, 'zapisać drużynę'));
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleActive(team) {
        try {
            await updateTeam(guildId, team.id, { active: !team.active });
            reloadTeams();
        } catch (err) {
            console.error(err);
            alert(describeActionError(err, 'zaktualizować drużynę'));
        }
    }

    async function handleDelete(team) {
        const confirmed = window.confirm(`Usunąć drużynę "${team.name}"? Tej operacji nie można cofnąć.`);
        if (!confirmed) return;

        try {
            await deleteTeam(guildId, team.id);
            reloadTeams();
        } catch (err) {
            console.error(err);
            alert(err?.status === 409 ? err.message : describeActionError(err, 'usunąć drużynę'));
        }
    }

    async function handleMove(index, direction) {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= teams.length) return;

        const reordered = [...teams];
        [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

        setTeams(reordered);

        try {
            await reorderTeams(guildId, reordered.map((t) => t.id));
            reloadTeams();
        } catch (err) {
            console.error(err);
            alert(describeActionError(err, 'zmienić kolejność drużyn'));
            reloadTeams();
        }
    }

    return (
        <div className="px-6 py-10">
            <div className="mx-auto max-w-5xl">
                <Breadcrumbs
                    items={[
                        { label: 'Serwery', to: '/app/guilds' },
                        { label: 'Serwer', to: `/app/guilds/${guildId}` },
                        { label: 'Drużyny' }
                    ]}
                />

                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Lista drużyn
                </p>

                <h1 className="mt-3 text-5xl font-black">
                    {guildName}
                </h1>

                <div className="mt-10 flex items-center justify-between">
                    <p className="text-white/50">
                        Zarządzaj listą aktywnych drużyn używaną przy tworzeniu meczów.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={openImportModal}
                            className="rounded-2xl border border-red-400/20 bg-red-500/10 px-6 py-4 font-black text-red-300 transition hover:bg-red-500/20"
                        >
                            Importuj z JSON
                        </button>

                        <button
                            onClick={openAddModal}
                            className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                        >
                            Dodaj drużynę
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        Ładowanie drużyn...
                    </div>
                )}

                {!loading && teams.length === 0 && (
                    <div className="mt-10">
                        <EmptyState
                            icon={ShieldOff}
                            title="Brak jeszcze drużyn"
                            description="Dodaj pierwszą drużynę powyżej, aby zacząć tworzyć mecze."
                        />
                    </div>
                )}

                <div className="mt-8 grid gap-3">
                    {teams.map((team, index) => (
                        <div
                            key={team.id}
                            style={{ animationDelay: `${index * 40}ms` }}
                            className="animate-fade-in-up flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-violet-400/20"
                        >
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => handleMove(index, -1)}
                                    disabled={index === 0}
                                    className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs font-black text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    ▲
                                </button>

                                <button
                                    onClick={() => handleMove(index, 1)}
                                    disabled={index === teams.length - 1}
                                    className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs font-black text-white/60 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                    ▼
                                </button>
                            </div>

                            <div className="flex-1">
                                <h3 className="text-xl font-black">
                                    {team.name}
                                </h3>

                                {team.short_name && (
                                    <p className="mt-1 text-sm text-white/40">
                                        {team.short_name}
                                    </p>
                                )}
                            </div>

                            <span
                                className={`rounded-2xl px-4 py-2 text-sm font-black ${team.active
                                    ? 'bg-green-500/15 text-green-300'
                                    : 'bg-zinc-500/15 text-zinc-300'
                                    }`}
                            >
                                {team.active ? 'AKTYWNA' : 'NIEAKTYWNA'}
                            </span>

                            <button
                                onClick={() => handleToggleActive(team)}
                                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white/80 transition hover:bg-white/10"
                            >
                                {team.active ? 'Dezaktywuj' : 'Aktywuj'}
                            </button>

                            <button
                                onClick={() => openEditModal(team)}
                                className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-5 py-3 font-black text-violet-200 transition hover:bg-violet-500/20"
                            >
                                Edytuj
                            </button>

                            <button
                                onClick={() => handleDelete(team)}
                                className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 font-black text-red-300 transition hover:bg-red-500/20"
                            >
                                Usuń
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {modal && modal !== 'import' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            {modal === 'add' ? 'Dodaj drużynę' : 'Edytuj drużynę'}
                        </p>

                        <h2 className="mt-2 text-3xl font-black">
                            {modal === 'add' ? 'Nowa drużyna' : modal.team.name}
                        </h2>

                        <div className="mt-8 grid gap-5">
                            <div>
                                <label className="text-sm font-bold text-white/60">
                                    Nazwa drużyny
                                </label>

                                <input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="Team Vitality"
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-white/60">
                                    Krótka nazwa (opcjonalnie)
                                </label>

                                <input
                                    value={formShortName}
                                    onChange={(e) => setFormShortName(e.target.value)}
                                    placeholder="VIT"
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                                />
                            </div>

                            {modal !== 'add' && (
                                <div>
                                    <label className="text-sm font-bold text-white/60">
                                        Nazwa u dostawcy wyników (opcjonalnie)
                                    </label>

                                    <input
                                        value={formExternalName}
                                        onChange={(e) => setFormExternalName(e.target.value)}
                                        placeholder="Natus Vincere"
                                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                                    />

                                    <p className="mt-2 text-xs text-white/40">
                                        Wypełnij tylko wtedy, gdy dostawca nazywa tę drużynę inaczej niż Wy
                                        (np. u Was &bdquo;NAVI&rdquo;, u niego &bdquo;Natus Vincere&rdquo;).
                                        Panel propozycji wypisze z nazwy drużyny, których nie rozpoznał.
                                    </p>
                                </div>
                            )}
                        </div>

                        {formError && (
                            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                                {formError}
                            </div>
                        )}

                        <div className="mt-8 flex justify-end gap-4">
                            <button
                                onClick={() => setModal(null)}
                                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
                            >
                                Anuluj
                            </button>

                            <button
                                onClick={handleSave}
                                disabled={saving || !formName.trim()}
                                className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                            >
                                {saving ? 'Zapisywanie...' : 'Zapisz'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modal === 'import' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-[2rem] border border-red-500/30 bg-zinc-950 p-8 text-white shadow-2xl">
                        <p className="text-sm uppercase tracking-[0.25em] text-red-300">
                            Importuj z JSON
                        </p>

                        <h2 className="mt-2 text-3xl font-black">
                            Zastąp listę drużyn
                        </h2>

                        <p className="mt-2 text-white/50">
                            To <strong className="text-red-300">usuwa wszystkie {teams.length} istniejących drużyn</strong> dla
                            tego serwera i zastępuje je nazwami poniżej. Tej operacji nie można cofnąć.
                        </p>

                        <div className="mt-6">
                            <label className="text-sm font-bold text-white/60">
                                Nazwy drużyn (tablica JSON stringów)
                            </label>

                            <textarea
                                value={importJson}
                                onChange={(e) => setImportJson(e.target.value)}
                                rows={6}
                                placeholder={'["FaZe","NAVI","G2","Vitality"]'}
                                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 font-mono text-sm text-white outline-none focus:border-red-400/40"
                            />
                        </div>

                        <div className="mt-6">
                            <label className="text-sm font-bold text-white/60">
                                Wpisz <span className="text-red-300">REPLACE</span>, aby potwierdzić:
                            </label>

                            <input
                                value={importConfirmText}
                                onChange={(e) => setImportConfirmText(e.target.value)}
                                placeholder="REPLACE"
                                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-red-400/40"
                            />
                        </div>

                        {importError && (
                            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                                {importError}
                            </div>
                        )}

                        <div className="mt-8 flex justify-end gap-4">
                            <button
                                onClick={() => setModal(null)}
                                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
                            >
                                Anuluj
                            </button>

                            <button
                                onClick={handleImport}
                                disabled={importSaving || !importJson.trim() || importConfirmText !== 'REPLACE'}
                                className="rounded-2xl bg-red-500 px-6 py-4 font-black transition hover:bg-red-400 disabled:opacity-50"
                            >
                                {importSaving ? 'Importowanie...' : 'Zastąp listę'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
