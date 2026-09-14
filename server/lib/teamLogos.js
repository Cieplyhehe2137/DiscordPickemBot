// Dopasowywanie nazw drużyn do logotypów.
//
// Typy i mecze trzymają nazwy drużyn jako zwykły tekst, więc ta sama drużyna
// bywa zapisana na kilka sposobów. Sprawdzone na całej bazie: 48 różnych
// nazw, a stoi za nimi 37 drużyn.

/**
 * Nazwa sprowadzona do postaci porównywalnej: małe litery, bez niczego poza
 * literami i cyframi.
 *
 * "FaZe Clan" -> "fazeclan", "THUNDER dOWNUNDER" -> "thunderdownunder",
 * "BC.Game" -> "bcgame". Dzięki temu różnice w wielkości liter i w kropkach
 * przestają robić z jednej drużyny dwie.
 */
export function normalizeTeamName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Nazwy, których wyszukiwarka dostawcy nie znajduje albo znajduje źle.
 *
 * Każda pozycja ma powód sprawdzony na żywym API - to nie są domysły:
 *
 *  - "Team Liquid", "FaZe Clan", "Lynn Vision Gaming": wyszukiwanie po pełnej
 *    nazwie nie zwraca NIC, a po krótszej trafia dokładnie. To ten sam zespół
 *    zapisany dłużej.
 *
 *  - "NAVI": wyszukiwarka oddaje wyłącznie "ex-NAVI Junior", "NAVI Javelins"
 *    i "NAVI Youth" - akademie i skład żeński. Automat wziąłby logo juniorów
 *    dla pierwszej drużyny. "Natus Vincere" trafia dokładnie, więc tu idzie.
 *
 *  - "BetBoom" i "BC.Game": dostawca prowadzi je pod pełniejszą nazwą
 *    ("BetBoom Team", "BC.Game Esports"). To ta sama drużyna, tylko z
 *    dopiskiem - w odróżnieniu od "Ninjas in Pyjamas Impact", które jest
 *    osobnym składem i dlatego aliasu NIE dostaje.
 */
export const TEAM_NAME_ALIASES = {
  "team liquid": "Liquid",
  "faze clan": "FaZe",
  "lynn vision gaming": "Lynn Vision",
  navi: "Natus Vincere",
  betboom: "BetBoom Team",
  "bc.game": "BC.Game Esports",
};

/**
 * Nazwa, pod którą szukamy u dostawcy.
 */
export function searchNameFor(name) {
  const alias = TEAM_NAME_ALIASES[String(name || "").trim().toLowerCase()];

  return alias || name;
}

/**
 * Wybiera drużynę z odpowiedzi wyszukiwarki.
 *
 * Bierze WYŁĄCZNIE dokładne trafienie po nazwie, akronimie albo slugu.
 * Zgadywanie po podobieństwie jest tu groźniejsze niż brak logo: wyszukanie
 * "Ninjas in Pyjamas" oddaje "Ninjas in Pyjamas Impact", czyli inny skład,
 * a taki błąd na profilu gracza wygląda dokładnie jak prawda.
 */
export function pickExactTeam(candidates, name) {
  const cel = normalizeTeamName(name);

  if (!cel) return null;

  return (
    (candidates || []).find((team) =>
      [team?.name, team?.acronym, team?.slug].some(
        (klucz) => normalizeTeamName(klucz) === cel,
      ),
    ) || null
  );
}
