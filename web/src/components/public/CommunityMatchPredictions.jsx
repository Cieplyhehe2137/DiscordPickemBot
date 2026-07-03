import { LineChart } from 'lucide-react';
import EmptyState from '../ui/EmptyState';

export default function CommunityMatchPredictions({ eventMatchStats }) {
    return (
        <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Community Match Predictions
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                        Match Trends
                    </h2>
                </div>
            </div>

            <div className="mt-6 grid gap-4">
                {eventMatchStats.slice(0, 10).map((match) => (
                    <MatchPredictionCard
                        key={match.match_id}
                        match={match}
                    />
                ))}

                {eventMatchStats.length === 0 && (
                    <EmptyState
                        icon={LineChart}
                        title="No match prediction data yet"
                        description="Trends appear once community members start predicting matches."
                    />
                )}
            </div>
        </div>
    );
}

function MatchPredictionCard({ match }) {
    const confidence = Math.max(
        match.team_a_percentage,
        match.team_b_percentage
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black">
                        {match.team_a} vs {match.team_b}
                    </h3>

                    <p className="mt-1 text-sm text-white/40">
                        {match.total_predictions} predictions
                    </p>
                </div>

                <p className="font-black text-violet-300">
                    BO{match.best_of}
                </p>
            </div>

            <MatchTrendBar
                team={match.team_a}
                percentage={match.team_a_percentage}
                variant="primary"
            />

            <MatchTrendBar
                team={match.team_b}
                percentage={match.team_b_percentage}
            />

            <div className="mt-4">
                <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-violet-300">
                    {confidence >= 75
                        ? '🔥 Heavy Favorite'
                        : confidence >= 60
                            ? '📈 Slight Favorite'
                            : '⚖️ Toss-Up'}
                </span>
            </div>

            {match.winner && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm uppercase tracking-[0.15em] text-violet-300">
                        Community vs Reality
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                        <span className="rounded-full bg-violet-500/20 px-3 py-1 font-black text-violet-300">
                            Community: {match.community_pick}
                        </span>

                        <span className="rounded-full bg-white/10 px-3 py-1 font-black text-white/70">
                            Winner: {match.winner}
                        </span>

                        <span
                            className={`rounded-full px-3 py-1 font-black ${
                                match.community_was_right
                                    ? 'bg-green-500/20 text-green-300'
                                    : 'bg-red-500/20 text-red-300'
                            }`}
                        >
                            {match.community_was_right
                                ? 'Community was right'
                                : 'Community was wrong'}
                        </span>
                    </div>
                </div>
            )}

            {match.top_scores?.length > 0 && (
                <div className="mt-5">
                    <p className="text-sm uppercase tracking-[0.15em] text-violet-300">
                        Most picked scores
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {match.top_scores.map((scorePick) => (
                            <span
                                key={`${match.match_id}-${scorePick.score}`}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-black text-white/70"
                            >
                                {scorePick.score} • {scorePick.picks} picks
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function MatchTrendBar({ team, percentage, variant }) {
    return (
        <div className="mt-4">
            <div className="mb-2 flex justify-between text-sm">
                <span>{team}</span>
                <span>{percentage}%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-black/40">
                <div
                    className={`h-full rounded-full ${
                        variant === 'primary' ? 'bg-violet-500' : 'bg-white/60'
                    }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}