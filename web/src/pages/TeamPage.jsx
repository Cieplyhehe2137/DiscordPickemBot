import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import BackLink from "../components/BackLink.jsx";
import Ladowanie from "../components/Ladowanie.jsx";
import TeamCrest from "../components/TeamCrest.jsx";
import { getTeam } from "../lib/api.js";
import { humanPhase } from "../lib/phaseLabels.js";
import { useT } from "../i18n/useLanguage.js";

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
  const t = useT();

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
          {mecz.event_name} · {humanPhase(mecz.phase, t)}
        </span>
      </div>

      {mecz.settled ? (
        <strong className="team-match__score">
          {nasze}:{ich}
        </strong>
      ) : (
        <span className="ui-badge ui-badge--warn">{t("team.noScore")}</span>
      )}

      <span className="team-match__trust">
        {procent === null
          ? "—"
          : t("common.picksPercent", { percent: procent })}
      </span>
    </div>
  );
}

function TeamPage() {
  const t = useT();

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
          setError(err.message || t("team.errorText"));
        }
      } finally {
        if (!anulowane) setLoading(false);
      }
    }

    wczytaj();

    return () => {
      anulowane = true;
    };
  }, [name, t]);

  if (loading) {
    return (
      <main className="ui-page">
        <Ladowanie>{t("team.loading")}</Ladowanie>
      </main>
    );
  }

  if (error) {
    return (
      <main className="ui-page">
        <BackLink to="/teams">{t("team.backToTeams")}</BackLink>

        <div className="ui-error">
          <span className="ui-error__icon" aria-hidden="true">
            ⚠️
          </span>

          <strong className="ui-error__title">{t("team.error")}</strong>

          <p className="ui-error__text">{error}</p>
        </div>
      </main>
    );
  }

  const { team, matches } = dane;

  return (
    <main className="ui-page">
      <BackLink to="/teams">{t("team.backToTeams")}</BackLink>

      <section className="ui-card ui-stack">
        <div className="ui-row ui-row--wrap">
          <TeamCrest name={team.name} logo={team.logo} size="team-crest--xl" />

          <div>
            <span className="ui-kicker">{t("team.kicker")}</span>

            <h2>{team.name}</h2>

            <p className="ui-stat__hint">
              {/* Drużyna bez meczów nie ma o czym powiedzieć „0 meczów
                  w 0 turniejach" - istnieje tu wyłącznie dzięki typom
                  na fazy i tak się przedstawia. */}
              {team.matches === 0
                ? t("teams.noMatches")
                : t("team.played", {
                  count: team.matches,
                  events: t("team.inEvents", { count: team.events }),
                })}
            </p>
          </div>
        </div>

        {/* Kafelki meczowe znikają w CAŁOŚCI, gdy meczów nie ma. Inaczej
            stało tu „Bilans 0–0 · Zaufanie — · Typów łącznie 0" - cztery
            liczby, z których żadna nie jest o tej drużynie prawdą, a razem
            wyglądają jak usterka. */}
        {team.matches > 0 && (
        <div className="ui-stats ui-stats--4">
          <div className="ui-stat ui-stat--featured">
            <span>{t("team.record")}</span>

            <strong>
              {team.wins}–{team.losses}
            </strong>

            <small>
              {team.win_rate === null
                ? t("team.noPlayed")
                : t("team.winRate", { percent: team.win_rate })}
            </small>
          </div>

          <div className="ui-stat">
            <span>{t("team.trust")}</span>

            <strong>{team.trust === null ? "—" : `${team.trust}%`}</strong>

            <small>{t("team.trustHint")}</small>
          </div>

          <div className="ui-stat">
            <span>{t("team.trustHit")}</span>

            <strong>
              {team.trust_hit === null ? "—" : `${team.trust_hit}%`}
            </strong>

            <small>{t("team.trustHitHint")}</small>
          </div>

          <div className="ui-stat">
            <span>{t("team.picksTotal")}</span>
            <strong>{team.picks_for}</strong>
            <small>{t("team.picksOf", { total: team.picks_total })}</small>
          </div>
        </div>
        )}
      </section>

      {/* Typy na fazy - druga połowa tego, co społeczność o tej drużynie
          sądzi. OSOBNA sekcja, nie doklejona do liczb wyżej: tamte mówią
          o meczach, a te o awansach, i mają inną skalę.

          Zmierzone: GamerLegion typowana na awans 484 razy przy 11%
          trafności, Imperial skazywana na 0-3 285 razy i ani razu słusznie. */}
      {team.phase && team.phase.total > 0 && (
        <section className="ui-card ui-stack">
          <div className="ui-section-head">
            <div>
              <span className="ui-kicker">{t("team.phase.kicker")}</span>

              <h2>{t("team.phase.title")}</h2>

              <p>{t("team.phase.intro")}</p>
            </div>
          </div>

          <div className="ui-stats">
            {[
              ["advance", t("team.phase.advance")],
              ["three_zero", t("team.phase.threeZero")],
              ["zero_three", t("team.phase.zeroThree")],
            ].map(([klucz, etykieta]) => {
              const g = team.phase[klucz];

              if (!g || g.picks === 0) return null;

              return (
                <div className="ui-stat" key={klucz}>
                  <span>{etykieta}</span>

                  <strong>{t("team.phase.picks", { count: g.picks })}</strong>

                  {/* null, a nie zero: etap bez wpisanego wyniku nie mówi
                      nic o trafności i nie może jej zaniżać. */}
                  <small>
                    {g.hit === null
                      ? t("team.phase.unsettled")
                      : t("team.phase.hit", { percent: g.hit })}
                  </small>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="ui-card ui-stack">
        <div className="ui-section-head">
          <div>
            <span className="ui-kicker">{t("team.matches")}</span>

            <h2>{t("team.history")}</h2>

            <p>{t("team.historyHint")}</p>
          </div>
        </div>

        {/* Drużyna bez ANI JEDNEGO meczu w bazie to inny przypadek niż
            drużyna, która mecze ma, ale żaden nie pasuje do filtra. Siedem
            zespołów grało wyłącznie w turnieju bez zapisanych meczów -
            „brak meczów" bez wyjaśnienia wyglądałoby na usterkę. */}
        {team.matches === 0 ? (
          <div className="ui-empty">
            <strong className="ui-empty__title">
              {t("team.phaseOnly.title")}
            </strong>

            <p className="ui-empty__text">{t("team.phaseOnly.text")}</p>
          </div>
        ) : matches.length === 0 ? (
          <p className="ui-hint">{t("team.noMatches")}</p>
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
