import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    getTeams,
    createTeam,
    updateTeam,
    deleteTeam,
    reorderTeams,
    describeActionError
} from '../lib/api';
import { usePublicAuth } from '../context/PublicAuthContext';
import Breadcrumbs from '../components/layout/Breadcrumbs';

export default function TeamsPage() {
    const { guildId } = useParams();
    const { user } = usePublicAuth();

    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [modal, setModal] = useState(null); // null | 'add' | { team }
    const [formName, setFormName] = useState('');
    const [formShortName, setFormShortName] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);

    const guildName = user?.guilds?.find((g) => g.id === guildId)?.name || guildId;

    useEffect(() => {
        load();
    }, [guildId]);

    async function load() {
        try {
            setLoading(true);
            setError(null);

            const data = await getTeams(guildId, { includeInactive: true });
            setTeams(data.teams || []);
        } catch (err) {
            console.error(err);
            setError(describeActionError(err, 'load teams'));
        } finally {
            setLoading(false);
        }
    }

    function openAddModal() {
        setFormName('');
        setFormShortName('');
        setFormError(null);
        setModal('add');
    }

    function openEditModal(team) {
        setFormName(team.name);
        setFormShortName(team.short_name || '');
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
                    shortName: formShortName.trim() || null
                });
            }

            await load();
            setModal(null);
        } catch (err) {
            console.error(err);
            setFormError(err?.status === 409 ? err.message : describeActionError(err, 'save the team'));
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleActive(team) {
        try {
            await updateTeam(guildId, team.id, { active: !team.active });
            await load();
        } catch (err) {
            console.error(err);
            alert(describeActionError(err, 'update the team'));
        }
    }

    async function handleDelete(team) {
        const confirmed = window.confirm(`Delete team "${team.name}"? This cannot be undone.`);
        if (!confirmed) return;

        try {
            await deleteTeam(guildId, team.id);
            await load();
        } catch (err) {
            console.error(err);
            alert(err?.status === 409 ? err.message : describeActionError(err, 'delete the team'));
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
            await load();
        } catch (err) {
            console.error(err);
            alert(describeActionError(err, 'reorder teams'));
            await load();
        }
    }

    return (
        <div className="px-6 py-10">
            <div className="mx-auto max-w-5xl">
                <Breadcrumbs
                    items={[
                        { label: 'Servers', to: '/app/guilds' },
                        { label: 'Guild', to: `/app/guilds/${guildId}` },
                        { label: 'Teams' }
                    ]}
                />

                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Team Roster
                </p>

                <h1 className="mt-3 text-5xl font-black">
                    {guildName}
                </h1>

                <div className="mt-10 flex items-center justify-between">
                    <p className="text-white/50">
                        Manage the active team list used when creating matches.
                    </p>

                    <button
                        onClick={openAddModal}
                        className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Add Team
                    </button>
                </div>

                {error && (
                    <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        Loading teams...
                    </div>
                )}

                {!loading && teams.length === 0 && (
                    <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
                        No teams yet. Add your first team above.
                    </div>
                )}

                <div className="mt-8 grid gap-3">
                    {teams.map((team, index) => (
                        <div
                            key={team.id}
                            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
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
                                {team.active ? 'ACTIVE' : 'INACTIVE'}
                            </span>

                            <button
                                onClick={() => handleToggleActive(team)}
                                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white/80 transition hover:bg-white/10"
                            >
                                {team.active ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                                onClick={() => openEditModal(team)}
                                className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-5 py-3 font-black text-violet-200 transition hover:bg-violet-500/20"
                            >
                                Edit
                            </button>

                            <button
                                onClick={() => handleDelete(team)}
                                className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 font-black text-red-300 transition hover:bg-red-500/20"
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                    <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
                        <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                            {modal === 'add' ? 'Add Team' : 'Edit Team'}
                        </p>

                        <h2 className="mt-2 text-3xl font-black">
                            {modal === 'add' ? 'New Team' : modal.team.name}
                        </h2>

                        <div className="mt-8 grid gap-5">
                            <div>
                                <label className="text-sm font-bold text-white/60">
                                    Team Name
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
                                    Short Name (optional)
                                </label>

                                <input
                                    value={formShortName}
                                    onChange={(e) => setFormShortName(e.target.value)}
                                    placeholder="VIT"
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                                />
                            </div>
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
                                Cancel
                            </button>

                            <button
                                onClick={handleSave}
                                disabled={saving || !formName.trim()}
                                className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
