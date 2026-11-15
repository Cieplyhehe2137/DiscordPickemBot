// Roster TURNIEJU po stronie panelu: odczyt listy uczestnikow i jej zapis.
//
// PO CO. Etapy 1-3 przestawily CALA sciezke wyboru druzyn - cztery formularze
// faz na stronie i pietnascie wywolan w handlerach bota - z pytania "ktore
// druzyny sa aktywne na serwerze" na "ktore druzyny biora udzial w TYM
// turnieju" (utils/loadEventTeams.js). Zrobily to tak, zeby nic sie nie
// zmienilo: dopoki turniej nie ma ani jednego wiersza w `event_teams`, odczyt
// schodzi na roster serwera i oddaje dokladnie to, co oddawal wczesniej.
//
// I na tym stalo, bo NIC NIE ZAPISYWALO DO event_teams. Cala tabela byla do
// tej pory tylko do czytania - ani jednego INSERT-a w repo. Te dwie trasy sa
// pierwszym i jedynym sposobem, zeby roster turnieju w ogole powstal.
//
// DWIE TRASY, nie jedna z trybami: odczyt podaje panelowi material do
// zaznaczenia (co jest w rosterze, co wynika z meczow), zapis podmienia cala
// liste. Zapis jest PODMIANA, a nie dokladaniem - panel zawsze wysyla pelny
// stan zaznaczenia, wiec rozniczka byla by tu dodatkowym stanem do pomylenia.
//
// PUSTA LISTA KASUJE ROSTER, czyli wraca na zapas. Nie da sie tego rozdzielic
// i nie ma sensu udawac, ze da: odczyt rozpoznaje "turniej ma wlasny roster"
// po tym, ze ma wiersze, wiec roster z zerem druzyn i brak rostera sa tym
// samym stanem bazy. Panel pyta o potwierdzenie i mowi wprost, co z tego
// wyjdzie.
//
// BRAK TABELI NIE JEST AWARIA. Migracja 0014 moze jeszcze nie pojsc - caly
// etap 1 byl zbudowany tak, zeby kolejnosc wdrozenia kodu i migracji byla
// dowolna. Odczyt oddaje wtedy `tableMissing: true` i panel pokazuje, co
// uruchomic, a zapis odmawia osobnym kodem zamiast udawac blad bazy.

import { teamKey } from "../lib/teamLogos.js";

// Gorna granica jednego zapisu. Turniej ma najwyzej kilkadziesiat druzyn
// (IEM Cologne: 24), wiec ta liczba nie ogranicza nikogo poza petla zapytan.
const LIMIT_ROSTERA = 200;

/** Czy ten blad to "migracja 0014 jeszcze nie poszla". */
function brakTabeli(err) {
  return err?.code === "ER_NO_SUCH_TABLE";
}

/**
 * Nazwy druzyn wystepujace w meczach turnieju.
 *
 * To samo zapytanie co zapas zamknietej fazy w server/lib/phaseFormTeams.js -
 * i z tego samego powodu: dla turnieju, ktory sie odbyl, mecze sa jedynym
 * miejscem, gdzie prawdziwa lista uczestnikow przetrwala. Na produkcji
 * zakonczony IEM Krakow 2026 mial w rosterze serwera dziesiec nazw w rodzaju
 * "DFGDFGDFGS" i ani jednej ze swoich dwudziestu czterech druzyn.
 *
 * Panel wystawia to jako skrot "wez druzyny z meczow" - bez niego wskazanie
 * rostera dla kilkunastu archiwalnych turniejow to recznie przeklikana lista
 * po kazdym z nich.
 */
async function nazwyZMeczow(pool, eventId) {
  const [wiersze] = await pool.query(
    `
    -- Bez sprawdzania NULL-a: obie kolumny sa NOT NULL w schemacie.
    -- Pusty napis NOT NULL przepuszcza, wiec odsiewamy tylko jego.
    -- UNION (a nie UNION ALL) sam usuwa powtorzenia - kazda druzyna gra
    -- w turnieju wiele razy i raz po jednej, raz po drugiej stronie.
    SELECT team_a AS name
    FROM matches
    WHERE event_id = ?
      AND team_a <> ''

    UNION

    SELECT team_b AS name
    FROM matches
    WHERE event_id = ?
      AND team_b <> ''

    ORDER BY name ASC
    `,
    [eventId, eventId],
  );

  return wiersze.map((wiersz) => wiersz.name).filter(Boolean);
}

export function registerEventTeamsRoutes(
  app,
  { guildIdFromEventSlug, logInfo, pool, requireGuildAdmin, runInTransaction },
) {
  // Material dla panelu: roster turnieju, slownik serwera i to, co wynika
  // z meczow. Jedno zadanie, bo te trzy rzeczy sa czytane razem i osobno nie
  // znacza nic - zaznaczenie trzeba porownac ze slownikiem, a skrot z meczow
  // dopiero po przelozeniu nazw na identyfikatory.
  app.get(
    "/api/events/:slug/teams",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        // Slownik serwera w calosci, razem z wylaczonymi. Panel musi pokazac
        // takze druzyne `active = 0`, bo wlasnie po to ten roster powstal:
        // wylaczenie druzyny po turnieju nie moze jej usuwac z turnieju,
        // w ktorym zagrala.
        const [druzyny] = await pool.query(
          `
          -- sort_order NIE wychodzi w odpowiedzi, tylko ustala KOLEJNOSC
          -- tablicy: panel odsyla zaznaczone druzyny w tej samej kolejnosci,
          -- a serwer zapisuje ja jako rozstawienie turnieju.
          SELECT id, name, active
          FROM teams
          WHERE guild_id = ?
          ORDER BY sort_order ASC, name ASC
          `,
          [guildId],
        );

        let roster = [];
        let tableMissing = false;

        try {
          const [wiersze] = await pool.query(
            `
            SELECT et.team_id AS id
            FROM event_teams et
            JOIN teams t
              ON t.id = et.team_id
            WHERE et.event_id = ?
              AND t.guild_id = ?
            ORDER BY et.sort_order ASC, t.name ASC
            `,
            [event.id, guildId],
          );

          roster = wiersze.map((wiersz) => Number(wiersz.id));
        } catch (err) {
          if (!brakTabeli(err)) throw err;

          tableMissing = true;
        }

        // Nazwy z meczow przelozone na identyfikatory ze slownika. Mecze
        // trzymaja NAZWY tekstowe, a roster identyfikatory, wiec bez tego
        // przelozenia skrot nie mialby czego zaznaczyc.
        //
        // PRZEZ teamKey, NIE PRZEZ ROWNOSC NAPISOW. Ta sama druzyna stoi
        // w bazie pod kilkoma nazwami - sprawdzone na calej bazie: 48 nazw,
        // 37 druzyn (server/lib/teamLogos.js). Porownanie doslowne pomijalo
        // z tego powodu druzyny, ktore STRONA liczy jako jedna: mecze IEM
        // Cologne maja "BetBoom", a slownik "BETBOOM"; mecze maja "NAVI",
        // a slownik "Natus Vincere". teamKey scala jedno i drugie, czyli
        // skrot zaznacza dokladnie to, co widok uznaje za te sama druzyne.
        //
        // Aliasy Z BAZY (teams.external_name) swiadomie NIE wchodza: sluza
        // dopasowaniu nazw DOSTAWCY wynikow (utils/matchProposals.js), a nie
        // scalaniu nazw w naszych meczach. Dolozenie ich tutaj zaznaczaloby
        // druzyny, ktore strona nadal pokazuje jako dwie osobne.
        const nazwy = await nazwyZMeczow(pool, event.id);
        const poKluczu = new Map();

        for (const d of druzyny) {
          const klucz = teamKey(d.name);

          // Pierwsze wystapienie wygrywa, czyli to z mniejszym sort_order.
          // Dwa wiersze o jednym kluczu to ta sama organizacja wpisana dwa
          // razy ("FaZe" i "FaZe Clan") - ktorykolwiek z nich wskazuje ta
          // sama druzyne, ale wybor musi byc powtarzalny.
          if (klucz && !poKluczu.has(klucz)) poKluczu.set(klucz, Number(d.id));
        }

        const matchTeamIds = [];
        const unknownMatchNames = [];

        for (const nazwa of nazwy) {
          const id = poKluczu.get(teamKey(nazwa));

          // Nazwa z meczu bez wiersza w slowniku to NIE blad danych: mecze
          // wpisuje sie tekstem i tak powstal niejeden archiwalny turniej.
          // Panel wymienia te nazwy, bo roster da sie zlozyc tylko z druzyn,
          // ktore w slowniku sa - a admin musi wiedziec, czego zabraklo.
          if (id === undefined) {
            unknownMatchNames.push(nazwa);
            continue;
          }

          // Bez powtorzen: dwie nazwy moga wskazywac JEDNA druzyne slownika
          // ("NAVI" i "Natus Vincere" w meczach tego samego turnieju), a
          // zapis rostera odrzuca powtorzone identyfikatory bledem 400.
          if (!matchTeamIds.includes(id)) matchTeamIds.push(id);
        }

        res.json({
          hasRoster: roster.length > 0,
          teamIds: roster,
          teams: druzyny.map((d) => ({
            id: Number(d.id),
            name: d.name,
            active: Number(d.active) === 1,
          })),
          matchTeamIds,
          unknownMatchNames,
          tableMissing,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );

  // Podmiana rostera. PUT, nie POST: pod tym adresem lezy jeden zasob
  // i zadanie podaje jego pelna nowa tresc - tak samo jak
  // PUT /api/events/:slug/pickem-config.
  app.put(
    "/api/events/:slug/teams",
    requireGuildAdmin(guildIdFromEventSlug),
    async (req, res) => {
      try {
        const { slug } = req.params;
        const { guildId } = req;
        const { teamIds } = req.body ?? {};

        if (!Array.isArray(teamIds)) {
          return res.status(400).json({
            error: "teamIds musi być tablicą identyfikatorów.",
            code: "server.teamIdsArray",
          });
        }

        if (teamIds.length > LIMIT_ROSTERA) {
          return res.status(400).json({
            error: `Roster turnieju może mieć najwyżej ${LIMIT_ROSTERA} drużyn.`,
            code: "server.rosterTooBig",
            limit: LIMIT_ROSTERA,
          });
        }

        // Powtorzenia odsiewamy, ZACHOWUJAC pierwsze wystapienie - kolejnosc
        // tablicy jest rozstawieniem turnieju, patrz nizej.
        const identyfikatory = [
          ...new Set(
            teamIds.map(Number).filter((n) => Number.isInteger(n) && n > 0),
          ),
        ];

        if (identyfikatory.length !== teamIds.length) {
          // Cicha korekta byla by tu najgorszym wyjsciem: admin zapisuje
          // dwadziescia cztery druzyny, dostaje 200 i nie wie, ze w rosterze
          // stoi dziewietnascie.
          return res.status(400).json({
            error:
              "Lista drużyn zawiera powtórzenia albo niepoprawne identyfikatory.",
            code: "server.rosterInvalidIds",
          });
        }

        const [[event]] = await pool.query(
          "SELECT id FROM events WHERE guild_id = ? AND slug = ? LIMIT 1",
          [guildId, slug],
        );

        if (!event) {
          return res.status(404).json({
            error: "Nie znaleziono turnieju.",
            code: "server.eventNotFound",
          });
        }

        // Kazdy identyfikator musi byc druzyna TEGO serwera. Bez tej kontroli
        // wystarczyloby znac numer, zeby wciagnac do wlasnego turnieju
        // druzyne z cudzego serwera - odczyt rostera filtruje po guild_id
        // i taki wiersz byl by niewidoczny, czyli nie dalby sie odznaczyc.
        if (identyfikatory.length) {
          const [znalezione] = await pool.query(
            `SELECT id FROM teams WHERE guild_id = ? AND id IN (?)`,
            [guildId, identyfikatory],
          );

          const sa = new Set(znalezione.map((w) => Number(w.id)));
          const obce = identyfikatory.filter((id) => !sa.has(id));

          if (obce.length) {
            return res.status(400).json({
              error: `Te drużyny nie należą do tego serwera: ${obce.join(", ")}.`,
              code: "server.rosterForeignTeams",
              teams: obce.join(", "),
            });
          }
        }

        // Turniej zakonczony tez wolno opisac i jest to zamierzone: etap 5
        // ma wskazac rostery turniejom, ktore juz sie odbyly, a formularz
        // zamknietej fazy czyta wtedy wlasnie te liste.
        try {
          await runInTransaction(pool, async (conn) => {
            await conn.query(`DELETE FROM event_teams WHERE event_id = ?`, [
              event.id,
            ]);

            if (identyfikatory.length) {
              // sort_order = POZYCJA w otrzymanej tablicy, czyli rozstawienie
              // turnieju. Panel wysyla druzyny w kolejnosci slownika serwera
              // (sort_order, potem nazwa), a odczyt `order: "sort_order"`
              // sortuje po et.sort_order - dzieki czemu wskazanie rostera
              // "wszystkie aktywne druzyny" daje te same listy, co zapas,
              // i nikomu nie przestawia czterech dropdownow admina.
              const wartosci = identyfikatory.map((id, index) => [
                event.id,
                id,
                index + 1,
              ]);

              await conn.query(
                `INSERT INTO event_teams (event_id, team_id, sort_order)
                 VALUES ?`,
                [wartosci],
              );
            }
          });
        } catch (err) {
          if (!brakTabeli(err)) throw err;

          return res.status(503).json({
            error:
              "Tabela event_teams nie istnieje - uruchom migrację 0014_event_teams.sql.",
            code: "server.eventTeamsTableMissing",
          });
        }

        logInfo("teams", "Roster turnieju zapisany", {
          guildId,
          slug,
          eventId: event.id,
          count: identyfikatory.length,
        });

        res.json({
          ok: true,
          saved: identyfikatory.length,

          // Zerowa lista nie jest "zapisanym pustym rosterem" - jest
          // powrotem na roster serwera. Panel mowi to innym zdaniem.
          cleared: identyfikatory.length === 0,
        });
      } catch (err) {
        console.error(err);

        res.status(500).json({
          error: "Błąd bazy danych.",
          code: "server.dbError",
        });
      }
    },
  );
}
