import { usePublicAuth } from '../../context/PublicAuthContext';

export default function PublicAuthButton() {
    const { user, loading, isLoggedIn } = usePublicAuth();

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
        <a
            href={`/public/users/${user.id}`}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/80 transition hover:bg-white/10"
        >
            {user.username || 'My Profile'}
        </a>
    );
}