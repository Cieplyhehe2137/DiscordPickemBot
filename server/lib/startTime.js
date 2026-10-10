// Godzina startu meczu przychodząca z zewnątrz: jedno miejsce, które
// rozstrzyga, co ona właściwie znaczy.
//
// CO SIĘ STAŁO. Kolumna matches.start_time_utc to DATETIME, czyli gołe cyfry
// bez strefy - ich znaczenie ustala wyłącznie ten, kto je zapisał. Formularz
// „dodaj mecz" w panelu wysyłał wartość z <input type="datetime-local">
// dosłownie, czyli ścianę zegara w strefie przeglądarki:
//
//   admin wpisuje 16:00 (PL)  ->  "2026-10-05T16:00"  ->  w bazie 16:00
//
// a wszyscy czytelnicy - bot, API i strażnik blokad w SQL - biorą tę kolumnę
// za UTC. Mecz z 16:00 polskiego czasu blokował się więc o 18:00 polskiego
// czasu, DWIE GODZINY PO rozpoczęciu.
//
// Zmierzone na produkcji, IEM/EPL Season 24, przez porównanie z momentem
// wpisania wyniku (match_results.finished_at to TIMESTAMP, czyli instant):
//
//   nr 21  BO3 0:2  start wg cyfr 16:00  wynik wpisany 16:29  -> 29 minut
//   nr 15  BO3 2:1  start wg cyfr 18:30  wynik wpisany 19:10  -> 40 minut
//   nr 23  BO3 2:1  start wg cyfr 18:30  wynik wpisany 19:18  -> 48 minut
//
// BO3 zakończone 2:1 nie trwa czterdziestu minut. Po przesunięciu o dwie
// godziny te same mecze wychodzą na 149, 160 i 168 minut - czyli normalnie.
//
// DLACZEGO ODRZUCAMY, A NIE ZGADUJEMY. Kuszące jest dopisać „jak nie ma
// strefy, przyjmij Europe/Warsaw" - i to jest dokładnie ta decyzja, która
// wpuściła ten błąd: cicha interpretacja, o której wołający nie wie. Napis
// bez strefy nie znaczy nic konkretnego i jedyną uczciwą odpowiedzią na
// niego jest odmowa z wyjaśnieniem. Przeliczenie należy do tego, kto zna
// strefę użytkownika - czyli do przeglądarki (new Date(...).toISOString())
// albo do bota (luxon z Europe/Warsaw).
//
// CZYSTY, BEZ ZAPYTAŃ - regułę da się sprawdzić bez bazy.

/*
 * Data, godzina I strefa - wszystkie trzy obowiązkowo.
 *
 * Sprawdzamy CAŁY kształt, a nie samą końcówkę. Przy dopasowywaniu samego
 * ogona „2026-10-05" przechodziło jako poprawne: „-05" wygląda dokładnie
 * jak przesunięcie o minus pięć godzin. Złapał to test od daty bez godziny.
 */
const PELNY_ISO =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2}|[+-]\d{2})$/i;

/** Czy ten napis mówi jednoznacznie, o którą chwilę chodzi. */
function jednoznaczny(tekst) {
  return PELNY_ISO.test(tekst.trim());
}

/**
 * Sprowadza godzinę startu do postaci, w jakiej trzymamy ją w bazie:
 * "YYYY-MM-DD HH:MM:SS" w UTC.
 *
 * Zapisujemy NAPIS, a nie obiekt Date, bo napis znaczy to samo niezależnie
 * od tego, czy pula ma ustawione `timezone`. Tak samo robi bot
 * w handlers/matches/submitSetMatchTime.js.
 */
function naDatetimeUtc(data) {
  return data.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * @param wejscie wartość z żądania: null, "", Date albo napis ISO ze strefą
 * @returns {{ok: true, utc: string|null, cleared: boolean}}
 *        | {ok: false, reason: string, code: string}
 */
export function parseStartTimeInput(wejscie) {
  // Brak wartości znaczy „bez godziny" - i to jest poprawna odpowiedź,
  // a nie błąd. Tą samą drogą idzie czyszczenie już ustawionej godziny.
  if (wejscie === null || wejscie === undefined || wejscie === "") {
    return { ok: true, utc: null, cleared: true };
  }

  if (wejscie instanceof Date) {
    if (Number.isNaN(wejscie.getTime())) {
      return {
        ok: false,
        reason: "Niepoprawna godzina startu.",
        code: "server.badStartTime",
      };
    }

    return { ok: true, utc: naDatetimeUtc(wejscie), cleared: false };
  }

  if (typeof wejscie !== "string") {
    return {
      ok: false,
      reason: "Niepoprawna godzina startu.",
      code: "server.badStartTime",
    };
  }

  const tekst = wejscie.trim();

  if (!jednoznaczny(tekst)) {
    return {
      ok: false,
      reason:
        "Godzina startu musi podawać strefę, np. 2026-10-05T14:00:00.000Z. " +
        "Sama ściana zegara („2026-10-05T16:00”) nie mówi, czy to czas " +
        "polski, czy UTC - a mecz zablokowałby się o dwie godziny za późno.",
      code: "server.startTimeNeedsZone",
    };
  }

  const data = new Date(tekst);

  if (Number.isNaN(data.getTime())) {
    return {
      ok: false,
      reason: "Niepoprawna godzina startu.",
      code: "server.badStartTime",
    };
  }

  return { ok: true, utc: naDatetimeUtc(data), cleared: false };
}
