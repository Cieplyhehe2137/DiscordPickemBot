import { Link } from "react-router-dom";
import PublicAuthButton from "./PublicAuthButton";

export default function PublicNavbar({
  active,
  eventName,
  guildSlug,
  guildName,
}) {
  const linkClass = (name) =>
    active === name
      ? "rounded-xl bg-violet-500/20 px-4 py-2 text-sm font-black text-violet-300"
      : "rounded-xl px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white";

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      {/* Link, nie <a href>: zwykłe kotwice przeładowywały cały dokument
                przy każdym kliknięciu w menu, więc aplikacja startowała od zera
                i dociągała chunki na nowo - to niweczyło podział kodu na trasy. */}
      <Link to="/public" className={linkClass("communities")}>
        Społeczności
      </Link>

      {guildSlug && (
        <>
          <div className="h-5 w-px bg-white/10" />

          <Link to={`/public/${guildSlug}`} className={linkClass("guild")}>
            {guildName || "Serwer"}
          </Link>
        </>
      )}

      <div className="h-5 w-px bg-white/10" />

      <Link to="/public/archives" className={linkClass("archives")}>
        Archiwum
      </Link>

      <Link to="/public/leaderboard" className={linkClass("leaderboard")}>
        Ranking
      </Link>

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
