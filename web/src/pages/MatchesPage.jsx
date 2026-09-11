import { useEffect, useState } from "react";
import {
  Link,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { getEventMatches } from "../lib/api.js";

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
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Pick&apos;Em</span>

          <h2>
            {selectedPhase
              ? `Mecze — ${phaseLabels[selectedPhase] ?? selectedPhase}`
              : "Mecze"}
          </h2>
        </div>

        <Link className="ui-btn ui-btn--ghost ui-btn--sm" to={`/events/${slug}`}>
          ← Wróć do eventu
        </Link>
      </div>

        {!loading && !error && selectedProgress && (
          <div className="matches-page__progress">
            <div className="matches-page__progress-top">
              <span>📊 Postęp typowania</span>

              <strong>
                {selectedProgress.complete}/{selectedProgress.total}
              </strong>
            </div>

            <div className="ui-meter">
              <div
                className="ui-meter__fill"
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

        {loading && (
          <div className="ui-stack" aria-busy="true" aria-label="Ładowanie meczów">
            {Array.from({ length: 4 }, (_, i) => (
              <div className="ui-skeleton ui-skeleton--row" key={i} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="ui-error" role="alert">
            <span className="ui-error__icon" aria-hidden="true">⚠️</span>
            <strong className="ui-error__title">Nie udało się wczytać meczów</strong>
            <p className="ui-error__text">{error}</p>
          </div>
        )}

        {!loading && !error && matches && (
          <section className="ui-stack ui-stack--loose">
            {filteredMatches.length === 0 && (
              <div className="ui-empty">
                <span className="ui-empty__icon" aria-hidden="true">📅</span>
                <strong className="ui-empty__title">Brak meczów</strong>
                <p className="ui-empty__text">
                  W tej fazie nie ma jeszcze żadnych zaplanowanych meczów.
                </p>
              </div>
            )}

            {filteredMatches.map((match) => {
              const predictionStatus = getPredictionStatus(match);

              return (
                <article className="ui-card ui-stack" key={match.id}>
                  <div className="ui-row ui-row--between ui-row--full">
                    <span>Mecz #{match.match_no}</span>

                    <div className="ui-row">
                      <span
                        className={`ui-badge ${
                          {
                            complete: "ui-badge--ok",
                            partial: "ui-badge--warn",
                            empty: "ui-badge--accent",
                          }[predictionStatus.className] ?? ""
                        }`}
                      >
                        {predictionStatus.icon} {predictionStatus.label}
                      </span>

                      <span className="ui-badge">BO{match.best_of}</span>
                    </div>
                  </div>

                  <div className="ui-match">
                    <div className="ui-match__team">
                      <span className="ui-match__side">A</span>
                      <strong className="ui-match__name">{match.team_a}</strong>
                    </div>

                    <span className="ui-match__vs">VS</span>

                    <div className="ui-match__team ui-match__team--b">
                      <span className="ui-match__side">B</span>
                      <strong className="ui-match__name">{match.team_b}</strong>
                    </div>
                  </div>

                  <div className="ui-row ui-row--between ui-row--full">
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
                        className="ui-btn ui-btn--primary ui-btn--sm"
                        to={`/events/${slug}/matches/${match.id}`}
                      >
                        Zobacz wynik
                      </Link>
                    ) : match.predictions_allowed === false ? (
                      <Link
                        className="ui-btn ui-btn--primary ui-btn--sm"
                        to={`/events/${slug}/matches/${match.id}`}
                      >
                        Zobacz mecz
                      </Link>
                    ) : (
                      <Link
                        className="ui-btn ui-btn--primary ui-btn--sm"
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
    </main>
  );
}

export default MatchesPage;
