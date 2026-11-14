// Podsumowanie turnieju na Discordzie - wiadomosc po zakonczeniu typowania.
//
// Powstalo, bo bot nie linkowal na strone ANI RAZU: zero wystapien adresu
// w handlers, commands, utils i services. Serwis ma 26 widokow i 19 tysiecy
// rozliczonych typow, a ruch to 375 wizyt w sumie.
//
// NAJWAZNIEJSZY TEST W TYM PLIKU to ten o remisie. Czolowka klasyfikacji
// NIE jest liczona w bocie, tylko pobierana z wlasnego API, bo serwis sortuje
// ranking po trzech kluczach: punkty, trafieni zwyciezcy, identyfikator.
// Zapytanie "ORDER BY total_points" w bocie wygladaloby na to samo i dawaloby
// inna czolowke przy remisie - a na IEM Krakow 2026 pierwsze dwa miejsca maja
// PO 156 PUNKTOW. Bot sortujacy po punktach oglosilby innego zwyciezce niz
// strona i nic by tego nie zglosilo.
//
// Drugi warunek, ktorego pilnuje ten plik: wiadomosc NIE MOZE przerwac
// konczenia turnieju. Zakonczenie zapisuje punkty i archiwizuje - post na
// kanale jest przy tym dodatkiem.
//
// Atrapy klienta Discorda, puli i fetcha - nic nie laczy sie z siecia.

const test = require("node:test");
const assert = require("node:assert/strict");

const { siteLinks } = require("../utils/siteLinks");
const {
  fetchTournamentStandings,
} = require("../utils/fetchTournamentStandings");
const {
  buildTournamentRecapEmbed,
} = require("../utils/tournamentRecapEmbed");
const {
  maybePostTournamentRecap,
} = require("../utils/maybePostTournamentRecap");

const GILDIA = "1221762685595553834";
const EVENT_ID = 88;
const SLUG = "iem-krakow-2026";

// Prawdziwa odpowiedz z produkcji, przycieta do trzech wierszy. Miejsca
// pierwsze i drugie maja PO TYLE SAMO punktow - rozdziela je dopiero
// correct_winners, ktorego bot nie liczy.
const ODPOWIEDZ_API = {
  uczestnicy: 262,
  meczow: 50,
  leaderboard: [
    { rank: 1, user_id: "349640582550913024", displayname: "Gawdo", total_points: 156 },
    { rank: 2, user_id: "449487654321098765", displayname: "KS", total_points: 156 },
    { rank: 3, user_id: "615484321098765432", displayname: "brtks", total_points: 145 },
    { rank: 4, user_id: "700000000000000000", displayname: "czwarty", total_points: 140 },
  ],
};

function fakeFetch(odpowiedz, { ok = true, status = 200 } = {}) {
  const wywolania = [];

  const impl = async (url, opcje) => {
    wywolania.push({ url: String(url), opcje });

    return {
      ok,
      status,
      json: async () => odpowiedz,
    };
  };

  impl.wywolania = wywolania;

  return impl;
}

function fakeChannel() {
  const wyslane = [];

  return {
    wyslane,
    guildId: GILDIA,
    type: 0, // ChannelType.GuildText
    send(payload) {
      wyslane.push(payload);

      return Promise.resolve({ id: "1" });
    },
  };
}

function fakeClient(channel) {
  const pytane = [];

  return {
    pytane,
    channels: {
      fetch(id) {
        pytane.push(String(id));

        return channel
          ? Promise.resolve(channel)
          : Promise.reject(new Error("brak kanalu"));
      },
    },
  };
}

function fakePool({ panelChannelId = null } = {}) {
  const zapytania = [];

  return {
    zapytania,
    query(sql, args) {
      zapytania.push({ sql: String(sql), args });

      return Promise.resolve([
        panelChannelId ? [{ panel_channel_id: panelChannelId }] : [],
        [],
      ]);
    },
  };
}

// ----------------------------------------------------------------- adresy

test("bez PUBLIC_SITE_URL nie ma linkow, a nie ma bledu", () => {
  // Nowa konfiguracja nie moze zepsuc wiadomosci, ktore dzialaly wczesniej.
  assert.equal(siteLinks({}), null);
  assert.equal(siteLinks({ baseUrl: "   " }), null);
});

test("adresy stron odpowiadaja trasom frontu", () => {
  const l = siteLinks({
    baseUrl: "https://pickembot.pl",
    guildSlug: "hyperland",
    eventSlug: SLUG,
  });

  assert.equal(l.event, `https://pickembot.pl/events/${SLUG}`);
  assert.equal(l.leaderboard, `https://pickembot.pl/events/${SLUG}/leaderboard`);
  assert.equal(l.myStats, `https://pickembot.pl/events/${SLUG}/my-stats`);
  assert.equal(l.server, "https://pickembot.pl/servers/hyperland");
  assert.equal(l.upsets, "https://pickembot.pl/upsets");
});

test("ogonek ukosnikow w adresie nie daje podwojnego ukosnika", () => {
  const l = siteLinks({ baseUrl: "https://pickembot.pl///", eventSlug: "x" });

  assert.equal(l.event, "https://pickembot.pl/events/x");
});

// ------------------------------------------------------------ czolowka

test("czolowka idzie z API i ZACHOWUJE jego kolejnosc przy remisie", async () => {
  // Sedno calego rozwiazania. Gawdo i KS maja po 156 punktow; serwis stawia
  // Gawdo wyzej przez correct_winners, ktorego bot nie zna. Gdyby ten modul
  // sortowal cokolwiek sam, kolejnosc by sie rozjechala.
  const impl = fakeFetch(ODPOWIEDZ_API);

  const wynik = await fetchTournamentStandings({
    apiBaseUrl: "https://api.pickembot.pl",
    eventSlug: SLUG,
    fetchImpl: impl,
  });

  assert.deepEqual(
    wynik.podium.map((p) => p.name),
    ["Gawdo", "KS", "brtks"],
  );

  assert.equal(wynik.podium[0].points, wynik.podium[1].points);
  assert.equal(wynik.podium[0].rank, 1);
  assert.equal(wynik.podium[1].rank, 2);

  assert.equal(wynik.players, 262);
  assert.equal(wynik.matches, 50);

  assert.match(impl.wywolania[0].url, /\/api\/events\/iem-krakow-2026\/leaderboard$/);
});

test("czolowka to pierwsze TRZY wiersze, nie cala tabela", async () => {
  const wynik = await fetchTournamentStandings({
    apiBaseUrl: "https://api.pickembot.pl",
    eventSlug: SLUG,
    fetchImpl: fakeFetch(ODPOWIEDZ_API),
  });

  assert.equal(wynik.podium.length, 3);
});

test("blad API daje null, a nie wyjatek", async () => {
  const padajacy = async () => {
    throw new Error("ECONNREFUSED");
  };

  assert.equal(
    await fetchTournamentStandings({
      apiBaseUrl: "https://api.pickembot.pl",
      eventSlug: SLUG,
      fetchImpl: padajacy,
    }),
    null,
  );

  assert.equal(
    await fetchTournamentStandings({
      apiBaseUrl: "https://api.pickembot.pl",
      eventSlug: SLUG,
      fetchImpl: fakeFetch(null, { ok: false, status: 500 }),
    }),
    null,
  );
});

test("brak adresu API daje null bez sieciowej proby", async () => {
  const impl = fakeFetch(ODPOWIEDZ_API);

  assert.equal(
    await fetchTournamentStandings({ eventSlug: SLUG, fetchImpl: impl }),
    null,
  );

  assert.equal(impl.wywolania.length, 0);
});

// -------------------------------------------------------------- wiadomosc

test("wiadomosc niesie podium, stawke i linki", () => {
  const embed = buildTournamentRecapEmbed({
    eventName: "IEM Krakow 2026",
    standings: {
      players: 262,
      matches: 50,
      podium: ODPOWIEDZ_API.leaderboard.slice(0, 3).map((r) => ({
        rank: r.rank,
        name: r.displayname,
        userId: r.user_id,
        points: r.total_points,
      })),
    },
    links: siteLinks({ baseUrl: "https://pickembot.pl", eventSlug: SLUG }),
  });

  const json = embed.toJSON();

  // Gracze przez wzmianke - Discord zamieni to na aktualny nick.
  assert.match(json.description, /<@349640582550913024>/);
  assert.match(json.description, /156/);

  const pola = JSON.stringify(json.fields);

  assert.match(pola, /262/);
  assert.match(pola, /leaderboard/);
  assert.match(pola, /my-stats/);
});

test("bez linkow wiadomosc nadal ma sens i mowi, czego brak", () => {
  const embed = buildTournamentRecapEmbed({
    eventName: "Turniej",
    standings: { players: 10, matches: 5, podium: [{ rank: 1, name: "A", userId: "1", points: 3 }] },
    links: null,
  });

  const json = embed.toJSON();

  assert.match(json.description, /<@1>/);
  assert.match(json.footer.text, /PUBLIC_SITE_URL/);
});

// ------------------------------------------------------------- wysylanie

const BAZOWE = {
  guildId: GILDIA,
  eventId: EVENT_ID,
  eventName: "IEM Krakow 2026",
  eventSlug: SLUG,
};

test("wysyla na PICKEM_CHANNEL_ID, gdy jest ustawiony", async () => {
  const channel = fakeChannel();
  const client = fakeClient(channel);
  const pool = fakePool();

  const wynik = await maybePostTournamentRecap({
    ...BAZOWE,
    client,
    pool,
    config: {
      PICKEM_CHANNEL_ID: "555",
      PUBLIC_API_URL: "https://api.pickembot.pl",
      PUBLIC_SITE_URL: "https://pickembot.pl",
      GUILD_SLUG: "hyperland",
    },
    fetchImpl: fakeFetch(ODPOWIEDZ_API),
  });

  assert.equal(wynik.posted, true);
  assert.equal(wynik.channelId, "555");
  assert.equal(channel.wyslane.length, 1);

  // Kanal z configu wystarczy - nie ma po co pytac bazy o panele.
  assert.equal(pool.zapytania.length, 0);
});

test("bez PICKEM_CHANNEL_ID idzie na kanal paneli meczowych", async () => {
  // Dwa z czterech serwerow nie maja tego klucza, a panele meczowe zawsze
  // gdzies poszly - to kanal, ktory gracze na pewno widza.
  const channel = fakeChannel();
  const client = fakeClient(channel);
  const pool = fakePool({ panelChannelId: "777" });

  const wynik = await maybePostTournamentRecap({
    ...BAZOWE,
    client,
    pool,
    config: { PUBLIC_API_URL: "https://api.pickembot.pl" },
    fetchImpl: fakeFetch(ODPOWIEDZ_API),
  });

  assert.equal(wynik.posted, true);
  assert.equal(wynik.channelId, "777");
  assert.equal(client.pytane[0], "777");
});

test("kanal archiwum NIE jest zapasem", async () => {
  // Kanal archiwum nalezy do organizatora; podsumowanie dla graczy nie ma
  // tam czego robic. Lepiej nie wyslac nic niz wyslac w zle miejsce.
  const channel = fakeChannel();
  const client = fakeClient(channel);

  const wynik = await maybePostTournamentRecap({
    ...BAZOWE,
    client,
    pool: fakePool(),
    config: {
      ARCHIVE_CHANNEL_ID: "999",
      PUBLIC_API_URL: "https://api.pickembot.pl",
    },
    fetchImpl: fakeFetch(ODPOWIEDZ_API),
  });

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "no_channel");
  assert.equal(channel.wyslane.length, 0);
});

test("turniej, w ktorym nikt nie zdobyl punktu, nie dostaje wiadomosci", async () => {
  const channel = fakeChannel();

  const wynik = await maybePostTournamentRecap({
    ...BAZOWE,
    client: fakeClient(channel),
    pool: fakePool({ panelChannelId: "777" }),
    config: { PUBLIC_API_URL: "https://api.pickembot.pl" },
    fetchImpl: fakeFetch({ uczestnicy: 0, meczow: 0, leaderboard: [] }),
  });

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "nobody_scored");
  assert.equal(channel.wyslane.length, 0);
});

test("niedostepne API nie wysyla nic i NIE rzuca", async () => {
  const wynik = await maybePostTournamentRecap({
    ...BAZOWE,
    client: fakeClient(fakeChannel()),
    pool: fakePool({ panelChannelId: "777" }),
    config: { PUBLIC_API_URL: "https://api.pickembot.pl" },
    fetchImpl: async () => {
      throw new Error("ETIMEDOUT");
    },
  });

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "no_standings");
});

test("kanal z innego serwera jest odrzucany", async () => {
  const channel = fakeChannel();

  channel.guildId = "999999999999999999";

  const wynik = await maybePostTournamentRecap({
    ...BAZOWE,
    client: fakeClient(channel),
    pool: fakePool(),
    config: {
      PICKEM_CHANNEL_ID: "555",
      PUBLIC_API_URL: "https://api.pickembot.pl",
    },
    fetchImpl: fakeFetch(ODPOWIEDZ_API),
  });

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "channel_other_guild");
  assert.equal(channel.wyslane.length, 0);
});

test("nieosiagalny kanal nie wysyla nic i NIE rzuca", async () => {
  const wynik = await maybePostTournamentRecap({
    ...BAZOWE,
    client: fakeClient(null),
    pool: fakePool(),
    config: {
      PICKEM_CHANNEL_ID: "555",
      PUBLIC_API_URL: "https://api.pickembot.pl",
    },
    fetchImpl: fakeFetch(ODPOWIEDZ_API),
  });

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "channel_unavailable");
});

test("brak wymaganych argumentow nie rzuca", async () => {
  const wynik = await maybePostTournamentRecap({ client: null, pool: null });

  assert.equal(wynik.posted, false);
  assert.equal(wynik.reason, "missing_arguments");
});
