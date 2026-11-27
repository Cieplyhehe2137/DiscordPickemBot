// utils/scoreOptions.js

/**
 * Opcje dropdowna z wynikiem serii.
 *
 * ETYKIETA IDZIE Z PERSPEKTYWY ZWYCIĘZCY, a `value` zostaje w formacie
 * "A:B" - czyli tak, jak wynik leży w bazie (pred_a:pred_b).
 *
 * DLACZEGO TO DWIE RÓŻNE RZECZY. Wcześniej etykieta szła za wartością
 * i wygrana drugiej drużyny wyświetlała się jako „0-2 Heroic": liczby
 * z punktu widzenia pierwszej drużyny, nazwa drugiej. Czyta się to jak
 * porażkę Heroic, a znaczy jej zwycięstwo 2-0. Strona nie miała tego
 * problemu - web/src/pages/MatchPage.jsx odwraca liczby przy wygranej
 * gospodarza wyjazdowego - więc bot był jedynym miejscem z tym zapisem.
 *
 * ODWRACAMY WYŁĄCZNIE NAPIS. Gdyby odwrócić `value`, każdy typ na drugą
 * drużynę zapisałby się jako typ na pierwszą i cała punktacja poszłaby
 * w odwrotną stronę - to jest ten rodzaj błędu, który wychodzi dopiero
 * przy rozliczeniu turnieju.
 */

// Ile wygranych map kończy serię. Klucz to format serii.
const MAP_DO_WYGRANEJ = { 1: 1, 3: 2, 5: 3 };

function scoreOptionsForBo(bestOf, teamA = "Team A", teamB = "Team B") {
  const doWygranej = MAP_DO_WYGRANEJ[Number(bestOf)];

  if (!doWygranej) return [];

  const opcje = [];

  // Wygrana pierwszej drużyny: etykieta i wartość mówią to samo.
  for (let przegrane = 0; przegrane < doWygranej; przegrane += 1) {
    opcje.push({
      label: `${doWygranej}-${przegrane} ${teamA}`,
      value: `${doWygranej}:${przegrane}`,
    });
  }

  // Wygrana drugiej drużyny: etykieta liczy od zwycięzcy, wartość nadal
  // od pierwszej drużyny.
  for (let przegrane = 0; przegrane < doWygranej; przegrane += 1) {
    opcje.push({
      label: `${doWygranej}-${przegrane} ${teamB}`,
      value: `${przegrane}:${doWygranej}`,
    });
  }

  return opcje;
}

module.exports = { scoreOptionsForBo };
