import { markHits, countHits, teamInitial } from "../lib/teamPickHits.js";
import { humanPhase } from "../lib/phaseLabels.js";

// Typy drużyn gracza w fazach turnieju: kogo obstawił na 3-0, na 0-3 i na
// awans, etap po etapie.
//
// Do tej pory te dane były na stronie WWW tylko dla siebie samego i tylko na
// stronie fazy - profil pokazywał mecze i statystyki, ale nie to, jak komuś
// poszło typowanie drużyn.
//
// Logotypów drużyn nie ma skąd wziąć: kolumna teams.logo_url jest pusta we
// wszystkich wierszach, a drużyny występujące w typach nie mają tam nawet
// swoich wierszy - typy trzymają same nazwy jako tekst. Zamiast pustego
// kwadratu udającego logo jest litera w kółku, czyli ten sam zabieg, który
// strona stosuje dla graczy bez awatara.

function Druzyna({ team, hit, rozstrzygniete }) {
  // Dopóki wynik fazy nie jest opublikowany, nie ma czego oceniać - wszystkie
  // typy są wtedy neutralne, bo "nietrafiony" znaczyłoby nieprawdę.
  const ton = !rozstrzygniete ? "" : hit ? "ui-badge--ok" : "ui-badge--danger";

  return (
    <span className={`ui-badge ui-team ${ton}`.trim()}>
      <span className="ui-team__mark" aria-hidden="true">
        {teamInitial(team)}
      </span>

      {team}
    </span>
  );
}

function Grupa({ grupa, rozstrzygniete }) {
  const pozycje = markHits(grupa.picked, grupa.correct);
  const trafione = pozycje.filter((p) => p.hit).length;

  return (
    <div className="ui-stack ui-stack--tight">
      <div className="ui-row ui-row--between ui-row--wrap ui-row--full">
        <span className="ui-stat__hint">{grupa.label}</span>

        {rozstrzygniete && (
          <span className={`ui-badge ${trafione > 0 ? "ui-badge--ok" : ""}`}>
            {trafione}/{pozycje.length} trafione
          </span>
        )}
      </div>

      <div className="ui-row ui-row--wrap">
        {pozycje.map(({ team, hit }) => (
          <Druzyna
            key={`${grupa.key}-${team}`}
            team={team}
            hit={hit}
            rozstrzygniete={rozstrzygniete}
          />
        ))}
      </div>
    </div>
  );
}

function TeamPicks({ phases }) {
  if (!phases?.length) return null;

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">Typy drużyn</span>

          <h2>Kogo obstawił na awans</h2>
        </div>
      </div>

      {phases.map((faza) => {
        const { hits, total } = countHits(faza.groups);

        return (
          <div
            className="ui-card ui-card--flat ui-stack ui-stack--tight"
            key={faza.phase}
          >
            <div className="ui-row ui-row--between ui-row--wrap ui-row--full">
              <strong>{humanPhase(faza.phase)}</strong>

              <div className="ui-row ui-row--wrap">
                {faza.published ? (
                  <span
                    className={`ui-badge ${hits > 0 ? "ui-badge--ok" : ""}`}
                  >
                    {hits}/{total} trafione
                  </span>
                ) : (
                  <span className="ui-badge ui-badge--warn">
                    Wynik nieogłoszony
                  </span>
                )}

                {faza.points !== null && (
                  <span className="ui-badge">{faza.points} pkt</span>
                )}
              </div>
            </div>

            {faza.groups.map((grupa) => (
              <Grupa
                key={grupa.key}
                grupa={grupa}
                rozstrzygniete={faza.published}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

export default TeamPicks;
