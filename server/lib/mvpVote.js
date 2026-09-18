// Głosowanie na MVP turnieju.
//
// Cztery tabele w bazie - kandydaci, typy, wynik i punkty - a na stronie
// MVP występowało WYŁĄCZNIE w panelu administratora i jako jedna liczba
// w rozbiciu punktów w rankingu. Żadnej publicznej trasy, żadnej sekcji.
//
// A leży tam największa pomyłka w historii serwisu. Zmierzone na produkcji,
// IEM Cologne Major 2026, 99 głosów na 31 kandydatów:
//
//   donk      Spirit     40 głosów   40%
//   ZywOo     Vitality   36 głosów   36%
//   molodoy   FURIA       5 głosów    5%
//   m0NESY    Falcons     3 głosy     3%   <- wygrał
//
// Trafiły TRZY osoby na dziewięćdziesiąt dziewięć. Dwóch faworytów zebrało
// 77% głosów i obaj byli obok. Dla porównania: najgorszy mecz na stronie
// „Niespodzianki" to zero trafień, ale wśród czterdziestu jeden osób - tutaj
// pomyliło się dziewięćdziesiąt sześć.
//
// KOGO POKAZUJEMY. Kandydatów jest 31, a głosy dostało kilkunastu - lista
// wszystkich byłaby w większości zerami. Liczy się więc każdy, kto dostał
// choć jeden głos, ORAZ zwycięzca, nawet gdyby nie dostał żadnego. Ten
// drugi warunek nie jest teoretyczny: cała ta sekcja istnieje po to, żeby
// pokazać, jak daleko od zwycięzcy było głosowanie, więc zwycięzca nie może
// z niej wypaść przez to, że nikt na niego nie postawił.

function liczbaAlbo(wartosc, zapasowa = 0) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

/**
 * Układa wiersze kandydatów w podsumowanie głosowania.
 *
 * @param rows kandydaci z liczbą głosów: candidate_id, nickname, team_name,
 *             votes, is_winner
 */
export function buildMvpVote(rows) {
  const kandydaci = [];

  let wszystkich = 0;
  let zwyciezca = null;

  for (const r of rows || []) {
    const glosow = liczbaAlbo(r.votes, 0);

    // Suma liczona ze WSZYSTKICH wierszy, także tych, które zaraz wypadną
    // z listy - inaczej procenty sumowałyby się do czegoś innego niż sto.
    wszystkich += glosow;

    const wygral = Boolean(r.is_winner);

    const wpis = {
      candidate_id: liczbaAlbo(r.candidate_id, 0),
      nickname: r.nickname ?? null,
      team_name: r.team_name || null,
      votes: glosow,
      won: wygral,
    };

    if (wygral) zwyciezca = wpis;

    if (glosow > 0 || wygral) kandydaci.push(wpis);
  }

  const zProcentem = kandydaci
    .map((k) => ({
      ...k,
      share: wszystkich > 0 ? Math.round((k.votes / wszystkich) * 100) : 0,
    }))
    .sort(
      (a, b) =>
        b.votes - a.votes ||
        // Zwycięzca przed równie obstawionymi - to on jest tu odpowiedzią.
        Number(b.won) - Number(a.won) ||
        String(a.nickname ?? "").localeCompare(String(b.nickname ?? "")),
    );

  return {
    total_votes: wszystkich,

    // Rozstrzygnięte znaczy: administrator wskazał zwycięzcę. Bez tego
    // sekcja pokazuje sam podział głosów, bo nie ma jeszcze czego z nim
    // porównać.
    resolved: Boolean(zwyciezca),

    winner: zwyciezca
      ? {
          ...zwyciezca,
          share: wszystkich > 0 ? Math.round((zwyciezca.votes / wszystkich) * 100) : 0,
        }
      : null,

    // Ile procent głosujących trafiło. null, a nie zero, gdy wyniku jeszcze
    // nie ma - "nikt nie trafił" i "nie wiadomo, kto wygrał" to dwie różne
    // rzeczy.
    hit_rate:
      zwyciezca && wszystkich > 0
        ? Math.round((zwyciezca.votes / wszystkich) * 100)
        : null,

    candidates: zProcentem,
  };
}

/**
 * Głosowania na MVP ze WSZYSTKICH turniejów, od najgorzej odgadniętego.
 *
 * Istnieje po to, żeby strona „Niespodzianki" mogła powiedzieć prawdę:
 * największa pomyłka w historii serwisu nie była meczem. Bez tego ta strona
 * mierzy wyłącznie mecze, bo z nich powstała - a to jest ograniczenie
 * narzędzia, nie właściwość społeczności.
 *
 * Próg głosów jest ten sam, co próg typów przy meczach, i z tego samego
 * powodu: przy trzech głosujących „nikt nie trafił" nie znaczy nic.
 *
 * @param rows     kandydaci ze wszystkich turniejów, z event_id, event_name
 *                 i event_slug obok pozostałych pól
 * @param minVotes ile głosów musi mieć turniej, żeby się liczył
 */
export function buildMvpMisses(rows, { minVotes = 20 } = {}) {
  const turnieje = new Map();

  for (const r of rows || []) {
    const id = liczbaAlbo(r.event_id, 0);

    if (!turnieje.has(id)) {
      turnieje.set(id, {
        event_id: id,
        event_name: r.event_name ?? null,
        event_slug: r.event_slug ?? null,
        wiersze: [],
      });
    }

    turnieje.get(id).wiersze.push(r);
  }

  return [...turnieje.values()]
    .map((t) => ({
      event_id: t.event_id,
      event_name: t.event_name,
      event_slug: t.event_slug,
      ...buildMvpVote(t.wiersze),
    }))
    // Bez wskazanego zwycięzcy nie ma czego nazwać pomyłką.
    .filter((t) => t.resolved && t.total_votes >= minVotes)
    .sort(
      (a, b) =>
        a.hit_rate - b.hit_rate ||
        // Przy tym samym procencie wyżej to głosowanie, w którym pomyliło
        // się WIĘCEJ ludzi - tak samo jak przy meczach.
        b.total_votes - a.total_votes ||
        a.event_id - b.event_id,
    );
}
