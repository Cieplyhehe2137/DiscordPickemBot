// Historia gracza między turniejami.
//
// Profil jest w tym serwisie zawsze w obrębie jednego eventu i do tej pory
// nie dało się nigdzie zobaczyć, że ktoś grał w kilku. To nie jest inne
// ułożenie danych, które już są na ekranie - tej informacji nie było wcale.
//
// DLACZEGO NIE RANKING WSZECH CZASÓW. Policzone na całej bazie: na 1110
// graczy 946 (85%) zagrało w dokładnie jednym turnieju, 144 w dwóch, 20 we
// wszystkich trzech. Ranking z sumy punktów miałby w pierwszej dwudziestce
// piętnastu tych samych ludzi, co pierwsza dwudziestka największego eventu -
// byłby w trzech czwartych jego kopią i nagradzałby frekwencję zamiast
// skuteczności. Historia na profilu dotyczy tych samych 15% graczy, ale
// niczego nie udaje: komu nie przysługuje, ten jej po prostu nie widzi.

function liczbaAlbo(wartosc, zapasowa = 0) {
  if (wartosc === null || wartosc === undefined || wartosc === "") {
    return zapasowa;
  }

  const n = Number(wartosc);

  return Number.isFinite(n) ? n : zapasowa;
}

/**
 * Układa wiersze klasyfikacji w historię startów.
 *
 * @param rows        wiersze z miejscem i liczbą uczestników na turniej
 * @param currentEventId turniej, który gracz właśnie ogląda - wypada z listy
 */
export function buildPlayerHistory(rows, currentEventId) {
  return (rows || [])
    .filter((r) => Number(r.event_id) !== Number(currentEventId))
    .map((r) => {
      const rank = liczbaAlbo(r.rank_position, 0);
      const total = liczbaAlbo(r.uczestnicy, 0);

      return {
        event_id: Number(r.event_id),
        name: r.name,
        slug: r.slug,
        is_archived: Boolean(r.is_archived),

        points: liczbaAlbo(r.total_points, 0),

        rank: rank > 0 ? rank : null,
        participants: total,

        // Górny procent stawki. Liczony raz tutaj, a nie w widoku - i tylko
        // wtedy, gdy jest z czego: przy zerze uczestników dzielenie nie ma
        // sensu, a zero procent wyglądałoby jak pierwsze miejsce.
        top_percent:
          rank > 0 && total > 0
            ? Math.max(1, Math.ceil((rank / total) * 100))
            : null,
      };
    });
}
