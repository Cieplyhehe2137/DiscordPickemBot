import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { getMyEventPredictions } from "../lib/api.js";
import BackLink from "../components/BackLink.jsx";
import { getMapLabel } from "../lib/mapLabels.js";
import Ladowanie from "../components/Ladowanie.jsx";

const PHASES = [
  {
    key: "SWISS",
    label: "Swiss",
  },
  {
    key: "PLAY_IN",
    label: "Play-In",
  },
  {
    key: "DOUBLE_ELIM",
    label: "Double Elim",
  },
  {
    key: "PLAYOFFS",
    label: "Playoffs",
  },
];

function MyPicksPage() {
  const { slug } = useParams();
  const { realtimeRefresh } = useOutletContext();
  const [phase, setPhase] = useState("SWISS");
  const [page, setPage] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPredictions() {
      try {
        setLoading(true);
        setError("");

        const response = await getMyEventPredictions(slug, phase, page);

        setData(response);
      } catch (err) {
        console.error("MY PICKS LOAD ERROR:", err);

        setError(err.message || "Nie udało się pobrać typów.");
      } finally {
        setLoading(false);
      }
    }

    loadPredictions();
  }, [slug, phase, page]);

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
        setError("");
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
    <main className="my-picks-page">
      <BackLink to={`/events/${slug}`} />
      <div className="my-picks-page__header">
        <span className="events-kicker">Twoje dane</span>

        <h1>
          Moje typy
          {data?.event?.name ? ` — ${data.event.name}` : ""}
        </h1>

        <p>
          Sprawdź zapisane typy meczów, dokładne wyniki map i zdobyte punkty.
        </p>
      </div>

      <div className="my-picks-phases">
        {PHASES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={
              phase === item.key
                ? "my-picks-phase-button my-picks-phase-button--active"
                : "my-picks-phase-button"
            }
            onClick={() => changePhase(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && <Ladowanie>Ładowanie typów...</Ladowanie>}

      {error && <p className="admin-feedback admin-feedback--error">{error}</p>}

      {!loading && !error && data && data.matches.length === 0 && (
        <div className="my-picks-empty">
          <h2>Brak meczów w tej fazie</h2>

          <p>Dla wybranej fazy nie ma jeszcze żadnych spotkań.</p>
        </div>
      )}

      {!loading && !error && data?.matches?.length > 0 && (
        <>
          <div className="my-picks-list">
            {data.matches.map((match) => {
              const hasPrediction = Boolean(match.prediction);

              return (
                <article className="my-pick-card" key={match.id}>
                  <div className="my-pick-card__header">
                    <span>
                      {match.match_no ? `#${match.match_no} · ` : ""}
                      BO{match.best_of}
                    </span>

                    {match.result ? (
                      <span className="my-pick-card__locked">Zakończony</span>
                    ) : (
                      <span>Oczekuje</span>
                    )}
                  </div>

                  <h2 className="my-pick-card__match">
                    {match.team_a}
                    {" vs "}
                    {match.team_b}
                  </h2>

                  {!hasPrediction ? (
                    <div className="my-pick-card__missing">
                      Brak zapisanego typu.
                    </div>
                  ) : (
                    <>
                      <div className="my-pick-card__series">
                        <span>Twój typ</span>

                        <strong>
                          {match.team_a} {match.prediction.pred_a}:
                          {match.prediction.pred_b} {match.team_b}
                        </strong>
                      </div>

                      {Number(match.best_of) === 1 &&
                        match.prediction.pred_exact_a !== null &&
                        match.prediction.pred_exact_b !== null && (
                          <div className="my-pick-card__series">
                            <span>Dokładny wynik</span>

                            <strong>
                              {match.team_a} {match.prediction.pred_exact_a}:
                              {match.prediction.pred_exact_b} {match.team_b}
                            </strong>
                          </div>
                        )}

                      {Number(match.best_of) > 1 && (
                        <div className="my-pick-card__maps">
                          {match.maps.length === 0 ? (
                            <div className="my-pick-card__missing">
                              Brak zapisanych typów map.
                            </div>
                          ) : (
                            match.maps.map((map) => (
                              <div
                                className="my-pick-card__map"
                                key={map.map_no}
                              >
                                <span>
                                  {getMapLabel(
                                    map.map_no,
                                    match.best_of,
                                    match.team_a,
                                    match.team_b,
                                  )}
                                </span>

                                <strong>
                                  {map.pred_exact_a}:{map.pred_exact_b}
                                </strong>

                                {map.res_exact_a !== null &&
                                map.res_exact_b !== null ? (
                                  <small>
                                    Wynik: {map.res_exact_a}:{map.res_exact_b}
                                  </small>
                                ) : (
                                  <small>Wynik: oczekiwanie</small>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <div className="my-pick-card__points">
                    {match.result ? (
                      <>
                        <strong>⭐ {match.points.total} pkt</strong>

                        <span>
                          Seria: {match.points.series} pkt
                          {" · "}
                          Mapy: {match.points.maps} pkt
                        </span>
                      </>
                    ) : (
                      <span>⏳ Punkty: oczekiwanie na wynik meczu</span>
                    )}
                  </div>

                  <Link
                    className="my-pick-card__link"
                    to={`/events/${slug}/matches/${match.id}`}
                  >
                    {match.result
                      ? "Zobacz mecz"
                      : hasPrediction
                        ? "Edytuj typ"
                        : "Typuj mecz"}
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="my-picks-pagination">
            <button
              type="button"
              disabled={data.pagination.page <= 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              ← Poprzednia
            </button>

            <span>
              Strona {data.pagination.page + 1}/{data.pagination.total_pages}
            </span>

            <button
              type="button"
              disabled={data.pagination.page >= data.pagination.total_pages - 1}
              onClick={() => setPage((value) => value + 1)}
            >
              Następna →
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default MyPicksPage;
