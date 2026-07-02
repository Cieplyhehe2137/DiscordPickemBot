import { usePublicAuth } from '../../context/PublicAuthContext';

const ADMINISTRATOR_PERMISSION = 0x8n;

function hasAdminPermission(user) {
    if (!user) return false;

    return (user.guilds || []).some((g) => {
        try {
            return (BigInt(g.permissions) & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION;
        } catch {
            return false;
        }
    });
}

function Screen({ children }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                {children}
            </div>
        </div>
    );
}

export default function RequireAdmin({ children }) {
    const { user, loading, isLoggedIn } = usePublicAuth();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950">
                <div className="h-10 w-10 animate-pulse rounded-full bg-violet-500/40" />
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <Screen>
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                    PickemBot Admin
                </p>

                <h1 className="mt-3 text-2xl font-black">
                    Zaloguj się, żeby wejść do panelu
                </h1>

                <p className="mt-2 text-sm text-white/50">
                    Ta sekcja jest dostępna tylko dla adminów serwerów Discord obsługiwanych przez bota.
                </p>

                <a
                    href={`/api/auth/discord?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                    className="mt-6 inline-flex rounded-xl bg-violet-500 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-400"
                >
                    Zaloguj się przez Discord
                </a>
            </Screen>
        );
    }

    if (!hasAdminPermission(user)) {
        return (
            <Screen>
                <p className="text-sm uppercase tracking-[0.25em] text-red-300">
                    Brak dostępu
                </p>

                <h1 className="mt-3 text-2xl font-black">
                    Brak uprawnień administratora
                </h1>

                <p className="mt-2 text-sm text-white/50">
                    Zalogowano jako <span className="font-bold text-white/80">{user.global_name || user.username}</span>, ale to konto nie ma uprawnienia Administrator na żadnym serwerze obsługiwanym przez bota.
                </p>

                <a
                    href="/public"
                    className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                >
                    Wróć do strony publicznej
                </a>
            </Screen>
        );
    }

    return children;
}
