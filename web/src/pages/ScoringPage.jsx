import { useEffect, useState } from "react";

import Ladowanie from "../components/Ladowanie.jsx";
import { getScoring } from "../lib/api.js";
import { SECTIONS, pointsAt } from "../lib/scoring.js";

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
  // Kreska, a nie zero. Brak stawki znaczy, że ścieżka nie trafiła w nic
  // w rules/scoring.js, a zero jest tu prawdziwą wartością regulaminu.
  if (punkty === null) {
    return <span className="ui-badge">—</span>;
  }

  // Wyróżnienie tylko dla stawek, które coś dają. Zero na akcencie czytałoby
  // się jak nagroda.
  return (
    <span className={`ui-badge ${punkty > 0 ? "ui-badge--accent" : ""}`}>
      {punkty} pkt
    </span>
  );
}

function ScoringPage() {
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
          setError(err.message || "Nie udało się wczytać punktacji.");
        }
      } finally {
        if (!anulowane) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      anulowane = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="ui-page ui-page--narrow">
        <Ladowanie>Wczytuję punktację...</Ladowanie>
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
            Nie udało się wczytać punktacji
          </strong>

          <p className="ui-error__text">
            {error ||
              "Serwer nie oddał stawek punktowych. Spróbuj odświeżyć stronę."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="ui-page ui-page--narrow">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Regulamin</span>

          <h1 className="ui-display">Punktacja</h1>

          <p>
            Wszystkie stawki pochodzą wprost z reguł, którymi liczony jest
            ranking — to nie jest osobno spisany opis.
          </p>
        </div>
      </div>

      {SECTIONS.map((sekcja) => (
        <section className="ui-card ui-stack" key={sekcja.key}>
          <div className="ui-section-head">
            <div>
              <h2>{sekcja.title}</h2>

              <p>{sekcja.lead}</p>
            </div>
          </div>

          <div>
            {sekcja.rows.map((zasada) => (
              <div className="scoring-rule" key={zasada.path}>
                <div className="scoring-rule__text">
                  <strong>{zasada.label}</strong>

                  {zasada.hint && (
                    <span className="scoring-rule__hint">{zasada.hint}</span>
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
      <p className="ui-note">
        Zarchiwizowany turniej zachowuje punkty z chwili rozliczenia. Zasady
        punktacji map zmieniły się po IEM Cologne Major 2026 — wcześniej mapa
        dawała punkty wyłącznie za dokładny wynik, dziś liczy się odchylenie.
        Starych turniejów nie przeliczamy, bo przeliczenie przepisałoby
        zamknięty ranking.
      </p>
    </main>
  );
}

export default ScoringPage;
