export default function PublicFooter() {
    return (
        <footer className="mt-20 border-t border-white/10 pt-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xl font-black">
                        Pick&apos;Em Platform
                    </p>

                    <p className="mt-2 max-w-md text-sm text-white/40">
                        Community-driven esports Pick&apos;Em platform with live matches,
                        rankings and public event hubs.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <a
                        href="/public"
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Communities
                    </a>

                    <a
                        href="https://discord.gg/NJhspKrXNK"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Discord
                    </a>
                </div>
            </div>
        </footer>
    );
}