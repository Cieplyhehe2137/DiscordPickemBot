import PublicAuthButton from './PublicAuthButton';

export default function PublicNavbar({
    active,
    eventName,
    guildSlug,
    guildName
}) {
    const linkClass = (name) =>
        active === name
            ? 'rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-black text-violet-300'
            : 'rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white';

    return (
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">

            <a href="/public" className={linkClass('communities')}>
                Communities
            </a>

            {guildSlug && (
                <>
                    <div className="h-5 w-px bg-white/10" />

                    <a href={`/public/${guildSlug}`} className={linkClass('guild')}>
                        {guildName || 'Server'}
                    </a>
                </>
            )}

            <div className="h-5 w-px bg-white/10" />

            <a href="/public/archives" className={linkClass('archives')}>
                Archives
            </a>

            <a href="/public/leaderboard" className={linkClass('leaderboard')}>
                Leaderboard
            </a>

            {eventName && (
                <>
                    <div className="h-5 w-px bg-white/10" />

                    <span className="rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-black text-violet-300">
                        {eventName}
                    </span>
                </>
            )}

            <div className="ml-auto">
                <PublicAuthButton />
            </div>
        </div>
    );
}