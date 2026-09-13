// Uzupełnienie `user_profiles` o graczy, którzy nigdy nie weszli na stronę.
//
// Nick i awatar trafiają do tej tabeli w dwóch momentach: przy logowaniu przez
// stronę (server/routes/auth.js) i przy każdej interakcji z botem
// (utils/rememberUser.js). To drugie powstało niedawno, a turnieje, które już
// się skończyły, nie dostaną nowych interakcji - ich uczestnicy nie klikną
// więcej w tamte panele.
//
// Efekt na produkcji: 1108 z 1110 graczy we wszystkich rankingach nie ma
// wiersza w user_profiles. Nazwę da się jeszcze odzyskać z tabel typów
// (server/lib/participants.js zapisuje ją razem z typem), ale awatara nie
// zapisywał nigdy nikt - jedynym źródłem jest Discord.
//
// Stąd ten moduł: przechodzi po graczach z rankingu i dopytuje Discorda o
// każdego po identyfikatorze. Bot może to zrobić, bo ma klienta Discorda;
// API nie może i nigdy nie będzie mogło - nie ma tokenu bota i mieć go nie
// powinno.
//
// Pobieranie przychodzi argumentem (`fetchUser`), a nie przez import klienta.
// Dzięki temu całość da się przetestować bez sieci i bez Discorda, a to jest
// kod, który robi tysiąc zapytań do cudzego serwisu - lepiej wiedzieć, że
// zachowuje się jak trzeba, zanim się go uruchomi.

// Discord nie podaje twardego limitu dla /users/{id}, więc odstęp jest
// ostrożny, a nie wyliczony. 200 ms to pięć zapytań na sekundę - przy 1100
// graczach niecałe cztery minuty, a ryzyko trafienia w limit żadne.
const ODSTEP_MS = 200;

// Po ilu dniach wolno dopytać Discorda o profil, który już istnieje, ale nie
// ma awatara.
//
// Bez tej granicy warunek "brak awatara" wybierał w kółko te same konta: 61
// graczy po prostu nie ma własnego obrazka, Discord zwraca dla nich null
// i żadne kolejne uruchomienie tego nie zmieni. Komenda nigdy nie mówiła
// "wszyscy gotowi", tylko za każdym razem raportowała kilkadziesiąt
// sprawdzonych i zero zapisanych.
//
// Sam warunek na awatar jest potrzebny - wiersz mógł powstać, zanim awatary
// w ogóle były zapisywane. Chodzi tylko o to, żeby nie pytać o to samo
// codziennie. Trzydzieści dni to kompromis: konto bez obrazka sprawdzimy
// ponownie raz na miesiąc, na wypadek gdyby ktoś sobie awatar ustawił.
const ODSWIEZ_PO_DNIACH = 30;

// Ile graczy na jedno uruchomienie. Token odpowiedzi na interakcję Discorda
// żyje 15 minut, więc jedno wywołanie nie może chodzić dowolnie długo.
// Kolejne uruchomienie samo weźmie tych, których zabrakło - zapytanie pobiera
// wyłącznie brakujących, więc wznawianie jest darmowe i nie wymaga stanu.
const DOMYSLNY_LIMIT = 400;

async function uspij(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Kogo trzeba dopytać: gracz z rankingu tej gildii, który nie ma wiersza
// w user_profiles, albo ma go bez awatara i nie był sprawdzany od dawna.
//
// Brak wiersza to zawsze powód do zapytania. Brak awatara - tylko wtedy, gdy
// profil jest starszy niż ODSWIEZ_PO_DNIACH, bo inaczej konta bez własnego
// obrazka wracałyby przy każdym uruchomieniu w nieskończoność.
async function znajdzBrakujacych(
  pool,
  guildId,
  limit,
  odswiezPoDniach = ODSWIEZ_PO_DNIACH,
) {
  const [rows] = await pool.query(
    `
    SELECT DISTINCT lb.user_id
    FROM leaderboard lb
    LEFT JOIN user_profiles up
      ON up.user_id = lb.user_id
    WHERE lb.guild_id = ?
      AND (
        up.user_id IS NULL
        OR (
          up.avatar IS NULL
          AND up.updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
        )
      )
    ORDER BY lb.user_id
    LIMIT ?
    `,
    [guildId, odswiezPoDniach, limit],
  );

  return rows.map((r) => String(r.user_id));
}

async function zapiszProfil(pool, uzytkownik) {
  // username jest NOT NULL, a globalName bywa puste dla starych kont -
  // ta sama zasada co w utils/rememberUser.js.
  const username =
    uzytkownik.username || uzytkownik.tag || String(uzytkownik.id);

  const displayname =
    uzytkownik.globalName || uzytkownik.displayName || username;

  await pool.query(
    `
    INSERT INTO user_profiles (user_id, username, displayname, avatar)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      username = VALUES(username),
      displayname = VALUES(displayname),
      avatar = VALUES(avatar),
      updated_at = CURRENT_TIMESTAMP
    `,
    [String(uzytkownik.id), username, displayname, uzytkownik.avatar ?? null],
  );
}

/**
 * Uzupełnia profile graczy jednej gildii.
 *
 * Nie rzuca przy pojedynczym błędzie - konto mogło zostać skasowane i to jest
 * normalny wynik, a nie awaria. Przerwanie całości po jednym takim graczu
 * oznaczałoby, że im dłuższa lista, tym mniejsza szansa, że się skończy.
 */
async function backfillProfiles({
  pool,
  guildId,
  fetchUser,
  limit = DOMYSLNY_LIMIT,
  delayMs = ODSTEP_MS,
  odswiezPoDniach = ODSWIEZ_PO_DNIACH,
  onProgress = null,
  sleep = uspij,
}) {
  const identyfikatory = await znajdzBrakujacych(
    pool,
    guildId,
    limit,
    odswiezPoDniach,
  );

  const wynik = {
    sprawdzonych: identyfikatory.length,
    zapisanych: 0,
    nieznanych: 0,
    bledow: 0,
  };

  for (let i = 0; i < identyfikatory.length; i += 1) {
    const userId = identyfikatory[i];

    // Odstęp PRZED każdym zapytaniem poza pierwszym - po ostatnim czekanie
    // nie ma już czego chronić i tylko przedłuża odpowiedź dla admina.
    if (i > 0 && delayMs > 0) await sleep(delayMs);

    try {
      const uzytkownik = await fetchUser(userId);

      if (!uzytkownik) {
        wynik.nieznanych += 1;
      } else {
        await zapiszProfil(pool, uzytkownik);
        wynik.zapisanych += 1;
      }
    } catch (err) {
      // 10013 to "Unknown User" - konto skasowane. Osobno od awarii, bo to
      // stan trwały: kolejne uruchomienie będzie o niego pytać w nieskończoność
      // i warto, żeby raport to rozróżniał.
      if (err?.code === 10013) wynik.nieznanych += 1;
      else wynik.bledow += 1;
    }

    if (onProgress) await onProgress({ ...wynik, przetworzonych: i + 1 });
  }

  return wynik;
}

module.exports = {
  backfillProfiles,
  znajdzBrakujacych,
  DOMYSLNY_LIMIT,
  ODSTEP_MS,
  ODSWIEZ_PO_DNIACH,
};
