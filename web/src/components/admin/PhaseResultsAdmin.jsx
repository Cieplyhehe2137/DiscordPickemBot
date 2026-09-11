import { useEffect, useState } from "react";
import Ladowanie from "../../components/Ladowanie.jsx";

import {
  getSwissResults,
  saveSwissResults,
  getPlayoffsResults,
  savePlayoffsResults,
  getPlayinResults,
  savePlayinResults,
  getDoubleElimResults,
  saveDoubleElimResults,
  recalculateScores,
} from "../../lib/api.js";

// Wpisywanie oficjalnych wyników faz Pick'Em.
//
// Backend miał te endpointy od zawsze, a bot ma do nich dropdowny - ale
// przepisanie frontu usunęło SwissResultsPanel, PlayoffsResultsPanel,
// PlayInResultsPanel i DoubleElimResultsPanel, więc z poziomu WWW nie dało
// się rozliczyć żadnej fazy. Bez wyników nie ma punktów za Swiss, Playoffs,
// Play-In ani Double Elim.
//
// Jeden komponent zamiast czterech: różnią się wyłącznie zestawem grup
// i limitami, więc opisujemy je konfiguracją, a nie osobnym kodem.

const FAZY = {
  stage1: {
    etykieta: "Swiss Stage 1",
    grupy: [
      { klucz: "x3_0", etykieta: "Drużyny 3-0", limit: 2 },
      { klucz: "x0_3", etykieta: "Drużyny 0-3", limit: 2 },
      { klucz: "advancing", etykieta: "Awansujące", limit: 6 },
    ],
  },
  stage2: { etykieta: "Swiss Stage 2", grupy: null },
  stage3: { etykieta: "Swiss Stage 3", grupy: null },

  playin: {
    etykieta: "Play-In",
    grupy: [{ klucz: "teams", etykieta: "Drużyny awansujące", limit: 8 }],
  },

  playoffs: {
    etykieta: "Playoffs",
    grupy: [
      { klucz: "semifinalists", etykieta: "Półfinaliści", limit: 4 },
      { klucz: "finalists", etykieta: "Finaliści", limit: 2 },
      { klucz: "winner", etykieta: "Zwycięzca", limit: 1 },
      { klucz: "third", etykieta: "3. miejsce (opcjonalnie)", limit: 1 },
    ],
  },

  doubleelim: {
    etykieta: "Double Elimination",
    grupy: [
      { klucz: "upperFinalA", etykieta: "Upper Final A", limit: 2 },
      { klucz: "lowerFinalA", etykieta: "Lower Final A", limit: 2 },
      { klucz: "upperFinalB", etykieta: "Upper Final B", limit: 2 },
      { klucz: "lowerFinalB", etykieta: "Lower Final B", limit: 2 },
    ],
  },
};

// Swiss 2 i 3 mają identyczny układ co Swiss 1.
FAZY.stage2.grupy = FAZY.stage1.grupy;
FAZY.stage3.grupy = FAZY.stage1.grupy;

function jestSwiss(faza) {
  return faza === "stage1" || faza === "stage2" || faza === "stage3";
}

// Backend zwraca winner/third jako pojedyncze wartości, a formularz operuje
// na tablicach - tu jest jedyne miejsce, gdzie te kształty się spotykają.
function doFormularza(faza, dane) {
  if (!dane) return {};

  if (faza === "playoffs") {
    return {
      semifinalists: dane.semifinalists || [],
      finalists: dane.finalists || [],
      winner: dane.winner ? [dane.winner] : [],
      third: dane.third ? [dane.third] : [],
    };
  }

  if (faza === "playin") return { teams: dane.teams || [] };

  if (faza === "doubleelim") {
    return {
      upperFinalA: dane.upperFinalA || [],
      lowerFinalA: dane.lowerFinalA || [],
      upperFinalB: dane.upperFinalB || [],
      lowerFinalB: dane.lowerFinalB || [],
    };
  }

  return {
    x3_0: dane.x3_0 || [],
    x0_3: dane.x0_3 || [],
    advancing: dane.advancing || [],
  };
}

function doZapisu(faza, wartosci) {
  if (faza === "playoffs") {
    return {
      semifinalists: wartosci.semifinalists || [],
      finalists: wartosci.finalists || [],
      winner: (wartosci.winner || [])[0] || null,
      third: (wartosci.third || [])[0] || null,
    };
  }

  return wartosci;
}

async function pobierzWyniki(slug, faza) {
  if (jestSwiss(faza)) return getSwissResults(slug, faza);
  if (faza === "playin") return getPlayinResults(slug);
  if (faza === "playoffs") return getPlayoffsResults(slug);
  return getDoubleElimResults(slug);
}

function PhaseResultsAdmin({ slug, teams }) {
  const [faza, setFaza] = useState("stage1");
  const [wartosci, setWartosci] = useState({});

  // Stan ładowania WYLICZAMY z tego, dla której fazy mamy już dane.
  // Ustawianie go synchronicznie w efekcie (setLadowanie(true) przed await)
  // wywołuje kaskadę renderów i jest łapane przez react-hooks/set-state-in-effect.
  const [zaladowanaFaza, setZaladowanaFaza] = useState(null);
  const ladowanie = zaladowanaFaza !== faza;
  const [zapisywanie, setZapisywanie] = useState(false);
  const [przeliczanie, setPrzeliczanie] = useState(false);
  const [komunikat, setKomunikat] = useState("");
  const [blad, setBlad] = useState("");

  const konfiguracja = FAZY[faza];

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const dane = await pobierzWyniki(slug, faza);

        if (anulowane) return;

        setWartosci(doFormularza(faza, dane));
        setBlad("");
        setKomunikat("");
      } catch (err) {
        console.error("PHASE RESULTS ADMIN LOAD:", err);

        if (anulowane) return;

        setBlad(err.message || "Nie udało się wczytać wyników fazy.");
        setWartosci({});
      } finally {
        if (!anulowane) setZaladowanaFaza(faza);
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [slug, faza]);

  function przelacz(klucz, nazwa, limit) {
    setKomunikat("");
    setBlad("");

    setWartosci((biezace) => {
      const lista = biezace[klucz] || [];

      if (lista.includes(nazwa)) {
        return { ...biezace, [klucz]: lista.filter((t) => t !== nazwa) };
      }

      // Limit 1 (zwycięzca, 3. miejsce) działa jak wybór pojedynczy -
      // kliknięcie innej drużyny podmienia, zamiast blokować.
      if (limit === 1) return { ...biezace, [klucz]: [nazwa] };

      if (lista.length >= limit) return biezace;

      return { ...biezace, [klucz]: [...lista, nazwa] };
    });
  }

  async function zapisz() {
    setZapisywanie(true);
    setBlad("");
    setKomunikat("");

    try {
      const payload = doZapisu(faza, wartosci);

      if (jestSwiss(faza)) await saveSwissResults(slug, faza, payload);
      else if (faza === "playin") await savePlayinResults(slug, payload);
      else if (faza === "playoffs") await savePlayoffsResults(slug, payload);
      else await saveDoubleElimResults(slug, payload);

      setKomunikat(
        `Zapisano wyniki: ${konfiguracja.etykieta}. Punkty przeliczą się po kliknięciu „Przelicz punkty”.`,
      );
    } catch (err) {
      setBlad(err.message || "Nie udało się zapisać wyników.");
    } finally {
      setZapisywanie(false);
    }
  }

  async function przelicz() {
    setPrzeliczanie(true);
    setBlad("");
    setKomunikat("");

    try {
      await recalculateScores(slug);
      setKomunikat("Punkty przeliczone, ranking odświeżony.");
    } catch (err) {
      setBlad(err.message || "Nie udało się przeliczyć punktów.");
    } finally {
      setPrzeliczanie(false);
    }
  }

  return (
    <div className="ui-stack">
      <div className="ui-choice">
        {Object.entries(FAZY).map(([klucz, cfg]) => (
          <button
            key={klucz}
            type="button"
            className={
              faza === klucz
                ? "ui-stack__tab ui-stack__tab--active"
                : "ui-stack__tab"
            }
            onClick={() => setFaza(klucz)}
          >
            {cfg.etykieta}
          </button>
        ))}
      </div>

      {ladowanie && <Ladowanie>Wczytywanie wyników...</Ladowanie>}

      {!ladowanie &&
        konfiguracja.grupy.map((grupa) => {
          const wybrane = wartosci[grupa.klucz] || [];

          return (
            <div
              className="ui-card ui-card--flat ui-stack ui-stack--tight"
              key={grupa.klucz}
            >
              <h4>
                {grupa.etykieta}
                <span className="ui-count">
                  {wybrane.length}/{grupa.limit}
                </span>
              </h4>

              <div className="ui-choice ui-choice--grid">
                {teams.map((team) => {
                  const zaznaczona = wybrane.includes(team.name);

                  return (
                    <button
                      key={team.id ?? team.name}
                      type="button"
                      className={
                        zaznaczona
                          ? "ui-stack__team ui-stack__team--on"
                          : "ui-stack__team"
                      }
                      onClick={() =>
                        przelacz(grupa.klucz, team.name, grupa.limit)
                      }
                    >
                      {team.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

      <div className="ui-row ui-row--wrap">
        <button
          type="button"
          onClick={zapisz}
          disabled={zapisywanie || ladowanie}
        >
          {zapisywanie ? "Zapisywanie..." : "Zapisz wyniki fazy"}
        </button>

        <button
          type="button"
          className="ui-btn"
          onClick={przelicz}
          disabled={przeliczanie}
        >
          {przeliczanie ? "Przeliczanie..." : "⭐ Przelicz punkty"}
        </button>
      </div>

      {komunikat && <p className="ui-note ui-note--ok">{komunikat}</p>}

      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </div>
  );
}

export default PhaseResultsAdmin;
