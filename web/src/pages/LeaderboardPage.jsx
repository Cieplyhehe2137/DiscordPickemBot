import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { getEventLeaderboard } from "../lib/api.js";
import { odmien } from "../lib/odmiana.js";

function LeaderboardPage() {
  const { slug } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const [leaderboard, setLeaderboard] = useState([]);
  const [uczestnicy, setUczestnicy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true);
        setError(null);

        const data = await getEventLeaderboard(slug);

        setLeaderboard(data.leaderboard ?? []);
        setUczestnicy(Number(data.uczestnicy) || 0);
      } catch (err) {
        console.error("LEADERBOARD ERROR:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, [slug]);

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
        const data = await getEventLeaderboard(slug);

        setLeaderboard(data.leaderboard ?? []);
        setUczestnicy(Number(data.uczestnicy) || 0);
        setError(null);
      } catch (err) {
        console.error("LEADERBOARD REALTIME REFRESH ERROR:", err);
      }
    }

    refreshLeaderboard();
  }, [realtimeRefresh, slug]);

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
          leaderboard.map((player, index) => (
            <div
              className={`leaderboard-row ${
                index === 0
                  ? "leaderboard-row--gold"
                  : index === 1
                    ? "leaderboard-row--silver"
                    : index === 2
                      ? "leaderboard-row--bronze"
                      : ""
              }`}
              key={player.user_id}
            >
              <strong className="leaderboard-rank">
                {index === 0
                  ? "🥇"
                  : index === 1
                    ? "🥈"
                    : index === 2
                      ? "🥉"
                      : `#${index + 1}`}
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
    </main>
  );
}

export default LeaderboardPage;
