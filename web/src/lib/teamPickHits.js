// Oznaczanie trafień w typach drużyn.
//
// Ta sama logika była wcześniej lokalną funkcją w PhaseResults. Teraz używają
// jej dwa miejsca - strona fazy i profil gracza - a dwie kopie tego samego
// porównania to dwa miejsca, w których trafienie może zacząć znaczyć co innego.

/**
 * Znakuje każdy typ informacją, czy jest w oficjalnym wyniku.
 *
 * Porównanie po nazwie, bo tak te dane są zapisane - typy i wyniki to listy
 * nazw drużyn, bez identyfikatorów.
 */
export function markHits(picked, correct) {
  const zbior = new Set(correct || []);

  return (picked || []).map((team) => ({ team, hit: zbior.has(team) }));
}

/**
 * Ile z ilu, dla nagłówka grupy albo całej fazy.
 */
export function countHits(groups = []) {
  return groups.reduce(
    (suma, grupa) => {
      const trafione = markHits(grupa.picked, grupa.correct).filter(
        (p) => p.hit,
      ).length;

      return {
        hits: suma.hits + trafione,
        total: suma.total + (grupa.picked?.length || 0),
      };
    },
    { hits: 0, total: 0 },
  );
}

/**
 * Pierwsza litera nazwy drużyny - znak zastępczy tam, gdzie powinno być logo.
 *
 * Logotypów drużyn nie ma skąd wziąć: kolumna teams.logo_url jest pusta we
 * wszystkich wierszach, a drużyny z typów w ogóle nie mają tam swoich wierszy -
 * typy trzymają same nazwy jako tekst. Litera w kółku to ten sam zabieg, który
 * strona stosuje dla graczy bez awatara na Discordzie.
 */
export function teamInitial(team) {
  return String(team || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
}
