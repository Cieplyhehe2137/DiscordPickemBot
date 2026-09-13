import { useEffect, useRef } from "react";

// Okno modalne na natywnym `<dialog>`.
//
// Świadomie bez biblioteki: `showModal()` daje pułapkę fokusu, obsługę Esc,
// tło i warstwę nad całą stroną za darmo i poprawnie. Wersje pisane ręcznie
// przewracają się zwykle na tym samym - na fokusie, który ucieka za okno.
//
// Warunek jest jeden: okno musi być otwarte metodą `showModal()`, a NIE
// atrybutem `open`. Atrybut daje okno niemodalne - bez tła, bez pułapki
// fokusu i bez warstwy nad resztą strony, czyli wszystko to, po co się po
// `<dialog>` sięga.

export function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  className = "",
  children,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;

    if (!el) return;

    if (open && !el.open) {
      el.showModal();

      // Przeglądarka ustawia fokus na pierwszym elemencie, który da się
      // ogniskować. Przy pytaniu o skasowanie czegoś pierwszy jest przycisk
      // potwierdzający, więc Enter kasowałby od razu - stąd jawne wskazanie,
      // co ma dostać fokus.
      const first = el.querySelector("[data-autofocus]");

      if (first) first.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // Zdarzenie `close` zbiera wszystkie drogi wyjścia w jedną: Esc, kliknięcie
  // w tło i przycisk "Anuluj" kończą tak samo, więc wywołujący ma jeden
  // przypadek do obsłużenia zamiast trzech.
  useEffect(() => {
    const el = ref.current;

    if (!el) return undefined;

    const handleClose = () => onClose();

    el.addEventListener("close", handleClose);

    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  // `showModal()` nie blokuje przewijania strony pod spodem - przy dłuższym
  // rankingu tło jeździ za kółkiem myszy, mimo że nie da się w nie kliknąć.
  useEffect(() => {
    if (!open) return undefined;

    const root = document.documentElement;
    const previous = root.style.overflow;

    root.style.overflow = "hidden";

    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`ui-dialog ${className}`.trim()}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Tło to ten sam element co okno - kliknięcie poza treścią trafia
      // w `<dialog>`, a nie w pudełko w środku.
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
    >
      {open ? <div className="ui-dialog__box">{children}</div> : null}
    </dialog>
  );
}
