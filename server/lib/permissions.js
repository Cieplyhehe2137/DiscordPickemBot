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

export function hasAdminPermission(user, guildId) {
  if (!user || !guildId) return false;

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
export function requireGuildAdmin(resolveGuildId) {
  return async (req, res, next) => {
    const user = req.session?.user;

    if (!user) {
      return res.status(401).json({ error: "Musisz być zalogowany." });
    }

    try {
      const guildId = await resolveGuildId(req);

      if (!guildId) {
        return res.status(404).json({ error: "Nie znaleziono." });
      }

      if (!hasAdminPermission(user, guildId)) {
        return res
          .status(403)
          .json({ error: "Wymagane uprawnienia administratora na tym serwerze." });
      }

      req.guildId = String(guildId);
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Nie udało się zweryfikować uprawnień." });
    }
  };
}
