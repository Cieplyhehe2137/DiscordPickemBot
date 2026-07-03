import TeamLogoBlock from './TeamLogoBlock';

export default function PublicFeaturedMatch({
    heroMatch,
    myPrediction,
    nowTick,
    formatPhaseLabel,
    formatStatusLabel,
    getCountdown,
    openPredictionModal,
    openMatchModal
}) {
    if (!heroMatch) return null;

    const isFinal = heroMatch.ui_status === 'FINAL';
    const teamAWon = Number(heroMatch.score_a) > Number(heroMatch.score_b);
    const teamBWon = Number(heroMatch.score_b) > Number(heroMatch.score_a);

    return (
        <div className="relative mt-10 overflow-hidden rounded-[2.5rem] border border-violet-400/20 bg-violet-500/10 p-8 shadow-[0_0_80px_rgba(139,92,246,0.14)] transition-all duration-500 hover:scale-[1.005]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.28),transparent_45%)]" />

            <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">
                            Wyróżniony mecz
                        </p>

                        {heroMatch.ui_status === 'LIVE' && (
                            <div className="mt-4 flex items-center gap-2">
                                <div className="h-3 w-3 animate-pulse rounded-full bg-green-400" />

                                <span className="text-sm font-black uppercase tracking-[0.2em] text-green-300">
                                    Na żywo teraz
                                </span>
                            </div>
                        )}
                    </div>

                    <span
                        className={`rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.15em] ${
                            heroMatch.ui_status === 'LIVE'
                                ? 'bg-green-500/20 text-green-300 animate-pulse'
                                : heroMatch.ui_status === 'FINAL'
                                    ? 'bg-zinc-500/20 text-zinc-300'
                                    : heroMatch.ui_status === 'LOCKED'
                                        ? 'bg-red-500/20 text-red-300'
                                        : 'bg-yellow-500/20 text-yellow-300'
                        }`}
                    >
                        {formatStatusLabel(heroMatch.ui_status)}
                    </span>
                </div>

                <div className="mt-8 grid items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
                    <div className={isFinal ? (teamAWon ? 'drop-shadow-[0_0_30px_rgba(74,222,128,0.45)]' : 'opacity-50') : ''}>
                        <TeamLogoBlock team={heroMatch.team_a} />
                    </div>

                    <div className="text-center">
                        <p className="text-xs uppercase tracking-[0.25em] text-white/40">
                            {formatPhaseLabel(heroMatch.phase)}
                        </p>

                        <div
                            className={`mt-4 flex items-center justify-center gap-5 transition-all duration-500 ${
                                heroMatch.just_updated ? 'scale-110 text-green-300' : 'text-white'
                            }`}
                        >
                            <span className="text-6xl font-black md:text-7xl">
                                {heroMatch.score_a ?? 0}
                            </span>

                            <span className="text-2xl font-black text-white/30">
                                :
                            </span>

                            <span className="text-6xl font-black md:text-7xl">
                                {heroMatch.score_b ?? 0}
                            </span>
                        </div>

                        <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                            BO{heroMatch.best_of || 3}
                        </p>

                        {heroMatch.live_status && (
                            <p className="mt-3 text-sm font-black uppercase tracking-[0.2em] text-green-300">
                                {heroMatch.live_status} • MAP {heroMatch.current_map || 1}
                            </p>
                        )}

                        {!heroMatch.live_status && (
                            <p className="mt-3 text-sm text-white/40">
                                Typowanie społeczności wkrótce się otworzy
                            </p>
                        )}
                    </div>

                    <div className={isFinal ? (teamBWon ? 'drop-shadow-[0_0_30px_rgba(74,222,128,0.45)]' : 'opacity-50') : ''}>
                        <TeamLogoBlock team={heroMatch.team_b} />
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 text-white/60">
                        <span>
                            {heroMatch.formatted_time || 'Termin do ustalenia'}
                        </span>

                        {heroMatch.start_time_utc && (
                            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-violet-200">
                                {heroMatch.countdown || getCountdown(heroMatch.start_time_utc, nowTick)}
                            </span>
                        )}

                        {myPrediction && (
                            <span className="rounded-full bg-violet-500/20 px-4 py-2 text-sm font-black uppercase tracking-[0.15em] text-violet-300">
                                Twój typ zapisany
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <button
                            disabled={heroMatch.ui_status === 'LOCKED' || heroMatch.ui_status === 'FINAL'}
                            onClick={() => {
                                if (heroMatch.ui_status === 'LOCKED' || heroMatch.ui_status === 'FINAL') return;
                                openPredictionModal(heroMatch);
                            }}
                            className={`rounded-2xl px-6 py-4 font-black transition ${
                                heroMatch.ui_status === 'LOCKED' || heroMatch.ui_status === 'FINAL'
                                    ? 'cursor-not-allowed bg-white/10 text-white/30'
                                    : 'bg-violet-500 hover:bg-violet-400'
                            }`}
                        >
                            {heroMatch.ui_status === 'FINAL'
                                ? 'Typowanie zamknięte'
                                : heroMatch.ui_status === 'LOCKED'
                                    ? 'Zablokowane'
                                    : myPrediction
                                        ? 'Edytuj typ'
                                        : 'Typuj ten mecz'}
                        </button>

                        <button
                            onClick={() => openMatchModal(heroMatch)}
                            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-black text-white/80 transition hover:bg-white/10"
                        >
                            Szczegóły meczu
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}