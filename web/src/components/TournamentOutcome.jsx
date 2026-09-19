import { useEffect, useState } from "react";

import TeamCrest from "./TeamCrest.jsx";
import { getEventOutcome } from "../lib/api.js";
import { useT } from "../i18n/useLanguage.js";

// Wynik turnieju: kto wygrał i ilu graczy to przewidziało.
//
// Można było otworzyć stronę IEM Cologne Major 2026 i nie dowiedzieć się,
// że wygrały Falcons. Mistrz leżał w playoffs_results od początku, ale
// pokazywał go wyłącznie komponent PhaseResults - montowany na stronach
// TYPOWANIA fazy, czyli tam, gdzie wchodzi się przez „obstaw playoffy".
//
// OSOBNY KOMPONENT, nie kolejne dwieście linii w EventPage, i pobiera się
// sam - tak samo jak sekcja rywali na profilu gracza.
//
// UWAGA JĘZYKOWA: nigdzie nie ma zdania z nazwą drużyny w środku. Nazwy są
// wolnym tekstem z bazy, więc „Falcons pokonali FURIĘ" wymagałoby biernika,
// którego nie da się zbudować ani po polsku, ani po rosyjsku. Stąd wszędzie
// etykieta obok nazwy, a nie proza.

/** Nazwa drużyny z herbem - jeden kształt dla wszystkich miejsc na podium. */
function Druzyna({ team, size = "" }) {
  return (
    <span className="outcome-team">
      <TeamCrest name={team.name} logo={team.logo} size={size} />

      <span className="outcome-team__name">{team.name}</span>
    </span>
  );
}

function TournamentOutcome({ slug }) {
  const t = useT();

  const [dane, setDane] = useState(null);

  useEffect(() => {
    let aktualne = true;

    async function wczytaj() {
      try {
        const odpowiedz = await getEventOutcome(slug);

        if (aktualne) setDane(odpowiedz);
      } catch (err) {
        // Turniej bez rozstrzygnięcia to stan normalny, nie awaria - błąd
        // idzie do konsoli, a sekcja po prostu się nie pokazuje.
        console.error("OUTCOME ERROR:", err);
      }
    }

    wczytaj();

    return () => {
      aktualne = false;
    };
  }, [slug]);

  // Turniej w trakcie nie ma jeszcze wiersza wyników. Brak sekcji jest tu
  // poprawną odpowiedzią, nie stanem pustym do zagospodarowania.
  if (!dane?.settled || !dane.winner) return null;

  const trafnosc = [
    {
      klucz: "winner",
      label: t("outcome.called.winner"),
      ile: dane.called.winner,
      procent: dane.called_percent.winner,
    },
    {
      klucz: "finalists",
      label: t("outcome.called.finalists"),
      ile: dane.called.finalists,
      procent: dane.called_percent.finalists,
    },
    {
      klucz: "semifinalists",
      label: t("outcome.called.semifinalists"),
      ile: dane.called.semifinalists,
      procent: dane.called_percent.semifinalists,
    },
  ];

  return (
    <section className="ui-card ui-stack">
      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">🏆 {t("outcome.kicker")}</span>

          <h2>{t("outcome.title")}</h2>

          <p>{t("outcome.intro")}</p>
        </div>
      </div>

      <div className="outcome-podium">
        {/* Mistrz osobno i większy - reszta drabinki jest kontekstem dla
            niego, a nie równorzędną listą. */}
        <div className="outcome-champion">
          <TeamCrest
            name={dane.winner.name}
            logo={dane.winner.logo}
            size="team-crest--xl"
          />

          <span className="ui-kicker">{t("outcome.champion")}</span>

          <strong className="outcome-champion__name">
            {dane.winner.name}
          </strong>
        </div>

        <dl className="outcome-rest">
          {dane.runner_up && (
            <div className="outcome-rest__row">
              <dt>{t("outcome.runnerUp")}</dt>

              <dd>
                <Druzyna team={dane.runner_up} />
              </dd>
            </div>
          )}

          {/* Trzeciego miejsca nie ma w każdym turnieju: w bazie bywa NULL
              albo sam myślnik. Serwer sprowadza obie postacie do null, więc
              tutaj wystarczy zwykły warunek. */}
          {dane.third_place && (
            <div className="outcome-rest__row">
              <dt>{t("outcome.third")}</dt>

              <dd>
                <Druzyna team={dane.third_place} />
              </dd>
            </div>
          )}

          {dane.lost_semis.length > 0 && (
            <div className="outcome-rest__row">
              <dt>
                {t("outcome.semis", { count: dane.lost_semis.length })}
              </dt>

              <dd className="outcome-rest__teams">
                {dane.lost_semis.map((team) => (
                  <Druzyna key={team.name} team={team} />
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="ui-section-head">
        <div>
          <span className="ui-kicker">{t("outcome.called.title")}</span>
        </div>
      </div>

      {/* Bez modyfikatora liczby kolumn: przy trzech kafelkach auto-fit
          i tak daje trzy kolumny, a na telefonie sam schodzi do jednej. */}
      <div className="ui-stats">
        {trafnosc.map((w) => (
          <div className="ui-stat" key={w.klucz}>
            <span>{w.label}</span>

            {/* Procent jako liczba główna, a ułamek pod spodem: „4%" mówi
                od razu, jak rzadkie to było, a „4 / 99" mówi, z czego to
                policzono. Sam ułamek wymagałby dzielenia w głowie. */}
            <strong>{t("common.percentValue", { percent: w.procent })}</strong>

            <small>
              {w.ile} / {dane.total}
            </small>
          </div>
        ))}
      </div>

      {dane.favourite && (
        <p className="ui-note outcome-favourite">
          <span className="outcome-favourite__label">
            {t("outcome.favourite")}
          </span>

          <Druzyna team={dane.favourite} />

          <span className="ui-badge">
            {t("common.percentValue", { percent: dane.favourite.percent })}
          </span>

          {/* Dopisek, a nie zdanie - doklejany po nazwie i procencie, więc
              nie wymaga odmiany nazwy drużyny w żadnym z pięciu języków. */}
          <span
            className={`ui-badge ${
              dane.favourite.was_right ? "ui-badge--ok" : "ui-badge--danger"
            }`}
          >
            {dane.favourite.was_right
              ? t("outcome.favourite.hit")
              : t("outcome.favourite.miss")}
          </span>
        </p>
      )}

      <p className="ui-note">{t("outcome.note", { count: dane.total })}</p>
    </section>
  );
}

export default TournamentOutcome;
