import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getMyStats } from "../lib/api.js";
import socket from "../lib/socket.js";
import BackLink from "../components/BackLink.jsx";
import LoginRequired from "../components/LoginRequired.jsx";
import { useT } from "../i18n/useLanguage.js";

// Ikona zostaje w kodzie, nazwa idzie ze słownika - emoji znaczy to samo
// w każdym języku, a pięć kopii tego samego znaczka w pięciu plikach
// tylko zapraszałoby do rozjechania się.
const TABS = [
  { key: "general", icon: "📊", labelKey: "myStats.tab.general" },
  { key: "accuracy", icon: "🎯", labelKey: "myStats.tab.accuracy" },
  { key: "form", icon: "🔥", labelKey: "myStats.tab.form" },
  { key: "comparison", icon: "👥", labelKey: "myStats.tab.comparison" },
  { key: "analysis", icon: "🧠", labelKey: "myStats.tab.analysis" },
  { key: "style", icon: "🎭", labelKey: "myStats.tab.style" },
  { key: "trends", icon: "📈", labelKey: "myStats.tab.trends" },
];

function pct(value, total) {
  if (!total) return "—";

  return `${((Number(value) / Number(total)) * 100)
    .toFixed(1)
    .replace(".0", "")}%`;
}

function MyStatsPage() {
  const t = useT();

  const { slug } = useParams();

  const [activeTab, setActiveTab] = useState("general");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStats({ silent = false } = {}) {
      try {
        if (!silent) {
          setLoading(true);
        }

        setError(null);

        const response = await getMyStats(slug);

        if (!cancelled) {
          setData(response);
        }
      } catch (err) {
        console.error("MY STATS LOAD ERROR:", err);

        if (!cancelled) {
          setError({
            message: err.message || t("myStats.errorText"),
            status: err.status,
          });
        }
      } finally {
        if (!cancelled && !silent) {
          setLoading(false);
        }
      }
    }

    loadStats();

    function handleStatsUpdate(payload) {
      if (payload?.event_slug && payload.event_slug !== slug) {
        return;
      }

      loadStats({ silent: true });
    }

    socket.on("dashboard:refresh", handleStatsUpdate);

    return () => {
      cancelled = true;
      socket.off("dashboard:refresh", handleStatsUpdate);
    };
  }, [slug, t]);

  if (loading) {
    return (
      <main className="ui-page">
        <div
          className="ui-stats"
          aria-busy="true"
          aria-label={t("myStats.loading")}
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
        <BackLink to={`/events/${slug}`} />

        {error.status === 401 ? (
          <LoginRequired>{t("myStats.loginText")}</LoginRequired>
        ) : (
          <div className="ui-error" role="alert">
            <span className="ui-error__icon" aria-hidden="true">
              ⚠️
            </span>

            <strong className="ui-error__title">{t("myStats.error")}</strong>

            <p className="ui-error__text">{error.message}</p>
          </div>
        )}
      </main>
    );
  }

  if (!data?.has_data) {
    return (
      <main className="ui-page">
        <BackLink to={`/events/${slug}`} />

        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("myStats.kicker")}</span>

            <h2>
              {data?.event?.name
                ? t("myStats.titleEvent", { event: data.event.name })
                : t("myStats.title")}
            </h2>
          </div>
        </div>

        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            📊
          </span>

          <strong className="ui-empty__title">
            {t("myStats.empty.title")}
          </strong>

          <p className="ui-empty__text">{t("myStats.empty.text")}</p>
        </div>
      </main>
    );
  }

  const general = data.general;
  const accuracy = data.accuracy;
  const form = data.form;
  const comparison = data.comparison;
  const analysis = data.analysis;
  const style = data.style;
  const trends = data.trends;

  return (
    <main className="ui-page">
      <BackLink to={`/events/${slug}`} />
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("myStats.kicker")}</span>

          <h2>{t("myStats.titleEvent", { event: data.event.name })}</h2>

          <p>{t("myStats.intro")}</p>
        </div>
      </div>

      <div className="ui-choice" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            className="ui-choice__option"
            aria-selected={activeTab === tab.key}
            aria-pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon} {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <section className="ui-stats">
          <article className="ui-stat">
            <span>🏅 {t("myStats.rank")}</span>
            <strong>
              {general.rank
                ? `#${general.rank} / ${general.participant_count}`
                : `— / ${general.participant_count}`}
            </strong>

            <small>
              {general.rank
                ? t("history.top", { percent: general.top_percent })
                : t("myStats.noPointsYet")}
            </small>
          </article>

          <article className="ui-stat">
            <span>⭐ {t("myStats.points")}</span>
            <strong>
              {t("common.pointsValue", { value: general.total_points })}
            </strong>
            <small>
              {t("profile.pointsPerMatch", { value: general.average_points })}
            </small>
          </article>

          <article className="ui-stat">
            <span>🎭 {t("myStats.profile")}</span>
            <strong>
              {general.style?.emoji} {general.style?.name}
            </strong>
            <small>
              {general.trends?.direction?.name ?? t("myStats.steadyForm")}
            </small>
          </article>

          <article className="ui-stat">
            <span>🎮 {t("myStats.picks")}</span>
            <strong>{general.total_predictions}</strong>
            <small>
              {t("myStats.settled", { count: general.settled_matches })}
            </small>
          </article>

          <article className="ui-stat">
            <span>🏆 {t("myStats.winners")}</span>
            <strong>
              {general.winner_hits}/{general.settled_matches}
            </strong>
            <small>{pct(general.winner_hits, general.settled_matches)}</small>
          </article>

          <article className="ui-stat">
            <span>🎯 {t("myStats.seriesExact")}</span>
            <strong>
              {general.series_exacts}/{general.settled_matches}
            </strong>
            <small>{pct(general.series_exacts, general.settled_matches)}</small>
          </article>

          <article className="ui-stat ui-stat--wide">
            <span>🗺️ {t("myStats.maps")}</span>
            <strong>
              {t("myStats.mapWinner", {
                hits: general.map_winner_hits,
                total: general.settled_maps,
              })}
            </strong>
            <small>
              {t("myStats.mapExact", {
                hits: general.exact_maps,
                total: general.settled_maps,
              })}
            </small>
          </article>

          <article className="ui-stat ui-stat--wide">
            <span>📦 {t("myStats.points")}</span>
            <strong>
              {t("myStats.pointsSplit", { value: general.series_points })}
            </strong>
            <small>
              {t("myStats.pointsSplitMaps", { value: general.map_points })}
            </small>
          </article>
        </section>
      )}

      {activeTab === "accuracy" && (
        <section className="ui-stats">
          <article className="ui-stat">
            <span>🏆 {t("myStats.matchWinner")}</span>
            <strong>
              {accuracy.winner_hits}/{accuracy.settled_matches}
            </strong>
            <small>{pct(accuracy.winner_hits, accuracy.settled_matches)}</small>
          </article>

          <article className="ui-stat">
            <span>🎯 {t("myStats.seriesExact")}</span>
            <strong>
              {accuracy.series_exacts}/{accuracy.settled_matches}
            </strong>
            <small>
              {pct(accuracy.series_exacts, accuracy.settled_matches)}
            </small>
          </article>

          <article className="ui-stat">
            <span>🗺️ {t("myStats.mapWinnerLabel")}</span>
            <strong>
              {accuracy.map_winner_hits}/{accuracy.settled_maps}
            </strong>
            <small>
              {pct(accuracy.map_winner_hits, accuracy.settled_maps)}
            </small>
          </article>

          <article className="ui-stat">
            <span>💯 {t("myStats.mapExactLabel")}</span>
            <strong>
              {accuracy.exact_maps}/{accuracy.settled_maps}
            </strong>
            <small>{pct(accuracy.exact_maps, accuracy.settled_maps)}</small>
          </article>

          {[1, 3, 5].map((bo) => {
            const stats = accuracy[`bo${bo}`];

            return (
              <article className="ui-stat" key={bo}>
                <span>BO{bo}</span>

                <strong>
                  {stats.winnerHits}/{stats.total}
                </strong>

                <small>
                  {t("myStats.mapExact", {
                    hits: stats.exactHits,
                    total: stats.total,
                  })}
                </small>
              </article>
            );
          })}
        </section>
      )}

      {activeTab === "form" && (
        <section className="ui-stats">
          <article className="ui-stat ui-stat--wide">
            <span>📈 {t("myStats.recent")}</span>
            <strong>
              {form.recent?.length
                ? form.recent.join(" ")
                : t("myStats.noData")}
            </strong>
          </article>

          <article className="ui-stat">
            <span>⚡ {t("myStats.last5")}</span>
            <strong>
              {form.last5.hits}/{form.last5.total}
            </strong>
            <small>{form.last5.percentage}</small>
          </article>

          <article className="ui-stat">
            <span>📊 {t("myStats.last10")}</span>
            <strong>
              {form.last10.hits}/{form.last10.total}
            </strong>
            <small>{form.last10.percentage}</small>
          </article>

          <article className="ui-stat">
            <span>🔥 {t("myStats.currentStreak")}</span>
            <strong>{form.current_streak}</strong>
          </article>

          <article className="ui-stat">
            <span>🏅 {t("myStats.bestStreak")}</span>
            <strong>{form.best_streak}</strong>
          </article>

          <article className="ui-stat ui-stat--wide">
            <span>💎 {t("myStats.bestMatch")}</span>

            {form.best_match ? (
              <>
                <strong>
                  {form.best_match.match_no
                    ? `#${form.best_match.match_no} · `
                    : ""}
                  {form.best_match.team_a}
                  {" vs "}
                  {form.best_match.team_b}
                </strong>

                <small>
                  {t("common.pointsValue", { value: form.best_match.points })}
                </small>
              </>
            ) : (
              <strong>—</strong>
            )}
          </article>
        </section>
      )}

      {activeTab === "comparison" && (
        <section className="ui-stats">
          <article className="ui-stat">
            <span>🏅 {t("myStats.rank")}</span>
            <strong>
              {comparison.rank
                ? `#${comparison.rank} / ${comparison.participant_count}`
                : `— / ${comparison.participant_count}`}
            </strong>

            <small>
              {comparison.rank
                ? t("history.top", { percent: comparison.top_percent })
                : t("myStats.noPointsYet")}
            </small>
          </article>

          <article className="ui-stat">
            <span>⭐ {t("myStats.points")}</span>
            <strong>{comparison.user.total_points}</strong>
            <small>
              {t("myStats.average", {
                value: comparison.community.average_total_points,
              })}
            </small>
          </article>

          <article className="ui-stat">
            <span>📈 {t("myStats.pointsPerMatch")}</span>
            <strong>{comparison.user.average_points}</strong>
            <small>
              {t("myStats.average", {
                value: comparison.community.average_points,
              })}
            </small>
          </article>

          <article className="ui-stat">
            <span>🏆 {t("myStats.winners")}</span>
            <strong>{comparison.user.winner_accuracy.toFixed(1)}%</strong>
            <small>
              {t("myStats.eventAverage", {
                value: comparison.community.winner_accuracy.toFixed(1),
              })}
            </small>
          </article>

          <article className="ui-stat">
            <span>🎯 {t("myStats.seriesExact")}</span>
            <strong>{comparison.user.exact_accuracy.toFixed(1)}%</strong>
            <small>
              {t("myStats.eventAverage", {
                value: comparison.community.exact_accuracy.toFixed(1),
              })}
            </small>
          </article>
        </section>
      )}

      {activeTab === "analysis" && (
        <section className="ui-stats">
          <article className="ui-stat">
            <span>🟢 {t("myStats.bestTeam")}</span>
            <strong>{analysis.team_stats.best?.name ?? "—"}</strong>
          </article>

          <article className="ui-stat">
            <span>😈 {t("myStats.nemesis")}</span>
            <strong>{analysis.team_stats.nemesis?.name ?? "—"}</strong>
          </article>

          <article className="ui-stat">
            <span>❤️ {t("myStats.mostPicked")}</span>
            <strong>{analysis.team_stats.mostPicked?.name ?? "—"}</strong>
          </article>

          <article className="ui-stat">
            <span>🔥 {t("myStats.mostOneSided")}</span>
            <strong>
              {analysis.community.mostOneSided?.majorityTeam ?? "—"}
            </strong>
          </article>

          <article className="ui-stat">
            <span>⚔️ {t("myStats.mostDivided")}</span>
            <strong>
              {analysis.community.mostDivided?.teamA ?? "—"}
              {analysis.community.mostDivided ? " vs " : ""}
              {analysis.community.mostDivided?.teamB ?? ""}
            </strong>
          </article>

          <article className="ui-stat">
            <span>🎯 {t("myStats.popularScore")}</span>
            <strong>{analysis.community.mostPopularScore?.score ?? "—"}</strong>
          </article>

          <article className="ui-stat ui-stat--wide">
            <span>🗺️ {t("myStats.mapAccuracy")}</span>
            <strong>
              {t("myStats.mapExact", {
                hits: analysis.map_accuracy.exact,
                total: analysis.map_accuracy.total,
              })}
            </strong>
            <small>
              {t("myStats.averageError", {
                value: Number(
                  analysis.map_accuracy.averageError ?? 0,
                ).toFixed(2),
              })}
            </small>
          </article>
        </section>
      )}

      {activeTab === "style" && (
        <section className="ui-stats">
          <article className="ui-stat ui-stat--wide">
            <span>🎭 {t("myStats.yourProfile")}</span>
            <strong>
              {style.profile.emoji} {style.profile.name}
            </strong>
            <small>{style.profile.description}</small>
          </article>

          <article className="ui-stat">
            <span>💎 {t("myStats.contrarian")}</span>
            <strong>{style.contrarian.contrarianPicks}</strong>
            <small>
              {t("myStats.hits", { count: style.contrarian.contrarianHits })}
            </small>
          </article>

          <article className="ui-stat">
            <span>👥 {t("myStats.withMajority")}</span>
            <strong>{style.contrarian.majorityPicks}</strong>
            <small>
              {t("myStats.hits", { count: style.contrarian.majorityHits })}
            </small>
          </article>

          <article className="ui-stat ui-stat--wide">
            <span>💠 {t("myStats.rarestHit")}</span>
            <strong>
              {style.contrarian.rarestHit
                ? `${style.contrarian.rarestHit.team} vs ${style.contrarian.rarestHit.opponent}`
                : "—"}
            </strong>
          </article>
        </section>
      )}

      {activeTab === "trends" && (
        <section className="ui-stats">
          {!trends.enoughData ? (
            <article className="ui-stat ui-stat--wide">
              <span>📈 {t("myStats.trends")}</span>
              <strong>{t("myStats.notEnough")}</strong>
              <small>
                {t("myStats.settledOf", { count: trends.totalMatches })}
              </small>
            </article>
          ) : (
            <>
              <article className="ui-stat ui-stat--wide">
                <span>
                  {trends.direction.emoji} {t("myStats.direction")}
                </span>
                <strong>{trends.direction.name}</strong>
                <small>{trends.direction.description}</small>
              </article>

              <article className="ui-stat">
                <span>🏆 {t("myStats.winners")}</span>
                <strong>
                  {trends.first.winnerAccuracy.toFixed(1)}% →{" "}
                  {trends.second.winnerAccuracy.toFixed(1)}%
                </strong>
              </article>

              <article className="ui-stat">
                <span>🎯 {t("myStats.seriesExact")}</span>
                <strong>
                  {trends.first.seriesExactAccuracy.toFixed(1)}% →{" "}
                  {trends.second.seriesExactAccuracy.toFixed(1)}%
                </strong>
              </article>

              <article className="ui-stat">
                <span>⭐ {t("myStats.pointsPerMatch")}</span>
                <strong>
                  {trends.first.averagePoints.toFixed(2)}
                  {" → "}
                  {trends.second.averagePoints.toFixed(2)}
                </strong>
              </article>

              <article className="ui-stat">
                <span>🗺️ {t("myStats.mapExactLabel")}</span>
                <strong>
                  {trends.first.mapExactAccuracy.toFixed(1)}% →{" "}
                  {trends.second.mapExactAccuracy.toFixed(1)}%
                </strong>
              </article>
            </>
          )}
        </section>
      )}
    </main>
  );
}

export default MyStatsPage;
