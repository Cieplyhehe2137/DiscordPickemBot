// Wynik jako jedna całość: nazwa, liczba, nazwa.
//
// Dwa sygnały, każdy o czym innym. Jasność mówi, kto wygrał: zwycięska nazwa
// jest jaśniejsza, więc rezultat czyta się bez porównywania cyfr. Barwa mówi,
// czyja to liczba - te same dwa kolory, które na karcie meczu stoją za nazwami
// drużyn i które niosą podział głosów w ui-split.
//
// Dlatego liczba jest rozbita na trzy kawałki zamiast jednego napisu: bez tego
// nie da się pokolorować jednej strony wyniku, nie kolorując drugiej.
//
// Wariant compact służy listom map, gdzie wynik jest szczegółem wiersza,
// a nie jego nagłówkiem - tam barwa nie wchodzi.

// Klasa strony wygrywającej wypisana dosłownie, a nie sklejana z `winner`.
// Nazwa zbudowana przez `ui-scoreline--${winner}` nie występuje w źródle jako
// tekst, więc przegląd martwego CSS-a uznaje obie reguły za nieużywane i je
// kasuje - wtedy wynik przestaje wyróżniać zwycięzcę i nikt tego nie zauważa
// w diffie, bo diff dotyczy CSS-a, a zepsuty jest widok.
const WINNER_CLASSES = {
  a: "ui-scoreline--a",
  b: "ui-scoreline--b",
};

function ScoreLine({ teamA, teamB, scoreA, scoreB, compact = false }) {
  const a = Number(scoreA);
  const b = Number(scoreB);

  const winner =
    Number.isFinite(a) && Number.isFinite(b) && a !== b
      ? a > b
        ? "a"
        : "b"
      : null;

  const classes = [
    "ui-scoreline",
    compact ? "ui-scoreline--compact" : "",
    WINNER_CLASSES[winner] ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <span className="ui-scoreline__team">{teamA}</span>

      <span className="ui-scoreline__score">
        <span className="ui-scoreline__value">{scoreA}</span>

        <span className="ui-scoreline__sep">:</span>

        <span className="ui-scoreline__value">{scoreB}</span>
      </span>

      <span className="ui-scoreline__team">{teamB}</span>
    </div>
  );
}

export default ScoreLine;
