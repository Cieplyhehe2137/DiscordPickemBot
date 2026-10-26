// Cztery formularze faz: wspolna droga do ZAPISU i wspolna do ODCZYTU.
//
// Swiss, Play-In, Playoffs i Double Elimination maja osobne tabele, osobne
// ksztalty typu i osobne reguly. Wspolne maja to, co dzieje sie wokol nich:
// kogo wpuscic, ktory turniej wziac i ktory gate sprawdzic. Oba kierunki
// stoja tutaj razem z tablica PHASES, czyli z tym, co kazda faza ma
// naprawde wlasnego - zeby nazwa fazy, jej gate i jej zdanie o blokadzie
// nie dalo sie rozjechac miedzy odczytem a zapisem.
//
// ZAPIS - preparePhaseSave. ZANIM typ trafi do bazy, kazda faza przechodzi
// dokladnie te sama sciezke:
//
//   1. logowanie
//   2. etap (tylko Swiss - pozostale fazy nie maja etapow)
//   3. turniej ze sluga w adresie
//   4. czlonkostwo w serwerze turnieju
//   5. gate typowania tej fazy
//   6. istnieje aktualny turniej
//   7. slug nie wskazuje POPRZEDNIEGO turnieju
//
// Stalo to w czterech kopiach po ponad trzydziesci linii. Kopie juz zdazyly
// sie rozejsc w szczegolach, ktore z zewnatrz wygladaja na przypadkowe:
// trzy fazy pytaly bazy o piec albo szesc kolumn turnieju i uzywaly dwoch,
// jedna pytala od razu o dwie. Tutaj zostaja te dwie, bo tylko one sa
// czytane - `id` do porownania z aktualnym turniejem i `guild_id` do
// czlonkostwa i gate'a.
//
// KOLEJNOSC JEST CZESCIA KONTRAKTU. Niezalogowany gracz z blednym etapem
// dostaje 401, nie 400, i dlatego kontrola etapu siedzi tutaj, a nie przed
// wywolaniem - przeniesienie jej do handlera odwrocilo by te dwie
// odpowiedzi. Pilnuje tego test/phasePickSave.test.js.
//
// Co ZOSTAJE po stronie fazy: normalizacja typu, limity, sprawdzTyp, reguly
// drabinki, kontrola rosteru i sam zapis. Czyli wszystko, co kazda faza ma
// naprawde wlasne.
//
// ODCZYT - readPhaseForm, ale TYLKO dla trzech faz. Play-In, Playoffs
// i Double Elim odpowiadaly na GET formularza identycznym kodem. Swiss nie
// i nie da sie go tu wciagnac bez zmiany odpowiedzi API:
//
//   - podaje `event` przyciety do trzech pol, a nie caly wiersz turnieju;
//   - ma dodatkowe pole `stage`, bo jako jedyny ma etapy;
//   - w `lock` podaje zdanie zapasowe I kod tlumaczenia, a tamte trzy
//     oddaja samo `message: null`, gdy administrator nie wpisal powodu.
//
// Ta trzecia roznica wyglada na przeoczenie, a nie na zamysl - ale jej
// naprawa zmienia odpowiedz trzech tras naraz, wiec jest do decyzji, nie do
// cichego poprawienia przy sprzataniu. Obie strony tej roznicy pilnuje
// test/phaseFormRead.test.js.

import { loadPhaseTeams, withPickedTeams } from "./phaseFormTeams.js";
import { phaseLockResponse } from "./phaseLock.js";

const SWISS_STAGES = ["stage1", "stage2", "stage3"];

// Pierwsze zdanie jest wspolne, rozni sie tylko ogonek - i o to chodzi,
// zeby nie dalo sie zmienic jednego z czterech.
const STALE_FORM = "Ten formularz dotyczy poprzedniego eventu. Otwórz aktualny";

/**
 * Co kazda faza ma wlasnego na tej sciezce.
 *
 * `gate` to nazwa fazy dla checkPickemGate (wielkimi literami, jak
 * w Discordzie), `lock` to rodzaj zdania o blokadzie z phaseLock.js. Te dwie
 * nazwy NIE sa tym samym i nie da sie jednej wyliczyc z drugiej: Swiss pyta
 * o gate "SWISS", a zdanie ma rodzaj "phase", bo jedno zdanie obsluguje
 * wszystkie trzy etapy.
 */
const PHASES = {
  swiss: {
    gate: "SWISS",
    lock: "phase",
    stages: SWISS_STAGES,
    stale: { tail: "Swiss", code: "server.stale.swiss" },
  },
  playin: {
    gate: "PLAYIN",
    lock: "playin",
    stale: { tail: "Play-In", code: "server.stale.playin" },
  },
  playoffs: {
    gate: "PLAYOFFS",
    lock: "playoffs",
    stale: { tail: "Playoffs", code: "server.stale.playoffs" },
  },
  doubleelim: {
    gate: "DOUBLEELIM",
    lock: "doubleelim",
    stale: { tail: "panel Double Elimination", code: "server.stale.de" },
  },
};

function rejectWith(status, body) {
  return { rejected: { status, body } };
}

/**
 * Przechodzi sciezke do zapisu typu fazy.
 *
 * @returns {{rejected:{status:number, body:object}}
 *          |{userId:string, event:object, currentEventId:number}}
 *
 * Odmowa wraca jako DANE, a nie jako odpowiedz wyslana z tego miejsca -
 * `res` zostaje w rekach handlera. Inaczej nie dalo by sie przeczytac
 * z wywolania, ze trasa na pewno konczy sie po odmowie.
 */
export async function preparePhaseSave(
  req,
  { pool, isGuildMember, checkPickemGate, getOpenEventId, toWebMessage },
  { phase, stage = null },
) {
  const spec = PHASES[phase];

  if (!spec) {
    throw new Error(`preparePhaseSave: nieznana faza "${phase}"`);
  }

  const userId = req.session?.user?.id;

  if (!userId) {
    return rejectWith(401, {
      error: "Musisz być zalogowany.",
      code: "server.mustLogin",
    });
  }

  // Tylko Swiss ma etapy. Kontrola stoi za logowaniem i przed turniejem -
  // tak samo jak stala w handlerze.
  if (spec.stages && !spec.stages.includes(stage)) {
    return rejectWith(400, {
      error: "Nieprawidłowy etap Swiss.",
      code: "server.badSwissStage",
    });
  }

  const [[event]] = await pool.query(
    `
    SELECT
      id,
      guild_id
    FROM events
    WHERE slug = ?
    LIMIT 1
    `,
    [req.params.slug],
  );

  if (!event) {
    return rejectWith(404, {
      error: "Nie znaleziono turnieju.",
      code: "server.eventNotFound",
    });
  }

  // Discord dziala wylacznie z poziomu gildii, wiec WWW rowniez wymaga
  // czlonkostwa.
  if (!isGuildMember(req.session.user, event.guild_id)) {
    return rejectWith(403, {
      error: "Nie należysz do tego serwera.",
      code: "server.notMember",
    });
  }

  // Ten sam gate co Discord plus webowy odpowiednik deadline'u.
  //
  // `stage` idzie zawsze, takze dla faz bez etapow - checkPickemGate ma tam
  // wartosc domyslna null, wiec jest to dokladnie to samo, co wczesniejsze
  // wywolanie dwuargumentowe, tylko bez rozgalezienia na liczbe argumentow.
  const gate = await checkPickemGate(event.guild_id, spec.gate, stage);

  if (!gate.allowed) {
    return rejectWith(403, phaseLockResponse(gate, toWebMessage, spec.lock));
  }

  // AKTUALNY TURNIEJ - Discord robi to przez getOpenEventId().
  //
  // Bez tego zapis szedl na event_id odczytany ze sluga w adresie, a gate
  // sprawdzal faze BIEZACEGO turnieju. Dawalo sie wiec wejsc pod slugiem
  // starego turnieju i zapisac typ do cudzego event_id.
  const currentEventId = await getOpenEventId(pool, event.guild_id);

  if (!currentEventId) {
    // Jedyna odmowa na tej sciezce BEZ kodu - zostaje tak, jak byla we
    // wszystkich czterech kopiach, bo kod zmienilby odpowiedz API.
    return rejectWith(403, { error: "Nie znaleziono aktywnego eventu." });
  }

  if (Number(currentEventId) !== Number(event.id)) {
    return rejectWith(409, {
      error: `${STALE_FORM} ${spec.stale.tail}.`,
      code: spec.stale.code,
    });
  }

  return { userId, event, currentEventId };
}

/**
 * Sklada odpowiedz formularza fazy dla Play-In, Playoffs i Double Elim.
 *
 * `readPrediction` to jedyna rzecz, ktora te trzy fazy maja tu wlasna:
 * zapytanie o zapisany typ i jego ksztalt. Zwraca null, gdy gracz nic nie
 * zapisal, albo { prediction, picked } - gdzie `picked` to listy nazw
 * z typu, ktore maja dojsc do wybieraczki, gdy znikly z rosteru. KOLEJNOSC
 * tych list ma znaczenie: withPickedTeams nadaje doklejanym nazwom ujemne
 * id po kolei, a front uzywa ich jako klucza Reacta.
 *
 * @returns {{rejected:{status:number, body:object}}|{body:object}}
 *
 * Tak samo jak przy zapisie: odmowa wraca jako DANE, `res` zostaje
 * w rekach handlera.
 */
export async function readPhaseForm(
  req,
  { pool, isGuildMember, checkPickemGate, getPhaseLimits, toWebMessage },
  { phase, readPrediction },
) {
  const spec = PHASES[phase];

  if (!spec) {
    throw new Error(`readPhaseForm: nieznana faza "${phase}"`);
  }

  if (spec.stages) {
    throw new Error(
      `readPhaseForm: faza "${phase}" ma etapy i wlasny ksztalt odpowiedzi`,
    );
  }

  // Formularz jest PUBLICZNY - to strona, ktora ludzie wrzucaja linkiem.
  // Bez sesji nie ma czyjego typu czytac, ale lista druzyn i stan blokady
  // naleza sie kazdemu.
  const userId = req.session?.user?.id || null;

  const [[event]] = await pool.query(
    `
    SELECT id, guild_id, name, slug, status
    FROM events
    WHERE slug = ?
    LIMIT 1
    `,
    [req.params.slug],
  );

  if (!event) {
    return rejectWith(404, {
      error: "Nie znaleziono turnieju.",
      code: "server.eventNotFound",
    });
  }

  // Gate PRZED lista druzyn, bo to on decyduje, skad ta lista ma pochodzic:
  // otwarta faza bierze roster serwera, zamknieta - druzyny z meczow.
  const gate = await checkPickemGate(event.guild_id, spec.gate);

  const teams = await loadPhaseTeams({
    pool,
    eventId: event.id,
    guildId: event.guild_id,
    allowed: gate.allowed,
  });

  let prediction = null;
  let picked = [];

  if (userId) {
    // Czlonkostwo sprawdzane takze przy ODCZYCIE. Discord nie ma jak pokazac
    // panelu spoza gildii, a te trzy trasy jako jedyne pozwalaly odpytac
    // turniej obcego serwera.
    if (!isGuildMember(req.session.user, event.guild_id)) {
      return rejectWith(403, {
        error: "Nie należysz do tego serwera.",
        code: "server.notMember",
      });
    }

    const zapisany = await readPrediction({ pool, event, userId });

    if (zapisany) {
      prediction = zapisany.prediction;
      picked = zapisany.picked || [];
    }
  }

  return {
    body: {
      event,
      teams: withPickedTeams(teams, ...picked),
      limity: await getPhaseLimits(pool, event.guild_id, event.id, phase),

      prediction,
      lock: {
        allowed: gate.allowed,
        message: toWebMessage(gate.message, null),

        // Termin zamkniecia - dotyczy obu przypadkow: przed terminem strona
        // pisze, ile zostalo, a po nim - kiedy minal. null, gdy
        // administrator terminu nie ustawil.
        deadline: gate.deadline ?? null,
      },
    },
  };
}

/**
 * Wysyla odmowe z preparePhaseSave albo readPhaseForm.
 *
 * Osobna funkcja, zeby w handlerze stala JEDNA linia i zeby bylo z niej
 * widac, ze trasa sie w tym miejscu konczy.
 */
export function sendRejection(res, rejected) {
  return res.status(rejected.status).json(rejected.body);
}
