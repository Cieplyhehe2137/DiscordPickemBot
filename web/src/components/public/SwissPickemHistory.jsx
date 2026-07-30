import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import EmptyState from '../ui/EmptyState';

export default function SwissPickemHistory({ swissPicks }) {
    return (
        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                Historia Pick&apos;Em Swiss
            </p>

            <div className="mt-6 grid gap-4">
                {(swissPicks || []).map((pick) => (
                    <div
                        key={`${pick.event_slug}-${pick.stage}`}
                        className="rounded-2xl border border-white/10 bg-black/30 p-5"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                    {pick.event_name}
                                </p>

                                <h3 className="mt-2 text-2xl font-black">
                                    {formatSwissStage(pick.stage)}
                                </h3>

                                <p className="mt-2 text-sm text-white/40">
                                    Zapisano: {pick.submitted_at
                                        ? new Date(pick.submitted_at).toLocaleString()
                                        : 'Nieznane'}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Link
                                    to={`/public/event/${pick.event_slug}/pickem/${pick.stage}`}
                                    className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-black transition hover:bg-violet-400"
                                >
                                    Otwórz Pick&apos;Em
                                </Link>

                                <Link
                                    to={`/public/event/${pick.event_slug}/leaderboard`}
                                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/80 transition hover:bg-white/10"
                                >
                                    Ranking eventu
                                </Link>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                            <SwissPickList title="3-0" teams={pick.three_zero} />
                            <SwissPickList title="0-3" teams={pick.zero_three} />
                            <SwissPickList title="Awansujący" teams={pick.advancing} />
                        </div>
                    </div>
                ))}

                {(swissPicks || []).length === 0 && (
                    <EmptyState
                        icon={History}
                        title="Brak jeszcze typów Pick'Em Swiss"
                        description="Ten gracz nie zapisał jeszcze żadnych typów etapu Swiss."
                    />
                )}
            </div>
        </div>
    );
}

function SwissPickList({ title, teams }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
                {(teams || []).map((team) => (
                    <span
                        key={team}
                        className="rounded-full bg-violet-500/20 px-3 py-1 text-sm font-black text-violet-300"
                    >
                        {team}
                    </span>
                ))}

                {(!teams || teams.length === 0) && (
                    <span className="text-sm text-white/40">
                        Brak typów
                    </span>
                )}
            </div>
        </div>
    );
}

function formatSwissStage(stage) {
    if (stage === 'stage1') return 'Swiss - Etap 1';
    if (stage === 'stage2') return 'Swiss - Etap 2';
    if (stage === 'stage3') return 'Swiss - Etap 3';

    return stage || 'Etap Swiss';
}