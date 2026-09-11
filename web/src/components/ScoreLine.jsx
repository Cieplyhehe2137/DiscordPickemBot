// Wynik jako jedna całość: nazwa, liczba, nazwa.
//
// Zwycięska strona dostaje jaśniejszy tekst, żeby rezultat dało się odczytać
// jednym spojrzeniem, bez porównywania cyfr. Wariant compact służy listom
// map, gdzie wynik jest szczegółem wiersza, a nie jego nagłówkiem.

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
    winner ? `ui-scoreline--${winner}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <span className="ui-scoreline__team">{teamA}</span>

      <span className="ui-scoreline__score">
        {scoreA}:{scoreB}
      </span>

      <span className="ui-scoreline__team">{teamB}</span>
    </div>
  );
}

export default ScoreLine;
