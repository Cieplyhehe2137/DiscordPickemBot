import { useEffect, useState } from "react";

import { getPhaseResults } from "../lib/api.js";

// Po zamknięciu fazy gracz widział wyłącznie swój zapisany typ - nigdzie na
// WWW nie było oficjalnego wyniku ani informacji, ile punktów faza dała.
// Wszystkie GET-y z wynikami faz są adminowe, więc dane istniały w bazie
// bez publicznego widoku.
//
// Komponent renderuje się dopiero, gdy wynik został opublikowany
// (published = true), więc na otwartej fazie nie zaśmieca formularza.

function trafione(lista, poprawne) {
  const zbior = new Set(poprawne || []);
  return (lista || []).map((team) => ({ team, hit: zbior.has(team) }));
}

function Lista({ tytul, wybrane, poprawne, punktyZa }) {
  const pozycje = trafione(wybrane, poprawne);
  const liczbaTrafien = pozycje.filter((p) => p.hit).length;

  return (
    <div className="phase-results__block">
      <h4>
        {tytul}
        {pozycje.length > 0 && (
          <span className="phase-results__hits">
            {liczbaTrafien}/{pozycje.length} trafione
            {punktyZa ? ` · ${liczbaTrafien * punktyZa} pkt` : ""}
          </span>
        )}
      </h4>

      <div className="phase-results__official">
        <span className="phase-results__label">Oficjalnie</span>

        <div className="phase-results__teams">
          {(poprawne || []).length === 0 ? (
            <em>—</em>
          ) : (
            poprawne.map((team) => (
              <span className="phase-team phase-team--official" key={team}>
                {team}
              </span>
            ))
          )}
        </div>
      </div>

      {pozycje.length > 0 && (
        <div className="phase-results__mine">
          <span className="phase-results__label">Twój typ</span>

          <div className="phase-results__teams">
            {pozycje.map(({ team, hit }) => (
              <span
                className={hit ? "phase-team phase-team--hit" : "phase-team phase-team--miss"}
                key={team}
              >
                {hit ? "✓" : "✕"} {team}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseResults({ slug, phase }) {
  const [dane, setDane] = useState(null);
  const [blad, setBlad] = useState("");

  useEffect(() => {
    let anulowane = false;

    async function pobierz() {
      try {
        const odpowiedz = await getPhaseResults(slug, phase);
        if (!anulowane) setDane(odpowiedz);
      } catch (err) {
        console.error("PHASE RESULTS ERROR:", err);
        if (!anulowane) setBlad(err.message || "");
      }
    }

    pobierz();

    return () => {
      anulowane = true;
    };
  }, [slug, phase]);

  if (blad || !dane?.published) {
    return null;
  }

  const { results, prediction, points, kind } = dane;

  return (
    <section className="phase-results">
      <header className="phase-results__head">
        <h3>Wyniki fazy</h3>

        {points !== null && (
          <span className="phase-results__points">{points} pkt</span>
        )}
      </header>

      {!prediction && (
        <p className="phase-results__note">
          Nie masz zapisanego typu dla tej fazy — poniżej sam oficjalny wynik.
        </p>
      )}

      {kind === "swiss" && (
        <>
          <Lista
            tytul="Drużyny 3-0"
            wybrane={prediction?.three_zero}
            poprawne={results.three_zero}
            punktyZa={4}
          />
          <Lista
            tytul="Drużyny 0-3"
            wybrane={prediction?.zero_three}
            poprawne={results.zero_three}
            punktyZa={4}
          />
          <Lista
            tytul="Awansujące"
            wybrane={prediction?.advancing}
            poprawne={results.advancing}
            punktyZa={2}
          />
        </>
      )}

      {kind === "playoffs" && (
        <>
          <Lista
            tytul="Półfinaliści"
            wybrane={prediction?.semifinalists}
            poprawne={results.semifinalists}
            punktyZa={1}
          />
          <Lista
            tytul="Finaliści"
            wybrane={prediction?.finalists}
            poprawne={results.finalists}
            punktyZa={2}
          />
          <Lista
            tytul="Zwycięzca"
            wybrane={prediction?.winner ? [prediction.winner] : []}
            poprawne={results.winner ? [results.winner] : []}
            punktyZa={3}
          />
          <Lista
            tytul="3. miejsce"
            wybrane={
              prediction?.third_place_winner
                ? [prediction.third_place_winner]
                : []
            }
            poprawne={
              results.third_place_winner ? [results.third_place_winner] : []
            }
            punktyZa={2}
          />
        </>
      )}

      {kind === "playin" && (
        <Lista
          tytul="Drużyny awansujące"
          wybrane={prediction?.teams}
          poprawne={results.teams}
          punktyZa={1}
        />
      )}

      {kind === "doubleelim" && (
        <>
          <Lista
            tytul="Upper Final A"
            wybrane={prediction?.upper_final_a}
            poprawne={results.upper_final_a}
            punktyZa={1}
          />
          <Lista
            tytul="Lower Final A"
            wybrane={prediction?.lower_final_a}
            poprawne={results.lower_final_a}
            punktyZa={1}
          />
          <Lista
            tytul="Upper Final B"
            wybrane={prediction?.upper_final_b}
            poprawne={results.upper_final_b}
            punktyZa={1}
          />
          <Lista
            tytul="Lower Final B"
            wybrane={prediction?.lower_final_b}
            poprawne={results.lower_final_b}
            punktyZa={1}
          />
        </>
      )}
    </section>
  );
}

export default PhaseResults;
