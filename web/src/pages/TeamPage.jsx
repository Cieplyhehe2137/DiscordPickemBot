import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import BackLink from "../components/BackLink.jsx";
import Ladowanie from "../components/Ladowanie.jsx";
import TeamCrest from "../components/TeamCrest.jsx";
import { getTeam } from "../lib/api.js";
import { humanPhase } from "../lib/phaseLabels.js";
import { odmien } from "../lib/odmiana.js";

// Pojedyncza drużyna: bilans, zaufanie społeczności i historia meczów.
//
// „Zaufanie" i „skutek zaufania" stoją obok siebie celowo, bo mówią co
// innego: drużyna może być obstawiana chętnie i przegrywać. Dopiero te dwie
// liczby razem odpowiadają na pytanie, czy ludzie się na niej znają.

// Klasa strony wyniku trzymana w tablicy, a nie sklejana. Sklejanie sprawia,
// że nazwa nie występuje w kodzie dosłownie i narzędzie do usuwania martwego
// CSS kasuje te reguły jako nieużywane.
const WYNIK_KLASA = {
  win: " team-match--win",
  loss: " team-match--loss",
  none: "",
};

function Mecz({ mecz }) {
  // Stronę meczu podaje serwer. Wyliczanie jej tutaj z porównania nazw
  // byłoby błędne: nazwa wyświetlana bywa innym zapisem niż ten w meczu
  // ("FUT Esports" wobec "FUT"), więc porównanie wypadałoby odwrotnie
  // i wygrana pokazywałaby się jako przegrana.
  const naszaToA = mecz.side === "a";

  const nasze = naszaToA ? mecz.res_a : mecz.res_b;
  const ich = naszaToA ? mecz.res_b : mecz.res_a;

  const stan = !mecz.settled ? "none" : nasze > ich ? "win" : "loss";

  const przeciwnik = naszaToA ? mecz.team_b : mecz.team_a;

  const zaNami = naszaToA ? mecz.for_a : mecz.for_b;

  const procent =
    mecz.picks_total > 0 ? Math.round((zaNami / mecz.picks_total) * 100) : null;

  return (
    <div className={`team-match${WYNIK_KLASA[stan]}`}>
      <div className="team-match__main">
        <Link
          className="team-match__opponent"
          to={`/events/${mecz.event_slug}/matches/${mecz.match_id}`}
        >
          <span className="team-match__vs">vs</span> {przeciwnik}
        </Link>

        <span className="ui-stat__hint">
          {mecz.event_name} · {humanPhase(mecz.phase)}
        </span>
      </div>

      {mecz.settled ? (
        <strong className="team-match__score">
          {nasze}:{ich}
        </strong>
      ) : (
        <span className="ui-badge ui-badge--warn">Bez wyniku</span>
      )}

      <span className="team-match__trust">
        {procent === null ? "—" : `${procent}% typów`}
      </span>
    </div>
  );
}

function TeamPage() {
  const { name } = useParams();

  const [dane, setDane] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let anulowane = false;

    async function wczytaj() {
      try {
        setLoading(true);
        setError("");

        const odp = await getTeam(name);

        if (!anulowane) setDane(odp);
      } catch (err) {
        if (!anulowane) {
          setError(err.message || "Nie udało się wczytać drużyny.");
        }
      } finally {
        if (!anulowane) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      anulowane = true;
    };
  }, [name]);

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>Wczytuję drużynę...</Ladowanie>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <BackLink to="/teams">Wróć do drużyn</BackLink>

        <div className="ui-error">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">
            Nie udało się wczytać drużyny
          </strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  const { team, matches } = dane;

  return (
    <main className="ui-page">
      <BackLink to="/teams">Wróć do drużyn</BackLink>

      <section className="ui-card ui-stack">
        <div className="ui-row ui-row--wrap">
          <TeamCrest name={team.name} logo={team.logo} size="team-crest--xl" />

          <div>
            <span className="ui-kicker">Drużyna</span>

            <h2>{team.name}</h2>

            <p className="ui-stat__hint">
              {team.matches} {odmien(team.matches, "mecz", "mecze", "meczów")}{" "}
              w {team.events}{" "}
              {odmien(team.events, "turnieju", "turniejach", "turniejach")}
            </p>
          </div>
        </div>

        <div className="ui-stats ui-stats--4">
          <div className="ui-stat ui-stat--featured">
            <span>Bilans</span>

            <strong>
              {team.wins}–{team.losses}
            </strong>

            <small>
              {team.win_rate === null
                ? "brak rozegranych meczów"
                : `${team.win_rate}% wygranych`}
            </small>
          </div>

          <div className="ui-stat">
            <span>Zaufanie</span>

            <strong>{team.trust === null ? "—" : `${team.trust}%`}</strong>

            <small>typów stawiało na nią</small>
          </div>

          <div className="ui-stat">
            <span>Skutek zaufania</span>

            <strong>
              {team.trust_hit === null ? "—" : `${team.trust_hit}%`}
            </strong>

            <small>tych typów się sprawdziło</small>
          </div>

          <div className="ui-stat">
            <span>Typów łącznie</span>
            <strong>{team.picks_for}</strong>
            <small>na {team.picks_total} w jej meczach</small>
          </div>
        </div>
      </section>

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">Mecze</span>

            <h2>Historia</h2>

            <p>
              Procent przy meczu to udział typów, które stawiały na tę
              drużynę.
            </p>
          </div>
        </div>

        {matches.length === 0 ? (
          <p className="ui-hint">Ta drużyna nie ma jeszcze rozpisanych meczów.</p>
        ) : (
          <div className="ui-stack ui-stack--tight">
            {matches.map((mecz) => (
              <Mecz key={mecz.match_id} mecz={mecz} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default TeamPage;
