// Trasa profilu gracza (server/routes/playerProfile.js).
//
// Atrapa puli i atrapa `app` - nic nie laczy sie z baza. Testy sa tu glownie
// o WYDAJNOSCI, bo to ona byla zepsuta: kazde zapytanie to osobna podroz do
// bazy stojacej na innej maszynie niz API, zmierzone na produkcji okolo
// 165 ms, niezaleznie od tego, ile wierszy wraca.
//
// Profil robil tych podrozy ponad trzydziesci, jedna po drugiej, i wstawal
// szesc sekund - na kazdym turnieju tyle samo, bo koszt brali sie z LICZBY
// zapytan, a nie z ilosci danych. Dlatego test liczy fale, a nie milisekundy:
// milisekundy na cudzej maszynie nic nie znacza, a fala to jest ta wlasnie
// podroz, za ktora sie placi.

const test = require("node:test");
const assert = require("node:assert/strict");

const MODUL = "../server/routes/playerProfile.js";

function fakeApp() {
  const trasy = new Map();

  return {
    trasy,
    get(sciezka, handler) {
      trasy.set(`GET ${sciezka}`, handler);
    },
  };
}

// Atrapa puli liczaca fale. Fala to zestaw zapytan wystrzelonych, zanim
// ktorekolwiek z nich zdazylo wrocic.
function fakePool(odpowiedz) {
  const wywolania = [];

  let falaNr = 0;
  let wLocie = 0;

  return {
    wywolania,

    get fal() {
      return falaNr;
    },

    query(sql, args) {
      if (wLocie === 0) falaNr += 1;

      wLocie += 1;

      wywolania.push({ sql: String(sql), args, fala: falaNr });

      return new Promise((resolve) => {
        setTimeout(() => {
          wLocie -= 1;
          resolve([odpowiedz(String(sql)) ?? [], []]);
        }, 0);
      });
    },
  };
}

function fakeRes() {
  const zapis = { kod: 200, tresc: null };

  const res = {
    zapis,
    status(kod) {
      zapis.kod = kod;
      return res;
    },
    json(tresc) {
      zapis.tresc = tresc;
      return res;
    },
  };

  return res;
}

// PULAPKA: od czasu podzapytania po slugu KAZDE zapytanie tej trasy zawiera
// "FROM events" - w srodku "(SELECT id FROM events WHERE slug = ?)".
// Rozpoznawanie odczytu turnieju po tym napisie dawalo wiersz turnieju
// w odpowiedzi na kazde zapytanie i test milczaco mierzyl bzdury.
//
// Sam odczyt turnieju jest jedynym, ktory ZACZYNA sie od "SELECT" i zaraz
// potem ma "id,".
function toOdczytTurnieju(sql) {
  return /^\s*SELECT\s*\n\s*id,/.test(sql);
}

const EVENT = { id: 7, guild_id: "g1", name: "IEM", slug: "iem" };

// Domyslnie kazde zapytanie oddaje pustke - poza tym o turniej, bo bez niego
// trasa konczy sie na 404 i reszta nigdy nie startuje.
function odpowiedzDomyslna(sql) {
  if (toOdczytTurnieju(sql)) return [EVENT];

  return [];
}

async function wywolaj({ pool, userId = "u1", slug = "iem" }) {
  const { registerPlayerProfileRoutes } = await import(MODUL);

  const app = fakeApp();

  registerPlayerProfileRoutes(app, {
    findNameFromPicks: async () => null,
    pool,
  });

  const handler = app.trasy.get(
    "GET /api/public/events/:slug/players/:userId",
  );

  assert.ok(handler, "trasa profilu musi byc zarejestrowana");

  const res = fakeRes();

  await handler({ params: { slug, userId } }, res);

  return res.zapis;
}

test("nieznany turniej nadal konczy sie czterystaczwórką", async () => {
  // Swiadomy koszt jednej fali: przy nieznanym slugu pozostale zapytania i tak
  // poleca, bo ida rownolegle z odczytem turnieju. Podzapytanie daje wtedy
  // NULL, wiec nie znajduja nic. Placimy zmarnowana praca w przypadku rzadkim,
  // zeby nie placic okrazenia w kazdym normalnym.
  const pool = fakePool(() => []);

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 404);
  assert.equal(pool.fal, 1, "nawet niepotrzebna praca ma sie zmiescic w jednej fali");
});

test("wszystkie zapytania o gracza ida JEDNA fala", async () => {
  // Wczesniej bylo ich ponad trzydziesci, jedno po drugim. Potem wszystkie
  // naraz, ale wciaz za osobnym odczytem turnieju - ten odczyt kosztowal pelna
  // podroz (177 ms, zmierzone na serwerze) i sluzyl wylacznie zamianie sluga
  // na dwa identyfikatory.
  //
  // Ostatnia rzecza, ktora go tam trzymala, bylo loadTeamPicks: potrzebowalo
  // I turnieju, I serwera. Odkad przyjmuje slug, nic juz nie musi czekac.
  const pool = fakePool(odpowiedzDomyslna);

  await wywolaj({ pool });

  assert.ok(
    pool.wywolania.length >= 14,
    `oczekiwano co najmniej 14 zapytan, bylo ${pool.wywolania.length}`,
  );

  // Typy druzyn dokladaja wlasna druga fale tylko wtedy, gdy gracz cokolwiek
  // obstawil - tu nie obstawil, wiec calosc miesci sie w jednej.
  assert.equal(pool.fal, 1, `oczekiwano jednej fali, bylo ${pool.fal}`);
});

test("turniej wybiera sie slugiem, a nie osobno odczytanym identyfikatorem", async () => {
  const pool = fakePool(odpowiedzDomyslna);

  await wywolaj({ pool });

  // Tylko te, ktore w ogole zawezaja sie do turnieju. Zapytanie o starty
  // w POZOSTALYCH turniejach celowo nie ma takiego warunku - i nie moze go
  // dostac, bo przestaloby odpowiadac na swoje pytanie.
  const zawezone = pool.wywolania.filter(
    (w) => !toOdczytTurnieju(w.sql) && /\b(event_id|guild_id) = /.test(w.sql),
  );

  assert.ok(zawezone.length > 0, "brak zapytan zawezonych do turnieju");

  for (const w of zawezone) {
    assert.ok(
      /\(SELECT (id|guild_id) FROM events WHERE slug = \? LIMIT 1\)/.test(w.sql),
      `zapytanie nie bierze turnieju ze sluga: ${w.sql.slice(0, 70)}`,
    );
  }
});

test("liczba fal nie rosnie z liczba zapytan", async () => {
  // Straznik przed powrotem do pętli z await w srodku: gdyby ktos rozbil
  // Promise.all z powrotem na kolejne awaity, fal byloby tyle, co zapytan.
  const pool = fakePool(odpowiedzDomyslna);

  await wywolaj({ pool });

  assert.ok(
    pool.fal < pool.wywolania.length / 4,
    `fal ${pool.fal} przy ${pool.wywolania.length} zapytaniach - zapytania ida po kolei, nie razem`,
  );
});

test("gracz bez zadnych danych dostaje profil z zerami, a nie blad", async () => {
  // Kazde zapytanie oddaje pustke. Wczesniej wystarczylo, zeby jedno miejsce
  // czytalo pole z nieistniejacego wiersza i cala trasa konczyla sie
  // piecsetka zamiast pustym profilem.
  const pool = fakePool(odpowiedzDomyslna);

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 200);

  const p = zapis.tresc.profile;

  assert.equal(p.total_points, 0);
  assert.equal(p.accuracy, 0);
  assert.equal(p.rank, null, "brak wiersza to brak miejsca, nie miejsce zerowe");
  assert.deepEqual(p.recent_predictions, []);
  assert.equal(zapis.tresc.event.slug, "iem");
});

test("dane trafiaja do wlasnych pol, a nie do sasiednich", async () => {
  // Rownolegle zapytania wracaja w dowolnej kolejnosci. Gdyby wyniki laczyc
  // z nazwami po kolejnosci powrotu zamiast po pozycji w Promise.all, liczby
  // wyladowalyby pod cudzymi nazwami - i nic by sie nie wywrocilo, bo to
  // nadal sa liczby.
  const pool = fakePool((sql) => {
    if (toOdczytTurnieju(sql)) return [EVENT];
    if (sql.includes("FROM user_profiles"))
      return [{ user_id: "u1", displayname: "Ciepły", avatar: "abc" }];
    if (sql.includes("AS series_points"))
      return [{ total_points: 99, series_points: 60, map_points: 39 }];
    if (sql.includes("AS exact_series"))
      return [
        {
          total_predictions: 20,
          finished_predictions: 10,
          correct_winners: 7,
          exact_series: 3,
        },
      ];
    if (sql.includes("AS predicted_maps"))
      return [{ predicted_maps: 30, correct_maps: 18, exact_maps: 5 }];
    if (sql.includes("ROW_NUMBER"))
      return [{ rank_position: 4, total_points: 123 }];

    return [];
  });

  const zapis = await wywolaj({ pool });

  const p = zapis.tresc.profile;

  assert.equal(p.displayname, "Ciepły");
  assert.equal(p.avatar, "abc");

  // Punkty klasyfikacji ida z rankingu, a nie z sumy match_points - kafelki
  // "Ranking" i "Punkty" musza mowic to samo.
  assert.equal(p.rank, 4);
  assert.equal(p.total_points, 123);

  assert.equal(p.series_points, 60);
  assert.equal(p.map_points, 39);

  assert.equal(p.exact_series, 3);
  assert.equal(p.correct_winners, 7);
  assert.equal(p.finished_predictions, 10);

  assert.equal(p.predicted_maps, 30);
  assert.equal(p.correct_maps, 18);
  assert.equal(p.exact_maps, 5);

  // 7 z 10 zakonczonych typow.
  assert.equal(p.accuracy, 70);
});

test("awaria bazy konczy sie piecsetka, a nie polowicznym profilem", async () => {
  const pool = {
    query(sql) {
      if (toOdczytTurnieju(String(sql))) {
        return Promise.resolve([[EVENT], []]);
      }

      return Promise.reject(new Error("baza padla"));
    },
  };

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 500);
  assert.ok(zapis.tresc.error);
});

test("starty w innych turniejach wracaja w odpowiedzi", async () => {
  // Zapytanie o historie idzie w TEJ SAMEJ fali co reszta, wiec nie dodaje
  // ani jednej podrozy do bazy. Tu sprawdzamy, ze wynik faktycznie trafia
  // do odpowiedzi i ze biezacy turniej z niego wypada.
  const pool = fakePool((sql) => {
    if (toOdczytTurnieju(sql)) return [EVENT];

    if (sql.includes("ROW_NUMBER() OVER (") && sql.includes("PARTITION BY")) {
      return [
        // Turniej ogladany wlasnie - ma wypasc.
        {
          event_id: 7,
          name: "IEM",
          slug: "iem",
          is_archived: 1,
          total_points: 100,
          rank_position: 5,
          uczestnicy: 200,
        },
        {
          event_id: 4,
          name: "Budapeszt",
          slug: "budapeszt",
          is_archived: 1,
          total_points: 80,
          rank_position: 40,
          uczestnicy: 400,
        },
      ];
    }

    return [];
  });

  const zapis = await wywolaj({ pool });

  assert.equal(zapis.kod, 200);

  const inne = zapis.tresc.other_events;

  assert.equal(inne.length, 1, "biezacy turniej nie moze byc na liscie");
  assert.equal(inne[0].slug, "budapeszt");
  assert.equal(inne[0].rank, 40);
  assert.equal(inne[0].participants, 400);
  assert.equal(inne[0].top_percent, 10);
});

test("gracz z jednego turnieju dostaje pusta liste startow", async () => {
  const pool = fakePool(odpowiedzDomyslna);

  const zapis = await wywolaj({ pool });

  assert.deepEqual(zapis.tresc.other_events, []);
});

// --- Punkty z faz -----------------------------------------------------------

test("punkty z faz jada TA SAMA fala, co reszta", async () => {
  // Gdyby dolozyc je za fala, profil placilby kolejna pelna podroz (177 ms,
  // zmierzone na serwerze) za jedno zapytanie, ktore od niczego nie zalezy.
  const pool = fakePool(odpowiedzDomyslna);

  await wywolaj({ pool });

  const fazowe = pool.wywolania.filter((w) => w.sql.includes("AS phase"));

  assert.equal(fazowe.length, 1, "jedno zapytanie na wszystkie fazy");
  assert.equal(fazowe[0].fala, 1, "zapytanie o fazy wypadlo poza pierwsza fale");
});

test("zapytanie o fazy siega po wszystkie piec skladowych", async () => {
  // Klasyfikacja sumuje szesc tabel. Pominiecie jednej daje rozbicie, ktore
  // nie zgadza sie z liczba w kafelku obok - i nie da sie powiedziec, ktora
  // z nich klamie.
  const pool = fakePool(odpowiedzDomyslna);

  await wywolaj({ pool });

  const sql = pool.wywolania.find((w) => w.sql.includes("AS phase")).sql;

  for (const tabela of [
    "swiss_scores",
    "playin_scores",
    "playoffs_scores",
    "doubleelim_scores",
    "mvp_scores",
  ]) {
    assert.ok(sql.includes(tabela), `brak ${tabela} w rozbiciu na fazy`);
  }

  // BEZ filtra active - dokladnie tak liczy rebuildEventLeaderboard.
  assert.ok(!/\bactive\b/.test(sql), "filtr active rozjechalby sume z rankingiem");
});

test("odpowiedz niesie rozbicie na fazy i przebieg po etapach", async () => {
  // Liczby z produkcji: pierwsze miejsce StarLadder Budapest 2025 zbieralo
  // 47 punktow jako 12 -> 28 -> 40 -> 47, nie majac ANI JEDNEGO meczu.
  const pool = fakePool((sql) => {
    if (toOdczytTurnieju(sql)) return [EVENT];

    if (sql.includes("AS phase")) {
      return [
        { phase: "playoffs", stage: null, points: 7 },
        { phase: "swiss", stage: "stage2", points: 16 },
        { phase: "swiss", stage: "stage1", points: 12 },
        { phase: "swiss", stage: "stage3", points: 12 },
      ];
    }

    return [];
  });

  const zapis = await wywolaj({ pool });

  const fazy = zapis.tresc.phase_points;

  assert.equal(fazy.total, 47);

  assert.deepEqual(fazy.groups, [
    { phase: "swiss", points: 40 },
    { phase: "playoffs", points: 7 },
  ]);

  assert.deepEqual(
    fazy.progress.map((p) => p.total),
    [12, 28, 40, 47],
    "przebieg idzie za kolejnoscia turnieju, nie za kolejnoscia wierszy",
  );
});

test("gracz bez punktow fazowych dostaje puste rozbicie, a nie brak pola", async () => {
  // Front sprawdza dlugosc listy. `undefined` wywracaloby strone kazdemu,
  // kto typowal wylacznie mecze.
  const pool = fakePool(odpowiedzDomyslna);

  const zapis = await wywolaj({ pool });

  assert.deepEqual(zapis.tresc.phase_points, {
    total: 0,
    groups: [],
    progress: [],
  });
});
