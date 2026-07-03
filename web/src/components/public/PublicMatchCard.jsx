import { MiniTeamLogo } from './TeamLogoBlock';

export default function PublicMatchCard({
    match,
    myPrediction,
    nowTick,
    formatPhaseLabel,
    formatStatusLabel,
    getCountdown,
    openMatchModal,
    openPredictionModal
}) {
    const predictionSummary = myPrediction?.series
        ? `${myPrediction.series.pred_a}:${myPrediction.series.pred_b}`
        : myPrediction
            ? `${myPrediction.score_a}:${myPrediction.score_b}`
            : null;

    return (
        <div
            id={`match-${match.id}`}
            onClick={() => openMatchModal(match)}
            className={`cursor-pointer rounded-2xl border p-5 transition-all duration-300 ${
                match.ui_status === 'LIVE'
                    ? 'border-green-400/40 bg-green-500/10 shadow-[0_0_60px_rgba(34,197,94,0.18)] scale-[1.01]'
                    : match.ui_status === 'FINAL'
                        ? 'border-zinc-500/20 bg-zinc-500/5'
                        : 'border-white/10 bg-black/30 hover:border-violet-400/30 hover:bg-violet-500/5 hover:scale-[1.01]'
            }`}
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
                        {formatPhaseLabel(match.phase)} • BO{match.best_of || 3}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <MiniTeamLogo team={match.team_a} />

                        <div className="flex items-center gap-2 text-2xl font-black">
                            <span className={match.ui_status === 'FINAL' && Number(match.score_a) < Number(match.score_b) ? 'text-white/40' : ''}>
                                {match.team_a}
                            </span>

                            <span className="text-white/30">vs</span>

                            <span className={match.ui_status === 'FINAL' && Number(match.score_b) < Number(match.score_a) ? 'text-white/40' : ''}>
                                {match.team_b}
                            </span>
                        </div>

                        <MiniTeamLogo team={match.team_b} />
                    </div>

                    <p className="mt-3 text-lg font-black text-violet-300">
                        {match.score_a ?? 0} : {match.score_b ?? 0}
                    </p>

                    <p className="mt-2 text-sm text-white/40">
                        Mecz #{match.match_no || '-'}
                    </p>

                    {predictionSummary && (
                        <p className="mt-2 inline-flex rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-violet-300">
                            Twój typ: {predictionSummary}
                        </p>
                    )}
                </div>

                <div
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.15em] ${
                        match.ui_status === 'LIVE'
                            ? 'border border-green-400/30 bg-green-500/10 text-green-300'
                            : match.ui_status === 'FINAL'
                                ? 'bg-zinc-500/20 text-zinc-300'
                                : match.ui_status === 'LOCKED'
                                    ? 'bg-red-500/20 text-red-300'
                                    : 'bg-yellow-500/20 text-yellow-300'
                    }`}
                >
                    {match.ui_status === 'LIVE' && (
                        <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                    )}

                    {formatStatusLabel(match.ui_status)}
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/40">
                <span>{match.formatted_time || 'Termin do ustalenia'}</span>

                {match.start_time_utc && (
                    <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-violet-200">
                        {match.countdown || getCountdown(match.start_time_utc, nowTick)}
                    </span>
                )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
                <button
                    disabled={match.ui_status === 'LOCKED' || match.ui_status === 'FINAL'}
                    onClick={(e) => {
                        e.stopPropagation();

                        if (match.ui_status === 'LOCKED' || match.ui_status === 'FINAL') return;

                        openPredictionModal(match);
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                        match.ui_status === 'LOCKED' || match.ui_status === 'FINAL'
                            ? 'cursor-not-allowed bg-white/10 text-white/30'
                            : 'bg-violet-500 hover:bg-violet-400'
                    }`}
                >
                    {match.ui_status === 'FINAL'
                        ? 'Typowanie zamknięte'
                        : match.ui_status === 'LOCKED'
                            ? 'Zablokowane'
                            : myPrediction
                                ? 'Edytuj typ'
                                : 'Wpisz typ'}
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        openMatchModal(match);
                    }}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10"
                >
                    Szczegóły meczu
                </button>
            </div>
        </div>
    );
}