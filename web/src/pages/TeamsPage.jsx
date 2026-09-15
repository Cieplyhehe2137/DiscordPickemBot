import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Ladowanie from "../components/Ladowanie.jsx";
import TeamCrest from "../components/TeamCrest.jsx";
import { getTeams } from "../lib/api.js";
import { odmien } from "../lib/odmiana.js";

// Lista drużyn ze wszystkich turniejów.
//
// Kolejność idzie od najczęściej grających, nie alfabetycznie. Alfabetycznie
// wyglądałoby porządniej i byłoby gorsze: na górze stanęłyby drużyny
// z jednym meczem w jednym turnieju.

function TeamsPage() {
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
          setError(err.message || "Nie udało się wczytać drużyn.");
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

  // Czterdzieści drużyn przychodzi jednym zapytaniem, więc filtrowanie
  // odbywa się na miejscu - bez odpytywania serwera przy każdej literze.
  const fraza = szukane.trim().toLowerCase();

  const widoczne = fraza
    ? teams.filter((t) => t.name.toLowerCase().includes(fraza))
    : teams;

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>Wczytuję drużyny...</Ladowanie>
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

          <strong className="ui-error__title">
            Nie udało się wczytać drużyn
          </strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ui-page">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Drużyny</span>

          <h2>Kto grał w tych turniejach</h2>

          <p>
            {teams.length}{" "}
            {odmien(teams.length, "drużyna", "drużyny", "drużyn")} ze wszystkich
            turniejów — z bilansem i tym, jak chętnie obstawiała je
            społeczność.
          </p>
        </div>
      </div>

      <div className="ui-row ui-row--wrap leaderboard-search">
        <input
          type="search"
          value={szukane}
          onChange={(e) => setSzukane(e.target.value)}
          placeholder="Szukaj drużyny..."
          aria-label="Szukaj drużyny"
        />
      </div>

      {widoczne.length === 0 ? (
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden="true">
            🔍
          </span>

          <strong className="ui-empty__title">Nic nie pasuje</strong>

          <p className="ui-empty__text">
            Żadna drużyna nie pasuje do <strong>{szukane}</strong>.
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
                  {team.settled > 0 ? (
                    <>
                      {team.wins}–{team.losses} w {team.settled}{" "}
                      {odmien(team.settled, "meczu", "meczach", "meczach")}
                    </>
                  ) : (
                    <>
                      {team.matches}{" "}
                      {odmien(team.matches, "mecz", "mecze", "meczów")} bez
                      wyniku
                    </>
                  )}
                </span>
              </div>

              {team.trust !== null && (
                <span className="ui-badge team-card__trust">
                  {team.trust}% typów
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
