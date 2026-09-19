import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Ladowanie from "../components/Ladowanie.jsx";
import TeamCrest from "../components/TeamCrest.jsx";
import { getTeams } from "../lib/api.js";
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
