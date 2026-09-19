import { useEffect, useState } from "react";

import { useLanguage } from "../i18n/useLanguage.js";

// Termin zamknięcia typowania na stronie fazy.
//
// Strona pozwalała typować i NIGDZIE nie pisała, do kiedy. Bot wysyła na
// Discorda datę i żywy odliczacz (`<t:unix:F>` i `<t:unix:R>`), ale to jest
// wiadomość na kanale, który można wyciszyć - a typ klika się tutaj.
//
// Termin leżał w active_panels.deadline i był nawet odczytywany przez
// bramkę zapisu, która brała z niego samo „czy minął" i wyrzucała wartość.

/** Jak często odświeżać odliczanie. */
const CO_ILE_MS = 30_000;

/** Poniżej ilu minut termin jest pilny i wiersz robi się ostrzegawczy. */
const PILNE_MINUTY = 60;

/**
 * „za 6 godzin", „in 6 hours", „через 6 часов".
 *
 * Liczebniki odmienia Intl, a nie słownik: pięć języków razy trzy formy
 * liczby mnogiej razy cztery jednostki to sześćdziesiąt napisów, których
 * przeglądarka i tak już zna. Gdy Intl tej funkcji nie ma, część względna
 * po prostu nie powstaje - data obok zostaje.
 */
function wzglednie(ms, jezyk) {
  if (typeof Intl?.RelativeTimeFormat !== "function") return null;

  try {
    const rtf = new Intl.RelativeTimeFormat(jezyk, { numeric: "always" });

    // W DÓŁ, nie do najbliższej. Przy terminie zaokrąglenie w górę mówi,
    // że czasu jest więcej, niż jest - czterdzieści minut pokazywało się
    // jako „za 1 godzinę" akurat w ostatniej godzinie, czyli wtedy, gdy
    // dokładność liczy się najbardziej.
    //
    // Jednostkę wybiera próg, a nie zaokrąglona wartość: dopiero od pełnej
    // godziny mówimy w godzinach, a od pełnej doby w dniach.
    const minuty = Math.max(0, Math.floor(ms / 60_000));

    if (minuty >= 24 * 60) return rtf.format(Math.floor(minuty / (24 * 60)), "day");
    if (minuty >= 60) return rtf.format(Math.floor(minuty / 60), "hour");

    return rtf.format(minuty, "minute");
  } catch {
    return null;
  }
}

/**
 * Data w STREFIE PRZEGLĄDARKI, z nazwą strefy.
 *
 * Terminy zapisuje się w Europe/Warsaw, a serwis ma pięć języków i graczy
 * w różnych strefach - sama godzina bez strefy wprowadzałaby w błąd akurat
 * tych, których pomyłka kosztuje najwięcej.
 *
 * SKŁADNIKI OSOBNO, nie `dateStyle`/`timeStyle`. Tamte dwa NIE DAJĄ SIĘ
 * łączyć z `timeZoneName`: `toLocaleString` rzuca wtedy
 * „TypeError: Invalid option", co przy renderowaniu wywraca całą stronę
 * typowania na biało. Sprawdzone w przeglądarce - i dlatego całość stoi
 * dodatkowo w try/catch: formatowanie daty nie ma prawa zgasić strony,
 * na której ktoś właśnie wpisuje typy.
 */
function sformatuj(kiedy, jezyk) {
  try {
    return kiedy.toLocaleString(jezyk, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    try {
      return kiedy.toLocaleString();
    } catch {
      return null;
    }
  }
}

function DeadlineNotice({ deadline }) {
  const { jezyk, t } = useLanguage();

  const [teraz, setTeraz] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return undefined;

    const id = setInterval(() => setTeraz(Date.now()), CO_ILE_MS);

    return () => clearInterval(id);
  }, [deadline]);

  // Termin jest opcjonalny: administrator nie musi go ustawić, a wtedy
  // typowanie jest otwarte do ręcznego zamknięcia fazy. Brak wiersza to
  // stan normalny, nie awaria.
  if (!deadline) return null;

  const kiedy = new Date(deadline);

  if (Number.isNaN(kiedy.getTime())) return null;

  const data = sformatuj(kiedy, jezyk);

  if (!data) return null;

  const zostalo = kiedy.getTime() - teraz;
  const minal = zostalo <= 0;

  const pilne = !minal && zostalo <= PILNE_MINUTY * 60_000;

  const odliczanie = minal ? null : wzglednie(zostalo, jezyk);

  return (
    <p
      className={`ui-note deadline-note${
        minal ? " ui-note--danger" : pilne ? " ui-note--warn" : ""
      }`}
    >
      <span aria-hidden="true">⏰</span>

      <span>
        {minal
          ? t("deadline.passedAt", { date: data })
          : t("deadline.closesAt", { date: data })}
      </span>

      {odliczanie && (
        <strong className="deadline-note__left">{odliczanie}</strong>
      )}
    </p>
  );
}

export default DeadlineNotice;
