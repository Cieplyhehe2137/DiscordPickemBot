// Godzina startu meczu (server/lib/startTime.js).
//
// matches.start_time_utc to DATETIME - gole cyfry bez strefy. Formularz
// "dodaj mecz" wysylal wartosc z <input type="datetime-local"> doslownie,
// czyli sciane zegara przegladarki, a bot, API i straznik blokad czytaja te
// kolumne jako UTC. Mecz z 16:00 polskiego czasu blokowal sie o 18:00
// polskiego czasu - dwie godziny PO rozpoczeciu.
//
// Zmierzone na produkcji przez porownanie z momentem wpisania wyniku:
// BO3 zakonczone 2:1 mialo wynik 40 minut po "starcie". Po przesunieciu
// o dwie godziny wychodzi 160 minut, czyli normalna dlugosc BO3.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/lib/startTime.js";

test("ODRZUCA sciane zegara bez strefy - to jest caly ten blad", async () => {
  const { parseStartTimeInput } = await import(MODUL);

  // Dokladnie to, co oddaje <input type="datetime-local">.
  const w = parseStartTimeInput("2026-10-05T16:00");

  assert.equal(w.ok, false);
  assert.equal(w.code, "server.startTimeNeedsZone");
  assert.match(w.reason, /strefę/);
});

test("odrzuca takze z sekundami i z samej daty", async () => {
  const { parseStartTimeInput } = await import(MODUL);

  for (const zly of ["2026-10-05T16:00:00", "2026-10-05 16:00:00", "2026-10-05"]) {
    const w = parseStartTimeInput(zly);

    assert.equal(w.ok, false, `"${zly}" powinno zostac odrzucone`);
    assert.equal(w.code, "server.startTimeNeedsZone");
  }
});

test("przyjmuje ISO z Z i zapisuje UTC jako napis", async () => {
  const { parseStartTimeInput } = await import(MODUL);

  const w = parseStartTimeInput("2026-10-05T14:00:00.000Z");

  assert.equal(w.ok, true);
  assert.equal(w.cleared, false);
  assert.equal(w.utc, "2026-10-05 14:00:00");
});

test("przyjmuje przesuniecie i przelicza je na UTC", async () => {
  // To jest ta sama chwila co wyzej, zapisana tak, jak widzi ja admin
  // siedzacy w Polsce: 16:00 czasu letniego to 14:00 UTC.
  const { parseStartTimeInput } = await import(MODUL);

  assert.equal(
    parseStartTimeInput("2026-10-05T16:00:00+02:00").utc,
    "2026-10-05 14:00:00",
  );

  // Zapis bez dwukropka i sam godzinowy tez sa poprawnym ISO.
  assert.equal(
    parseStartTimeInput("2026-10-05T16:00:00+0200").utc,
    "2026-10-05 14:00:00",
  );
});

test("ZAPISUJE NAPIS, nie obiekt Date", async () => {
  // Napis znaczy to samo niezaleznie od tego, czy pula ma ustawione
  // `timezone` - a bot swojej puli tego nie ustawia. Date przeszedlby
  // przez formatowanie mysql2 w strefie procesu i cala ta poprawka
  // zalezalaby od tego, w jakiej strefie chodzi host.
  const { parseStartTimeInput } = await import(MODUL);

  const w = parseStartTimeInput(new Date(Date.UTC(2026, 9, 5, 14, 0, 0)));

  assert.equal(typeof w.utc, "string");
  assert.equal(w.utc, "2026-10-05 14:00:00");
});

test("brak godziny to poprawna odpowiedz, a nie blad", async () => {
  // Ta sama droga obsluguje wyczyszczenie juz ustawionej godziny.
  const { parseStartTimeInput } = await import(MODUL);

  for (const puste of [null, undefined, ""]) {
    const w = parseStartTimeInput(puste);

    assert.equal(w.ok, true);
    assert.equal(w.utc, null);
    assert.equal(w.cleared, true);
  }
});

test("smiec dostaje odmowe, a nie Invalid Date w bazie", async () => {
  const { parseStartTimeInput } = await import(MODUL);

  for (const zly of ["jutro o osmej", "2026-13-45T99:99Z", {}, 1759672800000]) {
    const w = parseStartTimeInput(zly);

    assert.equal(w.ok, false, `${JSON.stringify(zly)} powinno zostac odrzucone`);
  }
});

test("NIE ZGADUJE strefy - to jest decyzja, nie przeoczenie", async () => {
  // Kuszace jest dopisac "jak nie ma strefy, przyjmij Europe/Warsaw".
  // To jest dokladnie ta cicha interpretacja, ktora wpuscila ten blad:
  // wolajacy nie wie, co sie z jego wartoscia stalo. Gdyby ktos kiedys
  // dolozyl takie zgadywanie, ten test ma o tym powiedziec.
  const { parseStartTimeInput } = await import(MODUL);

  const bezStrefy = parseStartTimeInput("2026-10-05T16:00");
  const zeStrefa = parseStartTimeInput("2026-10-05T16:00:00+02:00");

  assert.equal(bezStrefy.ok, false);
  assert.equal(zeStrefa.ok, true);
  assert.notEqual(
    bezStrefy.utc,
    zeStrefa.utc,
    "wartosc bez strefy nie moze dostac po cichu polskiego znaczenia",
  );
});
