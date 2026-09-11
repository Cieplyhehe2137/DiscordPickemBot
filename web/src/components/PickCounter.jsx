// Ile drużyn z wymaganych jest już wybranych.
//
// Sam napis "4/6" nie mówi, jak daleko do końca - trzeba go przeczytać i
// porównać dwie liczby. Pasek robi to za czytelnika, a po skompletowaniu
// obie rzeczy zmieniają kolor na zielony, więc widać, że przycisk zapisu
// jest już aktywny, bez wodzenia wzrokiem w dół.

function PickCounter({ selected, limit, label = "Wybrano" }) {
  const isComplete = limit > 0 && selected === limit;

  const percentage = limit > 0 ? Math.min(100, (selected / limit) * 100) : 0;

  return (
    <div className="ui-stack ui-stack--tight">
      <div className="ui-row ui-row--between ui-row--full">
        <span className="ui-stat__hint">{label}</span>

        <span className={`ui-count ${isComplete ? "ui-count--done" : ""}`}>
          {selected}/{limit}
        </span>
      </div>

      <div className="ui-meter">
        <div
          className={`ui-meter__fill ${isComplete ? "ui-meter__fill--ok" : ""}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default PickCounter;
