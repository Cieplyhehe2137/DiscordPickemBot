// Zapytania o uczestnikow eventu: ilu ich jest i jak sie nazywaja.
//
// Wyladowaly w lib/, bo przy rozbijaniu app.js okazalo sie, ze sa uzywane po
// obu stronach podzialu - i w trasach eventu, i w profilu gracza.
//
// Oba zapytania robia CAST(... AS CHAR CHARACTER SET utf8mb4) COLLATE ... w
// KAZDEJ galezi UNION. To nie jest ozdoba: user_id ma rozne kolacje w roznych
// tabelach (utf8mb4_0900_ai_ci w leaderboard, utf8mb4_unicode_ci w tabelach
// faz) i bez wyrownania MySQL wywala ER_CANT_AGGREGATE_NCOLLATIONS.
//
// Aliasy SQL zostawione po polsku - to jezyk zapytania, a nie nazewnictwo kodu,
// i ich zmiana byla by ryzykiem bez zysku.

export function createParticipantQueries(pool) {
  // w roznych tabelach i inaczej leci ER_CANT_AGGREGATE_NCOLLATIONS.
  //
  // Nazwa gracza zapamietana przy typowaniu.
  //
  // user_profiles ma row tylko dla osob, ktore logowaly sie na stronie.
  // Kto typowal wylacznie z Discorda, tam go nie ma - i bez tego zapasu
  // zamiast nicku wychodzi surowe user_id. Tabele faz zapisuja nazwe razem
  // z typem i przezywaja archiwizacje turnieju.
  //
  // Tu chodzi o jednego gracza, wiec kazda galaz ma LIMIT 1 - w rankingu
  // to samo robi zlaczenie po calej liscie.
  async function findNameFromPicks(eventId, userId) {
    const TABLES = [
      "swiss_predictions",
      "swiss_scores",
      "playoffs_predictions",
      "playoffs_scores",
      "playin_predictions",
      "playin_scores",
      "doubleelim_predictions",
      "doubleelim_scores",
    ];

    // Kazda galaz w nawiasach - bez nich MySQL nie przyjmuje LIMIT wewnatrz
    // skladnika UNION i wywala blad skladni.
    const branches = TABLES.map(
      (table) => `
        (SELECT CAST(COALESCE(displayname, username) AS CHAR CHARACTER SET utf8mb4)
                  COLLATE utf8mb4_unicode_ci AS nazwa
           FROM \`${table}\`
          WHERE event_id = ?
            AND CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci = ?
            AND COALESCE(displayname, username) IS NOT NULL
          LIMIT 1)`,
    ).join(" UNION ALL ");

    const params = [];

    for (const _ of TABLES) params.push(eventId, String(userId));

    const [rows] = await pool.query(
      `SELECT nazwa FROM ( ${branches} ) zrodla WHERE nazwa IS NOT NULL LIMIT 1`,
      params,
    );

    return rows[0]?.nazwa || null;
  }

  /**
   * Liczba typujacych w turnieju.
   *
   * Przyjmuje ALBO identyfikator, ALBO { slug }. Druga postac istnieje po to,
   * zeby dalo sie wywolac te funkcje, zanim ktokolwiek zna event.id - czyli
   * zeby wolajacy nie musial placic osobnej podrozy do bazy tylko za zamiane
   * sluga na identyfikator. Zmierzone na serwerze: jedna podroz to 177 ms,
   * bez rozrzutu, a podzapytanie po slugu kosztuje tyle co nic.
   *
   * Warunek wstawiany jest do SQL-a jako STALA z dwóch mozliwych, nigdy jako
   * dane - sam slug zawsze idzie parametrem.
   */
  async function countParticipants(wejscie) {
    const poSlugu =
      wejscie !== null && typeof wejscie === "object" && "slug" in wejscie;

    const warunek = poSlugu
      ? "(SELECT id FROM events WHERE slug = ? LIMIT 1)"
      : "?";

    const wartosc = poSlugu ? wejscie.slug : wejscie;

    const [[row]] = await pool.query(
      `
      SELECT COUNT(DISTINCT user_id) AS uczestnicy
      FROM (
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS user_id
          FROM match_predictions WHERE event_id = ${warunek}
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM swiss_predictions WHERE event_id = ${warunek}
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playoffs_predictions WHERE event_id = ${warunek}
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM playin_predictions WHERE event_id = ${warunek}
        UNION
        SELECT CAST(user_id AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
          FROM doubleelim_predictions WHERE event_id = ${warunek}
      ) typujacy
      `,
      [wartosc, wartosc, wartosc, wartosc, wartosc],
    );

    return Number(row?.uczestnicy || 0);
  }

  // Nazwa gracza do pokazania, z pelnym lancuchem zapasow.
  //
  // Wiersz przychodzi z zapytania, ktore wzielo nazwe z user_profiles - a ta
  // tabela ma wpis WYLACZNIE dla osob logujacych sie na stronie. Kto typuje
  // z Discorda, tam go nie ma: na IEM Cologne 2026 dotyczylo to 521 z 523
  // graczy, wiec kafelki "Najlepszy wynik", "Najwiecej exactow" i "Najlepsza
  // skutecznosc" pokazywaly surowy identyfikator Discorda.
  //
  // Ten sam gracz mial przez to dwie nazwy na JEDNEJ stronie: ranking
  // pokazywal "pieka" (bo siega do tabel typow), a kafelek obok
  // "1216263156742094870".
  //
  // Kolejnosc: profil ze strony jest najswiezszy, bo aktualizuje sie przy
  // kazdym logowaniu. Nazwa z typow pochodzi z chwili oddania typu, ale
  // istnieje dla kazdego, kto cokolwiek wytypowal. Identyfikator zostaje jako
  // ostatnia deska ratunku i znaczy tyle, ze gracza nie ma juz w zadnych
  // danych tego turnieju.
  async function resolveDisplayName(eventId, row) {
    if (!row) return null;

    if (row.displayname) return row.displayname;

    const zTypow = await findNameFromPicks(eventId, row.user_id);

    return zTypow || String(row.user_id ?? "");
  }

  return { findNameFromPicks, countParticipants, resolveDisplayName };
}
