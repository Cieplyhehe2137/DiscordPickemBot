import { useEffect, useId, useState } from "react";

import { Dialog } from "./ui/Dialog.jsx";
import PlayerAvatar from "./PlayerAvatar.jsx";
import Ladowanie from "./Ladowanie.jsx";
import { getEventLeaderboard } from "../lib/api.js";

// Wybór gracza do porównania.
//
// Lista graczy NIE jest pobierana w całości. Jeden turniej ma ich tysiąc stu,
// więc zwykła rozwijana lista znaczyłaby megabajt danych przy każdym otwarciu
// okna i przewijanie, w którym nikt nikogo nie znajdzie.
//
// Zamiast tego to samo zapytanie, co ranking: szukanie po stronie serwera,
// osiem wierszy naraz. Puste pole daje czoło tabeli, czyli sensowną domyślną
// propozycję - najczęściej porównujemy się z kimś z góry.
//
// Komponent montuje się dopiero przy otwarciu i znika przy zamknięciu, więc
// wpisana fraza i wyniki szukania giną same. Trzymanie ich przy zamkniętym
// oknie wymagałoby czyszczenia stanu efektem, a to znaczy kaskadę renderów
// przy każdym zamknięciu - i tak wygląda, jakby okno pamiętało poprzednie
// szukanie przez chwilę po ponownym otwarciu.

const NA_STRONIE = 8;

function PlayerPicker({ slug, excludeUserId, onPick, onClose }) {
  const [wpisane, setWpisane] = useState("");
  const [szukane, setSzukane] = useState("");
  const [gracze, setGracze] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const titleId = useId();

  // To, co wpisano, i to, czego szukamy, to dwie różne rzeczy - inaczej
  // każde naciśnięcie klawisza byłoby osobnym zapytaniem. Tak samo jak
  // w rankingu.
  useEffect(() => {
    const licznik = setTimeout(() => setSzukane(wpisane.trim()), 350);

    return () => clearTimeout(licznik);
  }, [wpisane]);

  useEffect(() => {
    let anulowane = false;

    async function szukaj() {
      try {
        setLoading(true);
        setError("");

        const dane = await getEventLeaderboard(slug, {
          szukaj: szukane,
          naStronie: NA_STRONIE,
        });

        if (!anulowane) setGracze(dane.leaderboard ?? []);
      } catch (err) {
        if (!anulowane) {
          setError(err.message || "Nie udało się wczytać listy graczy.");
        }
      } finally {
        if (!anulowane) setLoading(false);
      }
    }

    szukaj();

    return () => {
      anulowane = true;
    };
  }, [slug, szukane]);

  // Siebie samego nie ma z kim porównywać - serwer i tak odrzuciłby taki
  // adres, ale wiersz, który po kliknięciu pokazuje błąd, jest gorszy niż
  // wiersz, którego nie ma.
  const doPokazania = gracze.filter(
    (g) => String(g.user_id) !== String(excludeUserId),
  );

  return (
    <Dialog open onClose={onClose} labelledBy={titleId}>
      <h2 className="ui-dialog__title" id={titleId}>
        Z kim porównać?
      </h2>

      <input
        className="ui-input"
        type="search"
        value={wpisane}
        onChange={(e) => setWpisane(e.target.value)}
        placeholder="Szukaj gracza po nicku..."
        aria-label="Szukaj gracza"
        data-autofocus
      />

      {loading && <Ladowanie>Szukam graczy...</Ladowanie>}

      {error && <p className="ui-note ui-note--danger">{error}</p>}

      {!loading && !error && doPokazania.length === 0 && (
        <p className="ui-hint">
          {szukane
            ? `Nikt nie pasuje do "${szukane}".`
            : "W tym turnieju nie ma jeszcze sklasyfikowanych graczy."}
        </p>
      )}

      {!loading && !error && doPokazania.length > 0 && (
        <div className="ui-stack ui-stack--tight picker-list">
          {doPokazania.map((gracz) => (
            <button
              type="button"
              className="ui-row-item picker-list__item"
              key={gracz.user_id}
              onClick={() => onPick(gracz)}
            >
              <span className="ui-row-item__rank">{gracz.rank}</span>

              <span className="ui-row-item__who">
                <PlayerAvatar
                  userId={gracz.user_id}
                  avatar={gracz.avatar}
                  name={gracz.displayname}
                />

                <span className="ui-row-item__name">
                  {gracz.displayname ?? gracz.user_id}
                </span>
              </span>

              <strong className="ui-row-item__score">
                {Number(gracz.total_points ?? 0)}
              </strong>
            </button>
          ))}
        </div>
      )}

      <div className="ui-dialog__actions">
        <button
          type="button"
          className="ui-btn ui-btn--ghost"
          onClick={onClose}
        >
          Anuluj
        </button>
      </div>
    </Dialog>
  );
}

export default PlayerPicker;
