import { NavLink, Link, Outlet } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

export default function AppLayout() {

    const {
        selectedGuild,
        selectedEvent
    } = useApp();

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-white/10 bg-black/30 p-6 backdrop-blur-xl lg:block">
                <h1 className="text-2xl font-black tracking-widest">
                    HYPERLAND
                </h1>

                <p className="mt-1 text-sm text-white/40">
                    Pick&apos;Em Admin
                </p>

                <nav className="mt-10 grid gap-3">
                    <NavLink
                        to="/app/guilds"
                        className={({ isActive }) =>
                            `rounded-2xl border px-5 py-4 font-bold transition ${isActive
                                ? 'border-violet-400/40 bg-violet-500/20 text-violet-200'
                                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                            }`
                        }
                    >
                        Servers
                    </NavLink>

                    <NavLink
                        to="/app"
                        end
                        className={({ isActive }) =>
                            `rounded-2xl border px-5 py-4 font-bold transition ${isActive
                                ? 'border-violet-400/40 bg-violet-500/20 text-violet-200'
                                : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                            }`
                        }
                    >
                        Events
                    </NavLink>
                </nav>
                <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                        Current Guild
                    </p>

                    <h3 className="mt-2 text-xl font-black">
                        {selectedGuild?.name || 'No Guild'}
                    </h3>

                    {selectedGuild?.id && (
                        <Link
                            to={`/app/guilds/${selectedGuild.id}`}
                            className="mt-3 inline-flex text-sm font-bold text-violet-300 transition hover:text-violet-200"
                        >
                            Open Guild
                        </Link>
                    )}

                    <p className="mt-4 text-xs uppercase tracking-[0.2em] text-white/40">
                        Current Event
                    </p>

                    <h3 className="mt-2 text-lg font-black">
                        {selectedEvent?.name || 'No Event'}
                    </h3>
                    {selectedEvent?.slug && (
                        <Link
                            to={`/app/events/${selectedEvent.slug}`}
                            className="mt-3 inline-flex text-sm font-bold text-violet-300 transition hover:text-violet-200"
                        >
                            Open Event
                        </Link>
                    )}
                </div>
            </aside>

            <div className="lg:pl-72">
                <header className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl">
                    <div className="flex items-center justify-between px-6 py-5">
                        <div>
                            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">
                                PickemBot
                            </p>

                            <h2 className="text-xl font-black">
                                Admin Dashboard
                            </h2>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/70">
                            Local Dev
                        </div>
                    </div>
                </header>

                <main>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}