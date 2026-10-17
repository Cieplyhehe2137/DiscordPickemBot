// Kto moze administrowac ktorym serwerem Discorda.
//
// To jest bramka przed 38 trasami zapisujacymi w API - wszystkim poza
// wylogowaniem i piatka endpointow, ktorymi gracz zapisuje wlasne typy.
// Siedziala w srodku app.js bez ani jednego testu.
//
// Modul nie ma zaleznosci (requireGuildAdmin dostaje gotowy resolver i dziala
// na zwyklym req/res), wiec da sie go testowac bez uruchamiania serwera.

// Uprawnienia Discorda to pole bitowe szersze niz 32 bity, wiec porownanie musi
// isc na BigInt. Number odcialby wyzsze bity i uprawnienia zaczelyby klamac.
export const ADMINISTRATOR_PERMISSION = 0x8n;

// ============================================================
// WLASCICIEL BOTA
//
// PO CO. Discord nie daje wlascicielowi aplikacji ZADNYCH uprawnien na
// serwerach, na ktorych bot siedzi - wlasnosc dotyczy aplikacji (token,
// ustawienia OAuth), nie gildii. Bez tego wyjatku wlasciciel bota musi miec
// nadanego ADMINISTRATORA osobno na kazdym obslugiwanym serwerze, zeby
// otworzyc panel WWW tego serwera.
//
// CZYM TO PLACIMY. Jeden wpis BOT_OWNER_ID otwiera wszystkie trasy zapisujace
// na KAZDYM obslugiwanym serwerze - wlacznie z czyszczeniem fazy i pelnym
// resetem. Stad trzy ograniczenia, i kazde z nich jest celowe:
//
//   1. Domyslnie wyjatku NIE MA. Brak BOT_OWNER_ID (albo same spacje) to
//      dokladnie zachowanie sprzed tej zmiany - sama bitmaska. Dzieki temu
//      test porownujacy regule z kopia na froncie dalej przechodzi bez
//      zmian, bo wola te funkcje bez trzeciego argumentu.
//   2. Wyjatek siega TYLKO serwerow, ktore bot faktycznie obsluguje
//      (`isServedGuild`). Czesc tras bierze guild_id wprost z adresu
//      (/api/guilds/:guildId/backups), wiec bez tego zawezenia wlasciciel
//      przechodzilby bramke dla dowolnego ciagu znakow.
//   3. Dotyczy WYLACZNIE uprawnien administratora. `isGuildMember` zostaje
//      nietkniete: ono pilnuje tras, ktorymi GRACZ zapisuje wlasne typy, a
//      wlasciciel bota nie ma czego typowac na serwerze, do ktorego nie
//      nalezy.
// ============================================================

// Porownanie jako tekst, bo id Discorda (snowflake) nie miesci sie w Number.
export function isBotOwner(user, botOwnerId) {
  const ownerId = String(botOwnerId ?? "").trim();

  if (!ownerId) return false;

  const id = String(user?.id ?? "").trim();

  return id !== "" && id === ownerId;
}

// `options` to { botOwnerId, isServedGuild } - oba pola opcjonalne.
function ownerMayAdminister(user, guildId, options) {
  if (!isBotOwner(user, options?.botOwnerId)) return false;

  const isServedGuild = options?.isServedGuild;

  // Brak predykatu znaczy wywolanie bez wiedzy o liscie serwerow (test,
  // narzedzie z linii polecen) - wtedy zgodnosc id wystarcza. app.js podaje
  // go zawsze, wiec w dzialajacym API zawezenie jest na miejscu.
  if (typeof isServedGuild !== "function") return true;

  try {
    return isServedGuild(String(guildId)) === true;
  } catch {
    // Predykat czyta pliki configow. Gdyby rzucil, odmawiamy - wyjatek od
    // reguly nie moze sie opierac na nieznanym stanie.
    return false;
  }
}

export function hasAdminPermission(user, guildId, options) {
  if (!user || !guildId) return false;

  if (ownerMayAdminister(user, guildId, options)) return true;

  const guild = (user.guilds || []).find((g) => g.id === String(guildId));

  if (!guild) return false;

  try {
    return (
      (BigInt(guild.permissions) & ADMINISTRATOR_PERMISSION) ===
      ADMINISTRATOR_PERMISSION
    );
  } catch {
    // Discord potrafi przyslac permissions jako tekst; gdyby kiedys przyslal
    // cos, czego BigInt nie przyjmie, odmawiamy zamiast wywalac zadanie.
    return false;
  }
}

export function isGuildMember(user, guildId) {
  if (!user || !guildId) return false;

  return (user.guilds || []).some((g) => g.id === String(guildId));
}

// resolveGuildId(req) -> guildId | Promise<guildId>. Uruchamiany PO sprawdzeniu
// zalogowania, wiec moze bezpiecznie pytac baze - niezalogowany nie wywola
// zapytania.
//
// `options` ida wprost do hasAdminPermission (patrz blok o wlascicielu bota).
// Przy trasach nie podaje ich nikt z osobna - app.js domyka je raz przy
// starcie i wstrzykuje do modulow tras juz gotowa wersje.
export function requireGuildAdmin(resolveGuildId, options) {
  return async (req, res, next) => {
    const user = req.session?.user;

    if (!user) {
      return res.status(401).json({
        error: "Musisz być zalogowany.",
        code: "server.mustLogin",
      });
    }

    try {
      const guildId = await resolveGuildId(req);

      if (!guildId) {
        return res.status(404).json({
          error: "Nie znaleziono.",
          code: "server.notFound",
        });
      }

      if (!hasAdminPermission(user, guildId, options)) {
        return res
          .status(403)
          .json({
            error: "Wymagane uprawnienia administratora na tym serwerze.",
            code: "server.needAdmin",
          });
      }

      req.guildId = String(guildId);
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Nie udało się zweryfikować uprawnień.",
        code: "server.permissionCheckFailed",
      });
    }
  };
}
