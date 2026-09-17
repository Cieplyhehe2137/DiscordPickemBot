import { useT } from "../i18n/useLanguage.js";

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

// Opisy z liczbą mnogą - całe zdanie leży w słowniku, bo rzeczownik
// i przymiotnik zmieniają końcówki razem ("1 drużyna awansująca", "8 drużyn
// awansujących"), a każdy język dzieli liczby inaczej.
const KLUCZE = {
  x3_0: "phaseFormat.record30",
  x0_3: "phaseFormat.record03",
  advancing: "phaseFormat.advancing",
  teams: "phaseFormat.teams",
  semifinalists: "phaseFormat.semifinalists",
  finalists: "phaseFormat.finalists",
  winner: "phaseFormat.winner",
  third: "phaseFormat.third",
};

// Nazwy meczów w drabince double elimination NIE SĄ tłumaczone w żadnym
// języku - tak stoją na drabince organizatora i tak nazywają je gracze.
// Dlatego są tutaj, a nie w słowniku: pięć identycznych kopii tego samego
// napisu sugerowałoby, że kiedyś się rozejdą.
const DRABINKA = {
  upperFinalA: "Upper Final A",
  lowerFinalA: "Lower Final A",
  upperFinalB: "Upper Final B",
  lowerFinalB: "Lower Final B",
};

function PhaseFormat({ faza, limity }) {
  const t = useT();

  const grupy = GRUPY[faza];

  if (!grupy || !limity) return null;

  const czesci = grupy
    .map((grupa) => {
      const liczba = Number(limity[grupa]);

      // Zero znaczy, że tej kategorii turniej nie ma - np. brak meczu
      // o 3. miejsce. Wtedy nie wymieniamy jej wcale.
      if (!Number.isFinite(liczba) || liczba <= 0) return null;

      if (KLUCZE[grupa]) return t(KLUCZE[grupa], { count: liczba });

      if (DRABINKA[grupa]) return `${DRABINKA[grupa]}: ${liczba}`;

      return `${grupa}: ${liczba}`;
    })
    .filter(Boolean);

  if (!czesci.length) return null;

  return (
    <div className="ui-card ui-card--flat ui-card--tight ui-stack ui-stack--tight">
      <span className="ui-kicker">{t("phaseFormat.title")}</span>

      <span>{czesci.join(" · ")}</span>
    </div>
  );
}

export default PhaseFormat;
