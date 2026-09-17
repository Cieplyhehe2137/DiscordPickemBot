import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import { getEventPlayerProfile } from "../lib/api.js";
import BackLink from "../components/BackLink.jsx";
import TeamPicks from "../components/TeamPicks.jsx";
import PointsChart from "../components/PointsChart.jsx";
import BadgeShelf from "../components/BadgeShelf.jsx";
import PlayerHistory from "../components/PlayerHistory.jsx";
import PlayerPicker from "../components/PlayerPicker.jsx";
import { useT } from "../i18n/useLanguage.js";

function PlayerProfilePage() {
  const t = useT();

  const { slug, userId } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const navigate = useNavigate();

  // Okno wyboru przeciwnika do porownania.
  const [wybierakOtwarty, setWybierakOtwarty] = useState(false);
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
        setError(err.message || t("profile.errorText"));
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [slug, userId, t]);

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
          className="ui-stats ui-stats--4"
          aria-busy="true"
          aria-label={t("profile.loading")}
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
        <BackLink to={`/events/${slug}/leaderboard`}>
          {t("profile.backToLeaderboard")}
        </BackLink>

        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">{t("profile.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  if (!profile?.profile) {
    return (
      <main className="ui-page">
        <BackLink to={`/events/${slug}/leaderboard`}>
          {t("profile.backToLeaderboard")}
        </BackLink>

        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🔎
          </span>

          <strong className="ui-empty__title">
            {t("profile.missing.title")}
          </strong>

          <p className="ui-empty__text">{t("profile.missing.text")}</p>
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
      <div className="ui-row ui-row--between ui-row--wrap ui-row--full">
        <BackLink to={`/events/${slug}/leaderboard`}>
          {t("profile.backToLeaderboard")}
        </BackLink>

        <button
          type="button"
          className="ui-btn ui-btn--accent ui-btn--sm"
          onClick={() => setWybierakOtwarty(true)}
        >
          ⚔️ {t("profile.compare")}
        </button>
      </div>

      {/* Montowane dopiero przy otwarciu - dzięki temu wpisana fraza
          i wyniki szukania giną same przy zamknięciu. */}
      {wybierakOtwarty && (
        <PlayerPicker
          slug={slug}
          excludeUserId={userId}
          onClose={() => setWybierakOtwarty(false)}
          onPick={(gracz) => {
            setWybierakOtwarty(false);
            navigate(`/events/${slug}/h2h/${userId}/${gracz.user_id}`);
          }}
        />
      )}

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
            <span className="ui-kicker">{t("profile.kicker")}</span>

            <h2>{player.displayname}</h2>
          </div>
        </div>

        <div className="ui-stats ui-stats--4">
          <div className="ui-stat ui-stat--featured">
            <span>{t("profile.points")}</span>
            <strong>{player.total_points}</strong>
            <small>{t("profile.pointsPerMatch", { value: averagePoints })}</small>
          </div>

          <div className="ui-stat">
            <span>{t("profile.rank")}</span>
            <strong>{player.rank > 0 ? `#${player.rank}` : "—"}</strong>
          </div>

          <div className="ui-stat">
            <span>{t("profile.accuracy")}</span>
            <strong>{player.accuracy}%</strong>
            <small>
              {t("profile.accuracyHint", {
                correct: player.correct_winners,
                count: player.finished_predictions,
              })}
            </small>
          </div>

          <div className="ui-stat">
            <span>{t("profile.exactMaps")}</span>
            <strong>{player.exact_maps}</strong>
            <small>
              {t("profile.exactMapsHint", { percent: exactMapPercentage })}
            </small>
          </div>

          <div className="ui-stat">
            <span>{t("profile.correctMaps")}</span>
            <strong>{player.correct_maps}</strong>
            <small>{t("profile.correctMapsHint", { percent: mapAccuracy })}</small>
          </div>

          <div className="ui-stat">
            <span>{t("profile.bestMatch")}</span>
            <strong>{player.best_match_points ?? 0}</strong>
            <small>{t("profile.bestMatchHint")}</small>
          </div>

          <div className="ui-stat">
            <span>{t("profile.seriesPoints")}</span>
            <strong>{player.series_points ?? 0}</strong>
          </div>

          <div className="ui-stat">
            <span>{t("profile.mapPoints")}</span>
            <strong>{player.map_points ?? 0}</strong>
          </div>
        </div>
      </section>

      {/* Starty w innych turniejach zaraz pod nazwiskiem, bo mówią,
          KTO to jest, a nie jak mu poszło tutaj. Dla 85% graczy sekcja
          nie pojawia się wcale - tylu zagrało w jednym turnieju. */}
      <PlayerHistory events={profile?.other_events} userId={userId} />

      {/* Odznaki zaraz za statystykami, bo są ich podsumowaniem -
          nazwą nadaną liczbom, które stoją wyżej. */}
      <BadgeShelf profile={player} />

      {/* Wykres stoi PRZED seriami, bo mówi to samo, tylko obrazkiem:
          gdzie szło dobrze, a gdzie się posypało. Serie pod spodem
          podają tę samą rzecz liczbą. */}
      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("profile.progress.kicker")}</span>

            <h2>{t("profile.progress.title")}</h2>
          </div>
        </div>

        <PointsChart
          series={[
            {
              side: "a",
              name: player.displayname,
              points: player.points_progress ?? [],
            },
          ]}
          caption={t("profile.progress.caption")}
        />
      </section>

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("profile.form.kicker")}</span>

            <h2>{t("profile.form.title")}</h2>
          </div>
        </div>

        <div className="ui-stats ui-stats--4">
          <div className="ui-stat">
            <span>🔥 {t("profile.bestStreak")}</span>
            <strong>{player.best_correct_streak ?? 0}</strong>
            <small>{t("profile.streakHint")}</small>
          </div>

          <div className="ui-stat">
            <span>⚡ {t("profile.currentStreak")}</span>
            <strong>{player.current_correct_streak ?? 0}</strong>
            <small>{t("profile.streakHint")}</small>
          </div>

          <div className="ui-stat">
            <span>💎 {t("profile.perfect")}</span>
            <strong>{player.perfect_matches ?? 0}</strong>
            <small>{t("profile.perfectHint")}</small>
          </div>
        </div>
      </section>

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("profile.records.kicker")}</span>

            <h2>{t("profile.records.title")}</h2>
          </div>
        </div>

        <div className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight">
          <div className="ui-row ui-row--between ui-row--full">
            <div>
              <strong>🗺️ {t("profile.bestMapScore")}</strong>

              <p className="ui-stat__hint">{t("profile.bestMapScoreHint")}</p>
            </div>

            <span className="ui-count">
              {t("common.pointsValue", {
                value: player.best_map_match_points ?? 0,
              })}
            </span>
          </div>

          <div className="ui-row ui-row--between ui-row--full">
            <div>
              <strong>📈 {t("profile.avgCorrect")}</strong>

              <p className="ui-stat__hint">{t("profile.avgCorrectHint")}</p>
            </div>

            <span className="ui-count">
              {t("common.pointsValue", {
                value: Number(
                  player.average_points_correct_match ?? 0,
                ).toFixed(1),
              })}
            </span>
          </div>
        </div>
      </section>

      {player.event_comparison && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">
                {t("profile.comparison.kicker")}
              </span>

              <h2>{t("profile.comparison.title")}</h2>
            </div>
          </div>

          <div className="ui-stats ui-stats--4">
            {[
              {
                label: `🏆 ${t("profile.points")}`,
                data: player.event_comparison.points,
              },
              {
                label: `🎯 ${t("profile.accuracy")}`,
                data: player.event_comparison.accuracy,
              },
              {
                label: `💎 ${t("profile.exactMaps")}`,
                data: player.event_comparison.exact_maps,
              },
              {
                label: `🗺️ ${t("profile.correctMaps")}`,
                data: player.event_comparison.correct_maps,
              },
            ].map((item) => (
              <div className="ui-stat" key={item.label}>
                <span>{item.label}</span>

                <strong>#{item.data?.rank ?? 0}</strong>

                <small>
                  {t("profile.comparison.hint", {
                    total: item.data?.total ?? 0,
                    percent: item.data?.top_percent ?? 0,
                  })}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Typy drużyn stoją PRZED historią meczów: dotyczą całego turnieju,
          a nie pojedynczych spotkań, więc czyta się je jako podsumowanie,
          zanim zejdzie się do listy meczów. */}
      <TeamPicks phases={profile?.team_picks} logos={profile?.team_logos} />

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("profile.history.kicker")}</span>

            <h2>{t("profile.history.title")}</h2>
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
                        {t("profile.pick", {
                          a: prediction.pred_a,
                          b: prediction.pred_b,
                        })}
                        {finished &&
                          t("profile.result", {
                            a: prediction.res_a,
                            b: prediction.res_b,
                          })}
                      </span>
                    </span>

                    <span
                      className={`ui-disclosure__points ${
                        prediction.points > 0
                          ? "ui-disclosure__points--scored"
                          : ""
                      }`}
                    >
                      {t("common.pointsValue", {
                        value:
                          prediction.points > 0
                            ? `+${prediction.points}`
                            : prediction.points,
                      })}
                    </span>

                    <span className="ui-disclosure__chevron" aria-hidden="true">
                      ▾
                    </span>
                  </button>

                  {expanded && (
                    <div className="ui-stack ui-stack--tight">
                      <p className="ui-stat__hint">
                        {t("profile.split", {
                          series: player.series_points,
                          maps: player.map_points,
                        })}
                      </p>

                      {prediction.maps?.length > 0 &&
                        prediction.maps.map((map) => (
                          <div className="ui-map-row" key={map.map_no}>
                            <span className="ui-map-row__label">
                              {t("common.mapNo", { no: map.map_no })}
                            </span>

                            <div className="ui-row ui-row--wrap">
                              <span className="ui-badge">
                                {t("common.mapPick", {
                                  a: map.pred_a,
                                  b: map.pred_b,
                                })}
                              </span>

                              <span className="ui-badge">
                                {t("common.mapResult", {
                                  a: map.res_a,
                                  b: map.res_b,
                                })}
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
                                  ? `🎯 ${t("profile.map.exact")}`
                                  : map.correct_winner
                                    ? `✅ ${t("profile.map.winner")}`
                                    : `❌ ${t("profile.map.miss")}`}
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

            <strong className="ui-empty__title">
              {t("profile.empty.title")}
            </strong>

            <p className="ui-empty__text">{t("profile.empty.text")}</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default PlayerProfilePage;
