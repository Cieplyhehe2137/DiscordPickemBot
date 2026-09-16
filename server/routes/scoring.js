// Stawki punktowe jako publiczne API.
//
// rules/scoring.js opisuje sam siebie jako jedyne źródło stałych punktowych
// i po stronie bota nim jest - czytają go calculateScores oraz
// utils/matchScoring. Front nie czytał go wcale: te same jedenaście liczb
// stało wpisanych wprost w web/src/components/PhaseResults.jsx.
//
// To jest dokładnie ten układ, który w tym projekcie już raz cicho się
// rozjechał. Nagłówek rules/scoring.js opisuje, jak plik pokazywał regulamin,
// którego bot nie stosował: Swiss punktował 4/4/2 zamiast 3/3/1, a Playoffs
// 1/2/3/2 zamiast 2/3/5/2. Rozjazd nie daje błędu ani wpisu w logach - daje
// ekran z inną liczbą punktów niż ranking, więc wychodzi dopiero wtedy, gdy
// ktoś to zauważy i zgłosi.
//
// Trasa nie dotyka bazy. Oddaje stałe z modułu, który i tak siedzi w pamięci
// procesu, więc nie ma tu ani async, ani obsługi błędu zapytania.

export function registerScoringRoutes(app, { scoring }) {
  app.get("/api/public/scoring", (req, res) => {
    // Cały obiekt, bez przepisywania kategoria po kategorii. Wybieranie pól
    // tutaj znaczyłoby, że kategoria dopisana do rules/scoring.js nie dociera
    // na stronę, dopóki ktoś nie poprawi również tego miejsca - czyli ten sam
    // rozjazd, tylko przesunięty o jeden plik.
    res.json({ scoring });
  });
}
