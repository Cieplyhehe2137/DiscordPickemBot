// Uprawnienia administratora po stronie frontu.
//
// Ta sama reguła co w server/index.js (hasAdminPermission): bit ADMINISTRATOR
// z bitmaski uprawnień Discorda. Bitmaska przekracza 32 bity, więc musi być
// porównywana jako BigInt - Number gubiłby starsze bity.
//
// UWAGA: to jest wyłącznie warstwa prezentacji. O tym, czy akcja przejdzie,
// decyduje requireGuildAdmin na serwerze. Tutaj chodzi o to, żeby nie
// pokazywać ludziom paneli, których i tak nie użyją.
//
// Nie ma tu odpowiednika "admin gdziekolwiek". Sama bitmaska nie odróżnia
// serwera obsługiwanego przez bota od dowolnego innego, a Discord daje bit
// ADMINISTRATOR także na prywatnym serwerze założonym przez użytkownika.
// O wejściu do panelu decyduje `canAccessAdmin` z /api/auth/me - tam
// guildRegistry jest pod ręką.

const ADMINISTRATOR = 8n;

function maAdmina(guild) {
  try {
    return (BigInt(guild?.permissions ?? "0") & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}

// Zbiór guild_id, na których użytkownik ma uprawnienia administratora.
export function adminGuildIds(user) {
  return new Set(
    (user?.guilds ?? []).filter(maAdmina).map((guild) => String(guild.id)),
  );
}

// Czy użytkownik jest adminem konkretnego serwera.
export function isAdminOfGuild(user, guildId) {
  if (!guildId) return false;

  return adminGuildIds(user).has(String(guildId));
}
