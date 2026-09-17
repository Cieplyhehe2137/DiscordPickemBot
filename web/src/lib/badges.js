// Odznaki gracza.
//
// Liczone z tego, co profil i tak zwraca - żadnego nowego zapytania i żadnej
// nowej kolumny. Odznaka to nie nowa informacja, tylko nazwa nadana liczbie,
// która i tak stoi na tej samej stronie.
//
// PROGI SĄ ZMIERZONE, NIE ZGADNIĘTE. Sprawdzone na trzydziestu najlepszych
// graczach turnieju z 262 uczestnikami:
//
//   statystyka            mediana   górne 25%   górne 10%   maksimum
//   skuteczność              59%        62%         67%        68%
//   dokładne wyniki serii     15         17          20         22
//   exacty map                 7          7          10         12
//   najdłuższa seria           6          7           9         10
//   komplety                   0          0           0          1
//   najlepszy mecz             7          8           9         10
//
// Dwa wnioski, które zmieniły projekt tej listy:
//
//  1. Próg 75% skuteczności byłby NIEOSIĄGALNY - nikt w czołówce nie
//     przekroczył 68%. Złoty próg stoi więc na 65%.
//
//  2. Komplet ma dziś jeden gracz na trzydziestu z czołówki, a seria
//     dziesięciu trafień też jeden. To są odznaki rzadkie naprawdę,
//     a nie z nazwy - i dlatego zostają bez progów pośrednich.
//
// Pamiętać przy dokładaniu nowych: to była czołówka. Cała stawka wypada
// znacznie słabiej, więc progi są trudniejsze, niż wyglądają.

// Poziomy. Nazwa klasy CSS podana wprost, a nie sklejana z numerem -
// sklejanie sprawia, że nazwa nie występuje w kodzie dosłownie i narzędzie
// do usuwania martwego CSS kasuje te reguły jako nieużywane.
export const POZIOM_KLASA = {
  1: "badge-tile--brown",
  2: "badge-tile--silver",
  3: "badge-tile--gold",
};

// Rodziny progowe: ta sama rzecz na trzech poziomach. Pokazywany jest
// wyłącznie NAJWYŻSZY zdobyty - inaczej gracz z trzema poziomami jednej
// rzeczy miałby trzy kafelki mówiące to samo.
const RODZINY = [
  {
    family: "accuracy",
    field: "accuracy",
    icon: "🎯",
    unit: "%",
    descKey: "badge.accuracy.desc",
    poziomy: [
      { tier: 1, prog: 50, labelKey: "badge.accuracy1" },
      { tier: 2, prog: 60, labelKey: "badge.accuracy2" },
      { tier: 3, prog: 65, labelKey: "badge.accuracy3" },
    ],
  },

  {
    family: "streak",
    field: "best_correct_streak",
    icon: "🔥",
    unit: "",
    descKey: "badge.streak.desc",
    poziomy: [
      { tier: 1, prog: 5, labelKey: "badge.streak1" },
      { tier: 2, prog: 8, labelKey: "badge.streak2" },
      { tier: 3, prog: 10, labelKey: "badge.streak3" },
    ],
  },

  {
    family: "exact_series",
    field: "exact_series",
    icon: "📐",
    unit: "",
    descKey: "badge.exactSeries.desc",
    poziomy: [
      { tier: 1, prog: 5, labelKey: "badge.exactSeries1" },
      { tier: 2, prog: 15, labelKey: "badge.exactSeries2" },
      { tier: 3, prog: 20, labelKey: "badge.exactSeries3" },
    ],
  },

  {
    family: "exact_maps",
    field: "exact_maps",
    icon: "💎",
    unit: "",
    descKey: "badge.exactMaps.desc",
    poziomy: [
      { tier: 1, prog: 3, labelKey: "badge.exactMaps1" },
      { tier: 2, prog: 7, labelKey: "badge.exactMaps2" },
      { tier: 3, prog: 10, labelKey: "badge.exactMaps3" },
    ],
  },

  {
    family: "points",
    field: "total_points",
    icon: "🏆",
    unitKey: "badge.unitPoints",
    descKey: "badge.points.desc",
    poziomy: [
      { tier: 1, prog: 50, labelKey: "badge.points1" },
      { tier: 2, prog: 100, labelKey: "badge.points2" },
      { tier: 3, prog: 150, labelKey: "badge.points3" },
    ],
  },
];

// Odznaki pojedyncze - albo się je ma, albo nie.
const POJEDYNCZE = [
  {
    key: "perfect",
    field: "perfect_matches",
    prog: 1,
    tier: 3,
    icon: "✨",
    labelKey: "badge.perfect",
    descKey: "badge.perfect.desc",
    unit: "",
  },

  {
    key: "big-match",
    field: "best_match_points",
    prog: 9,
    tier: 2,
    icon: "💥",
    labelKey: "badge.bigMatch",
    descKey: "badge.bigMatch.desc",
    unitKey: "badge.unitPoints",
  },

  {
    key: "podium",
    field: "rank",
    prog: 3,
    tier: 3,
    // Miejsce jest jedyną statystyką, w której MNIEJ znaczy lepiej.
    lowerIsBetter: true,
    icon: "🥇",
    labelKey: "badge.podium",
    descKey: "badge.podium.desc",
    unit: "",
  },

  {
    key: "regular",
    field: "finished_predictions",
    prog: 25,
    tier: 1,
    icon: "📋",
    labelKey: "badge.regular",
    descKey: "badge.regular.desc",
    unit: "",
  },
];

function liczbaAlbo(wartosc) {
  if (wartosc === null || wartosc === undefined || wartosc === "") return null;

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : null;
}

function zdobyta(wartosc, prog, lowerIsBetter) {
  if (wartosc === null) return false;

  return lowerIsBetter ? wartosc <= prog : wartosc >= prog;
}

// Jak blisko do progu, w procentach. Dla miejsca w rankingu nie ma sensu -
// "połowa drogi do trzeciego miejsca" nic nie znaczy.
function postep(wartosc, prog, lowerIsBetter) {
  if (lowerIsBetter || wartosc === null || prog <= 0) return null;

  return Math.min(100, Math.round((wartosc / prog) * 100));
}

/**
 * Odznaki gracza: zdobyte i najbliższe do zdobycia.
 *
 * @returns {{ earned: Array, next: Array }}
 */
export function awardBadges(profile, { ileNastepnych = 3, t } = {}) {
  if (!profile) return { earned: [], next: [] };

  // Domyślnie sam klucz. Ten moduł jest liczony także w testach, gdzie
  // tłumacza nie ma i nie jest do niczego potrzebny - sprawdzają klucze
  // odznak i progi, a nie brzmienie napisów.
  const napis = t ?? ((klucz) => klucz);

  // Opis odznaki to zawsze próg plus rzecz ("5 trafień z rzędu"), więc
  // jeden klucz na rodzinę zamiast osobnego na każdy z trzech poziomów.
  const opis = (klucz, prog) => napis(klucz, { count: prog });

  const jednostka = (zrodlo) =>
    zrodlo.unitKey ? napis(zrodlo.unitKey) : zrodlo.unit;

  const earned = [];
  const kandydaci = [];

  for (const rodzina of RODZINY) {
    const wartosc = liczbaAlbo(profile[rodzina.field]);

    // Najwyższy zdobyty poziom i pierwszy niezdobyty.
    let najwyzszy = null;
    let nastepny = null;

    for (const p of rodzina.poziomy) {
      if (zdobyta(wartosc, p.prog, false)) {
        najwyzszy = p;
      } else if (!nastepny) {
        nastepny = p;
      }
    }

    if (najwyzszy) {
      earned.push({
        key: `${rodzina.family}-${najwyzszy.tier}`,
        icon: rodzina.icon,
        label: napis(najwyzszy.labelKey),
        desc: opis(rodzina.descKey, najwyzszy.prog),
        tier: najwyzszy.tier,
        value: wartosc,
        unit: jednostka(rodzina),
      });
    }

    if (nastepny) {
      kandydaci.push({
        key: `${rodzina.family}-${nastepny.tier}`,
        icon: rodzina.icon,
        label: napis(nastepny.labelKey),
        desc: opis(rodzina.descKey, nastepny.prog),
        tier: nastepny.tier,
        value: wartosc ?? 0,
        target: nastepny.prog,
        unit: jednostka(rodzina),
        percent: postep(wartosc ?? 0, nastepny.prog, false),
      });
    }
  }

  for (const o of POJEDYNCZE) {
    const wartosc = liczbaAlbo(profile[o.field]);

    if (zdobyta(wartosc, o.prog, o.lowerIsBetter)) {
      earned.push({
        key: o.key,
        icon: o.icon,
        label: napis(o.labelKey),
        desc: opis(o.descKey, o.prog),
        tier: o.tier,
        value: wartosc,
        unit: jednostka(o),
      });
    } else {
      kandydaci.push({
        key: o.key,
        icon: o.icon,
        label: napis(o.labelKey),
        desc: opis(o.descKey, o.prog),
        tier: o.tier,
        value: wartosc ?? 0,
        target: o.prog,
        unit: jednostka(o),
        percent: postep(wartosc ?? 0, o.prog, o.lowerIsBetter),
      });
    }
  }

  // Zdobyte: od najwyższego poziomu. Do zdobycia: od najbliższych, żeby na
  // górze stało to, co realnie w zasięgu, a nie to, co najtrudniejsze.
  earned.sort((a, b) => b.tier - a.tier || a.label.localeCompare(b.label));

  const next = kandydaci
    .filter((k) => k.percent !== null)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, ileNastepnych);

  return { earned, next };
}
