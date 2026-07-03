import { useState } from 'react';
import { setDeadline, setMatchDeadline, describeActionError } from '../../lib/api';

const PHASES = [
    { value: 'swiss', label: 'Swiss' },
    { value: 'playoffs', label: 'Playoffs' },
    { value: 'doubleelim', label: 'Double Elimination' },
    { value: 'playin', label: 'Play-In' }
];

export default function DeadlineModal({ guildId, onClose }) {
    const [deadlineType, setDeadlineType] = useState('pick');
    const [phase, setPhase] = useState('swiss');
    const [stage, setStage] = useState('1');
    const [datetime, setDatetime] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSuccess(null);

        const data = datetime.replace('T', ' ');

        try {
            if (deadlineType === 'pick') {
                await setDeadline(guildId, { phase, data, stage: phase === 'swiss' ? stage : undefined });
            } else {
                await setMatchDeadline(guildId, { phase, data });
            }

            setSuccess('Deadline zapisany.');
        } catch (err) {
            setError(err?.status === 400 || err?.status === 404 ? err.message : describeActionError(err, 'zapisać deadline'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Deadline'y paneli
                </p>

                <h2 className="mt-2 text-3xl font-black">
                    Ustaw deadline
                </h2>

                <p className="mt-2 text-sm text-white/40">
                    Dotyczy aktualnie aktywnego panelu Discorda dla tej fazy. Czasy podawane są w strefie Europe/Warsaw.
                </p>

                <div className="mt-6 grid gap-5">
                    <div>
                        <label className="text-sm font-bold text-white/60">Typ deadline'u</label>

                        <div className="mt-2 grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setDeadlineType('pick')}
                                className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${deadlineType === 'pick'
                                    ? 'border-violet-400/40 bg-violet-500/20 text-violet-200'
                                    : 'border-white/10 bg-black/30 text-white/60'
                                    }`}
                            >
                                Deadline typowania
                            </button>

                            <button
                                onClick={() => setDeadlineType('match')}
                                className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${deadlineType === 'match'
                                    ? 'border-violet-400/40 bg-violet-500/20 text-violet-200'
                                    : 'border-white/10 bg-black/30 text-white/60'
                                    }`}
                            >
                                Deadline wyników meczów
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-white/60">Faza</label>

                        <select
                            value={phase}
                            onChange={(e) => setPhase(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                        >
                            {PHASES.map((p) => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    {deadlineType === 'pick' && phase === 'swiss' && (
                        <div>
                            <label className="text-sm font-bold text-white/60">Etap Swiss</label>

                            <select
                                value={stage}
                                onChange={(e) => setStage(e.target.value)}
                                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                            >
                                <option value="1">Etap 1</option>
                                <option value="2">Etap 2</option>
                                <option value="3">Etap 3</option>
                            </select>
                        </div>
                    )}

                    {deadlineType === 'match' && phase === 'swiss' && (
                        <p className="text-sm text-yellow-300/80">
                            Deadline wyników meczów nie jest per-etapowy dla Swiss w obecnym bocie - to wierna replika zachowania Discorda, nie błąd tego panelu.
                        </p>
                    )}

                    <div>
                        <label className="text-sm font-bold text-white/60">Deadline (Europe/Warsaw)</label>

                        <input
                            type="datetime-local"
                            value={datetime}
                            onChange={(e) => setDatetime(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none focus:border-violet-400/50"
                        />
                    </div>
                </div>

                {error && (
                    <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mt-6 rounded-2xl border border-green-400/20 bg-green-500/10 p-4 text-sm font-bold text-green-300">
                        {success}
                    </div>
                )}

                <div className="mt-8 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/70 transition hover:bg-white/10"
                    >
                        Zamknij
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving || !datetime}
                        className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400 disabled:opacity-50"
                    >
                        {saving ? 'Zapisywanie...' : 'Zapisz deadline'}
                    </button>
                </div>
            </div>
        </div>
    );
}
