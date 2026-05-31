export default function CommunityPulse({
    liveMatchesCount,
    totalPredictions,
    phase,
    communityAccuracy,
    mostTrustedPick,
    biggestUpset
}) {
    return (
        <>
            <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-8">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    Community Pulse
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                    <PulseStat
                        title="Live Matches"
                        value={liveMatchesCount}
                    />

                    <PulseStat
                        title="Total Picks"
                        value={totalPredictions}
                    />

                    <PulseStat
                        title="Event Phase"
                        value={phase}
                    />

                    <PulseStat
                        title="Community Accuracy"
                        value={`${communityAccuracy}%`}
                    />
                </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
                <InsightCard
                    title="Most Trusted Pick"
                    match={mostTrustedPick}
                    empty="No correct community picks yet."
                />

                <InsightCard
                    title="Biggest Upset"
                    match={biggestUpset}
                    empty="No upsets yet."
                />
            </div>
        </>
    );
}

function PulseStat({ title, value }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-sm uppercase tracking-[0.15em] text-violet-300">
                {title}
            </p>

            <p className="mt-3 text-3xl font-black">
                {value}
            </p>
        </div>
    );
}

function InsightCard({ title, match, empty }) {
    if (!match) {
        return (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                    {title}
                </p>

                <p className="mt-3 text-white/40">
                    {empty}
                </p>
            </div>
        );
    }

    const confidence = Math.max(
        match.team_a_percentage,
        match.team_b_percentage
    );

    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                {title}
            </p>

            <h3 className="mt-3 text-2xl font-black">
                {match.team_a} vs {match.team_b}
            </h3>

            <p className="mt-2 text-white/50">
                Community picked {match.community_pick} with {confidence}% confidence.
            </p>

            <p className="mt-2 text-white/50">
                Winner: {match.winner}
            </p>
        </div>
    );
}