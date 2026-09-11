import { useEffect, useState } from "react";
import {
  Link,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { getEventMatches } from "../lib/api.js";
import Ladowanie from "../components/Ladowanie.jsx";

function MatchesPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const selectedPhase = searchParams.get("phase");
  const { realtimeRefresh } = useOutletContext();

  const phaseLabels = {
    swiss_stage1: "Swiss Stage 1",
    swiss_stage2: "Swiss Stage 2",
    swiss_stage3: "Swiss Stage 3",
    playin: "Play-In",
    playoffs: "Playoffs",
    doubleelim: "Double Elimination",
    double_elim: "Double Elimination",
  };

  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadMatches() {
      try {
        setLoading(true);
        setError(null);

        const data = await getEventMatches(slug);

        setMatches(data);
      } catch (err) {
        console.error("EVENT MATCHES ERROR:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadMatches();
  }, [slug]);

  useEffect(() => {
    if (!realtimeRefresh?.version) {
      return;
    }

    const payload = realtimeRefresh.payload;

    if (
      payload?.slug &&
      String(payload.slug) !== String(slug)
    ) {
      return;
    }

    async function refreshMatches() {
      try {
        const data = await getEventMatches(slug);

        setMatches(data);
        setError(null);
      } catch (err) {
        console.error(
          "MATCHES REALTIME REFRESH ERROR:",
          err,
        );
      }
    }

    refreshMatches();
  }, [realtimeRefresh, slug]);

  const filteredMatches = selectedPhase
    ? (matches?.matches ?? []).filter((match) => match.phase === selectedPhase)
    : (matches?.matches ?? []);

  const selectedProgress = selectedPhase
    ? matches?.progress?.[selectedPhase]
    : null;

  function getPredictionStatus(match) {
    switch (match.prediction_status) {
      case "complete":
        return {
          icon: "✅",
          label: "Wytypowano",
          className: "complete",
        };

      case "partial":
        return {
          icon: "🟡",
          label: "Typ niekompletny",
          className: "partial",
        };

      default: {
        // Brak typu znaczy co innego przed meczem i po nim. Plakietka patrzyła
        // wyłącznie na prediction_status, więc na rozstrzygniętym meczu wołała
        // "Do wytypowania" tuż nad stopką z napisem "Mecz zakończony".
        const juzPoCzasie =
          match.ui_status === "FINAL" || match.predictions_allowed === false;

        return juzPoCzasie
          ? { icon: "➖", label: "Bez typu", className: "missed" }
          : { icon: "🎮", label: "Do wytypowania", className: "empty" };
      }
    }
  }

  return (
    <main className="matches-page">
      <section className="matches-page__hero">
        <span className="ui-kicker">Pick&apos;Em</span>

        <h1>
          {selectedPhase
            ? `Mecze — ${phaseLabels[selectedPhase] ?? selectedPhase}`
            : "Mecze"}
        </h1>

        <Link className="matches-page__back" to={`/events/${slug}`}>
          ← Wróć do eventu
        </Link>

        {!loading && !error && selectedProgress && (
          <div className="matches-page__progress">
            <div className="matches-page__progress-top">
              <span>📊 Postęp typowania</span>

              <strong>
                {selectedProgress.complete}/{selectedProgress.total}
              </strong>
            </div>

            <div className="matches-page__progress-bar">
              <div
                className="matches-page__progress-fill"
                style={{
                  width:
                    selectedProgress.total > 0
                      ? `${Math.min(
                        100,
                        (selectedProgress.complete / selectedProgress.total) *
                        100,
                      )}%`
                      : "0%",
                }}
              />
            </div>

            {selectedProgress.partial > 0 && (
              <small>
                🟡 Niekompletne typy:{" "}
                <strong>{selectedProgress.partial}</strong>
              </small>
            )}
          </div>
        )}

        {loading && <Ladowanie>Ładowanie meczów...</Ladowanie>}

        {!loading && error && <p>{error}</p>}

        {!loading && !error && matches && (
          <section className="matches-list">
            {filteredMatches.length === 0 && (
              <div className="matches-list__empty">
                <strong>Brak meczów</strong>

                <p>W tej fazie nie ma jeszcze żadnych zaplanowanych meczów.</p>
              </div>
            )}

            {filteredMatches.map((match) => {
              const predictionStatus = getPredictionStatus(match);

              return (
                <article className="match-card" key={match.id}>
                  <div className="match-card__top">
                    <span>Mecz #{match.match_no}</span>

                    <div className="match-card__badges">
                      <span
                        className={
                          "match-card__prediction-status " +
                          `match-card__prediction-status--${predictionStatus.className}`
                        }
                      >
                        {predictionStatus.icon} {predictionStatus.label}
                      </span>

                      <strong>BO{match.best_of}</strong>
                    </div>
                  </div>

                  <div className="match-card__teams">
                    <div className="match-team">
                      <span>A</span>
                      <strong>{match.team_a}</strong>
                    </div>

                    <div className="match-card__vs">VS</div>

                    <div className="match-team">
                      <span>B</span>
                      <strong>{match.team_b}</strong>
                    </div>
                  </div>

                  <div className="match-card__footer">
                    <span>
                      {match.ui_status === "FINAL"
                        ? "Mecz zakończony"
                        : match.predictions_allowed === false
                          ? (match.lock_reason ?? "Typowanie zablokowane")
                          : match.prediction_status === "complete"
                            ? "Typ zapisany — możesz go edytować"
                            : match.prediction_status === "partial"
                              ? "Dokończ swój typ"
                              : "Typowanie otwarte"}
                    </span>

                    {match.ui_status === "FINAL" ? (
                      <Link
                        className="match-card__pick-button"
                        to={`/events/${slug}/matches/${match.id}`}
                      >
                        Zobacz wynik
                      </Link>
                    ) : match.predictions_allowed === false ? (
                      <Link
                        className="match-card__pick-button"
                        to={`/events/${slug}/matches/${match.id}`}
                      >
                        Zobacz mecz
                      </Link>
                    ) : (
                      <Link
                        className="match-card__pick-button"
                        to={`/events/${slug}/matches/${match.id}`}
                      >
                        {match.prediction_status === "complete"
                          ? "Edytuj typ"
                          : match.prediction_status === "partial"
                            ? "Dokończ typ"
                            : "Typuj"}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}

export default MatchesPage;
