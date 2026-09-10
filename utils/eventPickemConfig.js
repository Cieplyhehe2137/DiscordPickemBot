// utils/eventPickemConfig.js
//
// Jedno źródło prawdy o tym, jak wygląda typowanie DRUŻYN w danym evencie.
//
// Do tej pory liczby drużyn (Swiss 2/2/6, Play-In 8, Playoffs 4/2/1/1,
// Double Elim 2x4) były powtórzone w ~20 miejscach: w handlerach Discorda
// przez setMinValues/setMaxValues, w walidacjach endpointów API i na czterech
// stronach frontu. Każdy turniej musiał mieć więc identyczny format, a zmiana
// zasad wymagała edycji kilkunastu plików naraz.
//
// Teraz zasady są przypisane do eventu - tak samo jak mecze, deadline'y
// i ranking. Brak wiersza w event_pickem_phases oznacza wartości domyślne,
// czyli dokładnie to, co system robił wcześniej: istniejące turnieje działają
// bez zmian i bez migracji danych.

// Klucze faz używane w trasach frontu i w konfiguracji.
const FAZY = ["stage1", "stage2", "stage3", "playin", "playoffs", "doubleelim"];

// Grupy wyboru w każdej fazie: klucz -> etykieta + limit domyślny.
// Limit to zarazem liczba wymagana (typ musi mieć dokładnie tyle drużyn),
// z jednym wyjątkiem: `third` w Playoffs jest opcjonalne.
const DOMYSLNE = {
  stage1: { x3_0: 2, x0_3: 2, advancing: 6 },
  stage2: { x3_0: 2, x0_3: 2, advancing: 6 },
  stage3: { x3_0: 2, x0_3: 2, advancing: 6 },
  playin: { teams: 8 },
  playoffs: { semifinalists: 4, finalists: 2, winner: 1, third: 1 },
  doubleelim: {
    upperFinalA: 2,
    lowerFinalA: 2,
    upperFinalB: 2,
    lowerFinalB: 2,
  },
};

// Grupy opcjonalne - typ jest ważny także wtedy, gdy są puste.
const OPCJONALNE = { playoffs: ["third"] };

// Czy ta sama drużyna może wystąpić w kilku grupach jednej fazy.
//
// W Swiss, Play-In i Double Elim nie może: drużyna jest albo 3-0, albo 0-3,
// albo awansuje; sloty Double Elim też są rozłączne.
//
// W Playoffs MUSI - to hierarchia, a nie podział. Finaliści pochodzą
// z półfinalistów, zwycięzca jest jednym z finalistów. Globalna unikalność
// odrzucałaby tam każdy poprawny typ. Same zależności drabinki (winner
// należy do finalists itd.) sprawdza endpoint Playoffs, bo to reguła
// formatu, a nie kwestia liczby drużyn.
const UNIKALNE_MIEDZY_GRUPAMI = {
  stage1: true,
  stage2: true,
  stage3: true,
  playin: true,
  playoffs: false,
  doubleelim: true,
};

const ETYKIETY_GRUP = {
  x3_0: "Drużyny 3-0",
  x0_3: "Drużyny 0-3",
  advancing: "Awansujące",
  teams: "Drużyny awansujące",
  semifinalists: "Półfinaliści",
  finalists: "Finaliści",
  winner: "Zwycięzca",
  third: "3. miejsce",
  upperFinalA: "Upper Final A",
  lowerFinalA: "Lower Final A",
  upperFinalB: "Upper Final B",
  lowerFinalB: "Lower Final B",
};

function jestFaza(phase) {
  return FAZY.includes(phase);
}

function grupyFazy(phase) {
  return Object.keys(DOMYSLNE[phase] || {});
}

function czyOpcjonalna(phase, grupa) {
  return (OPCJONALNE[phase] || []).includes(grupa);
}

// Limity jednej fazy: zapisane w bazie albo domyślne.
// Nieznane/niepoprawne klucze z bazy są ignorowane - konfiguracja nie może
// wprowadzić grupy, której dana faza nie zna.
function scalLimity(phase, zapisane) {
  const domyslne = DOMYSLNE[phase] || {};
  const wynik = { ...domyslne };

  if (zapisane && typeof zapisane === "object") {
    for (const grupa of Object.keys(domyslne)) {
      const wartosc = Number(zapisane[grupa]);

      if (Number.isInteger(wartosc) && wartosc >= 0 && wartosc <= 64) {
        wynik[grupa] = wartosc;
      }
    }
  }

  return wynik;
}

/**
 * Konfiguracja wszystkich faz eventu.
 *
 * @returns {Promise<{skonfigurowany: boolean, fazy: Record<string,{enabled:boolean, limity:object}>}>}
 *   skonfigurowany = czy event ma JAKIKOLWIEK zapisany wiersz. Gdy nie ma,
 *   wywołujący powinien uznać zestaw faz za nieokreślony i wyznaczyć go po
 *   śladach w danych (tak robi /api/events/:slug/summary), zamiast zakładać,
 *   że event nie ma żadnej fazy.
 */
async function getEventPickemConfig(pool, guildId, eventId) {
  const [rows] = await pool.query(
    `SELECT phase, enabled, config
       FROM event_pickem_phases
      WHERE guild_id = ? AND event_id = ?`,
    [guildId, eventId],
  );

  const fazy = {};

  for (const phase of FAZY) {
    fazy[phase] = { enabled: false, limity: { ...DOMYSLNE[phase] } };
  }

  for (const row of rows) {
    if (!jestFaza(row.phase)) continue;

    // mysql2 zwraca JSON już zparsowany, ale starsze zapisy mogą być stringiem
    let zapisane = row.config;

    if (typeof zapisane === "string") {
      try {
        zapisane = JSON.parse(zapisane);
      } catch {
        zapisane = null;
      }
    }

    fazy[row.phase] = {
      enabled: Number(row.enabled) === 1,
      limity: scalLimity(row.phase, zapisane),
    };
  }

  return { skonfigurowany: rows.length > 0, fazy };
}

/**
 * Limity jednej fazy - to woła walidacja przy zapisie typu.
 *
 * Świadomie NIE sprawdza `enabled`: o tym, czy w danej fazie wolno teraz
 * typować, decyduje assertPredictionsAllowed (faza eventu) i deadline.
 * Tutaj chodzi wyłącznie o to, ile drużyn ma mieć poprawny typ.
 */
async function getPhaseLimits(pool, guildId, eventId, phase) {
  if (!jestFaza(phase)) return null;

  const [[row]] = await pool.query(
    `SELECT config FROM event_pickem_phases
      WHERE guild_id = ? AND event_id = ? AND phase = ? LIMIT 1`,
    [guildId, eventId, phase],
  );

  let zapisane = row?.config;

  if (typeof zapisane === "string") {
    try {
      zapisane = JSON.parse(zapisane);
    } catch {
      zapisane = null;
    }
  }

  return scalLimity(phase, zapisane);
}

/**
 * Zapisuje konfigurację faz eventu.
 *
 * @param {Array<{phase:string, enabled:boolean, limity:object}>} fazy
 */
async function setEventPickemConfig(pool, guildId, eventId, fazy) {
  const wiersze = [];

  for (const wpis of fazy || []) {
    if (!jestFaza(wpis?.phase)) continue;

    wiersze.push([
      guildId,
      eventId,
      wpis.phase,
      wpis.enabled ? 1 : 0,
      JSON.stringify(scalLimity(wpis.phase, wpis.limity)),
    ]);
  }

  if (!wiersze.length) return { zapisane: 0 };

  await pool.query(
    `INSERT INTO event_pickem_phases (guild_id, event_id, phase, enabled, config)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       config = VALUES(config),
       updated_at = CURRENT_TIMESTAMP`,
    [wiersze],
  );

  return { zapisane: wiersze.length };
}

/**
 * Sprawdza typ gracza względem limitów fazy.
 *
 * @param {object} wybory klucz grupy -> tablica nazw drużyn
 * @returns {{ok:true}|{ok:false, blad:string}}
 */
function sprawdzTyp(phase, limity, wybory) {
  const grupy = grupyFazy(phase);

  if (!grupy.length) {
    return { ok: false, blad: "Nieznana faza typowania." };
  }

  const wszystkie = [];

  for (const grupa of grupy) {
    const lista = Array.isArray(wybory?.[grupa]) ? wybory[grupa] : [];
    const limit = Number(limity[grupa] ?? 0);

    if (czyOpcjonalna(phase, grupa)) {
      if (lista.length > limit) {
        return {
          ok: false,
          blad: `${ETYKIETY_GRUP[grupa] || grupa}: maksymalnie ${limit}.`,
        };
      }
    } else if (lista.length !== limit) {
      return {
        ok: false,
        blad: `${ETYKIETY_GRUP[grupa] || grupa}: wybierz dokładnie ${limit}.`,
      };
    }

    // Wewnątrz jednej grupy duplikat jest błędem zawsze - niezależnie
    // od tego, czy faza pozwala powtarzać drużyny między grupami.
    if (new Set(lista).size !== lista.length) {
      return {
        ok: false,
        blad: `${ETYKIETY_GRUP[grupa] || grupa}: drużyny nie mogą się powtarzać.`,
      };
    }

    wszystkie.push(...lista);
  }

  if (
    UNIKALNE_MIEDZY_GRUPAMI[phase] &&
    new Set(wszystkie).size !== wszystkie.length
  ) {
    return {
      ok: false,
      blad: "Drużyna nie może wystąpić w więcej niż jednej kategorii.",
    };
  }

  return { ok: true };
}

/**
 * Sprawdza OFICJALNY WYNIK fazy wpisywany przez admina.
 *
 * Różni się od sprawdzTyp jedną rzeczą: limit jest maksimum, a nie liczbą
 * wymaganą. Admin wpisuje wynik etapami (najpierw znane 3-0, potem resztę),
 * więc częściowy wynik musi się zapisać - inaczej nie dałoby się prowadzić
 * turnieju na bieżąco.
 */
function sprawdzWynik(phase, limity, wybory) {
  const grupy = grupyFazy(phase);

  if (!grupy.length) {
    return { ok: false, blad: "Nieznana faza typowania." };
  }

  const wszystkie = [];

  for (const grupa of grupy) {
    const lista = Array.isArray(wybory?.[grupa]) ? wybory[grupa] : [];
    const limit = Number(limity[grupa] ?? 0);

    if (lista.length > limit) {
      return {
        ok: false,
        blad: `${ETYKIETY_GRUP[grupa] || grupa}: maksymalnie ${limit}.`,
      };
    }

    if (new Set(lista).size !== lista.length) {
      return {
        ok: false,
        blad: `${ETYKIETY_GRUP[grupa] || grupa}: drużyny nie mogą się powtarzać.`,
      };
    }

    wszystkie.push(...lista);
  }

  if (
    UNIKALNE_MIEDZY_GRUPAMI[phase] &&
    new Set(wszystkie).size !== wszystkie.length
  ) {
    return {
      ok: false,
      blad: "Drużyna nie może wystąpić w więcej niż jednej kategorii.",
    };
  }

  return { ok: true };
}

module.exports = {
  FAZY,
  DOMYSLNE,
  ETYKIETY_GRUP,
  jestFaza,
  grupyFazy,
  czyOpcjonalna,
  getEventPickemConfig,
  getPhaseLimits,
  setEventPickemConfig,
  sprawdzTyp,
  sprawdzWynik,
};
