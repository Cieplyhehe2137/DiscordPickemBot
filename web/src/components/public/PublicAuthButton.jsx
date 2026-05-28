import { useEffect, useRef, useState } from 'react';
import { usePublicAuth } from '../../context/PublicAuthContext';

export default function PublicAuthButton() {
    const { user, loading, isLoggedIn } = usePublicAuth();

    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);

    const displayName = user?.global_name || user?.username || 'Profile';

    const avatarUrl =
        user?.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
            : null;

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    if (loading) {
        return (
            <div className="h-10 w-32 animate-pulse rounded-xl bg-white/10" />
        );
    }

    if (!isLoggedIn) {
        return (
            <a
                href="/api/auth/discord"
                className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-black text-white transition hover:bg-violet-400"
            >
                Login Discord
            </a>
        );
    }

    return (
        <div
            ref={dropdownRef}
            className="relative"
        >
            <button
                onClick={() => setOpen((value) => !value)}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 transition hover:bg-white/10"
            >
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-violet-500/20 text-sm font-black text-violet-300">
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={displayName}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        displayName.charAt(0)
                    )}
                </div>

                <span className="max-w-[140px] truncate text-sm font-black text-white/80">
                    {displayName}
                </span>
            </button>

            {open && (
                <div className="absolute right-0 top-14 z-50 w-64 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
                    <div className="border-b border-white/10 p-4">
                        <p className="truncate text-sm font-black text-white">
                            {displayName}
                        </p>

                        <p className="mt-1 text-xs text-white/40">
                            Discord Connected
                        </p>
                    </div>

                    <div className="p-2">
                        <a
                            href={`/public/users/${user.id}`}
                            className="flex rounded-xl px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/5"
                        >
                            My Profile
                        </a>

                        <a
                            href="/public/me/predictions"
                            className="flex rounded-xl px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/5"
                        >
                            My Predictions
                        </a>

                        <a
                            href="/public/leaderboard"
                            className="flex rounded-xl px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/5"
                        >
                            Leaderboard
                        </a>

                        <a
                            href="/app"
                            className="flex rounded-xl px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/5"
                        >
                            Dashboard
                        </a>

                        <a
                            href="/api/auth/logout"
                            className="flex rounded-xl px-4 py-3 text-sm font-black text-red-300 transition hover:bg-red-500/10"
                        >
                            Logout
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}