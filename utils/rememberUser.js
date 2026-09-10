const { withGuild } = require("./guildContext.js");
const { logWarn } = require("./logger");

// Zapamiętuje nick i awatar gracza w user_profiles.
//
// Do tej pory wiersz w tej tabeli powstawał wyłącznie przy logowaniu przez
// stronę, więc mieli go tylko ci, którzy tam weszli - w praktyce kilka osób.
// Wszyscy pozostali typowali z Discorda i strona nie miała skąd wziąć ich
// nazwy ani awatara: ranking zakończonego turnieju pokazywał surowe user_id,
// a awatar nie istniał nigdzie w bazie.
//
// Nazwy dało się odzyskać z tabel faz, bo są zapisywane przy typie. Awatara
// nie zapisywał nikt, więc bez tego zapisu nie ma go skąd wziąć.

// Awatar i nick zmieniają się rzadko, a interakcji bywa dużo. Bez tego
// każde kliknięcie w panelu robiłoby zapis do bazy bez żadnego zysku.
const OSTATNI_ZAPIS = new Map();
const ODSTEP_MS = 60 * 60 * 1000;

function wartoZapisac(userId) {
  const teraz = Date.now();
  const poprzedni = OSTATNI_ZAPIS.get(userId) || 0;

  if (teraz - poprzedni < ODSTEP_MS) return false;

  OSTATNI_ZAPIS.set(userId, teraz);

  return true;
}

/**
 * Zapisuje tożsamość użytkownika interakcji.
 *
 * Nigdy nie rzuca - to zapis poboczny i nie może przewrócić obsługi
 * interakcji, na którą czeka gracz.
 */
async function rememberUser(interaction) {
  try {
    const user = interaction?.user;

    if (!user?.id || !interaction?.guildId) return;
    if (!wartoZapisac(user.id)) return;

    // username jest NOT NULL, a globalName bywa puste dla starych kont.
    const username = user.username || user.tag || String(user.id);
    const displayname = user.globalName || user.displayName || username;

    await withGuild(interaction.guildId, async ({ pool }) => {
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
        [String(user.id), username, displayname, user.avatar ?? null],
      );
    });
  } catch (err) {
    // Zapis tożsamości jest dodatkiem - gracz ma dostać swoją odpowiedź
    // niezależnie od tego, czy się udał.
    logWarn("REMEMBER_USER_FAILED", {
      userId: interaction?.user?.id || null,
      guildId: interaction?.guildId || null,
      extra: { message: err?.message },
    });
  }
}

module.exports = { rememberUser };
