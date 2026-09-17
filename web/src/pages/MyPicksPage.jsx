import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { getMyEventPredictions } from "../lib/api.js";
import BackLink from "../components/BackLink.jsx";
import { getMapLabel } from "../lib/mapLabels.js";
import LoginRequired from "../components/LoginRequired.jsx";
import ScoreLine from "../components/ScoreLine.jsx";
import { useT } from "../i18n/useLanguage.js";

// Nazwy faz zostają po angielsku we wszystkich językach - tak nazywają je
// organizatorzy turniejów i tak stoją na drabince.
const PHASES = [
  { key: "SWISS", label: "Swiss" },
  { key: "PLAY_IN", label: "Play-In" },
  { key: "DOUBLE_ELIM", label: "Double Elim" },
  { key: "PLAYOFFS", label: "Playoffs" },
];

function MyPicksPage() {
  const t = useT();

  const { slug } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const [phase, setPhase] = useState("SWISS");
  const [page, setPage] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPredictions() {
      try {
        setLoading(true);
        setError(null);

        const response = await getMyEventPredictions(slug, phase, page);

        setData(response);
      } catch (err) {
        console.error("MY PICKS LOAD ERROR:", err);

        setError({
          message: err.message || t("myPicks.errorText"),
          status: err.status,
        });
      } finally {
        setLoading(false);
      }
    }

    loadPredictions();
  }, [slug, phase, page, t]);

  useEffect(() => {
    if (!realtimeRefresh?.version) {
      return;
    }

    const payload = realtimeRefresh.payload;

    if (payload?.slug && String(payload.slug) !== String(slug)) {
      return;
    }

    async function refreshPredictions() {
      try {
        const response = await getMyEventPredictions(slug, phase, page);

        setData(response);
        setError(null);
      } catch (err) {
        console.error("MY PICKS REALTIME REFRESH ERROR:", err);
      }
    }

    refreshPredictions();
  }, [realtimeRefresh, slug, phase, page]);

  function changePhase(nextPhase) {
    setPhase(nextPhase);
    setPage(0);
  }

  return (
    <main className="ui-page">
      <BackLink to={`/events/${slug}`} />

      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("myPicks.kicker")}</span>

          <h2>
            {data?.event?.name
              ? t("myPicks.titleEvent", { event: data.event.name })
              : t("myPicks.title")}
          </h2>

          <p>{t("myPicks.intro")}</p>
        </div>
      </div>

      <div className="ui-choice">
        {PHASES.map((item) => (
          <button
            key={item.key}
            type="button"
            className="ui-choice__option"
            aria-pressed={phase === item.key}
            onClick={() => changePhase(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && (
        <div
          className="ui-stack"
          aria-busy="true"
          aria-label={t("myPicks.loading")}
        >
          {Array.from({ length: 3 }, (_, i) => (
            <div className="ui-skeleton ui-skeleton--row" key={i} />
          ))}
        </div>
      )}

      {error &&
        (error.status === 401 ? (
          <LoginRequired>{t("myPicks.loginText")}</LoginRequired>
        ) : (
          <div className="ui-error" role="alert">
            <span className="ui-error__icon" aria-hidden="true">
              ⚠️
            </span>

            <strong className="ui-error__title">{t("myPicks.error")}</strong>

            <p className="ui-error__text">{error.message}</p>
          </div>
        ))}

      {!loading && !error && data && data.matches.length === 0 && (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🗓️
          </span>

          <strong className="ui-empty__title">
            {t("myPicks.empty.title")}
          </strong>

          <p className="ui-empty__text">{t("myPicks.empty.text")}</p>
        </div>
      )}

      {!loading && !error && data?.matches?.length > 0 && (
        <>
          {data.matches.map((match) => {
            const hasPrediction = Boolean(match.prediction);

            return (
              <article className="ui-card ui-stack" key={match.id}>
                <div className="ui-row ui-row--between ui-row--wrap ui-row--full">
                  <span className="ui-kicker">
                    {match.match_no ? `#${match.match_no} · ` : ""}
                    BO{match.best_of}
                  </span>

                  {match.result ? (
                    <span className="ui-badge">{t("myPicks.finished")}</span>
                  ) : (
                    <span className="ui-badge ui-badge--live">
                      {t("myPicks.pending")}
                    </span>
                  )}
                </div>

                <div className="ui-match">
                  <div className="ui-match__team">
                    <strong className="ui-match__name">{match.team_a}</strong>
                  </div>

                  <span className="ui-match__vs">VS</span>

                  <div className="ui-match__team ui-match__team--b">
                    <strong className="ui-match__name">{match.team_b}</strong>
                  </div>
                </div>

                {!hasPrediction ? (
                  <p className="ui-note">{t("myPicks.noPick")}</p>
                ) : (
                  <div className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight">
                    <span className="ui-stat__hint">{t("myPicks.yourPick")}</span>

                    <ScoreLine
                      teamA={match.team_a}
                      teamB={match.team_b}
                      scoreA={match.prediction.pred_a}
                      scoreB={match.prediction.pred_b}
                    />

                    {Number(match.best_of) === 1 &&
                      match.prediction.pred_exact_a !== null &&
                      match.prediction.pred_exact_b !== null && (
                        <>
                          <span className="ui-stat__hint">
                            {t("myPicks.exactScore")}
                          </span>

                          <ScoreLine
                            teamA={match.team_a}
                            teamB={match.team_b}
                            scoreA={match.prediction.pred_exact_a}
                            scoreB={match.prediction.pred_exact_b}
                          />
                        </>
                      )}

                    {Number(match.best_of) > 1 &&
                      (match.maps.length === 0 ? (
                        <p className="ui-note">{t("myPicks.noMapPicks")}</p>
                      ) : (
                        match.maps.map((map) => (
                          <div className="ui-map-row" key={map.map_no}>
                            <span className="ui-map-row__label">
                              {getMapLabel(
                                map.map_no,
                                match.best_of,
                                match.team_a,
                                match.team_b,
                              )}
                            </span>

                            <div className="ui-row ui-row--wrap">
                              <span className="ui-badge">
                                {t("myPicks.mapPick", {
                                  a: map.pred_exact_a,
                                  b: map.pred_exact_b,
                                })}
                              </span>

                              {map.res_exact_a !== null &&
                              map.res_exact_b !== null ? (
                                <span className="ui-badge ui-badge--accent">
                                  {t("myPicks.mapResult", {
                                    a: map.res_exact_a,
                                    b: map.res_exact_b,
                                  })}
                                </span>
                              ) : (
                                <span className="ui-badge">
                                  {t("myPicks.mapNoResult")}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ))}
                  </div>
                )}

                {match.result ? (
                  <div className="ui-stats">
                    <div className="ui-stat ui-stat--featured">
                      <span>{t("myPicks.total")}</span>

                      <strong>⭐ {match.points.total}</strong>

                      <small>{t("myPicks.totalHint")}</small>
                    </div>

                    <div className="ui-stat">
                      <span>{t("myPicks.series")}</span>

                      <strong>{match.points.series}</strong>
                    </div>

                    <div className="ui-stat">
                      <span>{t("myPicks.maps")}</span>

                      <strong>{match.points.maps}</strong>
                    </div>
                  </div>
                ) : (
                  <p className="ui-note">⏳ {t("myPicks.later")}</p>
                )}

                <Link
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  to={`/events/${slug}/matches/${match.id}`}
                >
                  {match.result
                    ? t("matches.cta.match")
                    : hasPrediction
                      ? t("matches.cta.edit")
                      : t("myPicks.cta.predict")}
                </Link>
              </article>
            );
          })}

          <div className="ui-row ui-row--between ui-row--full">
            <button
              type="button"
              className="ui-btn ui-btn--sm"
              disabled={data.pagination.page <= 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              {t("leaderboard.prev")}
            </button>

            <span className="ui-stat__hint">
              {t("myPicks.pageOf", {
                page: data.pagination.page + 1,
                total: data.pagination.total_pages,
              })}
            </span>

            <button
              type="button"
              className="ui-btn ui-btn--sm"
              disabled={data.pagination.page >= data.pagination.total_pages - 1}
              onClick={() => setPage((value) => value + 1)}
            >
              {t("leaderboard.next")}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default MyPicksPage;
