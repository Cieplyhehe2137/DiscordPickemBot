import { useEffect, useState } from "react";

import Ladowanie from "../components/Ladowanie.jsx";
import { getScoring } from "../lib/api.js";
import { SECTIONS, pointsAt } from "../lib/scoring.js";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let anulowane = false;

    async function wczytaj() {
      try {
        setError("");

        const odpowiedz = await getScoring();

        if (!anulowane) setScoring(odpowiedz?.scoring ?? null);
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

      {/* Uczciwe zastrzeżenie, a nie drobny druk: reguła map faktycznie się
          zmieniła, a zarchiwizowanych turniejów nie przeliczamy. Bez tego
          ktoś porównałby powyższą tabelę ze swoim wynikiem z Cologne i wyszłoby
          mu, że ranking się nie zgadza. */}
      <p className="ui-note">{t("scoring.page.note")}</p>
    </main>
  );
}

export default ScoringPage;
