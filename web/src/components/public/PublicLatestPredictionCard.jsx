export default function PublicLatestPredictionCard({
    latestPrediction,
    myPredictionsProgress
}) {
    if (!latestPrediction) return null;

    const summary = latestPrediction.series
        ? `${latestPrediction.series.pred_a}:${latestPrediction.series.pred_b}`
        : `${latestPrediction.score_a}:${latestPrediction.score_b}`;

    return (
        <div className="mt-8 overflow-hidden rounded-[2rem] border border-violet-400/20 bg-violet-500/10 p-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        Twój ostatni typ
                    </p>

                    <h3 className="mt-2 text-4xl font-black">
                        {summary}
                    </h3>

                    <p className="mt-2 text-white/50">
                        Mecz #{latestPrediction.match_id}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3">
                        <p className="text-sm text-white/40">
                            Postęp
                        </p>

                        <p className="mt-1 text-3xl font-black text-violet-300">
                            {myPredictionsProgress}%
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            const picksSection = document.getElementById('matches-section');

                            if (picksSection) {
                                picksSection.scrollIntoView({
                                    behavior: 'smooth'
                                });
                            }
                        }}
                        className="rounded-2xl bg-violet-500 px-5 py-3 font-black transition hover:bg-violet-400"
                    >
                        Zobacz typy
                    </button>

                    <a
                        href="/public/me/predictions"
                        className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white/80 transition hover:bg-white/10"
                    >
                        Wszystkie typy
                    </a>
                </div>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/40">
                <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${myPredictionsProgress}%` }}
                />
            </div>
        </div>
    );
}