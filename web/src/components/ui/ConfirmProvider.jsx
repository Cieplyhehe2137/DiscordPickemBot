import { useCallback, useId, useMemo, useRef, useState } from "react";

import { ConfirmContext } from "./confirmContext.js";
import { Dialog } from "./Dialog.jsx";

// Pytanie "na pewno?" zadawane własnym oknem zamiast przez `window.confirm`.
//
// Natywne okno ma trzy wady, z których tylko pierwsza jest o wyglądzie:
//
//  1. wygląda jak komunikat systemu, a nie jak część strony - i nie da się
//     w nim wyróżnić tego, co zniknie, ani pokazać liczb pogrubionych;
//  2. przeglądarka po drugim z rzędu proponuje "nie pozwalaj tej stronie
//     tworzyć kolejnych okien dialogowych". Po zaznaczeniu tego KAŻDE
//     następne `confirm()` zwraca `false` bez pytania, więc kasowanie po
//     cichu przestaje działać i nikt nie wie dlaczego;
//  3. zatrzymuje wątek przeglądarki - na czas pytania stoi wszystko,
//     razem z odświeżaniem wyników na żywo.
//
// Wywołanie zostaje prawie takie samo jak było, dochodzi jedno `await`:
//
//     if (!(await confirm({ title: "Usunąć drużynę?" }))) return;

export function ConfirmProvider({ children }) {
  // Jedno pytanie naraz - `{ options, resolve }` albo `null`.
  const [request, setRequest] = useState(null);

  // Rozwiązanie obietnicy trzymane w ref, a nie w stanie: sięgamy po nie
  // z procedur obsługi zdarzeń i musi być jedno, nawet gdy React zdąży
  // wyrenderować komponent dwa razy.
  const resolveRef = useRef(null);

  const titleId = useId();
  const descriptionId = useId();

  // Każde wyjście z okna przechodzi tędy. Drugie wywołanie nie robi nic, bo
  // `resolveRef` jest już puste - a wywołań jest z natury kilka: "Anuluj"
  // zamyka okno, zamknięcie zgłasza zdarzenie `close`, a ono woła to samo.
  const settle = useCallback((answer) => {
    const resolve = resolveRef.current;

    resolveRef.current = null;

    setRequest(null);

    if (resolve) resolve(answer);
  }, []);

  const confirm = useCallback(
    (options = {}) => {
      // Pytanie zadane, gdy inne jeszcze wisi, zamyka tamto odmową. Lepsze
      // to niż obietnica, która nigdy się nie rozwiąże i zostawia funkcję
      // wywołującą zawieszoną na zawsze.
      if (resolveRef.current) settle(false);

      return new Promise((resolve) => {
        resolveRef.current = resolve;

        setRequest({ options });
      });
    },
    [settle],
  );

  const value = useMemo(() => confirm, [confirm]);

  const options = request?.options ?? {};
  const danger = options.tone === "danger";

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <Dialog
        open={Boolean(request)}
        onClose={() => settle(false)}
        labelledBy={titleId}
        describedBy={options.description ? descriptionId : undefined}
        className={danger ? "ui-dialog--danger" : ""}
      >
        <h2 className="ui-dialog__title" id={titleId}>
          {options.title ?? "Na pewno?"}
        </h2>

        {options.description && (
          <p className="ui-dialog__text" id={descriptionId}>
            {options.description}
          </p>
        )}

        {/* Lista tego, co zniknie. Przy operacji nieodwracalnej liczby są
            ważniejsze od zdania, które je opisuje - stąd osobny blok, a nie
            doklejanie ich do opisu. */}
        {options.details?.length > 0 && (
          <ul className="ui-dialog__details">
            {options.details.map((detail) => (
              <li key={detail.label}>
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </li>
            ))}
          </ul>
        )}

        <div className="ui-dialog__actions">
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            onClick={() => settle(false)}
            // Przy kasowaniu fokus startuje na "Anuluj": Enter wciśnięty
            // odruchowo ma nie kasować danych.
            data-autofocus={danger ? "" : undefined}
          >
            {options.cancelLabel ?? "Anuluj"}
          </button>

          <button
            type="button"
            className={`ui-btn ${danger ? "ui-btn--danger" : "ui-btn--primary"}`}
            onClick={() => settle(true)}
            data-autofocus={danger ? undefined : ""}
          >
            {options.confirmLabel ?? "Potwierdź"}
          </button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
