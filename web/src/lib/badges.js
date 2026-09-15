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
    poziomy: [
      { tier: 1, prog: 50, label: "Celny", desc: "50% trafionych zwycięzców" },
      { tier: 2, prog: 60, label: "Bardzo celny", desc: "60% trafionych zwycięzców" },
      { tier: 3, prog: 65, label: "Snajper", desc: "65% trafionych zwycięzców" },
    ],
  },

  {
    family: "streak",
    field: "best_correct_streak",
    icon: "🔥",
    unit: "",
    poziomy: [
      { tier: 1, prog: 5, label: "Rozgrzany", desc: "5 trafień z rzędu" },
      { tier: 2, prog: 8, label: "Gorąca ręka", desc: "8 trafień z rzędu" },
      { tier: 3, prog: 10, label: "Nie do zatrzymania", desc: "10 trafień z rzędu" },
    ],
  },

  {
    family: "exact_series",
    field: "exact_series",
    icon: "📐",
    unit: "",
    poziomy: [
      { tier: 1, prog: 5, label: "Dokładny", desc: "5 dokładnych wyników serii" },
      { tier: 2, prog: 15, label: "Precyzyjny", desc: "15 dokładnych wyników serii" },
      { tier: 3, prog: 20, label: "Zegarmistrz", desc: "20 dokładnych wyników serii" },
    ],
  },

  {
    family: "exact_maps",
    field: "exact_maps",
    icon: "💎",
    unit: "",
    poziomy: [
      { tier: 1, prog: 3, label: "Znawca map", desc: "3 dokładne wyniki map" },
      { tier: 2, prog: 7, label: "Kartograf", desc: "7 dokładnych wyników map" },
      { tier: 3, prog: 10, label: "Jasnowidz", desc: "10 dokładnych wyników map" },
    ],
  },

  {
    family: "points",
    field: "total_points",
    icon: "🏆",
    unit: " pkt",
    poziomy: [
      { tier: 1, prog: 50, label: "Pięćdziesiątka", desc: "50 punktów w turnieju" },
      { tier: 2, prog: 100, label: "Setka", desc: "100 punktów w turnieju" },
      { tier: 3, prog: 150, label: "Sto pięćdziesiąt", desc: "150 punktów w turnieju" },
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
    label: "Komplet",
    desc: "Mecz trafiony co do mapy",
    unit: "",
  },

  {
    key: "big-match",
    field: "best_match_points",
    prog: 9,
    tier: 2,
    icon: "💥",
    label: "Wielki mecz",
    desc: "9 punktów za jeden mecz",
    unit: " pkt",
  },

  {
    key: "podium",
    field: "rank",
    prog: 3,
    tier: 3,
    // Miejsce jest jedyną statystyką, w której MNIEJ znaczy lepiej.
    lowerIsBetter: true,
    icon: "🥇",
    label: "Podium",
    desc: "Miejsce w pierwszej trójce",
    unit: "",
  },

  {
    key: "regular",
    field: "finished_predictions",
    prog: 25,
    tier: 1,
    icon: "📋",
    label: "Bywalec",
    desc: "25 rozliczonych typów",
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
export function awardBadges(profile, { ileNastepnych = 3 } = {}) {
  if (!profile) return { earned: [], next: [] };

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
        label: najwyzszy.label,
        desc: najwyzszy.desc,
        tier: najwyzszy.tier,
        value: wartosc,
        unit: rodzina.unit,
      });
    }

    if (nastepny) {
      kandydaci.push({
        key: `${rodzina.family}-${nastepny.tier}`,
        icon: rodzina.icon,
        label: nastepny.label,
        desc: nastepny.desc,
        tier: nastepny.tier,
        value: wartosc ?? 0,
        target: nastepny.prog,
        unit: rodzina.unit,
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
        label: o.label,
        desc: o.desc,
        tier: o.tier,
        value: wartosc,
        unit: o.unit,
      });
    } else {
      kandydaci.push({
        key: o.key,
        icon: o.icon,
        label: o.label,
        desc: o.desc,
        tier: o.tier,
        value: wartosc ?? 0,
        target: o.prog,
        unit: o.unit,
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
