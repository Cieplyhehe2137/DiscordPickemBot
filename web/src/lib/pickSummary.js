// Podpis pod nazwa gracza w rankingu: z czego wzial sie jego wynik.
//
// CZEGO BRAKOWALO. Podpis liczyl WYLACZNIE typy meczowe, a klasyfikacja
// turnieju sklada sie z szesciu skladowych, z czego piec to fazy. Kto
// wytypowal cala drabinke playoffs i ani jednego meczu, czytal o sobie
// "0 z 37 typow" - czyli nieprawde. Zmierzone na produkcji: w epl-season24
// osmioro z dziewieciu graczy dopisanych do klasyfikacji ma dokladnie taki
// wiersz.
//
// Drugi, wiekszy przypadek: turniej bez meczow. StarLadder Budapest to same
// fazy - 509 graczy, 1055 oddanych typow - i podpis znikal tam CALKOWICIE,
// bo warunek chowal go przy zerze meczow. Teraz pojawia sie wtedy, gdy jest
// co powiedziec, a nie wtedy, gdy turniej ma mecze.
//
// DLACZEGO LICZBY ZOSTAJA ROZDZIELONE. Dla czytajacego one sie dodaja, ale
// w danych sa osobne i musza takie zostac: total_predictions jest
// mianownikiem skutecznosci i bramka progu w lib/accuracyRanking.js (polowa
// ROZSTRZYGNIETYCH MECZOW). Wspolny licznik zanizylby procent trafien
// kazdemu, kto typowal fazy, i pozwalalby wejsc do stawki bez typowania
// meczow. Patrz komentarz przy phase_predictions w server/routes/events.js.
//
// DLACZEGO NAPIS O FAZACH JEST KROTKI. Ta kolumna ma na telefonie (375 px)
// tylko 156-163 px - zmierzone na wyrenderowanej stronie, nie oszacowane.
// Podpis bez faz mial 154 px i miescil sie w jednej linii. Z dopiskiem
// "4 wytypowane fazy" wychodzilo 266 px, czyli dwie linie w widoku punktowym
// i TRZY w widoku skutecznosci, gdzie czlonow jest trzy - razy 48 wierszy.
// Krotka forma ("4 typy faz", 52 px) daje dwie linie zamiast trzech.
//
// Jest przy tym jednoznaczna, i to jest drugi powod: "1 typ fazy" to liczba
// TYPOW, a samo "1 faza" dawaloby sie przeczytac jako liczbe faz turnieju -
// akurat w wierszu "0 z 37 typow", gdzie ta liczba jest cala informacja.
//
// CZYSTY, BEZ IMPORTOW. Dostaje gotowe `t`, tak samo jak rozbicieNaFazy
// obok - zeby dalo sie go sprawdzic w node:test bez Vite i bez Reacta.

function liczba(wartosc) {
  const n = Number(wartosc);

  return Number.isFinite(n) ? n : 0;
}

/**
 * Czlony podpisu, w kolejnosci czytania.
 *
 * @param player  wiersz rankingu: total_predictions, phase_predictions,
 *                accuracy, points_rank
 * @param matches ile meczow turnieju jest rozstrzygnietych
 * @param byAccuracy czy tabela jest ulozona po skutecznosci - w tym widoku
 *                odsetek stoi w kolumnie obok, wiec nie powtarzamy go tutaj,
 *                a w jego miejsce idzie miejsce punktowe
 * @param byEarned czy tabela jest ulozona po trafieniach zarobionych. Odsetek
 *                ZOSTAJE w podpisie, bo w kolumnie stoi liczba zarobionych,
 *                a nie procent - ale miejsce punktowe dochodzi tak samo jak
 *                przy skutecznosci: bez niego nie widac, ze trzecie miejsce
 *                w tej tabeli stoi punktowo na dziewiatym
 * @param t       tlumacz
 *
 * Zwraca tablice napisow. Pusta znaczy "nie ma czego pokazac" - wolajacy
 * ma wtedy nie rysowac podpisu wcale, a nie rysowac pustej linii.
 */
export function buildPickSummary({
  player,
  matches = 0,
  byAccuracy = false,
  byEarned = false,
  t,
} = {}) {
  const meczow = liczba(matches);
  const typowMeczowych = liczba(player?.total_predictions);
  const typowFaz = liczba(player?.phase_predictions);

  const czlony = [];

  // Mecze: tylko wtedy, gdy turniej je ma. "0 z 0 typow" nie znaczy nic,
  // a w turnieju z samych faz dotyczyloby kazdego gracza.
  if (meczow > 0) {
    // Zero typow meczowych tez idzie na ekran - to informacja, ze ktos
    // pominal mecze, a nie brak danych.
    czlony.push(
      !byAccuracy && typowMeczowych > 0
        ? t("leaderboard.picksHit", {
          done: typowMeczowych,
          all: meczow,
          percent: liczba(player?.accuracy),
        })
        : t("leaderboard.picks", { done: typowMeczowych, all: meczow }),
    );
  }

  if (typowFaz > 0) {
    czlony.push(t("leaderboard.phasePicks", { count: typowFaz }));
  }

  // Skad ten czlowiek przyszedl w tabeli punktowej. Na koncu, bo to
  // odnosnik do drugiego widoku, a nie czesc jego wyniku.
  if ((byAccuracy || byEarned) && liczba(player?.points_rank) > 0) {
    czlony.push(t("leaderboard.pointsRank", { rank: player.points_rank }));
  }

  return czlony;
}

/** Ten sam podpis jako jeden napis, zlozony separatorem tabeli. */
export function formatPickSummary(wejscie) {
  return buildPickSummary(wejscie).join(" · ");
}
