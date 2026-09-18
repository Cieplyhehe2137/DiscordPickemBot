import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

// Grupa pozycji nawigacji pod jednym przyciskiem.
//
// Powstała, bo pasek zrobił się listą sześciu równorzędnych napisów, w której
// nie było widać, że dwie ostatnie pozycje to co innego niż pierwsze cztery.
// Pod wspólną nazwą grupa dostaje ją wprost, a pasek skraca się na tyle, że
// mieści się w jednym rzędzie także na telefonie.
//
// Przycisk, a nie link: to nie jest adres, tylko przełącznik. Gdyby był
// linkiem, czytnik ekranu zapowiadałby go jako przejście donikąd, a
// przeglądarka pokazywała pusty cel w pasku stanu.
function NavDropdown({ label, items }) {
  const [otwarte, setOtwarte] = useState(false);

  const kontener = useRef(null);
  const przycisk = useRef(null);

  const { pathname } = useLocation();

  // Przycisk jest podświetlony, gdy otwarta jest KTÓRAKOLWIEK z jego stron.
  // Bez tego wejście na "Wszech czasów" gasiło zaznaczenie w całym pasku
  // i nie było wiadomo, gdzie się jest.
  const aktywny = items.some((pozycja) => pozycja.to === pathname);

  // Zamknięcie po zmianie trasy. Kliknięcie pozycji zmienia adres, ale samo
  // menu zostałoby otwarte nad nową stroną - tak samo po cofnięciu się
  // przyciskiem przeglądarki.
  //
  // Poprawka W TRAKCIE RENDEROWANIA, a nie w useEffect. Efekt ustawiający
  // stan w odpowiedzi na zmianę wejścia powoduje drugie renderowanie
  // z nieaktualną zawartością pomiędzy - i słusznie zgłasza to reguła
  // react-hooks/set-state-in-effect. Porównanie z poprzednią wartością
  // załatwia to w jednym przebiegu.
  const [poprzedniaSciezka, setPoprzedniaSciezka] = useState(pathname);

  if (poprzedniaSciezka !== pathname) {
    setPoprzedniaSciezka(pathname);
    setOtwarte(false);
  }

  useEffect(() => {
    if (!otwarte) return undefined;

    function pozaMenu(event) {
      if (!kontener.current?.contains(event.target)) setOtwarte(false);
    }

    function klawisz(event) {
      if (event.key !== "Escape") return;

      setOtwarte(false);

      // Ognisko wraca na przycisk, a nie zostaje nigdzie. Inaczej po
      // zamknięciu klawiszem tabulator zaczynał od początku strony.
      przycisk.current?.focus();
    }

    // pointerdown, a nie click: menu ma zniknąć w chwili naciśnięcia, tak
    // samo jak każde inne menu w systemie.
    document.addEventListener("pointerdown", pozaMenu);
    document.addEventListener("keydown", klawisz);

    return () => {
      document.removeEventListener("pointerdown", pozaMenu);
      document.removeEventListener("keydown", klawisz);
    };
  }, [otwarte]);

  return (
    <div className="app-nav__group" ref={kontener}>
      <button
        type="button"
        ref={przycisk}
        className={`app-nav__item app-nav__trigger${aktywny ? " active" : ""}`}
        aria-expanded={otwarte}
        aria-haspopup="menu"
        onClick={() => setOtwarte((stan) => !stan)}
      >
        {label}

        <span className="app-nav__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {otwarte && (
        <div className="app-nav__menu" role="menu">
          {items.map((pozycja) => (
            <Link
              key={pozycja.to}
              to={pozycja.to}
              role="menuitem"
              className={`app-nav__menu-item${
                pozycja.to === pathname ? " active" : ""
              }`}
            >
              {pozycja.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default NavDropdown;
