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
 *    dopiskiem.
 *
 *  - "Ninjas in Pyjamas": alias celuje w SKRÓT, nie w dłuższą nazwę.
 *    Wyszukanie pełnej nazwy oddaje wyłącznie "Ninjas in Pyjamas Impact",
 *    czyli skład żeński - i właśnie dlatego ta drużyna długo nie miała tu
 *    wpisu. Pierwszy skład dostawca prowadzi pod "NIP" (akronim NIP, slug
 *    "nip"), więc alias prowadzi tam. "Impact" nadal nie ma jak wygrać:
 *    po aliasie dokładnym trafieniem jest "nip", a nie "ninjasinpyjamas".
 *
 *  - "Aurora": dokładne trafienie istnieje ("AURORA", slug "aurora-cs-go"),
 *    ale u dostawcy nie ma przy nim ŻADNEGO obrazka. Logotyp wisi przy
 *    "Aurora Gaming" - ta sama organizacja pod dawną nazwą - i alias
 *    prowadzi do niej.
 *
 * Nowe pozycje sprawdzone na żywym API 2026-09-16, każda przez obejrzenie
 * samego obrazka: shuriken NIP, turkusowa Aurora, żółty herb Legacy.
 */
export const TEAM_NAME_ALIASES = {
  "team liquid": "Liquid",
  "faze clan": "FaZe",
  "lynn vision gaming": "Lynn Vision",
  navi: "Natus Vincere",
  betboom: "BetBoom Team",
  "bc.game": "BC.Game Esports",
  "ninjas in pyjamas": "NIP",
  aurora: "Aurora Gaming",
};

/**
 * Zapisy, które są tą samą drużyną, a nie sprowadza ich do siebie samo
 * usunięcie wielkich liter i znaków.
 *
 * Klucz i wartość są już znormalizowane.
 *
 * SKĄD SIĘ BIERZE TA LISTA. Nie ze zgadywania po podobieństwie - to byłoby
 * groźniejsze niż jej brak, bo „Ninjas in Pyjamas" i „Ninjas in Pyjamas
 * Impact" mają wspólny początek i są dwoma różnymi składami. Bierze się
 * wprost z TEAM_NAME_ALIASES wyżej: każdy tamten wpis MÓWI, że dwa zapisy
 * to ten sam klub. Jeżeli oba zapisy dają różne klucze, muszą tu zostać
 * sklejone - i tego pilnuje test.
 *
 * DLACZEGO TEN TEST MUSIAŁ POWSTAĆ. Reguła stała w tym pliku od początku,
 * ale była stosowana ręcznie i wybiórczo. Na produkcji dało to TRZY
 * organizacje rozbite na pół, każda z dwiema stronami i dwoma kompletami
 * statystyk:
 *
 *   Liquid          3 mecze, 207 typów na awans, trafnie 79%
 *   Team Liquid     5 meczów, 198 typów,         trafnie  0%
 *
 *   Lynn Vision        5 meczów,  67 typów
 *   Lynn Vision Gaming 0 meczów, 230 typów
 *
 *   NAVI            5 meczów, 550 typów
 *   Natus Vincere   3 mecze,    0 typów
 *
 * KIERUNEK jest osądem, nie regułą - liczy się tylko to, żeby oba zapisy
 * trafiły na ten sam klucz. Wybieramy tę formę, której używa baza i która
 * ma wiersz w `team_logos` z logotypem, bo to ona stoi w adresie strony.
 *
 * MARTWE DZIŚ, A MIMO TO POPRAWNE: betboomteam, bcgameesports, auroragaming
 * i nip nie występują w bazie jako nazwy drużyn - to nazwy, pod którymi
 * prowadzi je dostawca logotypów. Zostają, bo reguła ma być całkowita:
 * lista z wyjątkami to dokładnie to, co tu zawiodło. Gdyby ktoś kiedyś
 * wpisał „NIP" w typie na fazę, ma się policzyć jako Ninjas in Pyjamas.
 */
export const TEAM_KEY_MERGES = {
  fut: "futesports",

  // Mecze zapisują tę drużynę jako „FaZe", a tabele faz jako „FaZe Clan" -
  // jedna organizacja pod dwoma kluczami. Skutek był taki, że na stronie
  // drużyn stała „FaZe" z trzema meczami, a 506 typów na awans przy 69%
  // trafności nie należało do nikogo.
  //
  // W STRONĘ KRÓTKIEJ NAZWY, odwrotnie niż przy FUT: TEAM_NAME_ALIASES ma
  // już wpis „faze clan" -> „FaZe", więc krótka forma jest tu tożsamością
  // przyjętą w projekcie. Dzięki temu nie zmienia się ani adres
  // /teams/FaZe, ani wiersz `faze` w team_logos, z którego idzie logotyp.
  fazeclan: "faze",

  // Ta sama historia, dwa razy. Obie krótkie formy mają wiersz z logotypem
  // w team_logos i obie stoją w meczach, więc adresy /teams/Liquid
  // i /teams/Lynn%20Vision zostają takie, jakie są.
  teamliquid: "liquid",
  lynnvisiongaming: "lynnvision",

  // Tu odwrotnie niż wyżej: sklejamy DŁUGĄ formę w krótką, choć alias
  // prowadzi do długiej. Powód jest w danych - „NAVI" występuje 555 razy,
  // „Natus Vincere" trzy. Klucz `navi` ma własny wiersz w team_logos
  // z logotypem pierwszej drużyny (alias istnieje po to, żeby dostawca nie
  // oddał składu juniorów), więc nic nie traci obrazka.
  natusvincere: "navi",

  // Nazwy, pod którymi drużyny prowadzi dostawca logotypów. W naszej bazie
  // nie występują - patrz akapit o martwych wpisach wyżej.
  betboomteam: "betboom",
  bcgameesports: "bcgame",
  auroragaming: "aurora",
  nip: "ninjasinpyjamas",
};

/**
 * Klucz, po którym grupuje się statystyki drużyny.
 *
 * Normalizacja plus sklejenia wyżej. To jest funkcja, której używa widok -
 * `normalizeTeamName` zostaje osobno, bo na niej stoi klucz unikalny
 * w `team_logos` i zmiana jej znaczenia rozjechałaby tabelę.
 */
export function teamKey(name) {
  const klucz = normalizeTeamName(name);

  return TEAM_KEY_MERGES[klucz] || klucz;
}

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

  const dokladne = (candidates || []).filter((team) =>
    [team?.name, team?.acronym, team?.slug].some(
      (klucz) => normalizeTeamName(klucz) === cel,
    ),
  );

  // Przy KILKU dokładnych trafieniach wygrywa to, przy którym jest obrazek.
  //
  // Dostawca trzyma dwa wiersze o nazwie "Legacy" - jeden bez logotypu,
  // drugi z logotypem - i oddaje je w kolejności, w której pusty jest
  // pierwszy. Samo "pierwsze dokładne" dawało więc drużynę rozpoznaną,
  // ale bez obrazka, i wyglądało to jak brak u dostawcy.
  //
  // To NIE jest poluzowanie dopasowania. Obaj kandydaci przeszli już ten
  // sam warunek dokładności; rozstrzyga się wyłącznie remis między nimi,
  // i tylko po tym, czy jest co pokazać. Tam, gdzie logotyp już się
  // znajdował, wynik zostaje ten sam.
  return dokladne.find((team) => team?.image_url) || dokladne[0] || null;
}
