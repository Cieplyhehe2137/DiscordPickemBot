import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Ladowanie from "../components/Ladowanie.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import { getAllTime } from "../lib/api.js";
import { useT } from "../i18n/useLanguage.js";

// Klasyfikacja wszech czasów.
//
// Jedyna strona w serwisie, która patrzy PONAD turniejami. Każda inna jest
// w obrębie jednego eventu, więc zakończony turniej przestawał cokolwiek
// znaczyć - tutaj dorobek z niego pracuje dalej.
//
// Reguła siedzi po stronie serwera (server/lib/allTime.js) i to tam jest
// wyjaśniona. Tu wystarczy wiedzieć, że o kolejności decyduje ŚREDNIE MIEJSCE
// W STAWCE, a nie suma punktów - i że strona musi to powiedzieć, bo inaczej
// pierwsze pytanie brzmi "czemu ten z mniejszą liczbą punktów jest wyżej".

// Klasa miejsca na podium. Tablica, a nie sklejanie `ui-row-item--${rank}`:
// przy sklejaniu nazwa nie występuje w kodzie dosłownie, więc przegląd
// martwego CSS-a kasuje reguły razem z medalami. Ten sam zabieg, co
// w klasyfikacji turnieju.
const PODIUM = {
  1: " ui-row-item--1",
  2: " ui-row-item--2",
  3: " ui-row-item--3",
};

function AllTimePage() {
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

        const odp = await getAllTime();

        if (!anulowane) setDane(odp);
      } catch (err) {
        console.error("ALL TIME ERROR:", err);

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
        <Ladowanie>{t("allTime.loading")}</Ladowanie>
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

          <strong className="ui-error__title">{t("allTime.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  const gracze = dane?.classification ?? [];
  const prog = dane?.min_starts ?? 2;

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("allTime.kicker")}</span>

          <h2>{t("allTime.title")}</h2>

          <p>{t("allTime.intro")}</p>
        </div>
      </div>

      {gracze.length === 0 ? (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🏛️
          </span>

          <strong className="ui-empty__title">{t("allTime.empty.title")}</strong>

          <p className="ui-empty__text">
            {t("allTime.empty.text", { count: prog })}
          </p>
        </div>
      ) : (
        <>
          <p className="ui-stat__hint">
            {t("allTime.ranked", { count: gracze.length })}
          </p>

          <div className="ui-table">
            <div className="ui-table__head" aria-hidden="true">
              <span>#</span>
              <span>{t("allTime.head.player")}</span>
              <span>{t("allTime.head.best")}</span>
              <span>{t("allTime.head.average")}</span>
            </div>

            {gracze.map((gracz) => (
              <div
                className={`ui-row-item ui-row-item--link${PODIUM[gracz.rank] ?? ""}`}
                key={gracz.user_id}
              >
                <span className="ui-row-item__rank">{gracz.rank}</span>

                {/* Link prowadzi do profilu PONAD turniejami, a nie do
                    najlepszego startu. Tabela jest o dorobku z kilku
                    turniejów, więc wejście w jeden z nich urywało wątek
                    dokładnie tam, gdzie się zaczyna. */}
                <Link
                  className="ui-row-item__who"
                  to={`/player/${gracz.user_id}`}
                >
                  <PlayerAvatar
                    userId={gracz.user_id}
                    avatar={gracz.avatar}
                    name={gracz.displayname}
                  />

                  {/* Nick i liczba startów jedno pod drugim. W klasyfikacji
                      turnieju w tej komórce stoi sam nick i dlatego ma ona
                      nowrap - tutaj obie rzeczy sklejałyby się w jedną linię
                      i obie ginęły pod wielokropkiem. */}
                  <span className="ui-row-item__stack">
                    <span className="ui-row-item__name">
                      {gracz.displayname ?? gracz.user_id}
                    </span>

                    <span className="ui-row-item__sub">
                      {t("allTime.starts", { count: gracz.starts })}
                    </span>
                  </span>
                </Link>

                <div className="ui-row-item__meta">
                  <span className="ui-badge">
                    {t("allTime.bestPlace", {
                      rank: gracz.best.rank,
                      total: gracz.best.participants,
                    })}
                  </span>

                  <span className="ui-stat__hint">{gracz.best.name}</span>
                </div>

                <strong className="ui-row-item__score">
                  {t("allTime.average", { percent: gracz.avg_top_percent })}
                </strong>
              </div>
            ))}
          </div>

          {/* Dlaczego kogoś w tabeli nie ma. Bez tego zdania 85% graczy
              widzi ranking, w którym ich nie ma, i nie wie dlaczego. */}
          <p className="ui-note">{t("allTime.note", { count: prog })}</p>
        </>
      )}
    </main>
  );
}

export default AllTimePage;
