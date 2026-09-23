// Mecze, które zrobiły różnicę: gdzie ten gracz odszedł od reszty.
//
// CZEGO BRAKOWAŁO. Profil mówi „+2 wobec tłumu" i na tym kończy. Suma jest
// prawdziwa, ale nie da się jej zobaczyć - a bierze się z kilku decyzji,
// nie ze stu sześciu. Zmierzone w IEM Cologne: tylko 8% typów (504 z 6405)
// oddano wbrew trzem czwartym stawki. Reszta to chodzenie z tłumem, gdzie
// wszyscy dostają to samo.
//
// CO TA SEKCJA POKAZUJE. Sześć meczów z nazwami drużyn: trzy, w których
// gracz miał rację będąc niemal sam, i trzy, w których był sam i się mylił.
//
//   pieka        B8 - M80          postawil na M80,     z nim  4% z 52
//   karwix       Spirit - MIBR     postawil na MIBR,    z nim  0% z 53
//   BoloTv GOAT  NAVI - G2         postawil na G2,      z nim 16% z 38
//
// karwix przy Spirit - MIBR był JEDYNĄ osobą na pięćdziesiąt trzy, która
// postawiła na MIBR. Tego zdania nie da się dziś nigdzie przeczytać.
//
// DLACZEGO „NAJGORSZE" TO POMYŁKA W SAMOTNOŚCI, A NIE POMYŁKA Z TŁUMEM.
// Pierwsza, oczywista definicja - „myliłeś się, choć większość wiedziała" -
// daje WSZYSTKIM TE SAME trzy mecze. Sprawdzone na czterech graczach
// z przeciwnych końców tabeli; u każdego wyszło identycznie:
//
//   Vitality - 9z                  postawił na Vitality, z nim 100% z 40
//   MIBR - THUNDER dOWNUNDER       postawił na MIBR,     z nim  96% z 148
//   B8 - M80                       postawił na B8,       z nim  94% z 52
//
// To nie jest fakt o człowieku, tylko strona Niespodzianki powtórzona na
// profilu. Stąd odwrócenie: liczy się pomyłka w samotności, czyli lustro
// tej dobrej decyzji.
//
// CZYSTY, BEZ ZAPYTAŃ. Wiersze to dokładnie to samo, z czego liczy się
// „Ty kontra tłum" - zapytanie już chodzi w fali profilu i już złącza
// tabelę `matches`, więc nazwy drużyn kosztują trzy kolumny, a nie
// kolejną podróż do bazy.

import { bezTwojegoGlosu } from "./crowdBaseline.js";

/**
 * Ilu INNYCH musiało wytypować mecz, żeby liczyć poparcie.
 *
 * „Byłeś sam przeciw trzem" nie jest samotnością, tylko małą próbką.
 * Dwadzieścia to ten sam próg, którym strona Niespodzianki odcina mecze
 * nieznaczące - i kosztuje prawie nic: 155 ze 156 meczów w bazie ma
 * więcej typów.
 */
export const MIN_GLOSUJACYCH = 20;

/** Ile decyzji pokazujemy z każdej strony. */
export const ILE_POKAZUJEMY = 3;

function liczba(wartosc) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : 0;
}

function nazwa(wartosc) {
  const tekst = String(wartosc ?? "").trim();

  return tekst.length > 0 ? tekst : null;
}

/**
 * Decyzje, które odróżniły tego gracza od reszty.
 *
 * @param rows wiersze { match_id, team_a, team_b, phase, mine_a, winner_a,
 *             on_a, on_b } - po jednym na mecz, który wytypował i który
 *             się rozstrzygnął
 *
 * Zwraca { best, worst, voters } - `voters` idzie na front, bo „z nim 4%
 * z 52" wymaga powiedzenia, czym jest to pięćdziesiąt dwa.
 */
export function buildKeyDecisions(rows = []) {
  const ocenione = [];

  for (const w of rows || []) {
    if (!w) continue;

    const teamA = nazwa(w.team_a);
    const teamB = nazwa(w.team_b);

    // Bez nazw drużyn wiersz nie ma czego pokazać - a to jest sekcja,
    // która cała polega na tym, że mecz da się nazwać.
    if (!teamA || !teamB) continue;

    const { mojeNaA, wygralA, naA, naB } = bezTwojegoGlosu(w);

    const innych = naA + naB;

    if (innych < MIN_GLOSUJACYCH) continue;

    const zeMna = mojeNaA ? naA : naB;

    ocenione.push({
      match_id: liczba(w.match_id),
      team_a: teamA,
      team_b: teamB,
      phase: nazwa(w.phase),

      // Na kogo postawił - nazwą, a nie stroną. „Postawił na A" nie
      // znaczy nic dla kogoś, kto patrzy na tabelę pół roku później.
      picked: mojeNaA ? teamA : teamB,

      hit: mojeNaA === wygralA,

      // Ilu innych było po tej samej stronie. Zaokrąglone, bo to jest
      // liczba do przeczytania, a nie do liczenia.
      support: Math.round((100 * zeMna) / innych),
      voters: innych,
    });
  }

  // Najpierw najrzadsza decyzja. Przy równym poparciu wyżej stoi mecz
  // z WIĘKSZĄ widownią: bycie samemu wśród stu pięćdziesięciu znaczy
  // więcej niż wśród dwudziestu jeden.
  const odNajrzadszej = (a, b) =>
    a.support - b.support || b.voters - a.voters || a.match_id - b.match_id;

  return {
    best: ocenione.filter((r) => r.hit).sort(odNajrzadszej).slice(0, ILE_POKAZUJEMY),
    worst: ocenione.filter((r) => !r.hit).sort(odNajrzadszej).slice(0, ILE_POKAZUJEMY),

    voters: MIN_GLOSUJACYCH,
  };
}
