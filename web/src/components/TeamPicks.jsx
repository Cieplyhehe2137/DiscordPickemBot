import { Link } from "react-router-dom";

import { markHits, countHits, teamInitial } from "../lib/teamPickHits.js";
import { humanPhase } from "../lib/phaseLabels.js";
import { useT } from "../i18n/useLanguage.js";

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

function Druzyna({ team, hit, rozstrzygniete, logo }) {
  // Dopóki wynik fazy nie jest opublikowany, nie ma czego oceniać - wszystkie
  // typy są wtedy neutralne, bo "nietrafiony" znaczyłoby nieprawdę.
  const ton = !rozstrzygniete ? "" : hit ? "ui-badge--ok" : "ui-badge--danger";

  return (
    // Plakietka prowadzi na strone druzyny. To jedyne miejsce, w ktorym
    // nazwy druzyn stoja obok siebie w skupisku, wiec najnaturalniej
    // stad do nich wejsc.
    <Link
      className={`ui-badge ui-team ${ton}`.trim()}
      to={`/teams/${encodeURIComponent(team)}`}
    >
      <span className="ui-team__mark" aria-hidden="true">
        {/* Litera MUSI mieć własny element. Jako goły tekst nie jest dzieckiem
            w rozumieniu selektora, więc nie trafia do tej samej komórki siatki
            co logo i ląduje wierszem niżej - czyli wystaje spod kółka. */}
        <span className="ui-team__initial">{teamInitial(team)}</span>

        {/* Logo leży NA literze, nie zamiast niej. Adres prowadzi do cudzego
            CDN-u, więc gdy obrazek nie dojdzie, onError go chowa i spod
            spodu wraca litera - zamiast ikony zepsutego obrazka. */}
        {logo && (
          <img
            className="ui-team__logo"
            src={logo}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
      </span>

      {team}
    </Link>
  );
}

function Grupa({ grupa, rozstrzygniete, logos }) {
  const t = useT();

  const pozycje = markHits(grupa.picked, grupa.correct);
  const trafione = pozycje.filter((p) => p.hit).length;

  return (
    <div className="ui-stack ui-stack--tight">
      <div className="ui-row ui-row--between ui-row--wrap ui-row--full">
        {/* Serwer odsyła KLUCZ słownika, nie gotowe zdanie - nie wie,
            w jakim języku ogląda stronę pytający. Nazwy meczów drabinki
            przychodzą dosłownie i wracają z t() bez zmian, bo nie ma ich
            w żadnym słowniku. */}
        <span className="ui-stat__hint">{t(grupa.label)}</span>

        {rozstrzygniete && (
          <span className={`ui-badge ${trafione > 0 ? "ui-badge--ok" : ""}`}>
            {t("common.hits", {
              hits: trafione,
              total: pozycje.length,
            })}
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
            logo={logos?.[team]}
          />
        ))}
      </div>
    </div>
  );
}

function TeamPicks({ phases, logos }) {
  const t = useT();

  if (!phases?.length) return null;

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("teamPicks.kicker")}</span>

          <h2>{t("teamPicks.title")}</h2>
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
              <strong>{humanPhase(faza.phase, t)}</strong>

              <div className="ui-row ui-row--wrap">
                {faza.published ? (
                  <span
                    className={`ui-badge ${hits > 0 ? "ui-badge--ok" : ""}`}
                  >
                    {t("common.hits", { hits, total })}
                  </span>
                ) : (
                  <span className="ui-badge ui-badge--warn">
                    {t("teamPicks.unpublished")}
                  </span>
                )}

                {faza.points !== null && (
                  <span className="ui-badge">
                    {t("common.points", { count: faza.points })}
                  </span>
                )}
              </div>
            </div>

            {faza.groups.map((grupa) => (
              <Grupa
                key={grupa.key}
                grupa={grupa}
                rozstrzygniete={faza.published}
                logos={logos}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

export default TeamPicks;
