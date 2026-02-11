import { Outlet, Link, useParams } from "react-router-dom";

export default function PublicLayout() {
  const { guildSlug } = useParams();

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-black/60 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-4">
          
          <div className="font-bold text-lg tracking-wide">
            🎯 Pick’Em
          </div>

          <nav className="flex gap-8 text-sm text-gray-300">
            <Link
              to={`/public/${guildSlug}/pickem`}
              className="hover:text-white transition"
            >
              Strona główna
            </Link>

            <Link
              to={`/public/${guildSlug}/pickem/leaderboard`}
              className="hover:text-white transition"
            >
              Ranking
            </Link>
          </nav>

        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-6xl mx-auto px-6 py-20">
        <Outlet />
      </main>

    </div>
  );
}
