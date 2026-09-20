import { useEffect, useState } from "react";

import Ladowanie from "../components/Ladowanie.jsx";
import { getScoring } from "../lib/api.js";
import {
  SECTIONS,
  buildScoringHistory,
  pointsAt,
} from "../lib/scoring.js";
import { useT } from "../i18n/useLanguage.js";

// Zasady punktacji.
//
// Do tej pory serwis nie tłumaczył ich nigdzie. Gracz widział w rankingu
// "47 pkt" i nie miał jak sprawdzić, skąd ta liczba - regulamin istniał
// wyłącznie jako plik w repozytorium i jako wiadomości bota na Discordzie,
// więc ktoś, kto wszedł z podesłanego linku, nie docierał do niego wcale.
//
// Strona nie trzyma żadnej stawki. Wszystkie przychodzą z serwera, z tego
// samego modułu, którym liczony jest ranking - patrz web/src/lib/scoring.js.

function Stawka({ punkty }) {
  const t = useT();

  // Kreska, a nie zero. Brak stawki znaczy, że ścieżka nie trafiła w nic
  // w rules/scoring.js, a zero jest tu prawdziwą wartością regulaminu.
  if (punkty === null) {
    return <span className="ui-badge">—</span>;
  }

  // Wyróżnienie tylko dla stawek, które coś dają. Zero na akcencie czytałoby
  // się jak nagroda.
  return (
    <span className={`ui-badge ${punkty > 0 ? "ui-badge--accent" : ""}`}>
      {t("common.points", { count: punkty })}
    </span>
  );
}

function ScoringPage() {
  const t = useT();

  const [scoring, setScoring] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let anulowane = false;

    async function wczytaj() {
      try {
        setError("");

        const odpowiedz = await getScoring();

        if (!anulowane) setScoring(odpowiedz?.scoring ?? null);

        if (!anulowane) setHistory(odpowiedz?.history ?? []);
      } catch (err) {
        if (!anulowane) {
          setError(err.message || t("scoring.page.errorText"));
        }
      } finally {
        if (!anulowane) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      anulowane = true;
    };
  }, [t]);

  if (loading) {
    return (
      <main className="ui-page ui-page--narrow">
        <Ladowanie>{t("scoring.page.loading")}</Ladowanie>
      </main>
    );
  }

  if (error || !scoring) {
    return (
      <main className="ui-page ui-page--narrow">
        <div className="ui-error">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">
            {t("scoring.page.error")}
          </strong>

          <p className="ui-error__text">
            {error || t("scoring.page.noRates")}
          </p>
        </div>
      </main>
    );
  }

  // Nazwy wierszy i dzisiejsze stawki doklejają się tutaj - serwer oddaje
  // same różnice, bo tylko on wie, co się zmieniło, a tylko strona wie,
  // jak to nazwać w pięciu językach.
  const historia = buildScoringHistory(history, scoring);

  return (
    <main className="ui-page ui-page--narrow">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("scoring.page.kicker")}</span>

          <h1 className="ui-display">{t("scoring.page.title")}</h1>

          <p>{t("scoring.page.intro")}</p>
        </div>
      </div>

      {SECTIONS.map((sekcja) => (
        <section className="ui-card ui-stack" key={sekcja.key}>
          <div className="ui-section-head">
            <div>
              <h2>{t(sekcja.titleKey)}</h2>

              <p>{t(sekcja.leadKey)}</p>
            </div>
          </div>

          <div>
            {sekcja.rows.map((zasada) => (
              <div className="scoring-rule" key={zasada.path}>
                <div className="scoring-rule__text">
                  <strong>{t(zasada.labelKey)}</strong>

                  {zasada.hintKey && (
                    <span className="scoring-rule__hint">
                      {t(zasada.hintKey)}
                    </span>
                  )}
                </div>

                <Stawka punkty={pointsAt(scoring, zasada.path)} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* CO OBOWIĄZYWAŁO WCZEŚNIEJ.
          Stała tu wcześniej jedna linijka przypisu o zmianie zasad
          punktowania MAP. Zmiana stawki za SERIĘ była większa i nie było
          o niej ani słowa - a tabela wyżej twierdzi wprost, że dokładny
          wynik serii nie daje nic ponad trafionego zwycięzcę. W Cologne
          dawał czterokrotność. */}
      {historia.map((regulamin) => (
        <section className="ui-card ui-stack" key={regulamin.id}>
          <div className="ui-section-head">
            <div>
              <h2>{t("scoringHistory.title")}</h2>

              <p>{t("scoringHistory.lead")}</p>

              <p className="ui-stat__hint">
                {t("scoringHistory.applied", {
                  events: regulamin.events.map((e) => e.name).join(", "),
                })}
              </p>
            </div>
          </div>

          <div>
            {regulamin.changes.map((zmiana) => (
              <div className="scoring-rule" key={zmiana.path}>
                <div className="scoring-rule__text">
                  <strong>{t(zmiana.labelKey)}</strong>

                  {zmiana.alsoKey && (
                    <span className="scoring-rule__hint">
                      {t(zmiana.alsoKey)} — {t("common.points", {
                        count: zmiana.alsoValue,
                      })}
                    </span>
                  )}
                </div>

                {/* Obie stawki obok siebie. Sama dawna liczba nie mówi
                    nic - zmianę widać dopiero w parze. */}
                <span className="scoring-then-now">
                  <span className="ui-badge">
                    {t("scoringHistory.was")}{" "}
                    {t("common.points", { count: zmiana.was })}
                  </span>

                  <span aria-hidden="true">→</span>

                  <span
                    className={`ui-badge ${
                      zmiana.now > 0 ? "ui-badge--accent" : ""
                    }`}
                  >
                    {t("scoringHistory.now")}{" "}
                    {t("common.points", { count: zmiana.now })}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <p className="ui-note">{t("scoringHistory.reconstructed")}</p>
        </section>
      ))}
    </main>
  );
}

export default ScoringPage;
