import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { getEventLeaderboard } from "../lib/api.js";
import { odmien } from "../lib/odmiana.js";

function LeaderboardPage() {
  const { slug } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const [leaderboard, setLeaderboard] = useState([]);
  const [uczestnicy, setUczestnicy] = useState(0);
  const [strony, setStrony] = useState(null);

  // Numer strony trzymamy razem z turniejem, dla którego go wybrano.
  // Dzięki temu wejście na inny turniej wraca na stronę 1 samo, bez
  // zerowania stanu w efekcie (to wywołuje kaskadę renderów).
  const [wybranaStrona, setWybranaStrona] = useState({ slug, numer: 1 });

  const strona = wybranaStrona.slug === slug ? wybranaStrona.numer : 1;

  const idzDoStrony = (numer) => setWybranaStrona({ slug, numer });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError(null);

        const data = await getEventLeaderboard(slug, { strona });

        setLeaderboard(data.leaderboard ?? []);
        setUczestnicy(Number(data.uczestnicy) || 0);
        setStrony(data.strony ?? null);
      } catch (err) {
        console.error("LEADERBOARD ERROR:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, [slug, strona]);

  useEffect(() => {
    if (!realtimeRefresh?.version) {
      return;
    }

    const payload = realtimeRefresh.payload;

    if (payload?.slug && String(payload.slug) !== String(slug)) {
      return;
    }

    async function refreshLeaderboard() {
      try {
        const data = await getEventLeaderboard(slug, { strona });

        setLeaderboard(data.leaderboard ?? []);
        setUczestnicy(Number(data.uczestnicy) || 0);
        setStrony(data.strony ?? null);
        setError(null);
      } catch (err) {
        console.error("LEADERBOARD REALTIME REFRESH ERROR:", err);
      }
    }

    refreshLeaderboard();
  }, [realtimeRefresh, slug, strona]);

  if (loading) {
    return <p>Ładowanie rankingu...</p>;
  }

  if (error) {
    return <p>Nie udało się pobrać rankingu: {error}</p>;
  }

  return (
    <main className="leaderboard-page">
      <span className="events-kicker">Ranking</span>

      <h1>Ranking graczy</h1>

      <Link className="matches-page__back" to={`/events/${slug}`}>
        ← Wróć do eventu
      </Link>

      <div className="leaderboard-list">
        {leaderboard.length === 0 ? (
          <div className="leaderboard-empty">
            {uczestnicy > 0 ? (
              <>
                <strong>Ranking jeszcze się nie zaczął.</strong>

                <p>
                  Ten event ma już {uczestnicy}{" "}
                  {odmien(uczestnicy, "gracza", "graczy", "graczy")} z oddanymi
                  typami, ale nikt nie ma jeszcze punktów — pojawią się po
                  pierwszych rozliczonych meczach i fazach.
                </p>
              </>
            ) : (
              <>
                <strong>Nikt jeszcze nie typował.</strong>

                <p>Ranking pojawi się, gdy pierwsi gracze oddadzą typy.</p>
              </>
            )}
          </div>
        ) : (
          leaderboard.map((player) => (
            // Miejsce bierzemy z pola rank, policzonego po stronie serwera na
            // pełnej liście. Wcześniej szło z indeksu w tablicy, więc każda
            // strona zaczynała się od pierwszego miejsca i medali - na drugiej
            // stronie gracz z 51. miejsca dostawał złoto.
            <div
              className={`leaderboard-row ${
                player.rank === 1
                  ? "leaderboard-row--gold"
                  : player.rank === 2
                    ? "leaderboard-row--silver"
                    : player.rank === 3
                      ? "leaderboard-row--bronze"
                      : ""
              }`}
              key={player.user_id}
            >
              <strong className="leaderboard-rank">
                {player.rank === 1
                  ? "🥇"
                  : player.rank === 2
                    ? "🥈"
                    : player.rank === 3
                      ? "🥉"
                      : `#${player.rank}`}
              </strong>

              <Link
                className="leaderboard-player"
                to={`/events/${slug}/player/${player.user_id}`}
              >
                {player.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${player.user_id}/${player.avatar}.png?size=64`}
                    alt=""
                  />
                )}

                <span>{player.displayname ?? player.user_id}</span>
              </Link>

              <div className="leaderboard-score">
                <strong>{Number(player.total_points ?? 0)} pkt</strong>

                {/* Rozbicie na fazy - dane były liczone od dawna, ale
                    zwracał je wyłącznie endpoint, którego front nie wołał. */}
                <span className="leaderboard-breakdown">
                  {[
                    ["Swiss", player.swiss_points],
                    ["Play-In", player.playin_points],
                    ["Playoffs", player.playoffs_points],
                    ["Double Elim", player.doubleelim_points],
                    ["Mecze", player.phase_match_points],
                    ["MVP", player.mvp_points],
                  ]
                    .filter(([, punkty]) => Number(punkty) > 0)
                    .map(([nazwa, punkty]) => `${nazwa} ${punkty}`)
                    .join(" · ") || "brak punktów"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pasek stron pokazuje się dopiero, gdy jest co przewijać. */}
      {strony && strony.ile > 1 && (
        <nav className="leaderboard-strony" aria-label="Strony rankingu">
          <button
            type="button"
            disabled={strona <= 1}
            onClick={() => idzDoStrony(strona - 1)}
          >
            ← Poprzednia
          </button>

          <span className="leaderboard-strony__opis">
            Strona <strong>{strony.numer}</strong> z {strony.ile}
            <em>
              {" · "}
              {strony.wszystkich}{" "}
              {odmien(strony.wszystkich, "gracz", "gracze", "graczy")}
            </em>
          </span>

          <button
            type="button"
            disabled={strona >= strony.ile}
            onClick={() => idzDoStrony(strona + 1)}
          >
            Następna →
          </button>
        </nav>
      )}
    </main>
  );
}

export default LeaderboardPage;
