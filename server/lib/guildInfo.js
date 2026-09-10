// Dane gildii pokazywane na stronie: nazwa, slug w URL-u, zaproszenie.
//
// Zrodlem jest config/*.env (GUILD_NAME, GUILD_SLUG, DISCORD_INVITE_URL) - te
// same pliki, z ktorych guildRegistry czyta dostep do bazy.
//
// Wyladowalo w lib/, bo przy rozbijaniu app.js okazalo sie, ze getKnownGuildInfo
// jest uzywane po obu stronach podzialu: w publicznym przegladzie gildii i w
// liscie eventow, ktora zostala w app.js. Zamiast duplikatu - jeden modul.
//
// Fabryka, a nie zwykle funkcje z guildRegistry w argumencie, zeby miejsca
// uzycia wygladaly tak samo jak przed przeniesieniem.

export function createGuildInfo(guildRegistry) {
  // Gildia bez pliku konfiguracyjnego nie powinna sie zdarzyc, ale gdyby -
  // pokazujemy surowe guild_id i brak zaproszenia, zamiast blednych danych
  // albo wywrotki na undefined.
  function getKnownGuildInfo(guildId) {
    const cfg = guildRegistry.getGuildConfig(guildId);

    return {
      slug: cfg?.GUILD_SLUG || guildId,
      name: cfg?.GUILD_NAME || guildId,
      discord_url: cfg?.DISCORD_INVITE_URL || null,
    };
  }

  // Zamienia slug z URL-a (np. "hyperland") z powrotem na guild_id, przegladajac
  // GUILD_SLUG wszystkich znanych gildii. Gdy nic nie pasuje, traktuje slug jak
  // samo guild_id - /public/:guildSlug obsluguje i taka postac, dla gildii bez
  // ustawionego slugu.
  function resolveGuildIdFromSlug(guildSlug) {
    for (const id of guildRegistry.getAllGuildIds()) {
      const cfg = guildRegistry.getGuildConfig(id);
      if (cfg?.GUILD_SLUG === guildSlug) return id;
    }

    return guildSlug;
  }

  return { getKnownGuildInfo, resolveGuildIdFromSlug };
}
