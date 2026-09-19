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
 * Klucz i wartość są już znormalizowane. Sprawdzone na wszystkich meczach
 * w bazie: 40 różnych zapisów nazw, 40 kluczy po normalizacji - czyli sama
 * normalizacja nie skleja tu NICZEGO, a mimo to są tu dwie pary tej samej
 * organizacji. Duplikaty w rodzaju "PARIVISION" i "Parivision" siedzą
 * w tabelach faz, gdzie normalizacja radzi sobie sama.
 *
 * Druga para wyszła dopiero przy liczeniu typów fazowych i pokazuje, czego
 * tamto sprawdzenie nie mogło zobaczyć: porównywało nazwy MECZOWE między
 * sobą, a rozjazd siedzi MIĘDZY meczami a fazami.
 *
 * Lista jest krótka celowo. Zgadywanie po podobieństwie jest tu groźniejsze
 * niż jej brak: "Ninjas in Pyjamas" i "Ninjas in Pyjamas Impact" mają wspólny
 * początek i są dwoma różnymi składami, więc automat skleiłby im statystyki.
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
