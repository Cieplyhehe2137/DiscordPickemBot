import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicUser } from '../lib/api';
import PublicFooter from '../components/public/PublicFooter';

export default function PublicUserPage() {
    const { userId } = useParams();

    const [data, setData] = useState(null);

    useEffect(() => {
        async function loadUser() {
            try {
                const result = await getPublicUser(userId);
                setData(result);
            } catch (err) {
                console.error(err);
            }
        }

        loadUser();
    }, [userId]);

    if (!data) {
        return (
            <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />

                <div className="relative z-10 mx-auto max-w-7xl">
                    <div className="h-5 w-40 animate-pulse rounded-full bg-white/10" />
                    <div className="mt-4 h-16 w-96 max-w-full animate-pulse rounded-2xl bg-white/10" />

                    <div className="mt-10 grid gap-6 md:grid-cols-3">
                        <div className="h-40 animate-pulse rounded-[2rem] bg-white/10" />
                        <div className="h-40 animate-pulse rounded-[2rem] bg-white/10" />
                        <div className="h-40 animate-pulse rounded-[2rem] bg-white/10" />
                    </div>
                </div>
            </div>
        );
    }

    const profile = data.profile;

    const accuracy = profile.accuracy ?? 0;
    const correctWinners = profile.correct_winners ?? 0;
    const exactScores = profile.exact_scores ?? 0;
    const finishedPredictions = profile.finished_predictions ?? 0;

    return (
        <div className="relative min-h-screen overflow-hidden bg-zinc-950 px-6 py-10 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_35%)]" />

            <div className="relative z-10 mx-auto max-w-7xl">
                <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <a
                        href="/public"
                        className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Communities
                    </a>

                    <div className="h-5 w-px bg-white/10" />

                    <a
                        href="/public/hyperland"
                        className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Hyperland
                    </a>

                    <div className="h-5 w-px bg-white/10" />

                    <a
                        href="/public/leaderboard"
                        className="rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Leaderboard
                    </a>

                    <div className="h-5 w-px bg-white/10" />

                    <span className="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-black text-violet-300">
                        Player Profile
                    </span>
                </div>

                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Public Player
                </p>

                <h1 className="mt-3 break-all text-4xl font-black md:text-6xl">
                    {profile.user_id}
                </h1>

                <p className="mt-4 max-w-2xl text-white/50">
                    Public Pick&apos;Em performance, recent predictions and player activity.
                </p>

                <div className="mt-6 flex flex-wrap gap-4">
                    <a
                        href="/public/hyperland"
                        className="rounded-2xl bg-violet-500 px-6 py-4 font-black transition hover:bg-violet-400"
                    >
                        Back to Hyperland
                    </a>

                    <a
                        href="/public"
                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                    >
                        Browse Communities
                    </a>

                    <a
                        href="/public/me/predictions"
                        className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-6 py-4 font-black text-violet-200 transition hover:bg-violet-500/20"
                    >
                        My Predictions
                    </a>

                    <a
                        href="/public/leaderboard"
                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                    >
                        Leaderboard
                    </a>
                </div>

                <div className="mt-10 grid gap-6 md:grid-cols-4">
                    <ProfileStat title="Total Points" value={profile.total_points} />
                    <ProfileStat title="Predictions" value={profile.prediction_count} />
                    <ProfileStat title="Accuracy" value={`${accuracy}%`} />
                    <ProfileStat title="Exact Hits" value={exactScores} />
                </div>

                <div className="mt-6 rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-6">
                        <div>
                            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                Player Performance
                            </p>

                            <h2 className="mt-3 text-3xl font-black">
                                {accuracy}% Winner Accuracy
                            </h2>

                            <p className="mt-2 text-white/50">
                                {correctWinners} correct winners • {exactScores} exact scores • {finishedPredictions} finished picks
                            </p>
                        </div>

                        <div className="w-48 overflow-hidden rounded-full border border-white/10 bg-black/30">
                            <div
                                className="h-4 rounded-full bg-violet-500 transition-all duration-500"
                                style={{ width: `${accuracy}%` }}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Achievements
                    </p>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <PlayerBadge
                            title="First Pick"
                            description="Saved at least one prediction."
                            active={profile.prediction_count > 0}
                        />

                        <PlayerBadge
                            title="Sharp Eye"
                            description="Hit at least one correct winner."
                            active={correctWinners > 0}
                        />

                        <PlayerBadge
                            title="Perfect Read"
                            description="Hit at least one exact score."
                            active={exactScores > 0}
                        />
                    </div>
                </div>

                <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                    <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                        Recent Predictions
                    </p>

                    <div className="mt-6 grid gap-4">
                        {(data.recent_predictions || []).map((prediction) => (
                            <a
                                key={`${prediction.match_id}-${prediction.event_slug}`}
                                href={`/public/event/${prediction.event_slug}`}
                                className="rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-violet-400/30 hover:bg-violet-500/5"
                            >
                                <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                                    {prediction.event_name}
                                </p>

                                <h3 className="mt-2 text-2xl font-black">
                                    {prediction.team_a} vs {prediction.team_b}
                                </h3>

                                <div className="mt-4 flex flex-wrap gap-3">
                                    <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-violet-300">
                                        Pick: {prediction.pred_a}:{prediction.pred_b}
                                    </span>

                                    {prediction.event_slug && (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-white/50">
                                            Event
                                        </span>
                                    )}
                                </div>
                            </a>
                        ))}

                        {(data.recent_predictions || []).length === 0 && (
                            <p className="text-white/50">
                                No public predictions yet.
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-10 rounded-[2rem] border border-white/10 bg-black/30 p-6">
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        Activity Timeline
                    </p>

                    <div className="mt-6 space-y-4">
                        {(data.recent_predictions || []).map((prediction) => (
                            <div
                                key={`timeline-${prediction.match_id}`}
                                className="flex items-start gap-4"
                            >
                                <div className="mt-1 h-3 w-3 rounded-full bg-violet-400" />

                                <div>
                                    <p className="font-black">
                                        Predicted {prediction.team_a} vs {prediction.team_b}
                                    </p>

                                    <p className="mt-1 text-sm text-white/50">
                                        Pick: {prediction.pred_a}:{prediction.pred_b}
                                    </p>

                                    <p className="mt-1 text-xs uppercase tracking-[0.15em] text-violet-300">
                                        {prediction.updated_at
                                            ? new Date(prediction.updated_at).toLocaleString()
                                            : 'Recently'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <PublicFooter />
            </div>
        </div>
    );
}

function ProfileStat({ title, value }) {
    return (
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <h2 className="mt-3 text-4xl font-black">
                {value}
            </h2>
        </div>
    );
}

function PlayerBadge({ title, description, active }) {
    return (
        <div
            className={`rounded-2xl border p-5 transition ${
                active
                    ? 'border-violet-400/30 bg-violet-500/10'
                    : 'border-white/10 bg-black/30 opacity-50'
            }`}
        >
            <p className="text-lg font-black">
                {title}
            </p>

            <p className="mt-2 text-sm text-white/50">
                {description}
            </p>
        </div>
    );
}