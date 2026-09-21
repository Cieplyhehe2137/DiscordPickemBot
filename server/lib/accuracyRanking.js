// Ranking ze skuteczności: druga oś tej samej tabeli.
//
// CZEGO BRAKOWAŁO. Ranking turnieju sortuje po sumie punktów, a punkty rosną
// z każdym oddanym typem - więc w dużej mierze mierzy OBECNOŚĆ, nie oko.
// Zmierzone w IEM Cologne Major 2026, 106 rozstrzygniętych meczów:
//
//   409  osób oddało choć jeden typ meczowy
//   163  oddało DOKŁADNIE JEDEN
//    48  wytypowało co najmniej połowę meczów
//    27  co najmniej 90%
//     4  komplet
//
// Mediana typującego pominęła 103 ze 106 meczów. Procent trafień stoi
// w wierszu od dawna, ale lista jest po nim nieposortowana, więc nie widać
// go nawet wtedy, gdy jest wybitny: M4kro ma 71.4% i stoi punktowo na #71.
//
// CO TA TABELA POKAZUJE. Tych samych ludzi, ułożonych według odsetka
// trafionych zwycięzców. Pierwsza dziesiątka ma pięć nowych twarzy wobec
// rankingu punktowego (Kraków: cztery):
//
//   kakarucza    37/54  = 68.5%   punktowo #45
//   Mkl58        42/62  = 67.7%   punktowo #43
//   Lemonziiko   48/71  = 67.6%   punktowo #40
//
// DLACZEGO PRÓG POŁOWY MECZÓW. Bez progu czołówkę zajęliby ludzie z jednym
// szczęśliwym typem - stu sześćdziesięciu trzech graczy ma w Kolonii
// dokładnie jeden typ, a 100% z jednego meczu stanęłoby nad siedemdziesięcioma
// procentami ze stu trzech. Połowa daje stawkę 48 osób w Kolonii i 61
// w Krakowie: dość dużą, żeby było o czym mówić, i dość wymagającą, żeby
// każdy wynik w niej coś znaczył.
//
// Ten sam wzorzec - próg plus wskaźnik zamiast sumy - stoi już w
// server/lib/allTime.js, gdzie klasyfikacja wszech czasów wymaga dwóch
// startów i liczy średni percentyl. Tabela turniejowa była ostatnim
// miejscem, które go nie stosowało.
//
// CZYSTY, BEZ IMPORTÓW I BEZ ZAPYTAŃ. Wszystkie pola, na których stoi ta
// tabela (total_predictions, correct_winners, rank), są już w pamięci
// podręcznej rankingu - to przełożenie tych samych wierszy, a nie nowa
// podróż do bazy.

/** Jaka część rozstrzygniętych meczów wpuszcza do stawki. */
export const UDZIAL_PROGU = 0.5;

function liczba(wartosc) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : 0;
}

/**
 * Ile typów trzeba oddać, żeby wejść do tabeli skuteczności.
 *
 * Liczone z meczów, nie na sztywno: w Kolonii wychodzi 53, w Krakowie 25.
 * Stała liczba znaczyłaby w tych dwóch turniejach co innego.
 */
export function progTypow(meczow) {
  const n = liczba(meczow);

  return n > 0 ? Math.max(1, Math.ceil(n * UDZIAL_PROGU)) : 0;
}

/** Odsetek trafionych zwycięzców, jako ułamek - nie zaokrąglony procent. */
function skutecznosc(gracz) {
  const typow = liczba(gracz?.total_predictions);

  return typow > 0 ? liczba(gracz?.correct_winners) / typow : 0;
}

// Kolejność rozstrzygamy na DOKŁADNYM ułamku, a nie na zaokrąglonym polu
// `accuracy`. Przy zaokrągleniu 67.6% i 67.9% to oba „68%" i o miejscu
// decydowałaby przypadkowa kolejność wierszy z bazy.
function porownaj(a, b) {
  const sa = skutecznosc(a);
  const sb = skutecznosc(b);

  if (sb !== sa) return sb - sa;

  // Przy równej skuteczności wyżej stoi ten, kto typował więcej - ten sam
  // wynik z większej próby jest mocniejszym wynikiem.
  const ta = liczba(a?.total_predictions);
  const tb = liczba(b?.total_predictions);

  if (tb !== ta) return tb - ta;

  // Dalej to, co rozstrzyga ranking punktowy, żeby dwa widoki tej samej
  // tabeli nie opowiadały o jednej parze graczy dwóch różnych historii.
  const pa = liczba(a?.total_points);
  const pb = liczba(b?.total_points);

  if (pb !== pa) return pb - pa;

  return String(a?.user_id).localeCompare(String(b?.user_id));
}

/**
 * Ranking ze skuteczności.
 *
 * @param players wiersze rankingu punktowego - te same obiekty, z polami
 *                total_predictions, correct_winners i już nadanym `rank`
 * @param matches ile meczów turnieju jest rozstrzygniętych
 *
 * Zwraca wiersze z `rank` nadanym OD NOWA (miejsce w skuteczności)
 * i zapamiętanym `points_rank`, żeby wiersz mógł pokazać, skąd ktoś
 * przyszedł.
 */
export function buildAccuracyRanking({ players = [], matches = 0 } = {}) {
  const meczow = liczba(matches);
  const prog = progTypow(meczow);

  // Turniej bez rozstrzygniętych meczów (StarLadder Budapest 2025 to same
  // fazy) nie ma z czego zbudować skuteczności. Pusta stawka, a nie tabela
  // samych zer.
  const stawka =
    prog > 0
      ? (players || []).filter(
        (gracz) => gracz && liczba(gracz.total_predictions) >= prog,
      )
      : [];

  const posortowani = [...stawka].sort(porownaj);

  return {
    matches: meczow,
    threshold: prog,
    players: posortowani.length,

    rows: posortowani.map((gracz, i) => {
      const punktowe = liczba(gracz.rank);

      return {
        ...gracz,

        // Miejsce w TEJ tabeli. Nadpisuje miejsce punktowe świadomie -
        // front rysuje po `rank` medale i numer wiersza, a w tym widoku
        // pierwszy ma być pierwszy.
        rank: i + 1,

        // Skąd ten człowiek przyszedł. Bez tego nie widać, że piąta
        // skuteczność turnieju stoi punktowo na czterdziestym piątym
        // miejscu - a to jest cała informacja, po którą tu się przychodzi.
        points_rank: punktowe > 0 ? punktowe : null,
      };
    }),
  };
}
