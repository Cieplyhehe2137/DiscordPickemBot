import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { getEventPlayerProfile } from "../lib/api.js";
import BackLink from "../components/BackLink.jsx";

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
    return (
      <main className="ui-page">
        <div
          className="ui-stats"
          aria-busy="true"
          aria-label="Ładowanie profilu"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div className="ui-skeleton ui-skeleton--row" key={i} />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <BackLink to={`/events/${slug}/leaderboard`}>Wróć do rankingu</BackLink>

        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">
            Nie udało się wczytać profilu
          </strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  if (!profile?.profile) {
    return (
      <main className="ui-page">
        <BackLink to={`/events/${slug}/leaderboard`}>Wróć do rankingu</BackLink>

        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🔎
          </span>

          <strong className="ui-empty__title">Nie ma takiego gracza</strong>

          <p className="ui-empty__text">
            W tym evencie nikt o takim identyfikatorze nie typował.
          </p>
        </div>
      </main>
    );
  }

  const player = profile.profile;

  const averagePoints =
    player.finished_predictions > 0
      ? (
          Number(player.total_points ?? 0) / Number(player.finished_predictions)
        ).toFixed(1)
      : "0.0";

  const mapAccuracy =
    player.predicted_maps > 0
      ? Math.round(
          (Number(player.correct_maps ?? 0) / Number(player.predicted_maps)) *
            100,
        )
      : 0;

  const exactMapPercentage =
    player.predicted_maps > 0
      ? Math.round(
          (Number(player.exact_maps ?? 0) / Number(player.predicted_maps)) *
            100,
        )
      : 0;

  return (
    <main className="ui-page">
      <BackLink to={`/events/${slug}/leaderboard`}>Wróć do rankingu</BackLink>

      <section className="ui-card ui-stack">
        <div className="ui-row ui-row--wrap">
          {/* Awatar mają tylko gracze z wiersza w user_profiles - reszta
              dostaje inicjał, żeby nagłówek nie skakał. */}
          {player.avatar ? (
            <img
              className="ui-avatar ui-avatar--xl"
              src={`https://cdn.discordapp.com/avatars/${player.user_id}/${player.avatar}.png?size=128`}
              alt=""
            />
          ) : (
            <span className="ui-avatar ui-avatar--xl ui-avatar--initials">
              {player.displayname?.[0] ?? "?"}
            </span>
          )}

          <div>
            <span className="ui-kicker">Profil gracza</span>

            <h2>{player.displayname}</h2>
          </div>
        </div>

        <div className="ui-stats">
          <div className="ui-stat ui-stat--featured">
            <span>Punkty</span>
            <strong>{player.total_points}</strong>
            <small>{averagePoints} pkt / mecz</small>
          </div>

          <div className="ui-stat">
            <span>Ranking</span>
            <strong>{player.rank > 0 ? `#${player.rank}` : "—"}</strong>
          </div>

          <div className="ui-stat">
            <span>Skuteczność</span>
            <strong>{player.accuracy}%</strong>
            <small>
              {player.correct_winners} / {player.finished_predictions} meczów
            </small>
          </div>

          <div className="ui-stat">
            <span>Exacty map</span>
            <strong>{player.exact_maps}</strong>
            <small>{exactMapPercentage}% typowanych map</small>
          </div>

          <div className="ui-stat">
            <span>Trafione mapy</span>
            <strong>{player.correct_maps}</strong>
            <small>{mapAccuracy}% skuteczności</small>
          </div>

          <div className="ui-stat">
            <span>Najlepszy mecz</span>
            <strong>{player.best_match_points ?? 0}</strong>
            <small>punktów w jednym meczu</small>
          </div>

          <div className="ui-stat">
            <span>Punkty za serię</span>
            <strong>{player.series_points ?? 0}</strong>
          </div>

          <div className="ui-stat">
            <span>Punkty za mapy</span>
            <strong>{player.map_points ?? 0}</strong>
          </div>
        </div>
      </section>

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Serie</span>

            <h2>Forma gracza</h2>
          </div>
        </div>

        <div className="ui-stats">
          <div className="ui-stat">
            <span>🔥 Najlepsza seria trafień</span>
            <strong>{player.best_correct_streak ?? 0}</strong>
            <small>meczów z rzędu</small>
          </div>

          <div className="ui-stat">
            <span>⚡ Aktualna seria trafień</span>
            <strong>{player.current_correct_streak ?? 0}</strong>
            <small>meczów z rzędu</small>
          </div>

          <div className="ui-stat">
            <span>💎 Perfekcyjne mecze</span>
            <strong>{player.perfect_matches ?? 0}</strong>
            <small>idealnie wytypowanych</small>
          </div>
        </div>
      </section>

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Rekordy</span>

            <h2>Rekordy gracza</h2>
          </div>
        </div>

        <div className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight">
          <div className="ui-row ui-row--between ui-row--full">
            <div>
              <strong>🗺️ Najlepszy wynik mapowy</strong>

              <p className="ui-stat__hint">
                Najwięcej punktów za mapy w jednym meczu
              </p>
            </div>

            <span className="ui-count">
              {player.best_map_match_points ?? 0} pkt
            </span>
          </div>

          <div className="ui-row ui-row--between ui-row--full">
            <div>
              <strong>📈 Średnia za trafiony mecz</strong>

              <p className="ui-stat__hint">
                Średnia punktów w meczach z trafionym zwycięzcą
              </p>
            </div>

            <span className="ui-count">
              {Number(player.average_points_correct_match ?? 0).toFixed(1)} pkt
            </span>
          </div>
        </div>
      </section>

      {player.event_comparison && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">Porównanie</span>

              <h2>Na tle eventu</h2>
            </div>
          </div>

          <div className="ui-stats">
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
              <div className="ui-stat" key={item.label}>
                <span>{item.label}</span>

                <strong>#{item.data?.rank ?? 0}</strong>

                <small>
                  z {item.data?.total ?? 0} · TOP {item.data?.top_percent ?? 0}%
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Historia</span>

            <h2>Ostatnie typy</h2>
          </div>
        </div>

        {player.recent_predictions?.length ? (
          <div className="ui-stack ui-stack--tight">
            {player.recent_predictions.map((prediction) => {
              const finished =
                prediction.res_a !== null && prediction.res_b !== null;

              const correct =
                finished &&
                ((prediction.pred_a > prediction.pred_b &&
                  prediction.res_a > prediction.res_b) ||
                  (prediction.pred_b > prediction.pred_a &&
                    prediction.res_b > prediction.res_a));

              const expanded = expandedMatchId === prediction.match_id;

              return (
                <div
                  className="ui-card ui-card--flat ui-card--tight"
                  key={prediction.match_id}
                >
                  <button
                    type="button"
                    className="ui-disclosure"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedMatchId((current) =>
                        current === prediction.match_id
                          ? null
                          : prediction.match_id,
                      )
                    }
                  >
                    <span className="ui-disclosure__icon" aria-hidden="true">
                      {finished ? (correct ? "✅" : "❌") : "⏳"}
                    </span>

                    <span className="ui-disclosure__main">
                      <strong>
                        {prediction.team_a}
                        {" vs "}
                        {prediction.team_b}
                      </strong>

                      <span>
                        Typ: {prediction.pred_a}:{prediction.pred_b}
                        {finished &&
                          ` · Wynik: ${prediction.res_a}:${prediction.res_b}`}
                      </span>
                    </span>

                    <span
                      className={`ui-disclosure__points ${
                        prediction.points > 0
                          ? "ui-disclosure__points--scored"
                          : ""
                      }`}
                    >
                      {prediction.points > 0
                        ? `+${prediction.points}`
                        : prediction.points}{" "}
                      pkt
                    </span>

                    <span className="ui-disclosure__chevron" aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {expanded && (
                    <div className="ui-stack ui-stack--tight">
                      <p className="ui-stat__hint">
                        Seria +{player.series_points} · Mapy +
                        {player.map_points}
                      </p>

                      {prediction.maps?.length > 0 &&
                        prediction.maps.map((map) => (
                          <div className="ui-map-row" key={map.map_no}>
                            <span className="ui-map-row__label">
                              Mapa {map.map_no}
                            </span>

                            <div className="ui-row ui-row--wrap">
                              <span className="ui-badge">
                                typ {map.pred_a}:{map.pred_b}
                              </span>

                              <span className="ui-badge">
                                wynik {map.res_a}:{map.res_b}
                              </span>

                              <span
                                className={`ui-badge ${
                                  map.exact
                                    ? "ui-badge--accent"
                                    : map.correct_winner
                                      ? "ui-badge--ok"
                                      : "ui-badge--danger"
                                }`}
                              >
                                {map.exact
                                  ? "🎯 Exact"
                                  : map.correct_winner
                                    ? "✅ Zwycięzca"
                                    : "❌ Pudło"}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ui-empty">
            <span className="ui-empty__icon" aria-hidden="true">
              🗒️
            </span>

            <strong className="ui-empty__title">Brak typów</strong>

            <p className="ui-empty__text">
              Ten gracz nie zapisał jeszcze żadnego typu w tym evencie.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default PlayerProfilePage;
