// Gracz ponad turniejami.
//
// Serwis ma dwie strony patrzące ponad pojedynczym eventem - klasyfikację
// wszech czasów i niespodzianki - i OBIE linkują w dół, do profilu w jednym
// turnieju. Klikając Dekusa w tabeli wszech czasów trafiało się na jego
// profil z Cologne, gdzie o Budapeszcie nie było ani słowa. Serwis potrafił
// powiedzieć, kto jest najlepszy przez cały czas, ale nie potrafił pokazać
// jednej osoby przez cały czas.
//
// NIC TU NIE LICZY OD NOWA. Podsumowanie startów to dosłownie ten sam
// buildAllTime, na którym stoi klasyfikacja, a lista startów to ten sam
// buildPlayerHistory, którego używa profil w turnieju. Gdyby ta strona
// liczyła percentyl po swojemu, gracz zobaczyłby dwie różne prawdy o tym
// samym starcie - raz w tabeli, raz u siebie.
//
// PRÓG PRZY DRUŻYNACH. Sekcja „na kogo stawiasz" musi mieć próg, bo mediana
// gracza ma 16 typów na mecze. Zmierzone na produkcji: par gracz-drużyna
// z co najmniej trzema typami jest 1377 na 638 graczy, czyli przeciętnie
// dwie drużyny na osobę. Przy jednym czy dwóch typach „wygrali 0%" nie mówi
// nic o tym, komu ktoś ufa - mówi tylko, że raz zagrał.
//
// Dla kogo ta sekcja naprawdę działa: 114 graczy ma 30 i więcej typów,
// 49 ma ponad sześćdziesiąt, 22 ponad sto. Rekord to 153. Reszta zobaczy
// zdanie mówiące, ilu typów brakuje - tak samo jak przy dwóch startach
// i dwunastu okazjach.

import { buildAllTime } from "./allTime.js";
import { normalizeTeamName, teamKey } from "./teamLogos.js";
import { buildPlayerHistory } from "./playerHistory.js";

function liczbaAlbo(wartosc, zapasowa = null) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

/**
 * Dorobek gracza: podsumowanie i lista startów.
 *
 * @param rows wiersze klasyfikacji tego gracza we wszystkich turniejach:
 *             event_id, total_points, rank_position, uczestnicy, name, slug,
 *             is_archived
 */
export function buildCareer(rows) {
  // minStarts 1, bo tu nie ma progu: strona jednego gracza należy się także
  // komuś, kto zagrał raz. Próg dwóch startów jest regułą TABELI, nie
  // własnością gracza - w klasyfikacji chodzi o porównywanie ludzi ze sobą,
  // a tutaj nie ma z kim porównywać.
  const [podsumowanie] = buildAllTime(rows, { minStarts: 1 });

  // null jako „turniej do pominięcia": ta strona nie jest w środku żadnego
  // turnieju, więc nie ma startu, który trzeba by wyciąć z listy.
  const starty = buildPlayerHistory(rows, null);

  if (!podsumowanie) {
    return { summary: null, starts: starty };
  }

  return {
    summary: {
      starts: podsumowanie.starts,
      avg_top_percent: podsumowanie.avg_top_percent,
      total_points: podsumowanie.total_points,
      best: podsumowanie.best,
    },

    starts: starty,
  };
}

/**
 * Na kogo ten gracz stawia i jak mu to wychodzi.
 *
 * Bierze SUROWE typy, a nie gotowe sumy, bo o tym, którą drużynę ktoś
 * wskazał, decyduje ta sama reguła co wszędzie indziej: wyższa liczba przy
 * drużynie. Policzone w SQL-u wymagałoby powtórzenia jej w zapytaniu.
 *
 * Grupowanie po `teamKey`, a nie po samej nazwie - z tego samego powodu, co
 * w teamStats.js: nazwa drużyny jest w tej bazie zwykłym tekstem i ta sama
 * organizacja bywa zapisana różnie ("FUT" i "FUT Esports"). Przy grupowaniu
 * po napisie typy jednego gracza rozpadłyby się na dwa wiersze, z których
 * żaden nie przekroczyłby progu.
 *
 * @param picks    typy gracza z rozstrzygniętych meczów: team_a, team_b,
 *                 pred_a, pred_b, res_a, res_b
 * @param logos    wiersze team_logos: name_key, logo_url
 * @param minPicks ile razy trzeba postawić na drużynę, żeby się liczyła
 */
export function buildTeamBias(picks, logos, { minPicks = 3 } = {}) {
  const druzyny = new Map();

  for (const p of picks || []) {
    const predA = liczbaAlbo(p.pred_a, 0);
    const predB = liczbaAlbo(p.pred_b, 0);

    // Typ z równym wynikiem nie wskazuje nikogo, więc nie mówi nic o tym,
    // komu gracz ufa. W bazie nie ma dziś ani jednego takiego, ale BO2
    // remis dopuszcza.
    if (predA === predB) continue;

    const resA = liczbaAlbo(p.res_a);
    const resB = liczbaAlbo(p.res_b);

    // Number(null) to zero, więc bez sprawdzenia na null mecz nierozegrany
    // wyglądałby na remis 0:0 i liczył się jako przegrana.
    if (resA === null || resB === null || resA === resB) continue;

    const naA = predA > predB;

    const nazwa = naA ? p.team_a : p.team_b;

    // W bazie zdarzają się myślniki zamiast nazw - sprawdzenie takie samo
    // jak w teamStats.js i z tego samego powodu.
    if (!normalizeTeamName(nazwa)) continue;

    const klucz = teamKey(nazwa);

    if (!druzyny.has(klucz)) {
      druzyny.set(klucz, { key: klucz, team: nazwa, picks: 0, wins: 0 });
    }

    const d = druzyny.get(klucz);

    // Najdłuższy napotkany zapis zostaje nazwą wyświetlaną: "FaZe Clan"
    // mówi więcej niż "FaZe". Ten sam wybór, co w teamStats.js.
    if (String(nazwa).length > String(d.team).length) d.team = nazwa;

    d.picks += 1;

    if (naA ? resA > resB : resB > resA) d.wins += 1;
  }

  const poKluczu = new Map();

  for (const l of logos || []) {
    if (l?.logo_url) poKluczu.set(teamKey(l.name_key), l.logo_url);
  }

  return [...druzyny.values()]
    .filter((d) => d.picks >= minPicks)
    .map((d) => ({
      key: d.key,
      team: d.team,
      logo: poKluczu.get(d.key) ?? null,
      picks: d.picks,
      wins: d.wins,
      win_rate: Math.round((d.wins / d.picks) * 100),
    }))
    .sort(
      (a, b) =>
        // Najpierw ci, na których stawia się NAJCZĘŚCIEJ - bo to jest
        // odpowiedź na pytanie „komu ufasz", a skuteczność jest dopiero
        // odpowiedzią na to, czy słusznie.
        b.picks - a.picks ||
        b.win_rate - a.win_rate ||
        a.team.localeCompare(b.team),
    );
}
