import { useEffect, useState } from "react";
import {
  Link,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom";

import BackLink from "../components/BackLink.jsx";
import { getEventMatches } from "../lib/api.js";
import { humanPhase } from "../lib/phaseLabels.js";
import { odmien } from "../lib/odmiana.js";
import {
  filterMatches,
  phasesFromMatches,
  teamsFromMatches,
  STATE_LABELS,
} from "../lib/matchFilters.js";

function MatchesPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { realtimeRefresh } = useOutletContext();

  // Filtry siedzą w adresie, nie w stanie komponentu: dzięki temu da się
  // je wysłać komuś linkiem i przeżywają odświeżenie strony. Tak samo
  // działał dotąd filtr po fazie, który przychodzi ze strony eventu.
  const selectedPhase = searchParams.get("phase");
  const selectedTeam = searchParams.get("team");
  const selectedState = searchParams.get("stan");

  // Lokalna mapa etykiet faz poszła na rzecz humanPhase. API oddaje fazy
  // WIELKIMI literami (PLAYIN, DOUBLEELIM), a tamta mapa miała klucze
  // małymi - więc nagłówek pokazywał surowe "PLAYIN" zamiast "Play-In".
  const ustawFiltr = (klucz, wartosc) => {
    setSearchParams(
      (poprzednie) => {
        const nowe = new URLSearchParams(poprzednie);

        // Pusta wartość to "wszystkie" - parametr wtedy znika z adresu,
        // zamiast zostawać jako pusty ogon.
        if (wartosc) nowe.set(klucz, wartosc);
        else nowe.delete(klucz);

        return nowe;
      },
      { replace: true },
    );
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

    if (payload?.slug && String(payload.slug) !== String(slug)) {
      return;
    }

    async function refreshMatches() {
      try {
        const data = await getEventMatches(slug);

        setMatches(data);
        setError(null);
      } catch (err) {
        console.error("MATCHES REALTIME REFRESH ERROR:", err);
      }
    }

    refreshMatches();
  }, [realtimeRefresh, slug]);

  const wszystkieMecze = matches?.matches ?? [];

  const filteredMatches = filterMatches(wszystkieMecze, {
    phase: selectedPhase,
    team: selectedTeam,
    state: selectedState,
  });

  // Listy do wyboru powstają z pobranych meczów, więc nie da się wybrać
  // filtru, który niczego nie pokaże.
  const fazy = phasesFromMatches(wszystkieMecze);
  const druzyny = teamsFromMatches(wszystkieMecze);

  // Wartość w rozwijanej liście musi być tym samym napisem, co w opcji -
  // adres może nieść "playin", a mecze "PLAYIN".
  const fazaWyboru =
    fazy.find((f) => f.phase.toLowerCase() === String(selectedPhase ?? "").toLowerCase())
      ?.phase ?? "";

  const filtrAktywny = Boolean(selectedPhase || selectedTeam || selectedState);

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
            {selectedPhase ? `Mecze — ${humanPhase(selectedPhase)}` : "Mecze"}
          </h2>

          {!loading && !error && matches && (
            <p>
              {filtrAktywny ? (
                <>
                  {filteredMatches.length} z {wszystkieMecze.length}{" "}
                  {odmien(wszystkieMecze.length, "meczu", "meczów", "meczów")}
                </>
              ) : (
                <>
                  {wszystkieMecze.length}{" "}
                  {odmien(wszystkieMecze.length, "mecz", "mecze", "meczów")}
                </>
              )}
            </p>
          )}
        </div>

        <BackLink to={`/events/${slug}`}>Wróć do eventu</BackLink>
      </div>

      {!loading && !error && wszystkieMecze.length > 0 && (
        <div className="matches-filters">
          <label className="matches-filters__field">
            <span>Faza</span>

            <select
              value={fazaWyboru}
              onChange={(e) => ustawFiltr("phase", e.target.value)}
            >
              <option value="">Wszystkie</option>

              {fazy.map((f) => (
                <option key={f.phase} value={f.phase}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="matches-filters__field">
            <span>Drużyna</span>

            <select
              value={selectedTeam ?? ""}
              onChange={(e) => ustawFiltr("team", e.target.value)}
            >
              <option value="">Wszystkie</option>

              {druzyny.map((nazwa) => (
                <option key={nazwa} value={nazwa}>
                  {nazwa}
                </option>
              ))}
            </select>
          </label>

          <label className="matches-filters__field">
            <span>Stan</span>

            <select
              value={selectedState ?? ""}
              onChange={(e) => ustawFiltr("stan", e.target.value)}
            >
              <option value="">Wszystkie</option>

              {Object.entries(STATE_LABELS).map(([klucz, etykieta]) => (
                <option key={klucz} value={klucz}>
                  {etykieta}
                </option>
              ))}
            </select>
          </label>

          {filtrAktywny && (
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => setSearchParams({}, { replace: true })}
            >
              Wyczyść filtry
            </button>
          )}
        </div>
      )}

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
              🟡 Niekompletne typy: <strong>{selectedProgress.partial}</strong>
            </small>
          )}
        </div>
      )}

      {loading && (
        <div
          className="ui-stack"
          aria-busy="true"
          aria-label="Ładowanie meczów"
        >
          {Array.from({ length: 4 }, (_, i) => (
            <div className="ui-skeleton ui-skeleton--row" key={i} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>
          <strong className="ui-error__title">
            Nie udało się wczytać meczów
          </strong>
          <p className="ui-error__text">{error}</p>
        </div>
      )}

      {!loading && !error && matches && (
        <section className="ui-stack ui-stack--loose">
          {filteredMatches.length === 0 && (
            <div className="ui-empty">
              <span className="ui-empty__icon" aria-hidden="true">
                📅
              </span>
              <strong className="ui-empty__title">Brak meczów</strong>
              <p className="ui-empty__text">
                {filtrAktywny
                  ? "Żaden mecz nie pasuje do wybranych filtrów."
                  : "W tym turnieju nie ma jeszcze żadnych zaplanowanych meczów."}
              </p>

              {filtrAktywny && (
                <button
                  type="button"
                  className="ui-btn ui-btn--sm"
                  onClick={() => setSearchParams({}, { replace: true })}
                >
                  Wyczyść filtry
                </button>
              )}
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

                {/* Nazwy drużyn prowadzą na ich strony - to jedyne miejsce
                    w serwisie, gdzie nazwa drużyny pada przy każdym meczu. */}
                <div className="ui-match">
                  <div className="ui-match__team">
                    <span className="ui-match__side">A</span>

                    <Link
                      className="ui-match__name"
                      to={`/teams/${encodeURIComponent(match.team_a)}`}
                    >
                      {match.team_a}
                    </Link>
                  </div>

                  <span className="ui-match__vs">VS</span>

                  <div className="ui-match__team ui-match__team--b">
                    <span className="ui-match__side">B</span>

                    <Link
                      className="ui-match__name"
                      to={`/teams/${encodeURIComponent(match.team_b)}`}
                    >
                      {match.team_b}
                    </Link>
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
