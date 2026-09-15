import { normalizeTeamName, teamKey } from "./teamLogos.js";

// Statystyki drużyn: bilans meczów i to, jak obstawia je społeczność.
//
// Nazwa drużyny jest w tej bazie zwykłym tekstem, nie odwołaniem do tabeli,
// więc wszystko grupuje się po kluczu z `teamKey` - normalizacja plus
// krótka lista sklejeń.
//
// Sprawdzone na wszystkich meczach w bazie: 40 różnych zapisów nazw i 40
// kluczy po samej normalizacji, czyli w meczach nie ma ani jednej pary
// różniącej się tylko wielkością liter. Jest za to jedna para, której
// normalizacja nie skleja, a która jest tą samą organizacją - i stąd
// TEAM_KEY_MERGES.
//
// Liczone są WYŁĄCZNIE mecze, bo tylko one mają wynik i typ w postaci, którą
// da się zsumować. Typy na awans z faz leżą w bazie jako listy tekstowe
// ("B8, BetBoom") i policzenie ich wymagałoby rozbioru każdego wiersza
// każdego gracza - to osobna robota, nie skutek uboczny tej.

function liczbaAlbo(wartosc, zapasowa = null) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

function pustaDruzyna(nazwa) {
  return {
    key: teamKey(nazwa),

    // Nazwa do pokazania. Wygrywa najdłuższy zapis, bo to zwykle ten pełny:
    // "FaZe Clan" mówi więcej niż "FaZe", a "Natus Vincere" niż "NAVI".
    name: nazwa,

    logo: null,

    matches: 0,
    settled: 0,
    wins: 0,
    losses: 0,

    // Ile typów wskazało tę drużynę i ile było wszystkich typów w jej
    // meczach. Iloraz to "zaufanie" - jak chętnie się na nią stawia.
    picks_for: 0,
    picks_total: 0,

    // Ile z tych typów się sprawdziło. Zaufanie i jego skutek to dwie różne
    // rzeczy: drużyna może być obstawiana chętnie i przegrywać.
    picks_right: 0,

    events: new Set(),
  };
}

/**
 * Buduje statystyki wszystkich drużyn z meczów, podziału głosów i logotypów.
 *
 * @param matches wiersze meczów z wynikiem i nazwą turnieju
 * @param splits  podział typów na mecz: { match_id, for_a, for_b, total }
 * @param logos   wiersze team_logos
 */
export function buildTeamStats(matches, splits, logos) {
  const poMeczu = new Map();

  for (const s of splits || []) {
    poMeczu.set(Number(s.match_id), {
      for_a: liczbaAlbo(s.for_a, 0),
      for_b: liczbaAlbo(s.for_b, 0),
      total: liczbaAlbo(s.total, 0),
    });
  }

  const poKluczu = new Map();

  const dodaj = (nazwa) => {
    const klucz = teamKey(nazwa);

    if (!klucz) return null;

    if (!poKluczu.has(klucz)) poKluczu.set(klucz, pustaDruzyna(nazwa));

    const druzyna = poKluczu.get(klucz);

    // Najdłuższy napotkany zapis zostaje nazwą wyświetlaną.
    if (String(nazwa).length > String(druzyna.name).length) {
      druzyna.name = nazwa;
    }

    return druzyna;
  };

  const historia = new Map();

  for (const m of matches || []) {
    // Sprawdzenie PRZED dodaniem, a nie po. Dodanie najpierw zostawiałoby
    // po meczu z jedną pustą nazwą drużynę-widmo: wpis na liście z zerem
    // meczów, bo sam mecz zaraz potem zostaje pominięty. W bazie zdarzają
    // się myślniki zamiast nazw.
    if (!normalizeTeamName(m.team_a) || !normalizeTeamName(m.team_b)) continue;

    const a = dodaj(m.team_a);
    const b = dodaj(m.team_b);

    const resA = liczbaAlbo(m.res_a);
    const resB = liczbaAlbo(m.res_b);

    // Mecz jest rozstrzygnięty dopiero wtedy, gdy są OBIE strony wyniku.
    // Number(null) to zero, więc bez tego sprawdzenia nierozegrany mecz
    // wyglądałby na remis 0:0 i psuł bilans obu drużyn.
    const settled = resA !== null && resB !== null;

    const podzial = poMeczu.get(Number(m.id)) || { for_a: 0, for_b: 0, total: 0 };

    for (const [druzyna, za, wygral] of [
      [a, podzial.for_a, settled && resA > resB],
      [b, podzial.for_b, settled && resB > resA],
    ]) {
      druzyna.matches += 1;
      druzyna.events.add(m.event_id);

      druzyna.picks_for += za;
      druzyna.picks_total += podzial.total;

      if (settled) {
        druzyna.settled += 1;

        if (wygral) {
          druzyna.wins += 1;
          druzyna.picks_right += za;
        } else {
          druzyna.losses += 1;
        }
      }
    }

    const wpis = {
      match_id: Number(m.id),
      event_id: Number(m.event_id),
      event_name: m.event_name,
      event_slug: m.event_slug,
      phase: m.phase,

      team_a: m.team_a,
      team_b: m.team_b,

      res_a: resA,
      res_b: resB,
      settled,

      for_a: podzial.for_a,
      for_b: podzial.for_b,
      picks_total: podzial.total,
    };

    // Każda drużyna dostaje wpis z własną stroną meczu.
    //
    // Bez tego widok musiałby zgadywać, po której stronie stał ten, kogo
    // ogląda, porównując nazwy - a nazwa wyświetlana bywa INNYM zapisem niż
    // ten w meczu ("FUT Esports" wobec "FUT"). Takie porównanie wychodzi
    // wtedy odwrotnie i strona pokazuje wygraną jako przegraną.
    for (const [klucz, side] of [
      [a.key, "a"],
      [b.key, "b"],
    ]) {
      if (!historia.has(klucz)) historia.set(klucz, []);

      historia.get(klucz).push({ ...wpis, side });
    }
  }

  // Logotypy dopinamy po znormalizowanej nazwie - tym samym kluczu, na
  // którym stoi klucz unikalny w tabeli.
  for (const l of logos || []) {
    const druzyna = poKluczu.get(teamKey(l.name_key));

    if (druzyna && l.logo_url) druzyna.logo = l.logo_url;
  }

  const gotowe = [...poKluczu.values()].map((d) => ({
    key: d.key,
    name: d.name,
    logo: d.logo,

    matches: d.matches,
    settled: d.settled,
    wins: d.wins,
    losses: d.losses,

    events: d.events.size,

    picks_for: d.picks_for,
    picks_total: d.picks_total,
    picks_right: d.picks_right,

    // Procenty liczone raz, tutaj, a nie w każdym miejscu widoku osobno.
    // null przy braku danych, a NIE zero - "nikt nie typował" i "nikt nie
    // postawił na tę drużynę" to dwie różne rzeczy.
    trust:
      d.picks_total > 0 ? Math.round((d.picks_for / d.picks_total) * 100) : null,

    trust_hit:
      d.picks_for > 0 ? Math.round((d.picks_right / d.picks_for) * 100) : null,

    win_rate: d.settled > 0 ? Math.round((d.wins / d.settled) * 100) : null,
  }));

  return { teams: gotowe, history: historia };
}

/**
 * Porządek listy drużyn: najpierw te z największą liczbą meczów.
 *
 * Alfabetycznie wyglądałoby porządniej i byłoby gorsze: na górze stanęłyby
 * drużyny, które zagrały jeden mecz w jednym turnieju, a te, o które
 * naprawdę chodzi, wypadłyby w środek listy.
 */
export function sortTeams(teams) {
  return [...(teams || [])].sort(
    (a, b) => b.matches - a.matches || a.name.localeCompare(b.name),
  );
}
