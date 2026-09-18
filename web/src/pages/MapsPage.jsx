import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Ladowanie from "../components/Ladowanie.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import { getMaps } from "../lib/api.js";
import { useT } from "../i18n/useLanguage.js";

// Czytanie wyników map.
//
// Reguła i - co ważniejsze - GRANICE tych danych stoją w
// server/lib/mapReading.js. Dwie rzeczy warto wiedzieć, patrząc na tę stronę:
//
// Nie ma tu ani słowa o nazwach map, bo nazwy mapy nie ma w bazie. Nie ma też
// nic per numer mapy, bo zmierzone wyszło, że mapa decydująca nie jest
// trudniejsza od pierwszej - a cztery prawie identyczne liczby nie są
// informacją.
//
// Zostaje jedno zdanie, którego serwis nigdy nie powiedział: społeczność
// typuje mapy ciaśniej, niż one wychodzą.

const PODIUM = {
  1: " ui-row-item--1",
  2: " ui-row-item--2",
  3: " ui-row-item--3",
};

// Pasek mierzy się do NAJCZĘSTSZEGO wyniku w danym rozkładzie, a nie do stu
// procent. Najczęstszy wynik to około 20%, więc przy skali bezwzględnej
// wszystkie paski byłyby krótkimi kikutami i nie dałoby się porównać
// kształtu obu rozkładów - a o to porównanie w całej tej sekcji chodzi.
function szerokosc(udzial, najwiekszy) {
  if (!(najwiekszy > 0)) return "0%";

  return `${Math.round((udzial / najwiekszy) * 100)}%`;
}

function Rozklad({ tytul, wyniki, mocny }) {
  const najwiekszy = wyniki.reduce((max, w) => Math.max(max, w.share), 0);

  return (
    <div className="map-dist__col">
      <h3 className="map-dist__title">{tytul}</h3>

      {wyniki.map((w) => (
        <div className="map-dist__row" key={`${w.high}:${w.low}`}>
          <span className="map-dist__score">
            {w.high}:{w.low}
          </span>

          <div className="ui-meter">
            <div
              className={`ui-meter__fill${mocny ? " ui-meter__fill--ok" : ""}`}
              style={{ width: szerokosc(w.share, najwiekszy) }}
            />
          </div>

          <span className="map-dist__share">{w.share}%</span>
        </div>
      ))}
    </div>
  );
}

function MapsPage() {
  const t = useT();

  const [dane, setDane] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let anulowane = false;

    async function wczytaj() {
      try {
        setLoading(true);
        setError("");

        const odp = await getMaps();

        if (!anulowane) setDane(odp);
      } catch (err) {
        console.error("MAPS ERROR:", err);

        if (!anulowane) setError(err.message);
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
      <main className="ui-page">
        <Ladowanie>{t("maps.loading")}</Ladowanie>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <div className="ui-error" role="alert">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">{t("maps.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  const typowane = dane?.predicted ?? [];
  const faktyczne = dane?.actual ?? [];
  const czytelnicy = dane?.readers ?? [];

  const typowanaRoznica = dane?.avg_predicted_gap ?? null;
  const faktycznaRoznica = dane?.avg_actual_gap ?? null;

  const progTypow = dane?.min_picks ?? 30;

  if (typowane.length === 0) {
    return (
      <main className="ui-page">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("maps.kicker")}</span>

            <h2>{t("maps.title")}</h2>
          </div>
        </div>

        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🗺️
          </span>

          <strong className="ui-empty__title">{t("maps.empty.title")}</strong>

          <p className="ui-empty__text">{t("maps.empty.text")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("maps.kicker")}</span>

          <h2>{t("maps.title")}</h2>

          <p>{t("maps.intro")}</p>
        </div>
      </div>

      {/* Dwie liczby obok siebie - to jest cała teza tej strony. */}
      <div className="ui-stats">
        <div className="ui-stat">
          <span>{t("maps.stat.predicted")}</span>

          <strong>{typowanaRoznica}</strong>

          <small>{t("maps.stat.predictedHint")}</small>
        </div>

        <div className="ui-stat ui-stat--featured">
          <span>{t("maps.stat.actual")}</span>

          <strong>{faktycznaRoznica}</strong>

          <small>{t("maps.stat.actualHint")}</small>
        </div>
      </div>

      <p className="ui-note">
        {t("maps.lead", {
          predicted: typowanaRoznica,
          actual: faktycznaRoznica,
          count: dane?.settled_picks ?? 0,
        })}
      </p>

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("maps.dist.kicker")}</span>

            <h2>{t("maps.dist.title")}</h2>

            <p>{t("maps.dist.intro")}</p>
          </div>
        </div>

        <div className="map-dist">
          <Rozklad tytul={t("maps.dist.predicted")} wyniki={typowane} />

          <Rozklad tytul={t("maps.dist.actual")} wyniki={faktyczne} mocny />
        </div>
      </section>

      {czytelnicy.length > 0 && (
        <>
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("maps.readers.kicker")}</span>

              <h2>{t("maps.readers.title")}</h2>

              <p>{t("maps.readers.intro")}</p>
            </div>
          </div>

          <div className="ui-table">
            <div className="ui-table__head" aria-hidden="true">
              <span>#</span>
              <span>{t("maps.readers.head.player")}</span>
              <span>{t("maps.readers.head.record")}</span>
              <span>{t("maps.readers.head.deviation")}</span>
            </div>

            {czytelnicy.map((gracz) => (
              <div
                className={`ui-row-item${PODIUM[gracz.rank] ?? ""}`}
                key={gracz.user_id}
              >
                <span className="ui-row-item__rank">{gracz.rank}</span>

                <Link
                  className="ui-row-item__who"
                  to={`/player/${gracz.user_id}`}
                >
                  <PlayerAvatar
                    userId={gracz.user_id}
                    avatar={gracz.avatar}
                    name={gracz.displayname}
                  />

                  <span className="ui-row-item__stack">
                    <span className="ui-row-item__name">
                      {gracz.displayname ?? gracz.user_id}
                    </span>

                    <span className="ui-row-item__sub">
                      {t("maps.readers.picks", { count: gracz.picks })}
                    </span>
                  </span>
                </Link>

                <div className="ui-row-item__meta">
                  <span className="ui-badge">
                    {t("maps.readers.winners", { percent: gracz.winner_rate })}
                  </span>

                  <span className="ui-badge">
                    {t("maps.readers.exact", { count: gracz.exact })}
                  </span>
                </div>

                <strong className="ui-row-item__score">
                  {gracz.deviation}
                </strong>
              </div>
            ))}
          </div>

          <p className="ui-note">
            {t("maps.readers.note", { count: progTypow })}
          </p>
        </>
      )}

      {/* Granica tych danych, powiedziana wprost. Bez tego zdania pierwsze
          pytanie brzmi "a która mapa", a na nie odpowiedzi nie ma. */}
      <p className="ui-note">{t("maps.noNames")}</p>
    </main>
  );
}

export default MapsPage;
