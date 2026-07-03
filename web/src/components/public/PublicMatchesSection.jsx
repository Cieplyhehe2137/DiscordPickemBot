import { Swords, FilterX } from 'lucide-react';
import PublicMatchCard from './PublicMatchCard';
import EmptyState from '../ui/EmptyState';

export default function PublicMatchesSection({
    publicMatches,
    visiblePublicMatches,
    heroMatch,
    nextUnpredictedMatch,
    myPredictions,
    showOnlyMyPicks,
    setShowOnlyMyPicks,
    matchFilter,
    setMatchFilter,
    nowTick,
    formatPhaseLabel,
    formatStatusLabel,
    getCountdown,
    openPredictionModal,
    openMatchModal
}) {
    return (
        <div
            id="matches-section"
            className="rounded-[2rem] border border-white/10 bg-white/5 p-8"
        >
            <h2 className="text-3xl font-black">
                Matches
            </h2>

            {nextUnpredictedMatch && (
                <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        Next Pick
                    </p>

                    <h3 className="mt-2 text-2xl font-black">
                        {nextUnpredictedMatch.team_a} vs {nextUnpredictedMatch.team_b}
                    </h3>

                    <p className="mt-2 text-white/50">
                        {formatPhaseLabel(nextUnpredictedMatch.phase)} • BO{nextUnpredictedMatch.best_of || 3}
                    </p>

                    <button
                        onClick={() => openPredictionModal(nextUnpredictedMatch)}
                        className="mt-5 rounded-xl bg-violet-500 px-4 py-2 text-sm font-black transition hover:bg-violet-400"
                    >
                        Predict Now
                    </button>
                </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
                {['ALL', 'OPEN', 'LIVE', 'FINAL', 'LOCKED'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setMatchFilter(status)}
                        className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                            matchFilter === status
                                ? 'bg-violet-500 text-white'
                                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                    >
                        {status}
                    </button>
                ))}

                <button
                    onClick={() => setShowOnlyMyPicks((value) => !value)}
                    className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                        showOnlyMyPicks
                            ? 'bg-violet-500 text-white'
                            : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                >
                    My Picks
                </button>

                <button
                    onClick={() => {
                        if (nextUnpredictedMatch) {
                            const element = document.getElementById(
                                `match-${nextUnpredictedMatch.id}`
                            );

                            if (element) {
                                element.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center'
                                });

                                element.classList.add('ring-2', 'ring-violet-400');

                                setTimeout(() => {
                                    element.classList.remove(
                                        'ring-2',
                                        'ring-violet-400'
                                    );
                                }, 1800);
                            }

                            return;
                        }

                        const picksSection = document.getElementById('matches-section');

                        if (picksSection) {
                            picksSection.scrollIntoView({
                                behavior: 'smooth'
                            });
                        }
                    }}
                    className="rounded-2xl bg-violet-500 px-5 py-3 font-black transition hover:bg-violet-400"
                >
                    {nextUnpredictedMatch
                        ? 'Next Match'
                        : 'All Picks Done'}
                </button>
            </div>

            <p className="mt-4 text-sm font-bold text-white/40">
                Showing {visiblePublicMatches.length} of {publicMatches.length} matches
            </p>

            <div className="mt-6 grid gap-4">
                {visiblePublicMatches.length === 0 && !heroMatch && (
                    publicMatches.length === 0 ? (
                        <EmptyState
                            icon={Swords}
                            title="No matches published yet"
                            description="Matches will show up here once the organizers add them."
                        />
                    ) : (
                        <EmptyState
                            icon={FilterX}
                            title="No matches match this filter"
                            description="Try a different status filter or clear My Picks."
                        />
                    )
                )}

                {visiblePublicMatches.map((match) => (
                    <PublicMatchCard
                        key={match.id}
                        match={match}
                        myPrediction={myPredictions[match.id]}
                        nowTick={nowTick}
                        formatPhaseLabel={formatPhaseLabel}
                        formatStatusLabel={formatStatusLabel}
                        getCountdown={getCountdown}
                        openMatchModal={openMatchModal}
                        openPredictionModal={openPredictionModal}
                    />
                ))}
            </div>
        </div>
    );
}