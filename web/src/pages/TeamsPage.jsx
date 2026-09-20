import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Ladowanie from "../components/Ladowanie.jsx";
import TeamCrest from "../components/TeamCrest.jsx";
import { getTeams } from "../lib/api.js";
import {
  buildCrowdBias,
  MIN_ROZSTRZYGNIETYCH,
} from "../lib/crowdBias.js";
import { T } from "../i18n/T.jsx";
import { useT } from "../i18n/useLanguage.js";

// Lista drużyn ze wszystkich turniejów.
//
// Kolejność idzie od najczęściej grających, nie alfabetycznie. Alfabetycznie
// wyglądałoby porządniej i byłoby gorsze: na górze stanęłyby drużyny
// z jednym meczem w jednym turnieju.

function TeamsPage() {
  const t = useT();

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [szukane, setSzukane] = useState("");

  useEffect(() => {
    let anulowane = false;

    async function wczytaj() {
      try {
        setLoading(true);
        setError("");

        const dane = await getTeams();

        if (!anulowane) setTeams(dane.teams ?? []);
      } catch (err) {
        if (!anulowane) {
          setError(err.message || t("teams.errorText"));
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

  // Przecenienie liczy się z CAŁEJ listy, nie z przefiltrowanej -
  // „najbardziej przeceniana" ma znaczyć to samo niezależnie od tego,
  // co ktoś wpisał w wyszukiwarkę.
  const bias = buildCrowdBias(teams);

  // Czterdzieści drużyn przychodzi jednym zapytaniem, więc filtrowanie
  // odbywa się na miejscu - bez odpytywania serwera przy każdej literze.
  const fraza = szukane.trim().toLowerCase();

  const widoczne = fraza
    ? teams.filter((t) => t.name.toLowerCase().includes(fraza))
    : teams;

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>{t("teams.loading")}</Ladowanie>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <div className="ui-error">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">{t("teams.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("teams.kicker")}</span>

          <h2>{t("teams.title")}</h2>

          <p>{t("teams.intro", { count: teams.length })}</p>
        </div>
      </div>

      {/* PRZECENIANE I NIEDOCENIANE.
          Nad listą, bo to jedyne miejsce na tej stronie, które coś TWIERDZI -
          reszta wylicza. Nic nie dociąga: `trust` i `win_rate` przychodzą
          w tej samej odpowiedzi, na której stoi lista niżej. */}
      {(bias.overrated.length > 0 || bias.underrated.length > 0) && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("bias.kicker")}</span>

              <h2>{t("bias.title")}</h2>

              <p>
                {t("bias.intro", {
                  count: bias.considered,
                  min: MIN_ROZSTRZYGNIETYCH,
                })}
              </p>
            </div>
          </div>

          <div className="bias-columns">
            {[
              { klucz: "bias.overrated", ikona: "📉", lista: bias.overrated },
              { klucz: "bias.underrated", ikona: "📈", lista: bias.underrated },
            ].map((kolumna) => (
              <div className="ui-stack ui-stack--tight" key={kolumna.klucz}>
                <span className="ui-stat__hint">
                  {kolumna.ikona} {t(kolumna.klucz)}
                </span>

                {kolumna.lista.length === 0 ? (
                  <p className="ui-hint">{t("bias.empty")}</p>
                ) : (
                  kolumna.lista.map((team) => (
                    <Link
                      className="ui-row-item bias-row"
                      key={team.key}
                      to={`/teams/${encodeURIComponent(team.name)}`}
                    >
                      <span className="ui-row-item__who">
                        <TeamCrest name={team.name} logo={team.logo} />

                        <span className="ui-row-item__stack">
                          <span className="ui-row-item__name">{team.name}</span>

                          <span className="ui-row-item__sub">
                            {t("bias.row", {
                              trust: team.trust,
                              win: team.win_rate,
                            })}
                            {" · "}
                            {t("bias.sample", { count: team.settled })}
                          </span>
                        </span>
                      </span>

                      {/* Znak zostaje przy liczbie. „+45" i „−30" niosą
                          kierunek nawet wyrwane z kolumny - a wyrwane będą,
                          bo na telefonie kolumny stoją jedna pod drugą.
                          Sam kolor nie wystarczy. */}
                      <span
                        className={`ui-row-item__score bias-row__gap ${
                          team.gap > 0 ? "bias-row__gap--over" : "bias-row__gap--under"
                        }`}
                      >
                        {team.gap > 0 ? `+${team.gap}` : `−${Math.abs(team.gap)}`}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="ui-row ui-row--wrap leaderboard-search">
        <input
          type="search"
          value={szukane}
          onChange={(e) => setSzukane(e.target.value)}
          placeholder={t("teams.search")}
          aria-label={t("teams.searchLabel")}
        />
      </div>

      {widoczne.length === 0 ? (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🔍
          </span>

          <strong className="ui-empty__title">{t("teams.empty.title")}</strong>

          <p className="ui-empty__text">
            <T
              k="teams.empty.text"
              vars={{ query: <strong>{szukane}</strong> }}
            />
          </p>
        </div>
      ) : (
        <div className="team-grid">
          {widoczne.map((team) => (
            <Link
              className="ui-card ui-card--interactive team-card"
              key={team.key}
              to={`/teams/${encodeURIComponent(team.name)}`}
            >
              <TeamCrest
                name={team.name}
                logo={team.logo}
                size="team-crest--lg"
              />

              <div className="team-card__body">
                <strong className="team-card__name">{team.name}</strong>

                <span className="ui-stat__hint">
                  {/* Trzy różne stany, nie dwa. Drużyna bez ani jednego
                      meczu w bazie istnieje na stronie WYŁĄCZNIE dzięki
                      typom na fazy - „0 meczów" mówiłoby o niej nieprawdę
                      przez przemilczenie. */}
                  {team.matches === 0
                    ? t("teams.noMatches")
                    : team.settled > 0
                      ? t("teams.record", {
                        wins: team.wins,
                        losses: team.losses,
                        count: team.settled,
                      })
                      : t("teams.noResult", { count: team.matches })}
                </span>
              </div>

              {team.trust !== null && (
                <span className="ui-badge team-card__trust">
                  {t("common.picksPercent", { percent: team.trust })}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export default TeamsPage;
