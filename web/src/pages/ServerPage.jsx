import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import BackLink from "../components/BackLink.jsx";
import Ladowanie from "../components/Ladowanie.jsx";
import PlayerAvatar from "../components/PlayerAvatar.jsx";
import { getServer } from "../lib/api.js";
import { humanPhase } from "../lib/phaseLabels.js";
import { useT } from "../i18n/useLanguage.js";

// Strona pojedynczej społeczności.
//
// Zmierzone: serwis obsługuje DWIE społeczności z turniejami, nie jedną.
// 848 graczy wyłącznie na jednej, 221 wyłącznie na drugiej, 41 w obu -
// a cała strona mieszała ich turnieje w jednej liście i ich graczy w jednej
// klasyfikacji.
//
// Dane oddawała trasa /api/public/:guildSlug, kompletna od dawna, która
// przewijała się w tym projekcie wyłącznie jako pułapka przesłaniająca inne
// adresy - nigdy jako funkcja.

// Klasa miejsca na podium. Tablica, a nie sklejanie `ui-row-item--${rank}`:
// narzędzie do usuwania martwego CSS nie widzi nazw budowanych ze zmiennej.
const PODIUM = {
  1: " ui-row-item--1",
  2: " ui-row-item--2",
  3: " ui-row-item--3",
};

function ServerPage() {
  const t = useT();

  const { slug } = useParams();

  const [dane, setDane] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let aktualne = true;

    async function wczytaj() {
      try {
        setLoading(true);
        setError("");

        const odpowiedz = await getServer(slug);

        if (aktualne) setDane(odpowiedz);
      } catch (err) {
        if (aktualne) setError(err.message || t("server.errorText"));
      } finally {
        if (aktualne) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      aktualne = false;
    };
  }, [slug, t]);

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>{t("server.loading")}</Ladowanie>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <BackLink to="/">{t("server.back")}</BackLink>

        <p className="ui-note ui-note--danger">{t("server.errorText")}</p>
      </main>
    );
  }

  const gildia = dane?.guild;
  const eventy = dane?.events ?? [];
  const czolowka = dane?.top_players ?? [];

  return (
    <main className="ui-page">
      <BackLink to="/">{t("server.back")}</BackLink>

      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("server.kicker")}</span>

          <h2>{gildia?.name ?? slug}</h2>

          <p>{t("server.intro")}</p>
        </div>

        {/* Zaproszenie prowadzi na Discorda, czyli poza serwis - stąd
            zewnętrzny odnośnik, a nie Link routera. */}
        {gildia?.discord_url && (
          <a
            className="ui-btn ui-btn--ghost ui-btn--sm"
            href={gildia.discord_url}
            target="_blank"
            rel="noreferrer"
          >
            {t("home.servers.join")}
          </a>
        )}
      </div>

      <div className="ui-stats">
        <div className="ui-stat">
          <span>{t("server.stats.events")}</span>
          <strong>{dane?.stats?.events ?? 0}</strong>
        </div>

        <div className="ui-stat">
          <span>{t("server.stats.participants")}</span>
          <strong>{dane?.stats?.participants ?? 0}</strong>
        </div>

        <div className="ui-stat">
          <span>{t("server.stats.predictions")}</span>
          <strong>{dane?.stats?.predictions ?? 0}</strong>
        </div>
      </div>

      {/* Serwer z botem, ale bez turnieju. Nie jest to awaria - trzecia
          gildia ma dziś ustawiony roster drużyn i zero eventów. */}
      {eventy.length === 0 ? (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🌱
          </span>

          <strong className="ui-empty__title">{t("server.empty.title")}</strong>

          <p className="ui-empty__text">{t("server.empty.text")}</p>
        </div>
      ) : (
        <>
          <section className="ui-card ui-stack">
            <div className="ui-section-head">
              <div>
                <h2>{t("server.events.title")}</h2>
              </div>
            </div>

            <div className="ui-tiles">
              {eventy.map((event) => (
                <Link
                  className="ui-card ui-card--interactive ui-tile"
                  key={event.id}
                  to={`/events/${event.slug}`}
                >
                  <strong className="ui-tile__name">{event.name}</strong>

                  <div className="ui-row ui-row--wrap ui-tile__meta">
                    <span className="ui-badge">
                      {humanPhase(event.phase, t)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {czolowka.length > 0 && (
            <section className="ui-card ui-stack">
              <div className="ui-section-head">
                <div>
                  <span className="ui-kicker">{t("server.top.kicker")}</span>

                  <h2>{t("server.top.title")}</h2>

                  <p>{t("server.top.intro")}</p>
                </div>
              </div>

              <div className="ui-table">
                {czolowka.map((gracz, i) => (
                  <div
                    className={`ui-row-item${PODIUM[i + 1] ?? ""}`}
                    key={gracz.user_id}
                  >
                    <span className="ui-row-item__rank">{i + 1}</span>

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
                          {t("allTime.starts", { count: gracz.starts })}
                        </span>
                      </span>
                    </Link>

                    <div className="ui-row-item__meta">
                      {gracz.best && (
                        <span className="ui-badge">
                          {t("allTime.bestPlace", {
                            rank: gracz.best.rank,
                            total: gracz.best.participants,
                          })}
                        </span>
                      )}
                    </div>

                    {/* Średni percentyl jako liczba główna - to on ustawia
                        kolejność. Punkty są kontekstem i stoją na stronie
                        wszech czasów, nie tutaj. */}
                    <strong className="ui-row-item__score">
                      {t("common.percentValue", {
                        percent: gracz.avg_top_percent,
                      })}
                    </strong>
                  </div>
                ))}
              </div>

              <p className="ui-note">
                {t("server.top.note", { count: dane.min_starts })}
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default ServerPage;
