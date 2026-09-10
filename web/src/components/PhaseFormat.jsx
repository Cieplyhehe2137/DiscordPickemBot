import { odmien } from "../lib/odmiana.js";

// Format fazy, czyli ile drużyn wchodzi w którą kategorię.
//
// Instrukcje na stronach faz są w trybie rozkazującym ("wybierz dokładnie
// 2 drużyny") i mają sens tylko wtedy, gdy typowanie jest otwarte. Na
// zakończonym turnieju czytelnik widział wyniki, nie wiedząc, według jakich
// zasad był rozgrywany - a odkąd liczby są konfigurowalne per event, nie da
// się ich już założyć z góry.
//
// Ten opis jest bezokolicznikowy i nie zmienia się wraz z fazą życia eventu,
// więc czyta się tak samo w trakcie turnieju i w historii.

// Kolejność ma znaczenie - opisuje drogę przez fazę, od najlepszych wyników
// do awansu, a nie kolejność kluczy w obiekcie.
const GRUPY = {
  stage1: ["x3_0", "x0_3", "advancing"],
  stage2: ["x3_0", "x0_3", "advancing"],
  stage3: ["x3_0", "x0_3", "advancing"],
  playin: ["teams"],
  playoffs: ["semifinalists", "finalists", "winner", "third"],
  doubleelim: ["upperFinalA", "lowerFinalA", "upperFinalB", "lowerFinalB"],
};

// Rzeczownik odmieniany przez liczebnik: [1, 2-4, 5+].
const OPIS = {
  x3_0: (n) => `${n} ${odmien(n, "drużyna", "drużyny", "drużyn")} z bilansem 3-0`,
  x0_3: (n) => `${n} ${odmien(n, "drużyna", "drużyny", "drużyn")} z bilansem 0-3`,
  advancing: (n) => `${n} ${odmien(n, "drużyna", "drużyny", "drużyn")} do awansu`,
  // Rzeczownik i przymiotnik odmieniają się razem: "1 drużyna awansująca",
  // "2 drużyny awansujące", "8 drużyn awansujących".
  teams: (n) =>
    `${n} ${odmien(n, "drużyna", "drużyny", "drużyn")} ` +
    odmien(n, "awansująca", "awansujące", "awansujących"),
  semifinalists: (n) =>
    `${n} ${odmien(n, "półfinalista", "półfinalistów", "półfinalistów")}`,
  finalists: (n) => `${n} ${odmien(n, "finalista", "finalistów", "finalistów")}`,
  winner: (n) => `${n} ${odmien(n, "zwycięzca", "zwycięzców", "zwycięzców")}`,
  third: (n) => `${n} na 3. miejscu`,
  upperFinalA: (n) => `Upper Final A: ${n}`,
  lowerFinalA: (n) => `Lower Final A: ${n}`,
  upperFinalB: (n) => `Upper Final B: ${n}`,
  lowerFinalB: (n) => `Lower Final B: ${n}`,
};

function PhaseFormat({ faza, limity }) {
  const grupy = GRUPY[faza];

  if (!grupy || !limity) return null;

  const czesci = grupy
    .map((grupa) => {
      const liczba = Number(limity[grupa]);

      // Zero znaczy, że tej kategorii turniej nie ma - np. brak meczu
      // o 3. miejsce. Wtedy nie wymieniamy jej wcale.
      if (!Number.isFinite(liczba) || liczba <= 0) return null;

      return OPIS[grupa] ? OPIS[grupa](liczba) : `${grupa}: ${liczba}`;
    })
    .filter(Boolean);

  if (!czesci.length) return null;

  return (
    <p className="phase-format">
      <span className="phase-format__etykieta">Format tej fazy</span>

      <span className="phase-format__wartosc">{czesci.join(" · ")}</span>
    </p>
  );
}

export default PhaseFormat;
