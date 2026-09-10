import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { getEventPlayerProfile } from "../lib/api.js";

function PlayerProfilePage() {
  const { slug, userId } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError("");

        const data = await getEventPlayerProfile(slug, userId);

        setProfile(data);
      } catch (err) {
        setError(err.message || "Nie udało się pobrać profilu gracza.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [slug, userId]);

  useEffect(() => {
    if (!realtimeRefresh?.version) {
      return;
    }

    const payload = realtimeRefresh.payload;

    if (payload?.slug && String(payload.slug) !== String(slug)) {
      return;
    }

    async function refreshProfile() {
      try {
        const data = await getEventPlayerProfile(slug, userId);

        setProfile(data);
        setError("");
      } catch (err) {
        console.error("PLAYER PROFILE REALTIME REFRESH ERROR:", err);
      }
    }

    refreshProfile();
  }, [realtimeRefresh, slug, userId]);

  if (loading) {
    return <p>Ładowanie profilu...</p>;
  }

  if (error) {
    return <p>Nie udało się pobrać profilu: {error}</p>;
  }

  if (!profile?.profile) {
    return <p>Nie znaleziono profilu gracza.</p>;
  }

  const player = profile.profile;

  return (
    <main className="player-profile-page">
      <span className="events-kicker">Profil gracza</span>

      <h1>Statystyki gracza</h1>

      <Link className="matches-page__back" to={`/events/${slug}/leaderboard`}>
        ← Wróć do rankingu
      </Link>

      <section className="player-profile-card">
        {/* Awatar mają tylko gracze z wiersza w user_profiles - reszta
            dostaje pustą obwódkę, żeby nagłówek nie skakał. */}
        <div className="player-profile-head">
          {player.avatar ? (
            <img
              className="player-profile-avatar"
              src={`https://cdn.discordapp.com/avatars/${player.user_id}/${player.avatar}.png?size=128`}
              alt=""
            />
          ) : (
            <span className="player-profile-avatar player-profile-avatar--pusty" />
          )}

          <h2>{player.displayname}</h2>
        </div>

        <div className="player-profile-stats">
          <div className="player-profile-stat">
            <span>Punkty</span>
            <strong>{player.total_points}</strong>
          </div>

          <div className="player-profile-stat">
            <span>Ranking</span>
            <strong>{player.rank > 0 ? `#${player.rank}` : "—"}</strong>
          </div>

          <div className="player-profile-stat">
            <span>Skuteczność</span>
            <strong>{player.accuracy}%</strong>
          </div>

          <div className="player-profile-stat">
            <span>Trafione mecze</span>
            <strong>
              {player.correct_winners} / {player.finished_predictions}
            </strong>
          </div>

          <div className="player-profile-stat">
            <span>Exacty map</span>
            <strong>{player.exact_maps}</strong>
          </div>

          <div className="player-profile-stat">
            <span>Trafione mapy</span>
            <strong>{player.correct_maps}</strong>
          </div>
          <div className="player-profile-stat">
            <span>Punkty za serię</span>
            <strong>{player.series_points ?? 0}</strong>
          </div>

          <div className="player-profile-stat">
            <span>Punkty za mapy</span>
            <strong>{player.map_points ?? 0}</strong>
          </div>

          <div className="player-profile-stat">
            <span>Średnia pkt / mecz</span>
            <strong>
              {player.finished_predictions > 0
                ? (
                    Number(player.total_points ?? 0) /
                    Number(player.finished_predictions)
                  ).toFixed(1)
                : "0.0"}
            </strong>
          </div>

          <div className="player-profile-stat">
            <span>Skuteczność map</span>
            <strong>
              {player.predicted_maps > 0
                ? Math.round(
                    (Number(player.correct_maps ?? 0) /
                      Number(player.predicted_maps)) *
                      100,
                  )
                : 0}
              %
            </strong>
          </div>
          <div className="player-profile-stat">
            <span>Najlepszy mecz</span>
            <strong>{player.best_match_points ?? 0} pkt</strong>
          </div>
          <div className="player-profile-stat">
            <span>Exacty map %</span>
            <strong>
              {player.predicted_maps > 0
                ? Math.round(
                    (Number(player.exact_maps ?? 0) /
                      Number(player.predicted_maps)) *
                      100,
                  )
                : 0}
              %
            </strong>
          </div>
        </div>
      </section>

      <section className="player-profile-streaks">
        <div className="player-profile-streaks__header">
          <span className="events-kicker">Serie</span>

          <h2>Forma gracza</h2>
        </div>

        <div className="player-profile-streaks__grid">
          <div className="player-profile-streak">
            <span>🔥 Najlepsza seria trafień</span>

            <strong>{player.best_correct_streak ?? 0}</strong>

            <small>meczów z rzędu</small>
          </div>

          <div className="player-profile-streak">
            <span>⚡ Aktualna seria trafień</span>

            <strong>{player.current_correct_streak ?? 0}</strong>

            <small>meczów z rzędu</small>
          </div>
          <div className="player-profile-streak">
            <span>💎 Perfekcyjne mecze</span>

            <strong>{player.perfect_matches ?? 0}</strong>

            <small>idealnie wytypowanych</small>
          </div>
        </div>
      </section>

      <section className="player-profile-records">
        <div className="player-profile-records__header">
          <span className="events-kicker">Rekordy</span>

          <h2>Rekordy gracza</h2>
        </div>

        <div className="player-profile-records__list">
          <div className="player-profile-record">
            <div>
              <span>🗺️ Najlepszy wynik mapowy</span>
              <small>Najwięcej punktów za mapy w jednym meczu</small>
            </div>

            <strong>{player.best_map_match_points ?? 0} pkt</strong>
          </div>

          <div className="player-profile-record">
            <div>
              <span>📈 Średnia za trafiony mecz</span>
              <small>Średnia punktów w meczach z trafionym zwycięzcą</small>
            </div>

            <strong>
              {Number(player.average_points_correct_match ?? 0).toFixed(1)} pkt
            </strong>
          </div>
        </div>
      </section>

      {player.event_comparison && (
        <section className="player-profile-comparison">
          <div className="player-profile-comparison__header">
            <span className="events-kicker">Porównanie</span>

            <h2>Na tle eventu</h2>
          </div>

          <div className="player-profile-comparison__grid">
            {[
              {
                label: "🏆 Punkty",
                data: player.event_comparison.points,
              },
              {
                label: "🎯 Skuteczność",
                data: player.event_comparison.accuracy,
              },
              {
                label: "💎 Exacty map",
                data: player.event_comparison.exact_maps,
              },
              {
                label: "🗺️ Trafione mapy",
                data: player.event_comparison.correct_maps,
              },
            ].map((item) => (
              <div className="player-profile-comparison__item" key={item.label}>
                <span>{item.label}</span>

                <strong>
                  #{item.data?.rank ?? 0}
                  <small> / {item.data?.total ?? 0}</small>
                </strong>

                <div className="player-profile-comparison__top">
                  TOP {item.data?.top_percent ?? 0}%
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="player-profile-history">
        <div className="player-profile-history__header">
          <span className="events-kicker">Historia</span>

          <h2>Ostatnie typy</h2>
        </div>

        {player.recent_predictions?.length ? (
          <div className="player-profile-history__list">
            {player.recent_predictions.map((prediction) => {
              const finished =
                prediction.res_a !== null && prediction.res_b !== null;

              const correct =
                finished &&
                ((prediction.pred_a > prediction.pred_b &&
                  prediction.res_a > prediction.res_b) ||
                  (prediction.pred_b > prediction.pred_a &&
                    prediction.res_b > prediction.res_a));

              return (
                <div
                  key={prediction.match_id}
                  className="player-profile-history__item"
                >
                  <div
                    className={`player-profile-history__row ${
                      expandedMatchId === prediction.match_id
                        ? "player-profile-history__row--expanded"
                        : ""
                    }`}
                    onClick={() =>
                      setExpandedMatchId((current) =>
                        current === prediction.match_id
                          ? null
                          : prediction.match_id,
                      )
                    }
                  >
                    <div className="player-profile-history__status">
                      {finished ? (correct ? "✅" : "❌") : "⏳"}
                    </div>

                    <div className="player-profile-history__match">
                      <strong>
                        {prediction.team_a}
                        {" vs "}
                        {prediction.team_b}
                      </strong>

                      <span>
                        Typ:{" "}
                        <b>
                          {prediction.pred_a}:{prediction.pred_b}
                        </b>
                        {finished && (
                          <>
                            {" · "}Wynik:{" "}
                            <b>
                              {prediction.res_a}:{prediction.res_b}
                            </b>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="player-profile-history__points-wrap">
                      <strong className="player-profile-history__points">
                        {prediction.points > 0
                          ? `+${prediction.points}`
                          : prediction.points}{" "}
                        pkt
                      </strong>

                      {expandedMatchId === prediction.match_id && (
                        <span className="player-profile-history__points-breakdown">
                          Seria +{player.series_points} · Mapy +
                          {player.map_points}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="player-profile-history__expand">
                    {expandedMatchId === prediction.match_id ? "▲" : "▼"}
                  </span>

                  {expandedMatchId === prediction.match_id &&
                    prediction.maps?.length > 0 && (
                      <div className="player-profile-history__maps">
                        {prediction.maps.map((map) => (
                          <div
                            className="player-profile-history__map"
                            key={map.map_no}
                          >
                            <span>Mapa {map.map_no}</span>

                            <span>
                              Typ:{" "}
                              <strong>
                                {map.pred_a}:{map.pred_b}
                              </strong>
                            </span>

                            <span>
                              Wynik:{" "}
                              <strong>
                                {map.res_a}:{map.res_b}
                              </strong>
                            </span>

                            <span>
                              {map.exact
                                ? "🎯 Exact"
                                : map.correct_winner
                                  ? "✅ Trafiony zwycięzca"
                                  : "❌ Nietrafiony"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="leaderboard-empty">Brak typów w tym evencie.</div>
        )}
      </section>
    </main>
  );
}

export default PlayerProfilePage;
