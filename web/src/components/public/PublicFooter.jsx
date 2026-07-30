import { Link } from 'react-router-dom';
export default function PublicFooter() {
    return (
        <footer className="mt-20 border-t border-white/10 pt-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xl font-black">
                        Platforma Pick&apos;Em
                    </p>

                    <p className="mt-2 max-w-md text-sm text-white/40">
                        Platforma Pick&apos;Em dla społeczności esportowej z meczami na żywo,
                        rankingami i publicznymi stronami wydarzeń.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Link
                        to="/public"
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        Społeczności
                    </Link>
                </div>
            </div>
        </footer>
    );
}