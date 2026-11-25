import { useEffect, useState } from "react";
import Ladowanie from "../../components/Ladowanie.jsx";
import { useT } from "../../i18n/useLanguage.js";

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
  getEventPickemConfig,
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
      { klucz: "x3_0", kluczNapisu: "phaseResults.teams30", limit: 2 },
      { klucz: "x0_3", kluczNapisu: "phaseResults.teams03", limit: 2 },
      { klucz: "advancing", kluczNapisu: "phaseResults.advancing", limit: 6 },
    ],
  },
  stage2: { etykieta: "Swiss Stage 2", grupy: null },
  stage3: { etykieta: "Swiss Stage 3", grupy: null },

  playin: {
    etykieta: "Play-In",
    grupy: [
      { klucz: "teams", kluczNapisu: "phaseResults.advancingTeams", limit: 8 },
    ],
  },

  playoffs: {
    etykieta: "Playoffs",
    grupy: [
      {
        klucz: "semifinalists",
        kluczNapisu: "phaseResults.semifinalists",
        limit: 4,
      },
      { klucz: "finalists", kluczNapisu: "phaseResults.finalists", limit: 2 },
      { klucz: "winner", kluczNapisu: "phaseResults.winner", limit: 1 },
      { klucz: "third", kluczNapisu: "admin.group.thirdOptional", limit: 1 },
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
  const t = useT();

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

  // Limity z KONFIGURACJI TURNIEJU, nie wpisane w ten plik. Serwer sprawdza
  // zapis właśnie nimi (getPhaseLimits), więc formularz przycinający do
  // własnych liczb pozwalałby kliknąć więcej, niż zapis przyjmie - i odmowa
  // przychodziłaby dopiero po „Zapisz", bez zapisania czegokolwiek.
  const [limityFaz, setLimityFaz] = useState(null);

  const konfiguracja = FAZY[faza];

  useEffect(() => {
    let anulowane = false;

    (async () => {
      try {
        const dane = await getEventPickemConfig(slug);

        if (anulowane) return;

        const mapa = {};

        for (const f of dane?.fazy ?? []) mapa[f.faza] = f.limity || {};

        setLimityFaz(mapa);
      } catch (err) {
        // Brak konfiguracji nie może zabrać możliwości wpisania wyniku -
        // zostają wtedy liczby wpisane w FAZY jako zapas.
        console.error("PHASE RESULTS LIMITS:", err);

        if (!anulowane) setLimityFaz({});
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [slug]);

  /** Limit grupy: z konfiguracji turnieju, a w zapasie z FAZY. */
  function limitGrupy(grupa) {
    const z = limityFaz?.[faza]?.[grupa.klucz];

    return Number.isFinite(Number(z)) ? Number(z) : grupa.limit;
  }

  /**
   * Drużyny zajęte w INNEJ grupie tego etapu.
   *
   * Serwer odrzuca cały zapis, gdy drużyna stoi w dwóch kategoriach
   * („Drużyna nie może wystąpić w więcej niż jednej kategorii") - i odrzuca
   * go w całości, więc przepadają też poprawnie wpisane 3-0 i 0-3. Bot nie
   * dopuszcza do tego, bo w ogóle nie pokazuje zajętych drużyn; tutaj było
   * odwrotnie: klikalne wszystko, a odmowa dopiero po zapisie.
   */
  function zajeteGdzieIndziej(klucz) {
    const zajete = new Set();

    for (const g of konfiguracja.grupy) {
      if (g.klucz === klucz) continue;

      for (const nazwa of wartosci[g.klucz] || []) zajete.add(nazwa);
    }

    return zajete;
  }

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

        setBlad(err.message || t("admin.results.loadError"));
        setWartosci({});
      } finally {
        if (!anulowane) setZaladowanaFaza(faza);
      }
    })();

    return () => {
      anulowane = true;
    };
  }, [slug, faza, t]);

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
        t("admin.results.saved", { phase: konfiguracja.etykieta }),
      );
    } catch (err) {
      setBlad(err.message || t("admin.results.saveError"));
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
      setKomunikat(t("admin.results.recalcDone"));
    } catch (err) {
      setBlad(err.message || t("admin.results.recalcError"));
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
            className="ui-choice__option"
            aria-pressed={faza === klucz}
            onClick={() => setFaza(klucz)}
          >
            {cfg.etykieta}
          </button>
        ))}
      </div>

      {ladowanie && <Ladowanie>{t("admin.results.loading")}</Ladowanie>}

      {!ladowanie &&
        konfiguracja.grupy.map((grupa) => {
          const wybrane = wartosci[grupa.klucz] || [];
          const limit = limitGrupy(grupa);
          const zajete = zajeteGdzieIndziej(grupa.klucz);
          const pelna = wybrane.length >= limit;

          return (
            <div
              className="ui-card ui-card--flat ui-stack ui-stack--tight"
              key={grupa.klucz}
            >
              <h4>
                {t(grupa.kluczNapisu)}
                <span className={`ui-count ${pelna ? "ui-count--done" : ""}`}>
                  {wybrane.length}/{limit}
                </span>
              </h4>

              {/* Kliknięcie po wyczerpaniu limitu było do tej pory po cichu
                  ignorowane - wyglądało jak zawieszony przycisk. */}
              {pelna && (
                <p className="ui-hint">{t("admin.results.groupFull")}</p>
              )}

              <div className="ui-choice ui-choice--grid">
                {teams.map((team) => {
                  const zaznaczona = wybrane.includes(team.name);
                  const gdzieIndziej = zajete.has(team.name);

                  // Pełna kategoria nie blokuje ODZNACZANIA - inaczej nie
                  // dałoby się poprawić pomyłki bez czyszczenia wszystkiego.
                  const zablokowana =
                    gdzieIndziej || (pelna && !zaznaczona);

                  return (
                    <button
                      key={team.id ?? team.name}
                      type="button"
                      className="ui-choice__option"
                      aria-pressed={zaznaczona}
                      disabled={zablokowana}
                      title={
                        gdzieIndziej
                          ? t("admin.results.usedElsewhere")
                          : undefined
                      }
                      onClick={() => przelacz(grupa.klucz, team.name, limit)}
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
          {zapisywanie ? t("admin.saving") : t("admin.results.save")}
        </button>

        <button
          type="button"
          className="ui-btn"
          onClick={przelicz}
          disabled={przeliczanie}
        >
          {przeliczanie
            ? t("admin.recalcing")
            : `⭐ ${t("admin.recalc")}`}
        </button>
      </div>

      {komunikat && <p className="ui-note ui-note--ok">{komunikat}</p>}

      {blad && <p className="ui-note ui-note--danger">{blad}</p>}
    </div>
  );
}

export default PhaseResultsAdmin;
